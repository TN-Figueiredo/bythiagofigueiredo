// Banco falso único da P4a para rotação, saída e duração máxima (extraído de ab-rotate-reivindicacao.test.ts na T8):
// ab_tests (com variants), ab_test_variants, ab_test_cycles, ab_test_polls, youtube_videos, ops_alert_state e as rpc
// ab_settle_claim / ab_rotate_commit / ops_alert_claim, com a semântica do SQL (guarda por restore_seq e por status).
import type { SupabaseClient } from '@supabase/supabase-js'
import { H, imagemComDhash } from './youtube-falso'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

/** Cliente que `getSupabaseServiceClient()` devolve nos testes que o mockam por `servicoAtual.cliente`. */
export const servicoAtual: { cliente: unknown } = { cliente: null }

export const BLOB = (id: string) => `https://abc.public.blob.vercel-storage.com/${id}.jpg`
export const AGORA = new Date('2026-10-12T15:00:00.000Z')
export const ONTEM = '2026-10-11T15:00:00.000Z'
export const SITE = 'site-1'
export const IMG = { A: await imagemComDhash(H.A), B: await imagemComDhash(H.B) }

export type Fila = Record<string, unknown>

// ---------------------------------------------------------------------------
// Banco falso: ab_tests (com variants), ab_test_variants, ab_test_cycles, ab_test_polls, youtube_videos,
// ops_alert_state e as rpc ab_settle_claim / ab_rotate_commit / ops_alert_claim, com a semântica do SQL.
// ---------------------------------------------------------------------------
class Consulta implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filtros: Array<(f: Fila) => boolean> = []
  private modo: 'select' | 'update' = 'select'
  private patch: Fila = {}
  private ordenar: { col: string; asc: boolean } | null = null
  private limite = Infinity
  private contar = false
  constructor(private readonly linhas: Fila[], private readonly aoReler: () => void, private readonly unir?: (f: Fila) => Fila) {}
  select(cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.modo === 'select' && cols === 'restore_seq') this.aoReler()
    if (o?.count) this.contar = true
    return this
  }
  update(patch: Fila) { this.modo = 'update'; this.patch = patch; return this }
  eq(col: string, v: unknown) { this.filtros.push((f) => f[col] === v); return this }
  is(col: string, v: unknown) { this.filtros.push((f) => (f[col] ?? null) === v); return this }
  lt(col: string, v: string) { this.filtros.push((f) => String(f[col]) < v); return this }
  gte(col: string, v: string) { this.filtros.push((f) => String(f[col]) >= v); return this }
  not(col: string, _op: string, v: unknown) { this.filtros.push((f) => (f[col] ?? null) !== v); return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordenar = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.limite = n; return this }
  private executar(): Fila[] {
    let hit = this.linhas.filter((f) => this.filtros.every((g) => g(f)))
    if (this.modo === 'update') hit.forEach((f) => Object.assign(f, this.patch))
    if (this.ordenar) { const { col, asc } = this.ordenar; hit = [...hit].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)) }
    return hit.slice(0, this.limite).map((f) => structuredClone(this.unir ? this.unir(f) : f))
  }
  single() { const h = this.executar(); return Promise.resolve(h[0] ? { data: h[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'sem linha' } }) }
  maybeSingle() { return Promise.resolve({ data: this.executar()[0] ?? null, error: null }) }
  then<R1, R2>(ok?: ((v: { data: unknown; error: unknown; count?: number }) => R1 | PromiseLike<R1>) | null, ko?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
    const h = this.executar()
    return Promise.resolve(this.contar ? { data: null, error: null, count: h.length } : { data: h, error: null }).then(ok, ko)
  }
}

export interface OpcoesBanco { testType?: 'thumbnail' | 'title' | 'combo'; restoreSeq?: number; marcador?: string | null; config?: Fila; atualizadoHaMs?: number; diasNoAr?: number; ajustar?: (variantes: Fila[]) => void; ciclosFechados?: number }

