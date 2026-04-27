'use client'

import {
  SiteSwitcherProvider,
  useSiteSwitcher,
  type AccessibleSite,
} from '@tn-figueiredo/admin/site-switcher'
import { CmsSiteSwitcher } from '@tn-figueiredo/cms'
import type { ReactNode } from 'react'

export type { AccessibleSite }
export { SiteSwitcherProvider }

export interface RpcAccessibleSite {
  site_id: string
  site_name: string
  site_slug: string
  primary_domain: string
  org_id: string
  org_name: string
  user_role: 'super_admin' | 'org_admin' | 'editor' | 'reporter'
  is_master_ring: boolean
}

export function CmsSiteSwitcherSlot({
  sites,
}: {
  sites: RpcAccessibleSite[]
}): ReactNode {
  const { currentSiteId, setCurrentSiteId } = useSiteSwitcher()
  return (
    <CmsSiteSwitcher
      sites={sites}
      currentSiteId={currentSiteId}
      onChange={setCurrentSiteId}
    />
  )
}
