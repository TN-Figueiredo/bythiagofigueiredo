import { createAdminLayout } from '@tn-figueiredo/admin'
import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

const AdminLayout = createAdminLayout({
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
})

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const user = await requireUser(
    createServerClient({
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
    }),
  )
  // Area gate — redirects to `/?error=insufficient_access` on denial.
  // RPC-first: `is_admin()` is trusted over JWT app_metadata (stale until refresh).
  await requireArea('admin')
  return (
    <>
      <AdminLayout userEmail={user.email}>{children}</AdminLayout>
      {/*
        Minimal logout affordance until @tn-figueiredo/admin grows a
        `logoutPath` slot. Posts to the /admin/logout route handler added
        in Sprint 4.5 Phase 4 (T10b). GET→405, POST→signOut + redirect.
      */}
      <form
        method="POST"
        action="/admin/logout"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 1000,
        }}
      >
        <button
          type="submit"
          style={{
            padding: '6px 12px',
            fontSize: 13,
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 6,
            background: 'white',
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </form>
    </>
  )
}
