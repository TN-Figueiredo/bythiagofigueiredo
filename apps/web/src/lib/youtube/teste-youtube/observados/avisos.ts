import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { normalizarTitulo } from '../normalizar-titulo'
import { avaliarDegradacao, diaBrtAnterior, textoDegradacao, textoSuspenso, type AlvoAtivo, type Avaliacao, type LeituraDia } from './alarme'
import { modoTrocasConcorrente } from './flag'
import { titulosSuspensos } from './guarda'
import { tituloValido, type LeituraObs } from './inferir'
import { paginado, SemTempo, type Linha } from './paginar'

type FanOut = typeof fanOutToSiteAdminsDetailed
const LOTE_IDS = 100
const DIA_MS = 86_400_000
const HREF = '/cms/youtube/competitors'
const PREFIXO_DEGRADADA = 'obs-degradada:'
const PREFIXO_SUSPENSO = 'obs-titulo-suspenso:'
const COLUNAS_LEITURA = 'youtube_video_id,rodada_id,lida_em,http,erro,titulo_exibido,idioma,jogador_bloqueado'

export interface ResultadoLeituraAvisos { ativo: boolean; degradada: number; suspenso: number; expirados: number; falhas: number; semTempo: number }
const vazio = (ativo: boolean): ResultadoLeituraAvisos => ({ ativo, degradada: 0, suspenso: 0, expirados: 0, falhas: 0, semTempo: 0 })

const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const inteiro = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Expira (`expired_at`) os avisos abertos do site com o prefixo, menos a chave `manter`. Devolve quantos expirou. */
async function expirar(sb: SupabaseClient, siteId: string, prefixo: string, iso: string, manter: string | null): Promise<number> {
  let q = sb.from('notifications').update({ expired_at: iso }).eq('site_id', siteId).eq('domain', 'youtube').like('dedup_key', prefixo + '%').is('expired_at', null)
  if (manter !== null) q = q.neq('dedup_key', manter)
  const r = await q.select('id').abortSignal(AbortSignal.timeout(BANCO_MS))
  if (r.error || !Array.isArray(r.data)) throw new Error('expirar_falhou')
  return r.data.length
}

async function enviar(fanOut: FanOut, o: { siteId: string; type: string; title: string; message: string; dedupKey: string; payload: Record<string, unknown> }): Promise<boolean> {
  try {
    const fan = await fanOut({ siteId: o.siteId, domain: 'youtube', type: o.type, priority: 2, title: o.title, message: o.message, dedupKey: o.dedupKey, payload: o.payload, actionHref: HREF })
    if (fan.total === 0) Sentry.captureMessage('avisos_pendentes: aviso da leitura sem destinatário (0 admins)', { level: 'error', tags: { area: 'ab-observados' } })
    return fan.total > 0 && fan.errors.length === 0
  } catch (e) {
    Sentry.captureMessage('avisos_pendentes: fan-out da leitura lançou: ' + (e instanceof Error ? e.name : typeof e), { level: 'warning', tags: { area: 'ab-observados' } })
    return false
  }
}

interface DadosSite { alvos: AlvoAtivo[]; leituras: LeituraDia[] }

/** Lê tudo do site (alvos ativos, publicação, leituras de [D-1, D+1)) antes de qualquer decisão. Erro de leitura, ou contagem divergente, LANÇA. */
async function lerSite(sb: SupabaseClient, siteId: string, ids: readonly string[], janela: { inicioMs: number; fimMs: number }, canais: ReadonlySet<string>, antes: () => void): Promise<DadosSite> {
  const alvos: AlvoAtivo[] = []
  const canalDe = new Map<string, string>()
  for (let i = 0; i < ids.length; i += LOTE_IDS) {
    antes()
    const r = await sb.from('competitor_videos').select('video_id,published_at,competitor_channel_id').in('video_id', ids.slice(i, i + LOTE_IDS)).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error || !Array.isArray(r.data)) throw new Error('videos')
    const minimo = new Map<string, string>()
    for (const v of r.data as Linha[]) {
      const yt = texto(v.video_id), pub = texto(v.published_at), canal = texto(v.competitor_channel_id)
      if (!yt || !pub || !canal || !canais.has(canal)) continue
      canalDe.set(yt, canalDe.get(yt) ?? canal)
      const atual = minimo.get(yt)
      if (atual === undefined || Date.parse(pub) < Date.parse(atual)) minimo.set(yt, pub)
    }
    for (const [ytId, publicadoEm] of minimo) alvos.push({ ytId, publicadoEm })
  }
  const leituras: LeituraDia[] = []
  for (let i = 0; i < ids.length; i += LOTE_IDS) {
    const lote = ids.slice(i, i + LOTE_IDS)
    const linhas = await paginado(sb, antes, s => s.from('yt_watch_readings').select(COLUNAS_LEITURA, { count: 'exact' })
      .eq('site_id', siteId).in('youtube_video_id', lote).gte('lida_em', new Date(janela.inicioMs).toISOString()).lt('lida_em', new Date(janela.fimMs).toISOString())
      .order('lida_em', { ascending: true }).order('id', { ascending: true }))
    for (const l of linhas) {
      const ytId = texto(l.youtube_video_id), rodadaId = texto(l.rodada_id), lidaEm = texto(l.lida_em)
      if (!ytId || !rodadaId || !lidaEm) continue
      leituras.push({ ytId, rodadaId, lidaEm, http: inteiro(l.http), erro: texto(l.erro), jogadorBloqueado: l.jogador_bloqueado === true, tituloExibido: texto(l.titulo_exibido), idioma: texto(l.idioma), canal: canalDe.get(ytId) ?? null })
    }
  }
  return { alvos, leituras }
}

