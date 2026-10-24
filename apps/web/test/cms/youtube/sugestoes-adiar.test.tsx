// @vitest-environment jsdom
/**
 * F3b "Adiar 7 dias": view-model (vazio adiado, linha de contagem, selo, vence em 7 dias), reducer, a lista e o CSS do delta do mockup
 * (docs/superpowers/mockups/2026-10-24-f3b-adiar). Hoje, nos testes, é sex 23/10/2026 15:00 BRT.
 */
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: vi.fn() }) }))

import { SugestoesLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes-lista'
import { estadoInicial, reduzirLista, vistaVisivel } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/estado-da-lista'
import { diaSP, linhaDasAdiadas, montarVistaDaLista, type LinhaDaVista, type VistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import type { AcoesDaLista, RespostaDaAcao } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/tipos'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { textoDoVazio } from '@/lib/youtube/observatorio/sinais/frases'

const AGORA = new Date('2026-10-23T15:00:00-03:00')
const DIA = 86_400_000
const em = (dias: number): string => new Date(AGORA.getTime() + dias * DIA).toISOString()
const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_sugestoes')

function item(id: string, o: Partial<ItemDeSinal> = {}): ItemDeSinal {
  return {
    id, kind: 'destino', subject_key: 'pais:vn', acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'titulo_descricao', forca: 1,
    motivo: 'm', rule_version: 'sinais-v1+semente-1', first_seen_at: em(-5), expires_at: em(20), adiada_em: null,
    proprios_agora: ['p1', 'p2'], proprios_agora_n: 2,
    evidence: { outliers: [{ video_id: 'v-' + id, canal_id: 'c', published_at: em(-3), mult_vpd7: 8.4, mult_tela: 8.4, vpd7: 100, formato: 'long' }], outliers_total: 1, canais: 2, proprios: [] },
    ...o,
  }
}
function lista(itens: ItemDeSinal[], o: Partial<ListaDeSinais> = {}): ListaDeSinais {
  return { n: itens.length, itens, computado_em: em(-0.3), desatualizado: false, motivoVazio: null, motivoDoCalculo: null, proximaVolta: null, contagens: { adiados: 0 }, calculoLigado: true, ...o }
}
const montar = (l: ListaDeSinais) => montarVistaDaLista({ lista: l, amostra: new Map(), agora: AGORA, filtro: 'todas', saiuDoAviso: false, limite: 100 })

describe('view-model: adiadas', () => {
  it('diaSP: dia da semana curto, sem ponto, no fuso de São Paulo', () => {
    expect(diaSP('2026-10-27T12:00:00Z')).toBe('ter, 27/10')
    expect(diaSP('2026-10-30T02:00:00Z')).toBe('qui, 29/10') // 23h de Brasília do dia anterior
  })
  it('linhaDasAdiadas: uma, várias, nenhuma, não medido, sem data', () => {
    expect(linhaDasAdiadas({ n: 1, proxima: '2026-10-30T15:00:00Z' })).toBe('1 adiada por você. Volta em sex, 30/10.')
    expect(linhaDasAdiadas({ n: 2, proxima: '2026-10-27T15:00:00Z' })).toBe('2 adiadas por você. A próxima volta em ter, 27/10.')
    expect(linhaDasAdiadas({ n: 0, proxima: null })).toBeNull()
    expect(linhaDasAdiadas(null)).toBeNull()
    expect(linhaDasAdiadas({ n: 2, proxima: null })).toBe('2 adiadas por você.')
  })
  it('a vista leva as adiadas da leitura; "não medido" é null, nunca 0', () => {
    expect(montar(lista([item('a')], { contagens: { adiados: 2 }, proximaVolta: em(4) })).adiadas).toEqual({ n: 2, proxima: em(4) })
    expect(montar(lista([item('a')], { contagens: {} })).adiadas).toBeNull()
  })
  it('vazio adiado: título com N, data da próxima e a frase do motivo do cálculo na 2ª linha (P-C2)', () => {
    const v = montar(lista([], { n: 0, motivoVazio: 'adiado', motivoDoCalculo: 'sem-terceiro-outlier', contagens: { adiados: 2, canais_total: 5 }, proximaVolta: '2026-10-27T15:00:00Z' }))
    expect(v.vazio).toMatchObject({
      familia: 'adiado', topo: 'Nenhuma sugestão aberta.', titulo: 'Você adiou 2 sugestões.', texto: 'A próxima volta em ter, 27/10.',
      texto2: textoDoVazio('sem-terceiro-outlier', { canais_total: 5 }, AGORA, true),
    })
    const um = montar(lista([], { n: 0, motivoVazio: 'adiado', contagens: { adiados: 1 }, proximaVolta: '2026-10-30T15:00:00Z' }))
    expect(um.vazio).toMatchObject({ titulo: 'Você adiou 1 sugestão.', texto: 'Ela volta em sex, 30/10.' })
  })
  it('vazio adiado com contagem não medida: "Adiadas por você: não medido", sem "0 adiadas", sem "Você adiou" e sem data', () => {
    const v = montar(lista([], { n: 0, motivoVazio: 'adiado', motivoDoCalculo: 'sem-lugar', contagens: { outliers_total: 3 } }))
    expect(v.vazio).toMatchObject({ familia: 'adiado', titulo: 'Adiadas por você:', chipNm: true, texto: 'Não deu para contar quantas voltam nem quando.' })
    const tudo = JSON.stringify(v.vazio)
    expect(tudo).not.toMatch(/Você adiou|0 adiadas|volta em/)
  })
  it('textoDoVazio("adiado"): com número e sem número (não medido)', () => {
    expect(textoDoVazio('adiado', { adiados: 2 }, AGORA, true)).toMatch(/Você adiou 2 sugestões/)
    expect(textoDoVazio('adiado', {}, AGORA, true)).toMatch(/não medido/)
  })
  it('selo "Adiada por você em dd/mm" só na linha que voltou', () => {
    const v = montar(lista([item('a', { adiada_em: '2026-10-20T15:00:00Z' }), item('b')]))
    expect(v.linhas.map((l) => l.adiadaEm)).toEqual(['20/10', null])
  })
  it('naoAdia: vence em até 7 dias (inclusive o limite), com dia e data; mais de 7 dias, null', () => {
    const v = montar(lista([item('a', { expires_at: em(5) }), item('b', { expires_at: em(7) }), item('c', { expires_at: em(7.01) })]))
    expect(v.linhas[0]!.naoAdia).toEqual({ dia: 'qua, 28/10', data: '28/10' })
    expect(v.linhas[1]!.naoAdia).not.toBeNull()
    expect(v.linhas[2]!.naoAdia).toBeNull()
  })
})

describe('reduzirLista: adiar', () => {
  const adiou: RespostaDaAcao = { ok: true, adiado_ate: '2026-10-30T18:00:00Z' }
  it('sucesso: desfecho adiada com a data; a dispensa continua separada', () => {
    let e = reduzirLista(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'adiar' })
    expect(e.pendente).toEqual({ id: 'a', motivo: 'adiar' })
    e = reduzirLista(e, { tipo: 'resposta', id: 'a', motivo: 'adiar', resposta: adiou })
    expect(e.respondidas.get('a')).toBe('adiada')
    expect(e.voltaDe.get('a')).toBe('2026-10-30T18:00:00Z')
    expect(e.motivoDe.has('a')).toBe(false)
    expect(e.pendente).toBeNull()
  })
  it('ja_adiado vale como sucesso com a data, até depois do estouro de 15 s (sem pendente)', () => {
    const e = reduzirLista(estadoInicial(), { tipo: 'resposta', id: 'a', motivo: 'adiar', resposta: { ok: false, motivo: 'ja_adiado', adiado_ate: '2026-10-29T10:00:00Z' } })
    expect(e.respondidas.get('a')).toBe('adiada')
    expect(e.voltaDe.get('a')).toBe('2026-10-29T10:00:00Z')
  })
  it('expira_antes: erro vence-antes com o vencimento, a linha fica', () => {
    let e = reduzirLista(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'adiar' })
    e = reduzirLista(e, { tipo: 'resposta', id: 'a', motivo: 'adiar', resposta: { ok: false, motivo: 'expira_antes', expira_em: '2026-10-28T10:00:00Z' } })
    expect(e.erros.get('a')).toEqual({ tipo: 'vence-antes', motivo: 'adiar', expiraEm: '2026-10-28T10:00:00Z' })
    expect(e.respondidas.has('a')).toBe(false)
  })
  it('nao_aberto depois de adiar com sucesso não vira "já saiu" por cima da faixa Adiada', () => {
    let e = reduzirLista(estadoInicial(), { tipo: 'resposta', id: 'a', motivo: 'adiar', resposta: adiou })
    e = reduzirLista(e, { tipo: 'iniciar', id: 'a', motivo: 'adiar' })
    e = reduzirLista(e, { tipo: 'resposta', id: 'a', motivo: 'adiar', resposta: { ok: false, motivo: 'nao_aberto' } })
    expect(e.respondidas.get('a')).toBe('adiada')
  })
  it('falhou/falha: "Não salvou" com o motivo adiar (para o retry)', () => {
    let e = reduzirLista(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'adiar' })
    e = reduzirLista(e, { tipo: 'falha', id: 'a', motivo: 'adiar' })
    expect(e.erros.get('a')).toEqual({ tipo: 'sem-conexao', motivo: 'adiar' })
  })
})

