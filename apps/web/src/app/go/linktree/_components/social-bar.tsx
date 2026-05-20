'use client'

import React from 'react'

import type { SocialProfile } from '../_lib/types'
import { SocialYouTubeIcon, SocialGitHubIcon, SocialXIcon, SocialInstagramIcon, SocialBlueskyIcon } from './icons'

const SOCIAL_ICON_MAP: Record<string, React.FC<{ color?: string; size?: number }>> = {
  youtube: SocialYouTubeIcon,
  github: SocialGitHubIcon,
  x: SocialXIcon,
  instagram: SocialInstagramIcon,
  bluesky: SocialBlueskyIcon,
}

interface SocialBarProps {
  profiles: SocialProfile[]
}

export function SocialBar({ profiles }: SocialBarProps) {
  if (profiles.length === 0) return null
  return (
    <nav id="social" className="flex justify-center gap-1 my-3" aria-label="Social profiles">
      {profiles.map((p) => {
        const Icon = SOCIAL_ICON_MAP[p.platform]
        if (!Icon) return null
        return (
          <a
            key={p.platform + p.handle}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${p.platform}: ${p.handle}`}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-[var(--pb-faint)] transition-colors hover:text-[var(--pb-accent)] hover:bg-[var(--pb-paper2)]"
          >
            <Icon color="currentColor" size={18} />
          </a>
        )
      })}
    </nav>
  )
}
