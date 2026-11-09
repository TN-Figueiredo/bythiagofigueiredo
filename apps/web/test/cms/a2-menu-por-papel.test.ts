import { describe, it, expect } from 'vitest'
import { buildCmsSections, CMS_SETTINGS_ITEM } from '@/app/cms/(authed)/_shared/cms-sections'

// a mesma regra do CmsShell (@tn-figueiredo/cms-ui: ROLE_RANK e hasAccess)
const RANK: Record<string, number> = { reporter: 0, editor: 1, org_admin: 2, super_admin: 3 }
const ve = (papel: string, minRole?: string) => !minRole || (RANK[papel] ?? 0) >= (RANK[minRole] ?? 0)
const hrefs = (papel: string) => [
  ...buildCmsSections().flatMap((s) => s.items.filter((i) => ve(papel, i.minRole)).map((i) => i.href)),
  ...(ve(papel, CMS_SETTINGS_ITEM.minRole) ? [CMS_SETTINGS_ITEM.href] : []),
]

describe('A2: menu por papel', () => {
  it('reporter vê só o Observatório (nem Settings)', () => {
    expect(hrefs('reporter')).toEqual(['/cms/youtube/competitors'])
  })
  it('editor vê o menu de hoje (snapshot da lista de href)', () => {
    expect(hrefs('editor')).toEqual([
      '/cms', '/cms/up-next', '/cms/schedule', '/cms/notifications',
      '/cms/blog', '/cms/video', '/cms/courses', '/cms/newsletters', '/cms/campaigns', '/cms/waitlists', '/cms/playlists',
      '/cms/library/research', '/cms/library/reference', '/cms/media', '/cms/library/audio',
      '/cms/youtube', '/cms/youtube/videos', '/cms/youtube/ab-lab', '/cms/youtube/analytics', '/cms/youtube/competitors',
      '/cms/social', '/cms/links',
      '/cms/authors', '/cms/contacts',
      '/cms/settings',
    ])
  })
  it('org_admin vê tudo o que o editor vê, mais Subscribers', () => {
    expect(hrefs('org_admin')).toEqual(expect.arrayContaining([...hrefs('editor'), '/cms/subscribers']))
  })
})
