export const EMAIL_COLORS = {
  bg: '#F7F1E8',
  card: '#FBF6EC',
  ink: '#1F1B17',
  accent: '#FF8240',
  accentDeep: '#E0651E',
  muted: '#6A5F48',
  faint: '#9C9178',
  line: '#E8DCC8',
  dark: {
    bg: '#1A1714',
    card: '#221E1A',
    ink: '#EFE6D2',
    muted: '#958A75',
    faint: '#6B634F',
    line: '#2E2718',
  },
} as const

export const EMAIL_FONTS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Arial, Helvetica, sans-serif",
  mono: "'Courier New', Courier, monospace",
} as const

export function emailDarkStyles(): string {
  return `
@media (prefers-color-scheme: dark) {
  .email-body { background-color: ${EMAIL_COLORS.dark.bg} !important; }
  .email-card { background-color: ${EMAIL_COLORS.dark.card} !important; }
  .email-ink { color: ${EMAIL_COLORS.dark.ink} !important; }
  .email-muted { color: ${EMAIL_COLORS.dark.muted} !important; }
  .email-faint { color: ${EMAIL_COLORS.dark.faint} !important; }
  .email-line { border-color: ${EMAIL_COLORS.dark.line} !important; }
  .email-divider { background-color: ${EMAIL_COLORS.dark.line} !important; }
}`.trim()
}
