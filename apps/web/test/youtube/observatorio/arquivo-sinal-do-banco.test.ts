// @vitest-environment node
/**
 * A5 · E10, Tarefa 2: o modelo puro do sinal de tamanho do banco (`arquivo/sinal-do-banco.ts`).
 * Nada aqui lê o relógio: o "agora" é fixo e toda série é montada em torno dele. As frases são conferidas letra por letra;
 * as bordas são conferidas no inteiro MOSTRADO (`pctDoLimite`), nunca nos MB.
 */
import { describe, it, expect } from 'vitest'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { LIMITE_FUNCAO_MS } from '@/lib/youtube/agenda/relogio'
import {
  diaDeLeitura, sinalDoBanco, fraseDeNuncaMedido, FRASE_BANCO_NAO_LIDO,
  type LinhaTamanho, type SinalDoBanco,
} from '@/lib/youtube/observatorio/arquivo/sinal-do-banco'

const MB = 1_048_576
const LIMITE_BYTES = RULES.dbSize.limitMb * MB
/** 12:00 em São Paulo; o dia de leitura é 13/10. */
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const HOJE = '2026-10-13'

const dia = (offset: number): string => new Date(Date.UTC(2026, 9, 13 + offset)).toISOString().slice(0, 10)

interface Partes { comp?: number; own?: number; compPorDia?: number; ownPorDia?: number }
/** Uma linha de `offset` dias a partir de hoje (0 = hoje, -1 = ontem). Tamanhos em MB; sem partes, tudo é "resto". */
function linha(offset: number, dbMb: number, p: Partes = {}): LinhaTamanho {
  return {
    day: dia(offset),
    db_bytes: Math.round(dbMb * MB),
    competitor_bytes: Math.round((p.comp ?? 0) * MB),
    own_bytes: Math.round((p.own ?? 0) * MB),
    measured_at: `${dia(offset)}T08:10:00.000Z`,
  }
}
/** `n` linhas diárias até hoje, crescendo `mbPorDia` por dia e terminando em `hojeMb`. */
function serie(n: number, hojeMb: number, mbPorDia: number, p: Partes = {}): LinhaTamanho[] {
  return Array.from({ length: n }, (_, i) => {
    const volta = n - 1 - i
    return linha(-volta, hojeMb - mbPorDia * volta, {
      comp: (p.comp ?? 0) - (p.compPorDia ?? 0) * volta,
      own: (p.own ?? 0) - (p.ownPorDia ?? 0) * volta,
    })
  })
}
const ler = (linhas: Parameters<typeof sinalDoBanco>[0]): SinalDoBanco => sinalDoBanco(linhas, AGORA)
const pct = (mb: number): number => Math.round((mb * 100) / RULES.dbSize.limitMb)

describe('A5 E10 T2: RULES e o amarre dos 6 minutos', () => {
  it('RULES.dbSize não tem mais limiar em MB (só percentual do limite)', () => {
    expect(RULES.dbSize.yellowPct).toBe(70)
    expect(RULES.dbSize.redPct).toBe(85)
    expect(RULES.dbSize.limitMb).toBe(500)
    expect('yellowMb' in RULES.dbSize).toBe(false)
    expect('redMb' in RULES.dbSize).toBe(false)
  })

  it('a espera de antes do export cobre um disparo inteiro da função (6 minutos > 300 s)', () => {
    expect(RULES.pause.minMinutesBeforeExport * 60_000).toBeGreaterThan(LIMITE_FUNCAO_MS)
  })

  it('as outras chaves da E10 existem com os valores do plano', () => {
    expect(RULES.archiveCutMonths).toBe(12)
    expect(RULES.pause).toEqual({ forgottenDays: 7, minMinutesBeforeExport: 6 })
    expect(RULES.archive).toEqual({ blobPendingAlertDays: 3, blobRetryMaxPerDay: 200, suggestionFreshDays: 7 })
  })
})

