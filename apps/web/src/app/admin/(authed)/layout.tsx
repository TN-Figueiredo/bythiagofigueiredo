import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { AdminShellWithSwitcher } from '../../../components/cms/site-switcher-provider'

const ADMIN_CONFIG = {
  appName: 'Admin',
  sections: [
    {
      group: 'System',
      items: [
        { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
        { label: 'Users', path: '/admin/users', icon: 'Users' },
        { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
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
  // RPC-first: `is_admin()` is trusted over JWT app_metadata (stale until refresh).
  await requireArea('admin')

  return (
    <AdminShellWithSwitcher
      sites={[]}
      userEmail={user.email ?? ''}
      config={{ ...ADMIN_CONFIG, logoutPath: '/admin/logout' }}
    >
      {children}
    </AdminShellWithSwitcher>
  )
}
