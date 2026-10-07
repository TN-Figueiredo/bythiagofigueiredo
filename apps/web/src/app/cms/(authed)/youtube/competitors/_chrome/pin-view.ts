/**
 * What the screens say about pinning one video (R118): the state chips, the button's hint and where "Ver fixados" goes.
 * Pure. The state is said once per place, by the chips; the button only names the action.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsVideo } from '@/lib/youtube/observatorio/types'

export type PinChipKind = 'fixado' | 'fixado-agora' | 'sem-resposta' | 'fora-dos-n' | 'fora'
/** `how` = the second segment of the chip (what the state guarantees); null = a one-segment, dashed chip. */
export interface PinChipView { kind: PinChipKind; label: string; how: string | null }
export interface PinView { videoId: string; channelId: string; title: string; pinned: boolean; chips: PinChipView[]; hint: string; pinnedHref: string }

/** A channel that is not syncing says so in place of any promise about the next check (mockup r4, N1). */
const HOW_SYNC: Record<string, string> = { erro: 'sincronização do canal com erro', atrasado: 'sincronização do canal atrasada', backfill: 'canal ainda buscando vídeos' }

/** null = a video of an own channel: there is no pin control for it. `withOut` adds the "Fora dos acompanhados" chip (Mudanças). */
export function pinViewOf(obs: Observatory, v: ObsVideo, o: { withOut?: boolean } = {}): PinView | null {
  const ch = obs.channel(v.ch)
  if (!ch || ch.own) return null
  const hours = obs.SYNC.cadenceHours, N = ch.video_limit, pinned = v.pinned === true, pending = v.pinState === 'aguardando-primeira'
  const chips: PinChipView[] = []
  if (pinned) {
    // the channel synced after the pin and YouTube did not return the video: no promise and no "checked", whatever the channel's state
    if (v.pinState === 'sem-resposta') chips.push({ kind: 'sem-resposta', label: 'Fixado', how: 'o YouTube não devolveu este vídeo' })
    else {
      const how = HOW_SYNC[ch.sync.state] ?? (pending ? 'a primeira conferência acontece em até ' + hours + ' h' : 'conferido a cada ' + hours + ' h')
      chips.push({ kind: pending ? 'fixado-agora' : 'fixado', label: pending ? 'Fixado agora' : 'Fixado', how })
    }
    if (!v.tracked) chips.push({ kind: 'fora-dos-n', label: 'fora dos ' + N + ' mais recentes', how: null })
  } else if (o.withOut && !v.tracked) chips.push({ kind: 'fora', label: 'Fora dos acompanhados', how: null })
  return {
    videoId: v.id, channelId: ch.id, title: v.title, pinned, chips,
    hint: 'Um vídeo fixado tem gráfico de views e conferência de título, thumbnail e descrição a cada ' + hours + ' h, mesmo fora dos ' + N + ' mais recentes de ' + ch.name + '. Limite: ' + obs.RULES.pinLimit + ' por canal.',
    pinnedHref: obs.link.canais({ channel: ch.id, tab: 'videos' }) + '#fixados',
  }
}