describe('A5 E10 T2: o dia de leitura', () => {
  it('04:59 de São Paulo ainda é ontem; 05:00 já é hoje', () => {
    expect(diaDeLeitura(Date.UTC(2026, 9, 13, 7, 59))).toBe('2026-10-12')
    expect(diaDeLeitura(Date.UTC(2026, 9, 13, 8, 0))).toBe(HOJE)
    // meia-noite de São Paulo (03:00 UTC) ainda é o dia anterior
    expect(diaDeLeitura(Date.UTC(2026, 9, 14, 3, 30))).toBe(HOJE)
  })

  it('a hora de início é parâmetro (sem padrão escondido: o padrão é RULES)', () => {
    expect(diaDeLeitura(Date.UTC(2026, 9, 13, 8, 0), 9)).toBe('2026-10-12')
    expect(diaDeLeitura(Date.UTC(2026, 9, 13, 12, 0), 9)).toBe(HOJE)
  })
})

describe('A5 E10 T2: estados', () => {
  it('tabela vazia: nunca_medido, sem cor, sem última, sem tela, frase curta (a função pura não promete data)', () => {
    const s = ler([])
    expect(s.estado).toBe('nunca_medido')
    expect(s.cor).toBeNull()
    expect(s.ultima).toBeNull()
    expect(s.tela).toBeNull()
    expect(s.horasSemMedida).toBeNull()
    expect(s.ilegiveis).toBe(0)
    expect(s.diaDeLeitura).toBe(HOJE)
    expect(s.frase).toBe('Ainda sem medida do tamanho do banco do site.')
    expect(s.projecao).toEqual({ estado: 'nao_medida', medidas: 0, minimo: 14, existeEm: dia(14) })
  })

  it('nunca medido: a data só é prometida com a medida agendada (o segundo argumento manda)', () => {
    expect(fraseDeNuncaMedido('2026-10-13', true))
      .toBe('Ainda sem medida do tamanho do banco do site. A primeira leitura é em 14/10, às 05:00. Antes disso não há dado.')
    const sem = fraseDeNuncaMedido('2026-10-13', false)
    expect(sem).toBe('Ainda sem medida do tamanho do banco do site.')
    expect(sem).not.toMatch(/primeira leitura|05:00/)
    // virada de mês e de ano
    expect(fraseDeNuncaMedido('2026-12-31', true)).toContain('em 01/01,')
  })

  it('sem a linha do dia: sem_leitura_hoje, cor nula (nunca verde), a última em percentual, horas sem medida', () => {
    const linhas = serie(10, 216, 0.2).slice(0, -1) // 9 linhas, a última é de ontem
    const s = ler(linhas)
    expect(s.estado).toBe('sem_leitura_hoje')
    expect(s.cor).toBeNull()
    expect(s.tela).toBeNull()
    expect(s.ultima?.day).toBe(dia(-1))
    expect(s.ultima?.pctDoLimite).toBe(pct(216 - 0.2))
    expect(s.horasSemMedida ?? 0).toBeGreaterThan(0)
    expect(s.frase).toBe(`Sem leitura do banco do site hoje. A medida das 05:00 não chegou; a última, de 12/10, foi ${pct(216 - 0.2)}% do limite.`)
  })

  it('sem a linha do dia, último nível amarelo: a cor continua amarela (e vermelha, se era vermelha)', () => {
    expect(ler([linha(-1, 360)]).cor).toBe('amarelo')
    expect(ler([linha(-1, 440)]).cor).toBe('vermelho')
    expect(ler([linha(-1, 360)]).tela).toBeNull()
  })

  it('apagar a linha do dia muda o veredito', () => {
    const com = serie(20, 216, 0.2)
    expect(ler(com).estado).toBe('medido')
    expect(ler(com).cor).toBe('verde')
    const sem = ler(com.slice(0, -1))
    expect(sem.estado).toBe('sem_leitura_hoje')
    expect(sem.cor).toBeNull()
  })

  it('só há linhas de outros dias ilegíveis: nunca_medido, e a contagem das ilegíveis fica', () => {
    const s = ler([{ ...linha(-3, 100), db_bytes: -1 }])
    expect(s.estado).toBe('nunca_medido')
    expect(s.ilegiveis).toBe(1)
    expect(s.cor).toBeNull()
  })

  it('a hora de antes das 05:00: a madrugada não acusa "sem leitura hoje" por engano', () => {
    const quatroECinquentaENove = Date.UTC(2026, 9, 13, 7, 59)
    const s = sinalDoBanco([linha(-1, 216)], quatroECinquentaENove)
    expect(s.diaDeLeitura).toBe(dia(-1))
    expect(s.estado).toBe('medido')
  })
})

