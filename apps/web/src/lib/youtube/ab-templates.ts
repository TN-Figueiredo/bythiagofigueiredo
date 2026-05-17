const TEMPLATE_REGEX = /\{\{link:([a-zA-Z0-9_-]+)\}\}/g

export function parseTemplateTokens(text: string): string[] {
  if (!text.trim()) return []
  const names = new Set<string>()
  let match: RegExpExecArray | null
  const regex = new RegExp(TEMPLATE_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    names.add(match[1])
  }
  return Array.from(names)
}

export function resolveTemplates(
  text: string,
  linkMap: Record<string, string>,
): string {
  return text.replace(TEMPLATE_REGEX, (full, name: string) => {
    return linkMap[name] ?? full
  })
}
