/**
 * Gravação de um disparo da watch (A5 S4, Tarefa 12): uma chamada só (`yt_watch_gravar_disparo`, transação única) e, se o banco
 * recusar uma linha (SQLSTATE classe 23), o degrau: regrava vídeo a vídeo e adia o alvo que falhar de novo.
 * Erro de transporte ou banco fora do ar não tem degrau. Nenhuma ida ao banco começa depois de `ateMs`. Nunca deixa o texto do erro sair.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resumoTecnico } from '@/lib/youtube/agenda/motivos'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import { chaveAlvo, type AlvoAtivo } from './alvos'
import type { LinhaLeitura, LinhaThumb } from './expansor'

/** O objeto de `p.alvos` da função `yt_watch_gravar_disparo` (Apêndice A.1, §4b). Só o que vai é enviado; o resto o banco mantém. */
export interface AtualizacaoAlvo {
  id: number
  proxima_rodada_em?: string
  ultima_rodada_em?: string
  rodadas_mais?: number
  indisponivel_seguidas?: number
  saiu_em?: string
  saiu_por?: 'janela' | 'indisponivel' | 'removido'
  coleta_ate?: string
  motivo_ate?: 'extensao' | 'extensao_curta'
  extensoes_curtas?: number
  reter_ate?: string
}
export interface PayloadDisparo { thumbs: LinhaThumb[]; leituras: LinhaLeitura[]; alvos: AtualizacaoAlvo[] }
export interface ResultadoGravacao { ok: boolean; foraDoFormato: number; degrau: boolean }

const ADIA_MS = 20 * 60_000

type Chamada = { ok: true } | { ok: false; classe23: boolean }

async function chamar(sb: SupabaseClient, p: PayloadDisparo): Promise<Chamada> {
  try {
    const { error } = await sb.rpc('yt_watch_gravar_disparo', { p }).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (!error) return { ok: true }
    const sqlstate = resumoTecnico(error).sqlstate
    return { ok: false, classe23: sqlstate !== null && sqlstate.startsWith('23') }
  } catch {
    return { ok: false, classe23: false }
  }
}

const vazio = (p: PayloadDisparo): boolean => p.thumbs.length === 0 && p.leituras.length === 0 && p.alvos.length === 0

/** `o.alvos` (os alvos lidos neste disparo) liga cada vídeo ao seu alvo e dá a `proxima_rodada_em` atual, base do adiamento do degrau. */
export async function gravarComDegrau(
  sb: SupabaseClient,
  payload: PayloadDisparo,
  o: { agora: () => number; ateMs: number; alvos?: readonly AlvoAtivo[] },
): Promise<ResultadoGravacao> {
  const foraDoFormato = payload.leituras.filter(l => l.erro === 'fora_do_formato').length
  if (vazio(payload)) return { ok: true, foraDoFormato, degrau: false }
  if (o.agora() >= o.ateMs) return { ok: false, foraDoFormato, degrau: false }

  const primeira = await chamar(sb, payload)
  if (primeira.ok) return { ok: true, foraDoFormato, degrau: false }
  if (!primeira.classe23 || o.agora() >= o.ateMs) return { ok: false, foraDoFormato, degrau: false }

  // Degrau: um lote por vídeo.
  const porVideo = new Map<string, LinhaLeitura[]>()
  for (const l of payload.leituras) {
    const k = chaveAlvo(l.site_id, l.youtube_video_id)
    porVideo.set(k, [...(porVideo.get(k) ?? []), l])
  }
  const alvoDe = new Map<string, AlvoAtivo>((o.alvos ?? []).map(a => [chaveAlvo(a.siteId, a.ytId), a]))
  const atualizacaoDe = new Map<number, AtualizacaoAlvo>(payload.alvos.map(a => [a.id, a]))
  const usados = new Set<number>()
  const falhos: AlvoAtivo[] = []
  let incompleto = false

  for (const [k, leituras] of porVideo) {
    if (o.agora() >= o.ateMs) { incompleto = true; break }
    const alvo = alvoDe.get(k)
    const ks = new Set(leituras.flatMap(l => (l.thumb_k === null ? [] : [l.thumb_k])))
    const mine = alvo !== undefined ? atualizacaoDe.get(alvo.id) : undefined
    if (alvo !== undefined) usados.add(alvo.id)
    const r = await chamar(sb, {
      thumbs: payload.thumbs.filter(t => ks.has(t.k)), leituras, alvos: mine === undefined ? [] : [mine],
    })
    if (!r.ok && alvo !== undefined) falhos.push(alvo)
    else if (!r.ok) incompleto = true
  }

  // Atualizações de alvo sem leitura no lote (sobras) vão numa chamada só de alvos.
  const sobras = payload.alvos.filter(a => !usados.has(a.id))
  let tudoOk = !incompleto
  if (sobras.length > 0) {
    if (o.agora() >= o.ateMs) tudoOk = false
    else if (!(await chamar(sb, { thumbs: [], leituras: [], alvos: sobras })).ok) tudoOk = false
  }
  if (falhos.length > 0) {
    tudoOk = false
    if (o.agora() < o.ateMs) {
      const agoraMs = o.agora()
      await chamar(sb, {
        thumbs: [], leituras: [],
        alvos: falhos.map(a => ({ id: a.id, proxima_rodada_em: new Date(Math.max(Number.isFinite(Date.parse(a.proximaRodadaEm)) ? Date.parse(a.proximaRodadaEm) : 0, agoraMs) + ADIA_MS).toISOString() })),
      })
    }
  }
  return { ok: tudoOk, foraDoFormato, degrau: true }
}
