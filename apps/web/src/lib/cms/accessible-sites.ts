import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RpcAccessibleSite } from '@/components/cms/site-switcher-provider'

export const getAccessibleSites = cache(
  async (supabase: SupabaseClient): Promise<RpcAccessibleSite[]> => {
    const { data } = await supabase.rpc('user_accessible_sites')
    return (data ?? []) as RpcAccessibleSite[]
  }
)
