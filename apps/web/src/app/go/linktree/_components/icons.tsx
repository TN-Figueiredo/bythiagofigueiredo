import React from 'react'

type IconProps = { color?: string; size?: number; className?: string }

export function BlogIcon({ color = 'currentColor', size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="5" y1="5" x2="11" y2="5" /><line x1="5" y1="8" x2="11" y2="8" /><line x1="5" y1="11" x2="8" y2="11" />
    </svg>
  )
}

export function MailIcon({ color = 'currentColor', size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="1" y="3" width="14" height="10" rx="2" /><path d="M1 5l7 4 7-4" />
    </svg>
  )
}

export function YouTubeIcon({ color = 'currentColor', size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} className={className}>
      <path d="M14.2 3.8c-.3-.5-.9-.8-1.5-.9C11.3 2.7 8 2.7 8 2.7s-3.3 0-4.7.2c-.6.1-1.2.4-1.5.9-.3.6-.5 2-.5 3.2s.2 2.6.5 3.2c.3.5.9.8 1.5.9 1.4.2 4.7.2 4.7.2s3.3 0 4.7-.2c.6-.1 1.2-.4 1.5-.9.3-.6.5-2 .5-3.2s-.2-2.6-.5-3.2zM6.5 9.8V6.2L10 8l-3.5 1.8z" />
    </svg>
  )
}

export function PersonIcon({ color = 'currentColor', size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  )
}

export function ContactIcon({ color = 'currentColor', size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h12v8a2 2 0 01-2 2H4a2 2 0 01-2-2V3z" /><path d="M5 7h.01M8 7h.01M11 7h.01" />
    </svg>
  )
}

export function ArrowRightIcon({ color = 'currentColor', size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2l4 4-4 4" />
    </svg>
  )
}

export function SunIcon({ color = 'currentColor', size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" className={className}>
      <circle cx="7.5" cy="7.5" r="3" />
      <line x1="7.5" y1="1" x2="7.5" y2="3" /><line x1="7.5" y1="12" x2="7.5" y2="14" />
      <line x1="1" y1="7.5" x2="3" y2="7.5" /><line x1="12" y1="7.5" x2="14" y2="7.5" />
      <line x1="2.9" y1="2.9" x2="4.3" y2="4.3" /><line x1="10.7" y1="10.7" x2="12.1" y2="12.1" />
      <line x1="12.1" y1="2.9" x2="10.7" y2="4.3" /><line x1="4.3" y1="10.7" x2="2.9" y2="12.1" />
    </svg>
  )
}

export function MoonIcon({ color = 'currentColor', size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 8.5A5.5 5.5 0 116.5 2a4.5 4.5 0 006.5 6.5z" />
    </svg>
  )
}

export function ShareIcon({ color = 'currentColor', size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 1v8M3 5l4-4 4 4" /><path d="M1 9v3a1 1 0 001 1h10a1 1 0 001-1V9" />
    </svg>
  )
}

export function SocialYouTubeIcon({ color = 'currentColor', size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} className={className}>
      <path d="M17.8 4.8c-.4-.6-1.1-1-1.9-1.1C14.1 3.4 10 3.4 10 3.4s-4.1 0-5.9.3c-.8.1-1.5.5-1.9 1.1-.4.7-.6 2.5-.6 4s.2 3.3.6 4c.4.6 1.1 1 1.9 1.1 1.8.3 5.9.3 5.9.3s4.1 0 5.9-.3c.8-.1 1.5-.5 1.9-1.1.4-.7.6-2.5.6-4s-.2-3.3-.6-4zM8.1 12.2V7.8L12.5 10 8.1 12.2z" />
    </svg>
  )
}

export function SocialGitHubIcon({ color = 'currentColor', size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M10 1C5 1 1 5 1 10c0 4 2.6 7.4 6.2 8.6.5.1.6-.2.6-.4v-1.5c-2.5.5-3-1.2-3-1.2-.4-1.1-1-1.4-1-1.4-.8-.6.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.2 1 2.7.8.1-.6.3-1 .6-1.2-2-.2-4.1-1-4.1-4.6 0-1 .4-1.8 1-2.5-.1-.2-.4-1.2.1-2.4 0 0 .8-.3 2.6 1a9 9 0 014.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.2.2 2.2.1 2.4.6.7 1 1.5 1 2.5 0 3.6-2.1 4.4-4.2 4.6.3.3.6.9.6 1.8v2.7c0 .2.2.5.7.4C16.4 17.4 19 14 19 10c0-5-4-9-9-9z" />
    </svg>
  )
}

export function SocialXIcon({ color = 'currentColor', size = 17, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 17 17" fill={color} className={className}>
      <path d="M13.2 1h2.5L10.5 7.3l6.2 8.2h-4.8L8 10.6l-4.5 4.9H1l5.5-6.3L.8 1h4.9l3.5 4.6L13.2 1zm-.9 14h1.4L4.8 2.4H3.3l9 12.6z" />
    </svg>
  )
}

export function SocialInstagramIcon({ color = 'currentColor', size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="16" height="16" rx="5" /><circle cx="10" cy="10" r="4" /><circle cx="15" cy="5" r="1" fill={color} stroke="none" />
    </svg>
  )
}

export function SocialBlueskyIcon({ color = 'currentColor', size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={color} className={className}>
      <path d="M5.2 3.6c2 1.5 4.1 4.6 4.8 6.2.7-1.6 2.8-4.7 4.8-6.2 1.4-1.1 3.7-1.9 3.7.8 0 .5-.3 4.5-.5 5.1-.6 2.3-3 2.9-5.1 2.5 3.7.6 4.7 2.7 2.6 4.8-4 3.9-5.7-1-6.1-2.2-.1-.2-.1-.3-.1-.3v.3c-.5 1.2-2.2 6.1-6.2 2.2-2-2.1-1-4.2 2.7-4.8-2.1.4-4.5-.2-5.1-2.5-.2-.6-.5-4.6-.5-5.1 0-2.7 2.3-1.9 3.7-.8z" />
    </svg>
  )
}

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  blog: BlogIcon,
  mail: MailIcon,
  youtube: YouTubeIcon,
  person: PersonIcon,
  user: PersonIcon,
  contact: ContactIcon,
  message: ContactIcon,
}

export function getIcon(name: string): React.FC<IconProps> {
  return ICON_MAP[name] ?? BlogIcon
}
