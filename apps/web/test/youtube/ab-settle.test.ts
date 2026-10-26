// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { settleOnAir, novaTentativa, ORIGINAL, destinoNormalizado, lerRetratoPadrao } from '@/lib/youtube/ab-settle'
import type { OpcoesSaida, MotivoSaida, Retrato } from '@/lib/youtube/ab-settle'
import { avisarRestauracao } from '@/lib/youtube/ab-restore-avisos'
import { converterInterrompido } from '@/lib/youtube/ab-restore'
import type { CampoRestauracao, RestoreStatus } from '@/lib/youtube/ab-restore'
import { ErroConhecido } from '@/lib/youtube/youtube-api-error'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import { dhashOf, hamming } from '@/lib/youtube/thumb-fingerprint'
import { H, YouTubeFalso, imagemComDhash } from '../helpers/youtube-falso'
import * as Sentry from '@sentry/nextjs'

const { fanOut, ensureFreshToken } = vi.hoisted(() => ({ fanOut: vi.fn(), ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/teste-youtube/nativo/guarda', async (orig) => (await import('../helpers/guarda-nativa-vazia')).guardaVazia(await orig<typeof import('@/lib/youtube/teste-youtube/nativo/guarda')>()))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdminsDetailed: fanOut }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('serviço real não é para testes') } }))

const IMG = { A: await imagemComDhash(H.A), B: await imagemComDhash(H.B), C: await imagemComDhash(H.C) }
const BLOB = (id: string) => `https://abc.public.blob.vercel-storage.com/${id}.jpg`
const T0 = Date.parse('2026-10-12T08:00:00.000Z')
const SITE = 'site-1'

// ---------------------------------------------------------------------------
// Banco falso em memória: ab_tests, ab_test_variants, ab_test_cycles, youtube_videos, ops_alert_state
// e as rpc ab_settle_claim / ops_alert_claim, com a semântica do SQL (guarda por restore_seq e p_de).
// ---------------------------------------------------------------------------
type Fila = Record<string, unknown>
interface TesteFake extends Fila { id: string; status: string; restore_seq: number; restore_status: Record<string, Record<string, unknown>>; winner_applied_at: string | null; revert_expires_at: string | null; paused_at: string | null; completed_at: string | null; config: Record<string, unknown> }

class Consulta implements PromiseLike<{ data: unknown; error: unknown }> {
  private filtros: Array<(f: Fila) => boolean> = []
  private modo: 'select' | 'update' | 'delete' = 'select'
  private patch: Fila = {}
  private ordenar: { col: string; asc: boolean } | null = null
  private limite = Infinity
  private devolve = false
  constructor(private readonly linhas: Fila[], private readonly aoReler: () => void, private readonly aoGravar?: (patch: Fila) => void) {}
  select(cols?: string) { if (cols === 'restore_seq') this.aoReler(); this.devolve = true; return this }
  update(patch: Fila) { this.modo = 'update'; this.patch = patch; return this }
  delete() { this.modo = 'delete'; return this }
  eq(col: string, v: unknown) { this.filtros.push((f) => f[col] === v); return this }
  neq(col: string, v: unknown) { this.filtros.push((f) => f[col] !== v); return this }
  in(col: string, vs: unknown[]) { this.filtros.push((f) => vs.includes(f[col])); return this }
  is(col: string, v: unknown) { this.filtros.push((f) => f[col] === v); return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordenar = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.limite = n; return this }
  private executar(): Fila[] {
    let hit = this.linhas.filter((f) => this.filtros.every((g) => g(f)))
    if (this.modo === 'update') { hit.forEach((f) => Object.assign(f, this.patch)); this.aoGravar?.(structuredClone(this.patch)) }
    if (this.modo === 'delete') { hit.forEach((f) => this.linhas.splice(this.linhas.indexOf(f), 1)); return [] }
    if (this.ordenar) { const { col, asc } = this.ordenar; hit = [...hit].sort((a, b) => (Number(a[col]) - Number(b[col])) * (asc ? 1 : -1)) }
    return hit.slice(0, this.limite).map((f) => structuredClone(f))
  }
  single() { const h = this.executar(); return Promise.resolve(h[0] ? { data: h[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'sem linha' } }) }
  maybeSingle() { return Promise.resolve({ data: this.executar()[0] ?? null, error: null }) }
  then<R1, R2>(ok?: ((v: { data: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null, ko?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
    return Promise.resolve({ data: this.executar(), error: null }).then(ok, ko)
  }
}

function criarBanco(rel: { t: number }, inicial: { teste: Fila; variantes: Fila[]; ciclos: Fila[]; video: Fila; outros?: Fila[]; restores?: Fila[] }) {
  const tabelas: Record<string, Fila[]> = {
    ab_tests: [inicial.teste, ...(inicial.outros ?? [])], ab_test_variants: inicial.variantes, ab_test_cycles: inicial.ciclos,
    youtube_videos: [inicial.video], ops_alert_state: [], ab_test_restores: inicial.restores ?? [],
  }
  const log: string[] = []
  const atualizacoes: Array<{ tabela: string; patch: Fila }> = []
  let claimed = false
  let queda: Error | null = null
  const ganchosReleitura: Array<() => void> = []
  const teste = () => tabelas.ab_tests[0] as TesteFake
  const supabase = {
    from(tabela: string) {
      if (queda && claimed && tabela === 'ab_tests') throw queda
      return new Consulta(tabelas[tabela]!, () => { log.push('releitura'); ganchosReleitura.forEach((g) => g()) }, (patch) => atualizacoes.push({ tabela, patch }))
    },
    rpc(nome: string, a: Record<string, unknown>) {
      if (nome === 'ops_alert_claim') {
        const k = String(a.p_key)
        if (tabelas.ops_alert_state.some((f) => f.key === k)) return Promise.resolve({ data: false, error: null })
        tabelas.ops_alert_state.push({ key: k }); return Promise.resolve({ data: true, error: null })
      }
      const t = teste(); const extra = a.p_extra as Fila
      if (t.id !== a.p_test_id || !(a.p_de as string[]).includes(t.status) || t.restore_seq !== a.p_seq) return Promise.resolve({ data: [], error: null })
      if (a.p_vencedor_esperado != null && ((t.result_metadata as { v2?: { vencedor_sugerido?: string } } | null)?.v2?.vencedor_sugerido) !== a.p_vencedor_esperado) return Promise.resolve({ data: [], error: null })
      const agora = new Date(rel.t).toISOString(); const antes = t.status
      Object.assign(t, { status: a.p_para, restore_seq: t.restore_seq + 1, restore_status: a.p_restore_status, last_applied_variant_id: null, updated_at: agora })
      if (a.p_para === 'paused' && antes !== 'paused') t.paused_at = agora
      if (a.p_para === 'completed' && antes !== 'completed') t.completed_at = agora
      for (const k of ['status_note', 'completed_reason', 'winner_variant_id']) if (k in extra) t[k] = extra[k]
      if (extra.limpar_confianca) t.confidence_at_completion = null
      if (extra.limpar_drift_ack) t.drift_acknowledged_at = null
      if (extra.limpar_carencia) t.grace_expires_at = null
      if ('consecutive_failures' in extra) t.config = { ...t.config, consecutive_failures: extra.consecutive_failures }
      if (a.p_end_reason) tabelas.ab_test_cycles.filter((c) => c.ended_at == null).forEach((c) => Object.assign(c, { ended_at: agora, end_reason: a.p_end_reason }))
      claimed = true
      return Promise.resolve({ data: [{ claimed_seq: t.restore_seq, stamped_at: agora }], error: null })
    },
  } as unknown as SupabaseClient
  return {
    supabase, testId: String(inicial.teste.id), log, teste, atualizacoes,
    setTeste: (p: Fila) => Object.assign(tabelas.ab_tests[0]!, p),
    variante: (id: string) => tabelas.ab_test_variants.find((v) => v.id === id) as Fila,
    cicloFechado: () => tabelas.ab_test_cycles.find((c) => c.ended_at != null) as Fila,
    incrementarSeq: () => { teste().restore_seq += 1 },
    antesDaReleitura: (g: () => void) => { ganchosReleitura.push(g) },
    lancarDepoisDoClaim: (e: Error | null) => { queda = e },
    retratoAntigo: () => lerRetratoPadrao(supabase, String(inicial.teste.id), SITE),
  }
}

// ---------------------------------------------------------------------------
interface CampoAnterior { estado?: string; attempts?: number; segundosAtras?: number; forcado?: boolean; destino?: string; erro?: unknown; motivo?: string; escreveu?: boolean | null }
interface Opcoes {
  status?: string; testType?: 'thumbnail' | 'title' | 'combo' | 'description'
  noAr?: { titulo?: string; dhash?: string }
  anterior?: { title?: CampoAnterior; thumbnail?: CampoAnterior }
  inicioUltimoCiclo?: '2 dias atrás'; originalTitle?: string | null
  vencedor?: 'B'; reversivel?: boolean; token?: 'recusado'; canal?: 'nao_identificado'
  /** Histórico (ab_test_restores), horas atrás, da mais nova para a mais antiga. */ historico?: Array<{ campo: 'title' | 'thumbnail'; horasAtras: number; forcado: boolean }>
  outros?: Fila[]
  videoApagado?: boolean; originalThumbnailUrl?: string | null; variantes?: { A?: Fila; B?: Fila }; relogioAvancaPorChamada?: number
}

function montar(o: Opcoes = {}) {
  const rel = { t: T0 }
  const iso = (ms: number) => new Date(ms).toISOString()
  const anterior = o.anterior && Object.fromEntries(Object.entries(o.anterior).map(([c, a]) => [c, {
    estado: a.estado ?? 'ok', destino: a.destino ?? 'original', forcado: a.forcado ?? false, escreveu: a.escreveu === undefined ? true : a.escreveu, erro: a.erro ?? null, attempts: a.attempts ?? 0,
    em: iso(T0 - (a.segundosAtras ?? 86_400) * 1000), ...(a.motivo ? { motivo: a.motivo } : {}),
  }]))
  const teste: Fila = {
    id: 'teste-1', site_id: SITE, name: 'Teste do Lab', test_type: o.testType ?? 'combo', status: o.status ?? 'active', restore_seq: 0,
    restore_status: anterior ?? null, original_title: o.originalTitle === undefined ? 'Título A' : o.originalTitle,
    original_thumbnail_url: o.originalThumbnailUrl ?? null, last_applied_variant_id: null, youtube_video_id: 'video-interno', config: {},
    winner_variant_id: o.vencedor ?? null, completed_reason: null, applied_by: null, status_note: null, paused_at: null, completed_at: null,
    winner_applied_at: o.vencedor ? iso(T0 - 86_400_000) : null,
    revert_expires_at: o.vencedor ? iso(T0 + (o.reversivel ? 6 : -1) * 86_400_000) : null,
  }
  const variantes: Fila[] = [
    { id: 'A', test_id: 'teste-1', is_original: true, blob_url: BLOB('A'), title_text: 'Título A', thumbnail_dhash: H.A, ...o.variantes?.A },
    { id: 'B', test_id: 'teste-1', is_original: false, blob_url: BLOB('B'), title_text: 'Título B', thumbnail_dhash: H.B, ...o.variantes?.B },
    { id: 'C', test_id: 'teste-1', is_original: false, blob_url: BLOB('C'), title_text: 'Título C', thumbnail_dhash: H.C },
  ]
  const ciclos: Fila[] = [{ test_id: 'teste-1', cycle_number: 0, started_at: iso(T0 - (o.inicioUltimoCiclo ? 2 * 86_400_000 : 3_600_000)), ended_at: null }]
  const video: Fila = { id: 'video-interno', site_id: SITE, youtube_video_id: 'yt-1', youtube_channels: o.canal ? null : { channel_id: 'UC1', name: 'Canal' } }
  const restores: Fila[] = (o.historico ?? []).map((h, i) => ({ test_id: 'teste-1', campo: h.campo, seq: 100 - i, forcado: h.forcado, em: iso(T0 - h.horasAtras * 3_600_000) }))
  const banco = criarBanco(rel, { teste, variantes, ciclos, video, outros: o.outros, restores })
  const noAr = o.noAr?.dhash ?? H.B
  const yt = new YouTubeFalso({
    titulo: o.noAr?.titulo ?? 'Título B', thumb: Buffer.alloc(0), videoApagado: o.videoApagado, relogio: { avancar: (ms) => { rel.t += ms } },
    avancaPorChamada: o.relogioAvancaPorChamada,
    blobs: { [BLOB('A')]: IMG.A, [BLOB('B')]: IMG.B, [BLOB('C')]: IMG.C },
  })
  return { banco, yt, rel, siteId: SITE, op: (motivo: MotivoSaida, extra: Partial<OpcoesSaida> = {}): OpcoesSaida => ({ siteId: SITE, destino: ORIGINAL, motivo, ...extra }),
    noArPronto: imagemComDhash(noAr).then((b) => { yt.thumb = b }),
    portas: {
      supabase: banco.supabase, agora: () => new Date(rel.t), fetch: yt.fetch,
      token: o.token === 'recusado' ? async () => { throw new ErroConhecido('token') } : async () => 'tok',
      autoImportWinner: vi.fn(async () => {}),
    } }
}
type Cenario = ReturnType<typeof montar>
const preparar = async (o?: Opcoes): Promise<Cenario> => { const c = montar(o); await c.noArPronto; return c }
const avisos = { enviados: () => fanOut.mock.calls.map((c) => c[0] as { title: string; message: string; dedupKey: string; priority: number }) }

beforeEach(() => { vi.clearAllMocks(); fanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] }) })

describe('imagemComDhash (helper do YouTubeFalso)', () => {
  it('a imagem gerada tem exatamente o dHash pedido, e A, B e C ficam longe umas das outras', async () => {
    for (const h of Object.values(H)) expect(await dhashOf(await imagemComDhash(h))).toBe(h)
    expect(hamming(H.A, H.B)).toBeGreaterThan(6); expect(hamming(H.B, H.C)).toBeGreaterThan(6); expect(hamming(H.A, H.C)).toBeGreaterThan(6)
  })
})

describe('destinoNormalizado (tabela de 3 linhas + inválido)', () => {
  const vs = [{ id: 'A', is_original: true }, { id: 'B', is_original: false }].map((v) => ({ ...v, blob_url: null, title_text: null, thumbnail_dhash: null }))
  it('original → original; variante is_original → original; variante do teste → { varianteId }; fora do teste → null', () => {
    expect(destinoNormalizado({ tipo: 'original' }, vs)).toBe('original')
    expect(destinoNormalizado({ tipo: 'variante', id: 'A' }, vs)).toBe('original')
    expect(destinoNormalizado({ tipo: 'variante', id: 'B' }, vs)).toEqual({ varianteId: 'B' })
    expect(destinoNormalizado({ tipo: 'variante', id: 'Z' }, vs)).toBeNull()
  })
})

describe('settleOnAir: um teste por linha da tabela 3.1 (aceite 15)', () => {
  it.each([
    ['pausa', 'active', 'paused', undefined, 'pausa'],
    ['encerrado', 'active', 'completed', 'manual_archive', 'encerrado'],
    ['encerrado', 'paused', 'completed', 'manual_archive', 'encerrado'],
    ['falha_api', 'active', 'paused', undefined, 'falha_api'],
    ['duracao_maxima', 'active', 'completed', 'inconclusive', 'duracao_maxima'],
    ['regra_v2', 'active', 'completed', 'regra_v2', 'regra_v2'],
    ['drift', 'active', 'paused', undefined, 'drift'],
  ] as const)('%s de %s → %s', async (motivo, de, para, completedReason, endReason) => {
    const { banco, yt, portas, op } = await preparar({ status: de, testType: 'combo', noAr: { titulo: 'Título B', dhash: H.B } })
    const r = await settleOnAir(banco.testId, op(motivo), portas)
    expect(r.resultado).toBe('feito')
    expect(banco.teste()).toMatchObject({ status: para, restore_seq: 1, last_applied_variant_id: null, ...(completedReason ? { completed_reason: completedReason } : {}) })
    if (de === 'active') expect(banco.cicloFechado()).toMatchObject({ end_reason: endReason, ended_at: banco.teste().paused_at ?? banco.teste().completed_at })
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'ok', destino: 'original', escreveu: true }, thumbnail: { estado: 'ok', escreveu: true } })
    expect(yt.escritas()).toEqual(['videos.update', 'thumbnails.set'])
    expect(yt.titulo).toBe('Título A')
    expect(await dhashOf(yt.thumb)).toBe(H.A)
  })
  it('falha_api grava status_note e consecutive_failures; drift grava a nota de drift', async () => {
    const f = await preparar({ testType: 'title' })
    await settleOnAir(f.banco.testId, f.op('falha_api', { statusNote: 'cota', consecutiveFailures: 3 }), f.portas)
    expect(f.banco.teste()).toMatchObject({ status_note: 'cota', config: { consecutive_failures: 3 } })
    const d = await preparar({ testType: 'title' })
    await settleOnAir(d.banco.testId, d.op('drift'), d.portas)
    expect(d.banco.teste().status_note).toBe(DRIFT_STATUS_NOTE)
  })
  it('encerrar deixando B: manual_winner, winner_applied_at, applied_by manual, revert_expires_at +7d, autoImportWinner uma vez', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título C', dhash: H.C } })
    await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'B' } }, portas)
    const t = banco.teste()
    expect(await dhashOf(yt.thumb)).toBe(H.B)                                         // o vencedor ficou no ar
    expect(yt.titulo).toBe('Título B')
    expect(t).toMatchObject({ completed_reason: 'manual_winner', winner_variant_id: 'B', applied_by: 'manual' })
    expect(new Date(t.winner_applied_at!).getTime()).toBe(portas.agora().getTime())
    expect(new Date(t.revert_expires_at!).getTime() - portas.agora().getTime()).toBe(7 * 86_400_000)
    expect(portas.autoImportWinner).toHaveBeenCalledTimes(1)
    banco.setTeste({ status: 'active', completed_reason: null })   // segunda saída: winner_applied_at já preenchido
    await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(portas.autoImportWinner).toHaveBeenCalledTimes(1)                        // 32 j: só se era nulo no retrato
  })
  it('17: endAbTest com o id da variante original → manual_archive, sem dado de vencedor', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título B', dhash: H.B } })
    await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'A' } }, portas)
    expect(banco.teste()).toMatchObject({ completed_reason: 'manual_archive', winner_variant_id: null, winner_applied_at: null })
  })
  it('19: deixar B num teste de título que termina falhou → winner_applied_at e revert_expires_at nulos, winner_variant_id = B, autoImportWinner 0', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Título C' } })
    yt.recusar('videos.update', 403, 'forbidden')
    await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(banco.teste()).toMatchObject({ winner_variant_id: 'B', winner_applied_at: null, revert_expires_at: null })
    expect(portas.autoImportWinner).toHaveBeenCalledTimes(0)
  })
  it('reverter: (a) tudo ok → os três nulos; (b) título editado → pulado_drift e os três intactos; (c) revert_expires_at ontem → ja_encerrado, restore_seq igual, nenhuma escrita', async () => {
    const a = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, vencedor: 'B', reversivel: true })
    await settleOnAir(a.banco.testId, a.op('reverter'), a.portas)
    expect(a.banco.teste()).toMatchObject({ winner_applied_at: null, revert_expires_at: null, applied_by: null })
    const b = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado no Studio' }, vencedor: 'B', reversivel: true })
    await settleOnAir(b.banco.testId, b.op('reverter'), b.portas)
    expect(b.banco.teste().restore_status.title).toMatchObject({ estado: 'pulado_drift' })
    expect(b.banco.teste().winner_applied_at).not.toBeNull()
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, vencedor: 'B', reversivel: false })
    const r = await settleOnAir(c.banco.testId, c.op('reverter'), c.portas)
    expect(r.resultado).toBe('ja_encerrado'); expect(c.banco.teste().restore_seq).toBe(0); expect(c.yt.escritas()).toEqual([])
  })
  it.each([
    ['pausa', { status: 'active' }],
    ['encerrado', { status: 'active' }],
    ['reverter', { status: 'completed', vencedor: 'B', reversivel: true }],
  ] as const)('DEVE-2: teste do tipo description (fora do escopo, Q8) em %s → ja_encerrado, sem escrever nem mudar estado', async (motivo, extra) => {
    const { banco, yt, portas, op } = await preparar({ ...extra, testType: 'description', noAr: { titulo: 'Título B' } })
    const antes = { ...banco.teste() }
    const r = await settleOnAir(banco.testId, op(motivo), portas)
    expect(r.resultado).toBe('ja_encerrado')
    expect(banco.teste()).toMatchObject({ status: antes.status, restore_seq: 0, winner_applied_at: antes.winner_applied_at, revert_expires_at: antes.revert_expires_at })
    expect(yt.escritas()).toEqual([])
  })
  it('aplicar_sugerido (S8-F4 T11b): completed regra_v2 → completed manual_winner com B no ar, applied_by manual, sem fechar ciclo; sobre o original → destino_invalido; sobre ativo → ja_encerrado', async () => {
    const a = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A } })
    a.banco.setTeste({ completed_reason: 'regra_v2', completed_at: '2026-10-20T00:00:00.000Z', result_metadata: { v2: { vencedor_sugerido: 'B' } } })
    const r = await settleOnAir(a.banco.testId, { ...a.op('aplicar_sugerido'), destino: { tipo: 'variante', id: 'B' } }, a.portas)
    expect(r.resultado).toBe('feito')
    expect(await dhashOf(a.yt.thumb)).toBe(H.B)
    expect(a.banco.teste()).toMatchObject({ status: 'completed', completed_reason: 'manual_winner', winner_variant_id: 'B', applied_by: 'manual', completed_at: '2026-10-20T00:00:00.000Z' })
    expect(a.banco.teste().winner_applied_at).not.toBeNull()
    const o = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A } })
    expect((await settleOnAir(o.banco.testId, { ...o.op('aplicar_sugerido'), destino: { tipo: 'original' } }, o.portas)).resultado).toBe('destino_invalido')
    expect(o.banco.teste().restore_seq).toBe(0)
    const v = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A } })
    expect((await settleOnAir(v.banco.testId, { ...v.op('aplicar_sugerido'), destino: { tipo: 'variante', id: 'B' } }, v.portas)).resultado).toBe('ja_encerrado')
    expect(v.yt.escritas()).toEqual([])
  })
  it('P3 do Phil: aplicar_sugerido manda p_vencedor_esperado; letra trocada depois da tela ⇒ mudou, zero escrita; outros motivos não mandam o parâmetro', async () => {
    const a = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A } })
    a.banco.setTeste({ completed_reason: 'regra_v2', completed_at: '2026-10-20T00:00:00.000Z', result_metadata: { v2: { vencedor_sugerido: 'C' } } })
    const chamadas: Array<Record<string, unknown>> = []
    const rpc = a.portas.supabase.rpc.bind(a.portas.supabase) as (n: string, args: Record<string, unknown>) => unknown
    ;(a.portas.supabase as unknown as { rpc: unknown }).rpc = (n: string, args: Record<string, unknown>) => { if (n === 'ab_settle_claim') chamadas.push(args); return rpc(n, args) }
    const r = await settleOnAir(a.banco.testId, { ...a.op('aplicar_sugerido'), destino: { tipo: 'variante', id: 'B' } }, a.portas)
    expect(r.resultado).toBe('mudou')
    expect(chamadas[0]).toMatchObject({ p_vencedor_esperado: 'B' })
    expect(a.banco.teste()).toMatchObject({ status: 'completed', restore_seq: 0 })
    expect(a.yt.escritas()).toEqual([])
    const e = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A } })
    const ch2: Array<Record<string, unknown>> = []
    const rpc2 = e.portas.supabase.rpc.bind(e.portas.supabase) as (n: string, args: Record<string, unknown>) => unknown
    ;(e.portas.supabase as unknown as { rpc: unknown }).rpc = (n: string, args: Record<string, unknown>) => { if (n === 'ab_settle_claim') ch2.push(args); return rpc2(n, args) }
    await settleOnAir(e.banco.testId, e.op('encerrado'), e.portas)
    expect(ch2.length).toBeGreaterThan(0)
    expect('p_vencedor_esperado' in ch2[0]!).toBe(false)
  })
  it('Y-T12-1: aplicar_sugerido com outro teste aberto no mesmo vídeo → outro_teste, mesmo com forcar, zero escrita; outro concluído não bloqueia', async () => {
    const outro = (status: string) => [{ id: 'outro', site_id: SITE, youtube_video_id: 'video-interno', status, restore_seq: 0 }]
    const a = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A }, outros: outro('active') })
    a.banco.setTeste({ completed_reason: 'regra_v2' })
    const r = await settleOnAir(a.banco.testId, { ...a.op('aplicar_sugerido'), destino: { tipo: 'variante', id: 'B' }, forcar: true }, a.portas)
    expect(r.resultado).toBe('outro_teste')
    expect(a.yt.escritas()).toEqual([]); expect(a.banco.teste().restore_seq).toBe(0)
    const b = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título A', dhash: H.A }, outros: outro('completed') })
    b.banco.setTeste({ completed_reason: 'regra_v2', result_metadata: { v2: { vencedor_sugerido: 'B' } } })
    expect((await settleOnAir(b.banco.testId, { ...b.op('aplicar_sugerido'), destino: { tipo: 'variante', id: 'B' }, forcar: true }, b.portas)).resultado).toBe('feito')
  })
  it('Y-T12-1: reverter com outro teste aberto no mesmo vídeo → outro_teste, mesmo com forcar, zero escrita', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, vencedor: 'B', reversivel: true,
      outros: [{ id: 'outro', site_id: SITE, youtube_video_id: 'video-interno', status: 'paused', restore_seq: 0 }] })
    const r = await settleOnAir(c.banco.testId, { ...c.op('reverter'), forcar: true }, c.portas)
    expect(r.resultado).toBe('outro_teste'); expect(c.yt.escritas()).toEqual([]); expect(c.banco.teste().restore_seq).toBe(0)
  })
  it('PODE-5: encerrar um teste já completed → ja_encerrado, nada escrito', async () => {
    const c = await preparar({ status: 'completed', testType: 'combo' })
    expect((await settleOnAir(c.banco.testId, c.op('encerrado'), c.portas)).resultado).toBe('ja_encerrado')
    expect(c.banco.teste().restore_seq).toBe(0); expect(c.yt.escritas()).toEqual([])
  })
  it('PODE-4: reverter com winner_applied_at nulo e revert_expires_at no futuro → ja_encerrado, nada escrito', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, vencedor: 'B', reversivel: true })
    c.banco.setTeste({ winner_applied_at: null })
    const r = await settleOnAir(c.banco.testId, c.op('reverter'), c.portas)
    expect(r.resultado).toBe('ja_encerrado'); expect(c.banco.teste().restore_seq).toBe(0); expect(c.yt.escritas()).toEqual([])
  })
  it('Y-D2: destino = variante de OUTRO teste → destino_invalido, nada gravado, nada escrito; teste de outro site → ja_encerrado', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título B', dhash: H.B } })
    const r1 = await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'variante-de-outro-teste' } }, portas)
    expect(r1.resultado).toBe('destino_invalido'); expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 0, winner_variant_id: null }); expect(yt.escritas()).toEqual([])
    const r2 = await settleOnAir(banco.testId, { ...op('pausa'), siteId: 'outro-site' }, portas)
    expect(r2.resultado).toBe('ja_encerrado'); expect(banco.teste().restore_seq).toBe(0)
  })
})

