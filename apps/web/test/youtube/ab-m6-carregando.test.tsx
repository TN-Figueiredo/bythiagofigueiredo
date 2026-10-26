// @vitest-environment jsdom
// T7 (M6): carregamento da tela do teste com o cabeçalho conhecido e mensagem de espera.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const nav = vi.hoisted(() => ({ params: { testId: 't1' } as Record<string, string> }))
vi.mock('next/navigation', () => ({ useParams: () => nav.params }))
const m = vi.hoisted(() => ({ start: vi.fn(async (_id: string): Promise<Record<string, unknown>> => ({ ok: true })) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: vi.fn(), createTextVariant: vi.fn(), updateTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: vi.fn(async () => ({ ok: true })), fetchAbBriefingData: vi.fn(),
  fetchLibraryEntries: vi.fn(async () => []), lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { DetalheCarregando, DEMORA_DO_DETALHE_MS } from '@/app/cms/(authed)/youtube/ab-lab/_components/detalhe-carregando'
import { guardarTesteAbrindo, lerTesteAbrindo } from '@/app/cms/(authed)/youtube/ab-lab/_components/abrindo-teste'
import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'

function memoria() {
  const s = new Map<string, string>()
  return { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => { s.set(k, v) }, removeItem: (k: string) => { s.delete(k) }, clear: () => s.clear() }
}
const css = (f: string) => readFileSync(join(process.cwd(), 'src/app/cms/(authed)/youtube/ab-lab', f), 'utf8')

beforeEach(() => { cleanup(); nav.params = { testId: 't1' }; vi.stubGlobal('sessionStorage', memoria()); vi.stubGlobal('localStorage', memoria()) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('M6 T7: carregando', () => {
  it('com cabeçalho guardado: h2, miniatura, crumb e uma só mensagem fora de .sk', async () => {
    guardarTesteAbrindo({ id: 't1', titulo: 'Meu vídeo', miniaturaUrl: 'm.jpg' })
    const { container } = render(<DetalheCarregando />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Meu vídeo'))
    expect(container.querySelector('img[src="m.jpg"]')).toBeTruthy()
    expect(screen.getByText('Teste A/B')).toBeTruthy()
    const st = screen.getAllByRole('status')
    expect(st).toHaveLength(1)
    expect(st[0]!.textContent).toContain('Carregando o placar do teste')
    expect(st[0]!.closest('.sk')).toBeNull()
    expect(container.querySelectorAll('.skdias, .skrow, .skband, .sksum').length).toBe(0)
  })
  it('id diferente, JSON inválido ou sessionStorage que lança ⇒ frio, sem erro', () => {
    guardarTesteAbrindo({ id: 'outro', titulo: 'X', miniaturaUrl: null })
    const a = render(<DetalheCarregando />)
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(a.container.querySelectorAll('.sk').length).toBe(3)
    a.unmount()
    sessionStorage.setItem('ab-lab:abrindo', '{lixo')
    expect(lerTesteAbrindo('t1')).toBeNull()
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } })
    expect(lerTesteAbrindo('t1')).toBeNull()
    expect(() => guardarTesteAbrindo({ id: 't1', titulo: 'T', miniaturaUrl: null })).not.toThrow()
    render(<DetalheCarregando />)
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  })
  it('forma inválida (miniatura não texto, título vazio) ⇒ null', () => {
    sessionStorage.setItem('ab-lab:abrindo', JSON.stringify({ id: 't1', titulo: 'a', miniaturaUrl: 5 }))
    expect(lerTesteAbrindo('t1')).toBeNull()
    sessionStorage.setItem('ab-lab:abrindo', JSON.stringify({ id: 't1', titulo: ' ', miniaturaUrl: null }))
    expect(lerTesteAbrindo('t1')).toBeNull()
  })
  it('depois de 8 s: "Está demorando mais que o normal" e "Tentar de novo" recarrega', () => {
    vi.useFakeTimers()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<DetalheCarregando />)
    expect(screen.queryByText('Está demorando mais que o normal')).toBeNull()
    act(() => { vi.advanceTimersByTime(DEMORA_DO_DETALHE_MS) })
    expect(screen.getByText('Está demorando mais que o normal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(reload).toHaveBeenCalled()
  })
  it('CSS: esqueleto visível nos dois temas e placar-esqueleto sem hex nem color-mix', () => {
    const c = css('_components/caminho-nativo.css')
    for (const v of ['--cn-skel: #3B342C', '--cn-skel-2: #483F35', '--cn-skel: #D6CBB6', '--cn-skel-2: #CBBEA6']) expect(c).toContain(v)
    const p = css('_components/placar-esqueleto.css')
    expect(p).not.toMatch(/color-mix/)
    expect(p).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(p).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.sk[^}]*animation:\s*none/)
    expect(p).toContain('var(--cn-skel-2)')
  })
})

describe('M6 T7: o assistente deixa o cabeçalho antes de abrir', () => {
  it('ativar com sucesso grava id e título antes de onCreated', async () => {
    let gravadoAntes: string | null = null
    const onCreated = vi.fn(() => { gravadoAntes = sessionStorage.getItem('ab-lab:abrindo') })
    render(<AbCreateWizard video={{ id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: 'https://i.ytimg.com/a.jpg', sourcePipelineId: null }} siteId="s" settings={{} as never}
      onClose={vi.fn()} onCreated={onCreated} onAbrirExistente={vi.fn()} iniciarTeste={m.start} existingDraftId="d1"
      prefill={{ testType: 'title', draftVariants: [
        { id: 'va', label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' },
        { id: 'vb', label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Outro' }] }} />)
    fireEvent.click(await screen.findByRole('button', { name: /Ativar teste/ }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('d1'))
    expect(JSON.parse(gravadoAntes!)).toMatchObject({ id: 'd1', titulo: 'Meu vídeo' })
  })
})
