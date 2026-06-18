import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '../../../src/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — v3 nav redesign', () => {
  const sections = buildCmsSections()

  it('has 6 sections', () => {
    expect(sections.length).toBe(6)
  })

  it('has 25 total items', () => {
    const total = sections.reduce((sum, s) => sum + s.items.length, 0)
    expect(total).toBe(25)
  })

  it('section labels in order: HUB, Content, Library, YouTube, Social, Audience', () => {
    expect(sections.map(s => s.label)).toEqual([
      'HUB', 'Content', 'Library', 'YouTube', 'Social', 'Audience',
    ])
  })

  it('section item counts: 4, 7, 4, 5, 2, 3', () => {
    expect(sections.map(s => s.items.length)).toEqual([4, 7, 4, 5, 2, 3])
  })

  it('all hrefs are unique (no duplicate nav entries)', () => {
    const allHrefs = sections.flatMap(s => s.items.map(i => i.href))
    expect(new Set(allHrefs).size).toBe(allHrefs.length)
  })

  it('all labels are unique across sections', () => {
    const allLabels = sections.flatMap(s => s.items.map(i => i.label))
    expect(new Set(allLabels).size).toBe(allLabels.length)
  })

  describe('HUB (4 items)', () => {
    const hub = sections.find(s => s.label === 'HUB')!

    it('items in order: Dashboard, Up Next, Schedule, Notificações', () => {
      expect(hub.items.map(i => i.label)).toEqual([
        'Dashboard', 'Up Next', 'Schedule', 'Notificações',
      ])
    })

    it('correct hrefs', () => {
      expect(hub.items.map(i => i.href)).toEqual([
        '/cms', '/cms/up-next', '/cms/schedule', '/cms/notifications',
      ])
    })

    it('Dashboard and Schedule have no minRole (public)', () => {
      expect(hub.items[0].minRole).toBeUndefined()
      expect(hub.items[2].minRole).toBeUndefined()
    })

    it('Up Next requires editor', () => {
      expect(hub.items[1].minRole).toBe('editor')
    })
  })

  describe('Content (7 items)', () => {
    const content = sections.find(s => s.label === 'Content')!

    it('items in order: Blog, Vídeos, Courses, Newsletters, Campaigns, Waitlists, Playlists', () => {
      expect(content.items.map(i => i.label)).toEqual([
        'Blog', 'Vídeos', 'Courses', 'Newsletters', 'Campaigns', 'Waitlists', 'Playlists',
      ])
    })

    it('Blog has no minRole (public), rest require editor', () => {
      expect(content.items[0].minRole).toBeUndefined()
      for (const item of content.items.slice(1)) {
        expect(item.minRole).toBe('editor')
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

  describe('YouTube (5 items)', () => {
    const youtube = sections.find(s => s.label === 'YouTube')!

    it('items in order: Channels, Videos, A/B Lab, Performance, Competitors', () => {
      expect(youtube.items.map(i => i.label)).toEqual([
        'Channels', 'Videos', 'A/B Lab', 'Performance', 'Competitors',
      ])
    })

    it('correct hrefs', () => {
      expect(youtube.items.map(i => i.href)).toEqual([
        '/cms/youtube', '/cms/youtube/videos', '/cms/youtube/ab-lab',
        '/cms/youtube/analytics', '/cms/youtube/competitors',
      ])
    })

    it('all items require editor role', () => {
      for (const item of youtube.items) {
        expect(item.minRole).toBe('editor')
      }
    })
  })

  describe('Social (2 items)', () => {
    const social = sections.find(s => s.label === 'Social')!

    it('items in order: Posts, Links', () => {
      expect(social.items.map(i => i.label)).toEqual([
        'Posts', 'Links',
      ])
    })

    it('correct hrefs', () => {
      expect(social.items.map(i => i.href)).toEqual([
        '/cms/social', '/cms/links',
      ])
    })
  })

  describe('Audience (3 items)', () => {
    const audience = sections.find(s => s.label === 'Audience')!

    it('items in order: Authors, Subscribers, Contacts', () => {
      expect(audience.items.map(i => i.label)).toEqual([
        'Authors', 'Subscribers', 'Contacts',
      ])
    })

    it('Contacts href is /cms/contacts', () => {
      expect(audience.items[2].href).toBe('/cms/contacts')
    })

    it('Contacts requires editor role', () => {
      expect(audience.items[2].minRole).toBe('editor')
    })
  })
})
