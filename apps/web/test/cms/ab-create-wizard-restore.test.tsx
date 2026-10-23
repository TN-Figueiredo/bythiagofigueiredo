// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(),
  uploadVariant: vi.fn(),
  startAbTest: vi.fn(),
  createTextVariant: vi.fn(),
  updateAbTestType: vi.fn(),
  cleanupDraftVariants: vi.fn(),
  fetchAbBriefingData: vi.fn(),
  fetchLibraryEntries: vi.fn(),
  lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'

const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null }
const settings = {} as AbTestSiteSettings

function guardarRascunho(type: string | null, step = 2) {
  localStorage.setItem('ab-wizard-draft-vid-1', JSON.stringify({
    step, type,
    variants: [{ label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' }],
    config: {}, hypothesis: '', savedAt: Date.now(),
  }))
}

function renderWizard(extra: Partial<React.ComponentProps<typeof AbCreateWizard>> = {}) {
  return render(
    <AbCreateWizard video={video} siteId="site-1" settings={settings} onClose={() => {}} onCreated={() => {}} {...extra} />,
  )
}

describe('AbCreateWizard: restauração de rascunho valida o tipo', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
    })
  })

  it('rascunho local com tipo antigo (description) volta ao passo tipo, sem tipo marcado', () => {
    guardarRascunho('description')
    renderWizard()
    const grupo = screen.getByRole('radiogroup', { name: 'Tipo de teste' })
    expect(grupo).toBeTruthy()
    expect(screen.queryAllByRole('radio').filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(0)
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('rascunho do banco com tipo antigo (prefill) volta ao passo tipo', () => {
    renderWizard({ existingDraftId: 'd1', prefill: { testType: 'description' as never } })
    expect(screen.getByRole('radiogroup', { name: 'Tipo de teste' })).toBeTruthy()
  })

  it('rascunho local com tipo válido (combo) segue no passo salvo', () => {
    guardarRascunho('combo')
    renderWizard()
    expect(screen.queryByRole('radiogroup', { name: 'Tipo de teste' })).toBeNull()
  })
})