describe('A5 E10 T2: cor e nível, no inteiro mostrado', () => {
  it('borda de 70% no inteiro mostrado (347 verde; 348 amarelo; 347,5 amarelo): a cor não vem dos MB', () => {
    const a = ler([linha(0, 347)])
    expect([a.tela?.pctDoLimite, a.cor, a.tela?.nivel]).toEqual([69, 'verde', 'com_folga'])
    const b = ler([linha(0, 348)])
    expect([b.tela?.pctDoLimite, b.cor, b.tela?.nivel]).toEqual([70, 'amarelo', 'enchendo'])
    const c = ler([linha(0, 347.5)])
    expect([c.tela?.pctDoLimite, c.cor]).toEqual([70, 'amarelo'])
  })

  it('borda de 85% no inteiro mostrado (422 amarelo; 423 vermelho quase_cheio)', () => {
    const a = ler([linha(0, 422)])
    expect([a.tela?.pctDoLimite, a.cor, a.tela?.nivel]).toEqual([84, 'amarelo', 'enchendo'])
    const b = ler([linha(0, 423)])
    expect([b.tela?.pctDoLimite, b.cor, b.tela?.nivel]).toEqual([85, 'vermelho', 'quase_cheio'])
  })

  it('borda do limite: acima vale pelos bytes, e o número mostrado continua o inteiro', () => {
    const base = (db: number): SinalDoBanco => ler([{ ...linha(0, 0), db_bytes: db }])
    const a = base(Math.round(499.9 * MB))
    expect([a.tela?.nivel, a.tela?.pctDoLimite, a.tela?.livrePct, a.tela?.passouPct]).toEqual(['quase_cheio', 100, 0, null])
    const b = base(LIMITE_BYTES)
    expect([b.tela?.nivel, b.tela?.pctDoLimite, b.tela?.livrePct, b.tela?.passouPct]).toEqual(['quase_cheio', 100, 0, null])
    const c = base(LIMITE_BYTES + 1)
    expect([c.tela?.nivel, c.tela?.pctDoLimite, c.tela?.livrePct, c.tela?.passouPct]).toEqual(['acima_do_limite', 100, null, 0])
    const d = base(Math.round(502 * MB))
    expect([d.tela?.nivel, d.tela?.pctDoLimite, d.tela?.livrePct, d.tela?.passouPct]).toEqual(['acima_do_limite', 100, null, 0])
    const e = base(Math.round(503 * MB))
    expect([e.tela?.nivel, e.tela?.pctDoLimite, e.tela?.livrePct, e.tela?.passouPct]).toEqual(['acima_do_limite', 101, null, 1])
    for (const s of [a, b, c, d, e]) expect(s.cor).toBe('vermelho')
  })

  it('501 MB com a reta parada: a frase não diz que não chega ao limite (nem que chega em algum mês)', () => {
    const parada501 = ler(serie(28, 501, 0))
    const subindo501 = ler(serie(28, 501, 0.2))
    const parada500 = ler([...serie(27, 500, 0).slice(0, -1).map(l => ({ ...l, db_bytes: LIMITE_BYTES })), { ...linha(0, 0), db_bytes: LIMITE_BYTES }])
    const subindo500 = ler(Array.from({ length: 28 }, (_, i) => ({ ...linha(-(27 - i), 0), db_bytes: LIMITE_BYTES - Math.round(0.2 * MB * (27 - i)) })))
    for (const s of [parada501, subindo501, parada500, subindo500]) {
      expect(s.frase).not.toMatch(/não chega ao limite|chega ao limite em/)
    }
    expect(parada501.frase).toBe('Banco do site acima do limite: 100% do limite.')
    expect(subindo501.frase).toBe('Banco do site acima do limite: 100% do limite.')
    expect(parada500.frase).toBe('Banco do site quase cheio: 100% do limite. Passou dos 85%.')
    expect(subindo500.frase).toBe('Banco do site quase cheio: 100% do limite. Passou dos 85%.')
    expect(subindo501.projecao).toMatchObject({ estado: 'medida', diasAteOLimite: 0 })
    expect(subindo500.projecao).toMatchObject({ estado: 'medida', diasAteOLimite: 0 })
  })

  it('já acima do limite: 510 MB e 521 MB', () => {
    const a = ler(serie(20, 510, 0.3))
    expect([a.cor, a.tela?.nivel, a.tela?.pctDoLimite, a.tela?.passouPct]).toEqual(['vermelho', 'acima_do_limite', 102, 2])
    expect(a.projecao).toMatchObject({ estado: 'medida', diasAteOLimite: 0 })
    const b = ler(serie(20, 521, 0.3))
    expect([b.cor, b.tela?.nivel, b.tela?.pctDoLimite, b.tela?.passouPct]).toEqual(['vermelho', 'acima_do_limite', 104, 4])
    expect(b.frase).toBe('Banco do site acima do limite: 104% do limite.')
  })

  it('borda de 90 dias (no inteiro arredondado): 89,4 dias é vermelho; 89,6 dias não é vermelho pela projeção', () => {
    const restante = RULES.dbSize.limitMb - 300 // 300 MB hoje = 60%
    const a = ler(serie(28, 300, restante / 89.4))
    expect(a.projecao).toMatchObject({ estado: 'medida', diasAteOLimite: 89 })
    expect([a.cor, a.tela?.nivel]).toEqual(['vermelho', 'enche_em_dias'])
    expect(a.frase).toBe('Banco do site enche em 89 dias: 60% do limite, no ritmo dos últimos 28 dias.')
    const b = ler(serie(28, 300, restante / 89.6))
    expect(b.projecao).toMatchObject({ estado: 'medida', diasAteOLimite: 90 })
    expect([b.cor, b.tela?.nivel]).toEqual(['verde', 'com_folga'])
  })

  it('os dias até o limite saem dos MB exatos, não do inteiro mostrado (79, não 81)', () => {
    const s = ler(serie(28, 392, 1.36))
    expect(s.projecao.estado).toBe('medida')
    if (s.projecao.estado !== 'medida') return
    expect(s.projecao.mbPorDia).toBeGreaterThan(1.355)
    expect(s.projecao.mbPorDia).toBeLessThan(1.365)
    expect(s.projecao.diasAteOLimite).toBe(79)
    expect(s.tela?.pctDoLimite).toBe(78)
    expect(s.tela?.nivel).toBe('enche_em_dias')
    expect(s.cor).toBe('vermelho')
  })
})

