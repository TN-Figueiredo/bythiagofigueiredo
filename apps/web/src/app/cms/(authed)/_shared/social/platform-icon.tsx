import type { Provider } from '@tn-figueiredo/social'

const PLATFORM_META: Record<Provider, { emoji: string; color: string; label: string }> = {
  youtube: { emoji: '🎬', color: 'text-red-500', label: 'YouTube' },
  facebook: { emoji: '📘', color: 'text-blue-600', label: 'Facebook' },
  instagram: { emoji: '📷', color: 'text-pink-500', label: 'Instagram' },
  bluesky: { emoji: '🦋', color: 'text-sky-500', label: 'Bluesky' },
}

interface PlatformIconProps {
  provider: Provider
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlatformIcon({ provider, size = 'md', className = '' }: PlatformIconProps) {
  const meta = PLATFORM_META[provider]
  const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base'
  return (
    <span
      className={`${sizeClass} ${className}`}
      title={meta.label}
      role="img"
    >
      {meta.emoji}
    </span>
  )
}

export function platformLabel(provider: Provider): string {
  return PLATFORM_META[provider].label
}
