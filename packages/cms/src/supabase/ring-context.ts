import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRingContext } from '../interfaces/ring-context'
import type { Organization, Site } from '../types/organization'

export class SupabaseRingContext implements IRingContext {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOrg(orgId: string): Promise<Organization | null> {
    const { data, error } = await this.supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
    if (error) throw error
    return data as Organization | null
  }

  async getSite(siteId: string): Promise<Site | null> {
    const { data, error } = await this.supabase.from('sites').select('*').eq('id', siteId).maybeSingle()
    if (error) throw error
    return data as Site | null
  }

  async getSiteByDomain(domain: string): Promise<Site | null> {
    const { data, error } = await this.supabase.from('sites').select('*').contains('domains', [domain]).maybeSingle()
    if (error) throw error
    return data as Site | null
  }

  async getSitesForOrg(orgId: string): Promise<Site[]> {
    const { data, error } = await this.supabase.from('sites').select('*').eq('org_id', orgId)
    if (error) throw error
    return (data ?? []) as Site[]
  }

  async canAdminSite(_userId: string, siteId: string): Promise<boolean> {
    // Prod path: RPC reads auth.uid() from JWT. _userId arg kept for interface
    // compatibility; when running under service_role, use can_admin_site_for_user.
    const { data, error } = await this.supabase.rpc('can_admin_site', { p_site_id: siteId })
    if (error) throw error
    return Boolean(data)
  }
}