describe('A5 E10 T2: a projeção', () => {
  it('borda de 14 medidas: 13 linhas não medem; 14 medem', () => {
    const treze = ler(serie(13, 216, 0.2))
    expect(treze.projecao).toMatchObject({ estado: 'nao_medida', medidas: 13, minimo: 14 })
    const catorze = ler(serie(14, 216, 0.2))
    expect(catorze.projecao.estado).toBe('medida')
  })

  it('nao_medida diz quando a previsão passa a existir (dia de leitura + o que falta, uma leitura por dia)', () => {
    const s = ler(serie(6, 216, 0.2))
    expect(s.projecao).toEqual({ estado: 'nao_medida', medidas: 6, minimo: 14, existeEm: dia(8) })
  })

  it('linha fora da janela de 28 dias não entra na reta', () => {
    const recentes = serie(10, 216, 0.2)
    const antigas = Array.from({ length: 10 }, (_, i) => linha(-40 + i, 150 + i))
    const s = ler([...antigas, ...recentes])
    expect(s.projecao).toMatchObject({ estado: 'nao_medida', medidas: 10 })
  })

  it('reta parada ou descendo: sem_crescimento, e a cor vem só do tamanho', () => {
    const parada = ler(serie(28, 216, 0))
    expect(parada.projecao).toEqual({ estado: 'sem_crescimento' })
    expect(parada.cor).toBe('verde')
    const descendo = ler(serie(28, 440, -0.5))
    expect(descendo.projecao).toEqual({ estado: 'sem_crescimento' })
    expect([descendo.cor, descendo.tela?.nivel]).toEqual(['vermelho', 'quase_cheio'])
  })

  it('a projeção é medida com chegaEm (AAAA-MM) e chegaNoDia (AAAA-MM-DD) a partir do dia de leitura', () => {
    const s = ler(serie(28, 216, 284 / 1187))
    expect(s.projecao.estado).toBe('medida')
    if (s.projecao.estado !== 'medida') return
    expect(s.projecao.diasAteOLimite).toBe(1187)
    const esperado = dia(1187) // hoje + 1187 dias, pela mesma aritmética de dias do calendário (o mês escrito é conferido na frase)
    expect(s.projecao.chegaNoDia).toBe(esperado)
    expect(s.projecao.chegaEm).toBe(esperado.slice(0, 7))
  })
})

