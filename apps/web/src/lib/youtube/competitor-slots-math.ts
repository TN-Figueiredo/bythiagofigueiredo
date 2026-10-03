/** Pure slot arithmetic (no DB): the one formula shared by the engine (channelSlots) and the actions (getChannelSlots). */
export const DEFAULT_CHANNEL_LIMIT = 75
export const UNLOCK_STEP = 25

export interface ChannelSlots { used: number; limit: number; free: number }

/** free = max(0, limit − used); the own channel is never counted. */
export function computeSlots(usedCompetitors: number, limit: number | null): ChannelSlots {
  const l = limit ?? DEFAULT_CHANNEL_LIMIT
  return { used: usedCompetitors, limit: l, free: Math.max(0, l - usedCompetitors) }
}
