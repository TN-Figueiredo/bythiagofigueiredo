import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import {
  AdminShellWithSwitcher,
  CmsSiteSwitcherSlot,
  type AccessibleSite,
} from '../../../components/cms/site-switcher-provider'

const CMS_CONFIG = {
  appName: 'CMS',
  sections: [
    {
      group: 'Content',
      items: [
        { label: 'Blog posts', path: '/cms/blog', icon: 'Pencil' },
        { label: 'Authors', path: '/cms/authors', icon: 'User' },
      ],
    },
    {
      group: 'Campaigns',
      items: [
        { label: 'Landing pages', path: '/cms/campaigns', icon: 'Target' },
        { label: 'Submissions', path: '/cms/submissions', icon: 'Inbox' },
      ],
    },
    {
      group: 'Newsletter',
      items: [
        { label: 'Editions', path: '/cms/newsletters', icon: 'Mail' },
        { label: 'Subscribers', path: '/cms/newsletters/subscribers', icon: 'Users' },
        { label: 'Settings', path: '/cms/newsletters/settings', icon: 'Settings' },
      ],
    },
    {
      group: 'Queue',
      items: [
        { label: 'Content Queue', path: '/cms/content-queue', icon: 'Clock' },
      ],
    },
    {
      group: 'Contatos',
      items: [
        { label: 'Contatos recebidos', path: '/cms/contacts', icon: 'Mail' },
      ],
    },
  ],
}

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
  const user = await requireUser(supabase)
  // Area gate — redirects to `/?error=insufficient_access` on denial.
  // RPC-first: `is_staff()` is trusted over JWT app_metadata (stale until refresh).
  await requireArea('cms')

  // Track F3 — resolve accessible sites so the CMS shell can render the
  // multi-site dropdown. `user_accessible_sites()` returns rows the signed-in
  // user can view (site_memberships + cascade-up via organization_members).
  // Swallow RPC errors to an empty array — the switcher renders null for
  // <2 sites, so a failure degrades to the single-site experience rather
  // than blocking the entire CMS shell.
  const { data: sitesData } = await supabase.rpc('user_accessible_sites')
  const sites = (sitesData ?? []) as AccessibleSite[]

  return (
    <AdminShellWithSwitcher
      sites={sites}
      userEmail={user.email ?? ''}
      config={{
        ...CMS_CONFIG,
        logoutPath: '/cms/logout',
        siteSwitcherSlot: <CmsSiteSwitcherSlot />,
      }}
    >
      {children}
    </AdminShellWithSwitcher>
  )
}