const comoObs = (l: LeituraDia): LeituraObs => ({
  id: 0, rodadaId: l.rodadaId, lidaEm: l.lidaEm, http: l.http, erro: l.erro, jogadorBloqueado: l.jogadorBloqueado, idioma: l.idioma, tituloExibido: l.tituloExibido, miniaturaId: null,
})

/**
 * Parte `leitura` do `avisos_pendentes` (§6.1 e §6.2 "Aviso"): alarme de degradação do dia BRT anterior e aviso de título repetido.
 * Flag off: nada é lido. `semTempo()` é chamado antes de cada site (site pulado conta em `semTempo` e não expira nada).
 * A avaliação e qualquer expiração só acontecem DEPOIS da leitura completa do site; erro de leitura LANÇA (nunca vira "não dispara").
 */
export async function enviarAvisosDaLeitura(sb: SupabaseClient, agora: Date, o: { semTempo: () => boolean; fanOut?: FanOut; env?: NodeJS.ProcessEnv }): Promise<ResultadoLeituraAvisos> {
  if (modoTrocasConcorrente(o.env ?? process.env) !== 'on') return vazio(false)
  const fanOut = o.fanOut ?? fanOutToSiteAdminsDetailed
  const iso = agora.toISOString()
  const dia = diaBrtAnterior(agora.getTime())
  const diaAnterior = diaBrtAnterior(agora.getTime() - DIA_MS)
  const janela = { inicioMs: diaAnterior.inicioMs, fimMs: dia.fimMs }

  const ativos = await paginado(sb, () => {}, s => s.from('yt_watch_alvos').select('site_id,youtube_video_id', { count: 'exact' }).eq('tipo', 'concorrente').is('saiu_em', null).order('id', { ascending: true }))
  const idsPorSite = new Map<string, string[]>()
  for (const a of ativos) {
    const site = texto(a.site_id), yt = texto(a.youtube_video_id)
    if (site && yt) idsPorSite.set(site, [...(idsPorSite.get(site) ?? []), yt])
  }
  let canais: Linha[] | null = null // lido uma vez, no 1º site que tiver tempo

  const total = vazio(true)
  let erro: Error | null = null
  for (const [siteId, brutos] of idsPorSite) {
    if (o.semTempo()) { total.semTempo++; continue }
    try {
      if (canais === null) {
        const r = await sb.from('competitor_channels').select('id,site_id,removal_requested_at').abortSignal(AbortSignal.timeout(BANCO_MS))
        if (r.error || !Array.isArray(r.data)) throw new Error('canais')
        canais = r.data as Linha[]
      }
      const canaisDoSite = new Set(canais.flatMap(k => (k.removal_requested_at == null && texto(k.site_id) === siteId && texto(k.id) ? [k.id as string] : [])))
      const antes = (): void => { if (o.semTempo()) throw new SemTempo() }
      const d = await lerSite(sb, siteId, [...new Set(brutos)].sort(), janela, canaisDoSite, antes)
      await avaliarSite(sb, siteId, d, { dia, diaAnterior, iso, fanOut }, total)
    } catch (e) {
      if (e instanceof SemTempo) total.semTempo++
      else erro ??= e instanceof Error ? e : new Error('leitura: site falhou')
    }
  }
  if (erro) throw erro
  return total
}

async function avaliarSite(
  sb: SupabaseClient, siteId: string, d: DadosSite,
  c: { dia: ReturnType<typeof diaBrtAnterior>; diaAnterior: ReturnType<typeof diaBrtAnterior>; iso: string; fanOut: FanOut }, total: ResultadoLeituraAvisos,
): Promise<void> {
  const aD: Avaliacao = avaliarDegradacao(d.alvos, d.leituras, c.dia)
  const aD1: Avaliacao = avaliarDegradacao(d.alvos, d.leituras, c.diaAnterior)
  const chaveD = PREFIXO_DEGRADADA + c.dia.rotulo
  if (aD.dispara) {
    const ok = await enviar(c.fanOut, { siteId, type: 'youtube.obs_degradada', title: 'Leitura dos concorrentes degradada', message: textoDegradacao(aD, aD1.dispara), dedupKey: chaveD, payload: { condicao: aD.condicao } })
    if (ok) { total.degradada++; total.expirados += await expirar(sb, siteId, PREFIXO_DEGRADADA, c.iso, chaveD) } else total.falhas++
  } else total.expirados += await expirar(sb, siteId, PREFIXO_DEGRADADA, c.iso, null)

  // título repetido: só leituras de D com título válido
  const doDia = d.leituras.filter(l => Date.parse(l.lidaEm) >= c.dia.inicioMs && Date.parse(l.lidaEm) < c.dia.fimMs)
  const suspensos = new Set(titulosSuspensos(doDia.map(l => ({ ytId: l.ytId, canal: l.canal, leitura: comoObs(l) }))))
  const chaveS = PREFIXO_SUSPENSO + c.dia.rotulo
  if (suspensos.size > 0) {
    const videos = new Set(doDia.filter(l => tituloValido(comoObs(l)) && suspensos.has(normalizarTitulo(l.tituloExibido!))).map(l => l.ytId))
    const ok = await enviar(c.fanOut, { siteId, type: 'youtube.obs_titulo_suspenso', title: 'Título repetido suspenso na leitura dos concorrentes', message: textoSuspenso(videos.size), dedupKey: chaveS, payload: { videos: videos.size } })
    if (ok) { total.suspenso++; total.expirados += await expirar(sb, siteId, PREFIXO_SUSPENSO, c.iso, chaveS) } else total.falhas++
  } else total.expirados += await expirar(sb, siteId, PREFIXO_SUSPENSO, c.iso, null)
}
