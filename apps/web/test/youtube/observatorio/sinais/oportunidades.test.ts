import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CHAVES_CONTAGENS,
  calcularOportunidades,
  forcaDe,
  type EntradaDaForca,
  type EntradaDoNucleo,
  type OutlierProjetado,
  type ProprioProjetado,
} from '@/lib/youtube/observatorio/sinais/oportunidades'
import { REGRA_SINAIS, ruleVersionDe } from '@/lib/youtube/observatorio/sinais/regra'
import { tokensDe } from '@/lib/youtube/observatorio/sinais/tokens'
import { RULES } from '@/lib/youtube/observatorio/rules'

const AGORA = new Date('2026-10-22T12:00:00Z')
const diasAtras = (d: number): string => new Date(AGORA.getTime() - d * 86_400_000).toISOString()

function out(p: Partial<OutlierProjetado> & { videoId: string }): OutlierProjetado {
  return {
    canalId: 'c1',
    formato: 'long',
    publishedAt: diasAtras(2),
    mult: 4,
    multTela: 3,
    vpd7: 1000,
    nCanal: 20,
    chaves: ['pais:VN'],
    tokens: [],
    ...p,
  }
}
function prop(p: Partial<ProprioProjetado> & { videoId: string }): ProprioProjetado {
  return { formato: 'long', chaves: ['pais:VN'], tokens: [], ...p }
}
function ent(p: Partial<EntradaDoNucleo> = {}): EntradaDoNucleo {
  return {
    outliers: [],
    ancorasPorChave: new Map(),
    chavesAbertas: new Set(),
    proprios: [],
    canaisSemRitmo: 0,
    canaisTotal: 5,
    outliersSemLugar: 0,
    agora: AGORA,
    semente: 1,
    ...p,
  }
}
const A = out({ videoId: 'A', canalId: 'ca' })
const B = out({ videoId: 'B', canalId: 'cb' })

describe('regra', () => {
  it('multSozinho reaproveita RULES.tiers.high; rule_version', () => {
    expect(REGRA_SINAIS.multSozinho).toBe(RULES.tiers.high)
    expect(REGRA_SINAIS.sozinhoNotificaIndividual).toBe(false)
    expect(ruleVersionDe(3)).toBe('sinais-v1+semente-3')
  })
})

describe('tokensDe', () => {
  it('normaliza, tira stopwords, curtos e repetidos', () => {
    expect(tokensDe('Viagem para o Vietnã: the Vietnã é ótimo!').sort()).toEqual(['otimo', 'viagem', 'vietna'])
  })
})

describe('forcaDe', () => {
  it('exemplo do brief e idade', () => {
    expect(forcaDe({ mults: [4, 4], canais: 2, idadeDias: 0 })).toBe(6)
    expect(forcaDe({ mults: [4], canais: 1, idadeDias: 15 })).toBe(1)
    expect(forcaDe({ mults: [4], canais: 1, idadeDias: 60 })).toBe(0.4)
  })
  it('D20: tipos sem desempenho do próprio', () => {
    expectTypeOf<ProprioProjetado>().not.toHaveProperty('views')
    expectTypeOf<ProprioProjetado>().not.toHaveProperty('ctr')
    expectTypeOf<ProprioProjetado>().not.toHaveProperty('vpd7')
    expectTypeOf<ProprioProjetado>().not.toHaveProperty('nota')
    expectTypeOf<keyof EntradaDaForca>().toEqualTypeOf<'mults' | 'canais' | 'idadeDias'>()
  })
})

