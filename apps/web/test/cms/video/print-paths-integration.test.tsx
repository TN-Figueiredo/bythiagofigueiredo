// apps/web/test/cms/video/print-paths-integration.test.tsx
//
// Integration contract for the two print overlays once they are wired into the
// editor shell behind the reducer's overlay state (recordingOpen / handoffOpen):
//
//   • the `.focus-exit` chrome carries the class the in-app print rule targets
//     (`@media print { body:not(.recording) .focus-exit { display:none } }`),
//     so it NEVER prints — neither on the in-app ⌘P path (rule above) nor on the
//     overlay paper path (`body.recording > *:not(.rec-overlay) { display:none }`).
//   • the overlays render ONLY when their reducer flag is open, and mounting one
//     engages `body.recording` (print path A).
//
// `next/dynamic` is mocked to resolve loaders synchronously so the shell's
// `dynamic(ssr:false)` overlay imports render inline under happy-dom.
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'

// The shell loads the overlays via `dynamic(() => import(...).then((m) => m.X), { ssr:false })`,
// so the loader resolves the component directly. Bridge it through React.lazy/Suspense so
// testing-library can await the async chunk under happy-dom.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<React.ComponentType<Record<string, unknown>>>) => {
    const Lazy = React.lazy(async () => ({ default: await loader() }))
    const Wrapper: React.FC<Record<string, unknown>> = (props) =>
      React.createElement(React.Suspense, { fallback: null }, React.createElement(Lazy, props))
    return Wrapper
  },
}))

import { RecordingSheet } from '@/app/cms/(authed)/video/[id]/edit/_overlays/recording-sheet'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

afterEach(() => {
  cleanup()
  document.body.classList.remove('recording')
})

const make = (over: Partial<VideoEditorState> = {}): VideoEditorState => ({
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'gravacao', version: 1,
  activeLang: 'pt', activeStage: 'pos', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false, ...over,
})

const stubData = {
  ideia: { pt: { title: 't', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
  roteiro: { pt: { beats: [] }, en: null }, pillar: undefined, durationRange: '14–17 min',
  versions: {
    pt: { title: 't', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '14–17 min', location: '', recorded: '—', beats: [] },
    en: { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] },
  },
  saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(),
  hasUnsavedChanges: false, saveAll: vi.fn().mockResolvedValue(undefined), autosaveState: 'saved' as const,
  sections: {}, abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null }, winnerVariantId: null,
  savePostprod: vi.fn().mockResolvedValue(undefined), savePublish: vi.fn().mockResolvedValue(undefined),
  advanceToRecorded: vi.fn().mockResolvedValue({ ok: true }), publishVideo: vi.fn().mockResolvedValue({ ok: true }),
}

function shell(state: VideoEditorState) {
  return render(
    <VideoEditorProvider initialState={state}>
      <VideoDataProvider value={stubData as never}>
        <EditorShell />
      </VideoDataProvider>
    </VideoEditorProvider>,
  )
}

describe('print paths — .focus-exit exclusion contract', () => {
  it('a .focus-exit element is targeted by the in-app print hide rule, and the overlay engages body.recording', () => {
    render(
      <>
        <button className="focus-exit">Modo foco — clique para sair · esc</button>
        <RecordingSheet
          code="VID-001"
          channelName="Thiago"
          channelLabel="PT"
          channelFlag="🇧🇷"
          pillarLabel="Código"
          durationRange="14–17 min"
          title="t"
          beats={[]}
          langOptions={[]}
          onSwitchLang={() => {}}
          onClose={() => {}}
        />
      </>,
    )
    const exit = document.querySelector('.focus-exit')
    expect(exit).not.toBeNull()
    expect(exit?.classList.contains('focus-exit')).toBe(true)
    // overlay engaged the recording paper path (print path A)
    expect(document.body.classList.contains('recording')).toBe(true)
  })

  it('the in-app print CSS hides .focus-exit on the body:not(.recording) path', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../../../src/app/cms/(authed)/video/video.css'),
      'utf8',
    )
    // Print path B (in-app ⌘P) collapses the focus-exit chrome.
    expect(css).toMatch(/body:not\(\.recording\)\s+\.focus-exit\s*\{\s*display:\s*none/)
    // Print path A (overlay paper) hides EVERY body child except the portaled overlay —
    // .focus-exit lives inside the app shell. (The shell has no `.app` class; the old
    // `body.recording > .app` selector matched nothing and leaked the dark app into print.)
    expect(css).toMatch(/body\.recording\s*>\s*\*:not\(\.rec-overlay\)\s*\{\s*display:\s*none/)
  })

  it('print is CLEAN by default: per-line .rb-mark hidden unless markGran=linha; mark-off hides every overlay tick', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../../../src/app/cms/(authed)/video/video.css'),
      'utf8',
    )
    // Editor-stage ⌘P: the per-line read-clock box only prints when the user picked Linha.
    expect(css).toMatch(/body:not\(\.recording\)\s+\.rot-doc:not\(\.mark-linha\)\s+\.rb-mark\s*\{\s*display:\s*none/)
    // Overlay paper: mark-off collapses every pen-box (line + section + beat) to zero.
    expect(css).toMatch(/\.rec-overlay\.mark-off[^{]*\.rs-tick[^{]*\{\s*display:\s*none/)
  })
})

describe('overlay wiring — render only when the reducer flag is open', () => {
  it('renders no .rec-overlay when no overlay flag is open', async () => {
    shell(make())
    // give the dynamic loaders a tick — they must still render nothing.
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('.rec-overlay')).toBeNull()
    expect(document.body.classList.contains('recording')).toBe(false)
  })

  it('renders the RecordingSheet (.rec-overlay) when recordingOpen is true', async () => {
    shell(make({ recordingOpen: true }))
    await waitFor(() => expect(document.querySelector('.rec-overlay')).not.toBeNull())
    expect(document.body.classList.contains('recording')).toBe(true)
  })

  // The handoff is the editor's document and the editor is a foreigner, so the sheet
  // opens in ENGLISH by default (its own `handoffLang`, independent of the PT editor
  // toggle in `state.activeLang`). Chrome shows "Editor brief", never the PT "Brief pro editor".
  it('renders the HandoffSheet in ENGLISH ("Editor brief") by default when handoffOpen is true', async () => {
    shell(make({ handoffOpen: true, activeLang: 'pt' }))
    await waitFor(() => {
      const overlay = document.querySelector('.rec-overlay')
      expect(overlay).not.toBeNull()
      expect(overlay?.textContent).toContain('Editor brief')
      expect(overlay?.textContent).not.toContain('Brief pro editor')
    })
    expect(document.body.classList.contains('recording')).toBe(true)
  })
})
