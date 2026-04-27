'use client'

import { createAdminLayout } from '@tn-figueiredo/admin'
import type { ReactNode } from 'react'

const AdminLayout = createAdminLayout({
  appName: 'Admin',
  logoutPath: '/admin/logout',
  sections: [
    {
      group: 'System',
      items: [
        { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
        { label: 'Users', path: '/admin/users', icon: 'Users' },
        { label: 'Anúncios', path: '/admin/ads', icon: 'Megaphone' },
        { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
      ],
    },
  ],
})

export function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string
  children: ReactNode
}) {
  return <AdminLayout userEmail={userEmail}>{children}</AdminLayout>
}
