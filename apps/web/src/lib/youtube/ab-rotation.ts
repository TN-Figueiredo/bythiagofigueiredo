import type { AbTestConfig } from './ab-types'

/**
 * ABBA Rotation Algorithm
 *
 * Generates a balanced rotation pattern where each variant gets equal exposure.
 * Block size = 2 * variantCount
 * Pattern: forward [0..n-1] + reverse [n-1..0], repeating
 *
 * Examples:
 * - 2 variants: [0,1,1,0] repeating
 * - 3 variants: [0,1,2,2,1,0] repeating
 * - 4 variants: [0,1,2,3,3,2,1,0] repeating
 */
export function getVariantForCycle(variantCount: number, cycleNumber: number): number {
  if (variantCount <= 0) return 0
  if (variantCount === 1) return 0
  const blockSize = 2 * variantCount
  const posInBlock = cycleNumber % blockSize
  if (posInBlock < variantCount) return posInBlock
  return blockSize - 1 - posInBlock
}

export function getVariantRoundRobin(variantCount: number, cycleNumber: number): number {
  if (variantCount <= 0) return 0
  return cycleNumber % variantCount
}

export function getVariantRandom(variantCount: number): number {
  if (variantCount <= 0) return 0
  return Math.floor(Math.random() * variantCount)
}

export function getNextVariantIndex(
  pattern: AbTestConfig['rotation_pattern'],
  variantCount: number,
  cycleNumber: number,
): number {
  switch (pattern) {
    case 'round_robin':
      return getVariantRoundRobin(variantCount, cycleNumber)
    case 'random':
      return getVariantRandom(variantCount)
    case 'abba':
    default:
      return getVariantForCycle(variantCount, cycleNumber)
  }
}
