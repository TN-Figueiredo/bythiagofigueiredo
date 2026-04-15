import { ringContext } from '../cms/repositories'

export async function getEmailSender(siteId: string): Promise<{
  email: string
  name: string
  brandName: string
  primaryColor?: string
}> {
  const site = await ringContext().getSite(siteId)
  if (!site) throw new Error(`site not found: ${siteId}`)
  const primaryDomain = site.domains[0] ?? 'bythiagofigueiredo.com'
  return {
    email: `noreply@${primaryDomain}`,
    name: site.name,
    brandName: site.name,
    primaryColor: '#0070f3', // Sprint 4 will resolve from sites.brand_color column
  }
}
