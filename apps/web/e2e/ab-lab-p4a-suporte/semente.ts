// Semente determinística do A/B Lab P4a (T17). Cada teste semeia o SEU dado (nunca herda de outro) no Supabase local
// PADRÃO (54321/54322). Nada aqui toca produção: a URL do Supabase é conferida antes de qualquer escrita.
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SITE_SLUG = 'bythiagofigueiredo'
export const PREFIXO = '[e2e-p4a]'
export const CANAL_ID = 'UCe2eP4aCanal00000001'
export const MESTRE = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
export const MOCK = 'http://127.0.0.1:3098'

export const BLOB = {
  A: 'https://e2e.public.blob.vercel-storage.com/ab-p4a/A.png',
  B: 'https://e2e.public.blob.vercel-storage.com/ab-p4a/B.png',
  C: 'https://e2e.public.blob.vercel-storage.com/ab-p4a/C.png',
} as const
export const HASH = { A: 'f0f0f0f0f0f0f0f0', B: '00ff00ff00ff00ff', C: 'aaaaaaaaaaaaaaaa', FORA: '0f0f0f0f0f0f0f0f' } as const
export const TITULOS = { A: 'Como morar em Lisboa gastando pouco em 2026', B: 'Lisboa por menos de 1.200 euros por mês', C: 'Quanto custa viver em Lisboa de verdade' } as const

export function cliente(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url)) {
    throw new Error(`semente do A/B P4a: recusando Supabase que não é o local padrão (${url})`)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', Buffer.from(MESTRE, 'hex'), iv)
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}

// ── Relógio: instantes relativos a "agora", com a hora de São Paulo escrita à mão (SP é UTC-3 o ano todo desde 2019). ──
const pad = (n: number) => String(n).padStart(2, '0')
/** "12/10 05:02" para um instante, sem Intl e sem fuso do processo: UTC menos 3 h. */
export function horaSpManual(d: Date): string {
  const sp = new Date(d.getTime() - 3 * 3_600_000)
  return `${pad(sp.getUTCDate())}/${pad(sp.getUTCMonth() + 1)} ${pad(sp.getUTCHours())}:${pad(sp.getUTCMinutes())}`
}
/** Um instante no passado (há 3 a 5 dias) com a hora de SP pedida; estável dentro da execução, relativo ao dia de hoje. */
export function instanteSp(hora: number, minuto: number, diasAtras = 4): Date {
  const base = new Date(Date.now() - diasAtras * 86_400_000)
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hora + 3, minuto, 0))
}
export const minAtras = (m: number): string => new Date(Date.now() - m * 60_000).toISOString()

export interface CampoRs {
  estado: 'em_andamento' | 'ok' | 'falhou' | 'pulado_sem_original' | 'pulado_drift' | 'desistiu'
  destino: 'original' | 'B' | 'C' | 'A'
  em: string
  forcado?: boolean
  escreveu?: boolean | null
  motivo?: string | null
  erro?: unknown
  attempts?: number
}
export type RsSemente = { title?: CampoRs; thumbnail?: CampoRs } | null

export interface OpcoesTeste {
  nome: string
  status: 'active' | 'paused' | 'completed'
  tipo?: 'combo' | 'thumbnail' | 'title'
  restoreStatus?: RsSemente
  /** `restore_status` cru (já com ids), para o estado ilegível ou `{}`. */
  restoreStatusCru?: unknown
  tituloOriginal?: string | null
  ciclosFechados?: number
  /** Variante no ar agora (ciclo aberto): padrão C. */
  noAr?: 'A' | 'B' | 'C'
  completedReason?: string
  /** Não semear a cópia do original no Blob (pulado_sem_original da thumbnail). */
  semBlobOriginal?: boolean
  /** Variantes sem `thumbnail_dhash` (a leitura tenta o Blob; com o Blob 404 vira sem_base). */
  semDhash?: boolean
}

export interface TesteSemeado {
  testId: string
  siteId: string
  videoId: string
  youtubeId: string
  varA: string
  varB: string
  varC: string
  nome: string
  url: string
}

let _site: string | null = null
export async function siteId(db = cliente()): Promise<string> {
  if (_site) return _site
  const { data, error } = await db.from('sites').select('id').eq('slug', SITE_SLUG).single()
  if (error || !data) throw new Error(`site ${SITE_SLUG} não achado: ${error?.message}`)
  _site = data.id as string
  return _site
}