function linha(id: string, o: Partial<LinhaDaVista> = {}): LinhaDaVista {
  return {
    id, kind: 'destino', chip: { rotulo: 'Destino esquentou', simbolo: 'alfinete' }, lugar: 'L' + id, titulo: `Um vídeo sobre ${id} passou de 5× o normal do canal`,
    puxadoPor: null, regua: { valor: 8.4, acimaDe20: false, limiar: 5, texto: '8,4× o normal do canal' },
    seus: { texto: 'Seus vídeos sobre X: 2.', naoMedido: false }, primario: { texto: 'Abrir seus 2 vídeos sobre X', href: '/cms/youtube/videos', cheio: false }, venceEm: null,
    info: { mults: '8,4×', medida: 'views por dia', regra: 'regra sinais-v1', surgiu: '18/10', vence: '17/11' },
    motivos: [{ valor: 'lugar_errado', rotulo: 'Lugar errado', grupo: 'motivo' }, { valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' }, { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' }],
    adiadaEm: null, naoAdia: null, ...o,
  }
}
function vista(ls: LinhaDaVista[], o: Partial<VistaDaLista> = {}): VistaDaLista {
  const com = ls.map((l, i) => ({ ...l, primario: { ...l.primario, cheio: i === 0 } }))
  return { n: com.length, calculado: 'Calculado hoje às 07:02', velho: false, resumo: `${com.length} sugestões: ${com.length} destinos.`, faixa: null, filtro: null, linhas: com, completas: com, totalAlemDoLimite: null, vazio: null, adiadas: { n: 0, proxima: null }, ...o }
}
type A = AcoesDaLista & { dispensar: ReturnType<typeof vi.fn>; adiar: ReturnType<typeof vi.fn> }
function acoes(adiar: () => Promise<RespostaDaAcao> = async () => ({ ok: true, adiado_ate: '2026-10-30T18:00:00Z' })): A {
  return { dispensar: vi.fn(async () => ({ ok: true }) as RespostaDaAcao), adiar: vi.fn(adiar) } as A
}

