// A conta de período e de tempo no ar de uma versão (título, thumbnail, descrição): UMA só, a do Histórico do vídeo, que a página do canal reusa.
// Puro: sem DOM, sem React. Nasceu do `view-model.ts` do Histórico (A2, tarefa 6, conserto 1, I2): o texto que ele mostra não mudou uma letra.
// O que ela sabe e a coleta também: a precisão do início (publicação, minuto, janela de 6 h / 1 d, "visto desde"), a janela entre duas
// sincronizações e o canal parado (a atual vira "última vista", o fim vira a última conferência, o tempo no ar vira "pelo menos").
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'
import { isObserved } from '@/lib/youtube/observatorio/observed'

export type SpanType = 'title' | 'thumb' | 'desc'
const H_MS = 36e5, DAY = 864e5
/** Título é masculino; thumbnail e descrição, femininos. */
export const FEM: Record<SpanType, boolean> = { title: false, thumb: true, desc: true }

/** A forma mínima de uma versão para a conta (os três tipos de versão do motor a têm). */
export interface SpanVer { id: string; first_seen: number; last_seen: number; current: boolean; prec: string | null; window: [number, number] | null; seenSinceArchive?: boolean }

/** A letra de cada imagem, na ordem em que aparece pela primeira vez: A, B, … (depois de Z, Z1, Z2…). A mesma imagem guarda a letra. */
export function imageLetters(thumbs: readonly { key: string }[]): Map<string, string> {
  const keys = new Map<string, string>()
  for (const t of thumbs) if (!keys.has(t.key)) { const k = keys.size; keys.set(t.key, k < 26 ? String.fromCharCode(65 + k) : 'Z' + (k - 25)) }
  return keys
}

/** O que a conta devolve para a versão `i` de `arr`. */
export interface VersionTiming {
  startLbl: string; end: string
  /** "vista desde 03/10 até 05/10 14:22", "vista pela 1ª vez … ; trocada entre …": o período como o cartão o escreve. */
  span: string
  /** O tempo no ar: "2 d 7 h", "10 h a 16 h", "pelo menos 6 d". */
  durTxt: string
  open: boolean; openEnd: boolean; atLeast: boolean
  /** Os limites em ms (início/fim conhecidos no mínimo e no máximo), para a geometria das raias e a taxa de views. */
  sObs: number; sLo: number; sHi: number; eLo: number; eHi: number
}

export interface VersionClock {
  now: number; pub: number; SS: number; obsSince: number | null; recentAdd: boolean
  observed: boolean; pinPending: boolean; pinGone: boolean; unchecked: boolean; chStalled: boolean; stalled: boolean; endNow: number
  dmhmY(ms: number): string
  isPub(x: Pick<SpanVer, 'prec' | 'first_seen'>): boolean
  lateObs(x: Pick<SpanVer, 'prec' | 'first_seen'>): boolean
  openStart(x: Pick<SpanVer, 'prec' | 'first_seen' | 'seenSinceArchive'>): boolean
  /** Início efetivo: uma versão 'first' que vale desde a publicação começa na publicação. */
  startMs(x: Pick<SpanVer, 'prec' | 'first_seen'>): number
  curWord(type: SpanType): string
  timing(type: SpanType, arr: readonly SpanVer[], i: number): VersionTiming
}

