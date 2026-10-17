// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { settleOnAir, ORIGINAL, destinoNormalizado, lerRetratoPadrao } from '@/lib/youtube/ab-settle'
import type { OpcoesSaida, MotivoSaida, Retrato } from '@/lib/youtube/ab-settle'
import { avisarRestauracao } from '@/lib/youtube/ab-restore-avisos'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'
import { ErroConhecido } from '@/lib/youtube/youtube-api-error'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import { dhashOf, hamming } from '@/lib/youtube/thumb-fingerprint'
import { H, YouTubeFalso, imagemComDhash } from '../helpers/youtube-falso'
import * as Sentry from '@sentry/nextjs'

const { fanOut, ensureFreshToken } = vi.hoisted(() => ({ fanOut: vi.fn(), ensureFreshToken: vi.fn() }))
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
  constructor(private readonly linhas: Fila[], private readonly aoReler: () => void) {}
  select(cols?: string) { if (cols === 'restore_seq') this.aoReler(); this.devolve = true; return this }
  update(patch: Fila) { this.modo = 'update'; this.patch = patch; return this }
  delete() { this.modo = 'delete'; return this }
  eq(col: string, v: unknown) { this.filtros.push((f) => f[col] === v); return this }
  is(col: string, v: unknown) { this.filtros.push((f) => f[col] === v); return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordenar = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.limite = n; return this }
  private executar(): Fila[] {
    let hit = this.linhas.filter((f) => this.filtros.every((g) => g(f)))
    if (this.modo === 'update') hit.forEach((f) => Object.assign(f, this.patch))
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

function criarBanco(rel: { t: number }, inicial: { teste: Fila; variantes: Fila[]; ciclos: Fila[]; video: Fila }) {
  const tabelas: Record<string, Fila[]> = {
    ab_tests: [inicial.teste], ab_test_variants: inicial.variantes, ab_test_cycles: inicial.ciclos,
    youtube_videos: [inicial.video], ops_alert_state: [],
  }
  const log: string[] = []
  let claimed = false
  let queda: Error | null = null
  const ganchosReleitura: Array<() => void> = []
  const teste = () => tabelas.ab_tests[0] as TesteFake
  const supabase = {
    from(tabela: string) {
      if (queda && claimed && tabela === 'ab_tests') throw queda
      return new Consulta(tabelas[tabela]!, () => { log.push('releitura'); ganchosReleitura.forEach((g) => g()) })
    },
    rpc(nome: string, a: Record<string, unknown>) {
      if (nome === 'ops_alert_claim') {
        const k = String(a.p_key)
        if (tabelas.ops_alert_state.some((f) => f.key === k)) return Promise.resolve({ data: false, error: null })
        tabelas.ops_alert_state.push({ key: k }); return Promise.resolve({ data: true, error: null })
      }
      const t = teste(); const extra = a.p_extra as Fila
      if (t.id !== a.p_test_id || !(a.p_de as string[]).includes(t.status) || t.restore_seq !== a.p_seq) return Promise.resolve({ data: [], error: null })
      const agora = new Date(rel.t).toISOString(); const antes = t.status
      Object.assign(t, { status: a.p_para, restore_seq: t.restore_seq + 1, restore_status: a.p_restore_status, last_applied_variant_id: null, updated_at: agora })
      if (a.p_para === 'paused' && antes !== 'paused') t.paused_at = agora
      if (a.p_para === 'completed' && antes !== 'completed') t.completed_at = agora
      for (const k of ['status_note', 'completed_reason', 'winner_variant_id']) if (k in extra) t[k] = extra[k]
      if (extra.limpar_confianca) t.confidence_at_completion = null
      if (extra.limpar_drift_ack) t.drift_acknowledged_at = null
      if ('consecutive_failures' in extra) t.config = { ...t.config, consecutive_failures: extra.consecutive_failures }
      if (a.p_end_reason) tabelas.ab_test_cycles.filter((c) => c.ended_at == null).forEach((c) => Object.assign(c, { ended_at: agora, end_reason: a.p_end_reason }))
      claimed = true
      return Promise.resolve({ data: [{ claimed_seq: t.restore_seq, stamped_at: agora }], error: null })
    },
  } as unknown as SupabaseClient
  return {
    supabase, testId: String(inicial.teste.id), log, teste,
    setTeste: (p: Fila) => Object.assign(tabelas.ab_tests[0]!, p),
    variante: (id: string) => tabelas.ab_test_variants.find((v) => v.id === id) as Fila,
    cicloFechado: () => tabelas.ab_test_cycles.find((c) => c.ended_at != null) as Fila,
    incrementarSeq: () => { teste().restore_seq += 1 },
    antesDaReleitura: (g: () => void) => { ganchosReleitura.push(g) },
    lancarDepoisDoClaim: (e: Error) => { queda = e },
    retratoAntigo: () => lerRetratoPadrao(supabase, String(inicial.teste.id), SITE),
  }
}

// ---------------------------------------------------------------------------
interface CampoAnterior { estado?: string; attempts?: number; segundosAtras?: number }
interface Opcoes {
  status?: string; testType?: 'thumbnail' | 'title' | 'combo' | 'description'
  noAr?: { titulo?: string; dhash?: string }
  anterior?: { title?: CampoAnterior; thumbnail?: CampoAnterior }
  inicioUltimoCiclo?: '2 dias atrás'; originalTitle?: string | null
  vencedor?: 'B'; reversivel?: boolean; token?: 'recusado'; canal?: 'nao_identificado'
  videoApagado?: boolean; originalThumbnailUrl?: string | null; variantes?: { A?: Fila; B?: Fila }; relogioAvancaPorChamada?: number
}

function montar(o: Opcoes = {}) {
  const rel = { t: T0 }
  const iso = (ms: number) => new Date(ms).toISOString()
  const anterior = o.anterior && Object.fromEntries(Object.entries(o.anterior).map(([c, a]) => [c, {
    estado: a.estado ?? 'ok', destino: 'original', forcado: false, escreveu: true, erro: null, attempts: a.attempts ?? 0,
    em: iso(T0 - (a.segundosAtras ?? 86_400) * 1000),
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
  const banco = criarBanco(rel, { teste, variantes, ciclos, video })
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
  it('P4a-I3 (Y-D12): o banco cai depois do passo 1 → em_andamento com forcado, em, attempts do anterior; a exceção sobe', async () => {
    const { banco, portas, op } = await preparar({ status: 'active', testType: 'combo', anterior: { title: { attempts: 2 } } })
    banco.lancarDepoisDoClaim(new Error('banco caiu'))        // lança na primeira leitura de ab_tests depois do claim (a releitura de restore_seq)
    await expect(settleOnAir(banco.testId, op('pausa'), portas)).rejects.toThrow('banco caiu')
    expect(banco.teste().restore_status.title).toMatchObject({ estado: 'em_andamento', forcado: false, attempts: 2 })
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
      dedupKey: 'ab-restore-desistiu:teste-1:title', priority: 3,
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