describe('A5 E10 T2: linhas ilegíveis', () => {
  it('valor nulo, negativo ou não numérico: a linha é ignorada e contada', () => {
    const boas = serie(20, 216, 0.2)
    const ruins = [
      { ...linha(-30, 100), db_bytes: -5 },
      { ...linha(-31, 100), db_bytes: Number.NaN },
      { ...linha(-32, 100), db_bytes: null },
      { ...linha(-33, 100), own_bytes: null },
      { ...linha(-34, 100), measured_at: 'não é data' },
    ]
    const s = ler([...ruins, ...boas])
    expect(s.ilegiveis).toBe(5)
    expect(s.estado).toBe('medido')
    expect(s.projecao.estado).toBe('medida')
    // a de hoje ilegível: sem_leitura_hoje, e a contagem fica
    const hojeRuim = ler([...boas.slice(0, -1), { ...linha(0, 216), db_bytes: -1 }])
    expect(hojeRuim.estado).toBe('sem_leitura_hoje')
    expect(hojeRuim.ilegiveis).toBe(1)
    expect(hojeRuim.tela).toBeNull()
  })

  it('linha em que as partes somam mais que o banco é ilegível', () => {
    const boas = serie(20, 216, 0.2)
    const ontemRuim = ler([...boas.slice(0, -2), { ...linha(-1, 100, { comp: 80, own: 40 }) }, boas[boas.length - 1]!])
    expect(ontemRuim.ilegiveis).toBe(1)
    expect(ontemRuim.estado).toBe('medido')
    expect(ontemRuim.projecao.estado).toBe('medida')
    expect(ontemRuim.tela?.cresceu).toMatchObject({ medidas: 19 }) // 20 linhas boas, menos a de ontem
    const partes = ontemRuim.tela?.doOcupado
    expect(partes && Object.values(partes).every(v => v >= 0)).toBe(true)
    const hojeRuim = ler([...boas.slice(0, -1), linha(0, 100, { comp: 80, own: 40 })])
    expect(hojeRuim.estado).toBe('sem_leitura_hoje')
    expect(hojeRuim.tela).toBeNull()
    expect(hojeRuim.ilegiveis).toBe(1)
    expect(hojeRuim.cor).not.toBe('verde')
  })

  it('linha de dia futuro (relógio adiantado de quem gravou) também é ignorada e contada', () => {
    const s = ler([...serie(20, 216, 0.2), linha(3, 300)])
    expect(s.ilegiveis).toBe(1)
    expect(s.ultima?.day).toBe(HOJE)
  })
})