describe('settleOnAir: ordem e corridas (3.2, 22, P4a-I1, I3)', () => {
  it('Review Focus 1: ultimaEscrita vem do retrato de antes da reivindicação', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.A }, inicioUltimoCiclo: '2 dias atrás' })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(yt.escritas()).toEqual([])                                  // ok sem escrever: o `em` do claim não conta como escrita recente
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'ok', escreveu: false })
  })
  it('restore_seq muda entre a decisão e a escrita → não escreve e devolve em_andamento', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    banco.antesDaReleitura(() => banco.incrementarSeq())
    const r = await settleOnAir(banco.testId, op('pausa'), portas)
    expect(r.resultado).toBe('em_andamento'); expect(yt.escritas()).toEqual([])
  })
  it('(Y-D8, literal) combo: a releitura de restore_seq vem imediatamente antes de CADA escrita', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo' })
    const ordem: string[] = []
    banco.antesDaReleitura(() => ordem.push('releitura'))
    yt.antesDeEscrever((c) => { ordem.push(c) })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(ordem).toEqual(['releitura', 'videos.update', 'releitura', 'thumbnails.set'])
  })
  it('restore_seq muda DEPOIS da primeira escrita → a segunda não sai e devolve em_andamento', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo' })
    yt.depoisDeEscrever((c) => { if (c === 'videos.update') banco.incrementarSeq() })
    const r = await settleOnAir(banco.testId, op('pausa'), portas)
    expect(r.resultado).toBe('em_andamento'); expect(yt.escritas()).toEqual(['videos.update'])
  })
  it('estado igual e restore_seq diferente → em_andamento, restore_seq inalterado pelo segundo, zero escrita', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    const retrato = (await banco.retratoAntigo()) as Retrato        // lido antes de outra aba reivindicar
    banco.incrementarSeq()                                          // status continua 'active'
    const r = await settleOnAir(banco.testId, op('pausa'), { ...portas, lerRetrato: async () => retrato })
    expect(r.resultado).toBe('em_andamento'); expect(banco.teste().restore_seq).toBe(1); expect(yt.escritas()).toEqual([])
  })
  it('estado fora de p_de → ja_encerrado', async () => {
    const { banco, portas, op } = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'x', dhash: H.A } })
    expect((await settleOnAir(banco.testId, op('pausa'), portas)).resultado).toBe('ja_encerrado')
  })
  it('P4a-I3 (Y-D12): o banco cai depois do passo 1 → em_andamento com forcado, em e attempts 0 (a reivindicação abre corrente); a exceção sobe', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'combo', anterior: { title: { attempts: 2 } } })
    banco.lancarDepoisDoClaim(new Error('banco caiu'))        // lança na primeira leitura de ab_tests depois do claim (a releitura de restore_seq)
    await expect(settleOnAir(banco.testId, op('pausa'), portas)).rejects.toThrow('banco caiu')
    expect(banco.teste().restore_status.title).toMatchObject({ estado: 'em_andamento', forcado: false, attempts: 0 })
    expect(banco.teste().restore_status.title!.em).toBeTruthy()
  })
  it('DEVE-2: combo, título escrito e imagem com host bloqueado → título ok/escreveu true, thumbnail falhou/erro_interno/escreveu false, Sentry uma vez', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título C', dhash: H.C }, variantes: { B: { blob_url: 'https://evil.example.com/x.jpg' } } })
    const r = await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(r.resultado).toBe('feito')
    expect(banco.teste().restore_status).toMatchObject({
      title: { estado: 'ok', escreveu: true },
      thumbnail: { estado: 'falhou', erro: { motivo: 'erro_interno' }, escreveu: false },
    })
    expect(yt.escritas()).toEqual(['videos.update'])
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
  it('Y-D12: token recusado → falhou/token e o estado mudou (erro conhecido, não relança)', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'title', token: 'recusado' })
    const r = await settleOnAir(banco.testId, op('pausa'), portas)
    expect(r.resultado).toBe('feito'); expect(banco.teste().status).toBe('paused')
    expect(banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', erro: { motivo: 'token' } })
  })
  it('F-D4: campo em_andamento há 30 s → em_andamento, zero reivindicação; há 3 min → reivindica', async () => {
    const novo = await preparar({ status: 'paused', testType: 'thumbnail', anterior: { thumbnail: { estado: 'em_andamento', segundosAtras: 30 } }, noAr: { dhash: H.A } })
    expect((await settleOnAir(novo.banco.testId, novo.op('encerrado'), novo.portas)).resultado).toBe('em_andamento')
    expect(novo.banco.teste().restore_seq).toBe(0)
    const velho = await preparar({ status: 'paused', testType: 'thumbnail', anterior: { thumbnail: { estado: 'em_andamento', segundosAtras: 180 } }, noAr: { dhash: H.A } })
    expect((await settleOnAir(velho.banco.testId, velho.op('encerrado'), velho.portas)).resultado).toBe('feito')
  })
  it('Y-D13: seqEsperado diferente do restore_seq do retrato → em_andamento, não reivindica', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    const r = await settleOnAir(banco.testId, op('drift', { seqEsperado: banco.teste().restore_seq - 1 }), portas)
    expect(r.resultado).toBe('em_andamento'); expect(banco.teste().restore_seq).toBe(0)
  })
  it('D3: seqEsperado diferente em ação humana → mudou (não reivindica, zero escrita); sem humano segue em_andamento', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'paused', testType: 'thumbnail', noAr: { dhash: H.A } })
    const r = await settleOnAir(banco.testId, op('encerrado', { humano: true, seqEsperado: banco.teste().restore_seq - 1 }), portas)
    expect(r.resultado).toBe('mudou'); expect(banco.teste().restore_seq).toBe(0); expect(yt.escritas()).toEqual([])
    const ok = await settleOnAir(banco.testId, op('encerrado', { humano: true, seqEsperado: banco.teste().restore_seq }), portas)
    expect(ok.resultado).toBe('feito')
  })
  it('F-D3: relógio falso, escrita que começaria com menos de 25 s de folga (aos 36 s com prazo de 55 s) → os DOIS campos tempo_esgotado, zero escrita', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título B', dhash: H.B }, relogioAvancaPorChamada: 12_000 })
    await settleOnAir(banco.testId, op('pausa', { prazo: portas.agora().getTime() + 55_000 }), portas)
    expect(banco.teste().restore_status).toMatchObject({
      title: { estado: 'falhou', erro: { motivo: 'tempo_esgotado' }, escreveu: false },
      thumbnail: { estado: 'falhou', erro: { motivo: 'tempo_esgotado' }, escreveu: false },
    })
    expect(yt.escritas()).toEqual([])
  })
})

