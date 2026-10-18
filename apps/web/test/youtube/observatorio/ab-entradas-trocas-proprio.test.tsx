// @vitest-environment jsdom
// T7: o Antes e depois do vídeo próprio ganha "Testar no A/B Lab" por troca (modelo real de `buildTrocas`, fixture sintética).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { Trocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas'
import { buildTrocas, type TrocasView } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'
import { entradaDoProprio, entradaDaTroca, CHIPS_COM_MEDIDA, DICA_TROCA_PROPRIA, FRASE_SEM_MEDIDA, type EntradaProprio } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/modelo'
import type { TestesAbertos } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/testes-abertos'
import { alcance, base, comAlcance, entrada, HOJE, teste, versao } from './proprio-trocas-fixture'

vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
afterEach(cleanup)

const UUID = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a77'
const TESTAR = entradaDoProprio({ podeEditar: true, videoUuid: UUID, dur: 600, abertos: null, semDado: null })
const medida = (extra: Parameters<typeof comAlcance>[4] = {}, over: Parameters<typeof versao>[0] = { dia: '2026-11-03' }) =>
  buildTrocas(entrada(comAlcance([base(), versao(over)], alcance(addDays(HOJE, -40), HOJE), undefined, extra)))
const tela = (v: TrocasView, ab: EntradaProprio | null) => render(<Trocas view={v} ab={ab} videoUuid={UUID} />)
const botoes = (c: HTMLElement) => [...c.querySelectorAll<HTMLAnchorElement>('li.tr-troca a[href*="/ab-lab/new"]')]

describe('entradaDaTroca (modelo)', () => {
  it('chips com medida → testar com o tipo da troca; thumb vira "thumbnail"', () => {
    for (const chip of CHIPS_COM_MEDIDA) {
      expect(entradaDaTroca({ campo: 'title', chip, veioDeTeste: false }, TESTAR, UUID)).toEqual({ tipo: 'testar', href: `/cms/youtube/ab-lab/new?videoId=${UUID}&changeType=title` })
    }
    expect(entradaDaTroca({ campo: 'thumb', chip: 'subiu', veioDeTeste: false }, TESTAR, UUID)).toEqual({ tipo: 'testar', href: `/cms/youtube/ab-lab/new?videoId=${UUID}&changeType=thumbnail` })
  })
  it('depois-nao-medido e ainda-nao-da → sem-medida; demais chips → null', () => {
    for (const chip of ['depois-nao-medido', 'ainda-nao-da'] as const) {
      expect(entradaDaTroca({ campo: 'title', chip, veioDeTeste: false }, TESTAR, UUID)).toEqual({ tipo: 'sem-medida', frase: FRASE_SEM_MEDIDA })
    }
    for (const chip of ['antes-nao-medido', 'sem-antes', 'sem-dias', 'origem-nao-sabida', 'leitura-falhou'] as const) {
      expect(entradaDaTroca({ campo: 'title', chip, veioDeTeste: false }, TESTAR, UUID)).toBeNull()
    }
  })
  it('veio de teste, ab nulo, sem-dado e ver → null', () => {
    const t = { campo: 'title' as const, chip: 'subiu' as const, veioDeTeste: false }
    expect(entradaDaTroca({ ...t, veioDeTeste: true }, TESTAR, UUID)).toBeNull()
    expect(entradaDaTroca(t, null, UUID)).toBeNull()
    expect(entradaDaTroca(t, { tipo: 'sem-dado', frase: 'x' }, UUID)).toBeNull()
    expect(entradaDaTroca(t, { tipo: 'ver', href: '/h', rotulo: 'Ver teste', frase: 'f', curto: 'c' }, UUID)).toBeNull()
  })
})

