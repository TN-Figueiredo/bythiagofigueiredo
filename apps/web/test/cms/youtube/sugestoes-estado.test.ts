// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { estadoInicial, reduzirLista, vistaVisivel, type EstadoDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/estado-da-lista'
import type { LinhaDaVista, VistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import type { RespostaDaAcao } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/tipos'

const linha = (id: string, kind: 'destino' | 'parecido' = 'destino', cheio = false): LinhaDaVista => ({
  id, kind, chip: { rotulo: 'Destino esquentou', simbolo: 'alfinete' }, titulo: 't' + id, puxadoPor: null, regua: null,
  seus: { texto: 's', naoMedido: false }, primario: { texto: 'Abrir', href: '/x', cheio }, venceEm: null,
  info: { mults: '—', medida: 'm', regra: 'r', surgiu: '18/10', vence: '17/11' },
  motivos: [{ valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' }],
})
const vista = (ids: string[], n: number | null = ids.length): VistaDaLista => {
  const ls = ids.map((id, i) => linha(id, 'destino', i === 0))
  return { n, calculado: 'Calculado hoje às 07:02', velho: false, resumo: 'x', faixa: null, filtro: null, linhas: ls, completas: ls, totalAlemDoLimite: null, vazio: null }
}
const roda = (e: EstadoDaLista, ...ev: Parameters<typeof reduzirLista>[1][]): EstadoDaLista => ev.reduce(reduzirLista, e)
const ok: RespostaDaAcao = { ok: true }

describe('reduzirLista: contagem sempre derivada da prop', () => {
  it('sucesso + prop nova com n-1: N cai uma vez só', () => {
    const e = roda(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'nao_interessa' }, { tipo: 'resposta', id: 'a', motivo: 'nao_interessa', resposta: ok })
    const v = vistaVisivel(vista(['b', 'c'], 2), e, null)
    expect(v.n).toBe(2)
    expect(v.linhas.map((l) => l.id)).toEqual(['b', 'c'])
  })
  it('sucesso + prop velha: N cai uma vez, a linha some', () => {
    const e = roda(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'nao_interessa' }, { tipo: 'resposta', id: 'a', motivo: 'nao_interessa', resposta: ok })
    const v = vistaVisivel(vista(['a', 'b', 'c']), e, null)
    expect(v.n).toBe(2)
    expect(v.linhas.map((l) => l.id)).toEqual(['b', 'c'])
    expect(v.linhas[0]!.primario.cheio).toBe(true) // laranja passa para a 1ª aberta
    expect(v.linhas[1]!.primario.cheio).toBe(false)
  })
  it('antes da resposta, N não muda', () => {
    const e = roda(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'nao_interessa' })
    expect(vistaVisivel(vista(['a', 'b', 'c']), e, null).n).toBe(3)
  })
  it('prop com n null: devolve a última boa com erro-com-lista na mesma chamada', () => {
    const boa = vista(['a', 'b'])
    const v = vistaVisivel({ ...vista([], null), n: null }, estadoInicial(), boa)
    expect(v.n).toBe(2)
    expect(v.linhas.map((l) => l.id)).toEqual(['a', 'b'])
    expect(v.faixa?.tipo).toBe('erro-com-lista')
  })
  it('prop com n null e sem última boa: devolve a prop', () => {
    const p = vista([], null)
    expect(vistaVisivel(p, estadoInicial(), null)).toEqual(expect.objectContaining({ n: null, faixa: null }))
  })
  it('a última boa também desconta as respondidas', () => {
    const e = roda(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'ja_fiz' }, { tipo: 'resposta', id: 'a', motivo: 'ja_fiz', resposta: ok })
    const v = vistaVisivel(vista([], null), e, vista(['a', 'b']))
    expect(v.n).toBe(1)
  })
  it('tudo respondido: vazio resolvido, nunca lista oca', () => {
    const e = roda(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'ja_fiz' }, { tipo: 'resposta', id: 'a', motivo: 'ja_fiz', resposta: ok })
    const v = vistaVisivel(vista(['a']), e, null)
    expect(v.n).toBe(0)
    expect(v.vazio?.familia).toBe('resolvido')
  })
})

