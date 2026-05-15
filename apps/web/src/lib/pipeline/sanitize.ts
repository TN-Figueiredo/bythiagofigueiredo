export function sanitizeForLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function sanitizeForFilter(input: string): string {
  return input.replace(/[^a-zA-Z0-9\s\-_/:@]/g, '')
}

export function sanitizeForTsquery(input: string): string {
  return input.replace(/[\\:*!<>()&|'"]/g, ' ').replace(/\s+/g, ' ').trim()
}
