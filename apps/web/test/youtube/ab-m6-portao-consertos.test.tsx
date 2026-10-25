// @vitest-environment jsdom
// Consertos do portão M6 (lote C): original do banco, tipo repetido, troca de tipo que falha, imagem já gravada, painel em português.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const m = vi.hoisted(() => ({
  updateType: vi.fn(async (_id: string, _t: string): Promise<Record<string, unknown>> => ({ ok: true })),
  upload: vi.fn(async (_t: string, _fd: FormData): Promise<Record<string, unknown>> => ({ ok: true, variantId: 'up1' })),
  cleanup: vi.fn(async (_t: string, _o?: { manter?: string[] }) => ({ ok: true })),
  start: vi.fn(async (_id: string): Promise<Record<string, unknown>> => ({ ok: true })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: m.upload, createTextVariant: vi.fn(async () => ({ ok: true, id: 'n' })), updateTextVariant: vi.fn(async () => ({ ok: true })),
  updateAbTestType: m.updateType, cleanupDraftVariants: m.cleanup, fetchAbBriefingData: vi.fn(), fetchLibraryEntries: vi.fn(async () => []),
  lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import { toDraftList, passoDoRascunho } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { bloqueioDoVideo } from '@/lib/youtube/ab-linha-video'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'

const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: 'https://i.ytimg.com/a.jpg' }
// Como o banco devolve a original: rótulo `original`, título nulo (vira '' em getAbDraftById)
const ORIGINAL_DO_BANCO = { id: 'va', label: 'original', isOriginal: true, thumbUrl: 'https://blob/A.jpg', titleText: '' }
const gravada = (label: string, titleText: string, thumbUrl: string | null = null) => ({ id: `v${label}`, label, isOriginal: false, thumbUrl, titleText })
const tipo = (re: RegExp) => screen.getByRole('radio', { name: re })

function montar(testType: 'title' | 'combo' | 'thumbnail', draftVariants: unknown[]) {
  return render(
    <AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={m.start}
      existingDraftId="d1" prefill={{ testType, draftVariants } as never} />,
  )
}

beforeEach(() => {
  cleanup()
  for (const f of Object.values(m)) f.mockClear()
  m.updateType.mockResolvedValue({ ok: true })
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) }, clear: () => store.clear(),
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('B: original vinda do banco', () => {
  it('mostra selo A e o título real do vídeo, nunca "Variante original" nem "Sem título"', () => {
    montar('title', [ORIGINAL_DO_BANCO, gravada('B', 'Fila de 3 h')])
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getAllByText('Meu vídeo').length).toBeGreaterThan(1) // cabeçalho + cartão da Original
    expect(document.body.textContent).not.toContain('Sem título')
    expect(document.body.textContent).not.toContain('Variante original')
    expect(screen.getAllByText('A').length).toBeGreaterThan(0)
  })
})

describe('I3: clicar no tipo já escolhido', () => {
  it('não chama updateAbTestType e mantém a variante gravada', () => {
    montar('title', [ORIGINAL_DO_BANCO, gravada('B', 'Fila de 3 h')])
    fireEvent.click(screen.getByRole('button', { name: /Tipo/ }))
    fireEvent.click(tipo(/Só o título muda/))
    expect(m.updateType).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Título da variante B') as HTMLInputElement).value).toBe('Fila de 3 h')
  })
})

describe('I2: troca de tipo que falha', () => {
  it('restaura o tipo e as variantes; "Tentar de novo" pede o tipo que o dono clicou', async () => {
    m.updateType.mockResolvedValue({ ok: false, error: 'boom' })
    montar('title', [ORIGINAL_DO_BANCO, gravada('B', 'Fila de 3 h')])
    fireEvent.click(screen.getByRole('button', { name: /Tipo/ }))
    fireEvent.click(tipo(/^Thumbnail/))
    await screen.findByRole('alert')
    expect(tipo(/Só o título muda/).getAttribute('aria-checked')).toBe('true')
    expect(tipo(/^Thumbnail/).getAttribute('aria-checked')).toBe('false')
    m.updateType.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(m.updateType).toHaveBeenCalledWith('d1', 'thumbnail'))
  })
})

describe('M2: imagem já gravada não sobe de novo', () => {
  it('depois de upload ok e início falho, "Tentar de novo" só chama iniciarTeste', async () => {
    const png = 'data:image/png;base64,AAEC'
    montar('thumbnail', [ORIGINAL_DO_BANCO, { ...gravada('B', '', null) }])
    // B sem imagem gravada: vira escolhida por data URL via estado salvo do assistente
    cleanup()
    localStorage.setItem('ab-wizard-draft-v2-vid-1', JSON.stringify({
      step: 'revisar', type: 'thumbnail', draftTestId: 'd1', savedAt: Date.now(),
      variants: [
        { label: 'A', isOriginal: true, thumbUrl: video.thumbnailUrl, titleText: 'Meu vídeo' },
        { label: 'B', isOriginal: false, thumbUrl: png, titleText: '' },
      ],
    }))
    m.start.mockResolvedValueOnce({ ok: false, error: 'x' }).mockResolvedValue({ ok: true })
    render(<AbCreateWizard video={video} siteId="s" settings={{} as never} onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={m.start} existingDraftId="d1" prefill={{ testType: 'thumbnail' } as never} />)
    fireEvent.click(screen.getByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(1))
    expect(m.upload).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(m.start).toHaveBeenCalledTimes(2))
    expect(m.upload).toHaveBeenCalledTimes(1)
  })
})

describe('C: painel de rascunhos em português e com passo real', () => {
  const linha = (variants: Array<{ is_original: boolean }>, created_at: string) => ({
    id: 'd1', name: 'Test: X', test_type: 'title', created_at, youtube_video_id: 'yt', source_pipeline_id: null, original_thumbnail_url: null,
    variants: variants.map((v, i) => ({ id: `v${i}`, label: v.is_original ? 'original' : 'B', is_original: v.is_original, blob_url: null, title_text: null })),
  }) as unknown as AbTestWithVariants

  it('sem desafiante gravado: passo 2; com desafiante: passo 3 (de 3)', () => {
    expect(passoDoRascunho([{ is_original: true }])).toBe(2)
    expect(passoDoRascunho([{ is_original: true }, { is_original: false }])).toBe(3)
    expect(toDraftList([linha([{ is_original: true }], new Date().toISOString())])[0]?.step).toBe(2)
  })

  it('tempo relativo em português, nunca "just now" nem "ago"', () => {
    const agora = toDraftList([linha([{ is_original: true }], new Date().toISOString())])[0]?.createdAgo ?? ''
    const duasHoras = toDraftList([linha([{ is_original: true }], new Date(Date.now() - 2 * 3_600_000).toISOString())])[0]?.createdAgo ?? ''
    expect(agora).toBe('agora')
    expect(duasHoras).toBe('há 2h')
  })
})

describe('D: duração 0 não é Short', () => {
  it('0 pede sincronização; 45 s é Short; 300 s com thumb passa', () => {
    expect(bloqueioDoVideo(0, 'https://hq')).toBe('sem_thumb_hq')
    expect(bloqueioDoVideo(45, 'https://hq')).toBe('short')
    expect(bloqueioDoVideo(300, 'https://hq')).toBeNull()
  })
})
