import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import { LIMITE_DA_CADEIA, camposDoTeste, camposPendentes, erroDeCota, inicioDoSim, paraRestoreStatus, proximaDoInterrompido, proximoDoVigia, simAindaVale } from '@/lib/youtube/ab-restore'
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
import { MOTIVO_RECUSA_NATIVO, lerLinhaConfirmada } from '@/lib/youtube/teste-youtube/nativo/guarda'
import { TEXTO_SEM_LEITURA as TEXTO_SEM_LEITURA_TELA } from '@/lib/youtube/teste-youtube/nativo/frases'
import { ErroConhecido, YouTubeApiError, paraErroGravado } from '@/lib/youtube/youtube-api-error'

export type MotivoSaida = 'pausa' | 'encerrado' | 'reverter' | 'falha_api' | 'duracao_maxima' | 'regra_v2' | 'drift' | 'teste_youtube'
/** Nota do teste pausado por haver teste do YouTube em andamento (F1a-dado): pausa definitiva, sem escrever no YouTube. */
export const NOTA_TESTE_YOUTUBE = 'Em teste no Studio: pausado sem escrever no YouTube'
/** Valor mostrado no diálogo de confirmação quando a leitura do título no YouTube falhou (a thumbnail sem leitura mostra o espaço reservado). */
export const TEXTO_SEM_LEITURA = TEXTO_SEM_LEITURA_TELA
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
  | { resultado: 'feito'; campos: RestoreStatus; aviso?: ResultadoAviso; pausadoPorTesteYoutube?: true } // aviso: 'sem_destinatario'/'falha_de_envio' sobem ao chamador (Y-P3)
  | { resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { resultado: 'ja_encerrado'; campos: RestoreStatus | null }
  | { resultado: 'em_andamento'; campos: RestoreStatus | null }
  | { resultado: 'destino_invalido'; campos: null }
  | { resultado: 'outro_teste'; campos: RestoreStatus | null } // P4b Y-5: outro teste aberto no mesmo vídeo; o Lab não escreve
  | { resultado: 'sem_permissao'; campos: RestoreStatus | null } // P4b Y-A1: `autorizar` recusou o destino do retrato reivindicado
  | { resultado: 'teste_youtube'; motivo: string; campos: null } // F1a-dado: teste do YouTube confirmado em andamento no vídeo; o Lab não escreve
  | { resultado: 'mudou'; campos: RestoreStatus | null } // seqEsperado de uma tela humana não bate: o teste mudou desde a abertura

export interface VarianteRetrato {
  id: string
  is_original: boolean
  blob_url: string | null
  title_text: string | null
  thumbnail_dhash: string | null
  label?: string
}

export interface Retrato {
  id: string
  site_id: string
  name: string
  test_type: string
  status: string
  status_note?: string | null
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
  varianteUltimoCiclo?: string | null
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

export const TETO_MS = 55_000 // F-D3: ações humanas e crons que não passam `prazo`
export const MARGEM_ESCRITA_MS = 25_000 // 20 s da escrita + 5 s do passo 4 e do aviso
const RECENTE_MS = 2 * 60_000 // F-D4: 60 s do teto da função + folga
const REVERT_MS = 7 * 86_400_000
const MOTIVOS_QUE_PAUSAM_SEM_ESCREVER: readonly MotivoSaida[] = ['pausa', 'falha_api', 'drift', 'duracao_maxima', 'regra_v2']
const JANELA_DA_COTA_MS = 72 * 3_600_000 // cota que dura mais que isso desde a âncora do "sim" conta como falha

/**
 * Só uma URL do Blob é cópia imutável. A do i.ytimg.com serve o que está no ar AGORA, não o original
 * (testes anteriores à P4a gravaram `thumbnail_hq_url` como original). Regra única: o vigia antigo (que repetia
 * o teste com `includes('blob.vercel-storage.com')`) saiu na T11.
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
      return { de: ['active'], para: 'completed', endReason: 'duracao_maxima', extra: { completed_reason: 'inconclusive', winner_variant_id: null, limpar_confianca: true, limpar_carencia: true, status_note: null } }
    case 'regra_v2':
      return { de: ['active'], para: 'completed', endReason: 'regra_v2', extra: { completed_reason: 'regra_v2', winner_variant_id: null, limpar_confianca: true, limpar_carencia: true, status_note: null } }
    case 'drift':
      return { de: ['active'], para: 'paused', endReason: 'drift', extra: { status_note: DRIFT_STATUS_NOTE, limpar_drift_ack: true } }
    case 'teste_youtube':
      return { de: ['active', 'paused'], para: 'paused', endReason: 'teste_youtube', extra: { status_note: NOTA_TESTE_YOUTUBE } }
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
  id: string; site_id: string; name: string; test_type: string; status: string; status_note: string | null; restore_seq: number
  restore_status: unknown; original_title: string | null; original_thumbnail_url: string | null
  last_applied_variant_id: string | null; winner_applied_at: string | null; revert_expires_at: string | null
  youtube_video_id: string
}

export async function lerRetratoPadrao(supabase: SupabaseClient, testId: string, siteId: string): Promise<Retrato | null> {
  const { data: t, error } = await supabase
    .from('ab_tests')
    .select('id, site_id, name, test_type, status, status_note, restore_seq, restore_status, original_title, original_thumbnail_url, last_applied_variant_id, winner_applied_at, revert_expires_at, youtube_video_id')
    .eq('id', testId)
    .eq('site_id', siteId)
    .maybeSingle()
  if (error) throw new Error(`ab-settle: retrato do teste ${testId}: ${error.message}`)
  if (!t) return null
  const [vs, cs] = await Promise.all([
    supabase.from('ab_test_variants').select('id, is_original, blob_url, title_text, thumbnail_dhash, label').eq('test_id', testId),
    supabase.from('ab_test_cycles').select('started_at, variant_id').eq('test_id', testId).order('cycle_number', { ascending: false }).limit(1),
  ])
  if (vs.error) throw new Error(`ab-settle: variantes do teste ${testId}: ${vs.error.message}`)
  if (cs.error) throw new Error(`ab-settle: ciclos do teste ${testId}: ${cs.error.message}`)
  const fila = t as FilaTeste
  return {
    ...fila,
    restore_status: paraRestoreStatus(fila.restore_status),
    variantes: (vs.data ?? []) as VarianteRetrato[],
    inicioUltimoCiclo: ((cs.data ?? []) as Array<{ started_at: string | null }>)[0]?.started_at ?? null,
    varianteUltimoCiclo: ((cs.data ?? []) as Array<{ variant_id: string | null }>)[0]?.variant_id ?? null,
  }
}

export function emAndamentoRecente(rs: RestoreStatus | null, agora: Date): boolean {
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

interface PoliticaVigia { cotaVencida: (c: CampoNome) => boolean }

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
  anterior: (c: CampoNome) => number, // Y-8: attempts dos estados finais ok/pulado_*: 0 no caminho humano, o da reivindicação no do vigia
  vigia?: PoliticaVigia,
): Promise<RestoreStatus | { perdeu: true; parcial: RestoreStatus }> {
  const final: RestoreStatus = {}
  const base = (c: CampoNome): Base => ({ destino: nomeDoDestino(destino), forcado: forcar, anterior: anterior(c) })
  const montar = (c: CampoNome, p: Parameters<typeof montarCampo>[2]): CampoRestauracao => {
    const campo = montarCampo(base(c), portas.agora(), p)
    const ant = r.restore_status?.[c]
    if (!vigia || !ant || p.estado !== 'falhou') return campo
    const erro = p.erro ?? null
    const vencida = vigia.cotaVencida(c)
    // Erro de cota (ainda dentro da janela): só o erro muda; em, forcado e attempts ficam (F5 do Phil).
    if (erroDeCota(erro) && !vencida) return { ...campo, em: ant.em, forcado: ant.forcado, attempts: ant.attempts }
    // Y-A4: sem tempo para tentar não é tentativa: nada foi pedido ao YouTube, então não gasta uma das 3.
    if (erro !== null && typeof erro === 'object' && 'motivo' in erro && erro.motivo === 'tempo_esgotado') return { ...campo, em: ant.em, forcado: ant.forcado, attempts: ant.attempts }
    const prox = proximoDoVigia(ant.attempts, erro, vencida)
    return { ...campo, estado: prox.estado, attempts: prox.attempts, ...(prox.motivo ? { motivo: prox.motivo } : {}) }
  }
  const todosFalharam = (erro: ErroGravado) => {
    for (const c of campos) final[c] = montar(c, { estado: 'falhou', escreveu: false, erro })
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
    if (d.acao === 'ok_sem_escrever') { final[c] = montar(c, { estado: 'ok', escreveu: false }); continue }
    if (d.acao === 'pular') { final[c] = montar(c, { estado: d.estado, escreveu: false, motivo: d.motivo }); continue }
    if (d.acao === 'desistir') { final[c] = montar(c, { estado: 'desistiu', escreveu: false, motivo: d.motivo }); continue }
    if (d.acao === 'falhar') { final[c] = montar(c, { estado: 'falhou', escreveu: false, erro: d.erro }); continue }

    // escrever: (a) prazo, (b) leitura do Blob (thumbnail), (c) releitura de restore_seq COLADA na escrita, (d) escrita
    if (prazo - portas.agora().getTime() < MARGEM_ESCRITA_MS) {
      final[c] = montar(c, { estado: 'falhou', escreveu: false, erro: { motivo: 'tempo_esgotado' } })
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
      final[c] = montar(c, { estado: 'ok', escreveu: true })
    } catch (e) {
      const k = classificar(e)
      final[c] = montar(c, { estado: 'falhou', escreveu: k.escreveu, erro: k.erro })
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

/**
 * PODE-1: campo em_andamento que chegou até aqui (a validação já recusou os de menos de 2 min) conta como
 * interrompido antes de a reivindicação o sobrescrever. Só banco (não usa ab_settle_claim: ele zera o marcador da rotação).
 */
async function converterEmAndamentoVelho(portas: PortasSaida, r: Retrato, rs: RestoreStatus | null = r.restore_status): Promise<{ seq: number; rs: RestoreStatus | null } | 'perdeu'> {
  const velhos = (['title', 'thumbnail'] as const).filter((c) => rs?.[c]?.estado === 'em_andamento')
  if (!rs || velhos.length === 0) return { seq: r.restore_seq, rs }
  const novo: RestoreStatus = { ...rs }
  for (const c of velhos) novo[c] = proximaDoInterrompido(rs[c]!)
  const { data, error } = await portas.supabase.from('ab_tests')
    .update({ restore_seq: r.restore_seq + 1, restore_status: novo }).eq('id', r.id).eq('restore_seq', r.restore_seq).select('id')
  if (error) throw new Error(`ab-settle: converter em_andamento velho do teste ${r.id}: ${error.message}`)
  if (((data ?? []) as unknown[]).length === 0) return 'perdeu'
  return { seq: r.restore_seq + 1, rs: novo }
}

// ---------------------------------------------------------------------------
// settleOnAir
// ---------------------------------------------------------------------------

/**
 * Motivo `teste_youtube`: pausa definitiva sem escrita (Yannis C1: pelo mesmo `ab_settle_claim`, que fecha o ciclo aberto e zera
 * `last_applied_variant_id` na mesma transação). Campo `ok` ou `pulado_*` fica como está (o histórico não pode negar uma escrita feita);
 * o resto vira `pulado_teste_youtube`. O restore_status já nasce final: o gatilho do histórico grava na mesma transação.
 */
async function gravarPuladoDefinitivo(portas: PortasSaida, r: Retrato, campos: CampoNome[], agora: Date): Promise<ResultadoSaida> {
  const base: Base = { destino: 'original', forcado: false, anterior: 0 }
  const final: RestoreStatus = {}
  for (const c of campos) {
    const ant = r.restore_status?.[c]
    final[c] = ant && (ant.estado === 'ok' || ant.estado.startsWith('pulado_'))
      ? ant
      : montarCampo(base, agora, { estado: 'pulado_teste_youtube', escreveu: false })
  }
  const claim = await portas.supabase.rpc('ab_settle_claim', {
    p_test_id: r.id, p_seq: r.restore_seq, p_de: ['active', 'paused'], p_para: 'paused',
    p_end_reason: 'teste_youtube', p_restore_status: final, p_extra: { status_note: NOTA_TESTE_YOUTUBE },
  })
  if (claim.error) throw new Error(`ab-settle: ab_settle_claim: ${claim.error.message}`)
  const seq = (claim.data as Array<{ claimed_seq: number }> | null)?.[0]?.claimed_seq
  if (seq === undefined) {
    const { data, error } = await portas.supabase.from('ab_tests').select('status').eq('id', r.id).maybeSingle()
    if (error) throw new Error(`ab-settle: status do teste ${r.id}: ${(error as { message: string }).message}`)
    const status = (data as { status: string } | null)?.status
    return status && ['active', 'paused'].includes(status) ? { resultado: 'em_andamento', campos: null } : { resultado: 'ja_encerrado', campos: null }
  }
  return { resultado: 'feito', campos: final, pausadoPorTesteYoutube: true } // pausa sem escrita: os chamadores não a tratam como a saída pedida
}

export async function settleOnAir(testId: string, op: OpcoesSaida, p: Partial<PortasSaida> = {}): Promise<ResultadoSaida> {
  const portas = portasPadrao(p)
  const agora = portas.agora()
  const prazo = op.prazo ?? agora.getTime() + TETO_MS // F-D3: absoluto
  const r = await (p.lerRetrato ?? ((id: string, site: string) => lerRetratoPadrao(portas.supabase, id, site)))(testId, op.siteId)
  if (!r) return { resultado: 'ja_encerrado', campos: null }

  // Validações, todas antes do passo 0b e da reivindicação.
  const destino = destinoNormalizado(op.destino, r.variantes)
  if (destino === null) return { resultado: 'destino_invalido', campos: null }
  if (op.seqEsperado !== undefined && op.seqEsperado !== r.restore_seq) return { resultado: op.humano ? 'mudou' : 'em_andamento', campos: r.restore_status } // Y-D13; D3: a tela humana recebe 'mudou'
  if (emAndamentoRecente(r.restore_status, agora)) return { resultado: 'em_andamento', campos: r.restore_status } // F-D4
  const caminho = caminhoDe(op, destino)
  if (!tipoConhecido(r.test_type) || !caminho.de.includes(r.status)) return { resultado: 'ja_encerrado', campos: r.restore_status }
  if (op.motivo === 'reverter' && !reversaoAberta(r, agora)) return { resultado: 'ja_encerrado', campos: r.restore_status }

  const campos = camposDoTeste(r.test_type)
  // Guarda do teste do YouTube confirmado (F1a-dado, Yannis C2; sem flag): ponto único de escrita do nosso teste. Dispensada quando o motivo já é `teste_youtube`.
  if (op.motivo !== 'teste_youtube' && (await lerLinhaConfirmada(portas.supabase, r.site_id, r.youtube_video_id)) !== null) {
    if (MOTIVOS_QUE_PAUSAM_SEM_ESCREVER.includes(op.motivo)) return gravarPuladoDefinitivo(portas, r, campos, agora)
    return { resultado: 'teste_youtube', motivo: MOTIVO_RECUSA_NATIVO, campos: null }
  }
  // Há teste do YouTube em andamento: pausa definitiva SEM escrever (antes de token, leitura e passo 0b).
  if (op.motivo === 'teste_youtube') return gravarPuladoDefinitivo(portas, r, campos, agora)
  // Saindo de uma pausa por teste do YouTube: a nota de guarda não vira razão do encerramento.
  if (op.motivo === 'encerrado' && r.status_note === NOTA_TESTE_YOUTUBE) caminho.extra = { ...caminho.extra, status_note: null }
  // Antes da reivindicação: depois dela o `em` do próprio campo seria o do claim (F-P2, Review Focus 1).
  const contexto = (c: CampoNome) => ({
    ultimaEscrita: ultimaEscritaDoApp({ inicioUltimoCiclo: r.inicioUltimoCiclo, restoreStatus: r.restore_status, winnerAppliedAt: r.winner_applied_at }, c),
    marcador: r.last_applied_variant_id,
  })

  // Depois de pulado_teste_youtube o original pode ter sido reaproveitado por uma variante nossa no YouTube: o passo 0b roda também com destino original.
  const aposTesteYoutube = destino === 'original' && campos.some((c) => r.restore_status?.[c]?.estado === 'pulado_teste_youtube')
  if (op.humano && (destino !== 'original' || aposTesteYoutube) && !op.forcar) { // passo 0b: decide a seco; falha na leitura não impede
    try {
      const acesso = await resolverAcesso(portas, r)
      const leitura = await lerNoYouTube(portas, acesso, r, campos)
      const perguntar = campos.flatMap((c) => {
        const d = decidirCampo(entrada(c, r, destino, leitura, contexto(c), portas.agora(), false))
        const pergunta = (d.acao === 'pular' && d.estado === 'pulado_drift') || (aposTesteYoutube && d.acao === 'escrever')
        return pergunta ? [{ campo: c, valor_atual: valorAtual(c, leitura, acesso) }] : []
      })
      if (perguntar.length) return { resultado: 'precisa_confirmar', campos: perguntar }
    } catch {
      // Depois de pulado_teste_youtube, sem a leitura o passo 3 poderia escrever o original sobre uma variante nossa no ar: pergunta em vez de seguir.
      if (aposTesteYoutube) return { resultado: 'precisa_confirmar', campos: campos.map((c) => ({ campo: c, valor_atual: c === 'title' ? TEXTO_SEM_LEITURA : '' })) }
      /* o passo 3 decide */
    }
  }

  // PODE-1: em_andamento velho (já com >= 2 min) conta a tentativa antes de ser sobrescrito.
  const conv = await converterEmAndamentoVelho(portas, r)
  if (conv === 'perdeu') return { resultado: 'em_andamento', campos: null }

  // Passo 1: reivindica.
  const inicial: RestoreStatus = Object.fromEntries(campos.map((c) => [c, {
    estado: 'em_andamento', destino: nomeDoDestino(destino), forcado: op.forcar === true, escreveu: null, erro: null,
    em: agora.toISOString(), attempts: 0, // abre corrente: nasce com 0
  }]))
  const claim = await portas.supabase.rpc('ab_settle_claim', {
    p_test_id: testId, p_seq: conv.seq, p_de: caminho.de, p_para: caminho.para,
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
  const final = await restaurarCampos(portas, r, campos, destino, contexto, op.forcar === true, seq, prazo, () => 0)
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

// ---------------------------------------------------------------------------
// novaTentativa (P4b): repete só os campos pendentes (falhou; e, a pedido humano, desistiu)
// ---------------------------------------------------------------------------

export interface OpcoesNovaTentativa {
  siteId: string
  origem: 'vigia' | 'humano'
  prazo?: number // epoch ms absoluto
  seqEsperado?: number
  /** Y-A1: decide a permissão sobre o destino do MESMO retrato que será reivindicado (a reivindicação exige o restore_seq dele). Lançar = recusar. */
  autorizar?: (destino: 'original' | 'variante') => Promise<boolean>
}

const ABERTOS_NO_VIDEO = ['draft', 'queued', 'active', 'paused']

/** Destino que nenhuma tentativa conseguiria cumprir: o vigia dá o campo por encerrado (F4), uma vez, guardado por restore_seq. */
async function desistirPorDestino(portas: PortasSaida, r: Retrato, rs: RestoreStatus, pend: CampoNome[]): Promise<boolean> {
  const novo: RestoreStatus = { ...rs }
  for (const c of pend) novo[c] = { ...rs[c]!, estado: 'desistiu', motivo: 'destino_invalido' }
  const { data, error } = await portas.supabase.from('ab_tests')
    .update({ restore_seq: r.restore_seq + 1, restore_status: novo }).eq('id', r.id).eq('restore_seq', r.restore_seq).select('id')
  if (error) throw new Error(`ab-settle: destino inválido do teste ${r.id}: ${error.message}`)
  return ((data ?? []) as unknown[]).length > 0 // false = perdeu o CAS: outro escritor é o dono, nada foi desistido
}

export async function novaTentativa(testId: string, op: OpcoesNovaTentativa, p: Partial<PortasSaida> = {}): Promise<ResultadoSaida> {
  const portas = portasPadrao(p)
  const agora = portas.agora()
  const prazo = op.prazo ?? agora.getTime() + TETO_MS
  const r = await (p.lerRetrato ?? ((id: string, site: string) => lerRetratoPadrao(portas.supabase, id, site)))(testId, op.siteId)
  if (!r) return { resultado: 'ja_encerrado', campos: null }

  // 1. validações
  if (op.seqEsperado !== undefined && op.seqEsperado !== r.restore_seq) return { resultado: op.origem === 'humano' ? 'mudou' : 'em_andamento', campos: r.restore_status }
  if (emAndamentoRecente(r.restore_status, agora)) return { resultado: 'em_andamento', campos: r.restore_status }

  // 2. estado e pendentes
  if (r.status === 'active' || !tipoConhecido(r.test_type)) return { resultado: 'ja_encerrado', campos: r.restore_status }
  const rs0 = r.restore_status
  const pend = camposPendentes(rs0, op.origem)
  if (!rs0 || pend.length === 0) return { resultado: 'ja_encerrado', campos: r.restore_status }

  // Guarda do teste do YouTube confirmado (F1a-dado, Yannis C2): nova tentativa escreveria no vídeo.
  if ((await lerLinhaConfirmada(portas.supabase, r.site_id, r.youtube_video_id)) !== null) return { resultado: 'teste_youtube', motivo: MOTIVO_RECUSA_NATIVO, campos: null }

  // 3. destino
  const alvos = new Set(pend.map((c) => rs0[c]!.destino))
  if (alvos.size !== 1) {
    Sentry.captureMessage('ab-nova-tentativa: destinos divergentes', { extra: { testId } })
    if (op.origem === 'vigia' && !(await desistirPorDestino(portas, r, rs0, pend))) return { resultado: 'em_andamento', campos: null }
    return { resultado: 'destino_invalido', campos: null }
  }
  const alvo = [...alvos][0]!
  const destino = destinoNormalizado(alvo === 'original' ? { tipo: 'original' } : { tipo: 'variante', id: alvo }, r.variantes)
  if (destino === null) {
    if (op.origem === 'vigia' && !(await desistirPorDestino(portas, r, rs0, pend))) return { resultado: 'em_andamento', campos: null }
    return { resultado: 'destino_invalido', campos: null }
  }

  if (op.autorizar && !(await op.autorizar(destino === 'original' ? 'original' : 'variante'))) return { resultado: 'sem_permissao', campos: r.restore_status }

  // 4. retomada que não terminou: nunca escrever rumo à variante num teste pausado
  if (r.status === 'paused' && destino !== 'original') return { resultado: 'ja_encerrado', campos: r.restore_status }

  // 5. Y-5: outro teste aberto no mesmo vídeo
  const outro = await portas.supabase.from('ab_tests').select('id')
    .eq('site_id', r.site_id).eq('youtube_video_id', r.youtube_video_id).neq('id', testId).in('status', ABERTOS_NO_VIDEO).limit(1)
  if (outro.error) throw new Error(`ab-settle: outro teste do vídeo ${r.youtube_video_id}: ${outro.error.message}`)
  if (((outro.data ?? []) as unknown[]).length > 0) return { resultado: 'outro_teste', campos: r.restore_status }

  // 6. o "sim" repetido: 48 h desde o primeiro forcado da cadeia (Y-3)
  const ancora: Partial<Record<CampoNome, string | null>> = {}
  for (const c of pend) {
    const h = await portas.supabase.from('ab_test_restores').select('em, forcado').eq('test_id', testId).eq('campo', c).order('seq', { ascending: false }).limit(LIMITE_DA_CADEIA)
    if (h.error) throw new Error(`ab-settle: histórico de ${c} do teste ${testId}: ${h.error.message}`)
    ancora[c] = inicioDoSim((h.data ?? []) as Array<{ em: string; forcado: boolean }>)
  }
  const forcar = pend.every((c) => simAindaVale(rs0[c]!, agora, ancora[c]))
  const cotaVencida = (c: CampoNome) => agora.getTime() - Date.parse(ancora[c] ?? rs0[c]!.em) >= JANELA_DA_COTA_MS

  // PODE-1 e 7. reivindica
  const conv = await converterEmAndamentoVelho(portas, r)
  if (conv === 'perdeu') return { resultado: 'em_andamento', campos: null }
  const rs = conv.rs ?? rs0
  const inicial: RestoreStatus = { ...rs }
  for (const c of pend) {
    inicial[c] = {
      estado: 'em_andamento', destino: nomeDoDestino(destino), forcado: forcar, escreveu: null, erro: null,
      em: agora.toISOString(), attempts: op.origem === 'humano' ? 0 : rs0[c]!.attempts,
    }
  }
  const claim = await portas.supabase.rpc('ab_settle_claim', {
    p_test_id: testId, p_seq: conv.seq, p_de: [r.status], p_para: r.status,
    p_end_reason: null, p_restore_status: inicial, p_extra: {},
  })
  if (claim.error) throw new Error(`ab-settle: ab_settle_claim: ${claim.error.message}`)
  const seq = (claim.data as Array<{ claimed_seq: number }> | null)?.[0]?.claimed_seq
  if (seq === undefined) {
    const { data, error } = await portas.supabase.from('ab_tests').select('status').eq('id', testId).maybeSingle()
    if (error) throw new Error(`ab-settle: status do teste ${testId}: ${(error as { message: string }).message}`)
    const status = (data as { status: string } | null)?.status
    return status === r.status ? { resultado: 'em_andamento', campos: null } : { resultado: 'ja_encerrado', campos: null }
  }

  // 8. tenta só os pendentes
  const contexto = (c: CampoNome) => ({
    ultimaEscrita: ultimaEscritaDoApp({ inicioUltimoCiclo: r.inicioUltimoCiclo, restoreStatus: r.restore_status, winnerAppliedAt: r.winner_applied_at }, c),
    marcador: r.last_applied_variant_id,
  })
  const parcial = await restaurarCampos(
    portas, { ...r, restore_status: rs }, pend, destino, contexto, forcar, seq, prazo,
    op.origem === 'humano' ? () => 0 : (c) => rs0[c]!.attempts,
    op.origem === 'vigia' ? { cotaVencida } : undefined,
  )
  if ('perdeu' in parcial) {
    if (pend.some((c) => parcial.parcial[c] && parcial.parcial[c]!.escreveu !== false)) {
      Sentry.captureMessage('ab-settle: resultado perdido', { extra: { testId: r.id, seq, restoreStatus: parcial.parcial } })
    }
    return { resultado: 'em_andamento', campos: null }
  }

  // 9. grava e decide o vencedor
  const final: RestoreStatus = { ...rs, ...parcial }
  const tudoOk = camposDoTeste(r.test_type).every((c) => final[c]?.estado === 'ok')
  const patch: Record<string, unknown> = { restore_status: final }
  let vencedorAplicado = false
  if (destino !== 'original' && tudoOk) {
    vencedorAplicado = true
    Object.assign(patch, {
      winner_applied_at: agora.toISOString(), applied_by: 'manual',
      revert_expires_at: new Date(agora.getTime() + REVERT_MS).toISOString(),
    })
  } else if (destino === 'original' && r.winner_applied_at !== null && tudoOk) {
    Object.assign(patch, { winner_applied_at: null, revert_expires_at: null, applied_by: null })
  }
  const { data, error } = await portas.supabase.from('ab_tests').update(patch).eq('id', r.id).eq('restore_seq', seq).select('id')
  if (error) throw new Error(`ab-settle: gravar resultado do teste ${r.id}: ${error.message}`)
  if (((data ?? []) as unknown[]).length === 0) {
    Sentry.captureMessage('ab-settle: resultado perdido', { extra: { testId: r.id, seq, restoreStatus: final } })
    return { resultado: 'em_andamento', campos: null }
  }
  if (vencedorAplicado && r.winner_applied_at === null) { // Y-12: só na primeira aplicação
    await portas.autoImportWinner(testId, r.site_id).catch((e: unknown) => Sentry.captureException(e, { tags: { area: 'ab-settle' } }))
  }
  return { resultado: 'feito', campos: final }
}
