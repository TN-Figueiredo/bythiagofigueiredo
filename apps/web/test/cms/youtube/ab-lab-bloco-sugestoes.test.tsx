// @vitest-environment jsdom
/** F3 T7: o bloco "Sugestões" do A/B Lab. Nunca lança; erro vira o estado de erro do bloco; fallback do Suspense mostra "…" (nunca 0). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
const mundo = vi.hoisted(() => ({ leitura: null as unknown, lanca: false, args: [] as unknown[][], sentry: [] as unknown[][] }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, replace: vi.fn(), push: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: React.ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => { mundo.sentry.push(a) }, captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/actions', () => ({ dispensarSugestao: async () => ({ ok: true }), adiarSugestao: async () => ({ ok: true }), pedirTitulos: async () => ({ ok: true }), cancelarTitulos: async () => ({ ok: true }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela', () => ({
  abrirListaDaTela: async (...a: unknown[]) => { mundo.args.push(a); if (mundo.lanca) throw new Error('boom'); return mundo.leitura },
}))

import { BlocoSugestoes } from '@/app/cms/(authed)/youtube/ab-lab/_components/bloco-sugestoes'
import { EsqueletoDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/esqueleto'

const out = (v: string, m: number) => ({ video_id: v, canal_id: 'c', published_at: '2026-10-20T00:00:00Z', mult_vpd7: m, mult_tela: m, vpd7: 100, formato: 'long' as const })
function item(id: string): ItemDeSinal {
  return {
    id, kind: 'destino', subject_key: 'pais:vn', acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'titulo_descricao', forca: 1,
    motivo: 'm', rule_version: 'sinais-v1+semente-1', first_seen_at: '2026-10-18T10:00:00Z', expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), proprios_agora: ['p1', 'p2'], proprios_agora_n: 2,
    evidence: { outliers: [out('v-' + id, 8.4)], outliers_total: 1, canais: 2, proprios: [] },
  }
}
const lista = (itens: ItemDeSinal[], n = itens.length, o: Partial<ListaDeSinais> = {}): ListaDeSinais =>
  ({ n, itens, computado_em: new Date().toISOString(), desatualizado: false, motivoVazio: itens.length === 0 ? 'sem-grupo' : null, contagens: {}, calculoLigado: true, ...o })

beforeEach(() => { mundo.leitura = null; mundo.lanca = false; mundo.args = []; mundo.sentry = [] })
afterEach(cleanup)

describe('BlocoSugestoes', () => {
  it('abre a lista com limite 3', async () => {
    mundo.leitura = { estado: 'ok', lista: lista([item('a')]), amostra: new Map(), podeResponder: true }
    render(await BlocoSugestoes())
    expect(mundo.args[0]![1]).toBe(3)
  })
  it('estado erro: mensagem do bloco e "Tentar de novo", sem lançar', async () => {
    mundo.leitura = { estado: 'erro' }
    render(await BlocoSugestoes())
    expect(screen.getAllByText('Não deu para ler as sugestões.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
  it('a leitura lança: mesmo estado de erro e Sentry', async () => {
    mundo.lanca = true
    render(await BlocoSugestoes())
    expect(screen.getAllByText('Não deu para ler as sugestões.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(mundo.sentry.length).toBeGreaterThan(0)
  })
  it('sem acesso: nada no lugar do bloco', async () => {
    mundo.leitura = { estado: 'sem_acesso' }
    const el = await BlocoSugestoes()
    expect(el).toBeNull()
  })
  it('lista com 5 abertas: 3 linhas e "Ver todas (5)" apontando para a aba', async () => {
    mundo.leitura = { estado: 'ok', lista: lista([item('a'), item('b'), item('c')], 5), amostra: new Map(), podeResponder: true }
    const { container } = render(await BlocoSugestoes())
    expect(container.querySelectorAll('.sg-list > li')).toHaveLength(3)
    const ver = screen.getByText('Ver todas (5)').closest('a')!
    expect(ver.getAttribute('href')).toBe('/cms/youtube/competitors/sugestoes')
    expect(container.querySelector('h2')?.textContent).toContain('Sugestões')
    expect(container.querySelector('h1')).toBeNull()
  })
  it('bloco vazio: uma linha com "Ver detalhes"', async () => {
    mundo.leitura = { estado: 'ok', lista: lista([]), amostra: new Map(), podeResponder: true }
    render(await BlocoSugestoes())
    expect(screen.getByText(/Ver detalhes/)).toBeTruthy()
  })
})

describe('fallback do Suspense', () => {
  it('cabeçalho "Sugestões" com "…" no lugar do N, nunca 0, título em h2', () => {
    const { container } = render(<EsqueletoDaLista linhas={3} modo="bloco" />)
    expect(container.querySelector('h2')?.textContent).toMatch(/Sugestões\s*…/)
    expect(container.querySelector('h1')).toBeNull()
    expect(container.textContent).not.toMatch(/\b0\b/)
    expect(container.querySelector('[data-modo="bloco"]')).not.toBeNull()
  })
  it('a página do Lab envolve o bloco em Suspense com esse esqueleto e não toca getSuggestedVideos', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/ab-lab/page.tsx'), 'utf8')
    expect(src).toMatch(/<Suspense fallback=\{<EsqueletoDaLista linhas=\{3\} modo="bloco" \/>\}>/)
    expect(src).toContain('<BlocoSugestoes />')
    expect(src).toContain('blocoSugestoes=')
  })
})