/** Canal + conexão OAuth FALSA (token cifrado com a chave mestra de teste, longe de expirar). Idempotente. */
export async function garantirCanalEConexao(db = cliente()): Promise<{ canalDb: string }> {
  const sid = await siteId(db)
  let { data: canal } = await db.from('youtube_channels').select('id').eq('site_id', sid).eq('channel_id', CANAL_ID).maybeSingle()
  if (!canal) {
    const r = await db.from('youtube_channels').insert({
      site_id: sid, channel_id: CANAL_ID, locale: 'pt', handle: '@e2e-p4a', name: 'Canal e2e P4a', uploads_playlist_id: 'UUe2eP4a000000000001',
    }).select('id').single()
    if (r.error || !r.data) throw new Error(`canal: ${r.error?.message}`)
    canal = r.data
  }
  const { data: con } = await db.from('social_connections').select('id').eq('site_id', sid).eq('provider', 'youtube').eq('account_id', CANAL_ID).maybeSingle()
  const linha = {
    site_id: sid, provider: 'youtube', account_id: CANAL_ID, account_name: 'Canal e2e P4a',
    access_token_enc: cifrar('token-falso-e2e'), refresh_token_enc: cifrar('refresh-falso-e2e'),
    token_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), revoked_at: null, scopes: ['youtube.force-ssl'],
  }
  const w = con ? await db.from('social_connections').update(linha).eq('id', con.id) : await db.from('social_connections').insert(linha)
  if (w.error) throw new Error(`conexão: ${w.error.message}`)
  return { canalDb: canal.id as string }
}

export async function limpar(db = cliente()): Promise<void> {
  const sid = await siteId(db)
  const { data: testes } = await db.from('ab_tests').select('id, youtube_video_id').eq('site_id', sid).like('name', `${PREFIXO}%`)
  const ids = (testes ?? []).map((t) => t.id as string)
  if (ids.length) {
    await db.from('ab_test_restores').delete().in('test_id', ids)
    await db.from('ab_test_cycles').delete().in('test_id', ids)
    await db.from('ab_test_polls').delete().in('test_id', ids)
    await db.from('ab_test_variants').delete().in('test_id', ids)
    await db.from('ab_tests').delete().in('id', ids)
    await db.from('youtube_videos').delete().in('id', (testes ?? []).map((t) => t.youtube_video_id as string))
  }
  await db.from('notifications').delete().eq('site_id', sid).like('title', 'A/B:%').then(() => undefined, () => undefined)
}

export function restoreStatusDe(rs: RsSemente, ids: { B: string; C: string; A: string }): unknown {
  if (rs === null) return null
  const campo = (c: CampoRs) => ({
    estado: c.estado,
    destino: c.destino === 'original' ? 'original' : ids[c.destino],
    em: c.em,
    forcado: c.forcado ?? false,
    escreveu: c.escreveu === undefined ? (c.estado === 'ok' ? true : false) : c.escreveu,
    motivo: c.motivo ?? null,
    erro: c.erro ?? null,
    attempts: c.attempts ?? (c.estado === 'falhou' ? 1 : 0),
  })
  return {
    ...(rs.title ? { title: campo(rs.title) } : {}),
    ...(rs.thumbnail ? { thumbnail: campo(rs.thumbnail) } : {}),
  }
}

