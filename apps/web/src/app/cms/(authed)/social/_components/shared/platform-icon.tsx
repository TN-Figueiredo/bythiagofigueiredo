interface PlatformIconProps {
  provider: string
  size: number
  variant: 'solid' | 'outline' | 'chip' | 'mini'
  tint?: string
}

export function PlatformIcon({ provider, size, variant, tint }: PlatformIconProps) {
  const stroke = variant === 'solid' ? '#fff'
    : variant === 'chip' ? (tint ?? 'currentColor')
    : 'currentColor'
  const fill = variant === 'solid' ? '#fff'
    : variant === 'chip' ? (tint ?? 'currentColor')
    : 'currentColor'

  if (provider === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={fill} stroke="none" />
    </svg>
  )
  if (provider === 'youtube') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill={fill} stroke="none" />
    </svg>
  )
  if (provider === 'facebook') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
    </svg>
  )
  if (provider === 'bluesky') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
      <path d="M12 4c3 2.5 6 6 6 8.5a3.5 3.5 0 01-7 0" />
      <path d="M12 4c-3 2.5-6 6-6 8.5a3.5 3.5 0 007 0" />
      <path d="M8.5 17c1-.5 2.5-1 3.5-1s2.5.5 3.5 1" />
    </svg>
  )
  return null
}