describe('reduzirLista: desfechos', () => {
  const ini = () => reduzirLista(estadoInicial(), { tipo: 'iniciar', id: 'a', motivo: 'lugar_errado' })
  const casos: Array<[string, RespostaDaAcao, { saiu?: 'sucesso' | 'ja-saiu'; erro?: string }]> = [
    ['ok', { ok: true }, { saiu: 'sucesso' }],
    ['nao_aberto', { ok: false, motivo: 'nao_aberto' }, { saiu: 'ja-saiu' }],
    ['nao_encontrado', { ok: false, motivo: 'nao_encontrado' }, { saiu: 'ja-saiu' }],
    ['sem_permissao', { ok: false, motivo: 'sem_permissao' }, { erro: 'sem-permissao' }],
    ['motivo_invalido', { ok: false, motivo: 'motivo_invalido' }, { erro: 'nao-salvou' }],
    ['falhou', { ok: false, motivo: 'falhou' }, { erro: 'nao-salvou' }],
  ]
  it.each(casos)('%s', (_n, resposta, esperado) => {
    const e = reduzirLista(ini(), { tipo: 'resposta', id: 'a', motivo: 'lugar_errado', resposta })
    expect(e.pendente).toBeNull()
    expect(e.respondidas.get('a')).toBe(esperado.saiu)
    expect(e.erros.get('a')?.tipo).toBe(esperado.erro)
    if (esperado.erro) expect(e.erros.get('a')?.motivo).toBe('lugar_errado')
  })
  it('rejeição da promessa / 15 s: sem conexão, a linha fica', () => {
    const e = reduzirLista(ini(), { tipo: 'falha', id: 'a', motivo: 'lugar_errado' })
    expect(e.pendente).toBeNull()
    expect(e.erros.get('a')?.tipo).toBe('sem-conexao')
    expect(e.respondidas.has('a')).toBe(false)
  })
  it('estouro de 15 s e então ok tardio: a linha sai com a confirmação e o erro some', () => {
    const e = roda(ini(), { tipo: 'falha', id: 'a', motivo: 'lugar_errado' }, { tipo: 'resposta', id: 'a', motivo: 'lugar_errado', resposta: ok })
    expect(e.respondidas.get('a')).toBe('sucesso')
    expect(e.erros.has('a')).toBe(false)
    expect(e.motivoDe.get('a')).toBe('lugar_errado')
  })
  it('resposta não-ok de chamada que não é a pendente é ignorada', () => {
    const e = roda(ini(), { tipo: 'falha', id: 'a', motivo: 'lugar_errado' }, { tipo: 'resposta', id: 'a', motivo: 'lugar_errado', resposta: { ok: false, motivo: 'nao_aberto' } })
    expect(e.respondidas.has('a')).toBe(false)
    expect(e.erros.get('a')?.tipo).toBe('sem-conexao')
  })
  it('nunca "dispensada" e "já saiu" juntas: ja-saiu não sobrescreve sucesso', () => {
    const e = roda(ini(), { tipo: 'resposta', id: 'a', motivo: 'lugar_errado', resposta: ok })
    const e2 = reduzirLista(e, { tipo: 'resposta', id: 'a', motivo: 'lugar_errado', resposta: { ok: false, motivo: 'nao_aberto' } })
    expect(e2.respondidas.get('a')).toBe('sucesso')
  })
  it('segundo "iniciar" com outra pendente é ignorado (toque duplo)', () => {
    const e = reduzirLista(ini(), { tipo: 'iniciar', id: 'b', motivo: 'ja_fiz' })
    expect(e.pendente).toEqual({ id: 'a', motivo: 'lugar_errado' })
  })
  it('tentar de novo limpa o erro da linha', () => {
    const e = roda(ini(), { tipo: 'falha', id: 'a', motivo: 'lugar_errado' }, { tipo: 'iniciar', id: 'a', motivo: 'lugar_errado' })
    expect(e.erros.has('a')).toBe(false)
    expect(e.pendente).toEqual({ id: 'a', motivo: 'lugar_errado' })
  })
  it('o reducer não muta o estado anterior', () => {
    const e0 = ini()
    reduzirLista(e0, { tipo: 'resposta', id: 'a', motivo: 'lugar_errado', resposta: ok })
    expect(e0.respondidas.size).toBe(0)
  })
})
