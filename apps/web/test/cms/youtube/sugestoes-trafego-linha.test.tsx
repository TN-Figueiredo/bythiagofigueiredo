// @vitest-environment jsdom
// F4 T4: a linha de tráfego na tela (lista e bloco do A/B Lab). nao_medido leva o selo e nunca "0" nem "não"; nao_se_aplica não renderiza.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: React.ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/actions', () => ({ dispensarSugestao: async () => ({ ok: true }), adiarSugestao: async () => ({ ok: true }) }))
const mundo = vi.hoisted(() => ({ leitura: null as unknown }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela', () => ({ abrirListaDaTela: async () => mundo.leitura }))

import { BlocoSugestoes } from '@/app/cms/(authed)/youtube/ab-lab/_components/bloco-sugestoes'
import { SugestoesLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes-lista'
import { montarVistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import type { TrafegoDoTerceiro } from '@/lib/youtube/observatorio/sinais/trafego-terceiro/regra'

afterEach(cleanup)

const base: TrafegoDoTerceiro = {
  estado: 'nao', motivo: null, terceiro_video_id: 't', videos_com_trafego: 0, videos_medidos: 36, videos_total: 36, views: null, ate: '2026-10-27',
  desde: '2026-10-25', coberto_ate: '2026-10-27', regra: 'f4-trafego-v1',
}
const t = (o: Partial<TrafegoDoTerceiro>): TrafegoDoTerceiro => ({ ...base, ...o })
function item(id: string, tr: TrafegoDoTerceiro): ItemDeSinal {
  const o = { video_id: 'v-' + id, canal_id: 'c', published_at: '2026-10-20T00:00:00Z', mult_vpd7: 8, mult_tela: 8, vpd7: 100, formato: 'long' as const }
  return {
    id, kind: 'destino', subject_key: 'pais:vn', acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'titulo_descricao', forca: 1,
    motivo: 'm', rule_version: 'x', first_seen_at: '2026-10-18T10:00:00Z', expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), proprios_agora: ['p1'], proprios_agora_n: 1,
    evidence: { outliers: [o], outliers_total: 1, canais: 1, proprios: [] }, adiada_em: null, trafego_do_terceiro: tr,
  } as ItemDeSinal
}
const lista = (itens: ItemDeSinal[]): ListaDeSinais =>
  ({ n: itens.length, itens, computado_em: new Date().toISOString(), desatualizado: false, motivoVazio: null, contagens: {}, calculoLigado: true })
const vista = (itens: ItemDeSinal[]) => montarVistaDaLista({ lista: lista(itens), amostra: new Map(), agora: new Date(), filtro: 'todas', saiuDoAviso: false, limite: 100 })

describe('linha de tráfego na lista', () => {
  it('um cartão por estado com o texto do mockup', () => {
    const itens = [
      item('sim', t({ estado: 'sim', videos_com_trafego: 2, views: 1234 })),
      item('nao', t({})),
      item('nm', t({ estado: 'nao_medido', motivo: 'origem_nao_informada', ate: null })),
      item('erro', t({ estado: 'nao_medido', motivo: 'erro_de_leitura', ate: null })),
      item('na', t({ estado: 'nao_se_aplica' })),
    ]
    const { container } = render(<SugestoesLista modo="pagina" vista={vista(itens)} acoes={null} verTodasHref="/x" />)
    const linhas = [...container.querySelectorAll('[data-trf]')]
    expect(linhas.map((e) => e.getAttribute('data-trf'))).toEqual(['sim', 'nao', 'nm', 'erro'])
    expect(container.querySelector('[data-trf="sim"]')!.textContent).toContain('Já te manda visitas: 1.234 em 2 de 36 vídeos seus, até 27/10.')
    expect(container.querySelector('[data-trf="sim"] b.l')!.textContent).toBe('Já te manda visitas')
    expect(container.querySelector('[data-trf="nao"]')!.textContent).toContain('Não te manda visitas: nenhum dos seus 36 vídeos recebeu visita dele, até 27/10.')
    const nm = container.querySelector('[data-trf="nm"]')!
    expect(nm.querySelector('.sg-nm')!.textContent).toBe('não medido')
    expect(nm.textContent).not.toMatch(/Não te manda|\b0\b/)
    expect(container.querySelector('[data-trf="erro"] .t-short')!.textContent).toBe('Não deu para ler este dado.')
    expect(container.querySelector('[data-row="na"] [data-trf]')).toBeNull()
  })

  it('nenhuma frase da linha diz "0 visitas"', () => {
    const itens = [item('a', t({ estado: 'sim', videos_com_trafego: 1, views: 0 })), item('b', t({ estado: 'nao_medido', motivo: 'sem_cobertura' }))]
    const { container } = render(<SugestoesLista modo="pagina" vista={vista(itens)} acoes={null} verTodasHref="/x" />)
    for (const e of container.querySelectorAll('[data-trf]')) expect(e.textContent).not.toMatch(/\b0 visitas|: 0\b/)
  })

  it('o i da linha abre o painel com "Visitas vindas dele" e a regra', () => {
    const { container } = render(<SugestoesLista modo="pagina" vista={vista([item('a', t({}))])} acoes={null} verTodasHref="/x" />)
    fireEvent.click(container.querySelector('[data-trf="a"] button')!)
    expect(screen.getByText('Visitas vindas dele')).toBeTruthy()
    expect(container.querySelector('.sg-info')!.textContent).toContain('f4-trafego-v1')
  })
})

describe('bloco do A/B Lab mostra a mesma linha', () => {
  it('mesmo texto', async () => {
    mundo.leitura = { estado: 'ok', lista: lista([item('a', t({}))]), amostra: new Map(), podeResponder: false }
    const { container } = render(await BlocoSugestoes())
    expect(container.querySelector('[data-trf="a"]')!.textContent).toContain('Não te manda visitas: nenhum dos seus 36 vídeos recebeu visita dele, até 27/10.')
  })
})

describe('CSS', () => {
  it('sem color-mix e com a regra do 390 fechado (variante A)', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes.css'), 'utf8')
    expect(css).not.toMatch(/color-mix/)
    expect(css).toMatch(/\.sg-row:not\(\.sg-open\) \.sg-trf:not\(\.t-sim\):not\(\.t-erro\)\{display:none\}/)
  })
})

describe('frase-resumo, barra e faixa geral na lista', () => {
  it('frase sempre visível com barra marcada por estado; aria-hidden na barra', () => {
    const itens = [item('a', t({ estado: 'sim', videos_com_trafego: 1, views: 10 })), item('b', t({})), item('c', t({}))]
    const { container } = render(<SugestoesLista modo="pagina" vista={vista(itens)} acoes={null} verTodasHref="/x" />)
    expect(container.querySelector('.sg-trfsum p')!.textContent).toBe('Visitas vindas dos concorrentes: 1 de 3 já te manda visitas; 2 não mandam (dado até 27/10).')
    const bar = container.querySelector('.sg-bar')!
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect([...bar.children].map((c) => c.className)).toEqual(['b-s', 'b-n'])
  })
  it('motivo geral vira faixa única; frase não aparece', () => {
    const itens = [item('a', t({ estado: 'nao_medido', motivo: 'cobertura_velha', ate: null })), item('b', t({ estado: 'nao_medido', motivo: 'cobertura_velha', ate: null }))]
    const { container } = render(<SugestoesLista modo="pagina" vista={vista(itens)} acoes={null} verTodasHref="/x" />)
    expect(container.querySelector('.sg-trfsum')).toBeNull()
    expect(container.querySelector('.sg-trfgeral')!.textContent).toContain('A coleta da origem das visitas parou em 27/10.')
  })
  it('bloco do A/B Lab: sem nenhum "sim", sem frase (só a faixa geral, se houver)', () => {
    const { container } = render(<SugestoesLista modo="bloco" vista={vista([item('a', t({})), item('b', t({}))])} acoes={null} verTodasHref="/x" />)
    expect(container.querySelector('.sg-trfsum')).toBeNull()
    const c2 = render(<SugestoesLista modo="bloco" vista={vista([item('a', t({ estado: 'sim', videos_com_trafego: 1, views: 5 }))])} acoes={null} verTodasHref="/x" />).container
    expect(c2.querySelector('.sg-trfsum')).not.toBeNull()
  })
  it('sem cartão com linha: nada', () => {
    const { container } = render(<SugestoesLista modo="pagina" vista={vista([item('a', t({ estado: 'nao_se_aplica' }))])} acoes={null} verTodasHref="/x" />)
    expect(container.querySelector('.sg-trfsum, .sg-trfgeral')).toBeNull()
  })
})
