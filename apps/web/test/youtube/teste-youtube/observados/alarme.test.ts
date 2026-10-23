// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { avaliarDegradacao, diaBrtAnterior, textoDegradacao, textoSuspenso, type AlvoAtivo, type LeituraDia } from '@/lib/youtube/teste-youtube/observados/alarme'

const AGORA = Date.parse('2026-10-23T12:00:00Z')
const DIA = diaBrtAnterior(AGORA)
const H = 3_600_000
const D = 24 * H
const alvo = (n: number, idadeDias = 10): AlvoAtivo => ({ ytId: 'v' + n, publicadoEm: new Date(DIA.fimMs - idadeDias * D).toISOString() })
const leit = (n: number, k: number, o: Partial<LeituraDia> = {}): LeituraDia => ({
  ytId: 'v' + n, rodadaId: `r${n}-${k}`, lidaEm: new Date(DIA.inicioMs + (k + 1) * 300_000).toISOString(), http: 200, erro: null, jogadorBloqueado: false,
  tituloExibido: 'Titulo ' + n, idioma: 'pt', canal: 'c1', ...o,
})

describe('diaBrtAnterior (foco 3)', () => {
  it('23/10 12:00Z -> dia 2026-10-22, de 03:00Z a 03:00Z', () => {
    expect(DIA).toEqual({ rotulo: '2026-10-22', inicioMs: Date.parse('2026-10-22T03:00:00Z'), fimMs: Date.parse('2026-10-23T03:00:00Z') })
  })
  it('antes das 03:00Z ainda é o dia anterior em SP (23/10 02:00Z = 22/10 23h)', () => {
    expect(diaBrtAnterior(Date.parse('2026-10-23T02:00:00Z')).rotulo).toBe('2026-10-21')
    expect(diaBrtAnterior(Date.parse('2026-10-23T03:00:00Z')).rotulo).toBe('2026-10-22')
  })
  it('virada do mês', () => {
    expect(diaBrtAnterior(Date.parse('2026-11-01T12:00:00Z')).rotulo).toBe('2026-10-31')
  })
  it('uma leitura às 02:59Z do dia seguinte é de D; às 03:00Z não é', () => {
    const alvos = [alvo(1)]
    const dentro = leit(1, 0, { lidaEm: '2026-10-23T02:59:00Z' })
    const fora = leit(1, 1, { lidaEm: '2026-10-23T03:00:00Z' })
    expect(avaliarDegradacao(alvos, [dentro], DIA).dispara).toBe(false)
    const a = avaliarDegradacao(alvos, [fora], DIA)
    expect(a).toMatchObject({ dispara: true, condicao: 'sem_leitura' })
  })
})

describe('avaliarDegradacao (§6.1)', () => {
  it('dia sem leitura com 1 alvo ativo -> sem_leitura', () => {
    expect(avaliarDegradacao([alvo(1)], [], DIA)).toMatchObject({ dispara: true, condicao: 'sem_leitura', alvosConsiderados: 1 })
  })
  it('nenhum alvo considerado -> não dispara (nem 0/0)', () => {
    expect(avaliarDegradacao([], [], DIA)).toMatchObject({ dispara: false, condicao: null, alvosConsiderados: 0 })
  })
  it('http 200, sem erro e sem título entra nos 20% (21% dispara, 20% não)', () => {
    const base = Array.from({ length: 100 }, (_, i) => leit(1 + (i % 10), i))
    const semTitulo = (n: number) => base.map((l, i) => (i < n ? { ...l, tituloExibido: null } : l))
    const alvos = Array.from({ length: 10 }, (_, i) => alvo(1 + i))
    expect(avaliarDegradacao(alvos, semTitulo(21), DIA)).toMatchObject({ dispara: true, condicao: 'sem_titulo', pctSemTitulo: 21 })
    expect(avaliarDegradacao(alvos, semTitulo(20), DIA).dispara).toBe(false)
  })
  it('alvos sem rodada válida de título > 10% -> alvos_sem_leitura (e 10% não)', () => {
    const alvos = Array.from({ length: 10 }, (_, i) => alvo(1 + i))
    // 9 alvos com 10 leituras boas cada; o 10º sem nenhuma leitura boa (mas só 1 leitura ruim: 1/91 < 20%)
    const boas = Array.from({ length: 9 }, (_, i) => Array.from({ length: 10 }, (_, k) => leit(1 + i, k))).flat()
    const ruim = leit(10, 0, { tituloExibido: null })
    expect(avaliarDegradacao(alvos, [...boas, ruim], DIA)).toMatchObject({ dispara: false, alvosSemLeitura: 1 }) // 10% exatos não disparam
    const alvos11 = [...alvos, alvo(11)]
    expect(avaliarDegradacao(alvos11, [...boas, ruim, leit(11, 0, { tituloExibido: null })], DIA)).toMatchObject({ dispara: true, condicao: 'alvos_sem_leitura', alvosSemLeitura: 2, alvosConsiderados: 11 })
  })
  it('alvo de 31 dias e alvo de 2 dias ficam fora de alvosConsiderados', () => {
    const a = avaliarDegradacao([alvo(1), alvo(2, 31), alvo(3, 2)], [leit(1, 0)], DIA)
    expect(a.alvosConsiderados).toBe(1)
    expect(a.dispara).toBe(false)
  })
  it('leitura de alvo fora da conta não entra no percentual', () => {
    const ruins = Array.from({ length: 10 }, (_, k) => leit(3, k, { tituloExibido: null }))
    expect(avaliarDegradacao([alvo(1), alvo(3, 2)], [leit(1, 0), ...ruins], DIA).dispara).toBe(false)
  })
})

