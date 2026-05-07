/**
 * Resolve tag name for a specific locale (public frontend).
 * Falls back to primary name if no translation exists.
 */
export function resolveTagName(
  tag: { name: string; nameTranslations?: Record<string, string> | null },
  locale: string,
): string {
  if (tag.nameTranslations && typeof tag.nameTranslations === 'object') {
    const translated = tag.nameTranslations[locale]
    if (translated && translated.trim()) return translated
  }
  return tag.name
}

/**
 * Format tag name for CMS display: "Primary (Translation1, Translation2)"
 */
export function formatTagNameCms(
  tag: { name: string; nameTranslations?: Record<string, string> | null },
): string {
  if (!tag.nameTranslations || typeof tag.nameTranslations !== 'object') return tag.name
  const translations = Object.values(tag.nameTranslations).filter(v => v && v.trim())
  if (translations.length === 0) return tag.name
  return `${tag.name} (${translations.join(', ')})`
}
