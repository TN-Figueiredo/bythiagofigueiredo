// R119: a pinned video is observed (daily record, history, its own effect/series/multiplier wording, the forja) but is
// never `tracked`: channel medians, Outliers, the theme trend and the peer sets keep using `tracked` only.
import type { ObsVideo } from './types'

export const isObserved = (v: Pick<ObsVideo, 'tracked' | 'pinned'>): boolean => v.tracked || v.pinned === true
