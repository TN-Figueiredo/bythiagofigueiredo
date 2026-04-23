import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CmsSidebar } from '@/components/cms/cms-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/cms',
}))

vi.mock('@/components/cms/sidebar-context', () => ({
  useSidebar: () => ({ mode: 'expanded' as const, isExpanded: true, toggle: () => {} }),
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
})