describe('A5 E10 T2: as frases, letra por letra', () => {
  const casos: { nome: string; s: SinalDoBanco; frase: string }[] = [
    { nome: 'com_folga, projeção medida', s: ler(serie(28, 216, 284 / 1187)),
      frase: 'Banco do site com folga: 43% do limite. No ritmo dos últimos 28 dias, chega ao limite em jan/2030.' },
    { nome: 'enchendo', s: ler(serie(28, 360, 140 / 700)),
      frase: 'Banco do site enchendo: 72% do limite. No ritmo dos últimos 28 dias, chega ao limite em set/2028.' },
    { nome: 'quase_cheio', s: ler(serie(28, 440, 60 / 200)),
      frase: 'Banco do site quase cheio: 88% do limite. Passou dos 85%. No ritmo dos últimos 28 dias, chega ao limite em mai/2027.' },
    { nome: 'enche_em_dias', s: ler(serie(28, 390, 110 / 80.2)),
      frase: 'Banco do site enche em 80 dias: 78% do limite, no ritmo dos últimos 28 dias.' },
    { nome: 'acima_do_limite', s: ler(serie(20, 521, 0.3)),
      frase: 'Banco do site acima do limite: 104% do limite.' },
    { nome: 'sem_crescimento', s: ler(serie(28, 216, 0)),
      frase: 'Banco do site com folga: 43% do limite. Nos últimos 28 dias o banco não cresceu: nesse ritmo ele não chega ao limite.' },
    { nome: 'nao_medida', s: ler(serie(6, 216, 0.2)),
      frase: 'Banco do site com folga: 43% do limite. A previsão ainda não existe: há só 6 dias de leitura e são precisos 14.' },
    { nome: 'sem_leitura_hoje', s: ler(serie(10, 216, 0).slice(0, -1)),
      frase: 'Sem leitura do banco do site hoje. A medida das 05:00 não chegou; a última, de 12/10, foi 43% do limite.' },
    { nome: 'nunca_medido (com a medida agendada)', s: ler([]),
      frase: 'Ainda sem medida do tamanho do banco do site. A primeira leitura é em 14/10, às 05:00. Antes disso não há dado.' },
    { nome: 'sinal não lido', s: ler([]),
      frase: 'Não foi possível ler o tamanho do banco do site. O banco não respondeu, então nada indica que está tudo bem nem que está ruim.' },
  ]

  it('uma frase por estado, letra por letra', () => {
    for (const c of casos) {
      if (c.nome.startsWith('nunca_medido')) { expect(fraseDeNuncaMedido(c.s.diaDeLeitura, true), c.nome).toBe(c.frase); continue }
      if (c.nome === 'sinal não lido') { expect(FRASE_BANCO_NAO_LIDO).toBe(c.frase); continue }
      expect(c.s.frase, c.nome).toBe(c.frase)
    }
  })

  it('nenhuma frase contém "MB" nem "lote"', () => {
    for (const c of casos) {
      const frase = c.nome.startsWith('nunca_medido') ? fraseDeNuncaMedido(c.s.diaDeLeitura, true) : c.nome === 'sinal não lido' ? FRASE_BANCO_NAO_LIDO : c.s.frase
      expect(frase, c.nome).not.toMatch(/\bMB\b/)
      expect(frase, c.nome).not.toMatch(/\blotes?\b/i)
    }
    expect(fraseDeNuncaMedido(HOJE, false)).not.toMatch(/\bMB\b|\blotes?\b/i)
  })

  it('o singular de "dia": 1 dia de leitura e enche em 1 dia', () => {
    expect(ler([linha(0, 216)]).frase).toContain('há só 1 dia de leitura')
    expect(ler([linha(0, 216)]).frase).not.toContain('1 dias')
  })
})

