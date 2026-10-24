// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  LinhaDiaPlacarSchema,
  COLUNAS_DO_PLACAR,
  diaComAlcanceValido,
  diaValido,
  diaPt,
  placarDoTeste,
  faixaDeDias,
  type LinhaDiaPlacar,
} from '@/lib/youtube/ab-gravacao/placar'

const AGORA = new Date('2026-10-24T10:00:00Z')
const H = 3_600_000
const ha = (horas: number, base: Date = AGORA) => new Date(base.getTime() - horas * H).toISOString()

function dia(p: Partial<LinhaDiaPlacar> = {}): LinhaDiaPlacar {
  return {
    test_id: 't1', day_pt: '2026-10-20', site_id: 's1',
    variant_id: 'A', motivo_sem_variante: null,
    alcance_estado: 'medido', impressoes: 1000, ctr: 0.05,
    views: null, views_estado: 'nao_medido',
    retratado_em: ha(1), final: false,
    ...p,
  }
}
const VARS = [{ variant_id: 'A' }, { variant_id: 'B' }]
function placar(dias: LinhaDiaPlacar[], extra: Partial<Parameters<typeof placarDoTeste>[0]> = {}) {
  return placarDoTeste({
    dias, variantes: VARS, regra: 'v1', agora: AGORA,
    inicio: ha(24 * 10), fim: null, status: 'active', ...extra,
  })
}
const varA = (dias: LinhaDiaPlacar[], extra = {}) => placar(dias, extra).variantes[0]

