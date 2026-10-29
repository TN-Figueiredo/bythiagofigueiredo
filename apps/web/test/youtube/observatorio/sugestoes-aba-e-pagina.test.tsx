// @vitest-environment jsdom
/** F3 T6: o contador da aba Sugestões (⚠ visível, aria-label, 44 px só nela) e a página (erro de leitura nunca lança; sem acesso; faixa do sino). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))
import { Tabs } from '@/app/cms/(authed)/youtube/competitors/_chrome/tabs'

const tab = (o: Record<string, unknown>) => ({ key: 'sugestoes' as const, label: 'Sugestões', href: '/x', count: 3, title: 't', current: false, ...o })

describe('Tabs: contador de Sugestões', () => {
  it('velho: ⚠ (svg aria-hidden) dentro do contador e aria-label com a contagem; 12 px e 44 px só nela', () => {
    render(<Tabs tabs={[tab({ velho: true, ariaLabel: '3 sugestões, dados velhos' }), { key: 'canais', label: 'Canais', href: '/c', count: 14, title: 'c', current: false }]} />)
    const ct = screen.getByLabelText('3 sugestões, dados velhos')
    expect(ct.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(ct.textContent).toBe('3')
    expect((ct as HTMLElement).style.fontSize).toBe('12px')
    expect((ct.closest('a') as HTMLElement).style.minHeight).toBe('44px')
    const outro = document.querySelector('[data-count="canais"]') as HTMLElement
    expect(outro.style.fontSize).toBe('')
    expect((outro.closest('a') as HTMLElement).style.minHeight).toBe('')
  })
  it('sem velho: nenhum ícone nem aria-label; "—" aparece como texto', () => {
    render(<Tabs tabs={[tab({ countText: '—', count: null })]} />)
    const ct = document.querySelector('[data-count="sugestoes"]')!
    expect(ct.textContent).toBe('—')
    expect(ct.querySelector('svg')).toBeNull()
    expect(ct.getAttribute('aria-label')).toBeNull()
  })
})

interface Ctx { leitura: unknown; aviso: boolean }
async function pagina(c: Ctx, sp: Record<string, string> = {}) {
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's' }) }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
  vi.doMock('@/lib/youtube/observatorio/now', () => ({ observatoryNow: () => Date.parse('2026-10-23T12:00:00Z') }))
  vi.doMock('@/app/cms/(authed)/youtube/competitors/_chrome/chrome-server', () => ({ ObservatoryChromeServer: () => null }))
  vi.doMock('@/app/cms/(authed)/youtube/competitors/contexto-ia-actions', () => ({ gerarPacoteIa: async () => null }))
  vi.doMock('@/app/cms/(authed)/youtube/competitors/_sugestoes/actions', () => ({ dispensarSugestao: async () => ({ ok: true }), adiarSugestao: async () => ({ ok: true }), pedirTitulos: async () => ({ ok: true }), cancelarTitulos: async () => ({ ok: true }) }))
  vi.doMock('@/app/cms/(authed)/youtube/competitors/_sugestoes/aviso', () => ({ saiuDoAviso: async () => c.aviso }))
  vi.doMock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela', () => ({ abrirListaDaTela: async () => c.leitura }))
  vi.doMock('@/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes-lista', () => ({ SugestoesLista: () => null }))
  const mod = await import('@/app/cms/(authed)/youtube/competitors/sugestoes/page')
  return (await mod.default({ searchParams: Promise.resolve(sp) })) as ReactElement<{ tab: string; children: ReactElement<Record<string, unknown>> }>
}
const listaVazia = { n: 0, itens: [], computado_em: '2026-10-23T08:00:00Z', desatualizado: false, motivoVazio: 'sem-grupo', contagens: {}, calculoLigado: true }

describe('página Sugestões', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it('leitura com erro: não lança e a lista recebe vista.n = null, sem ações', async () => {
    const el = await pagina({ leitura: { estado: 'erro' }, aviso: false })
    expect(el.props.tab).toBe('sugestoes')
    const filho = el.props.children
    expect(isValidElement(filho)).toBe(true)
    expect((filho.props.vista as { n: unknown }).n).toBeNull()
    expect(filho.props.acoes).toBeNull()
  })
  it('sem acesso: mensagem, sem lista', async () => {
    const el = await pagina({ leitura: { estado: 'sem_acesso' }, aviso: false })
    expect(JSON.stringify(el.props.children)).toContain('Você não tem acesso')
  })
  it('editor sem admin: lista sem ações; admin: com ação por prop', async () => {
    const a = await pagina({ leitura: { estado: 'ok', lista: listaVazia, amostra: new Map(), podeResponder: false }, aviso: false })
    expect(a.props.children.props.acoes).toBeNull()
    const b = await pagina({ leitura: { estado: 'ok', lista: listaVazia, amostra: new Map(), podeResponder: true }, aviso: false })
    expect(b.props.children.props.acoes).toMatchObject({ dispensar: expect.any(Function) })
    expect(b.props.children.props.modo).toBe('pagina')
  })
  it('faixa do sino só com de=sino e aviso do próprio usuário', async () => {
    const lista = { ...listaVazia, n: 1, motivoVazio: null, itens: [] }
    const ok = { estado: 'ok', lista, amostra: new Map(), podeResponder: true }
    const sem = await pagina({ leitura: ok, aviso: true }, {})
    expect((sem.props.children.props.vista as { faixa: unknown }).faixa).toBeNull()
    const com = await pagina({ leitura: ok, aviso: true }, { de: 'sino', aviso: 'nicho:abc' })
    expect((com.props.children.props.vista as { faixa: { tipo: string } | null }).faixa?.tipo).toBe('sino-saiu')
  })
})