describe('Antes e depois do próprio: tela', () => {
  it('troca manual medida: botão "Testar no A/B Lab" com a dica nova', () => {
    const v = medida()
    const { container } = tela(v, TESTAR)
    const [a] = botoes(container)
    expect(a.textContent).toBe('Testar no A/B Lab')
    expect(a.getAttribute('href')).toBe(`/cms/youtube/ab-lab/new?videoId=${UUID}&changeType=title`)
    expect(a.hasAttribute('target')).toBe(false)
    expect(container.querySelector('.tr-ab-dica')!.textContent).toBe(DICA_TROCA_PROPRIA)
    expect(container.textContent).not.toMatch(/variante B começa vazia|ponto de partida/)
  })
  it('troca vinda de teste (abTestId): nenhum botão novo; o "Abrir o teste A/B" fica', () => {
    const v = medida({ testes: { acesso: 'ok', dado: { testes: [teste()], descartados: 0 } } }, { dia: '2026-11-03', origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't1' })
    const { container } = tela(v, TESTAR)
    expect(botoes(container)).toHaveLength(0)
    expect(container.querySelector('li.tr-troca a.tr-link')!.textContent).toBe('Abrir o teste A/B')
  })
  it('troca com abTestId e a leitura do A/B em erro: o link some mas o botão novo também (veioDeTeste vem do dado)', () => {
    const v = medida({ testes: { acesso: 'erro' }, motivoTestes: 'banco' }, { dia: '2026-11-03', origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't1' })
    expect(v.itens.find(i => i.tipo === 'troca')!.v).toMatchObject({ veioDeTeste: true })
    expect(botoes(tela(v, TESTAR).container)).toHaveLength(0)
  })
  it('troca com abTestId, leitura ok e a lista sem esse id: veioDeTeste continua true, sem botão', () => {
    const v = medida({ testes: { acesso: 'ok', dado: { testes: [teste({ id: 'outro' })], descartados: 0 } } }, { dia: '2026-11-03', origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't1' })
    const t = v.itens.find(i => i.tipo === 'troca')!.v as { veioDeTeste: boolean }
    expect(t.veioDeTeste).toBe(true)
    expect(botoes(tela(v, TESTAR).container)).toHaveLength(0)
  })
  it('troca manual não vinda de teste: veioDeTeste falso', () => {
    expect((medida().itens.find(i => i.tipo === 'troca')!.v as { veioDeTeste: boolean }).veioDeTeste).toBe(false)
  })
  it('depois não medido: a frase, sem botão', () => {
    const v = buildTrocas(entrada(comAlcance([base(), versao({ dia: addDays(HOJE, -1) })], alcance(addDays(HOJE, -40), addDays(HOJE, -3)))))
    const { container } = tela(v, TESTAR)
    const chip = (v.itens.find(i => i.tipo === 'troca')!.v as { chip: string }).chip
    if (chip === 'depois-nao-medido' || chip === 'ainda-nao-da') {
      expect(container.textContent).toContain(FRASE_SEM_MEDIDA)
      expect(botoes(container)).toHaveLength(0)
    } else throw new Error('fixture não produziu chip sem medida depois: ' + chip)
  })
  it('vídeo em teste: um aviso único no topo, nenhum botão por troca', () => {
    const ver = entradaDoProprio({
      podeEditar: true, videoUuid: UUID, dur: 600, semDado: null,
      abertos: { acesso: 'ok', porVideo: { [UUID]: { href: '/cms/youtube/ab-lab/t9', rotulo: 'Ver teste', frase: 'Teste de thumbnail em andamento desde 10/10.', curto: 'em andamento' } } } as unknown as TestesAbertos,
    })
    const { container } = tela(medida(), ver)
    const aviso = container.querySelector('.tr-ab-aviso')!
    expect(aviso.textContent).toContain('Este vídeo já tem um teste aberto no A/B Lab. Teste de thumbnail em andamento desde 10/10.')
    expect(aviso.querySelectorAll('a')).toHaveLength(1)
    expect(botoes(container)).toHaveLength(0)
  })
  it('reporter, restrito/falhou, Short e sem prop: nada de A/B', () => {
    const v = medida()
    const semDado = entradaDoProprio({ podeEditar: true, videoUuid: UUID, dur: 600, abertos: null, semDado: 'restrito' })
    const short = entradaDoProprio({ podeEditar: true, videoUuid: UUID, dur: 45, abertos: null, semDado: null })
    for (const ab of [null, semDado, short]) {
      const { container, unmount } = tela(v, ab)
      expect(botoes(container)).toHaveLength(0)
      expect(container.querySelector('.tr-ab-aviso, .tr-ab')).toBeNull()
      unmount()
    }
    expect(botoes(render(<Trocas view={v} />).container)).toHaveLength(0)
  })
})
