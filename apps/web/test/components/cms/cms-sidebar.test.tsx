import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CmsSidebar } from '@/components/cms/cms-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/cms',
}))

const mockUseSidebar = vi.fn(() => ({ mode: 'expanded' as const, isExpanded: true, toggle: () => {} }))

vi.mock('@/components/cms/sidebar-context', () => ({
  useSidebar: () => mockUseSidebar(),
}))

describe('CmsSidebar', () => {
  const props = {
    siteName: 'Test Site',
    siteInitials: 'TS',
    userDisplayName: 'Test User',
    userRole: 'editor',
  }

  it('renders all nav sections', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Posts')).toBeDefined()
    expect(screen.getByText('Newsletters')).toBeDefined()
    expect(screen.getByText('Campaigns')).toBeDefined()
    expect(screen.getByText('Authors')).toBeDefined()
    expect(screen.getByText('Analytics')).toBeDefined()
    expect(screen.getByText('Schedule')).toBeDefined()
  })

  it('hides Subscribers from editor role', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.queryByText('Subscribers')).toBeNull()
  })

  it('hides Settings from editor role', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.queryByText('Settings')).toBeNull()
  })

  it('shows Settings for org_admin', () => {
    render(<CmsSidebar {...props} userRole="org_admin" />)
    expect(screen.getByText('Settings')).toBeDefined()
  })

  it('renders site name and user info', () => {
    render(<CmsSidebar {...props} />)
    expect(screen.getByText('Test Site')).toBeDefined()
    expect(screen.getByText('Test User')).toBeDefined()
    expect(screen.getByText('editor')).toBeDefined()
  })

  it('highlights active Dashboard link', () => {
    const { container } = render(<CmsSidebar {...props} />)
    const dashboardLink = container.querySelector('a[href="/cms"]')
    expect(dashboardLink?.className).toContain('text-cms-accent')
  })

  it('renders badge count next to nav item when badges prop is provided', () => {
    render(<CmsSidebar {...props} badges={{ '/cms/blog': 5 }} />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows only icons when collapsed mode is active', () => {
    mockUseSidebar.mockReturnValue({ mode: 'collapsed' as const, isExpanded: false, toggle: () => {} })
    const { container } = render(<CmsSidebar {...props} />)
    // Text labels must not be rendered in collapsed mode
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.queryByText('Posts')).toBeNull()
    // Aside must use the narrow collapsed width
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-12')
    // Restore default for subsequent tests
    mockUseSidebar.mockReturnValue({ mode: 'expanded' as const, isExpanded: true, toggle: () => {} })
  })
})