describe('destino', () => {
  it('2 outliers de 2 canais -> 1 destino individual com alvos dos próprios, ordenados por id', () => {
    const r = calcularOportunidades(
      ent({ outliers: [A, B], proprios: [prop({ videoId: 'z' }), prop({ videoId: 'a' }), prop({ videoId: 'x', chaves: ['pais:TH'] })] }),
    )
    expect(r.itens).toHaveLength(1)
    const d = r.itens[0]!
    expect(d).toMatchObject({ kind: 'destino', subjectKey: 'pais:VN', notificarComo: 'individual', acao: 'titulo_descricao', alvos: ['a', 'z'] })
    expect(d.motivo).toContain('v1')
    expect(d.motivo).toContain('2 canal')
    expect(d.motivo).toContain('semente 1')
    expect(d.motivo).toContain('vpd7 / mediana')
    expect(d.motivo).toContain('piso: vpd7 × 7')
    expect(d.motivo).toContain('pode ajudar')
    expect(d.evidence).toMatchObject({ outliers_total: 2, canais: 2, proprios: ['a', 'z'] })
    expect(r.motivoVazio).toBeNull()
  })
  it('sem próprio -> video_novo', () => {
    expect(calcularOportunidades(ent({ outliers: [A, B] })).itens[0]!.acao).toBe('video_novo')
  })
  it('2 outliers do mesmo canal -> nenhum', () => {
    const r = calcularOportunidades(ent({ outliers: [A, out({ videoId: 'A2', canalId: 'ca' })] }))
    expect(r.itens).toEqual([])
    expect(r.motivoVazio).toBe('sem-grupo')
  })
  it('1 outlier mult 6 -> destino em resumo; mult 4 -> nenhum', () => {
    const r = calcularOportunidades(ent({ outliers: [out({ videoId: 'S', mult: 6 })] }))
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]!.notificarComo).toBe('resumo')
    expect(calcularOportunidades(ent({ outliers: [out({ videoId: 'S', mult: 4 })] })).itens).toEqual([])
  })
  it('sozinhoNotificaIndividual em true vira individual', () => {
    const mut = REGRA_SINAIS as { sozinhoNotificaIndividual: boolean }
    mut.sozinhoNotificaIndividual = true
    try {
      const r = calcularOportunidades(ent({ outliers: [out({ videoId: 'S', mult: 6 })] }))
      expect(r.itens[0]!.notificarComo).toBe('individual')
    } finally {
      mut.sozinhoNotificaIndividual = false
    }
  })
  it('nCanal 7 -> nenhum e sem_n_minimo = 1', () => {
    const r = calcularOportunidades(ent({ outliers: [out({ videoId: 'S', mult: 9, nCanal: 7 })] }))
    expect(r.itens).toEqual([])
    expect(r.contagens.sem_n_minimo).toBe(1)
    expect(r.contagens.canais_sem_n_minimo).toBe(1)
    expect(r.motivoVazio).toBe('abaixo-do-minimo')
  })
  it('vpd7 x 7 = 1999 -> nenhum; 2000 passa', () => {
    const r = calcularOportunidades(ent({ outliers: [out({ videoId: 'S', mult: 9, vpd7: 1999 / 7 })] }))
    expect(r.itens).toEqual([])
    expect(r.contagens.abaixo_do_piso).toBe(1)
    expect(r.motivoVazio).toBe('abaixo-do-minimo')
    expect(calcularOportunidades(ent({ outliers: [out({ videoId: 'S', mult: 9, vpd7: 2000 / 7 })] })).itens).toHaveLength(1)
  })
  it('vistos há 5 dias + outro canal hoje -> destino; fora da janela de 14 d não conta', () => {
    const visto = out({ videoId: 'V', canalId: 'cv', publishedAt: diasAtras(5), deHoje: false })
    expect(calcularOportunidades(ent({ outliers: [visto, B] })).itens).toHaveLength(1)
    const velho = out({ videoId: 'V', canalId: 'cv', publishedAt: diasAtras(20), deHoje: false })
    expect(calcularOportunidades(ent({ outliers: [velho, B] })).itens).toEqual([])
  })
  it('âncora: dia 30 com A e B âncora -> nenhum; C novo mult >= 5 -> evento só com C', () => {
    const anc = new Map([['pais:VN', new Set(['A', 'B'])]])
    expect(calcularOportunidades(ent({ outliers: [A, B], ancorasPorChave: anc })).itens).toEqual([])
    const r0 = calcularOportunidades(ent({ outliers: [A, B], ancorasPorChave: anc }))
    expect(r0.motivoVazio).toBe('sem-grupo')
    expect(r0.contagens.outliers_ancora).toBe(2)
    const C = out({ videoId: 'C', canalId: 'cc', mult: 5 })
    const r = calcularOportunidades(ent({ outliers: [A, B, C], ancorasPorChave: anc }))
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]!.evidence.outliers.map((o) => o.video_id)).toEqual(['C'])
  })
  it('C que entrou no dia 10 é âncora no dia 31: nunca entra no evento novo', () => {
    const anc = new Map([['pais:VN', new Set(['A', 'B', 'C'])]])
    const D = out({ videoId: 'D', canalId: 'cd' })
    const r = calcularOportunidades(
      ent({ outliers: [A, B, out({ videoId: 'C', canalId: 'cc' }), D], ancorasPorChave: anc }),
    )
    expect(r.itens).toEqual([]) // D sozinho (mult 4) não forma evento
    const D6 = out({ videoId: 'D', canalId: 'cd', mult: 6 })
    const r2 = calcularOportunidades(
      ent({ outliers: [A, B, out({ videoId: 'C', canalId: 'cc' }), D6], ancorasPorChave: anc }),
    )
    expect(r2.itens[0]!.evidence.outliers.map((o) => o.video_id)).toEqual(['D'])
  })
  it('chave aberta atualiza com todos, âncoras inclusive', () => {
    const anc = new Map([['pais:VN', new Set(['A', 'B'])]])
    const r = calcularOportunidades(ent({ outliers: [A, B], ancorasPorChave: anc, chavesAbertas: new Set(['pais:VN']) }))
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]!.evidence.outliers_total).toBe(2)
  })
  it('evidence limita a 20 e conta o total', () => {
    const muitos = Array.from({ length: 25 }, (_, i) => out({ videoId: `v${i}`, canalId: `c${i}`, mult: 3 + i / 10 }))
    const d = calcularOportunidades(ent({ outliers: muitos })).itens[0]!
    expect(d.evidence.outliers).toHaveLength(20)
    expect(d.evidence.outliers_total).toBe(25)
  })
  it('D20: o próprio sendo o melhor ou o pior não muda os itens (nada de desempenho na entrada)', () => {
    const melhor = ent({ outliers: [A, B], proprios: [prop({ videoId: 'p' })] })
    const pior = ent({ outliers: [A, B], proprios: [prop({ videoId: 'p' })] })
    expect(calcularOportunidades(melhor).itens).toEqual(calcularOportunidades(pior).itens)
  })
})

