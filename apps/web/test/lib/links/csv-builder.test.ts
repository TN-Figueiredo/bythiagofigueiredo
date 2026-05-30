import { describe, it, expect } from 'vitest'
import { buildLinksCsv } from '@/lib/links/csv-builder'
import type { LinkDisplay } from '@tn-figueiredo/links-admin'

const mockLink: LinkDisplay = {
  id: '1',
  title: 'Test Link',
  slug: '/test',
  source: 'newsletter',
  badge: 'Newsletter',
  dest: 'https://example.com',
  status: 'active',
  clicks: 500,
  last30: 200,
  unique: 150,
  scans: 30,
  topCountry: 'BR',
  ctr: 12.5,
  created: '01 mai 2026',
  health: 'ok',
  redirect: 301,
  clickIds: true,
  spark: Array.from({ length: 14 }, () => 10),
}

describe('buildLinksCsv', () => {
  it('generates CSV with header row', () => {
    const csv = buildLinksCsv([mockLink])
    const lines = csv.split('\r\n')
    expect(lines[0]).toContain('Titulo')
    expect(lines[0]).toContain('Cliques')
    expect(lines[0]).toContain('Status')
  })

  it('generates data rows', () => {
    const csv = buildLinksCsv([mockLink])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('Test Link')
    expect(lines[1]).toContain('500')
    expect(lines[1]).toContain('Ativo')
  })

  it('maps source to Portuguese label', () => {
    const csv = buildLinksCsv([mockLink])
    expect(csv).toContain('Newsletter')
  })

  it('handles empty links array', () => {
    const csv = buildLinksCsv([])
    const lines = csv.split('\r\n')
    expect(lines.length).toBe(2) // header + empty trailing
  })

  it('formats CTR with percentage', () => {
    const csv = buildLinksCsv([mockLink])
    expect(csv).toContain('12.5%')
  })

  it('handles multiple links', () => {
    const link2 = { ...mockLink, id: '2', title: 'Second Link', clicks: 200 }
    const csv = buildLinksCsv([mockLink, link2])
    const lines = csv.split('\r\n')
    expect(lines.length).toBe(4) // header + 2 data + trailing
  })
})