/** O relógio das versões de um vídeo: tudo o que a conta precisa do motor, do vídeo e do canal dele. */
export function versionClock(obs: Observatory, v: ObsVideo, ch: ObsChannel): VersionClock {
  const D = obs.date
  const now = obs.NOW, SS = obs.SERIES_START
  const dmhmY = (ms: number) => D.dmOrDmy(ms) + ' ' + D.hm(ms)
  const pub = v.pub
  const sy = ch.sync
  const observed = isObserved(v)
  const obsSince: number | null = sy.added ?? ch.snapshots[0]?.t ?? null
  // R117: a video outside the observed ones has no schedule of its own. Its versions end at the last time one of them was
  // seen, never "agora": the rest of the screen reads that as a stalled check.
  const seenAt = [...v.titles, ...v.thumbs, ...v.descs].map(x => x.last_seen)
  const lastSeen = seenAt.length ? Math.min(now, Math.max(...seenAt)) : now
  // D13: a video pinned outside the tracked ones and not checked since is in the same position until its first check
  const pinPending = v.pinState === 'aguardando-primeira'
  // the channel synced after the pin and YouTube did not return the video: same position, and no deadline to promise
  const pinGone = v.pinState === 'sem-resposta'
  const unchecked = !observed || pinPending || pinGone
  const chStalled = (sy.state === 'atrasado' || sy.state === 'erro') && sy.last != null
  const stalled = unchecked || chStalled
  const endNow = unchecked ? lastSeen : chStalled ? Math.min(now, sy.last!) : now
  // dados.js keeps sync.added only for a channel that joined AFTER the observatory began (the founding ones have none);
  // production stores added_at for every channel, so one added on the observatory's first day is a founding channel,
  // watched "desde DD/MM", not a recent add first checked at that instant
  const recentAdd = sy.added != null && sy.added > pub && sy.added - obs.OBS_START >= DAY

  // Production writes the first version of a video as precision 'first' with first_seen = the sync that saw it
  // (competitor-versions.ts). The oracle rule (dados.js:524): only a video published BEFORE the archive start
  // (SERIES_START) has a first version whose start was not observed ("visto desde DD/MM", seenSinceArchive);
  // a video published after it was watched from publication, so its 'first' version stands from publication.
  const preArchive = pub < SS
  type P = Pick<SpanVer, 'prec' | 'first_seen'>
  const isPub = (x: P) => x.prec === 'publicacao' || ((x.prec === 'first' || x.prec == null) && (x.first_seen <= pub || !preArchive))
  const lateObs = (x: P) => isPub(x) && obsSince != null && obsSince > pub && x.first_seen <= pub
  const openStart = (x: P & Pick<SpanVer, 'seenSinceArchive'>) => lateObs(x) || x.prec === 'desde-arquivo' || !!x.seenSinceArchive || (x.prec === 'first' && x.first_seen > pub && preArchive)
  const startMs = (x: P) => (isPub(x) ? Math.min(x.first_seen, pub) : x.first_seen)
  const du = (ms: number) => D.dur(ms).replace(/ 0 h$/, '').replace(/ 0 min$/, '')
  const curWord = (type: SpanType) => (stalled ? (FEM[type] ? 'última vista' : 'último visto') : 'no ar')

  function timing(type: SpanType, arr: readonly SpanVer[], i: number): VersionTiming {
    const x = arr[i]!, nx = arr[i + 1]
    const o = FEM[type] ? 'a' : 'o'
    const startLbl = lateObs(x)
      ? (recentAdd ? 'vist' + o + ' na 1ª conferência, ' + dmhmY(obsSince!) : 'vist' + o + ' desde ' + D.dmOrDmy(obsSince!))
      : isPub(x) ? dmhmY(pub) + ' (publicação)'
        : x.prec === 'min' ? dmhmY(x.first_seen)
          : openStart(x) ? 'vist' + o + ' desde ' + D.dmOrDmy(x.first_seen)
            : 'vist' + o + ' pela 1ª vez ' + D.dmOrDmy(x.first_seen) + ' ' + D.hh(x.first_seen)
    const sObs = lateObs(x) ? obsSince! : startMs(x)
    const sLo = x.window ? x.window[0] : sObs, sHi = sObs
    const eLo = nx ? (nx.window ? nx.window[0] : nx.first_seen) : endNow, eHi = nx ? nx.first_seen : endNow
    const open = openStart(x), openEnd = !nx && stalled
    const dMin = eLo - sHi, dMax = eHi - sLo
    const rng = dMax - dMin < H_MS ? du(dMax) : du(Math.max(0, dMin)) + ' a ' + du(dMax)
    const atLeast = open || openEnd
    const durTxt = atLeast ? 'pelo menos ' + du(Math.max(0, dMin)) : rng
    const end = nx ? (nx.window ? 'trocad' + o + ' ' + D.windowText(nx.window[0], nx.window[1]) : dmhmY(nx.first_seen)) : stalled ? 'até ' + dmhmY(endNow) + ' (última conferência)' : 'agora'
    const span = /^trocad[ao] /.test(end) ? startLbl + '; ' + end : end.startsWith('até ') ? startLbl + ' ' + end : startLbl + ' até ' + end
    return { startLbl, end, span, durTxt, open, openEnd, atLeast, sObs, sLo, sHi, eLo, eHi }
  }

  return { now, pub, SS, obsSince, recentAdd, observed, pinPending, pinGone, unchecked, chStalled, stalled, endNow, dmhmY, isPub, lateObs, openStart, startMs, curWord, timing }
}

/** A legenda de uma versão de thumbnail no visualizador: a mesma frase nas duas telas. `tag` é a palavra da atual ("no ar", "última vista"). */
export function thumbCaption(label: string, cur: boolean, tag: string, span: string, dur: string): string {
  return 'Capa ' + label + (cur ? ' (' + tag + ')' : '') + ': ' + span + '; no ar por ' + dur
}
