export const STATUS_CLASSES = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  accent: 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400',
} as const

export type StatusVariant = keyof typeof STATUS_CLASSES

export const CHART_PALETTE = [
  '#FF8240',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#8b5cf6',
  '#f43f5e',
  '#14b8a6',
  '#FF3333',
  '#FFE37A',
] as const

export const CATEGORY_COLORS: Record<string, string> = {
  code: '#D65B1F',
  product: '#2F6B22',
  essay: '#1E4D7A',
  diary: '#8A4A8F',
  tools: '#B87333',
  career: '#5B6E2B',
}

export const ICON_BG = {
  brand: 'bg-brand-100 dark:bg-brand-900/20',
  green: 'bg-green-100 dark:bg-green-900/20',
  amber: 'bg-amber-100 dark:bg-amber-900/20',
  red: 'bg-red-100 dark:bg-red-900/20',
  blue: 'bg-blue-100 dark:bg-blue-900/20',
  purple: 'bg-purple-100 dark:bg-purple-900/20',
} as const
