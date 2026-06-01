import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SidebarSection, SidebarNavItem } from '@tn-figueiredo/cms-ui'
import {
  LayoutDashboard, Calendar,
  FileText, Mail, Megaphone, ListMusic,
  Video, GraduationCap, BookOpen, Microscope, Headphones,
  Image, Link2,
  Youtube, Send,
  UserPen, UsersRound, MessageSquare,
  TrendingUp, Kanban, Bell,
  FlaskConical, Eye, Settings,
} from 'lucide-react'

const ICON_SIZE = 16
const STROKE = 1.75
const icon = (Icon: LucideIcon) => createElement(Icon, { size: ICON_SIZE, strokeWidth: STROKE })

export function buildCmsSections(): SidebarSection[] {
  return [
    {
      label: 'HUB',
      items: [
        { icon: icon(LayoutDashboard), label: 'Dashboard', href: '/cms' },
        { icon: icon(Kanban), label: 'Up Next', href: '/cms/up-next', minRole: 'editor' },
        { icon: icon(Calendar), label: 'Schedule', href: '/cms/schedule' },
        { icon: icon(Bell), label: 'Notificações', href: '/cms/notifications' },
      ],
    },
    {
      label: 'Content',
      items: [
        { icon: icon(FileText), label: 'Blog', href: '/cms/blog' },
        { icon: icon(Kanban), label: 'Pipeline', href: '/cms/video', minRole: 'editor' },
        { icon: icon(GraduationCap), label: 'Courses', href: '/cms/courses', minRole: 'editor' },
        { icon: icon(Mail), label: 'Newsletters', href: '/cms/newsletters', minRole: 'editor' },
        { icon: icon(Megaphone), label: 'Campaigns', href: '/cms/campaigns', minRole: 'editor' },
        { icon: icon(ListMusic), label: 'Playlists', href: '/cms/playlists', minRole: 'editor' },
      ],
    },
    {
      label: 'Library',
      items: [
        { icon: icon(Microscope), label: 'Research', href: '/cms/library/research', minRole: 'editor' },
        { icon: icon(BookOpen), label: 'Reference', href: '/cms/library/reference', minRole: 'editor' },
        { icon: icon(Image), label: 'Media', href: '/cms/media', minRole: 'editor' },
        { icon: icon(Headphones), label: 'Audio', href: '/cms/library/audio', minRole: 'editor' },
      ],
    },
    {
      label: 'YouTube',
      items: [
        { icon: icon(Youtube), label: 'Channels', href: '/cms/youtube', minRole: 'editor' },
        { icon: icon(Video), label: 'Videos', href: '/cms/youtube/videos', minRole: 'editor' },
        { icon: icon(FlaskConical), label: 'A/B Lab', href: '/cms/youtube/ab-lab', minRole: 'editor' },
        { icon: icon(TrendingUp), label: 'Performance', href: '/cms/youtube/analytics', minRole: 'editor' },
        { icon: icon(Eye), label: 'Competitors', href: '/cms/youtube/competitors', minRole: 'editor' },
      ],
    },
    {
      label: 'Social',
      items: [
        { icon: icon(Send), label: 'Posts', href: '/cms/social', minRole: 'reporter' },
        { icon: icon(Link2), label: 'Links', href: '/cms/links', minRole: 'editor' },
      ],
    },
    {
      label: 'Audience',
      items: [
        { icon: icon(UserPen), label: 'Authors', href: '/cms/authors', minRole: 'editor' },
        { icon: icon(UsersRound), label: 'Subscribers', href: '/cms/subscribers', minRole: 'org_admin' },
        { icon: icon(MessageSquare), label: 'Contacts', href: '/cms/contacts', minRole: 'editor' },
      ],
    },
  ]
}

export const CMS_SETTINGS_ITEM: SidebarNavItem = {
  icon: icon(Settings),
  label: 'Settings',
  href: '/cms/settings',
}