export function criarBanco(o: OpcoesBanco = {}) {
  const teste: Fila = {
    id: 'teste-1', site_id: SITE, name: 'Teste do Lab', test_type: o.testType ?? 'thumbnail', status: 'active', restore_seq: o.restoreSeq ?? 0,
    restore_status: null, original_title: 'Título A', original_thumbnail_url: BLOB('A'), last_applied_variant_id: o.marcador ?? null,
    youtube_video_id: 'video-interno', config: o.config ?? { rotation_pattern: 'abba' }, winner_variant_id: null, winner_applied_at: null,
    revert_expires_at: null, status_note: null, paused_at: null, completed_at: null, completed_reason: null, applied_by: null,
    updated_at: new Date(AGORA.getTime() - (o.atualizadoHaMs ?? 600_000)).toISOString(),
    started_at: new Date(AGORA.getTime() - (o.diasNoAr ?? 3) * 86_400_000).toISOString(),
    created_at: new Date(AGORA.getTime() - (o.diasNoAr ?? 3) * 86_400_000).toISOString(),
  }
  const variantes: Fila[] = [
    { id: 'A', test_id: 'teste-1', sort_order: 0, is_original: true, blob_url: BLOB('A'), title_text: 'Título A', thumbnail_dhash: H.A },
    { id: 'B', test_id: 'teste-1', sort_order: 1, is_original: false, blob_url: BLOB('B'), title_text: 'Título B', thumbnail_dhash: H.B },
  ]
  o.ajustar?.(variantes)
  const tabelas: Record<string, Fila[]> = {
    ab_tests: [teste], ab_test_variants: variantes,
    ab_test_cycles: [{ id: 'c0', test_id: 'teste-1', cycle_number: 0, variant_id: 'A', started_at: ONTEM, ended_at: null, end_reason: null }],
    ab_test_polls: [], youtube_videos: [{ id: 'video-interno', site_id: SITE, youtube_video_id: 'yt-1', channel_id: 'ch-1', youtube_channels: { channel_id: 'UC1', name: 'Canal' } }],
    ops_alert_state: [],
  }
  for (let i = 0; i < (o.ciclosFechados ?? 0); i++) tabelas.ab_test_cycles!.unshift({ id: `f${i}`, test_id: 'teste-1', cycle_number: -1 - i, variant_id: 'A', started_at: ONTEM, ended_at: ONTEM, end_reason: 'rotacao' })
  const ganchos: Array<() => void> = []
  let ciclo = 0
  const t = () => tabelas.ab_tests[0] as Fila & { restore_seq: number; config: Fila }
  const supabase = {
    from(tabela: string) {
      const unir = tabela === 'ab_tests' ? (f: Fila) => ({ ...f, variants: tabelas.ab_test_variants }) : undefined
      return new Consulta(tabelas[tabela]!, () => ganchos.forEach((g) => g()), unir)
    },
    rpc(nome: string, a: Record<string, unknown>) {
      if (nome === 'ops_alert_claim') {
        const k = String(a.p_key)
        if (tabelas.ops_alert_state!.some((f) => f.key === k)) return Promise.resolve({ data: false, error: null })
        tabelas.ops_alert_state!.push({ key: k }); return Promise.resolve({ data: true, error: null })
      }
      const agora = AGORA.toISOString()
      if (nome === 'ab_rotate_commit') {
        if (t().status !== 'active' || t().restore_seq !== a.p_seq) return Promise.resolve({ data: null, error: null })
        const cs = tabelas.ab_test_cycles!
        const num = Math.max(-1, ...cs.map((c) => Number(c.cycle_number))) + 1
        cs.filter((c) => c.ended_at == null).forEach((c) => Object.assign(c, { ended_at: agora, end_reason: 'rotacao', views: a.p_views ?? null, likes: a.p_likes ?? null }))
        const id = `novo-${++ciclo}`
        cs.push({ id, test_id: a.p_test_id, cycle_number: num, variant_id: a.p_variant_id, started_at: agora, ended_at: null, applied_metadata: a.p_applied_metadata })
        const falhas = Number((t().config as Fila).consecutive_failures ?? 0)
        const nota = String(t().status_note ?? '')
        if (/^(nova tentativa |cota do YouTube esgotada|retry |auto-paused)/.test(nota)) t().status_note = null
        Object.assign(t(), { last_applied_variant_id: null, config: falhas ? { ...t().config, consecutive_failures: 0 } : t().config })
        return Promise.resolve({ data: id, error: null })
      }
      // ab_settle_claim
      const extra = a.p_extra as Fila
      if (!(a.p_de as string[]).includes(String(t().status)) || t().restore_seq !== a.p_seq) return Promise.resolve({ data: [], error: null })
      Object.assign(t(), { status: a.p_para, restore_seq: t().restore_seq + 1, restore_status: a.p_restore_status, last_applied_variant_id: null })
      if (a.p_para === 'paused') t().paused_at = agora
      for (const k of ['status_note', 'completed_reason', 'winner_variant_id']) if (k in extra) t()[k] = extra[k]
      if (extra.limpar_carencia) t().grace_expires_at = null
      if (a.p_end_reason) tabelas.ab_test_cycles!.filter((c) => c.ended_at == null).forEach((c) => Object.assign(c, { ended_at: agora, end_reason: a.p_end_reason }))
      return Promise.resolve({ data: [{ claimed_seq: t().restore_seq, stamped_at: agora }], error: null })
    },
  } as unknown as SupabaseClient
  return {
    supabase, teste: () => t(), setTeste: (p: Fila) => Object.assign(t(), p),
    ciclos: () => tabelas.ab_test_cycles!, ciclosAbertos: () => tabelas.ab_test_cycles!.filter((c) => c.ended_at == null),
    cicloAberto: () => tabelas.ab_test_cycles!.find((c) => c.ended_at == null),
    cicloFechado: (i: number) => tabelas.ab_test_cycles!.filter((c) => c.ended_at != null)[i],
    setPoll: (p: Fila) => { tabelas.ab_test_polls!.push({ test_id: 'teste-1', polled_at: AGORA.toISOString(), ...p }) },
    antesDaReleitura: (g: () => void) => { ganchos.push(g) },
    variantes: () => variantes as unknown as AbTestVariantRow[],
  }
}

