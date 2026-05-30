import type { LucideIcon } from 'lucide-react'
import {
  Layers,
  Youtube,
  Mail,
  Send,
  Link2,
  FileText,
  Image,
  Shield,
} from 'lucide-react'
import type { NotificationDomain } from './types'

export interface DomainMeta {
  icon: LucideIcon
  label: string
  /** CSS custom property for the domain color (auto-switches via data-theme) */
  color: string
  /** CSS custom property for the domain soft fill */
  subtle: string
}

export const DOMAIN_META: Record<NotificationDomain, DomainMeta> = {
  pipeline: {
    icon: Layers,
    label: 'Pipeline',
    color: 'var(--color-cms-domain-pipeline)',
    subtle: 'var(--color-cms-domain-pipeline-subtle)',
  },
  youtube: {
    icon: Youtube,
    label: 'YouTube',
    color: 'var(--color-cms-domain-youtube)',
    subtle: 'var(--color-cms-domain-youtube-subtle)',
  },
  newsletter: {
    icon: Mail,
    label: 'Newsletter',
    color: 'var(--color-cms-domain-newsletter)',
    subtle: 'var(--color-cms-domain-newsletter-subtle)',
  },
  social: {
    icon: Send,
    label: 'Social',
    color: 'var(--color-cms-domain-social)',
    subtle: 'var(--color-cms-domain-social-subtle)',
  },
  links: {
    icon: Link2,
    label: 'Links',
    color: 'var(--color-cms-domain-links)',
    subtle: 'var(--color-cms-domain-links-subtle)',
  },
  blog: {
    icon: FileText,
    label: 'Blog',
    color: 'var(--color-cms-domain-blog)',
    subtle: 'var(--color-cms-domain-blog-subtle)',
  },
  media: {
    icon: Image,
    label: 'Media',
    color: 'var(--color-cms-domain-media)',
    subtle: 'var(--color-cms-domain-media-subtle)',
  },
  system: {
    icon: Shield,
    label: 'Sistema',
    color: 'var(--color-cms-domain-system)',
    subtle: 'var(--color-cms-domain-system-subtle)',
  },
}

/** Ordered list of all domains for iteration */
export const DOMAIN_ORDER: NotificationDomain[] = [
  'pipeline',
  'youtube',
  'newsletter',
  'social',
  'links',
  'blog',
  'media',
  'system',
]
