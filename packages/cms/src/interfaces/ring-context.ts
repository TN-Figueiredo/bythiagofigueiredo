import type { Organization, Site } from '../types/organization'

export interface IRingContext {
  getOrg(orgId: string): Promise<Organization | null>
  getSite(siteId: string): Promise<Site | null>
  getSiteByDomain(domain: string): Promise<Site | null>
  getSitesForOrg(orgId: string): Promise<Site[]>
  canAdminSite(userId: string, siteId: string): Promise<boolean>
}
