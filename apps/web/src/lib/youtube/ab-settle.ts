import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import { camposDoTeste, paraRestoreStatus } from '@/lib/youtube/ab-restore'
import type { CampoNome, CampoRestauracao, ErroGravado, EstadoCampo, RestoreStatus } from '@/lib/youtube/ab-restore'
import { decidirCampo, ultimaEscritaDoApp } from '@/lib/youtube/ab-settle-decidir'
import type { Decisao, EntradaThumb, EntradaTitulo } from '@/lib/youtube/ab-settle-decidir'
import { dhashDasVariantes } from '@/lib/youtube/ab-variant-dhash'
import type { DhashDaVariante } from '@/lib/youtube/ab-variant-dhash'
import { escreverTitulo, lerSnippet } from '@/lib/youtube/ab-metadata'
import type { SnippetLido } from '@/lib/youtube/ab-metadata'
import { fetchVariantImageBuffer, setThumbnail } from '@/lib/youtube/ab-youtube'
import { avisarRestauracao } from '@/lib/youtube/ab-restore-avisos'
import type { ResultadoAviso } from '@/lib/youtube/ab-restore-avisos'
import { resolveVideoChannel, resolveYouTubeVideoId } from '@/lib/youtube/ab-video-context'
import { probeThumb, thumbUrl } from '@/lib/youtube/thumb-fingerprint'
import { autoImportWinner } from '@/lib/youtube/thumbnail-library'
import { ErroConhecido, YouTubeApiError, paraErroGravado } from '@/lib/youtube/youtube-api-error'

export type MotivoSaida = 'pausa' | 'encerrado' | 'reverter' | 'falha_api' | 'duracao_maxima' | 'drift'
export const ORIGINAL = { tipo: 'original' } as const

export interface OpcoesSaida {
  siteId: string // obrigatório (Y-D2): o retrato filtra .eq('site_id', siteId)
  destino: { tipo: 'original' } | { tipo: 'variante'; id: string }
  motivo: MotivoSaida
  forcar?: boolean
  humano?: boolean // ação humana: liga o passo 0b (precisa_confirmar)
  statusNote?: string // falha_api
  consecutiveFailures?: number // falha_api
  prazo?: number // epoch ms absoluto (F-D3, Y-D7); padrão início + 55_000
  seqEsperado?: number // Y-D13: o vigia passa o restore_seq lido
}