describe('A5 E10 T2: o que a tela consome', () => {
  it('partes do ocupado somam 100 e o Observatório é a soma dos dois filhos', () => {
    const s = ler([linha(0, 216, { comp: 41, own: 88.6 })])
    expect(s.tela?.doOcupado).toEqual({ concorrentes: 19, seuCanal: 41, resto: 40, observatorio: 60 })
  })

  it('maior resto: três terços somam 100 (o ponto que sobra vai para a primeira da ordem)', () => {
    const tres = ler([{ day: HOJE, db_bytes: 300, competitor_bytes: 100, own_bytes: 100, measured_at: `${HOJE}T08:10:00.000Z` }])
    expect(tres.tela?.doOcupado).toEqual({ concorrentes: 34, seuCanal: 33, resto: 33, observatorio: 67 })
  })

  it('cresceu em 28 dias é a inclinação vezes 28, em percentual do limite com uma casa (e leva quantas medidas entraram)', () => {
    const s = ler(serie(14, 216, 0.24))
    expect(s.tela?.cresceu).toEqual({ estado: 'medido', pctDoLimite: 1.3, medidas: 14 })
    expect(s.tela?.mb.cresceu28d).toBeCloseTo(6.7, 1)
    expect(s.tela?.mb.porDia).toBeCloseTo(0.24, 3)
  })

  it('cresceu com 28 medidas; crescimento abaixo de uma casa não é zero medido; reta parada é zero medido', () => {
    expect(ler(serie(28, 216, 0.24)).tela?.cresceu).toEqual({ estado: 'medido', pctDoLimite: 1.3, medidas: 28 })
    const pouco = ler(serie(28, 216, 0.005))
    expect(pouco.projecao.estado).toBe('medida')
    expect(pouco.tela?.cresceu).toEqual({ estado: 'menos_de_um_decimo', medidas: 28 })
    expect(ler(serie(28, 216, 0)).tela?.cresceu).toEqual({ estado: 'zero_medido' })
    expect(ler(serie(10, 216, 0.2)).tela?.cresceu).toEqual({ estado: 'nao_medido' })
  })

  it('do crescimento só existe com crescimento medido', () => {
    expect(ler(serie(28, 216, 0, { comp: 40, own: 80 })).tela?.doCrescimento).toEqual({ estado: 'zero_medido' })
    expect(ler(serie(13, 216, 0.3, { comp: 40, own: 80, compPorDia: 0.1, ownPorDia: 0.1 })).tela?.doCrescimento).toEqual({ estado: 'nao_medido' })
    // a parte de concorrentes encolhe (-0,1 por dia) enquanto o total sobe (+0,3 por dia)
    const enc = ler(serie(28, 216, 0.3, { comp: 40, own: 80, compPorDia: -0.1, ownPorDia: 0.2 }))
    expect(enc.tela?.doCrescimento).toEqual({ estado: 'parte_encolheu' })
    expect(enc.tela?.mb.cresceuPorParte?.concorrentes ?? 0).toBeLessThan(0)
    expect(JSON.stringify(enc.tela?.doCrescimento)).not.toMatch(/\d/)
  })

  it('do crescimento com números: as partes saem das inclinações, não do ocupado', () => {
    const s = ler(serie(28, 216, 6.7 / 28, { comp: 41.3, own: 88.1, compPorDia: 2.9 / 28, ownPorDia: 2.1 / 28 }))
    expect(s.tela?.doOcupado).toEqual({ concorrentes: 19, seuCanal: 41, resto: 40, observatorio: 60 })
    expect(s.tela?.doCrescimento).toEqual({ estado: 'medido', partes: { concorrentes: 43, seuCanal: 31, resto: 26, observatorio: 74 } })
  })

  it('os MB aparecem só em tela.mb e em ultima; amarelo e vermelho em MB são a tradução dos percentuais (350 e 425)', () => {
    const s = ler(serie(28, 216, 0.24, { comp: 41, own: 88.6 }))
    expect(s.tela?.mb.limite).toBe(500)
    expect(s.tela?.mb.amareloEm).toBe(350)
    expect(s.tela?.mb.vermelhoEm).toBe(425)
    expect(s.tela?.mb.hoje).toBeCloseTo(216, 1)
    expect(s.ultima).toMatchObject({ day: HOJE, pctDoLimite: 43 })
    expect(s.ultima?.dbMb).toBeCloseTo(216, 1)
    expect((s.ultima?.competitorMb ?? 0) + (s.ultima?.ownMb ?? 0) + (s.ultima?.restoMb ?? 0)).toBeCloseTo(216, 1)
  })

  it('sem a linha do dia: tela nula, com a última em percentual', () => {
    const s = ler(serie(11, 216, 0).slice(0, -1))
    expect(s.tela).toBeNull()
    expect(s.ultima?.pctDoLimite).toBe(43)
  })

  it('livrePct e passouPct: 100 menos o inteiro; acima do limite, livrePct nulo e passouPct o excedente', () => {
    const a = ler([linha(0, 216)])
    expect([a.tela?.livrePct, a.tela?.passouPct]).toEqual([57, null])
    const b = ler([linha(0, 521)])
    expect([b.tela?.livrePct, b.tela?.passouPct]).toEqual([null, 4])
  })
})
