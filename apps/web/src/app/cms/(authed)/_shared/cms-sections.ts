import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SidebarSection } from '@tn-figueiredo/cms-ui'
import {
  LayoutDashboard, Calendar,
  FileText, Mail, Megaphone, Image, Link2, ListMusic,
  Kanban, Video, GraduationCap, BookOpen, Microscope, Headphones,
  Youtube, Send, Edit3, BarChart3, Users,
  UserPen, UsersRound,
  TrendingUp,
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
        { icon: icon(Calendar), label: 'Schedule', href: '/cms/schedule' },
      ],
    },
    {
      label: 'Content',
      items: [
        { icon: icon(FileText), label: 'Blog', href: '/cms/blog' },
        { icon: icon(Video), label: 'Video', href: '/cms/pipeline/video', minRole: 'editor' },
        { icon: icon(Mail), label: 'Newsletters', href: '/cms/newsletters', minRole: 'editor' },
        { icon: icon(Megaphone), label: 'Campaigns', href: '/cms/campaigns', minRole: 'editor' },
        { icon: icon(Headphones), label: 'Audio', href: '/cms/pipeline/audio', minRole: 'editor' },
        { icon: icon(GraduationCap), label: 'Courses', href: '/cms/pipeline/course', minRole: 'editor' },
        { icon: icon(BookOpen), label: 'Reference', href: '/cms/pipeline/reference', minRole: 'editor' },
        { icon: icon(Microscope), label: 'Research', href: '/cms/pipeline/research', minRole: 'editor' },
        { icon: icon(Image), label: 'Media', href: '/cms/media', minRole: 'editor' },
        { icon: icon(Link2), label: 'Links', href: '/cms/links', minRole: 'editor' },
        { icon: icon(ListMusic), label: 'Playlists', href: '/cms/playlists', minRole: 'editor' },
        { icon: icon(Kanban), label: 'Pipeline', href: '/cms/pipeline', minRole: 'editor' },
      ],
    },
    {
      label: 'Social',
      items: [
        { icon: icon(Youtube), label: 'YouTube', href: '/cms/youtube', minRole: 'editor' },
        { icon: icon(Send), label: 'Posts', href: '/cms/social', minRole: 'reporter' },
        { icon: icon(Edit3), label: 'Composer', href: '/cms/social/new', minRole: 'editor' },
        { icon: icon(BarChart3), label: 'Insights', href: '/cms/social/insights', minRole: 'reporter' },
        { icon: icon(Users), label: 'Accounts', href: '/cms/social/accounts', minRole: 'org_admin' },
      ],
    },
    {
      label: 'People',
      items: [
        { icon: icon(UserPen), label: 'Authors', href: '/cms/authors', minRole: 'editor' },
        { icon: icon(UsersRound), label: 'Subscribers', href: '/cms/subscribers', minRole: 'org_admin' },
      ],
    },
    {
      label: 'Insights',
      items: [
        { icon: icon(TrendingUp), label: 'Analytics', href: '/cms/analytics', minRole: 'editor' },
      ],
    },
  ]
}
