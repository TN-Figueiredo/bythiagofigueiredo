import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '../../../src/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — v3 nav redesign', () => {
  const sections = buildCmsSections()

  it('has 5 sections', () => {
    expect(sections.length).toBe(5)
  })

  it('has 21 total items', () => {
    const total = sections.reduce((sum, s) => sum + s.items.length, 0)
    expect(total).toBe(21)
  })

  it('section labels in order: Overview, Content, Library, Social, People', () => {
    expect(sections.map(s => s.label)).toEqual([
      'Overview', 'Content', 'Library', 'Social', 'People',
    ])
  })

  it('section item counts: 5, 6, 4, 3, 3', () => {
    expect(sections.map(s => s.items.length)).toEqual([5, 6, 4, 3, 3])
  })

  it('all hrefs are unique (no duplicate nav entries)', () => {
    const allHrefs = sections.flatMap(s => s.items.map(i => i.href))
    expect(new Set(allHrefs).size).toBe(allHrefs.length)
  })

  it('all labels are unique across sections', () => {
    const allLabels = sections.flatMap(s => s.items.map(i => i.label))
    expect(new Set(allLabels).size).toBe(allLabels.length)
  })

  describe('Overview (5 items)', () => {
    const overview = sections.find(s => s.label === 'Overview')!

    it('items in order: Dashboard, Up Next, Schedule, Analytics, Notificações', () => {
      expect(overview.items.map(i => i.label)).toEqual([
        'Dashboard', 'Up Next', 'Schedule', 'Analytics', 'Notificações',
      ])
    })

    it('correct hrefs', () => {
      expect(overview.items.map(i => i.href)).toEqual([
        '/cms', '/cms/up-next', '/cms/schedule', '/cms/analytics', '/cms/notifications',
      ])
    })

    it('Dashboard and Schedule have no minRole (public)', () => {
      expect(overview.items[0].minRole).toBeUndefined()
      expect(overview.items[2].minRole).toBeUndefined()
    })

    it('Up Next and Analytics require editor', () => {
      expect(overview.items[1].minRole).toBe('editor')
      expect(overview.items[3].minRole).toBe('editor')
    })

    it('no Top Fans item (absorbed into Analytics tab)', () => {
      expect(overview.items.find(i => i.label === 'Top Fans')).toBeUndefined()
    })
  })

  describe('Content (6 items)', () => {
    const content = sections.find(s => s.label === 'Content')!

    it('items in order: Blog, Video, Courses, Newsletters, Campaigns, Playlists', () => {
      expect(content.items.map(i => i.label)).toEqual([
        'Blog', 'Video', 'Courses', 'Newsletters', 'Campaigns', 'Playlists',
      ])
    })

    it('Blog has no minRole (public), rest require editor', () => {
      expect(content.items[0].minRole).toBeUndefined()
      for (const item of content.items.slice(1)) {
        expect(item.minRole).toBe('editor')
      }
    })

    it('does not contain Pipeline, Research, Reference, Audio, Media, Links, Linktree', () => {
      const labels = content.items.map(i => i.label)
      for (const removed of ['Pipeline', 'Research', 'Reference', 'Audio', 'Media', 'Links', 'Linktree', 'Link in Bio']) {
        expect(labels).not.toContain(removed)
      }
    })
  })

  describe('Library (4 items)', () => {
    const library = sections.find(s => s.label === 'Library')!

    it('items in order: Research, Reference, Media, Audio', () => {
      expect(library.items.map(i => i.label)).toEqual([
        'Research', 'Reference', 'Media', 'Audio',
      ])
    })

    it('correct hrefs', () => {
      expect(library.items.map(i => i.href)).toEqual([
        '/cms/library/research', '/cms/library/reference', '/cms/media', '/cms/library/audio',
      ])
    })

    it('all items require editor role', () => {
      for (const item of library.items) {
        expect(item.minRole).toBe('editor')
      }
    })
  })

  describe('Social (3 items)', () => {
    const social = sections.find(s => s.label === 'Social')!

    it('items in order: YouTube, Posts, Links', () => {
      expect(social.items.map(i => i.label)).toEqual([
        'YouTube', 'Posts', 'Links',
      ])
    })

    it('correct hrefs', () => {
      expect(social.items.map(i => i.href)).toEqual([
        '/cms/youtube', '/cms/social', '/cms/links',
      ])
    })

    it('no Queue, Composer, Insights, Stories, Templates, Accounts, Link in Bio', () => {
      const labels = social.items.map(i => i.label)
      for (const removed of ['Queue', 'Composer', 'Insights', 'Stories', 'Templates', 'Accounts', 'Link in Bio']) {
        expect(labels).not.toContain(removed)
      }
    })
  })

  describe('People (3 items)', () => {
    const people = sections.find(s => s.label === 'People')!

    it('items in order: Authors, Subscribers, Contacts', () => {
      expect(people.items.map(i => i.label)).toEqual([
        'Authors', 'Subscribers', 'Contacts',
      ])
    })

    it('Contacts href is /cms/contacts', () => {
      expect(people.items[2].href).toBe('/cms/contacts')
    })

    it('Contacts requires editor role', () => {
      expect(people.items[2].minRole).toBe('editor')
    })
  })
})