describe('settleOnAir: precisa_confirmar e forcar (20, P4a-E7)', () => {
  it('destino variante, título editado por fora → precisa_confirmar listando só o título; nada gravado', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Editado', dhash: H.C } })
    const r = await settleOnAir(banco.testId, { ...op('encerrado', { humano: true }), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(r).toEqual({ resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Editado' }] })
    expect(banco.teste()).toMatchObject({ status: 'active', restore_seq: 0, restore_status: null }); expect(yt.escritas()).toEqual([])
  })
  it('thumbnail editada por fora → precisa_confirmar com a URL pública da hqdefault', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: '0f0f0f0f0f0f0f0f' } })
    const r = await settleOnAir(banco.testId, { ...op('encerrado', { humano: true }), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(r).toEqual({ resultado: 'precisa_confirmar', campos: [{ campo: 'thumbnail', valor_atual: 'https://i.ytimg.com/vi/yt-1/hqdefault.jpg' }] })
  })
  it('com forcar: título editado e thumbnail fora de tudo → duas escritas e os dois campos com forcado: true', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Editado', dhash: '0f0f0f0f0f0f0f0f' } })
    await settleOnAir(banco.testId, { ...op('encerrado', { humano: true, forcar: true }), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(yt.escritas()).toEqual(['videos.update', 'thumbnails.set'])
    expect(banco.teste().restore_status).toMatchObject({ title: { forcado: true }, thumbnail: { forcado: true } })
  })
  it('destino original nunca pergunta (o passo 0b é só destino variante)', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Editado' } })
    const r = await settleOnAir(banco.testId, op('encerrado', { humano: true }), portas)
    expect(r.resultado).toBe('feito'); expect(banco.teste().restore_status.title!.estado).toBe('pulado_drift')
  })
  it('falha na leitura do passo 0b não impede: segue para a reivindicação', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Editado' } })
    yt.recusar('videos.list', 503, 'backendError')
    const r = await settleOnAir(banco.testId, { ...op('encerrado', { humano: true }), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(r.resultado).toBe('feito'); expect(banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', erro: { chamada: 'videos.list' } })
  })
})

describe('settleOnAir: falhas (21, P4a-I2, I20)', () => {
  it('P4a-I2: pausa com thumbnails.set 403 → estado paused, campo falhou com {status, reason, chamada}, aviso criado, ciclo fechado', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    yt.recusar('thumbnails.set', 403, 'forbidden', { corpo: 'token=abc' })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().status).toBe('paused')
    expect(banco.cicloFechado()).toMatchObject({ end_reason: 'pausa' })
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'falhou', erro: { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' }, attempts: 1, escreveu: false })
    expect(JSON.stringify(banco.teste().restore_status)).not.toMatch(/token=|https?:/)
    expect(avisos.enviados()).toHaveLength(1)
    expect(avisos.enviados()[0]!.message).toBe('A thumbnail do teste "Teste do Lab" não voltou ao original: o YouTube recusou. Corrija no YouTube Studio.')
  })
  it('combo: título ok e thumbnail recusada → feito, cada campo com o seu estado', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo' })
    yt.recusar('thumbnails.set', 403, 'forbidden')
    const r = await settleOnAir(banco.testId, op('pausa'), portas)
    expect(r.resultado).toBe('feito')
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'ok', escreveu: true, attempts: 0 }, thumbnail: { estado: 'falhou' } })
  })
  it('timeout no PUT → falhou com escreveu null (nunca false: contrato da E18) e erro {status 0, reason timeout}', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Título B' } })
    yt.atrasar('videos.update', 11_000)
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', escreveu: null, erro: { status: 0, reason: 'timeout', chamada: 'videos.update' } })
  })
  it('canal não identificado → os dois campos falhou/canal_nao_identificado, estado mudou mesmo assim (3.2) e nenhuma escrita', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', canal: 'nao_identificado' })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().status).toBe('paused')
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'falhou', erro: { motivo: 'canal_nao_identificado' } }, thumbnail: { estado: 'falhou', erro: { motivo: 'canal_nao_identificado' } } })
    expect(yt.escritas()).toEqual([])
  })
  it('videos.list sem o vídeo → os dois campos desistiu/video_inexistente, escreveu false, zero escrita, um aviso (chave sem intervalo)', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', videoApagado: true })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'desistiu', motivo: 'video_inexistente', escreveu: false }, thumbnail: { estado: 'desistiu', motivo: 'video_inexistente', escreveu: false } })
    expect(yt.escritas()).toEqual([]); expect(avisos.enviados()).toHaveLength(1)
    expect(avisos.enviados()[0]).toMatchObject({
      title: 'A/B: o Lab parou de restaurar o vídeo', priority: 3,
      message: 'O vídeo do teste "Teste do Lab" não foi encontrado no YouTube. O Lab não vai mais tentar restaurar o título e a thumbnail.',
    })
  })
  it('F-D10: falha na LEITURA (videos.list 503) → erro.chamada = videos.list (a faixa não pode afirmar o que está no ar)', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'title' })
    yt.recusar('videos.list', 503, 'backendError')
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', erro: { status: 503, chamada: 'videos.list' } })
    expect(avisos.enviados()[0]!.message).toContain('o Lab não conseguiu concluir')
  })
  it('hqdefault indisponível → thumbnail falhou/hqdefault_indisponivel', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'thumbnail' })
    yt.recusar('hqdefault', 404, 'x')
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'falhou', erro: { motivo: 'hqdefault_indisponivel' } })
  })
  it('original_title nulo → title.estado pulado_sem_original; nenhuma chamada videos.update (nem com "")', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'title', originalTitle: null, noAr: { titulo: 'Título B' } })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status.title!.estado).toBe('pulado_sem_original'); expect(yt.escritas()).not.toContain('videos.update')
  })
  it('título original de 100 caracteres com emoji, aspas e <script> é enviado byte a byte', async () => {
    const T = '🎬 "Roteiro" <script>alert(1)</script> '.padEnd(100, 'x')
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'title', originalTitle: T, noAr: { titulo: 'Título B' } })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(yt.corpoDoUltimoPut().snippet.title).toBe(T)
  })
  it('dHash nulo da variante é calculado na hora (15) e gravado: a variante sai com 16 hex e a decisão usa esse valor', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B }, variantes: { A: { thumbnail_dhash: null } } })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.variante('A').thumbnail_dhash).toMatch(/^[0-9a-f]{16}$/)
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'ok', escreveu: true })
  })
})

