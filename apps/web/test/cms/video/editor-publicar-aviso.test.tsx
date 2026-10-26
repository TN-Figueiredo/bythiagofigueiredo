// Toast do aviso do publishVideo (b3ecd0558): prova na tela que o aviso aparece, e só quando existe.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
// A etapa real só habilita o CTA com rascunho A/B completo; aqui interessa a ligação onPublish -> toast do shell.
vi.mock('@/app/cms/(authed)/video/[id]/edit/stages/publicacao-stage', () => ({
  PublicacaoStage: ({ onPublish }: { onPublish: () => void }) => <button type="button" onClick={onPublish}>Publicar + iniciar teste</button>,
}))

import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import { initialFromDetail } from '@/app/cms/(authed)/video/[id]/edit/reducer'

const V = { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] }
const I = { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }

function montar(publishVideo: ReturnType<typeof vi.fn>) {
  const data = {
    ideia: { pt: I, en: I }, roteiro: { pt: null, en: null }, versions: { pt: V, en: V }, pillar: undefined, durationRange: undefined,
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(), hasUnsavedChanges: false,
    saveAll: vi.fn().mockResolvedValue(undefined), autosaveState: 'saved' as const, sections: {},
    abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null }, winnerVariantId: null,
    savePostprod: vi.fn(), savePublish: vi.fn(), advanceToRecorded: vi.fn(), publishVideo, openHandoff: vi.fn(), openCowork: vi.fn(),
  }
  const initialState = initialFromDetail({ itemId: 'p1', code: 'VID-1', siteId: 'site-1', stage: 'gravacao', version: 1, primaryLang: 'pt' })
  render(
    <VideoEditorProvider initialState={initialState}>
      <VideoDataProvider value={data as never}>
        <EditorShell />
      </VideoDataProvider>
    </VideoEditorProvider>,
  )
  fireEvent.click(screen.getByRole('tab', { name: /Publicação/i }))
  fireEvent.click(screen.getByRole('button', { name: /Publicar \+ iniciar teste/i }))
}

beforeEach(() => vi.clearAllMocks())

describe('publicar: aviso de títulos fora do teste', () => {
  it('com aviso, o toast de atenção aparece com o texto', async () => {
    const aviso = '2 títulos ficaram fora do teste (limite da regra nova); estão na nota do teste.'
    montar(vi.fn().mockResolvedValue({ ok: true, stage: 'published', version: 2, aviso }))
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Publicado, com um aviso', expect.objectContaining({ description: aviso })))
    expect(toast.error).not.toHaveBeenCalled()
  })
  it('sem aviso, nenhum toast', async () => {
    const pub = vi.fn().mockResolvedValue({ ok: true, stage: 'published', version: 2, aviso: null })
    montar(pub)
    await waitFor(() => expect(pub).toHaveBeenCalled())
    expect(toast.warning).not.toHaveBeenCalled()
  })
  it('falha de publicação mostra o erro, não o aviso', async () => {
    montar(vi.fn().mockResolvedValue({ ok: false, error: 'x' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha ao publicar', { description: 'x' }))
    expect(toast.warning).not.toHaveBeenCalled()
  })
})