describe('parecido', () => {
  const dez = (n: number, pre = 't'): string[] => Array.from({ length: n }, (_, i) => `${pre}${i}`)
  it('Jaccard 2/7 (0.29) -> nenhum; 4/13 (0.31) -> um, resumo', () => {
    const o = out({ videoId: 'O', chaves: [], tokens: ['a', 'b', 'x1', 'x2'] })
    const p1 = prop({ videoId: 'p1', chaves: [], tokens: ['a', 'b', 'y1', 'y2', 'y3'] })
    expect(calcularOportunidades(ent({ outliers: [o], proprios: [p1] })).itens).toEqual([])
    const o2 = out({ videoId: 'O', chaves: [], tokens: ['a', 'b', 'c', 'd', 'x1', 'x2', 'x3'] })
    const p2 = prop({ videoId: 'p2', chaves: [], tokens: ['a', 'b', 'c', 'd', ...dez(6, 'y')] })
    const r = calcularOportunidades(ent({ outliers: [o2], proprios: [p2] }))
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]).toMatchObject({ kind: 'parecido', subjectKey: 'outlier:O', notificarComo: 'resumo', alvos: ['p2'] })
    expect(r.itens[0]!.motivo).toContain('tema parecido, lugar diferente')
    expect(r.itens[0]!.motivo).toContain('v1')
  })
  const tk = ['a', 'b', 'c', 'd']
  it('mesmo lugar e mesmo tema; Short não casa long; formato null casa e avisa', () => {
    const o = out({ videoId: 'O', formato: 'short', tokens: tk })
    expect(calcularOportunidades(ent({ outliers: [o], proprios: [prop({ videoId: 'l', tokens: tk })] })).itens.filter((i) => i.kind === 'parecido')).toEqual([])
    const r = calcularOportunidades(ent({ outliers: [o], proprios: [prop({ videoId: 'n', formato: null, tokens: tk })] }))
    const p = r.itens.find((i) => i.kind === 'parecido')!
    expect(p.motivo).toContain('mesmo lugar e mesmo tema')
    expect(p.motivo).toContain('Formato não confirmado')
  })
  it('topParecidos e ordem por Jaccard', () => {
    const o = out({ videoId: 'O', chaves: [], tokens: tk })
    const ps = [
      prop({ videoId: 'p1', chaves: [], tokens: [...tk, 'z'] }),
      prop({ videoId: 'p2', chaves: [], tokens: tk }),
      prop({ videoId: 'p3', chaves: [], tokens: [...tk, 'z', 'w'] }),
      prop({ videoId: 'p4', chaves: [], tokens: [...tk, 'z', 'w', 'q'] }),
    ]
    expect(calcularOportunidades(ent({ outliers: [o], proprios: ps })).itens[0]!.alvos).toEqual(['p2', 'p1', 'p3'])
  })
  it('âncora = o próprio videoId não cria 2º evento; aberto atualiza; vistos não geram', () => {
    const o = out({ videoId: 'O', chaves: [], tokens: tk })
    const ps = [prop({ videoId: 'p', chaves: [], tokens: tk })]
    const anc = new Map([['outlier:O', new Set(['O'])]])
    expect(calcularOportunidades(ent({ outliers: [o], proprios: ps, ancorasPorChave: anc })).itens).toEqual([])
    expect(calcularOportunidades(ent({ outliers: [o], proprios: ps, ancorasPorChave: anc, chavesAbertas: new Set(['outlier:O']) })).itens).toHaveLength(1)
    expect(calcularOportunidades(ent({ outliers: [{ ...o, deHoje: false }], proprios: ps })).itens).toEqual([])
  })
})

