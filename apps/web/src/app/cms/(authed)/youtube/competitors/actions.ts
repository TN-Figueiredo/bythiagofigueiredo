'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { denyUnlessSiteAdmin } from '@/lib/cms/auth-guards'
import { getCompetitorRemovalImpact, semGuardarDe, type CompetitorRemovalImpact, type SemGuardar } from '@/lib/youtube/competitor-removal-impact'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { syncSchemaBlock } from '@/lib/youtube/competitor-sync-guard'
import { canalApagado, registrarVoltaDoCanal } from '@/lib/youtube/competitor-removed'
import { getChannelSlots, UNLOCK_STEP, type ChannelSlots } from '@/lib/youtube/competitor-slots'
import { loadRows, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { pedirRemocao, cancelarRemocao, apagarCanalSemGuardar } from '@/lib/youtube/observatorio/arquivo/remover'
import { lerImpactoDoArquivo, type ImpactoDoArquivo } from '@/lib/youtube/observatorio/arquivo/impacto-arquivo'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import { FRASES_E10 } from '@/lib/youtube/observatorio/arquivo/codigos'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'
import { createObservatory } from '@/lib/youtube/observatorio'
import { humanizeSyncError } from '@/lib/youtube/observatorio/channels'
import { BUILTIN_NICHES, isNicheSlug, nicheLabel, type Niche, type NicheDef } from '@/lib/youtube/observatorio/niche'
import { readNicheDefs } from '@/lib/youtube/observatorio/niches-db'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { PinResult } from './pin-result'
import type { SyncNowResult } from './_chrome/view-model'
import { parseChannelInput } from './_canais/channel-input'
import { MOTIVO, type CodigoTela } from './_canais/remover-model'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}
/** The same guard as requireEditAccess (it throws), for the writes that record who did them. */
async function requireEditUser(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, userId: res.user.id }
}

/** (A5 E10) a frase de quando a coleta do canal está pausada (a trava do sync não toma canal pausado). */
const FRASE_PAUSADA = 'A coleta deste canal está pausada, então não dá para fazer isto agora.'

const YT_API = 'https://www.googleapis.com/youtube/v3'
const BAD_INPUT = 'Use o @handle (ex.: @LukeDamant) ou a URL do canal (youtube.com/@…).'

