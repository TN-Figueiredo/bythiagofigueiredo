export const SPACING_VALUES = {
  xs: '0.6em',
  sm: '1.0em',
  md: '1.6em',
  lg: '2.2em',
  xl: '3.0em',
} as const

type SpacingLevel = keyof typeof SPACING_VALUES

const SPACING_MATRIX: Record<string, Record<string, SpacingLevel>> = {
  paragraph:      { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', table: 'md', socialEmbed: 'md', toggleWrapper: 'md', columns: 'md', ctaButton: 'md', horizontalRule: 'lg', taskList: 'sm', image: 'md', blockquote: 'md', bulletList: 'sm', orderedList: 'sm' },
  heading:        { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', image: 'md', table: 'md', socialEmbed: 'md', toggleWrapper: 'md', columns: 'md', ctaButton: 'md', blockquote: 'md', bulletList: 'sm', orderedList: 'sm', taskList: 'sm' },
  codeBlock:      { paragraph: 'md', heading: 'xl', codeBlock: 'lg', callout: 'md', image: 'md' },
  callout:        { paragraph: 'md', callout: 'lg', heading: 'xl', codeBlock: 'md', image: 'md' },
  horizontalRule: {},
  blockquote:     { paragraph: 'md', heading: 'xl', blockquote: 'lg', codeBlock: 'md', callout: 'md' },
  ctaButton:      { paragraph: 'md', heading: 'xl', ctaButton: 'lg' },
  toggleWrapper:  { paragraph: 'md', heading: 'xl', toggleWrapper: 'sm' },
  columns:        { paragraph: 'md', heading: 'xl', columns: 'lg' },
  table:          { paragraph: 'md', heading: 'xl', table: 'lg' },
  socialEmbed:    { paragraph: 'md', heading: 'xl', socialEmbed: 'lg' },
  taskList:       { paragraph: 'sm', heading: 'xl', taskList: 'xs' },
  image:          { paragraph: 'md', heading: 'xl', image: 'lg', callout: 'md' },
  bulletList:     { paragraph: 'sm', heading: 'xl', bulletList: 'xs' },
  orderedList:    { paragraph: 'sm', heading: 'xl', orderedList: 'xs' },
}

const DEFAULTS: Record<string, SpacingLevel> = {
  horizontalRule: 'lg',
}

export function getSpacingClass(prevType: string | null, currentType: string): string {
  if (prevType === null) return ''

  if (prevType === 'horizontalRule' || currentType === 'horizontalRule') {
    return 'sp-lg'
  }

  const row = SPACING_MATRIX[prevType]
  if (row) {
    const specific = row[currentType]
    if (specific) return `sp-${specific}`
  }

  const defaultLevel = DEFAULTS[prevType] ?? DEFAULTS[currentType] ?? 'sm'
  return `sp-${defaultLevel}`
}
