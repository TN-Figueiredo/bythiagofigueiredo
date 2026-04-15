const WORDS_PER_MINUTE = 200

export function calculateReadingTime(source: string): number {
  const stripped = source.replace(/<[^>]+>/g, ' ')
  const words = stripped.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 1
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}
