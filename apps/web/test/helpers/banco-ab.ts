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
  private modo: 'select' | 'update' | 'delete' | 'insert' = 'select'
  private patch: Fila = {}
  private ordenar: { col: string; asc: boolean } | null = null
  private limite = Infinity
  private deslocamento = 0
  private contar = false
  constructor(private readonly linhas: Fila[], private readonly aoReler: () => void, private readonly unir?: (f: Fila) => Fila, private readonly aoAtualizar?: (antes: Fila, depois: Fila) => void) {}
  select(cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.modo === 'select' && cols === 'restore_seq') this.aoReler()
    if (o?.count) this.contar = true
    return this
  }
  update(patch: Fila) { this.modo = 'update'; this.patch = patch; return this }
  delete() { this.modo = 'delete'; return this }
  insert(linha: Fila) { this.modo = 'insert'; this.patch = linha; return this }
  /** Paginação por intervalo (a guarda do teste do YouTube lê por `range`). */
  range(de: number, ate: number) { this.deslocamento = de; this.limite = ate - de + 1; return this }
  eq(col: string, v: unknown) { this.filtros.push((f) => f[col] === v); return this }
  is(col: string, v: unknown) { this.filtros.push((f) => (f[col] ?? null) === v); return this }
  in(col: string, vs: unknown[]) { this.filtros.push((f) => vs.includes(f[col])); return this }
  /** Só o filtro `restore_status->campo->>estado.eq.valor` (separado por vírgula = OU), o único que o vigia usa. */
  or(expr: string) {
    const alvos = expr.split(',').map((p) => /^restore_status->(\w+)->>estado\.eq\.(\w+)$/.exec(p))
    if (alvos.some((m) => !m)) throw new Error(`banco-ab: or() não suportado: ${expr}`)
    this.filtros.push((f) => alvos.some((m) => ((f.restore_status as Record<string, Fila> | null)?.[m![1]!]?.estado) === m![2]))
    return this
  }
  neq(col: string, v: unknown) { this.filtros.push((f) => f[col] !== v); return this }
  lte(col: string, v: string) { this.filtros.push((f) => String(f[col]) <= v); return this }
  lt(col: string, v: string) { this.filtros.push((f) => String(f[col]) < v); return this }
  gte(col: string, v: string) { this.filtros.push((f) => String(f[col]) >= v); return this }
  not(col: string, _op: string, v: unknown) { this.filtros.push((f) => (f[col] ?? null) !== v); return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordenar = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.limite = n; return this }
  private executar(): Fila[] {
    let hit = this.linhas.filter((f) => this.filtros.every((g) => g(f)))
    if (this.modo === 'insert') { this.linhas.push(structuredClone(this.patch)); return [structuredClone(this.patch)] }
    if (this.modo === 'delete') { for (const f of hit) this.linhas.splice(this.linhas.indexOf(f), 1); return [] }
    if (this.modo === 'update') hit.forEach((f) => { const antes = structuredClone(f); Object.assign(f, this.patch); this.aoAtualizar?.(antes, f) })
    if (this.ordenar) { const { col, asc } = this.ordenar; hit = [...hit].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)) }
    return hit.slice(this.deslocamento, this.deslocamento + this.limite).map((f) => structuredClone(this.unir ? this.unir(f) : f))
  }
  single() { const h = this.executar(); return Promise.resolve(h[0] ? { data: h[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'sem linha' } }) }
  maybeSingle() { return Promise.resolve({ data: this.executar()[0] ?? null, error: null }) }
  then<R1, R2>(ok?: ((v: { data: unknown; error: unknown; count?: number }) => R1 | PromiseLike<R1>) | null, ko?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
    const h = this.executar()
    return Promise.resolve(this.contar ? { data: null, error: null, count: h.length } : { data: h, error: null }).then(ok, ko)
  }
}