beforeEach(() => { nav.replace.mockClear(); nav.refresh.mockClear() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

async function abrir(id: string): Promise<HTMLElement> {
  const li = document.querySelector(`[data-row="${id}"]`) as HTMLElement
  fireEvent.click(within(li).getAllByRole('button', { name: /dispensar ou adiar/i })[0]!)
  return li
}
const cnt = () => document.querySelector('.sg-cnt')!.textContent

describe('SugestoesLista: Adiar 7 dias', () => {
  it('o painel tem 3 grupos na ordem: motivos | Já fiz ‖ Adiar 7 dias, Cancelar; Tab: motivos, Já fiz, Adiar, Cancelar', async () => {
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={acoes()} modo="pagina" />)
    const li = await abrir('b')
    const grupo = within(li).getByRole('group', { name: /dispensar ou adiar/i })
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lugar errado', 'Não me interessa', 'Já fiz', 'Adiar 7 dias', 'Cancelar'])
    expect(grupo.querySelectorAll('.sg-sep')).toHaveLength(2)
    expect(grupo.querySelector('.sg-sep2')).not.toBeNull()
  })
  it('um clique grava sem confirmação: "Adiando…", painel parado, depois a faixa "Adiada" com a data; N cai e a linha de contagem aparece', async () => {
    let solta!: (r: RespostaDaAcao) => void
    const a = acoes(() => new Promise<RespostaDaAcao>((res) => { solta = res }))
    render(<SugestoesLista vista={vista([linha('a'), linha('b'), linha('c')])} acoes={a} modo="pagina" />)
    const li = await abrir('b')
    const btn = within(li).getByRole('button', { name: /Adiar 7 dias/ })
    fireEvent.click(btn); fireEvent.click(btn)
    expect(a.adiar).toHaveBeenCalledTimes(1)
    expect(a.adiar).toHaveBeenCalledWith('b')
    const grupo = within(li).getByRole('group', { name: /dispensar ou adiar/i })
    for (const b of within(grupo).getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(within(grupo).getByText('Adiando…').closest('button')!.getAttribute('aria-busy')).toBe('true')
    expect(cnt()).toBe('3')
    await act(async () => { solta({ ok: true, adiado_ate: '2026-10-30T18:00:00Z' }) })
    const faixa = document.querySelector('[data-row="b"]')!
    expect(faixa.className).toMatch(/sg-adi/)
    expect(faixa.textContent).toContain('Adiada. Volta para esta lista em sex, 30/10.')
    expect(faixa.getAttribute('role')).toBe('status')
    expect(cnt()).toBe('2')
    expect(document.querySelector('.sg-adl')!.textContent).toBe('1 adiada por você. Volta em sex, 30/10.')
  })
  it('a faixa recolhe sozinha depois de 5 s', async () => {
    vi.useFakeTimers()
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={acoes()} modo="pagina" />)
    const li = await abrir('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: /Adiar 7 dias/ })) })
    expect(document.querySelector('.sg-adi')).not.toBeNull()
    await act(async () => { vi.advanceTimersByTime(5100) })
    expect(document.querySelector('.sg-adi')).toBeNull()
  })
  it('vence em até 7 dias: frase com a data no lugar do botão, fora do Tab; Cancelar segue', async () => {
    render(<SugestoesLista vista={vista([linha('a'), linha('b', { naoAdia: { dia: 'qua, 28/10', data: '28/10' } })])} acoes={acoes()} modo="pagina" />)
    const li = await abrir('b')
    const grupo = within(li).getByRole('group', { name: /dispensar ou adiar/i })
    expect(within(grupo).queryByRole('button', { name: /Adiar 7 dias/ })).toBeNull()
    expect(grupo.querySelector('.sg-vence')!.textContent).toBe('Vence em qua, 28/10: não dá para adiar 7 dias.')
    expect(grupo.querySelector('.sg-sep2')!.className).toMatch(/sg-sep-v/)
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lugar errado', 'Não me interessa', 'Já fiz', 'Cancelar'])
  })
  it('corrida (venceu antes dos 7 dias): "Não adiou: ela vence em 28/10, antes dos 7 dias.", sem nova tentativa; o painel passa a mostrar a frase', async () => {
    const a = acoes(async () => ({ ok: false, motivo: 'expira_antes', expira_em: '2026-10-28T18:00:00Z' }))
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={a} modo="pagina" />)
    const li = await abrir('b')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: /Adiar 7 dias/ })) })
    const erro = li.querySelector('.sg-errl')!
    expect(erro.textContent).toBe('Não adiou: ela vence em 28/10, antes dos 7 dias.')
    expect(within(li as HTMLElement).queryByRole('button', { name: /Tentar de novo/ })).toBeNull()
    expect(cnt()).toBe('2')
    const li2 = await abrir('b') // fecha
    if (!li2.querySelector('.sg-vence')) fireEvent.click(within(li2).getAllByRole('button', { name: /dispensar ou adiar/i })[0]!)
    expect(li2.querySelector('.sg-vence')!.textContent).toBe('Vence em qua, 28/10: não dá para adiar 7 dias.')
  })
  it('sem conexão: "Não salvou “Adiar 7 dias”" com "Tentar de novo"; o retry adia de novo e ja_adiado vira a faixa Adiada normal', async () => {
    const respostas: Array<() => Promise<RespostaDaAcao>> = [
      () => Promise.reject(new Error('rede')),
      async () => ({ ok: false, motivo: 'ja_adiado', adiado_ate: '2026-10-30T18:00:00Z' }),
    ]
    const a = acoes(() => respostas.shift()!())
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede') }))
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={a} modo="pagina" />)
    const li = await abrir('b')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: /Adiar 7 dias/ })) })
    await act(async () => { await Promise.resolve() })
    expect(li.querySelector('.sg-errl')!.textContent).toContain('Não salvou “Adiar 7 dias”: sem conexão. A sugestão continua aberta.')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: /Tentar de novo “Adiar 7 dias”/ })) })
    expect(a.adiar).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-row="b"]')!.textContent).toContain('Adiada. Volta para esta lista em sex, 30/10.')
    expect(document.querySelector('[data-row="b"]')!.textContent).not.toContain('já saiu')
  })
  it('a última linha adiada: faixa Adiada antes do vazio "Você adiou 1 sugestão." e o foco vai à frase-resumo', async () => {
    render(<SugestoesLista vista={vista([linha('a')])} acoes={acoes()} modo="pagina" />)
    const li = await abrir('a')
    await act(async () => { fireEvent.click(within(li).getByRole('button', { name: /Adiar 7 dias/ })) })
    expect(document.querySelector('.sg-adi')).not.toBeNull()
    expect(document.querySelector('.sg-vz h3')!.textContent).toBe('Você adiou 1 sugestão.')
    expect(document.querySelector('.sg-vz p')!.textContent).toBe('Ela volta em sex, 30/10.')
    expect(document.activeElement).toBe(document.querySelector('.sg-sum'))
  })
  it('selo "Adiada por você em dd/mm" na linha que voltou; e dá para adiar de novo', async () => {
    render(<SugestoesLista vista={vista([linha('a', { adiadaEm: '23/10' })])} acoes={acoes()} modo="pagina" />)
    expect(document.querySelector('.sg-ven1')!.textContent).toBe('Adiada por você em 23/10')
    const li = await abrir('a')
    expect(within(li).getByRole('button', { name: /Adiar 7 dias/ })).toBeTruthy()
  })
  it('lista com adiadas: a linha de contagem fica sob o resumo (sem selo no cabeçalho); nenhuma adiada, nenhuma linha', () => {
    const { unmount } = render(<SugestoesLista vista={vista([linha('a')], { adiadas: { n: 2, proxima: '2026-10-27T18:00:00Z' } })} acoes={null} modo="pagina" />)
    expect(document.querySelector('.sg-adl')!.textContent).toBe('2 adiadas por você. A próxima volta em ter, 27/10.')
    expect(document.querySelector('.sg-phd')!.textContent).not.toMatch(/adiad/)
    unmount()
    render(<SugestoesLista vista={vista([linha('a')])} acoes={null} modo="pagina" />)
    expect(document.querySelector('.sg-adl')).toBeNull()
  })
  it('vazio adiado no bloco: uma linha só; a 390 pode quebrar mas é um só elemento', () => {
    const v = vista([], { n: 0, resumo: 'Nenhuma sugestão aberta.', vazio: { familia: 'adiado', topo: 'Nenhuma sugestão aberta.', titulo: 'Você adiou 2 sugestões.', texto: 'A próxima volta em ter, 27/10.', texto2: 'Nenhum outro vídeo passou do normal.' } })
    render(<SugestoesLista vista={v} acoes={null} modo="bloco" verTodasHref="/x" />)
    const vz = document.querySelector('.sg-vz1')!
    expect(vz.textContent).toContain('Você adiou 2 sugestões. A próxima volta em ter, 27/10.')
    expect(vz.textContent).not.toContain('Nenhum outro vídeo')
  })
  it('vazio adiado não medido: N mostra "?", chip "não medido", sem "0 adiadas"', () => {
    const v = vista([], { n: 0, resumo: 'Nenhuma sugestão aberta.', adiadas: null, vazio: { familia: 'adiado', topo: 'Nenhuma sugestão aberta.', titulo: 'Adiadas por você:', chipNm: true, texto: 'Não deu para contar quantas voltam nem quando.', texto2: 'Há vídeos estourando, mas nenhum com lugar reconhecido.' } })
    render(<SugestoesLista vista={v} acoes={null} modo="pagina" />)
    expect(cnt()).toBe('?')
    expect(document.querySelector('.sg-vz h3')!.textContent).toBe('Adiadas por você: não medido')
    expect(document.querySelector('.sg-vz .sg-nm')).not.toBeNull()
    expect(document.body.textContent).not.toMatch(/0 adiadas|Você adiou/)
    expect(document.querySelectorAll('.sg-vz p')).toHaveLength(2)
  })
})

