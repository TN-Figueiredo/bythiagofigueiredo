// @vitest-environment node
// A5 · F2-coleta, Tarefa 4: a numeração dos espectadores de um fio, pura e sem chave guardada.
import { describe, expect, it } from 'vitest'
import { numerarEspectadores } from '@/lib/youtube/observatorio/comentarios/espectadores'
import type { Conversa, RespostaVista } from '@/lib/youtube/observatorio/comentarios/tipos'

const CRIADOR = 'UCcriadorInventado'
const T0 = Date.parse('2026-01-10T12:00:00.000Z')
const r = (id: string, canal: string | null, n: number): RespostaVista => ({
  id, texto: 'texto ' + id, cortado: false, publicadoEm: new Date(T0 + n * 3_600_000).toISOString(), editadoEm: null, curtidas: 0, autorCanalId: canal,
})
function fio(o: { topo?: string | null; doCriador?: boolean; respostas: RespostaVista[] }): Conversa {
  return {
    id: 'topo', posicao: 0, texto: 't', cortado: false, publicadoEm: new Date(T0).toISOString(), editadoEm: null, curtidas: 1, respostasTotal: o.respostas.length,
    autor: { nome: null, canalId: o.topo === undefined ? 'UCtopo' : o.topo, foto: null }, doCriador: o.doCriador ?? false, criadorRespondeu: true,
    respostasDoCriador: [r('rc', CRIADOR, 0)], canaisNasRespostas: [], respostasDeTerceiros: o.respostas, idsRespostasVistas: o.respostas.map(x => x.id),
    prefixoForaDeOrdem: false,
  }
}
const nenhum = new Map<string, number>()
const nums = (c: Conversa, g: ReadonlyMap<string, number> = nenhum, max = 0) => numerarEspectadores(c, CRIADOR, g, max).map(x => x.speakerNo)

describe('numerarEspectadores', () => {
  it('1. topo de espectador, respostas A, B, A: A = 2, B = 3, A de novo = 2', () => {
    expect(nums(fio({ respostas: [r('a1', 'UCa', 1), r('b1', 'UCb', 2), r('a2', 'UCa', 3)] }))).toEqual([2, 3, 2])
  })
  it('2. resposta do autor do topo é o 1', () => {
    expect(nums(fio({ respostas: [r('t1', 'UCtopo', 1), r('a1', 'UCa', 2)] }))).toEqual([1, 2])
  })
  it('3. topo do criador: o primeiro espectador é 1', () => {
    expect(nums(fio({ doCriador: true, topo: CRIADOR, respostas: [r('a1', 'UCa', 1), r('b1', 'UCb', 2), r('a2', 'UCa', 3)] }))).toEqual([1, 2, 1])
  })
  it('4. resposta sem authorChannelId: número novo, cada uma o seu', () => {
    expect(nums(fio({ respostas: [r('x1', null, 1), r('x2', null, 2), r('a1', 'UCa', 3)] }))).toEqual([2, 3, 4])
  })
  it('5. marco 7: quem já tem número o mantém; a pessoa nova vem depois do maior guardado, mesmo ausente do lote', () => {
    const g = new Map([['a1', 4]])
    expect(nums(fio({ respostas: [r('a1', 'UCa', 1), r('a2', 'UCa', 2), r('n1', 'UCn', 3)] }), g, 6)).toEqual([4, 4, 7])
    // sem maiorGuardado maior, o limite é o maior visto: 4 -> 5
    expect(nums(fio({ respostas: [r('a1', 'UCa', 1), r('n1', 'UCn', 2)] }), g, 0)).toEqual([4, 5])
  })
  it('6. resposta já gravada devolve o número guardado, nunca um novo', () => {
    const g = new Map([['b1', 9]])
    expect(nums(fio({ respostas: [r('a1', 'UCa', 1), r('b1', 'UCb', 2)] }), g, 9)).toEqual([10, 9])
  })
  it('7. a saída tem só id e speakerNo e é determinística', () => {
    const c = fio({ respostas: [r('a1', 'UCa', 1), r('b1', 'UCb', 2)] })
    const a = numerarEspectadores(c, CRIADOR, nenhum, 0)
    expect(a.map(x => Object.keys(x).sort())).toEqual([['id', 'speakerNo'], ['id', 'speakerNo']])
    expect(numerarEspectadores(c, CRIADOR, nenhum, 0)).toEqual(a)
    expect(JSON.stringify(a)).not.toContain('UCa')
  })
  it('8. resposta do criador nunca aparece na saída', () => {
    const out = numerarEspectadores(fio({ respostas: [r('a1', 'UCa', 1)] }), CRIADOR, nenhum, 0)
    expect(out.map(x => x.id)).toEqual(['a1'])
    expect(out.map(x => x.id)).not.toContain('rc')
  })
  it('9. topo sem canal legível ocupa o 1; resposta com canal nulo nunca recebe 1', () => {
    expect(nums(fio({ topo: null, respostas: [r('x1', null, 1), r('a1', 'UCa', 2)] }))).toEqual([2, 3])
  })
  it('10. o mesmo canal com dois números guardados no fio: vale o menor', () => {
    const g = new Map([['a1', 5], ['a2', 3]])
    expect(nums(fio({ respostas: [r('a1', 'UCa', 1), r('a2', 'UCa', 2), r('a3', 'UCa', 3)] }), g, 5)).toEqual([5, 3, 3])
  })
  it('11. recebe só os guardados do fio (mapa pequeno): ids de outro fio no mapa não mudam nada', () => {
    const g = new Map([['de-outro-fio', 99]])
    expect(nums(fio({ respostas: [r('a1', 'UCa', 1)] }), g, 0)).toEqual([2])
  })
})
