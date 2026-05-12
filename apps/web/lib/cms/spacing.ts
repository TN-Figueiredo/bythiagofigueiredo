export const SPACING_VALUES = {
  xs: '0.6em',
  sm: '1.0em',
  md: '1.6em',
  lg: '2.2em',
  xl: '3.0em',
} as const

type SpacingLevel = keyof typeof SPACING_VALUES

const SPACING_MATRIX: Record<string, Record<string, SpacingLevel>> = {
  paragraph:      { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', table: 'md', socialEmbed: 'md', toggleWrapper: 'md', columns: 'md', ctaButton: 'md', horizontalRule: 'lg', taskList: 'sm', image: 'md' },
  heading:        { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', image: 'md' },
  codeBlock:      { paragraph: 'md', heading: 'xl' },
  callout:        { paragraph: 'md', callout: 'lg', heading: 'xl' },
  horizontalRule: {},
  blockquote:     { paragraph: 'md', heading: 'xl' },
  ctaButton:      { paragraph: 'md', heading: 'xl' },
  toggleWrapper:  { paragraph: 'md', heading: 'xl' },
  columns:        { paragraph: 'md', heading: 'xl' },
  table:          { paragraph: 'md', heading: 'xl' },
  socialEmbed:    { paragraph: 'md', heading: 'xl' },
  taskList:       { paragraph: 'sm', heading: 'xl' },
  image:          { paragraph: 'md', heading: 'xl' },
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
