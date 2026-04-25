import type { SponsorAd, HouseAd } from './types'

/**
 * Deterministic hash for a slug string.
 * Used to pick ads consistently per post without randomness.
 */
export function hashSlug(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) | 0
  }
  return h
}

/**
 * Pick a sponsor ad deterministically from hash + offset.
 */
export function pickSponsor(
  hash: number,
  offset: number,
  sponsors: SponsorAd[],
): SponsorAd {
  const idx = Math.abs((hash + offset * 7) % sponsors.length)
  return sponsors[idx]!
}

/**
 * Pick a house ad deterministically from hash + offset.
 */
export function pickHouse(
  hash: number,
  offset: number,
  houseAds: HouseAd[],
): HouseAd {
  const idx = Math.abs((hash + offset * 7) % houseAds.length)
  return houseAds[idx]!
}

/**
 * Compute the index where the Bookmark ad should be inserted in the body blocks.
 *
 * Strategy: insert BEFORE the 2nd h2 (natural section transition pause).
 * Falls back to ~55-60% through the body if fewer than 2 h2s exist.
 *
 * @param bodyBlockCount - total number of body blocks
 * @param h2Indices - indices of h2 blocks within body
 * @returns index after which the bookmark should be inserted
 */
export function computeBookmarkIndex(
  bodyBlockCount: number,
  h2Indices: number[],
): number {
  if (h2Indices.length >= 2) {
    return h2Indices[1]! - 1
  } else if (h2Indices.length === 1) {
    return Math.min(
      bodyBlockCount - 2,
      h2Indices[0]! + Math.floor((bodyBlockCount - h2Indices[0]!) * 0.6),
    )
  }
  return Math.floor(bodyBlockCount * 0.55)
}

/**
 * Compute the index where the mobile inline ad should appear.
 *
 * At ~70% through, or just before the last h2 if multiple exist.
 *
 * @param bodyBlockCount - total number of body blocks
 * @param h2Indices - indices of h2 blocks within body
 * @returns index after which the mobile inline ad should be inserted
 */
export function computeMobileInlineIndex(
  bodyBlockCount: number,
  h2Indices: number[],
): number {
  if (h2Indices.length >= 2) {
    return h2Indices[h2Indices.length - 1]! - 1
  }
  return Math.floor(bodyBlockCount * 0.7)
}
