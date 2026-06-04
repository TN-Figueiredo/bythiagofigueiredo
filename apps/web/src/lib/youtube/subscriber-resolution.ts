export interface SubscriberBounds {
  lower: number
  upper: number
  resolution: number
}

export interface FormattedSubscriberCount {
  text: string
  isApproximate: boolean
  boundsLabel: string
}

export interface GrowthAmbiguityState {
  isAmbiguous: boolean
  maxHiddenGrowth: number
  label: string
}

const BR_INT = new Intl.NumberFormat('pt-BR')

/**
 * Returns the rounding step size (resolution) that the YouTube Data API v3 applies
 * to subscriberCount at the tier containing `count`.
 *
 * YouTube rounds DOWN to 3 significant figures, so the step size doubles every
 * decade of magnitude.
 */
export function getSubscriberResolution(count: number): number {
  if (count < 1_000) return 1
  if (count < 10_000) return 10
  if (count < 100_000) return 100
  if (count < 1_000_000) return 1_000
  if (count < 10_000_000) return 10_000
  if (count < 100_000_000) return 100_000
  return 1_000_000
}

export function getSubscriberBounds(count: number): SubscriberBounds {
  const resolution = getSubscriberResolution(count)
  return {
    lower: count,
    upper: count + resolution - 1,
    resolution,
  }
}

export function formatSubscriberCount(
  count: number,
  fmtC: (n: number) => string,
): FormattedSubscriberCount {
  const { resolution, lower, upper } = getSubscriberBounds(count)
  const isApproximate = resolution > 1
  const text = isApproximate ? `~${fmtC(count)}` : fmtC(count)
  const boundsLabel = isApproximate
    ? `entre ${BR_INT.format(lower)} e ${BR_INT.format(upper)} inscritos`
    : `${BR_INT.format(count)} inscritos`
  return { text, isApproximate, boundsLabel }
}

export function detectGrowthAmbiguity(
  subscriberCount: number | null,
  subscriberGrowthDelta: number | null,
  viewCountGrowing: boolean,
): GrowthAmbiguityState {
  const notAmbiguous: GrowthAmbiguityState = {
    isAmbiguous: false,
    maxHiddenGrowth: 0,
    label: '',
  }

  if (subscriberCount === null || subscriberGrowthDelta === null) return notAmbiguous
  if (subscriberGrowthDelta !== 0) return notAmbiguous

  const resolution = getSubscriberResolution(subscriberCount)
  if (resolution === 1) return notAmbiguous

  if (!viewCountGrowing) return notAmbiguous

  const maxHiddenGrowth = resolution - 1
  return {
    isAmbiguous: true,
    maxHiddenGrowth,
    label: `Crescendo (até +${BR_INT.format(maxHiddenGrowth)} inscritos podem estar ocultos pelo arredondamento)`,
  }
}
