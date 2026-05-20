import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SharedLinksSection } from '@/app/cms/(authed)/linktree/_components/shared-links-section'
import type { z } from 'zod'
import type { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'

type Config = z.infer<typeof LinktreeConfigSchema>

const baseConfig: Config = {
  tagline_pt: 'tagline pt',
  tagline_en: 'tagline en',
  blog_desc_pt: '',
  blog_desc_en: '',
  highlight: {
    active: false,
    url: '',
    badge_pt: '',
    badge_en: '',
    title_pt: '',
    title_en: '',
    desc_pt: '',
    desc_en: '',
    cta_pt: '',
    cta_en: '',
  },
  shared_links: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      label_pt: 'Link 1',
      label_en: 'Link 1 EN',
      url: 'https://a.com',
      icon: 'link-2',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      label_pt: 'Link 2',
      label_en: 'Link 2 EN',
      url: 'https://b.com',
      icon: 'star',
    },
  ],
}

describe('SharedLinksSection', () => {
  it('renders all shared link inputs', () => {
    render(<SharedLinksSection config={baseConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.getByDisplayValue('Link 1')).toBeDefined()
    expect(screen.getByDisplayValue('Link 2')).toBeDefined()
  })

  it('calls onChange when add button is clicked', () => {
    const onChange = vi.fn()
    render(<SharedLinksSection config={baseConfig} onChange={onChange} readOnly={false} />)
    const addButton = screen.getByText('Adicionar link')
    fireEvent.click(addButton)
    expect(onChange).toHaveBeenCalledWith({
      shared_links: expect.arrayContaining([
        expect.objectContaining({ label_pt: '' }),
      ]),
    })
    // New list should have 3 links
    const call = onChange.mock.calls[0]?.[0] as { shared_links: unknown[] }
    expect(call.shared_links).toHaveLength(3)
  })

  it('shows correct link count', () => {
    render(<SharedLinksSection config={baseConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.getByText('2/10 links')).toBeDefined()
  })

  it('hides add button when at max (10) links', () => {
    const maxConfig: Config = {
      ...baseConfig,
      shared_links: Array.from({ length: 10 }, (_, i) => ({
        id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
        label_pt: `Link ${i}`,
        label_en: `Link ${i} EN`,
        url: `https://${i}.com`,
        icon: 'link-2',
      })),
    }
    render(<SharedLinksSection config={maxConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.queryByText('Adicionar link')).toBeNull()
  })

  it('shows 10/10 links when at max', () => {
    const maxConfig: Config = {
      ...baseConfig,
      shared_links: Array.from({ length: 10 }, (_, i) => ({
        id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
        label_pt: `Link ${i}`,
        label_en: `Link ${i} EN`,
        url: `https://${i}.com`,
        icon: 'link-2',
      })),
    }
    render(<SharedLinksSection config={maxConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.getByText('10/10 links')).toBeDefined()
  })

  it('disables add button in readOnly mode', () => {
    render(<SharedLinksSection config={baseConfig} onChange={vi.fn()} readOnly={true} />)
    const addButton = screen.getByText('Adicionar link')
    expect((addButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows 0/10 links when shared_links is empty', () => {
    const emptyConfig: Config = { ...baseConfig, shared_links: [] }
    render(<SharedLinksSection config={emptyConfig} onChange={vi.fn()} readOnly={false} />)
    expect(screen.getByText('0/10 links')).toBeDefined()
  })

  it('calls onChange with correct list when delete is triggered', () => {
    const onChange = vi.fn()
    render(<SharedLinksSection config={baseConfig} onChange={onChange} readOnly={false} />)
    // Each SortableLinkCard has a delete button with aria-label="Remover link"
    const deleteButtons = screen.getAllByRole('button', { name: 'Remover link' })
    expect(deleteButtons).toHaveLength(2)
    // Click the first delete button
    fireEvent.click(deleteButtons[0]!)
    expect(onChange).toHaveBeenCalledWith({
      shared_links: [expect.objectContaining({ id: '22222222-2222-2222-2222-222222222222' })],
    })
  })
})
