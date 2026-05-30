import type { SocialPostContent } from '@tn-figueiredo/social'

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Publicado',
  scheduled: 'Agendado',
  failed: 'Falhou',
  draft: 'Rascunho',
  publishing: 'Publicando',
  cancelled: 'Cancelado',
  partial_failure: 'Parcial',
}

export const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  draft: 'bg-yellow-500/20 text-yellow-400',
  publishing: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  partial_failure: 'bg-orange-500/20 text-orange-400',
}

export function getPostTitle(content: SocialPostContent): string {
  return content.title ?? content.description ?? '(sem titulo)'
}

export function formatPostDate(dateStr: string | null, format: 'short' | 'long' = 'short'): string {
  if (!dateStr) return ''
  const opts: Intl.DateTimeFormatOptions = format === 'long'
    ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
  return new Date(dateStr).toLocaleDateString('pt-BR', opts)
}