export interface OpcoesBanco { testType?: 'thumbnail' | 'title' | 'combo'; restoreSeq?: number; marcador?: string | null; config?: Fila; atualizadoHaMs?: number; diasNoAr?: number; ajustar?: (variantes: Fila[]) => void; ciclosFechados?: number
  /** Rascunho/pausado etc. (padrão active). */ status?: string
  /** Sem ciclo aberto (rascunho). */ semCiclos?: boolean
  restoreStatus?: unknown
  /** Outros testes do mesmo vídeo (campos sobrescrevem o modelo). */ extras?: Fila[]
  /** Vídeos a mais em `youtube_videos` (outro site). */ videos?: Fila[]
  /** Linhas de `ab_native_tests` (a guarda do teste do YouTube, F1a-dado); sem elas a tabela existe vazia. */ nativas?: Fila[]
}

export function criarBanco(o: OpcoesBanco = {}) {
  const teste: Fila = {
    id: 'teste-1', site_id: SITE, name: 'Teste do Lab', test_type: o.testType ?? 'thumbnail', status: o.status ?? 'active', restore_seq: o.restoreSeq ?? 0,
    restore_status: o.restoreStatus ?? null, original_title: 'Título A', original_thumbnail_url: BLOB('A'), last_applied_variant_id: o.marcador ?? null,
    youtube_video_id: 'video-interno', config: o.config ?? { rotation_pattern: 'abba' }, winner_variant_id: null, winner_applied_at: null,
    revert_expires_at: null, status_note: null, paused_at: null, completed_at: null, completed_reason: null, applied_by: null,
    updated_at: new Date(AGORA.getTime() - (o.atualizadoHaMs ?? 600_000)).toISOString(),
    started_at: new Date(AGORA.getTime() - (o.diasNoAr ?? 3) * 86_400_000).toISOString(),
    created_at: new Date(AGORA.getTime() - (o.diasNoAr ?? 3) * 86_400_000).toISOString(),
  }
  const variantes: Fila[] = [
    { id: 'A', test_id: 'teste-1', label: 'original', sort_order: 0, is_original: true, blob_url: BLOB('A'), title_text: 'Título A', thumbnail_dhash: H.A, dimensions: '1280x720' },
    { id: 'B', test_id: 'teste-1', label: 'B', sort_order: 1, is_original: false, blob_url: BLOB('B'), title_text: 'Título B', thumbnail_dhash: H.B },
  ]
  o.ajustar?.(variantes)
  const tabelas: Record<string, Fila[]> = {
    ab_tests: [teste, ...(o.extras ?? []).map((e) => ({ ...structuredClone(teste), restore_status: null, ...e }))], ab_test_variants: variantes,
    ab_test_cycles: o.semCiclos ? [] : [{ id: 'c0', test_id: 'teste-1', cycle_number: 0, variant_id: 'A', started_at: ONTEM, ended_at: null, end_reason: null }],
    ab_test_restores: [],
    ab_test_polls: [], youtube_videos: [{ id: 'video-interno', site_id: SITE, youtube_video_id: 'yt-1', channel_id: 'ch-1', youtube_channels: { channel_id: 'UC1', name: 'Canal' } }, ...(o.videos ?? [])],
    ops_alert_state: [], ab_native_tests: o.nativas ?? [], audit_log: [], sites: [{ id: SITE, org_id: null }],
  }
  for (let i = 0; i < (o.ciclosFechados ?? 0); i++) tabelas.ab_test_cycles!.unshift({ id: `f${i}`, test_id: 'teste-1', cycle_number: -1 - i, variant_id: 'A', started_at: ONTEM, ended_at: ONTEM, end_reason: 'rotacao' })
  const ganchos: Array<() => void> = []
  let ciclo = 0
  const t = () => tabelas.ab_tests[0] as Fila & { restore_seq: number; config: Fila }
  const lancam = new Map<string, Error>()
  // Emula tg_ab_tests_restore_log (com a guarda da P4a): uma linha por campo e por restore_seq quando o campo muda e não
  // está em_andamento; regravar o valor anterior com restore_seq novo não cria linha.
  const gatilhoDoHistorico = (antes: Fila, depois: Fila) => {
    const rs = (depois.restore_status ?? null) as Record<string, Fila> | null
    const rsAntes = (antes.restore_status ?? null) as Record<string, Fila> | null
    for (const k of ['title', 'thumbnail']) {
      const v = rs?.[k]
      if (!v || v.estado === 'em_andamento') continue
      if (JSON.stringify(rsAntes?.[k] ?? null) === JSON.stringify(v)) continue
      const linhas = tabelas.ab_test_restores!
      if (linhas.some((r) => r.test_id === depois.id && r.campo === k && Number(r.seq) < Number(depois.restore_seq)
        && r.estado === v.estado && r.destino === v.destino && r.em === v.em && r.attempts === v.attempts)) continue
      const i = linhas.findIndex((r) => r.test_id === depois.id && r.seq === depois.restore_seq && r.campo === k)
      const nova = { test_id: depois.id, seq: depois.restore_seq, campo: k, estado: v.estado, destino: v.destino, escreveu: v.escreveu, forcado: v.forcado, motivo: v.motivo ?? null, attempts: v.attempts, em: v.em }
      if (i >= 0) linhas[i] = nova; else linhas.push(nova)
    }
  }
  const supabase = {
    from(tabela: string) {
      const unir = tabela === 'ab_tests' ? (f: Fila) => ({ ...f, variants: tabelas.ab_test_variants }) : undefined
      return new Consulta(tabelas[tabela]!, () => ganchos.forEach((g) => g()), unir, tabela === 'ab_tests' ? gatilhoDoHistorico : undefined)
    },
    rpc(nome: string, a: Record<string, unknown>) {
      if (lancam.has(nome)) return Promise.reject(lancam.get(nome))
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
      if (nome === 'ab_resume_commit') {
        const alvo = tabelas.ab_tests!.find((f) => f.id === a.p_test_id) as (Fila & { restore_seq: number }) | undefined
        if (!alvo || alvo.status !== a.p_de || alvo.restore_seq !== a.p_seq) return Promise.resolve({ data: null, error: null })
        const cs = tabelas.ab_test_cycles!.filter((c) => c.test_id === a.p_test_id)
        const num = Math.max(-1, ...cs.map((c) => Number(c.cycle_number))) + 1
        cs.filter((c) => c.ended_at == null).forEach((c) => Object.assign(c, { ended_at: agora, end_reason: alvo.paused_at ? 'pausa' : null }))
        const id = `retomado-${++ciclo}`
        tabelas.ab_test_cycles!.push({ id, test_id: a.p_test_id, cycle_number: num, variant_id: a.p_variant_id, started_at: agora, ended_at: null, applied_metadata: a.p_applied_metadata })
        const cfg = (alvo.config ?? {}) as Fila
        Object.assign(alvo, { status: 'active', paused_at: null, drift_acknowledged_at: null, status_note: null, restore_status: {}, updated_at: agora, config: Number(cfg.consecutive_failures ?? 0) ? { ...cfg, consecutive_failures: 0 } : cfg })
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
    restores: () => tabelas.ab_test_restores!,
    nativas: () => tabelas.ab_native_tests!, auditoria: () => tabelas.audit_log!,
    outro: (id: string) => tabelas.ab_tests!.find((f) => f.id === id) as Fila,
    rpcLanca: (nome: string, e: Error) => { lancam.set(nome, e) },
    setPoll: (p: Fila) => { tabelas.ab_test_polls!.push({ test_id: 'teste-1', polled_at: AGORA.toISOString(), ...p }) },
    antesDaReleitura: (g: () => void) => { ganchos.push(g) },
    variantes: () => variantes as unknown as AbTestVariantRow[],
  }
}