describe('avisarRestauracao (P-4, Y-P3)', () => {
  const rs = (estado: 'falhou' | 'desistiu', campos: Array<'title' | 'thumbnail'> = ['title'], motivo?: string): RestoreStatus =>
    Object.fromEntries(campos.map((c) => [c, { estado, destino: 'original', em: new Date(T0).toISOString(), forcado: false, escreveu: false, erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' }, attempts: 1, ...(motivo ? { motivo } : {}) }]))
  const teste = (seq: number) => ({ id: 'teste-1', site_id: SITE, name: 'Teste do Lab', restore_seq: seq })

  it('aviso de falha: um por restore_seq e campo (P-4); mesma chamada de novo → repetido; seq novo → enviado', async () => {
    const { banco } = await preparar()
    expect(await avisarRestauracao(banco.supabase, teste(1), rs('falhou'))).toBe('enviado')
    expect(await avisarRestauracao(banco.supabase, teste(1), rs('falhou'))).toBe('repetido')
    expect(await avisarRestauracao(banco.supabase, teste(2), rs('falhou'))).toBe('enviado')
    expect(avisos.enviados().map((a) => a.dedupKey)).toEqual(['ab-restore:teste-1:1:title', 'ab-restore:teste-1:2:title'])
  })
  it('dois campos em falhou → dois avisos (um por campo)', async () => {
    const { banco } = await preparar()
    await avisarRestauracao(banco.supabase, teste(1), rs('falhou', ['title', 'thumbnail']))
    expect(avisos.enviados()).toHaveLength(2)
  })
  it('sem destinatário e falha de envio sobem ao chamador e liberam a chave (a próxima tentativa avisa)', async () => {
    const { banco } = await preparar()
    fanOut.mockResolvedValueOnce({ total: 0, sent: 0, suppressed: 0, errors: [] })
    expect(await avisarRestauracao(banco.supabase, teste(1), rs('falhou'))).toBe('sem_destinatario')
    fanOut.mockResolvedValueOnce({ total: 2, sent: 0, suppressed: 0, errors: ['x'] })
    expect(await avisarRestauracao(banco.supabase, teste(1), rs('falhou'))).toBe('falha_de_envio')
    expect(await avisarRestauracao(banco.supabase, teste(1), rs('falhou'))).toBe('enviado')
  })
  it('desistiu: um aviso na transição, chave sem restore_seq; segunda vez com outro seq → repetido', async () => {
    const { banco } = await preparar()
    expect(await avisarRestauracao(banco.supabase, teste(1), rs('desistiu', ['title'], 'novo_teste'))).toBe('enviado')
    expect(await avisarRestauracao(banco.supabase, teste(5), rs('desistiu', ['title'], 'novo_teste'))).toBe('repetido')
    expect(avisos.enviados()).toHaveLength(1)
    expect(avisos.enviados()[0]).toMatchObject({
      dedupKey: expect.stringMatching(/^ab-restore-desistiu:teste-1:title:/), priority: 3,
      message: 'Outro teste começou no vídeo do teste "Teste do Lab". O Lab não vai mais tentar restaurar o título.',
    })
  })
  it('desistiu: thumbnail sozinha e falhou na mesma chamada convivem', async () => {
    const { banco } = await preparar()
    const mistura: RestoreStatus = { ...rs('falhou', ['title']), ...rs('desistiu', ['thumbnail'], 'video_inexistente') }
    await avisarRestauracao(banco.supabase, teste(1), mistura)
    expect(avisos.enviados().map((a) => a.message)).toEqual([
      'O título do teste "Teste do Lab" não voltou ao original: o YouTube recusou. Corrija no YouTube Studio.',
      'O vídeo do teste "Teste do Lab" não foi encontrado no YouTube. O Lab não vai mais tentar restaurar a thumbnail.',
    ])
  })
})

describe('Tarefa 6, rodada 1 (consertos dos pareceres)', () => {
  const YTIMG = 'https://i.ytimg.com/vi/yt-1/hqdefault.jpg'

  it('DEVE-1: original com URL do i.ytimg.com (sem cópia no Blob) e B no ar → pulado_sem_original, nenhuma escrita, dHash da original intacto', async () => {
    const { banco, yt, portas, op } = await preparar({
      status: 'active', testType: 'thumbnail', noAr: { dhash: H.B }, originalThumbnailUrl: YTIMG,
      variantes: { A: { blob_url: null, thumbnail_dhash: null } },
    })
    const r = await settleOnAir(banco.testId, op('pausa'), portas)
    expect(r.resultado).toBe('feito')
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'pulado_sem_original', escreveu: false })
    expect(yt.escritas()).toEqual([])
    expect(banco.variante('A').thumbnail_dhash).toBeNull()
  })
  it('DEVE-1: a blob_url da própria variante original apontando para o i.ytimg.com também é sem original (dHash guardado não salva)', async () => {
    const { banco, yt, portas, op } = await preparar({
      status: 'active', testType: 'thumbnail', noAr: { dhash: H.B }, originalThumbnailUrl: YTIMG,
      variantes: { A: { blob_url: YTIMG } },
    })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'pulado_sem_original', escreveu: false })
    expect(yt.escritas()).toEqual([])
  })
  it('DEVE-1: original sem blob_url mas com original_thumbnail_url do Blob (teste antigo) segue e escreve', async () => {
    const { banco, yt, portas, op } = await preparar({
      status: 'active', testType: 'thumbnail', noAr: { dhash: H.B }, originalThumbnailUrl: BLOB('A'),
      variantes: { A: { blob_url: null } },
    })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'ok', escreveu: true })
    expect(yt.escritas()).toEqual(['thumbnails.set'])
  })

  it('DEVE-3 (Phil): perda de vez depois de escrita aceita → Sentry com o parcial (title.escreveu true)', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo' })
    yt.depoisDeEscrever((c) => { if (c === 'videos.update') banco.incrementarSeq() })
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-settle: resultado perdido', expect.objectContaining({
      extra: expect.objectContaining({ restoreStatus: expect.objectContaining({ title: expect.objectContaining({ escreveu: true }) }) }),
    }))
  })
  it('perda de vez ANTES de qualquer escrita não vai ao Sentry', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'thumbnail', noAr: { dhash: H.B } })
    banco.antesDaReleitura(() => banco.incrementarSeq())
    await settleOnAir(banco.testId, op('pausa'), portas)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('DEVE-3 (Yannis): passo 4 guardado por restore_seq: outro escritor entre as escritas e o fim → resultado não gravado, Sentry, sem aviso nem import', async () => {
    const { banco, yt, portas, op } = await preparar({ status: 'active', testType: 'combo', noAr: { titulo: 'Título C', dhash: H.C } })
    // incrementa DEPOIS da última releitura: a 2ª escrita termina e o seq já não é o reivindicado
    yt.depoisDeEscrever((c) => { if (c === 'thumbnails.set') banco.incrementarSeq() })
    const r = await settleOnAir(banco.testId, { ...op('encerrado'), destino: { tipo: 'variante', id: 'B' } }, portas)
    expect(r.resultado).toBe('em_andamento')
    expect(banco.teste().restore_status).toMatchObject({ title: { estado: 'em_andamento' }, thumbnail: { estado: 'em_andamento' } })
    expect(banco.teste().winner_applied_at).toBeNull()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-settle: resultado perdido', expect.anything())
    expect(fanOut).not.toHaveBeenCalled()
    expect(portas.autoImportWinner).not.toHaveBeenCalled()
  })

  it('em final: o fim do campo, entre o claim e claim + 55 s (nunca antes do claim)', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'combo', relogioAvancaPorChamada: 5_000 })
    await settleOnAir(banco.testId, op('pausa'), portas)
    const claim = Date.parse(banco.teste().paused_at as string)
    for (const c of ['title', 'thumbnail'] as const) {
      const em = Date.parse(banco.teste().restore_status[c]!.em as string)
      expect(em).toBeGreaterThanOrEqual(claim)
      expect(em).toBeLessThanOrEqual(claim + 55_000)
    }
    expect(Date.parse(banco.teste().restore_status.thumbnail!.em as string)).toBeGreaterThan(claim) // pós-escrita, não o instante do claim
  })

  it('claim vazio com o status já fora de p_de → ja_encerrado; ainda em p_de (outro escritor) → em_andamento', async () => {
    const a = await preparar({ status: 'active', testType: 'title' })
    const retrato = (await a.banco.retratoAntigo()) as Retrato
    a.banco.setTeste({ status: 'paused' })
    expect((await settleOnAir(a.banco.testId, a.op('pausa'), { ...a.portas, lerRetrato: async () => retrato })).resultado).toBe('ja_encerrado')
    const b = await preparar({ status: 'active', testType: 'title' })
    const rb = (await b.banco.retratoAntigo()) as Retrato
    b.banco.incrementarSeq()
    expect((await settleOnAir(b.banco.testId, b.op('pausa'), { ...b.portas, lerRetrato: async () => rb })).resultado).toBe('em_andamento')
  })
  it('erro na releitura do status depois do claim vazio sobe (não vira ja_encerrado)', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'title' })
    const retrato = (await banco.retratoAntigo()) as Retrato
    banco.incrementarSeq()
    const quebrado = {
      rpc: (n: string, a: Record<string, unknown>) => (banco.supabase as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<unknown> }).rpc(n, a),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'banco fora' } }) }) }) }),
    } as unknown as SupabaseClient
    await expect(settleOnAir(banco.testId, op('pausa'), { ...portas, supabase: quebrado, lerRetrato: async () => retrato })).rejects.toThrow('banco fora')
  })

  it('fronteira F-D4: em_andamento há 119 s bloqueia; há exatamente 120 s reivindica', async () => {
    const a = await preparar({ status: 'paused', testType: 'thumbnail', anterior: { thumbnail: { estado: 'em_andamento', segundosAtras: 119 } }, noAr: { dhash: H.A } })
    expect((await settleOnAir(a.banco.testId, a.op('encerrado'), a.portas)).resultado).toBe('em_andamento')
    const b = await preparar({ status: 'paused', testType: 'thumbnail', anterior: { thumbnail: { estado: 'em_andamento', segundosAtras: 120 } }, noAr: { dhash: H.A } })
    expect((await settleOnAir(b.banco.testId, b.op('encerrado'), b.portas)).resultado).toBe('feito')
  })
  it('fronteira F-D3: folga de exatamente 25 s escreve; 24,999 s é tempo_esgotado', async () => {
    const a = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Título B' } })
    await settleOnAir(a.banco.testId, a.op('pausa', { prazo: a.portas.agora().getTime() + 25_000 }), a.portas)
    expect(a.banco.teste().restore_status.title).toMatchObject({ estado: 'ok', escreveu: true })
    const b = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Título B' } })
    await settleOnAir(b.banco.testId, b.op('pausa', { prazo: b.portas.agora().getTime() + 24_999 }), b.portas)
    expect(b.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', erro: { motivo: 'tempo_esgotado' }, escreveu: false })
  })

  it('porta padrão do token (sem `token` injetado): rejeição de ensureFreshToken → falhou/token; sucesso usa o accessToken', async () => {
    const a = await preparar({ status: 'active', testType: 'title' })
    ensureFreshToken.mockRejectedValueOnce(new Error('revogado'))
    const { token: _t, ...semToken } = a.portas
    await settleOnAir(a.banco.testId, a.op('pausa'), semToken)
    expect(a.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', erro: { motivo: 'token' }, escreveu: false })
    expect(ensureFreshToken).toHaveBeenCalledWith(SITE, 'youtube', 'UC1') // canal DONO do vídeo (video.youtube_channels.channel_id)
    const b = await preparar({ status: 'active', testType: 'title', noAr: { titulo: 'Título B' } })
    ensureFreshToken.mockResolvedValueOnce({ accessToken: 'tok' })
    const { token: _u, ...semToken2 } = b.portas
    await settleOnAir(b.banco.testId, b.op('pausa'), semToken2)
    expect(b.banco.teste().restore_status.title).toMatchObject({ estado: 'ok', escreveu: true })
  })

  describe('avisos', () => {
    const rs = (): RestoreStatus => ({ title: { estado: 'falhou', destino: 'original', em: new Date(T0).toISOString(), forcado: false, escreveu: false, erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' }, attempts: 1 } })
    const teste = { id: 'teste-1', site_id: SITE, name: 'Teste do Lab', restore_seq: 1 }
    it('fan-out que lança libera a chave: a próxima tentativa avisa', async () => {
      const { banco } = await preparar()
      fanOut.mockRejectedValueOnce(new Error('rede'))
      await expect(avisarRestauracao(banco.supabase, teste, rs())).rejects.toThrow('rede')
      expect(await avisarRestauracao(banco.supabase, teste, rs())).toBe('enviado')
    })
    it('tudo suprimido por dedup do fan-out → repetido (não falha de envio) e a chave continua gasta', async () => {
      const { banco } = await preparar()
      fanOut.mockResolvedValueOnce({ total: 1, sent: 0, suppressed: 1, errors: [] })
      expect(await avisarRestauracao(banco.supabase, teste, rs())).toBe('repetido')
      expect(await avisarRestauracao(banco.supabase, teste, rs())).toBe('repetido')
      expect(fanOut).toHaveBeenCalledTimes(1)
    })
  })
})

// ---------------------------------------------------------------------------
// P4b, Tarefa 3: novaTentativa
// ---------------------------------------------------------------------------
const ERRO = { status: 403, reason: 'forbidden', chamada: 'videos.update' } as const
const VIGIA = { siteId: SITE, origem: 'vigia' } as const
const HUMANO = { siteId: SITE, origem: 'humano' } as const
const H1 = 3_600
const falhou = (extra: CampoAnterior = {}): CampoAnterior => ({ estado: 'falhou', attempts: 1, erro: ERRO, escreveu: false, segundosAtras: 600, ...extra })

describe('novaTentativa', () => {
  it('vigia, attempts 1, YouTube recusa 403 → falhou com 2; mesmo teste de novo → desistiu/tres_falhas com 3 (P4b-I1)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou() } })
    c.yt.recusar('videos.update', 403, 'forbidden')
    expect((await novaTentativa(c.banco.testId, VIGIA, c.portas)).resultado).toBe('feito')
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', attempts: 2 })
    expect(c.banco.teste().status).toBe('completed')
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 })
  })
  it('vigia, quotaExceeded → falhou com o attempts, o em e o forcado de antes (P4b-I2)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou({ attempts: 2 }) } })
    const antes = structuredClone(c.banco.teste().restore_status.title!)
    c.yt.recusar('videos.update', 403, 'quotaExceeded')
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', attempts: 2, em: antes.em, forcado: antes.forcado, erro: { reason: 'quotaExceeded' } })
  })
  it('forcado true com em de 47 h e título editado por fora → escreve; com 49 h → pulado_drift sem escrever (P4b-I3)', async () => {
    const dentro = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: falhou({ forcado: true, destino: 'B', segundosAtras: 47 * H1 }) } })
    await novaTentativa(dentro.banco.testId, VIGIA, dentro.portas)
    expect(dentro.yt.escritas()).toEqual(['videos.update'])
    expect(dentro.banco.teste().restore_status.title).toMatchObject({ estado: 'ok', forcado: true })
    const fora = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: falhou({ forcado: true, destino: 'B', segundosAtras: 49 * H1 }) } })
    await novaTentativa(fora.banco.testId, VIGIA, fora.portas)
    expect(fora.yt.escritas()).toEqual([])
    expect(fora.banco.teste().restore_status.title).toMatchObject({ estado: 'pulado_drift', attempts: 1 })
  })
  it('humano, campo desistiu/tres_falhas → reivindicação com attempts 0; falha → falhou com 1', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 }) } })
    c.yt.recusar('videos.update', 403, 'forbidden')
    let vistos = -1
    c.yt.antesDeEscrever(() => { vistos = c.banco.teste().restore_status.title!.attempts as number })
    await novaTentativa(c.banco.testId, HUMANO, c.portas)
    expect(vistos).toBe(0)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', attempts: 1 })
  })
  it('humano, desistiu attempts 3, YouTube acerta → ok com attempts 0 (Y-8)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 }) } })
    await novaTentativa(c.banco.testId, HUMANO, c.portas)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'ok', attempts: 0 })
  })
  it('combo: só o campo pendente é tentado; vencedor só depois de o título dar ok', async () => {
    const c = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título A' }, anterior: { title: falhou({ destino: 'B', attempts: 0 }), thumbnail: { estado: 'ok', destino: 'B', attempts: 0 } } })
    const thumbAntes = structuredClone(c.banco.teste().restore_status.thumbnail)
    c.yt.recusar('videos.update', 403, 'forbidden')
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.banco.teste().winner_applied_at).toBeNull()
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', attempts: 1 })
    expect(c.banco.teste().restore_status.thumbnail).toEqual(thumbAntes)
    expect(c.yt.chamadas).not.toContain('thumbnails.set')
    c.yt.recusar('videos.update', 200, 'ok') // 2xx: o YouTube aceita
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.yt.escritas()).toEqual(['videos.update', 'videos.update'])
    expect(c.yt.chamadas).not.toContain('thumbnails.set')
    expect(c.banco.teste().winner_applied_at).not.toBeNull()
  })
  it('retry acerta o último campo de destino variante → winner_applied_at, applied_by manual, revert +7 d; autoImportWinner 1 vez; sem pendente → ja_encerrado (P4b-I6)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título A' }, anterior: { title: falhou({ destino: 'B' }) } })
    expect((await novaTentativa(c.banco.testId, HUMANO, c.portas)).resultado).toBe('feito')
    const t = c.banco.teste()
    expect(t).toMatchObject({ applied_by: 'manual' })
    expect(new Date(t.winner_applied_at!).getTime()).toBe(c.portas.agora().getTime())
    expect(new Date(t.revert_expires_at!).getTime() - c.portas.agora().getTime()).toBe(7 * 86_400_000)
    expect(c.portas.autoImportWinner).toHaveBeenCalledTimes(1)
    expect((await novaTentativa(c.banco.testId, HUMANO, c.portas)).resultado).toBe('ja_encerrado')
    expect(c.portas.autoImportWinner).toHaveBeenCalledTimes(1)
  })
  it('reversão que falhou e acerta → winner_applied_at, revert_expires_at e applied_by nulos', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, vencedor: 'B', reversivel: true, anterior: { title: falhou({ destino: 'original' }) } })
    c.banco.setTeste({ applied_by: 'manual' })
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.banco.teste()).toMatchObject({ winner_applied_at: null, revert_expires_at: null, applied_by: null })
  })
  it('paused com destino variante → ja_encerrado, zero chamadas de escrita', async () => {
    const c = await preparar({ status: 'paused', testType: 'title', noAr: { titulo: 'Título A' }, anterior: { title: falhou({ destino: 'B' }) } })
    expect((await novaTentativa(c.banco.testId, VIGIA, c.portas)).resultado).toBe('ja_encerrado')
    expect(c.yt.escritas()).toEqual([]); expect(c.banco.teste().restore_seq).toBe(0)
  })
  it('outro teste draft no mesmo vídeo → outro_teste, zero escrita (P4b-I10)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou() },
      outros: [{ id: 'outro', site_id: SITE, youtube_video_id: 'video-interno', status: 'draft', restore_seq: 0 }] })
    expect((await novaTentativa(c.banco.testId, VIGIA, c.portas)).resultado).toBe('outro_teste')
    expect(c.yt.escritas()).toEqual([]); expect(c.banco.teste().restore_seq).toBe(0)
    c.banco.setTeste({}); // outro teste concluído não bloqueia
  })
  it('destinos divergentes → destino_invalido e Sentry.captureMessage', async () => {
    const c = await preparar({ status: 'completed', testType: 'combo', anterior: { title: falhou({ destino: 'original' }), thumbnail: falhou({ destino: 'B' }) } })
    const r = await novaTentativa(c.banco.testId, HUMANO, c.portas)
    expect(r.resultado).toBe('destino_invalido')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('ab-nova-tentativa: destinos divergentes', expect.anything())
    expect(c.yt.escritas()).toEqual([])
  })
  it('destino_invalido pelo vigia → campo desistiu/destino_invalido, zero escrita no YouTube', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', anterior: { title: falhou({ destino: 'Z' }) } })
    expect((await novaTentativa(c.banco.testId, VIGIA, c.portas)).resultado).toBe('destino_invalido')
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'desistiu', motivo: 'destino_invalido' })
    expect(c.yt.chamadas).toEqual([])
    expect(c.banco.teste().restore_seq).toBe(1)
    expect((await novaTentativa(c.banco.testId, VIGIA, c.portas)).resultado).toBe('ja_encerrado') // uma vez só
  })
  it('Y-A7: destino_invalido pelo vigia, mas outro escritor mudou o restore_seq -> em_andamento, campo intacto (perdeu o CAS)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', anterior: { title: falhou({ destino: 'Z' }) } })
    const velho = await c.banco.retratoAntigo()
    c.banco.incrementarSeq() // o banco já está um restore_seq à frente do retrato lido
    const r = await novaTentativa(c.banco.testId, VIGIA, { ...c.portas, lerRetrato: async () => velho })
    expect(r.resultado).toBe('em_andamento')
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou' })
  })
  it('Y-A4: vigia sem tempo para escrever (tempo_esgotado) não gasta tentativa: falhou com o attempts, o em e o forcado de antes; sem chamada de escrita', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou({ attempts: 2 }) } })
    const antes = structuredClone(c.banco.teste().restore_status.title!)
    await novaTentativa(c.banco.testId, { ...VIGIA, prazo: T0 + 1_000 }, c.portas)
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', attempts: 2, em: antes.em, forcado: antes.forcado, erro: { motivo: 'tempo_esgotado' } })
  })
  it('active → ja_encerrado; sem pendente → ja_encerrado', async () => {
    const a = await preparar({ status: 'active', testType: 'title', anterior: { title: falhou() } })
    expect((await novaTentativa(a.banco.testId, VIGIA, a.portas)).resultado).toBe('ja_encerrado')
    const b = await preparar({ status: 'completed', testType: 'title', anterior: { title: { estado: 'ok' } } })
    expect((await novaTentativa(b.banco.testId, VIGIA, b.portas)).resultado).toBe('ja_encerrado')
    expect(a.yt.escritas()).toEqual([]); expect(b.yt.escritas()).toEqual([])
  })
  it('interrompido conta (F1/Y-1): vigia com attempts 2, escrita trava → em_andamento com 2; a conversão seguinte dá desistiu/tres_falhas com 3 e o vigia não tenta de novo', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou({ attempts: 2 }) } })
    c.banco.lancarDepoisDoClaim(new Error('trava'))
    await expect(novaTentativa(c.banco.testId, VIGIA, c.portas)).rejects.toThrow('trava')
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'em_andamento', attempts: 2 })
    c.banco.lancarDepoisDoClaim(null)
    c.rel.t += 20 * 60_000
    const convertido = converterInterrompido(c.banco.teste().restore_status.title as unknown as CampoRestauracao, c.portas.agora())!
    c.banco.setTeste({ restore_seq: 5, restore_status: { title: convertido } })
    expect(convertido).toMatchObject({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3, erro: 'interrompido' })
    const escritas = c.yt.escritas().length
    expect((await novaTentativa(c.banco.testId, VIGIA, c.portas)).resultado).toBe('ja_encerrado')
    expect(c.yt.escritas().length).toBe(escritas)
  })
  it('vigia forçando, a escrita trava → o campo convertido mantém forcado true (R-2)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: falhou({ forcado: true, destino: 'B' }) } })
    c.banco.lancarDepoisDoClaim(new Error('trava'))
    await expect(novaTentativa(c.banco.testId, VIGIA, c.portas)).rejects.toThrow('trava')
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'em_andamento', forcado: true })
  })
  it('settleOnAir num teste com restore_status.thumbnail.attempts 2 → em_andamento com attempts 0', async () => {
    const c = await preparar({ status: 'active', testType: 'thumbnail', anterior: { thumbnail: falhou({ attempts: 2 }) } })
    c.banco.lancarDepoisDoClaim(new Error('banco caiu'))
    await expect(settleOnAir(c.banco.testId, c.op('pausa'), c.portas)).rejects.toThrow('banco caiu')
    expect(c.banco.teste().restore_status.thumbnail).toMatchObject({ estado: 'em_andamento', attempts: 0 })
  })
  it('cota (Phil F5): forcado true, em de 40 h, cota → em, forcado e attempts iguais; 10 h depois (50 h) não força', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: falhou({ forcado: true, destino: 'B', attempts: 1, segundosAtras: 40 * H1 }) } })
    const antes = structuredClone(c.banco.teste().restore_status.title!)
    c.yt.recusar('videos.update', 403, 'quotaExceeded')
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', em: antes.em, forcado: true, attempts: 1 })
    c.rel.t += 10 * 3_600_000
    const escritas = c.yt.escritas().length
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.yt.escritas().length).toBe(escritas)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'pulado_drift' })
  })
  it('cota que dura mais de 72 h desde a âncora conta como falha', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou({ attempts: 1, segundosAtras: 73 * H1 }) } })
    c.yt.recusar('videos.update', 403, 'quotaExceeded')
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou', attempts: 2 })
  })
  it('cadeia (Y-3): histórico com forcado há 50 h e 1 h, campo.em de 1 h → não força; sem histórico usa o em do campo', async () => {
    const campo = falhou({ forcado: true, destino: 'B', segundosAtras: H1 })
    const com = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: campo },
      historico: [{ campo: 'title', horasAtras: 1, forcado: true }, { campo: 'title', horasAtras: 50, forcado: true }] })
    await novaTentativa(com.banco.testId, VIGIA, com.portas)
    expect(com.yt.escritas()).toEqual([]); expect(com.banco.teste().restore_status.title).toMatchObject({ estado: 'pulado_drift' })
    const sem = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: campo } })
    await novaTentativa(sem.banco.testId, VIGIA, sem.portas)
    expect(sem.yt.escritas()).toEqual(['videos.update'])
    const quebrada = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: campo },
      historico: [{ campo: 'title', horasAtras: 1, forcado: true }, { campo: 'title', horasAtras: 30, forcado: false }, { campo: 'title', horasAtras: 90, forcado: true }] })
    await novaTentativa(quebrada.banco.testId, VIGIA, quebrada.portas)
    expect(quebrada.yt.escritas()).toEqual(['videos.update']) // forcado = false quebra a cadeia: a âncora é o 1 h
  })
  it('Y-A2: cadeia cheia (10 linhas forçadas recentes) conta como "sim" vencido: não força, pulado_drift', async () => {
    const campo = falhou({ forcado: true, destino: 'B', segundosAtras: H1 })
    const dez = Array.from({ length: 10 }, (_, i) => ({ campo: 'title' as const, horasAtras: i + 1, forcado: true }))
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: campo }, historico: dez })
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.yt.escritas()).toEqual([])
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'pulado_drift' })
    const nove = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Editado' }, anterior: { title: campo }, historico: dez.slice(0, 9) })
    await novaTentativa(nove.banco.testId, VIGIA, nove.portas)
    expect(nove.yt.escritas()).toEqual(['videos.update']) // 9 linhas: a cadeia não está cheia, âncora na 9ª (9 h)
  })
  it('Y-A1: autorizar recebe o destino do retrato reivindicado; false → sem_permissao, zero claim e zero escrita', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título A' }, anterior: { title: falhou({ destino: 'B' }) } })
    const autorizar = vi.fn(async () => false)
    const r = await novaTentativa(c.banco.testId, { ...HUMANO, autorizar }, c.portas)
    expect(r.resultado).toBe('sem_permissao')
    expect(autorizar).toHaveBeenCalledWith('variante')
    expect(c.yt.escritas()).toEqual([]); expect(c.banco.teste().restore_seq).toBe(0)
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'falhou' })
    const ok = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título B' }, anterior: { title: falhou() } })
    const aut2 = vi.fn(async () => true)
    expect((await novaTentativa(ok.banco.testId, { ...HUMANO, autorizar: aut2 }, ok.portas)).resultado).toBe('feito')
    expect(aut2).toHaveBeenCalledWith('original')
  })
  it('Y-A5: winner_applied_at já preenchido, destino variante, retry acerta → autoImportWinner 0 vezes (Y-12)', async () => {
    const c = await preparar({ status: 'completed', testType: 'title', noAr: { titulo: 'Título A' }, vencedor: 'B', reversivel: true, anterior: { title: falhou({ destino: 'B' }) } })
    expect((await novaTentativa(c.banco.testId, HUMANO, c.portas)).resultado).toBe('feito')
    expect(c.banco.teste().restore_status.title).toMatchObject({ estado: 'ok' })
    expect(c.portas.autoImportWinner).not.toHaveBeenCalled()
  })
  it('combo title falhou + thumbnail pulado_teste_youtube → só o título é tentado (F10)', async () => {
    const c = await preparar({ status: 'completed', testType: 'combo', noAr: { titulo: 'Título B' }, anterior: { title: falhou(), thumbnail: { estado: 'pulado_teste_youtube', attempts: 0 } } })
    const thumbAntes = structuredClone(c.banco.teste().restore_status.thumbnail)
    await novaTentativa(c.banco.testId, VIGIA, c.portas)
    expect(c.yt.escritas()).toEqual(['videos.update'])
    expect(c.banco.teste().restore_status.thumbnail).toEqual(thumbAntes)
  })
  it('PODE-1: settleOnAir com thumbnail em_andamento de 3 min → um update converte em falhou/interrompido com o em antigo; a reivindicação usa restore_seq + 2 no fim', async () => {
    const c = await preparar({ status: 'paused', testType: 'thumbnail', noAr: { dhash: H.A }, anterior: { thumbnail: { estado: 'em_andamento', segundosAtras: 180, escreveu: null } } })
    const em = c.banco.teste().restore_status.thumbnail!.em
    await settleOnAir(c.banco.testId, c.op('encerrado'), c.portas)
    const conv = c.banco.atualizacoes.find((u) => u.tabela === 'ab_tests' && u.patch.restore_seq === 1)
    expect((conv!.patch.restore_status as RestoreStatus).thumbnail).toMatchObject({ estado: 'falhou', erro: 'interrompido', escreveu: null, em, attempts: 1 })
    expect(c.banco.teste().restore_seq).toBe(2)
  })
})
