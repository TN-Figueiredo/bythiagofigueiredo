// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  // Guarded Proxy: serves ANY icon the component tree asks for, so the mock
  // doesn't rot when components add icons (the previous explicit list broke on
  // every new icon). `then` must resolve to undefined — a thenable mock
  // namespace deadlocks vitest's `await factory()` forever.
  // (`has` trap: vitest checks `export in mock` before reading it.)
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : icon(prop)),
    has: (_target, prop) => typeof prop === 'string' && prop !== 'then',
  })
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { TreeTab } from '@/app/cms/(authed)/links/_components/tree-tab'

afterEach(() => cleanup())

const treeMock = {
  url: 'https://go.bythiagofigueiredo.com',
  pageviews: 1234,
  last30: 890,
  unique: 456,
  engagement: 37.0,
  topCountry: 'BR',
  spark: Array.from({ length: 30 }, (_, i) => i),
  blocks: [
    { id: 'b1', label: 'Blog', section: 'English', clicks: 120, ctr: 9.7 },
    { id: 'b2', label: 'Newsletter', section: 'English', clicks: 80, ctr: 6.5 },
  ],
  sharedLinks: [
    { id: 's1', icon: 'globe', labelPt: 'Sobre mim', labelEn: 'About me', url: '/about' },
  ],
}

describe('TreeTab', () => {
  it('renders linktree preview card with URL', () => {
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText(/go\.bythiagofigueiredo\.com/)).toBeTruthy()
  })

  it('renders 4 stat cards', () => {
    const { container } = render(<TreeTab tree={treeMock} />)
    const stats = container.querySelectorAll('[data-stat-card]')
    expect(stats.length).toBe(4)
  })

  it('renders pageviews value', () => {
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText('1.234')).toBeTruthy()
  })

  it('renders block performance section', () => {
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText(/Desempenho por bloco/)).toBeTruthy()
  })

  it('renders block names', () => {
    // 'Blog' also appears as a source label elsewhere in the tab — use *AllBy*
    const { getAllByText } = render(<TreeTab tree={treeMock} />)
    expect(getAllByText('Blog').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Newsletter').length).toBeGreaterThanOrEqual(1)
  })

  it('renders edit and open buttons', () => {
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText('Editar')).toBeTruthy()
    expect(getByText('Abrir')).toBeTruthy()
  })

  it('renders merge banner', () => {
    localStorageMock.getItem.mockReturnValue(null)
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText(/Link in Bio agora vive aqui/)).toBeTruthy()
  })

  it('hides merge banner when dismissed', () => {
    localStorageMock.getItem.mockReturnValue(null)
    const { getByLabelText, queryByText } = render(<TreeTab tree={treeMock} />)
    fireEvent.click(getByLabelText('Fechar banner'))
    expect(queryByText(/Link in Bio agora vive aqui/)).toBeNull()
    expect(localStorageMock.setItem).toHaveBeenCalledWith('links-merge-banner-dismissed', '1')
  })

  it('does not render banner when already dismissed in localStorage', () => {
    localStorageMock.getItem.mockReturnValue('1')
    const { queryByText } = render(<TreeTab tree={treeMock} />)
    expect(queryByText(/Link in Bio agora vive aqui/)).toBeNull()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders analytics link in block performance panel', () => {
    localStorageMock.getItem.mockReturnValue(null)
    const { getByText } = render(<TreeTab tree={treeMock} />)
    const link = getByText('Analytics')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/cms/links?tab=analytics')
  })
})