describe('vistaVisivel: adiadas locais', () => {
  it('uma linha adiada aqui e ainda na prop entra na contagem das adiadas (a prop atualizada já a conta)', () => {
    const v = vista([linha('a'), linha('b')], { adiadas: { n: 1, proxima: '2026-10-28T18:00:00Z' } })
    const e = reduzirLista(estadoInicial(), { tipo: 'resposta', id: 'a', motivo: 'adiar', resposta: { ok: true, adiado_ate: '2026-10-30T18:00:00Z' } })
    const vv = vistaVisivel(v, e, null)
    expect(vv.n).toBe(1)
    expect(vv.adiadas).toEqual({ n: 2, proxima: '2026-10-28T18:00:00Z' })
    // prop já atualizada (a linha não vem mais): nada a somar
    expect(vistaVisivel(vista([linha('b')], { adiadas: { n: 2, proxima: '2026-10-28T18:00:00Z' } }), e, null).adiadas).toEqual({ n: 2, proxima: '2026-10-28T18:00:00Z' })
  })
})

describe('CSS do delta F3b', () => {
  const css = fs.readFileSync(path.join(DIR, 'sugestoes.css'), 'utf8')
  it('faixa Adiada em --btn-line sobre --sunk (sem verde); traço duplo; fio horizontal até 700 px', () => {
    expect(css).toMatch(/\.sg-done\.sg-adi\{border-left-color:var\(--btn-line\);background:var\(--sunk\)\}/)
    expect(css).toMatch(/\.sg-sep2\{width:5px/)
    expect(css).toMatch(/@container \(max-width:700px\)/)
    expect(css).not.toMatch(/color-mix/)
  })
})