describe('placar puro (S8-F3 T1)', () => {
  it('1. diaComAlcanceValido e diaValido', () => {
    expect(diaComAlcanceValido({ alcance_estado: 'medido', impressoes: 100, ctr: 0.05 })).toBe(true)
    expect(diaComAlcanceValido({ alcance_estado: 'medido', impressoes: 0, ctr: 0 })).toBe(false)
    expect(diaComAlcanceValido({ alcance_estado: 'medido', impressoes: 5000, ctr: null })).toBe(false)
    expect(diaComAlcanceValido({ alcance_estado: 'zero_medido', impressoes: null, ctr: null })).toBe(false)
    expect(diaComAlcanceValido({ alcance_estado: 'aguardando', impressoes: null, ctr: null })).toBe(false)
    expect(diaValido({ alcance_estado: 'medido', impressoes: 100, ctr: 0.05, variant_id: 'A' })).toBe(true)
    expect(diaValido({ alcance_estado: 'medido', impressoes: 100, ctr: 0.05, variant_id: null })).toBe(false)
  })

  it('2. dia sem CTR não entra na taxa (C-20)', () => {
    const tres = [1, 2, 3].map(i => dia({ day_pt: `2026-10-1${i}` }))
    const com = varA([...tres, dia({ day_pt: '2026-10-14', impressoes: 5000, ctr: null })])
    const sem = varA(tres)
    expect(com.ctr).toBeCloseTo(0.05, 10)
    expect(com.cliques).toBe(150)
    expect(com.impressoes_com_ctr).toBe(3000)
    expect(com.impressoes).toBe(8000)
    expect(com.dias_fora_do_ctr).toBe(1)
    expect([sem.ctr, sem.cliques, sem.impressoes_com_ctr]).toEqual([com.ctr, com.cliques, com.impressoes_com_ctr])
  })

  it('2b. só dia sem CTR: cliques nulo, não 0', () => {
    const v = varA([dia({ impressoes: 5000, ctr: null })])
    expect(v.impressoes).toBe(5000)
    expect(v.impressoes_com_ctr).toBe(0)
    expect(v.cliques).toBeNull()
    expect(v.ctr).toBeNull()
    expect(v.dias_fora_do_ctr).toBe(1)
  })

  it('3. ponderado, não média de médias', () => {
    const v = varA([dia({ day_pt: '2026-10-10', impressoes: 1000, ctr: 0.1 }), dia({ day_pt: '2026-10-11', impressoes: 3000, ctr: 0.02 })])
    expect(v.cliques).toBe(160)
    expect(v.ctr).toBeCloseTo(0.04, 10)
  })

  it('4. arredonda por dia', () => {
    expect(varA([dia({ impressoes: 333, ctr: 0.0415 })]).cliques).toBe(14)
  })

  it('5. estados (§3) e contadores', () => {
    const v = varA([
      dia({ day_pt: '2026-10-10' }),
      dia({ day_pt: '2026-10-11', alcance_estado: 'zero_medido', impressoes: null, ctr: null }),
      dia({ day_pt: '2026-10-12', alcance_estado: 'ausente_no_relatorio', impressoes: null, ctr: null }),
      dia({ day_pt: '2026-10-13', alcance_estado: 'aguardando', impressoes: null, ctr: null }),
      dia({ day_pt: '2026-10-14', alcance_estado: 'nao_medido', impressoes: null, ctr: null }),
    ])
    expect(v.impressoes).toBe(1000)
    expect(v.dias_zero).toBe(2)
    expect(v.dias_ausentes).toBe(1)
    expect(v.dias_aguardando).toBe(1)
    expect(v.dias_nao_medidos).toBe(1)
    expect(v.dias_validos).toBe(1)
    expect(v.dias).toBe(5)
  })

  it('6. nulo não vira 0', () => {
    const nulo = varA([
      dia({ day_pt: '2026-10-10', alcance_estado: 'aguardando', impressoes: null, ctr: null }),
      dia({ day_pt: '2026-10-11', alcance_estado: 'nao_medido', impressoes: null, ctr: null }),
    ])
    expect([nulo.impressoes, nulo.impressoes_com_ctr, nulo.cliques, nulo.ctr, nulo.views]).toEqual([null, null, null, null, null])
    const zero = varA([dia({ alcance_estado: 'zero_medido', impressoes: null, ctr: null })])
    expect([zero.impressoes, zero.impressoes_com_ctr, zero.cliques, zero.ctr]).toEqual([0, 0, 0, null])
    const semCtr = varA([dia({ impressoes: 5000, ctr: null })])
    expect([semCtr.impressoes_com_ctr, semCtr.cliques]).toEqual([0, null])
    const medidoZero = varA([dia({ impressoes: 0, ctr: 0 })])
    expect(medidoZero.cliques).toBe(0)
    expect(medidoZero.impressoes).toBe(0)
  })

  it('7. descartado e variante desconhecida', () => {
    const p = placar([
      dia({ day_pt: '2026-10-10', variant_id: null, motivo_sem_variante: 'menos_de_90' }),
      dia({ day_pt: '2026-10-11', variant_id: null, motivo_sem_variante: 'meta_ausente' }),
      dia({ day_pt: '2026-10-12', variant_id: 'v-x' }),
      dia({ day_pt: '2026-10-13' }),
    ])
    expect(p.dias_descartados).toBe(2)
    expect(p.dias_variante_desconhecida).toBe(1)
    expect(p.variantes[0].dias).toBe(1)
    expect(p.variantes[1].dias).toBe(0)
    expect(p.dias_total).toBe(4)
  })

  it('8. views', () => {
    const v = varA([
      dia({ day_pt: '2026-10-10', views: 120, views_estado: 'medido' }),
      dia({ day_pt: '2026-10-11', views: null, views_estado: 'zero_medido' }),
      dia({ day_pt: '2026-10-12', views: null, views_estado: 'nao_medido' }),
    ])
    expect(v.views).toBe(120)
    expect(varA([dia({ views: null, views_estado: 'nao_medido' })]).views).toBeNull()
  })

  it('9. atualizado, desatualizado, todos_finais', () => {
    const p27 = placar([dia({ retratado_em: ha(27) })])
    expect(p27.desatualizado).toBe(true)
    expect(p27.atualizado_em).toBe(ha(27))
    const final27 = placar([dia({ retratado_em: ha(27), final: true })])
    expect(final27.desatualizado).toBe(false)
    expect(final27.todos_finais).toBe(true)
    expect(placar([dia({ retratado_em: ha(25) })]).desatualizado).toBe(false)
    const vazio = placar([], { inicio: ha(20) })
    expect(vazio.todos_finais).toBe(false)
    expect(vazio.atualizado_em).toBeNull()
    expect(vazio.desatualizado).toBe(false)
    expect(vazio.atrasado).toBe(false)
    expect(vazio.dias_total).toBe(0)
    expect(vazio.variantes.every(v => v.dias === 0)).toBe(true)
  })

  it('9c. pausado: o limite é paused_at (sem alarme falso durante a pausa)', () => {
    const tarde = new Date('2026-10-24T15:00:00Z')
    const pausadoEm = '2026-10-17T12:00:00Z'
    const ate17 = [dia({ day_pt: '2026-10-15' }), dia({ day_pt: '2026-10-16' }), dia({ day_pt: '2026-10-17' })]
    const ate14 = [dia({ day_pt: '2026-10-12' }), dia({ day_pt: '2026-10-13' }), dia({ day_pt: '2026-10-14' })]
    expect(placar(ate17, { status: 'paused', pausado_em: pausadoEm, agora: tarde }).atrasado).toBe(false)
    expect(placar(ate14, { status: 'paused', pausado_em: pausadoEm, agora: tarde }).atrasado).toBe(true)
    // retomado: ativo ignora paused_at antigo
    expect(placar(ate17, { status: 'active', pausado_em: pausadoEm, agora: tarde }).atrasado).toBe(true)
  })

  it('9b. atrasado', () => {
    expect(placar([], { inicio: ha(49) }).atrasado).toBe(true)
    expect(placar([], { inicio: ha(20) }).atrasado).toBe(false)
    const manha = new Date('2026-10-24T10:00:00Z')
    const tarde = new Date('2026-10-24T15:00:00Z')
    const d20 = [dia({ day_pt: '2026-10-20' })]
    const d21 = [dia({ day_pt: '2026-10-21' })]
    expect(placar(d20, { agora: manha }).atrasado).toBe(true)
    expect(placar(d20, { agora: tarde }).atrasado).toBe(true)
    expect(placar(d21, { agora: manha }).atrasado).toBe(false)
    expect(placar(d21, { agora: tarde }).atrasado).toBe(true)
    // encerrado: o min com diaPt(fim)
    const fim = ha(24 * 5)
    const diaFim = diaPt(new Date(fim))
    const tardeFim = new Date('2026-10-24T15:00:00Z')
    const atFim = (dp: string) => placar([dia({ day_pt: dp }), dia({ day_pt: '2026-10-01', final: true })], { status: 'completed', fim, agora: tardeFim })
    expect(atFim(diaFim).atrasado).toBe(false)
    const tres = new Date(Date.UTC(+diaFim.slice(0, 4), +diaFim.slice(5, 7) - 1, +diaFim.slice(8, 10) - 3)).toISOString().slice(0, 10)
    expect(atFim(tres).atrasado).toBe(true)
    // concluído há 12 dias, tudo final
    expect(placar([dia({ day_pt: '2026-09-01', final: true })], { status: 'completed', fim: ha(24 * 12), agora: tardeFim }).atrasado).toBe(false)
    // virada de horário de verão
    expect(diaPt(new Date('2026-03-08T09:59:00Z'))).toBe('2026-03-08')
    expect(diaPt(new Date('2026-03-08T07:30:00Z'))).toBe('2026-03-07')
    expect(diaPt(new Date('2026-11-01T08:30:00Z'))).toBe('2026-11-01')
    expect(diaPt(new Date('2026-11-01T07:59:00Z'))).toBe('2026-11-01')
    expect(diaPt(new Date('2026-11-01T06:59:00Z'))).toBe('2026-10-31')
  })

  it('10. schema (numeric como texto, ausência não vira dado)', () => {
    const base = { ...dia() } as Record<string, unknown>
    const ok = (p: Record<string, unknown>) => LinhaDiaPlacarSchema.safeParse({ ...base, ...p })
    const r = ok({ ctr: '0.0412', impressoes: '1200' })
    expect(r.success && r.data.ctr).toBe(0.0412)
    expect(r.success && r.data.impressoes).toBe(1200)
    const n = ok({ ctr: null })
    expect(n.success && n.data.ctr).toBeNull()
    for (const ctr of ['abc', '', ' ', 4.12, -0.1]) expect(ok({ ctr }).success).toBe(false)
    expect(ok({ impressoes: true }).success).toBe(false)
    expect(ok({ impressoes: '12.5' }).success).toBe(false)
    const { ctr: _ctr, ...semCtr } = base
    expect(LinhaDiaPlacarSchema.safeParse(semCtr).success).toBe(false)
    expect(ok({ extra: 1 }).success).toBe(false)
    expect(ok({ alcance_estado: 'outro' }).success).toBe(false)
    expect(COLUNAS_DO_PLACAR.split(',').length).toBe(12)
  })

  it('11. ordem, regra e estatística', () => {
    const p = placar([dia()], { regra: 'v2', variantes: [{ variant_id: 'B' }, { variant_id: 'A' }] })
    expect(p.variantes.map(v => v.variant_id)).toEqual(['B', 'A'])
    expect(p.regra).toBe('v2')
    expect(p.estatistica).toBe('nao_calculada')
  })

  const semente5 = () => [
    dia({ day_pt: '2026-10-10' }),
    dia({ day_pt: '2026-10-11', alcance_estado: 'zero_medido', impressoes: null, ctr: null }),
    dia({ day_pt: '2026-10-12', alcance_estado: 'ausente_no_relatorio', impressoes: null, ctr: null }),
    dia({ day_pt: '2026-10-13', alcance_estado: 'aguardando', impressoes: null, ctr: null }),
    dia({ day_pt: '2026-10-14', alcance_estado: 'nao_medido', impressoes: null, ctr: null }),
  ]

  it('12. faixaDeDias', () => {
    const dias = [
      ...semente5().reverse(),
      dia({ day_pt: '2026-10-08', variant_id: null, motivo_sem_variante: 'menos_de_90', impressoes: null, ctr: null }),
      dia({ day_pt: '2026-10-09', variant_id: 'v-x' }),
    ]
    const f = faixaDeDias({ dias, variantes: VARS, agora: AGORA })
    expect(f).toHaveLength(7)
    expect(f.map(i => i.day_pt)).toEqual([...f.map(i => i.day_pt)].sort())
    const fora = f.filter(i => i.estado === 'fora_do_placar')
    expect(fora.every(i => i.motivo !== null)).toBe(true)
    expect(f.find(i => i.estado === 'aguardando')?.impressoes).toBeNull()
    const p = placarDoTeste({ dias, variantes: VARS, regra: 'v1', agora: AGORA, inicio: ha(240), fim: null, status: 'active' })
    expect(fora.length).toBe(p.dias_descartados + p.dias_variante_desconhecida)
    expect(fora.find(i => i.variante === 'v-x')?.motivo).toBe('variante_desconhecida')
  })

  it('13. proximo_fechamento', () => {
    const ag = (d: string) => dia({ day_pt: d, alcance_estado: 'aguardando', impressoes: null, ctr: null })
    expect(placar([ag('2026-10-22'), ag('2026-10-20')]).proximo_fechamento).toBe('2026-10-31')
    expect(placar([dia()]).proximo_fechamento).toBeNull()
  })

  it('14. iniciado e dias_ausentes', () => {
    const sem = placar([], { inicio: null })
    expect(sem.iniciado).toBe(false)
    expect(sem.atrasado).toBe(false)
    expect(placar([], { inicio: ha(1) }).iniciado).toBe(true)
    const v = varA(semente5())
    expect(v.dias_ausentes).toBe(1)
    expect(v.dias_zero).toBe(2)
  })

  it('15. dia medido sem impressões conta como não medido (Yannis 6)', () => {
    const v = varA([dia(), dia({ day_pt: '2026-10-21', impressoes: null, ctr: null })])
    expect(v.dias_nao_medidos).toBe(1)
    expect(v.impressoes).toBe(1000)
    expect(v.dias_zero).toBe(0)
    expect(v.dias_validos + v.dias_zero + v.dias_fora_do_ctr + v.dias_aguardando + v.dias_nao_medidos + v.dias_ausentes).toBe(v.dias)
  })
})
