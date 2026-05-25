import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SidebarSection } from '@tn-figueiredo/cms-ui'
import {
  LayoutDashboard, Calendar,
  FileText, Mail, Megaphone, ListMusic,
  Video, GraduationCap, BookOpen, Microscope, Headphones,
  Image, Link2,
  Youtube, Send,
  UserPen, UsersRound, MessageSquare,
  TrendingUp, Kanban, Shrub,
} from 'lucide-react'

const ICON_SIZE = 16
const STROKE = 1.75
const icon = (Icon: LucideIcon) => createElement(Icon, { size: ICON_SIZE, strokeWidth: STROKE })

export function buildCmsSections(): SidebarSection[] {
  return [
    {
      label: 'Overview',
      items: [
        { icon: icon(LayoutDashboard), label: 'Dashboard', href: '/cms' },
        { icon: icon(Kanban), label: 'Up Next', href: '/cms/pipeline', minRole: 'editor' },
        { icon: icon(Calendar), label: 'Schedule', href: '/cms/schedule' },
        { icon: icon(TrendingUp), label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
      ],
    },
    {
      label: 'Content',
      items: [
        { icon: icon(FileText), label: 'Blog', href: '/cms/blog' },
        { icon: icon(Video), label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' },
        { icon: icon(GraduationCap), label: 'Courses', href: '/cms/pipeline/course', minRole: 'editor' },
        { icon: icon(Mail), label: 'Newsletters', href: '/cms/newsletters', minRole: 'editor' },
        { icon: icon(Megaphone), label: 'Campaigns', href: '/cms/campaigns', minRole: 'editor' },
        { icon: icon(ListMusic), label: 'Playlists', href: '/cms/playlists', minRole: 'editor' },
      ],
    },
    {
      label: 'Library',
      items: [
        { icon: icon(Microscope), label: 'Research', href: '/cms/pipeline/research', minRole: 'editor' },
        { icon: icon(BookOpen), label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' },
        { icon: icon(Image), label: 'Media', href: '/cms/media', minRole: 'editor' },
        { icon: icon(Headphones), label: 'Audio', href: '/cms/pipeline/audio', minRole: 'editor' },
      ],
    },
    {
      label: 'Social',
      items: [
        { icon: icon(Youtube), label: 'YouTube', href: '/cms/youtube', minRole: 'editor' },
        { icon: icon(Send), label: 'Posts', href: '/cms/social', minRole: 'reporter' },
        { icon: icon(Link2), label: 'Links', href: '/cms/links', minRole: 'editor' },
        { icon: icon(Shrub), label: 'Link in Bio', href: '/cms/linktree', minRole: 'editor' },
      ],
    },
    {
      label: 'People',
      items: [
        { icon: icon(UserPen), label: 'Authors', href: '/cms/authors', minRole: 'editor' },
        { icon: icon(UsersRound), label: 'Subscribers', href: '/cms/subscribers', minRole: 'org_admin' },
        { icon: icon(MessageSquare), label: 'Contacts', href: '/cms/contacts', minRole: 'editor' },
      ],
    },
  ]
}
