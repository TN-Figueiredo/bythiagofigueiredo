import type { Provider } from '@tn-figueiredo/social'

export interface CaptionContext {
  link: string
  title: string
  url: string
}

const LINK_PLACEHOLDER_LENGTH = 24

const KNOWN_VARS = new Set(['link', 'title', 'url'])

const VAR_REGEX = /\{\{(link|title|url)\}\}/g

export const PLATFORM_CAPTION_DEFAULTS: Record<Provider, string> = {
  facebook: '{{title}}\n\n{{link}}',
  bluesky: '{{title}}\n\n{{link}}',
  instagram: '{{title}}\n\nLink na bio',
  youtube: '{{title}}\n\n{{link}}',
}

export function resolveCaption(template: string, context: CaptionContext): string {
  return template.replace(VAR_REGEX, (_match, varName: string) => {
    if (!KNOWN_VARS.has(varName)) return _match
    return context[varName as keyof CaptionContext]
  })
}

export function resolvedLength(template: string, context: CaptionContext): number {
  const resolvedContext: CaptionContext = {
    ...context,
    link: context.link || 'x'.repeat(LINK_PLACEHOLDER_LENGTH),
  }
  return resolveCaption(template, resolvedContext).length
}

export function findMissingLink(template: string): boolean {
  return !template.includes('{{link}}')
}