export type ResultadoSaida =
  | { resultado: 'feito'; campos: RestoreStatus; aviso?: ResultadoAviso } // aviso: 'sem_destinatario'/'falha_de_envio' sobem ao chamador (Y-P3)
  | { resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { resultado: 'ja_encerrado'; campos: RestoreStatus | null }
  | { resultado: 'em_andamento'; campos: RestoreStatus | null }
  | { resultado: 'destino_invalido'; campos: null }

export interface VarianteRetrato {
  id: string
  is_original: boolean
  blob_url: string | null
  title_text: string | null
  thumbnail_dhash: string | null
}

export interface Retrato {
  id: string
  site_id: string
  name: string
  test_type: string
  status: string
  restore_seq: number
  restore_status: RestoreStatus | null
  original_title: string | null
  original_thumbnail_url: string | null
  last_applied_variant_id: string | null
  winner_applied_at: string | null
  revert_expires_at: string | null
  youtube_video_id: string // id INTERNO de youtube_videos
  variantes: VarianteRetrato[]
  inicioUltimoCiclo: string | null
}

export interface PortasSaida {
  supabase: SupabaseClient
  agora: () => Date
  fetch: typeof fetch
  /** Embrulha ensureFreshToken; a PORTA converte a falha dele em ErroConhecido('token') (Y-D12). */
  token: (siteId: string, channelAccountId: string) => Promise<string>
  /** (testId, siteId): é a assinatura real de autoImportWinner (o brief dizia variantId). */
  autoImportWinner: (testId: string, siteId: string) => Promise<void>
  lerRetrato?: (testId: string, siteId: string) => Promise<Retrato | null>
}

const TETO_MS = 55_000 // F-D3: ações humanas e crons que não passam `prazo`
const MARGEM_ESCRITA_MS = 25_000 // 20 s da escrita + 5 s do passo 4 e do aviso
const RECENTE_MS = 2 * 60_000 // F-D4: 60 s do teto da função + folga
const REVERT_MS = 7 * 86_400_000

/**
 * Só uma URL do Blob é cópia imutável. A do i.ytimg.com serve o que está no ar AGORA, não o original
 * (testes anteriores à P4a gravaram `thumbnail_hq_url` como original). Mesma regra de ab-evaluate-phases,
 * ab-rotate-phases e ab-watchdog (`blob.vercel-storage.com`); quando o vigia antigo sair, fica só este.
 */
export function ehCopiaNoBlob(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    return new URL(url).hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

/** Fonte do original: a cópia do Blob da variante original ou a do teste; nula quando nenhuma é do Blob. */
function fonteDoOriginal(r: Retrato): string | null {
  const original = r.variantes.find((v) => v.is_original)
  return [original?.blob_url, r.original_thumbnail_url].find(ehCopiaNoBlob) ?? null
}

type Destino = 'original' | { varianteId: string }

/**
 * Normalização de `op.destino` (Y-D2, 3.1) contra as variantes do teste:
 *
 * | op.destino                                  | critério                         | normalizado          |
 * |---------------------------------------------|----------------------------------|----------------------|
 * | { tipo: 'original' }                        | —                                | 'original'           |
 * | { tipo: 'variante', id }                    | id é a variante `is_original`    | 'original'           |
 * | { tipo: 'variante', id }                    | id é outra variante DESTE teste  | { varianteId: id }   |
 * | { tipo: 'variante', id }                    | id não é variante deste teste    | null → destino_invalido |
 *
 * `restore_status.destino` guarda 'original' ou o id da variante.
 */
export function destinoNormalizado(destino: OpcoesSaida['destino'], variantes: VarianteRetrato[]): Destino | null {
  if (destino.tipo === 'original') return 'original'
  const v = variantes.find((x) => x.id === destino.id)
  if (!v) return null
  return v.is_original ? 'original' : { varianteId: v.id }
}

const nomeDoDestino = (d: Destino): string => (d === 'original' ? 'original' : d.varianteId)

interface Caminho { de: string[]; para: 'paused' | 'completed'; endReason: string | null; extra: Record<string, unknown> }

/** Tabela 3.1: os sete caminhos de saída do ar. */
function caminhoDe(op: OpcoesSaida, destino: Destino): Caminho {
  switch (op.motivo) {
    case 'pausa':
      return { de: ['active'], para: 'paused', endReason: 'pausa', extra: { status_note: null } }
    case 'encerrado':
      return {
        de: ['active', 'paused'], para: 'completed', endReason: 'encerrado',
        extra: destino === 'original'
          ? { completed_reason: 'manual_archive', winner_variant_id: null }
          : { completed_reason: 'manual_winner', winner_variant_id: destino.varianteId },
      }
    case 'reverter':
      return { de: ['completed'], para: 'completed', endReason: null, extra: {} }
    case 'falha_api':
      return {
        de: ['active'], para: 'paused', endReason: 'falha_api',
        extra: {
          status_note: op.statusNote ?? null,
          ...(op.consecutiveFailures !== undefined ? { consecutive_failures: op.consecutiveFailures } : {}),
        },
      }
    case 'duracao_maxima':
      return { de: ['active'], para: 'completed', endReason: 'duracao_maxima', extra: { completed_reason: 'inconclusive', limpar_confianca: true } }
    case 'drift':
      return { de: ['active'], para: 'paused', endReason: 'drift', extra: { status_note: DRIFT_STATUS_NOTE, limpar_drift_ack: true } }
  }
}

const TIPOS = ['thumbnail', 'title', 'combo'] as const
const tipoConhecido = (t: string): t is (typeof TIPOS)[number] => (TIPOS as readonly string[]).includes(t)

function portasPadrao(p: Partial<PortasSaida>): PortasSaida {
  return {
    supabase: p.supabase ?? getSupabaseServiceClient(),
    agora: p.agora ?? (() => new Date()),
    fetch: p.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
    token: p.token ?? (async (siteId, channelAccountId) => {
      try {
        return (await ensureFreshToken(siteId, 'youtube', channelAccountId)).accessToken
      } catch {
        throw new ErroConhecido('token') // Y-D12: falha do token é erro conhecido, vira falhou/token
      }
    }),
    autoImportWinner: p.autoImportWinner ?? (async (testId, siteId) => { await autoImportWinner(testId, siteId) }),
    ...(p.lerRetrato ? { lerRetrato: p.lerRetrato } : {}),
  }
}

// ---------------------------------------------------------------------------
// Passo 0: retrato
// ---------------------------------------------------------------------------

interface FilaTeste {
  id: string; site_id: string; name: string; test_type: string; status: string; restore_seq: number
  restore_status: unknown; original_title: string | null; original_thumbnail_url: string | null
  last_applied_variant_id: string | null; winner_applied_at: string | null; revert_expires_at: string | null
  youtube_video_id: string
}

export async function lerRetratoPadrao(supabase: SupabaseClient, testId: string, siteId: string): Promise<Retrato | null> {
  const { data: t, error } = await supabase
    .from('ab_tests')
    .select('id, site_id, name, test_type, status, restore_seq, restore_status, original_title, original_thumbnail_url, last_applied_variant_id, winner_applied_at, revert_expires_at, youtube_video_id')
    .eq('id', testId)
    .eq('site_id', siteId)
    .maybeSingle()
  if (error) throw new Error(`ab-settle: retrato do teste ${testId}: ${error.message}`)
  if (!t) return null
  const [vs, cs] = await Promise.all([
    supabase.from('ab_test_variants').select('id, is_original, blob_url, title_text, thumbnail_dhash').eq('test_id', testId),
    supabase.from('ab_test_cycles').select('started_at').eq('test_id', testId).order('cycle_number', { ascending: false }).limit(1),
  ])
  if (vs.error) throw new Error(`ab-settle: variantes do teste ${testId}: ${vs.error.message}`)
  if (cs.error) throw new Error(`ab-settle: ciclos do teste ${testId}: ${cs.error.message}`)
  const fila = t as FilaTeste
  return {
    ...fila,
    restore_status: paraRestoreStatus(fila.restore_status),
    variantes: (vs.data ?? []) as VarianteRetrato[],
    inicioUltimoCiclo: ((cs.data ?? []) as Array<{ started_at: string | null }>)[0]?.started_at ?? null,
  }
}

function emAndamentoRecente(rs: RestoreStatus | null, agora: Date): boolean {
  if (!rs) return false
  return (['title', 'thumbnail'] as const).some((c) => {
    const campo = rs[c]
    return campo?.estado === 'em_andamento' && agora.getTime() - Date.parse(campo.em) < RECENTE_MS
  })
}

function reversaoAberta(r: Retrato, agora: Date): boolean {
  return r.winner_applied_at !== null && r.revert_expires_at !== null && Date.parse(r.revert_expires_at) > agora.getTime()
}

// ---------------------------------------------------------------------------
// Passo 2: resolve e lê
// ---------------------------------------------------------------------------

interface Acesso { token: string; youtubeId: string }

/** Falha conhecida (ErroConhecido) sobe com o motivo da linha 6; o resto relança. */
async function resolverAcesso(portas: PortasSaida, r: Retrato): Promise<Acesso> {
  const canal = await resolveVideoChannel(portas.supabase, r.site_id, r.youtube_video_id)
  if (!canal.ok) throw new ErroConhecido('canal_nao_identificado')
  const token = await portas.token(r.site_id, canal.channelAccountId)
  const youtubeId = await resolveYouTubeVideoId(portas.supabase, r.youtube_video_id)
  if (!youtubeId) throw new ErroConhecido('video_fora_de_youtube_videos')
  return { token, youtubeId }
}

interface Leitura {
  snippet: { tipo: 'lido'; snippet: SnippetLido } | { tipo: 'video_inexistente' } | { tipo: 'falha'; erro: ErroGravado }
  thumb: { tipo: 'lido'; dhash: string } | { tipo: 'falha'; erro: ErroGravado } | null // null: o teste não tem thumbnail
  dhashes: Map<string, DhashDaVariante>
}

function variantesParaDhash(r: Retrato) {
  // A original só vale com cópia no Blob (a do teste serve para testes anteriores à P4a); sem ela, sem base.
  return r.variantes.map((v) => ({
    id: v.id,
    blob_url: v.is_original ? fonteDoOriginal(r) : v.blob_url,
    thumbnail_dhash: v.thumbnail_dhash,
  }))
}

async function lerNoYouTube(portas: PortasSaida, a: Acesso, r: Retrato, campos: CampoNome[]): Promise<Leitura> {
  const comThumb = campos.includes('thumbnail')
  const [snippet, thumb, dhashes] = await Promise.all([
    lerSnippet(a.youtubeId, a.token, portas.fetch).then(
      (s): Leitura['snippet'] => (s ? { tipo: 'lido', snippet: s } : { tipo: 'video_inexistente' }),
      (e: unknown): Leitura['snippet'] => {
        if (e instanceof YouTubeApiError) return { tipo: 'falha', erro: paraErroGravado(e) }
        throw e
      },
    ),
    comThumb
      ? probeThumb(a.youtubeId, null, portas.fetch).then(
          (p): NonNullable<Leitura['thumb']> => (p.dhash ? { tipo: 'lido', dhash: p.dhash } : { tipo: 'falha', erro: { motivo: 'hqdefault_indisponivel' } }),
          (): NonNullable<Leitura['thumb']> => ({ tipo: 'falha', erro: { motivo: 'hqdefault_indisponivel' } }),
        )
      : Promise.resolve(null),
    comThumb ? dhashDasVariantes(portas.supabase, variantesParaDhash(r), portas.fetch) : Promise.resolve(new Map<string, DhashDaVariante>()),
  ])
  return { snippet, thumb, dhashes }
}

function entrada(
  campo: CampoNome, r: Retrato, destino: Destino, l: Leitura,
  ctx: { ultimaEscrita: Date | null; marcador: string | null }, agora: Date, forcar: boolean,
): EntradaTitulo | EntradaThumb {
  const d = destino === 'original' ? 'original' : { varianteId: destino.varianteId }
  if (campo === 'title') {
    const atual: EntradaTitulo['atual'] =
      l.snippet.tipo === 'lido' ? { tipo: 'lido', valor: l.snippet.snippet.title }
        : l.snippet.tipo === 'falha' ? { tipo: 'falha', erro: l.snippet.erro } : { tipo: 'video_inexistente' }
    return { campo, destino: d, atual, originalTitle: r.original_title, variantes: r.variantes.map((v) => ({ id: v.id, title_text: v.title_text })), forcar }
  }
  const original = r.variantes.find((v) => v.is_original)
  const atual: EntradaThumb['atual'] =
    l.snippet.tipo === 'video_inexistente' ? { tipo: 'video_inexistente' }
      : l.snippet.tipo === 'falha' ? { tipo: 'falha', erro: l.snippet.erro }
        : (l.thumb ?? { tipo: 'falha', erro: { motivo: 'hqdefault_indisponivel' } })
  return {
    campo, destino: d, atual,
    originalNoBlob: fonteDoOriginal(r) !== null,
    dhashes: l.dhashes, idOriginal: original?.id ?? '', ultimaEscrita: ctx.ultimaEscrita, marcador: ctx.marcador, agora, forcar,
  }
}

const valorAtual = (campo: CampoNome, l: Leitura, a: Acesso): string =>
  campo === 'title' ? (l.snippet.tipo === 'lido' ? l.snippet.snippet.title : '') : thumbUrl(a.youtubeId)

// ---------------------------------------------------------------------------
// Passo 3: escreve, por campo, em série
// ---------------------------------------------------------------------------

async function lerSeq(portas: PortasSaida, testId: string): Promise<number | null> {
  const { data, error } = await portas.supabase.from('ab_tests').select('restore_seq').eq('id', testId).maybeSingle()
  if (error) throw new Error(`ab-settle: restore_seq do teste ${testId}: ${error.message}`)
  return (data as { restore_seq: number } | null)?.restore_seq ?? null
}

const CHAMADAS_DE_ESCRITA = ['videos.update', 'thumbnails.set']

/** erro conhecido → { erro, escreveu }; timeout/rede NO PUT = não se sabe (null); o resto relança (vira interrompido no vigia). */
function classificar(e: unknown): { erro: ErroGravado; escreveu: boolean | null } {
  if (e instanceof YouTubeApiError) {
    const incerto = e.status === 0 && (e.reason === 'timeout' || e.reason === 'rede') && CHAMADAS_DE_ESCRITA.includes(e.chamada)
    return { erro: paraErroGravado(e), escreveu: incerto ? null : false }
  }
  if (e instanceof ErroConhecido) return { erro: paraErroGravado(e), escreveu: false }
  throw e
}

interface Base { destino: string; forcado: boolean; anterior: number }

/**
 * `em` de um campo FINAL = instante em que o settle concluiu aquele campo (depois da escrita, quando houve):
 * fica entre a reivindicação (claim) e o claim + prazo (55 s). NÃO é o instante do claim (esse é o `em` do
 * `em_andamento`). Contrato com a E18 (versoes-origem.ts); não "conserte" para o instante do claim.
 */
function montarCampo(b: Base, agora: Date, p: { estado: EstadoCampo; escreveu: boolean | null; erro?: ErroGravado; motivo?: string | null }): CampoRestauracao {
  return {
    estado: p.estado, destino: b.destino, em: agora.toISOString(), forcado: b.forcado, escreveu: p.escreveu,
    ...(p.motivo ? { motivo: p.motivo } : {}),
    erro: p.erro ?? null,
    attempts: p.estado === 'falhou' ? 1 : b.anterior, // falhou = a chamada original; o resto herda
  }
}

async function restaurarCampos(
  portas: PortasSaida, r: Retrato, campos: CampoNome[], destino: Destino,
  contexto: (c: CampoNome) => { ultimaEscrita: Date | null; marcador: string | null },
  forcar: boolean, seq: number, prazo: number,
): Promise<RestoreStatus | { perdeu: true; parcial: RestoreStatus }> {
  const final: RestoreStatus = {}
  const base = (c: CampoNome): Base => ({ destino: nomeDoDestino(destino), forcado: forcar, anterior: r.restore_status?.[c]?.attempts ?? 0 })
  const todosFalharam = (erro: ErroGravado) => {
    for (const c of campos) final[c] = montarCampo(base(c), portas.agora(), { estado: 'falhou', escreveu: false, erro })
    return final
  }

  let acesso: Acesso
  try {
    acesso = await resolverAcesso(portas, r)
  } catch (e) {
    if (e instanceof ErroConhecido) return todosFalharam(paraErroGravado(e))
    throw e
  }
  const leitura = await lerNoYouTube(portas, acesso, r, campos)
  const decisoes = Object.fromEntries(
    campos.map((c) => [c, decidirCampo(entrada(c, r, destino, leitura, contexto(c), portas.agora(), forcar))]),
  ) as Record<CampoNome, Decisao>

  for (const c of campos) { // em série: título antes da thumbnail
    const d = decisoes[c]
    const b = base(c)
    const agora = () => portas.agora()
    if (d.acao === 'ok_sem_escrever') { final[c] = montarCampo(b, agora(), { estado: 'ok', escreveu: false }); continue }
    if (d.acao === 'pular') { final[c] = montarCampo(b, agora(), { estado: d.estado, escreveu: false, motivo: d.motivo }); continue }
    if (d.acao === 'desistir') { final[c] = montarCampo(b, agora(), { estado: 'desistiu', escreveu: false, motivo: d.motivo }); continue }
    if (d.acao === 'falhar') { final[c] = montarCampo(b, agora(), { estado: 'falhou', escreveu: false, erro: d.erro }); continue }

    // escrever: (a) prazo, (b) leitura do Blob (thumbnail), (c) releitura de restore_seq COLADA na escrita, (d) escrita
    if (prazo - portas.agora().getTime() < MARGEM_ESCRITA_MS) {
      final[c] = montarCampo(b, agora(), { estado: 'falhou', escreveu: false, erro: { motivo: 'tempo_esgotado' } })
      continue
    }
    try {
      let imagem: Awaited<ReturnType<typeof fetchVariantImageBuffer>> | null = null
      if (c === 'thumbnail') {
        const alvo = destino === 'original'
          ? fonteDoOriginal(r)
          : r.variantes.find((v) => v.id === destino.varianteId)?.blob_url
        if (!alvo) throw new ErroConhecido('erro_interno')
        try {
          imagem = await fetchVariantImageBuffer(alvo, portas.fetch)
        } catch (e) {
          // Erro simples (host bloqueado, URL inválida) nasce ANTES da escrita: vira falhou deste campo, o outro campo fica como está.
          if (e instanceof YouTubeApiError || e instanceof ErroConhecido) throw e
          Sentry.captureException(e, { tags: { area: 'ab-settle' }, extra: { testId: r.id, campo: c } })
          throw new ErroConhecido('erro_interno')
        }
      }
      if ((await lerSeq(portas, r.id)) !== seq) return { perdeu: true, parcial: final }
      if (c === 'title') {
        const titulo = destino === 'original' ? r.original_title : r.variantes.find((v) => v.id === destino.varianteId)?.title_text
        if (titulo == null) throw new ErroConhecido('titulo_vazio')
        await escreverTitulo(acesso.youtubeId, titulo, acesso.token, portas.fetch)
      } else if (imagem) {
        await setThumbnail(acesso.youtubeId, imagem.buffer, imagem.contentType, acesso.token, portas.fetch)
      }
      final[c] = montarCampo(b, agora(), { estado: 'ok', escreveu: true })
    } catch (e) {
      const k = classificar(e)
      final[c] = montarCampo(b, agora(), { estado: 'falhou', escreveu: k.escreveu, erro: k.erro })
    }
  }
  return final
}

// ---------------------------------------------------------------------------
// Passo 4: grava
// ---------------------------------------------------------------------------

async function gravarResultado(
  portas: PortasSaida, r: Retrato, seq: number, final: RestoreStatus, campos: CampoNome[],
  destino: Destino, op: OpcoesSaida,
): Promise<{ gravou: boolean; vencedorAplicado: boolean }> {
  const tudoOk = campos.every((c) => final[c]?.estado === 'ok')
  const agora = portas.agora()
  const patch: Record<string, unknown> = { restore_status: final }
  let vencedorAplicado = false
  if (op.motivo === 'reverter') {
    if (tudoOk) Object.assign(patch, { winner_applied_at: null, revert_expires_at: null, applied_by: null })
  } else if (destino !== 'original' && tudoOk) {
    vencedorAplicado = true
    Object.assign(patch, {
      winner_applied_at: agora.toISOString(), applied_by: 'manual',
      revert_expires_at: new Date(agora.getTime() + REVERT_MS).toISOString(),
    })
  }
  const { data, error } = await portas.supabase.from('ab_tests').update(patch).eq('id', r.id).eq('restore_seq', seq).select('id')
  if (error) throw new Error(`ab-settle: gravar resultado do teste ${r.id}: ${error.message}`)
  const gravou = ((data ?? []) as unknown[]).length > 0
  if (!gravou) {
    // As escritas já feitas ficam registradas aqui, sem token nem corpo (o erro já é só status/reason/chamada).
    Sentry.captureMessage('ab-settle: resultado perdido', { extra: { testId: r.id, seq, restoreStatus: final } })
  }
  return { gravou, vencedorAplicado: gravou && vencedorAplicado }
}

// ---------------------------------------------------------------------------
// settleOnAir
// ---------------------------------------------------------------------------

export async function settleOnAir(testId: string, op: OpcoesSaida, p: Partial<PortasSaida> = {}): Promise<ResultadoSaida> {
  const portas = portasPadrao(p)
  const agora = portas.agora()
  const prazo = op.prazo ?? agora.getTime() + TETO_MS // F-D3: absoluto
  const r = await (p.lerRetrato ?? ((id: string, site: string) => lerRetratoPadrao(portas.supabase, id, site)))(testId, op.siteId)
  if (!r) return { resultado: 'ja_encerrado', campos: null }

  // Validações, todas antes do passo 0b e da reivindicação.
  const destino = destinoNormalizado(op.destino, r.variantes)
  if (destino === null) return { resultado: 'destino_invalido', campos: null }
  if (op.seqEsperado !== undefined && op.seqEsperado !== r.restore_seq) return { resultado: 'em_andamento', campos: r.restore_status } // Y-D13
  if (emAndamentoRecente(r.restore_status, agora)) return { resultado: 'em_andamento', campos: r.restore_status } // F-D4
  const caminho = caminhoDe(op, destino)
  if (!tipoConhecido(r.test_type) || !caminho.de.includes(r.status)) return { resultado: 'ja_encerrado', campos: r.restore_status }
  if (op.motivo === 'reverter' && !reversaoAberta(r, agora)) return { resultado: 'ja_encerrado', campos: r.restore_status }

  const campos = camposDoTeste(r.test_type)
  // Antes da reivindicação: depois dela o `em` do próprio campo seria o do claim (F-P2, Review Focus 1).
  const contexto = (c: CampoNome) => ({
    ultimaEscrita: ultimaEscritaDoApp({ inicioUltimoCiclo: r.inicioUltimoCiclo, restoreStatus: r.restore_status, winnerAppliedAt: r.winner_applied_at }, c),
    marcador: r.last_applied_variant_id,
  })

  if (op.humano && destino !== 'original' && !op.forcar) { // passo 0b: decide a seco; falha na leitura não impede
    try {
      const acesso = await resolverAcesso(portas, r)
      const leitura = await lerNoYouTube(portas, acesso, r, campos)
      const perguntar = campos.flatMap((c) => {
        const d = decidirCampo(entrada(c, r, destino, leitura, contexto(c), portas.agora(), false))
        return d.acao === 'pular' && d.estado === 'pulado_drift' ? [{ campo: c, valor_atual: valorAtual(c, leitura, acesso) }] : []
      })
      if (perguntar.length) return { resultado: 'precisa_confirmar', campos: perguntar }
    } catch { /* o passo 3 decide */ }
  }

  // Passo 1: reivindica.
  const inicial: RestoreStatus = Object.fromEntries(campos.map((c) => [c, {
    estado: 'em_andamento', destino: nomeDoDestino(destino), forcado: op.forcar === true, escreveu: null, erro: null,
    em: agora.toISOString(), attempts: r.restore_status?.[c]?.attempts ?? 0,
  }]))
  const claim = await portas.supabase.rpc('ab_settle_claim', {
    p_test_id: testId, p_seq: r.restore_seq, p_de: caminho.de, p_para: caminho.para,
    p_end_reason: caminho.endReason, p_restore_status: inicial, p_extra: caminho.extra,
  })
  if (claim.error) throw new Error(`ab-settle: ab_settle_claim: ${claim.error.message}`)
  const seq = (claim.data as Array<{ claimed_seq: number }> | null)?.[0]?.claimed_seq
  if (seq === undefined) {
    const { data, error } = await portas.supabase.from('ab_tests').select('status').eq('id', testId).maybeSingle()
    if (error) throw new Error(`ab-settle: status do teste ${testId}: ${(error as { message: string }).message}`)
    const status = (data as { status: string } | null)?.status
    return status && caminho.de.includes(status) ? { resultado: 'em_andamento', campos: null } : { resultado: 'ja_encerrado', campos: null }
  }

  // Passos 2 e 3: só erro CONHECIDO vira falhou; o resto relança e o campo fica em_andamento para o vigia.
  const final = await restaurarCampos(portas, r, campos, destino, contexto, op.forcar === true, seq, prazo)
  if ('perdeu' in final) {
    // Outro escritor é dono do restore_status; mas escrita já aceita no YouTube não pode ficar sem rastro.
    if (campos.some((c) => final.parcial[c] && final.parcial[c]!.escreveu !== false)) {
      Sentry.captureMessage('ab-settle: resultado perdido', { extra: { testId: r.id, seq, restoreStatus: final.parcial } })
    }
    return { resultado: 'em_andamento', campos: null }
  }

  const { gravou, vencedorAplicado } = await gravarResultado(portas, r, seq, final, campos, destino, op)
  if (!gravou) return { resultado: 'em_andamento', campos: null }
  if (vencedorAplicado && r.winner_applied_at === null) { // 32 j: só na primeira aplicação
    await portas.autoImportWinner(testId, r.site_id).catch((e: unknown) => Sentry.captureException(e, { tags: { area: 'ab-settle' } }))
  }

  // Passo 5: avisos.
  const aviso = await avisarRestauracao(portas.supabase, { id: r.id, site_id: r.site_id, name: r.name, restore_seq: seq }, final)
    .catch((e: unknown) => { Sentry.captureException(e, { tags: { area: 'ab-settle' } }); return undefined })
  return { resultado: 'feito', campos: final, ...(aviso ? { aviso } : {}) }
}
