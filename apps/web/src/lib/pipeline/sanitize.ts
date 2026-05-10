export function sanitizeForLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function sanitizeForFilter(input: string): string {
  return input.replace(/[.,()]/g, '')
}

export function sanitizeForTsquery(input: string): string {
  return input.replace(/[\\:*!<>()&|'"]/g, ' ').replace(/\s+/g, ' ').trim()
}