describe('textos (igualdade exata)', () => {
  const resto = 'Se continuar, a leitura de títulos dos concorrentes fica parada até construirmos a leitura pela forja (hoje ela não existe).'
  const segundo = '2º dia seguido: é o gatilho para construir a leitura pela forja.'
  it('sem_titulo: literal do §6.1, com uma casa e floor', () => {
    const a = { dispara: true, condicao: 'sem_titulo' as const, pctSemTitulo: 34, alvosSemLeitura: 0, alvosConsiderados: 10 }
    expect(textoDegradacao(a, false)).toBe("Leitura dos concorrentes degradada ontem: 34% das leituras sem título. Os estados de título podem ficar 'não medido'. " + resto)
    expect(textoDegradacao(a, true)).toBe("Leitura dos concorrentes degradada ontem: 34% das leituras sem título. Os estados de título podem ficar 'não medido'. " + resto + ' ' + segundo)
    expect(textoDegradacao({ ...a, pctSemTitulo: 20.4 }, false)).toContain('20,4% das leituras')
  })
  it('percentual é floor: 21 de 103 -> 20,3%, nunca 20,4% nem 20%', () => {
    const l = (i: number, n: number) => leit(1, i, n > i ? { tituloExibido: null } : {})
    const ls = Array.from({ length: 103 }, (_, i) => l(i, 21))
    const a = avaliarDegradacao([alvo(1)], ls, DIA)
    expect(a.pctSemTitulo).toBe(20.3)
    expect(textoDegradacao(a, false)).toContain('20,3% das leituras')
  })
  it('sem_leitura (proposta, a Hanna valida)', () => {
    const a = { dispara: true, condicao: 'sem_leitura' as const, pctSemTitulo: 0, alvosSemLeitura: 0, alvosConsiderados: 12 }
    expect(textoDegradacao(a, false)).toBe("Leitura dos concorrentes parada ontem: a sonda não trouxe nenhuma leitura de 12 vídeos acompanhados. Os estados de título vão ficar 'não medido'. " + resto)
    expect(textoDegradacao(a, true)).toBe("Leitura dos concorrentes parada ontem: a sonda não trouxe nenhuma leitura de 12 vídeos acompanhados. Os estados de título vão ficar 'não medido'. " + resto + ' ' + segundo)
    expect(textoDegradacao({ ...a, alvosConsiderados: 1 }, false)).toContain('leitura de 1 vídeo acompanhado.')
  })
  it('alvos_sem_leitura (proposta, a Hanna valida): em vídeos, sem %', () => {
    const a = { dispara: true, condicao: 'alvos_sem_leitura' as const, pctSemTitulo: 3, alvosSemLeitura: 4, alvosConsiderados: 30 }
    expect(textoDegradacao(a, false)).toBe("Leitura dos concorrentes degradada ontem: 4 de 30 vídeos acompanhados ficaram sem nenhuma passagem com título. Os estados de título podem ficar 'não medido'. " + resto)
    expect(textoDegradacao(a, true)).toContain(segundo)
    expect(textoDegradacao(a, false)).not.toContain('%')
  })
  it('alvos_sem_leitura com K = 1: "ficou" no singular; K > 1 segue "ficaram"; N = 1 -> "vídeo acompanhado"', () => {
    const a = { dispara: true, condicao: 'alvos_sem_leitura' as const, pctSemTitulo: 3, alvosSemLeitura: 1, alvosConsiderados: 5 }
    expect(textoDegradacao(a, false)).toBe("Leitura dos concorrentes degradada ontem: 1 de 5 vídeos acompanhados ficou sem nenhuma passagem com título. Os estados de título podem ficar 'não medido'. " + resto)
    expect(textoDegradacao({ ...a, alvosSemLeitura: 2 }, false)).toContain('2 de 5 vídeos acompanhados ficaram sem')
    expect(textoDegradacao({ ...a, alvosConsiderados: 1 }, false)).toContain('1 de 1 vídeo acompanhado ficou sem')
  })
  it('textoSuspenso literal do §6.2', () => {
    expect(textoSuspenso(5)).toBe('Leitura de título suspensa ontem em 5 vídeos: o mesmo título apareceu em vídeos diferentes (provável falha da página do YouTube). Nada foi gravado com esse título.')
    expect(textoSuspenso(1)).toContain('suspensa ontem em 1 vídeo:')
  })
})