/** @handle → channel id and title through the YouTube Data API (channels.list forHandle, 1 unit). */
async function resolveHandle(handle: string, apiKey: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch(`${YT_API}/channels?part=id,snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('YouTube API ' + res.status)
  const body = (await res.json()) as { items?: Array<{ id?: string; snippet?: { title?: string } }> }
  const it = body.items?.[0]
  return it?.id ? { id: it.id, title: it.snippet?.title ?? handle } : null
}

/**
 * "Adicionar canal": accepts the forms the Canais dialog accepts (and a bare id from the old modal). Refuses when there
 * is no free slot, when the channel is the site's own, and when it is already in the observatório (saying its niche).
 * The niche must be one of the site's (youtube_niches, read after the guard).
 */
export async function addCompetitorChannel(
  channelInput: string,
  niche?: Niche,
  videoLimit?: number,
): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots; title?: string; aviso?: string }> {
  const parsed = parseChannelInput(channelInput)
  if (!parsed) return { ok: false, error: BAD_INPUT }
  if (niche !== undefined && !isNicheSlug(niche)) return { ok: false, error: 'Nicho inválido.' }
  const limit = videoLimit === undefined ? undefined : Math.round(videoLimit)
  if (limit !== undefined && !(limit >= 10 && limit <= 200)) return { ok: false, error: 'Escolha entre 10 e 200 vídeos.' }

  let siteId: string
  let userId: string
  try { ({ siteId, userId } = await requireEditUser()) } catch { return { ok: false, error: 'forbidden' } }

  // o primeiro sync lê e grava colunas da MG2: sem as migrations, nada é gravado nem pedido ao YouTube
  const notReady = await syncSchemaBlock()
  if (notReady) return { ok: false, error: notReady }

  const supabase = getSupabaseServiceClient()
  // the site's niches (table absent → the two built-in). A read error is not "invalid niche": the niche could not be
  // checked, and nothing is added (never "any niche goes"); without a niche to check, the labels fall back to the built-in ones.
  const defs: NicheDef[] | null = await readNicheDefs(supabase, siteId).catch(() => null)
  if (niche !== undefined && !defs) return { ok: false, error: 'Não deu para conferir o nicho agora. Tente de novo em alguns minutos.' }
  if (niche !== undefined && !defs?.some(d => d.id === niche)) return { ok: false, error: 'Nicho inválido.' }

  const apiKey = process.env.YOUTUBE_API_KEY
  let ytId: string, title: string
  if (parsed.kind === 'id') { ytId = parsed.id; title = parsed.id }
  else {
    if (!apiKey) return { ok: false, error: 'A chave da API do YouTube não está configurada.' }
    let found: { id: string; title: string } | null
    try { found = await resolveHandle(parsed.handle, apiKey) } catch { return { ok: false, error: 'O YouTube não respondeu. Tente de novo em alguns minutos.' } }
    if (!found) return { ok: false, error: `Canal não encontrado no YouTube: confira o ${parsed.handle}.` }
    ytId = found.id; title = found.title
  }

  const { data: owns } = await supabase.from('youtube_channels').select('id, channel_id').eq('site_id', siteId)
  const ownList: Array<{ channel_id: string }> = owns ?? []
  if (ownList.some(o => o.channel_id === ytId)) return { ok: false, error: (ownList.length > 1 ? 'Esse é um dos seus canais' : 'Esse é o seu canal') + ': ele já aparece na tabela e não ocupa vaga.' }

  const { data: existing } = await supabase
    .from('competitor_channels')
    .select('id, niche, channel_name, removal_requested_at')
    .eq('site_id', siteId)
    .eq('channel_id', ytId)
    .maybeSingle()

  if (existing) {
    // F1 do Remover canal: o pedido aberto é conferido ANTES da conta de vagas e do insert (sem segunda linha nem chave única crua)
    if (existing.removal_requested_at) return { ok: false, error: 'Este canal está agendado para ser apagado. Use Desfazer para mantê-lo.' }
    const en = existing.niche as string | null
    const known = defs ?? BUILTIN_NICHES
    const n = en != null && known.some(d => d.id === en) ? ` (${nicheLabel(known, en)})` : ''
    return { ok: false, error: `${existing.channel_name || title} já está no observatório${n}.` }
  }

  // (A5 E9, D-11) O dono apagou este canal pela fila "Saíram do YouTube"? Não dá para saber = não adiciona (na dúvida não se coleta).
  // Achou: segue para as vagas e o insert; a volta só é registrada DEPOIS do insert (sem vaga, não fica auditoria de uma volta que não houve).
  const apagado = await canalApagado(supabase, siteId, ytId)
  if (apagado !== null && 'erro' in apagado) return { ok: false, error: 'Não foi possível conferir se este canal já foi apagado. Nada foi adicionado. Tente de novo.' }

  // after the duplicate check: a channel already in the observatório says so even when there is no free slot
  const before = await getChannelSlots(siteId)
  if (before.free === 0) return { ok: false, error: `Sem vagas: ${before.used} de ${before.limit} concorrentes. Remova um canal para adicionar outro.`, slots: before }

  const { data: inserted, error } = await supabase.from('competitor_channels').insert({
    site_id: siteId,
    channel_id: ytId,
    channel_name: title,
    ...(niche ? { niche } : {}),
    ...(limit !== undefined ? { video_limit: limit } : {}),
  }).select('id, channel_id, site_id').single()

  if (error) return { ok: false, error: error.message }

  // The first sync takes up to a minute (videos, thumbnails, Shorts probes): it runs after the answer, so the dialog
  // closes at once and the row shows "buscando vídeos" until it ends. A failure is non-fatal: the channel was added
  // and the cron syncs it in the next round.
  if (apiKey && inserted) {
    after(async () => {
      try { await syncCompetitorChannel(inserted, apiKey) } catch (err) {
        Sentry.captureException(err, { tags: { component: 'competitors', step: 'first-sync' }, extra: { channelId: inserted.channel_id, siteId } })
      } finally {
        // the cached rows of this site were read before, or during, this sync
        invalidateObservatory(siteId)
      }
    })
  }

  // (A5 E9) a volta do canal apagado: o canal entra de novo como novo (sem o histórico); o item da fila fica com a decisão "voltar"
  let aviso: string | undefined
  if (apagado !== null) {
    const agora = new Date().toISOString()
    let falha = await registrarVoltaDoCanal(supabase, siteId, apagado.itemId, agora)
    if (falha === null) {
      let orgId: string | null = null
      try { orgId = (await getSiteContext()).orgId ?? null } catch { /* sem org: a linha de auditoria leva site_id */ }
      const aud = await supabase.from('audit_log').insert({
        actor_user_id: userId, action: 'competitor_return_follow', resource_type: 'competitor_removed_item', resource_id: null,
        org_id: orgId, site_id: siteId, after_data: { kind: 'canal', youtube_id: ytId },
      })
      falha = aud.error ? aud.error.message : null
    }
    if (falha !== null) {
      // o canal fica (nenhuma rotina lê return_decision de canal); a falha vai ao Sentry com o código, sem o nome do canal
      Sentry.captureException(new Error('competitors: volta do canal apagado não registrada'), { tags: { component: 'competitors', step: 'return-follow' }, extra: { siteId, itemId: apagado.itemId } })
      aviso = 'O canal foi adicionado, mas a volta dele não ficou registrada na fila “Saíram do YouTube”.'
    } else {
      const quando = new Date(apagado.apagadoEm)
      const dd = Number.isNaN(quando.getTime()) ? null : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(quando)
      aviso = `Você apagou este canal${dd ? ` em ${dd}` : ''}; ele entra de novo como novo, sem o histórico.`
    }
  }

  revalidatePath('/cms/youtube/competitors', 'layout')
  // the resolved YouTube title; a bare id has none until the first sync
  return { ok: true, slots: await getChannelSlots(siteId), ...(parsed.kind === 'handle' ? { title } : {}), ...(aviso ? { aviso } : {}) }
}

/** The Canais dialog's submit (one object, so the client passes what it validated). */
export async function addChannelFromCanais(input: { channel: string; niche: Niche; videoLimit: number }): Promise<{ ok: boolean; error?: string; title?: string; aviso?: string }> {
  if (!input || typeof input.channel !== 'string' || typeof input.videoLimit !== 'number') return { ok: false, error: 'Pedido inválido.' }
  const res = await addCompetitorChannel(input.channel, input.niche, input.videoLimit)
  return { ok: res.ok, ...(res.error ? { error: res.error } : {}), ...(res.title ? { title: res.title } : {}), ...(res.aviso ? { aviso: res.aviso } : {}) }
}

/** O que as 3 actions de remoção devolvem: a recusa traz o CÓDIGO e a frase do catálogo (nunca texto do banco). */
export type RespostaRemocao<T> = ({ ok: true } & T) | { ok: false; codigo: CodigoTela; frase: string }

const FRASE_LEITURA = 'Não deu para conferir o canal agora. Nada mudou. Tente de novo.'
const recusa = (codigo: CodigoTela, frase: string): { ok: false; codigo: CodigoTela; frase: string } => ({ ok: false, codigo, frase })

/**
 * (A5 E9 T9) o canal que saiu do YouTube, ou que tem vídeo/comentário esperando resposta, é respondido na aba "Saíram do YouTube": remover por
 * aqui apagaria sem Blob, sem registro e sem auditoria. Leitura que falha: não remove sem saber. null = pode seguir.
 */
async function travaDoSaiu(supabase: ReturnType<typeof getSupabaseServiceClient>, siteId: string, id: string): Promise<{ ok: false; codigo: CodigoTela; frase: string } | null> {
  try {
    const canal = await supabase.from('competitor_channels').select('id, missing_since').eq('id', id).eq('site_id', siteId).limit(1)
    if (canal.error || !Array.isArray(canal.data)) return recusa('leitura', FRASE_LEITURA)
    const linha: unknown = canal.data[0]
    if (typeof linha === 'object' && linha !== null && (linha as Record<string, unknown>).missing_since != null) {
      return recusa('saiu_do_youtube', FRASES_E10.saiu_do_youtube)
    }
    const [videos, comentarios] = await Promise.all([
      supabase.from('competitor_videos').select('id, competitor_channels!inner(site_id)', { count: 'exact', head: true })
        .eq('competitor_channel_id', id).eq('competitor_channels.site_id', siteId).not('missing_since', 'is', null).is('removal_decision', null),
      supabase.from('competitor_video_comments').select('id', { count: 'exact', head: true })
        .eq('site_id', siteId).eq('competitor_channel_id', id).not('missing_since', 'is', null).is('removal_decision', null),
    ])
    if (videos.error || comentarios.error || videos.count === null || comentarios.count === null) return recusa('leitura', FRASE_LEITURA)
    const esperando = videos.count + comentarios.count
    if (esperando > 0) {
      return recusa('itens_na_fila', `Este canal tem ${esperando} ${esperando === 1 ? 'item esperando' : 'itens esperando'} resposta na aba Saíram do YouTube: responda primeiro.`)
    }
  } catch {
    return recusa('leitura', FRASE_LEITURA)
  }
  return null
}

/**
 * A guarda das 3 actions de remoção: administrar o site (antes de qualquer cliente de serviço, falha fechada), id válido, e o ator da sessão.
 * Devolve a recusa pronta ou o que a action precisa.
 */
async function guardaDaRemocao(id: string, acao: string): Promise<{ ok: false; codigo: CodigoTela; frase: string } | { ok: true; siteId: string; userId: string }> {
  const denied = await denyUnlessSiteAdmin((await getSiteContext()).siteId, acao)
  if (denied) return recusa('sem_direito', denied.error)
  if (typeof id !== 'string' || !UUID_RE.test(id)) return recusa('leitura', FRASE_LEITURA)
  try {
    const { siteId, userId } = await requireEditUser()
    return { ok: true, siteId, userId }
  } catch {
    return recusa('sem_direito', FRASES_E10.sem_direito)
  }
}

/** Depois de qualquer chamada à F1 (sucesso, falha ou exceção) o pacote em cache de 15 min não pode sobreviver: a lista leria a linha velha. */
function soltarCache(siteId: string): void {
  invalidateObservatory(siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
}

/** Caminho 2 do "Remover canal": pausa na hora, libera a vaga e agenda o histórico para o NAS. O comando do agente termina o serviço. */
export async function pedirRemocaoCanal(id: string): Promise<RespostaRemocao<{ jaPedido: boolean }>> {
  const g = await guardaDaRemocao(id, 'agendar a guarda de um canal concorrente no NAS')
  if (!g.ok) return g
  const supabase = getSupabaseServiceClient()
  const trava = await travaDoSaiu(supabase, g.siteId, id)
  if (trava) return trava
  try {
    const r = await pedirRemocao(supabase, { siteId: g.siteId, canalId: id, actorId: g.userId, motivo: MOTIVO.guardar })
    return r.ok ? { ok: true, jaPedido: r.jaPedido } : recusa(r.codigo, r.frase)
  } finally {
    soltarCache(g.siteId)
  }
}

/** Desfazer: escrita condicional na F1 (`nao_pedido` e `canal_nao_encontrado` são respostas normais para a tela). Não passa pela trava do "saiu". */
export async function desfazerRemocaoCanal(id: string): Promise<RespostaRemocao<{ naoPedido: boolean; despausado: boolean }>> {
  const g = await guardaDaRemocao(id, 'desfazer a remoção de um canal concorrente')
  if (!g.ok) return g
  const supabase = getSupabaseServiceClient()
  try {
    const r = await cancelarRemocao(supabase, { siteId: g.siteId, canalId: id, actorId: g.userId })
    return r.ok ? { ok: true, naoPedido: r.naoPedido, despausado: r.despausado } : recusa(r.codigo, r.frase)
  } finally {
    soltarCache(g.siteId)
  }
}

/** Caminho 1: apaga já e sem cópia (só canal com até 30 dias; o banco confere o nome e a idade). Os números do toast vêm do que o banco apagou. */
export async function apagarCanalSemGuardarAction(
  id: string,
  nomeDigitado: string,
): Promise<RespostaRemocao<{ videos: number; leituras?: number; registrosDiarios?: number; imagensRestantes?: number }>> {
  const g = await guardaDaRemocao(id, 'apagar um canal concorrente sem guardar')
  if (!g.ok) return g
  const supabase = getSupabaseServiceClient()
  const trava = await travaDoSaiu(supabase, g.siteId, id)
  if (trava) return trava
  try {
    // o nome vai como foi digitado: quem apara e normaliza é o banco (`obs_nome_normalizado`)
    const r = await apagarCanalSemGuardar(supabase, { siteId: g.siteId, canalId: id, actorId: g.userId, nomeDigitado: String(nomeDigitado ?? ''), motivo: MOTIVO.apagar })
    if (!r.ok) return recusa(r.codigo, r.frase)
    return { ok: true, videos: r.videos, ...(r.leituras !== undefined ? { leituras: r.leituras } : {}), ...(r.registrosDiarios !== undefined ? { registrosDiarios: r.registrosDiarios } : {}), ...(r.imagensRestantes !== undefined ? { imagensRestantes: r.imagensRestantes } : {}) }
  } finally {
    soltarCache(g.siteId)
  }
}

export async function syncCompetitorNow(channelRowId: string): Promise<{ ok: boolean; error?: string; result?: { videosChecked: number; changesDetected: number } }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false }

  // o sync lê e grava colunas da MG2: sem as migrations, nada é gravado nem pedido ao YouTube
  const notReady = await syncSchemaBlock()
  if (notReady) return { ok: false, error: notReady }

  const supabase = getSupabaseServiceClient()
  const { data: channel } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, site_id')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false }

  let result: Awaited<ReturnType<typeof syncCompetitorChannel>>
  // a sync that throws midway may have written part of its data: the cache goes either way
  try { result = await syncCompetitorChannel(channel, apiKey) } finally { invalidateObservatory(siteId) }
  revalidatePath('/cms/youtube/competitors')
  if (result.paused) return { ok: false, error: FRASE_PAUSADA }
  return { ok: true, result }
}

export async function toggleBookmark(changeId: string): Promise<{ ok: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_changes')
    .select('bookmarked')
    .eq('id', changeId)
    .eq('site_id', siteId)
    .single()

  if (!data) return { ok: false }

  await supabase
    .from('competitor_changes')
    .update({ bookmarked: !data.bookmarked })
    .eq('id', changeId)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/competitors')
  return { ok: true }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Swipe file of the Observatório (Mudanças): the engine names a change by the version it opened (`toId`), so the
 * row is the `competitor_changes` whose `to_version_id` is that key — or, for a legacy row loaded as a pre-series
 * version, whose own `id` is the key. Toggles `bookmarked` on every matching row and returns the new state.
 */
export async function toggleChangeBookmark(key: string): Promise<{ ok: boolean; saved?: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  if (!UUID_RE.test(key)) return { ok: false }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_changes')
    .select('id, bookmarked')
    .eq('site_id', siteId)
    .or(`to_version_id.eq.${key},id.eq.${key}`)
  const rows = data ?? []
  if (!rows.length) return { ok: false }

  // every row of that version moves together, so the state never splits: if any of them is saved, all of them leave
  const saved = !rows.some(r => r.bookmarked)
  const { error } = await supabase.from('competitor_changes').update({ bookmarked: saved }).eq('site_id', siteId).in('id', rows.map(r => r.id))
  if (error) return { ok: false }
  revalidatePath('/cms/youtube/competitors/mudancas')
  return { ok: true, saved }
}

export async function syncFullHistory(channelRowId: string): Promise<{ ok: boolean; error?: string }> {
  // "Administrar o site" step: the full history of a channel is the expensive sync (API quota).
  // Asked first, before any service client; fails closed.
  const denied = await denyUnlessSiteAdmin((await getSiteContext()).siteId, 'pedir o histórico completo de um canal (gasta cota da API)')
  if (denied) return denied
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, error: 'API key not configured' }

  // antes de qualquer escrita (o sync_mode abaixo é uma): sem as migrations da MG1 e da MG2, nada é gravado nem pedido ao YouTube
  const notReady = await syncSchemaBlock()
  if (notReady) return { ok: false, error: notReady }

  const supabase = getSupabaseServiceClient()

  // Backpressure: max 1 full sync per site at a time
  const { count: syncing } = await supabase
    .from('competitor_channels')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('sync_status', 'syncing')
    .gt('sync_started_at', new Date(Date.now() - 10 * 60_000).toISOString())

  if ((syncing ?? 0) > 0) return { ok: false, error: 'Outro canal está sincronizando. Aguarde.' }

  // (A5 E10) a leitura vem ANTES da escrita: canal pausado não muda de linha nem agenda histórico completo para quando for despausado
  const { data: channel } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, site_id, collection_paused_at')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false, error: 'Canal não encontrado' }
  if (channel.collection_paused_at != null) return { ok: false, error: FRASE_PAUSADA }

  // Set sync_mode to full
  // a trava vai no próprio update: uma pausa gravada entre a leitura e aqui deixa zero linhas alteradas
  const { data: marcado } = await supabase
    .from('competitor_channels')
    .update({ sync_mode: 'full', full_sync_completed_at: null })
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .is('collection_paused_at', null)
    .select('id')
  if (!Array.isArray(marcado) || marcado.length === 0) return { ok: false, error: FRASE_PAUSADA }

  try {
    const r = await syncCompetitorChannel(channel, apiKey)
    if (r.paused) return { ok: false, error: FRASE_PAUSADA }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync failed' }
  } finally {
    invalidateObservatory(siteId)
    revalidatePath('/cms/youtube/competitors')
  }
}

export async function updateVideoLimit(channelRowId: string, limit: number): Promise<{ ok: boolean }> {
  const clamped = limit >= 200 ? 200 : 50
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  await supabase
    .from('competitor_channels')
    .update({ video_limit: clamped })
    .eq('id', channelRowId)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/competitors')
  return { ok: true }
}

export async function getSyncStatus(channelRowId: string): Promise<{
  status: string
  progress: number
  youtubeVideoCount: number | null
  error: string | null
}> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch {
    return { status: 'idle', progress: 0, youtubeVideoCount: null, error: null }
  }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_channels')
    .select('sync_status, sync_progress, youtube_video_count, sync_error')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!data) return { status: 'idle', progress: 0, youtubeVideoCount: null, error: null }

  return {
    status: data.sync_status,
    progress: data.sync_progress,
    youtubeVideoCount: data.youtube_video_count,
    error: data.sync_error,
  }
}

export async function unlockMoreChannels(): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false, error: 'forbidden' }
  const sb = getSupabaseServiceClient()
  if (!(await canAdminSiteUsers(siteId))) return { ok: false, error: 'forbidden' }
  const cur = await getChannelSlots(siteId)
  const { error } = await sb.from('competitor_settings').upsert(
    { site_id: siteId, channel_limit: cur.limit + UNLOCK_STEP, updated_by: res.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'site_id' },
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true, slots: await getChannelSlots(siteId) }
}

/**
 * The page's maxDuration is 60 s and one channel can take 20–30 s: no new channel STARTS after 30 s, counted from the
 * top of the action (loading the rows included). syncCompetitorChannel takes no deadline, so a started channel runs.
 */
const SYNC_START_CUTOFF_MS = 30_000

/**
 * "Sincronizar concorrentes" (chrome): syncs, one after the other, this site's competitors whose engine state is ok.
 * Channels with a problem are not touched and are listed; channels still fetching videos stay out of the round.
 * The ok count comes from the run, never from the plan: a throw, a lock held by another sync, a missing YouTube id or
 * the time cutoff turns the channel into a problem. 0 synced is never a success.
 */
export async function syncCompetitorsNow(): Promise<SyncNowResult> {
  // "Administrar o site" step: the round over EVERY competitor spends API quota (the daily cron already runs it).
  // One channel at a time (syncCompetitorNow) stays with the editor. Asked first; fails closed.
  const denied = await denyUnlessSiteAdmin((await getSiteContext()).siteId, 'sincronizar todos os concorrentes de uma vez (gasta cota da API)')
  if (denied) return { ok: false, text: `${denied.error} Você pode sincronizar um canal por vez, em Canais.`, problems: [], outOfRound: [] }
  const started = Date.now()
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, text: 'Sem permissão para sincronizar os concorrentes.', problems: [], outOfRound: [] } }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, text: 'A chave da API do YouTube não está configurada.', problems: [], outOfRound: [] }

  // o sync lê e grava colunas da MG2: sem as migrations, nada é gravado nem pedido ao YouTube
  const notReady = await syncSchemaBlock()
  if (notReady) return { ok: false, text: notReady, problems: [], outOfRound: [] }

  const now = observatoryNow()
  const rows = await loadRows({ siteId, now })
  const obs = createObservatory(rowsToDataset(rows, now))
  const ytId = new Map(rows.channels.map(c => [c.id, c.channel_id]))
  const competitors = obs.channels.filter(c => !c.own)
  const problems: Array<{ id: string; label: string }> = []
  const outOfRound: Array<{ id: string; label: string }> = []
  const round: string[] = []
  for (const c of competitors) {
    if (c.sync.state === 'ok') round.push(c.id)
    else if (c.sync.state === 'backfill') outOfRound.push({ id: c.id, label: c.sync.label ?? 'buscando vídeos' })
    else problems.push({ id: c.id, label: c.sync.problemPhrase ?? c.sync.label ?? c.sync.state })
  }

  const ok: string[] = []
  let attempted = 0
  for (const id of round) {
    if (Date.now() - started > SYNC_START_CUTOFF_MS) { problems.push({ id, label: 'não coube no tempo desta rodada' }); continue }
    const channelId = ytId.get(id)
    if (!channelId) { problems.push({ id, label: 'sem o id do canal no YouTube' }); continue }
    attempted++
    try {
      const r = await syncCompetitorChannel({ id, channel_id: channelId, site_id: siteId }, apiKey)
      if (r.skipped) problems.push({ id, label: r.paused ? 'a coleta deste canal está pausada' : 'outra sincronização deste canal já estava em andamento' })
      else ok.push(id)
    } catch (e) {
      problems.push({ id, label: humanizeSyncError(e instanceof Error ? e.message : String(e)) })
    }
  }
  if (attempted > 0) { invalidateObservatory(siteId); revalidatePath('/cms/youtube/competitors', 'layout') }
  const toast = obs.syncResultToast({ ok, problems, outOfRound })
  return { ok: ok.length > 0, text: toast.text, problems, outOfRound, toast }
}

const PIN_DENIED: PinResult = { ok: false, kind: 'denied', error: 'Você não tem permissão para fixar ou desafixar vídeos neste site. Se a sessão expirou, entre de novo.' }
const PIN_GONE: PinResult = { ok: false, kind: 'denied', error: 'Este vídeo não existe mais no Observatório.' }
// M10a (frases da §14.10 do 04; a de quem só edita é do redator, para o revisor de UX)
const PIN_PRECISA_ADMIN: PinResult = { ok: false, kind: 'denied', error: 'Este vídeo está em leitura mensal. Só quem administra o site pode voltar a acompanhá-lo por inteiro.' }
const PIN_NO_ARQUIVO: PinResult = { ok: false, kind: 'denied', error: "Este vídeo está no arquivo e não pode ser fixado. As views dele continuam sendo lidas uma vez por mês; o histórico está em 'Ver antigo'. Voltar a acompanhar por inteiro um vídeo que está no arquivo ainda não existe." }
const PIN_FAILED: PinResult = { ok: false, kind: 'failed', error: 'Não foi possível fixar agora. Tente de novo.' }
const UNPIN_FAILED: PinResult = { ok: false, kind: 'failed', error: 'Não foi possível desafixar agora. Tente de novo.' }
interface PinTarget { id: string; channelId: string; channelName: string; pinnedAt: string | null }

/**
 * The competitor video and its channel, only when the channel is this site's: competitor_videos has no site_id, so the
 * site comes from the channel. A video of another site reads as not found. The database error itself is never returned.
 */
async function pinTarget(supabase: ReturnType<typeof getSupabaseServiceClient>, siteId: string, videoId: string): Promise<PinTarget | 'not-found' | 'error'> {
  const { data: video, error: e1 } = await supabase.from('competitor_videos').select('id, competitor_channel_id, pinned_at').eq('id', videoId).maybeSingle()
  if (e1) return 'error'
  if (!video) return 'not-found'
  const { data: channel, error: e2 } = await supabase.from('competitor_channels').select('id, channel_name').eq('id', video.competitor_channel_id).eq('site_id', siteId).maybeSingle()
  if (e2) return 'error'
  if (!channel) return 'not-found'
  return { id: video.id, channelId: channel.id, channelName: channel.channel_name || 'este canal', pinnedAt: video.pinned_at ?? null }
}

/**
 * "Fixar vídeo" (R118): pins a competitor video so it stays observed after it falls out of the channel's
 * video_limit. The cap is enforced in the database (pin_competitor_video locks the channel row, so two simultaneous
 * pins cannot both pass); the number itself is RULES.pinLimit, handed over on every call. Never unpins another one.
 */
export async function pinVideo(videoId: string): Promise<PinResult> {
  let who: { siteId: string; userId: string }
  try { who = await requireEditUser() } catch { return PIN_DENIED }
  if (typeof videoId !== 'string' || !UUID_RE.test(videoId)) return PIN_GONE

  const supabase = getSupabaseServiceClient()
  // M10a (V14): fixar um vídeo em leitura mensal o descongela, e isso é de quem administra. Falha de quem pergunta = "não administra" (falha fechada).
  const podeDescongelar = await canAdminSiteUsers(who.siteId)
  const { data, error } = await supabase.rpc('pin_competitor_video', { p_site_id: who.siteId, p_video_id: videoId, p_user_id: who.userId, p_limit: RULES.pinLimit, p_pode_descongelar: podeDescongelar })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return PIN_FAILED
  const d = data as Record<string, unknown>
  if (d.status === 'not_found') return PIN_GONE
  if (d.status === 'precisa_admin') return PIN_PRECISA_ADMIN
  if (d.status === 'ja_no_arquivo') return PIN_NO_ARQUIVO
  if (d.status === 'cap') {
    // an answer without the count is "could not check": the sentence never invents a number
    if (typeof d.pinned !== 'number') return PIN_FAILED
    const name = typeof d.name === 'string' && d.name ? d.name : 'este canal'
    return { ok: false, kind: 'cap', error: `Sem vagas: ${d.pinned} de ${RULES.pinLimit} vídeos fixados em ${name}. Desafixe um para fixar outro.` }
  }
  // anything but an explicit ok is a failure: an unknown answer is never "pinned"
  if (d.status !== 'ok') return PIN_FAILED
  // pinned_at lives in the cached rows of the channel: without this the button says "Fixado" and the screen reloads
  // with the video still unpinned. Also when it was already pinned (another tab may hold the stale pack).
  invalidateObservatory(who.siteId)
  if (d.already !== true) revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true }
}

/** "Desafixar": unpins. The stored history stays (R120); only the daily record and the every-sync check stop. */
export async function unpinVideo(videoId: string): Promise<PinResult> {
  let who: { siteId: string; userId: string }
  try { who = await requireEditUser() } catch { return PIN_DENIED }
  if (typeof videoId !== 'string' || !UUID_RE.test(videoId)) return PIN_GONE

  const supabase = getSupabaseServiceClient()
  const t = await pinTarget(supabase, who.siteId, videoId)
  if (t === 'error') return UNPIN_FAILED
  if (t === 'not-found') return PIN_GONE
  // already unpinned in the database: a stale cached pack may still show it pinned, so the cache goes anyway
  if (!t.pinnedAt) { invalidateObservatory(who.siteId); return { ok: true } }

  const { data, error } = await supabase.from('competitor_videos').update({ pinned_at: null, pinned_by: null })
    .eq('id', t.id).eq('competitor_channel_id', t.channelId).select('id')
  if (error || !Array.isArray(data)) return UNPIN_FAILED
  // no row written: the video was removed between the read and the write
  if (!data.length) return PIN_GONE
  invalidateObservatory(who.siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true }
}

/**
 * What "Remover canal" would delete, for the confirmation dialog. `ok: false` covers no access, a channel of another
 * site and a failed count: the dialog then says it could not count, it never shows zeros.
 * T12: the count, the archive (`obs_archive_channel_archive_impact`) and the Blob images come together or not at all; the capacity
 * (what the server can do about the images) is read here because `lerCapacidades` is server-only.
 */
export type RespostaDoImpacto =
  | { ok: true; impact: CompetitorRemovalImpact; semGuardar: SemGuardar; arquivo: ImpactoDoArquivo; capacidade: 'sim' | 'nao-sim' | 'nao-nao'; dataDoComando: string | null }
  | { ok: false }
export async function getCompetitorRemovalImpactAction(channelRowId: string): Promise<RespostaDoImpacto> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  if (typeof channelRowId !== 'string' || !UUID_RE.test(channelRowId)) return { ok: false }
  try {
    // as duas leituras são independentes: uma ida e volta só
    const [r, arquivo] = await Promise.all([getCompetitorRemovalImpact(siteId, channelRowId), lerImpactoDoArquivo(getSupabaseServiceClient(), siteId, channelRowId)])
    if (!r || !arquivo) return { ok: false }
    const cap = lerCapacidades()
    return {
      ok: true, impact: r.impact, semGuardar: semGuardarDe(r.addedAt, Date.now(), RULES.removal.semGuardarAteDias), arquivo,
      capacidade: cap.comandoDeLimpeza && cap.blocoCanaisRemovidos ? 'sim' : cap.blocoCanaisRemovidos ? 'nao-sim' : 'nao-nao',
      dataDoComando: cap.dataDoComando,
    }
  } catch { return { ok: false } }
}
