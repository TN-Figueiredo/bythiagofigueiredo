export function computeInlineAdIndex(
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

export function computeMobileInlineIndex(
  bodyBlockCount: number,
  h2Indices: number[],
): number {
  if (h2Indices.length >= 2) {
    return h2Indices[h2Indices.length - 1]! - 1
  }
  return Math.floor(bodyBlockCount * 0.7)
}
