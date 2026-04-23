'use client'

import type { ReactNode } from 'react'
import { SidebarProvider } from './sidebar-context'
import { CmsSidebar } from './cms-sidebar'
import { CmsBottomNav } from './cms-bottom-nav'
import { ToastProvider } from './ui/toast'

interface CmsShellProps {
  siteName: string
  siteInitials: string
  userDisplayName: string
  userRole: string
  siteSwitcher?: ReactNode
  children: ReactNode
}

export function CmsShell({ siteName, siteInitials, userDisplayName, userRole, siteSwitcher, children }: CmsShellProps) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <div className="flex h-screen bg-cms-bg text-cms-text" data-area="cms">
          <CmsSidebar
            siteName={siteName}
            siteInitials={siteInitials}
            userDisplayName={userDisplayName}
            userRole={userRole}
            siteSwitcher={siteSwitcher}
          />
          <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>
          <CmsBottomNav />
        </div>
      </ToastProvider>
    </SidebarProvider>
  )
}
