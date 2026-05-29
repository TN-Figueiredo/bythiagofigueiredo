import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TabBar } from '../../src/app/cms/(authed)/links/_components/tab-bar'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/cms/links',
}))

describe('TabBar', () => {
  it('renders 3 tabs: Linktree, Short links, Analytics', () => {
    render(<TabBar activeTab="tree" />)
    expect(screen.getByRole('tab', { name: 'Linktree' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Short links' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Analytics' })).toBeDefined()
  })

  it('marks the active tab with aria-selected=true', () => {
    render(<TabBar activeTab="links" />)
    expect(screen.getByRole('tab', { name: 'Short links' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Linktree' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'Analytics' }).getAttribute('aria-selected')).toBe('false')
  })

  it('defaults to "tree" tab when activeTab is "tree"', () => {
    render(<TabBar activeTab="tree" />)
    expect(screen.getByRole('tab', { name: 'Linktree' }).getAttribute('aria-selected')).toBe('true')
  })

  it('each tab links to the correct query param URL', () => {
    render(<TabBar activeTab="tree" />)
    const linktreeTab = screen.getByRole('tab', { name: 'Linktree' })
    const shortLinksTab = screen.getByRole('tab', { name: 'Short links' })
    const analyticsTab = screen.getByRole('tab', { name: 'Analytics' })

    expect(linktreeTab.getAttribute('href')).toBe('/cms/links?tab=tree')
    expect(shortLinksTab.getAttribute('href')).toBe('/cms/links?tab=links')
    expect(analyticsTab.getAttribute('href')).toBe('/cms/links?tab=analytics')
  })

  it('renders as a tablist role', () => {
    render(<TabBar activeTab="analytics" />)
    expect(screen.getByRole('tablist')).toBeDefined()
  })
})
