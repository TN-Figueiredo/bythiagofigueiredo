export function safeRedirect(input: string | null | undefined, fallback = '/cms'): string {
  if (!input) return fallback
  if (!input.startsWith('/')) return fallback
  if (input.startsWith('//')) return fallback  // protocol-relative
  if (input.startsWith('/\\')) return fallback // edge case
  return input
}