export async function semearTeste(o: OpcoesTeste, db = cliente()): Promise<TesteSemeado> {
  const sid = await siteId(db)
  const { canalDb } = await garantirCanalEConexao(db)
  const tipo = o.tipo ?? 'combo'
  const youtubeId = randomUUID().replace(/-/g, '').slice(0, 11)
  const tituloOriginal = o.tituloOriginal === undefined ? TITULOS.A : o.tituloOriginal
  const v = await db.from('youtube_videos').insert({
    site_id: sid, channel_id: canalDb, youtube_video_id: youtubeId, title: tituloOriginal ?? 'Vídeo sem título original',
    published_at: new Date(Date.now() - 20 * 86_400_000).toISOString(), duration_seconds: 600,
  }).select('id').single()
  if (v.error || !v.data) throw new Error(`vídeo: ${v.error?.message}`)

  const t = await db.from('ab_tests').insert({
    site_id: sid, youtube_video_id: v.data.id, name: `${PREFIXO} ${o.nome}`, status: o.status, test_type: tipo,
    config: { max_duration_days: 14, confidence_threshold: 0.95, burn_in_days: 2, rotation_pattern: 'abba' },
    original_thumbnail_url: o.semBlobOriginal ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : BLOB.A,
    original_title: tituloOriginal,
    started_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    ...(o.status === 'paused' ? { paused_at: minAtras(30) } : {}),
    ...(o.status === 'completed' ? { completed_at: minAtras(30), completed_reason: o.completedReason ?? 'manual_archive' } : {}),
  }).select('id').single()
  if (t.error || !t.data) throw new Error(`teste: ${t.error?.message}`)

  const vars = await db.from('ab_test_variants').insert([
    { test_id: t.data.id, label: 'A', is_original: true, sort_order: 0, blob_url: o.semBlobOriginal ? null : BLOB.A, dimensions: '1280x720', title_text: tituloOriginal, thumbnail_dhash: o.semDhash ? null : HASH.A },
    { test_id: t.data.id, label: 'B', is_original: false, sort_order: 1, blob_url: BLOB.B, dimensions: '1280x720', title_text: TITULOS.B, thumbnail_dhash: o.semDhash ? null : HASH.B },
    { test_id: t.data.id, label: 'C', is_original: false, sort_order: 2, blob_url: BLOB.C, dimensions: '1280x720', title_text: TITULOS.C, thumbnail_dhash: o.semDhash ? null : HASH.C },
  ]).select('id, label')
  if (vars.error || !vars.data) throw new Error(`variantes: ${vars.error?.message}`)
  const id = (l: string) => vars.data.find((x) => x.label === l)!.id as string
  const ids = { A: id('A'), B: id('B'), C: id('C') }

  // Ciclos: dois fechados (A, B) e o aberto na variante no ar (padrão C), para a página não ser a "inicial" (EarlyDetail).
  const noAr = o.noAr ?? 'C'
  const fechados = o.ciclosFechados ?? 2
  const ciclos = [] as Array<Record<string, unknown>>
  const ordem: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']
  for (let n = 0; n < fechados; n++) {
    const ini = new Date(Date.now() - (fechados + 1 - n) * 86_400_000)
    ciclos.push({
      test_id: t.data.id, variant_id: ids[ordem[n % 3]!], cycle_number: n, started_at: ini.toISOString(),
      ended_at: new Date(ini.getTime() + 86_400_000 - 60_000).toISOString(), end_reason: 'rotacao',
      impressions: 4000 + n * 100, clicks: 200 + n * 7, ctr: 0.05, estimated_impressions: 4000 + n * 100, estimated_clicks: 200 + n * 7, estimated_ctr: 0.05,
      backfill_status: 'confirmed', views: 300, likes: 20,
    })
  }
  // Teste ativo: o último ciclo segue aberto. Encerrado/pausado: o código real fecha o ciclo no ar ao sair; a semente faz o mesmo.
  const inicioUltimo = new Date(Date.now() - 20 * 3_600_000)
  ciclos.push({
    test_id: t.data.id, variant_id: ids[noAr], cycle_number: fechados, started_at: inicioUltimo.toISOString(),
    ...(o.status === 'active' ? {} : { ended_at: new Date(inicioUltimo.getTime() + 19 * 3_600_000).toISOString(), end_reason: o.status === 'paused' ? 'pausa' : 'encerrado' }),
  })
  const c = await db.from('ab_test_cycles').insert(ciclos)
  if (c.error) throw new Error(`ciclos: ${c.error.message}`)

  const patch: Record<string, unknown> = { last_applied_variant_id: ids[noAr] }
  if (o.restoreStatusCru !== undefined) patch.restore_status = o.restoreStatusCru
  else if (o.restoreStatus !== undefined) patch.restore_status = restoreStatusDe(o.restoreStatus, ids)
  // L2 (Logan, T17 R2): o código real grava winner_variant_id + manual_winner ao encerrar com uma variante; sem isso a
  // página cai no guarda "encerrado sem vencedor" e mostra o cartão ao lado de "Variante B aplicada".
  if (o.status === 'completed' && o.restoreStatus && !o.completedReason) {
    const destinos = [o.restoreStatus.title?.destino, o.restoreStatus.thumbnail?.destino]
    const vencedora = destinos.find((d): d is 'B' | 'C' => d === 'B' || d === 'C')
    if (vencedora) { patch.winner_variant_id = ids[vencedora]; patch.completed_reason = 'manual_winner' }
  }
  const u = await db.from('ab_tests').update(patch).eq('id', t.data.id)
  if (u.error) throw new Error(`patch: ${u.error.message}`)

  return { testId: t.data.id as string, siteId: sid, videoId: v.data.id as string, youtubeId, varA: ids.A, varB: ids.B, varC: ids.C, nome: o.nome, url: `/cms/youtube/ab-lab/${t.data.id}` }
}

// ── Servidor falso do YouTube ──
export async function ctl(corpo: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${MOCK}/__ctl`, { method: 'POST', body: JSON.stringify(corpo) })
  if (!r.ok) throw new Error(`ctl ${JSON.stringify(corpo)} → ${r.status}`)
}
export interface EstadoFalso { pronto: boolean; chamadas: string[]; escritas: string[]; titulo: string; gravacoes: Array<{ chamada: string; em: string }> }
export async function estadoFalso(): Promise<EstadoFalso> {
  return (await (await fetch(`${MOCK}/__ctl/estado`)).json()) as EstadoFalso
}
/** YouTube falso no estado "variante C no ar": título e thumbnail da C, blobs A/B/C registrados. */
export async function youtubeNoEstadoC(extra: { titulo?: string; thumbDhash?: string } = {}): Promise<void> {
  await ctl({
    op: 'reset', titulo: extra.titulo ?? TITULOS.C, thumbDhash: extra.thumbDhash ?? HASH.C,
    blobs: { [BLOB.A]: HASH.A, [BLOB.B]: HASH.B, [BLOB.C]: HASH.C },
  })
}

export async function lerTeste(testId: string, db = cliente()) {
  const { data, error } = await db.from('ab_tests').select('status, restore_seq, restore_status, completed_reason, winner_variant_id, last_applied_variant_id').eq('id', testId).single()
  if (error || !data) throw new Error(`lerTeste: ${error?.message}`)
  return data as { status: string; restore_seq: number; restore_status: Record<string, { estado: string; destino: string; erro: unknown; forcado: boolean; escreveu: boolean | null; em: string }> | null; completed_reason: string | null; winner_variant_id: string | null; last_applied_variant_id: string | null }
}
