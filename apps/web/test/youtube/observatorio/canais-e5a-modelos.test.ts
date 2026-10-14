// A5 · E5a, Tarefa 5: os dois modelos puros da lista de Canais (direção e estado) e a contagem dos filtros.
import { describe, expect, it } from 'vitest'
import { celulaDeDirecao, resumoDeDirecao, type CelulaDeDirecao } from '@/app/cms/(authed)/youtube/competitors/_canais/direcao-model'
import { contagemDosFiltros, estadoDaLinha, linhaNoFiltro, type LinhaParaContagem } from '@/app/cms/(authed)/youtube/competitors/_canais/estado-model'
import { FRASES } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { quedaExisteEm } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { medido, naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { M8DoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { ValorDirecaoCanal } from '@/lib/youtube/observatorio/medidas/direcao'

const J = { de: '2026-08-25', ate: '2026-10-14', dias: 56 }
const dir = (rec: number, ant: number, janela = J) =>
  medido<ValorDirecaoCanal>({ variacao: rec / ant - 1, direcao: 'igual', ganhoRecente: rec, ganhoAnterior: ant }, 3, janela)
const EX = { missingSince: null, subscribersHidden: false, lastOkSyncedAt: null }
const HOJE = '2026-10-14'
const DEPOIS = '2026-12-20'

function m8(estado: 'ativo' | 'parado' | 'em_queda' | 'pausado' | 'fora_do_ar', o: { dias?: number; limite?: number; queda?: M8DoCanal['queda'] } = {}): M8DoCanal {
  return {
    estado: medido(estado, 1, { de: null, ate: HOJE, dias: null }),
    parado: medido({ dias: o.dias ?? 3, limite: o.limite ?? 28 }, 1, { de: null, ate: null, dias: o.dias ?? 3 }),
    queda: o.queda ?? naoMedido('janela_cruza_mudanca_de_contagem', { fechaEm: '2026-12-14' }),
  }
}
const quedaOk = (v: number[]) => medido({ janelas: v }, 4, J)

describe('E5a T5: célula de direção', () => {
  it('medida: o percentual sai dos dois ganhos inteiros, com símbolo e régua', () => {
    const c = celulaDeDirecao(dir(2171, 1840), EX)
    expect(c).toMatchObject({ tipo: 'medido', pct: 18, simbolo: 'sobe', texto: '+18%', ganhoRecente: 2171, ganhoAnterior: 1840 })
  })
  it('-78% passa da régua: a ponta vira triângulo e o texto guarda o valor verdadeiro', () => {
    const c = celulaDeDirecao(dir(22, 100), EX)
    expect(c).toMatchObject({ tipo: 'medido', pct: -78, simbolo: 'desce', foraDaEscala: 'abaixo', texto: '−78%' })
  })
  it('a nota da mudança de contagem vem da janela e some depois dela', () => {
    expect(celulaDeDirecao(dir(10, 10, { de: '2026-08-20', ate: '2026-10-15', dias: 56 }), EX)).toMatchObject({ avisoDeContagem: { ate: expect.any(String) } })
    expect(celulaDeDirecao(dir(10, 10), EX)).toMatchObject({ avisoDeContagem: null })
  })
  it('canal sem 56 dias: "fecha em dd/mm", com o código do motivo', () => {
    const c = celulaDeDirecao(naoMedido('fecha_em', { fechaEm: '2026-10-17' }), EX)
    expect(c).toMatchObject({ tipo: 'nao_medido', motivo: 'fecha_em', curta: 'fecha em 17/10' })
  })
  it('sem o registro da borda: a data que faltou', () => {
    const c = celulaDeDirecao(naoMedido('sem_registro_na_borda', { desde: '2026-09-02' }), EX)
    expect(c).toMatchObject({ tipo: 'nao_medido', motivo: 'sem_registro_na_borda', curta: 'sem registro em 02/09' })
  })
  it('canal sem vídeo: "sem views nos 56 dias para comparar"', () => {
    expect(celulaDeDirecao(naoMedido('base_zero'), EX, { semVideos: true })).toMatchObject({ tipo: 'nao_medido', curta: 'sem views nos 56 dias para comparar' })
    expect(celulaDeDirecao(naoMedido('base_zero'), EX, { semVideos: false })).toMatchObject({ curta: 'base em zero' })
  })
  it('saiu do YouTube: a data vem dos extras e o motivo é o da medida', () => {
    const c = celulaDeDirecao(naoMedido('sem_registro_recente'), { ...EX, missingSince: '2026-10-04T12:00:00Z' })
    expect(c).toMatchObject({ tipo: 'nao_medido', motivo: 'sem_registro_recente', curta: 'saiu do YouTube em 04/10' })
  })
  it('medida que não chegou, ou que falhou, é "não carregou" e nunca "não medido"', () => {
    expect(celulaDeDirecao(null, EX)).toMatchObject({ tipo: 'nao_carregou' })
    expect(celulaDeDirecao(naoMedido('calculo_falhou'), EX)).toMatchObject({ tipo: 'nao_carregou', motivo: 'calculo_falhou' })
  })
  it('canal próprio: o motivo dele, nunca "não carregou"', () => {
    expect(celulaDeDirecao(null, null, { proprio: true })).toEqual({ tipo: 'canal_proprio', curta: 'não medido: o YouTube não dá esse número do seu canal', longa: 'o YouTube não dá esse número do seu canal' })
  })
  it('toda célula não medida traz o código do motivo, e a frase longa dela é FRASES_DE_MOTIVO[código](contexto)', () => {
    for (const m of [naoMedido('fecha_em', { fechaEm: '2026-10-17' }), naoMedido('pouco_registro'), naoMedido('contagem_recuou'), naoMedido('coleta_pausada'), naoMedido('sem_registro_na_borda', { desde: '2026-09-02' })]) {
      const c = celulaDeDirecao(m, EX)
      if (c.tipo !== 'nao_medido' || m.estado !== 'nao_medido') throw new Error('esperava não medido')
      expect(c.motivo).toBe(m.motivo)
      expect(c.longa).toBe(FRASES[m.motivo]({ desde: m.desde, fechaEm: m.fechaEm, n: m.n, minimo: m.minimo }).longa)
    }
  })
})

describe('E5a T5: resumo das quatro casas', () => {
  const med = (r: number, a: number): CelulaDeDirecao => celulaDeDirecao(dir(r, a), EX)
  const nm = (): CelulaDeDirecao => celulaDeDirecao(naoMedido('pouco_registro'), EX)
  it('as quatro casas sempre existem; zero medido é zero', () => {
    const r = resumoDeDirecao([med(200, 100), med(100, 100)])
    expect(r).toMatchObject({ sobe: 1, estavel: 1, desce: 0, naoMedido: 0, naoCarregou: 0, canais: 2 })
  })
  it('medidas não carregaram: nenhuma casa mostra 0 e a frase diz quantos', () => {
    const r = resumoDeDirecao([celulaDeDirecao(null, EX), celulaDeDirecao(null, EX)])
    expect(r).toMatchObject({ sobe: null, estavel: null, desce: null, naoMedido: null, naoCarregou: 2 })
    expect(r.frase).toBe('A direção não carregou em 2 canais.')
  })
  it('canal próprio não entra em casa nenhuma, e a frase não diz que um canal não carregou', () => {
    const r = resumoDeDirecao([med(200, 100), celulaDeDirecao(null, null, { proprio: true })])
    expect(r).toMatchObject({ sobe: 1, naoMedido: 0, naoCarregou: 0, canais: 1 })
    expect(r.frase).not.toMatch(/carreg/)
  })
  it('só o canal próprio: nada contado, frase vazia', () => {
    expect(resumoDeDirecao([celulaDeDirecao(null, null, { proprio: true })])).toMatchObject({ canais: 0, frase: '' })
  })
  it('parte não medida: "medida em N de M"', () => {
    const r = resumoDeDirecao([med(200, 100), nm(), nm()])
    expect(r).toMatchObject({ sobe: 1, naoMedido: 2 })
    expect(r.frase).toContain('medida em 1 de 3 canais')
  })
})

describe('E5a T5: estado da linha', () => {
  const E = (m: M8DoCanal | null, ex: typeof EX | null = EX, n = 10, hojeSP = HOJE) => estadoDaLinha(m, ex, n, { hojeSP })
  it('ativo não tem pastilha de estado e diz "Ativo, publicou há N dias"', () => {
    expect(E(m8('ativo', { dias: 5 }))).toMatchObject({ pastilha: 'ativo', linha: 'Ativo, publicou há 5 dias' })
  })
  it('precedência: saiu do YouTube vence parado', () => {
    expect(E(m8('parado', { dias: 90 }), { ...EX, missingSince: '2026-10-04T12:00:00Z' })).toMatchObject({ pastilha: 'fora_do_ar', dataOuDias: '2026-10-04' })
  })
  it('sem vídeos vence parado', () => {
    expect(E(m8('parado'), EX, 0).pastilha).toBe('sem_videos')
  })
  it('parado e em queda: a pastilha é de parado e a queda vira "também em queda"', () => {
    const e = E(m8('parado', { dias: 60, queda: quedaOk([-0.3, -0.4, -0.2]) }), EX, 10, DEPOIS)
    expect(e).toMatchObject({ pastilha: 'parado', dataOuDias: 60, tambemEmQueda: true })
  })
  it('35 dias sem publicar com intervalo de 20 (limite 80): ativo; com intervalo de 5 (limite 28): parado', () => {
    expect(E(m8('ativo', { dias: 35, limite: 80 })).pastilha).toBe('ativo')
    expect(E(m8('parado', { dias: 35, limite: 28 })).pastilha).toBe('parado')
  })
  it('coleta pausada não diz parado nem ativo', () => {
    expect(E(m8('pausado')).pastilha).toBe('pausado')
  })
  it('M8 não carregou: nunca ativo', () => {
    expect(E(null)).toMatchObject({ pastilha: 'nao_carregou' })
    const falha = naoMedido('calculo_falhou')
    expect(E({ estado: falha, parado: falha, queda: falha })).toMatchObject({ pastilha: 'nao_carregou', motivo: 'calculo_falhou' })
  })
  it('M8 não medido por falta de dado: pastilha própria, nunca ativo', () => {
    const nm = naoMedido('poucos_videos')
    expect(E({ estado: nm, parado: nm, queda: nm })).toMatchObject({ pastilha: 'nao_medido', motivo: 'poucos_videos' })
  })
  it('extras não lidos: a pastilha "saiu do YouTube" não é inventada e a linha avisa', () => {
    const e = E(m8('ativo', { dias: 2 }), null)
    expect(e).toMatchObject({ pastilha: 'ativo', extrasNaoLidos: true })
  })
  it('M8 diz fora do ar mas os extras não foram lidos: a pastilha existe, sem data', () => {
    expect(E(m8('fora_do_ar'), null)).toMatchObject({ pastilha: 'fora_do_ar', dataOuDias: null, extrasNaoLidos: true })
  })
  it('canal próprio: caso próprio, nunca ativo', () => {
    expect(estadoDaLinha(null, null, 5, { proprio: true, hojeSP: HOJE }).pastilha).toBe('canal_proprio')
  })
  it('queda não medida só vale depois da data, com o motivo', () => {
    expect(E(m8('ativo'), EX, 10, HOJE).quedaNaoMedida).toBeNull()
    expect(E(m8('ativo'), EX, 10, DEPOIS).quedaNaoMedida).toMatchObject({ motivo: 'janela_cruza_mudanca_de_contagem' })
  })
})

describe('E5a T5: contagem dos filtros', () => {
  const L = (m: M8DoCanal | null, o: { proprio?: boolean; emErro?: boolean; ex?: typeof EX } = {}, hojeSP = DEPOIS): LinhaParaContagem =>
    ({ proprio: !!o.proprio, emErro: !!o.emErro, estado: estadoDaLinha(m, o.ex ?? EX, 10, { proprio: o.proprio, hojeSP }) })
  it('antes da data, "em queda" é ainda não existe com a data, e não é número', () => {
    const c = contagemDosFiltros([L(m8('ativo'), {}, '2026-12-13')], '2026-12-13')
    expect(c.queda).toEqual({ tipo: 'ainda_nao_existe', existeEm: quedaExisteEm() })
  })
  it('na data, com todos ainda cruzando a mudança de contagem, é não medido com a data, nunca 0', () => {
    const c = contagemDosFiltros([L(m8('ativo'), {}, quedaExisteEm()), L(m8('ativo'), {}, quedaExisteEm())], quedaExisteEm())
    expect(c.queda).toMatchObject({ tipo: 'nao_medido', motivo: 'janela_cruza_mudanca_de_contagem', data: quedaExisteEm() })
  })
  it('depois da data, 0 de 9 medidos em queda é zero medido e escreve a base', () => {
    const ls = Array.from({ length: 9 }, () => L(m8('ativo', { queda: quedaOk([0.1, 0.2, 0.3]) })))
    expect(contagemDosFiltros(ls, DEPOIS).queda).toEqual({ tipo: 'numero', emQueda: 0, quedaMedidaEm: 9, canais: 9 })
  })
  it('depois da data, canal sem as cinco bordas não conta como zero: quedaMedidaEm fica menor que canais', () => {
    const ls = [L(m8('ativo', { queda: quedaOk([0.1, 0.2, 0.3]) })), L(m8('ativo', { queda: naoMedido('pouco_registro') }))]
    expect(contagemDosFiltros(ls, DEPOIS).queda).toEqual({ tipo: 'numero', emQueda: 0, quedaMedidaEm: 1, canais: 2 })
    expect(ls[1]!.estado.quedaNaoMedida).toMatchObject({ motivo: 'pouco_registro' })
  })
  it('depois da data, nenhum canal medido: não medido com o motivo mais comum', () => {
    const ls = [L(m8('ativo', { queda: naoMedido('pouco_registro') })), L(m8('ativo', { queda: naoMedido('pouco_registro') })), L(m8('ativo', { queda: naoMedido('contagem_recuou') }))]
    expect(contagemDosFiltros(ls, DEPOIS).queda).toMatchObject({ tipo: 'nao_medido', motivo: 'pouco_registro' })
  })
  it('o filtro "em queda" inclui o canal parado que também está em queda; o canal próprio não entra em nada', () => {
    const q = quedaOk([-0.3, -0.4, -0.2])
    const ls = [L(m8('parado', { dias: 60, queda: q })), L(m8('em_queda', { queda: q })), L(null, { proprio: true }), L(m8('ativo', { queda: quedaOk([0.2, 0.2, 0.2]) }))]
    const c = contagemDosFiltros(ls, DEPOIS)
    expect(c).toMatchObject({ todos: 3, parados: 1, queda: { tipo: 'numero', emQueda: 2, quedaMedidaEm: 3, canais: 3 } })
    expect(ls.filter(l => linhaNoFiltro(l, 'em-queda')).length).toBe(2)
    expect(linhaNoFiltro(ls[2]!, 'parados')).toBe(false)
  })
  it('saiu do YouTube e em erro contam por si', () => {
    const ls = [L(m8('ativo'), { ex: { ...EX, missingSince: '2026-10-04T12:00:00Z' } }), L(m8('ativo'), { emErro: true })]
    expect(contagemDosFiltros(ls, DEPOIS)).toMatchObject({ saiu: 1, emErro: 1 })
  })
})
