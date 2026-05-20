import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinktreeClicksTable } from '@/app/cms/(authed)/linktree/analytics/_components/linktree-clicks-table'

describe('LinktreeClicksTable', () => {
  const clicksByKey = {
    highlight: 50,
    'blog:pt:meu-post': 30,
    'social:instagram': 15,
    'shared:a1b2c3d4': 5,
  }

  it('renders correct number of rows (header + data + footer)', () => {
    render(<LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={100} />)
    const rows = screen.getAllByRole('row')
    // header + 4 data rows + footer = 6
    expect(rows).toHaveLength(6)
  })

  it('renders correct section badges for each key type', () => {
    render(<LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={100} />)
    expect(screen.getByText('Highlight')).toBeDefined()
    expect(screen.getByText('PT')).toBeDefined()
    expect(screen.getByText('Social')).toBeDefined()
    expect(screen.getByText('Shared')).toBeDefined()
  })

  it('shows correct total in footer', () => {
    render(<LinktreeClicksTable clicksByKey={clicksByKey} totalClicks={100} />)
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Total')).toBeDefined()
  })

  it('calculates correct percentage for a single key', () => {
    render(<LinktreeClicksTable clicksByKey={{ highlight: 50 }} totalClicks={100} />)
    expect(screen.getByText('50.0%')).toBeDefined()
  })

  it('handles empty clicksByKey gracefully (only header + footer)', () => {
    render(<LinktreeClicksTable clicksByKey={{}} totalClicks={0} />)
    const rows = screen.getAllByRole('row')
    // header + footer only = 2
    expect(rows).toHaveLength(2)
  })

  it('renders 0 total when totalClicks is 0', () => {
    render(<LinktreeClicksTable clicksByKey={{}} totalClicks={0} />)
    expect(screen.getByText('0')).toBeDefined()
  })

  it('shows 0.0% percentage when totalClicks is 0', () => {
    render(<LinktreeClicksTable clicksByKey={{ highlight: 5 }} totalClicks={0} />)
    expect(screen.getByText('0.0%')).toBeDefined()
  })

  it('renders rows sorted by click count descending', () => {
    render(<LinktreeClicksTable clicksByKey={{ 'social:x': 5, highlight: 50, 'shared:abc': 20 }} totalClicks={75} />)
    const rows = screen.getAllByRole('row')
    // Row 1 (index 1) should be highlight (50), row 2 shared (20), row 3 social (5)
    // Check rank number column text in data rows
    const dataRows = rows.slice(1, rows.length - 1)
    expect(dataRows[0]?.textContent).toContain('1')
    expect(dataRows[0]?.textContent).toContain('50')
    expect(dataRows[1]?.textContent).toContain('2')
    expect(dataRows[1]?.textContent).toContain('20')
  })

  it('renders EN badge for english content keys', () => {
    render(<LinktreeClicksTable clicksByKey={{ 'blog:en:my-post': 10 }} totalClicks={10} />)
    expect(screen.getByText('EN')).toBeDefined()
  })

  it("renders What's New badge for latest: keys", () => {
    render(<LinktreeClicksTable clicksByKey={{ 'latest:blog:my-post': 10 }} totalClicks={10} />)
    expect(screen.getByText("What's New")).toBeDefined()
  })

  it('renders Other badge for unknown key prefixes', () => {
    render(<LinktreeClicksTable clicksByKey={{ 'custom:whatever': 10 }} totalClicks={10} />)
    expect(screen.getByText('Other')).toBeDefined()
  })

  it('formats highlight card label correctly', () => {
    render(<LinktreeClicksTable clicksByKey={{ highlight: 10 }} totalClicks={10} />)
    expect(screen.getByText('Highlight Card')).toBeDefined()
  })

  it('formats social link label with capitalized platform name', () => {
    render(<LinktreeClicksTable clicksByKey={{ 'social:instagram': 10 }} totalClicks={10} />)
    expect(screen.getByText('Instagram')).toBeDefined()
  })
})
