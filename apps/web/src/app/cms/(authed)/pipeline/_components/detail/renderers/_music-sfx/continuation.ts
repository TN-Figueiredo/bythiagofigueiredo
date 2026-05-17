import type { SceneMusic } from './types'

export const CONTINUES_RE = /^Continues\b|\(continues?\)$|\(continua\)$/i

export function isContinuationTrack(music: SceneMusic | null | undefined): boolean {
  if (!music) return false
  if (music.continuation && CONTINUES_RE.test(music.continuation)) return true
  if (music.search_terms && CONTINUES_RE.test(music.search_terms)) return true
  return false
}
