import type { ContentType } from '@/lib/schedule/schedule-queries'

export const TYPE_COLORS: Record<ContentType, string> = {
  blog: 'var(--color-blog)',
  newsletter: 'var(--color-newsletter)',
  video: 'var(--color-video)',
}

export const TYPE_LABELS: Record<ContentType, string> = {
  blog: 'Blog',
  newsletter: 'Newsletter',
  video: 'Video',
}