describe('motivoVazio e contagens', () => {
  const casos: Array<[string, Partial<EntradaDoNucleo>, string]> = [
    ['histórico apagado', { canaisTotal: 0 }, 'sem-historico'],
    ['todos sem ritmo', { canaisSemRitmo: 5, outliers: [A] }, 'sync-atrasado'],
    ['zero outliers', {}, 'sem-terceiro-outlier'],
    ['todos sem chave', { outliers: [out({ videoId: 'A', chaves: [] })], outliersSemLugar: 1 }, 'sem-lugar'],
    ['todos abaixo do mínimo', { outliers: [out({ videoId: 'A', nCanal: 3 }), out({ videoId: 'B', vpd7: 10 })] }, 'abaixo-do-minimo'],
    ['âncora ou 1 canal', { outliers: [A, out({ videoId: 'A2', canalId: 'ca' })] }, 'sem-grupo'],
  ]
  for (const [nome, p, esperado] of casos) {
    it(`${nome} -> ${esperado}, com as 10 contagens inteiras`, () => {
      const r = calcularOportunidades(ent(p))
      expect(r.itens).toEqual([])
      expect(r.motivoVazio).toBe(esperado)
      for (const k of CHAVES_CONTAGENS) {
        expect(Number.isInteger(r.contagens[k])).toBe(true)
        expect(r.contagens[k]).toBeGreaterThanOrEqual(0)
      }
      expect(Object.keys(r.contagens).sort()).toEqual([...CHAVES_CONTAGENS].sort())
    })
  }
  it('com itens: motivoVazio nulo e contagens completas e coerentes', () => {
    const r = calcularOportunidades(ent({ outliers: [A, B, out({ videoId: 'N', chaves: [] })], outliersSemLugar: 1 }))
    expect(r.itens).toHaveLength(1)
    expect(r.motivoVazio).toBeNull()
    expect(Object.keys(r.contagens).sort()).toEqual([...CHAVES_CONTAGENS].sort())
    expect(r.contagens).toMatchObject({ outliers_total: 3, outliers_sem_lugar: 1, canais_com_outlier: 3, proprios: 0 })
  })
  it('propriedade: itens vazio => motivoVazio != null (combinações)', () => {
    const pool = [
      A, B,
      out({ videoId: 'x1', nCanal: 2 }),
      out({ videoId: 'x2', chaves: [] }),
      out({ videoId: 'x3', mult: 7, canalId: 'cz' }),
      out({ videoId: 'x4', publishedAt: diasAtras(25) }),
      out({ videoId: 'x5', vpd7: 5 }),
    ]
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      for (const total of [0, 3]) {
        for (const semRitmo of [0, 3]) {
          for (const anc of [false, true]) {
            const outliers = pool.filter((_, i) => mask & (1 << i))
            const r = calcularOportunidades(
              ent({
                outliers,
                canaisTotal: total,
                canaisSemRitmo: semRitmo,
                ancorasPorChave: anc ? new Map([['pais:VN', new Set(outliers.map((o) => o.videoId))]]) : new Map(),
              }),
            )
            if (r.itens.length === 0) expect(r.motivoVazio).not.toBeNull()
            else expect(r.motivoVazio).toBeNull()
          }
        }
      }
    }
  })
})
