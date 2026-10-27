// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { planejarCanais, canalDevido, playlistsDevidas, calcularCiclo, playlistCoberta, ehRecuperavel, estimativaDeUnidades, MOTIVOS_RECUPERAVEIS, MOTIVOS_ESTRUTURAIS, type CanalParaPlanejar, type LinhaDeLeitura, type PlaylistDoCanal } from '@/lib/youtube/observatorio/playlists/planejar'
import { X3_RULES } from '@/lib/youtube/observatorio/playlists/regras'

const DIA = 86_400_000
const HORA = 3_600_000
/** 2026-03-20 15:00Z = 12:00 em São Paulo. */
const AGORA = Date.parse('2026-03-20T15:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()
const spDia = (ms: number) => new Date(ms - 3 * HORA).toISOString().slice(0, 10)

function leitura(o: Partial<LinhaDeLeitura> & { visitaHa?: number; cicloHa?: number | null }): LinhaDeLeitura {
  const visita = AGORA - (o.visitaHa ?? DIA)
  const ciclo = o.cicloHa === undefined ? visita : o.cicloHa === null ? null : AGORA - o.cicloHa
  return {
    last_visit_at: o.last_visit_at ?? iso(visita), last_visit_day: o.last_visit_day ?? spDia(visita), last_status: o.last_status ?? 'ok',
    last_reason: o.last_reason ?? null, last_cycle_at: o.last_cycle_at === undefined ? (ciclo === null ? null : iso(ciclo)) : o.last_cycle_at,
    first_visit_at: o.first_visit_at ?? iso(AGORA - 60 * DIA), playlists_left: o.playlists_left ?? 0,
  }
}
const canal = (id: string, l: LinhaDeLeitura | null, missing: string | null = null): CanalParaPlanejar => ({ id, missing_since: missing, leitura: l })
const plan = (canais: CanalParaPlanejar[], gasto = 0) => planejarCanais({ canais, agoraMs: AGORA, unidadesJaGastasHoje: gasto })

describe('X3 planejar: canal devido', () => {
  it('sem linha de leitura: devido, primeiro da fila', () => {
    const r = plan([canal('b', leitura({ visitaHa: 8 * DIA, cicloHa: 8 * DIA })), canal('a', null)])
    expect(r.devidos).toEqual(['a', 'b'])
  })
  it('volta há 6 dias e 23 h: não devido; há 7 dias: devido', () => {
    expect(canalDevido(leitura({ visitaHa: 6 * DIA + 23 * HORA }), AGORA)).toBe(false)
    expect(canalDevido(leitura({ visitaHa: 7 * DIA }), AGORA)).toBe(true)
  })
  it('parcial com motivo recuperável ontem e volta não fechada (last_cycle_at < last_visit_at): devido', () => {
    expect(canalDevido(leitura({ visitaHa: DIA, cicloHa: 3 * DIA, last_status: 'parcial', last_reason: 'lista_cortada' }), AGORA)).toBe(true)
  })
  it('J1/N1 e Yannis M-1: visita de ontem com o ciclo carimbado (p_ciclo) não é devida até 7 dias; com last_cycle_at há 2 dias e visita de ontem é devida', () => {
    expect(canalDevido(leitura({ visitaHa: DIA, cicloHa: DIA, last_status: 'parcial', last_reason: 'teto_itens' }), AGORA)).toBe(false)
    expect(canalDevido(leitura({ visitaHa: DIA, cicloHa: 2 * DIA, last_status: 'parcial', last_reason: 'teto_itens' }), AGORA)).toBe(true)
  })
  it('contagem_difere numa playlist não esconde o canal: devido amanhã se a volta não fechou; last_reason não é lido', () => {
    expect(canalDevido(leitura({ visitaHa: DIA, cicloHa: 2 * DIA, last_status: 'parcial', last_reason: 'contagem_difere', playlists_left: 3 }), AGORA)).toBe(true)
    expect(canalDevido(leitura({ visitaHa: DIA, cicloHa: DIA, last_status: 'parcial', last_reason: 'contagem_difere' }), AGORA)).toBe(false)
  })
  it('parcial hoje (mesmo dia de São Paulo): não devido; canal com missing_since sai', () => {
    expect(canalDevido(leitura({ visitaHa: HORA, cicloHa: 8 * DIA, last_status: 'parcial', last_reason: 'lista_cortada' }), AGORA)).toBe(false)
    expect(plan([canal('x', null, '2026-03-01')]).devidos).toEqual([])
  })
  it('virada do dia de São Paulo: 02:59Z ainda é o dia anterior, 03:00Z é o dia novo', () => {
    const visita = Date.parse('2026-03-20T02:30:00Z') // 23:30 de 19/03 em SP
    const l = leitura({ last_visit_at: iso(visita), last_visit_day: '2026-03-19', last_status: 'parcial', last_cycle_at: iso(visita - 8 * DIA) })
    expect(canalDevido(l, Date.parse('2026-03-20T02:59:00Z'))).toBe(false)
    expect(canalDevido(l, Date.parse('2026-03-20T03:00:00Z'))).toBe(true)
  })
  it('ordem: nunca vistos, depois last_visit_at mais antigo, desempate por id', () => {
    const r = plan([
      canal('d', leitura({ visitaHa: 8 * DIA, cicloHa: 8 * DIA })), canal('c', leitura({ visitaHa: 10 * DIA, cicloHa: 10 * DIA })),
      canal('b', leitura({ visitaHa: 8 * DIA, cicloHa: 8 * DIA })), canal('z', null), canal('y', null),
    ])
    expect(r.devidos).toEqual(['y', 'z', 'c', 'b', 'd'])
  })
})

describe('X3 planejar: alarme canais_sem_volta_14d (J4)', () => {
  it('conta coalesce(last_cycle_at, first_visit_at) com mais de 14 dias', () => {
    const r = plan([
      canal('a', leitura({ cicloHa: null, first_visit_at: iso(AGORA - 15 * DIA), visitaHa: HORA })),
      canal('b', leitura({ cicloHa: null, first_visit_at: iso(AGORA - 10 * DIA), visitaHa: HORA })),
      canal('c', leitura({ cicloHa: 20 * DIA, visitaHa: HORA })),
      canal('d', leitura({ cicloHa: 2 * DIA, visitaHa: DIA })),
      canal('e', null),
    ])
    expect(r.canaisSemVolta14d).toBe(2)
  })
})

describe('X3 planejar: teto do dia', () => {
  it('corta a lista quando unidadesJaGastasHoje + estimativa passa de unidadesPorDia', () => {
    const canais = Array.from({ length: 5 }, (_, i) => canal('c' + i, null))
    const est = estimativaDeUnidades(0)
    expect(est).toBe(12)
    const gasto = X3_RULES.unidadesPorDia - 2 * est
    const r = plan(canais, gasto)
    expect(r.devidos).toHaveLength(2)
    expect(r.cortadosPeloTeto).toBe(3)
    expect(plan(canais, 0).devidos).toHaveLength(5)
  })
  it('a estimativa nunca passa do teto por visita', () => {
    expect(estimativaDeUnidades(400)).toBe(X3_RULES.unidadesPorVisita)
  })
})

describe('X3 planejar: playlist devida', () => {
  const p = (id: string, o: Partial<PlaylistDoCanal> & { lidaHa?: number | null } = {}): PlaylistDoCanal => ({
    id, playlist_id: 'PL' + id, items_read_at: o.lidaHa === undefined || o.lidaHa === null ? (o.lidaHa === null ? null : iso(AGORA - 30 * DIA)) : iso(AGORA - o.lidaHa),
    items_status: o.items_status ?? 'ok', items_reason: o.items_reason ?? null, missing_since: o.missing_since ?? null,
  })
  it('lida há 3 dias é pulada; há 6 dias é devida; nunca lida é devida e vem primeiro', () => {
    const r = playlistsDevidas([p('a', { lidaHa: 3 * DIA }), p('b', { lidaHa: 6 * DIA }), p('c', { lidaHa: null }), p('d', { lidaHa: 9 * DIA })], AGORA)
    expect(r.map(x => x.id)).toEqual(['c', 'd', 'b'])
  })
  it('saida_em_massa_a_confirmar de ontem é devida; de hoje não', () => {
    const ontem = p('a', { lidaHa: 20 * HORA + 5 * HORA, items_status: 'parcial', items_reason: 'saida_em_massa_a_confirmar' }) // ontem em SP
    const hoje = p('b', { lidaHa: HORA, items_status: 'parcial', items_reason: 'saida_em_massa_a_confirmar' })
    expect(playlistsDevidas([ontem, hoje], AGORA).map(x => x.id)).toEqual(['a'])
  })
  it('estrutural (teto_itens) lida há 3 dias não é relida; recuperável (playlist_sumiu_no_meio, resposta_invalida) de ontem é', () => {
    const e = p('a', { lidaHa: 3 * DIA, items_status: 'parcial', items_reason: 'teto_itens' })
    const s = p('b', { lidaHa: 3 * DIA, items_status: 'erro', items_reason: 'playlist_sumiu_no_meio' })
    const r = p('c', { lidaHa: 3 * DIA, items_status: 'erro', items_reason: 'resposta_invalida' })
    expect(playlistsDevidas([e, s, r], AGORA).map(x => x.id)).toEqual(['b', 'c'])
  })
  it('Yannis M-2: playlist com missing_since nunca é devida', () => {
    expect(playlistsDevidas([p('a', { lidaHa: null, missing_since: '2026-03-01' }), p('b', { lidaHa: 30 * DIA, missing_since: '2026-03-01' })], AGORA)).toEqual([])
  })
})

describe('X3 planejar: calcularCiclo (J1 = N1)', () => {
  it('só com lista fechada, todas cobertas e nenhum motivo recuperável (cortes por playlist não vetam)', () => {
    const ok = { listaCompleta: true, todasCobertas: true }
    expect(calcularCiclo({ ...ok, motivos: [null, 'teto_itens', 'contagem_difere'] })).toBe(true)
    expect(calcularCiclo({ ...ok, motivos: ['lista_com_ocultas'] })).toBe(true)
    expect(calcularCiclo({ ...ok, motivos: ['teto_por_canal', 'sobrou', 'itens_cortados'] })).toBe(true)
    expect(calcularCiclo({ ...ok, todasCobertas: false, motivos: [] })).toBe(false)
    expect(calcularCiclo({ ...ok, listaCompleta: false, motivos: [] })).toBe(false)
    expect(calcularCiclo({ ...ok, motivos: ['contagem_difere', 'saida_em_massa_a_confirmar'] })).toBe(false)
    expect(calcularCiclo({ ...ok, motivos: ['lista_vazia_a_confirmar'] })).toBe(false)
    expect(calcularCiclo({ ...ok, motivos: ['teto_por_canal', 'api_falhou'] })).toBe(false)
  })
  it('playlistCoberta: lida depois do fecho anterior com ok ou estrutural', () => {
    const c = '2026-03-10T10:00:00Z'
    const base = { items_read_at: '2026-03-12T10:00:00Z', items_status: 'ok' as const, items_reason: null }
    expect(playlistCoberta(base, c)).toBe(true)
    expect(playlistCoberta({ ...base, items_read_at: '2026-03-10T10:00:00Z' }, c)).toBe(false)
    expect(playlistCoberta({ ...base, items_read_at: '2026-03-01T10:00:00Z' }, null)).toBe(true)
    expect(playlistCoberta({ ...base, items_read_at: null }, null)).toBe(false)
    expect(playlistCoberta({ ...base, items_status: 'parcial', items_reason: 'teto_itens' }, c)).toBe(true)
    expect(playlistCoberta({ ...base, items_status: 'parcial', items_reason: 'itens_cortados' }, c)).toBe(false)
    expect(playlistCoberta({ ...base, items_status: 'erro', items_reason: 'playlist_sumiu_no_meio' }, c)).toBe(false)
  })
  it('as duas listas de motivos não se cruzam e o recuperável é reconhecido', () => {
    for (const m of MOTIVOS_ESTRUTURAIS) expect(MOTIVOS_RECUPERAVEIS.has(m), m).toBe(false)
    expect(ehRecuperavel('playlist_sumiu_no_meio')).toBe(true)
    expect(ehRecuperavel('teto_itens')).toBe(false)
    expect(ehRecuperavel(null)).toBe(false)
  })
})
