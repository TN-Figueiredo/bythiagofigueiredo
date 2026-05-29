// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Link2: icon('Link2'),
    ExternalLink: icon('ExternalLink'),
    Info: icon('Info'),
    Edit: icon('Edit'),
    Trophy: icon('Trophy'),
    Eye: icon('Eye'),
    Users: icon('Users'),
    Target: icon('Target'),
  }
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
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText('Blog')).toBeTruthy()
    expect(getByText('Newsletter')).toBeTruthy()
  })

  it('renders edit and open buttons', () => {
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText('Editar')).toBeTruthy()
    expect(getByText('Abrir')).toBeTruthy()
  })

  it('renders merge banner', () => {
    const { getByText } = render(<TreeTab tree={treeMock} />)
    expect(getByText(/Link in Bio agora vive aqui/)).toBeTruthy()
  })
})
