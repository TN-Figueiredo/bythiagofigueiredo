import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'

const mockSearchContent = vi.fn()
vi.mock(
  '@/app/cms/(authed)/social/new/_actions/search-content',
  () => ({
    searchContent: mockSearchContent,
  }),
)

describe('ContentPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchContent.mockResolvedValue({
      items: [
        {
          id: 'post-1',
          type: 'blog',
          title: 'AI Empire Article',
          thumbnail: 'https://example.com/thumb.jpg',
          status: 'published',
          updatedAt: '2026-05-14T10:00:00Z',
        },
        {
          id: 'ed-1',
          type: 'newsletter',
          title: 'Weekly Digest #42',
          thumbnail: null,
          status: 'sent',
          updatedAt: '2026-05-13T10:00:00Z',
        },
      ],
      counts: { all: 2, blog: 1, newsletter: 1, campaign: 0, video: 0 },
    })
  })

  it('renders mode toggle between "Do CMS" and "Compor do zero"', async () => {
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={vi.fn()}
        mode="cms"
      />,
    )

    expect(screen.getByText('Do CMS')).toBeDefined()
    expect(screen.getByText('Compor do zero')).toBeDefined()
  })

  it('switches mode when toggle clicked', async () => {
    const mockModeChange = vi.fn()
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={mockModeChange}
        mode="cms"
      />,
    )

    fireEvent.click(screen.getByText('Compor do zero'))
    expect(mockModeChange).toHaveBeenCalledWith('freeform')
  })

  it('shows tabs with counts when in CMS mode', async () => {
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={vi.fn()}
        mode="cms"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /todos/i })).toBeDefined()
    })

    expect(screen.getByRole('tab', { name: /blog/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /newsletter/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /campaign/i })).toBeDefined()
  })

  it('renders content items with title and type badge', async () => {
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={vi.fn()}
        mode="cms"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('AI Empire Article')).toBeDefined()
    })

    expect(screen.getByText('Weekly Digest #42')).toBeDefined()
  })

  it('calls onSelect when item is clicked', async () => {
    const mockSelect = vi.fn()
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={mockSelect}
        onModeChange={vi.fn()}
        mode="cms"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('AI Empire Article')).toBeDefined()
    })

    fireEvent.click(screen.getByText('AI Empire Article'))

    expect(mockSelect).toHaveBeenCalledWith('blog', 'post-1', expect.objectContaining({
      title: 'AI Empire Article',
    }))
  })

  it('filters by tab when tab clicked', async () => {
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={vi.fn()}
        mode="cms"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /blog/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('tab', { name: /blog/i }))

    await waitFor(() => {
      expect(mockSearchContent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'blog' }),
      )
    })
  })

  it('searches with debounce on input', async () => {
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={vi.fn()}
        mode="cms"
      />,
    )

    // Wait for initial load to settle
    await waitFor(() => {
      expect(mockSearchContent).toHaveBeenCalledTimes(1)
    })

    const searchInput = screen.getByPlaceholderText(/buscar/i)
    fireEvent.change(searchInput, { target: { value: 'AI' } })

    // The debounce is 300ms — wait for the debounced call to fire
    await waitFor(
      () => {
        expect(mockSearchContent).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'AI' }),
        )
      },
      { timeout: 2000 },
    )
  })

  it('hides content list in freeform mode', async () => {
    const { ContentPicker } = await import(
      '@/app/cms/(authed)/social/new/_components/content-picker'
    )

    render(
      <ContentPicker
        onSelect={vi.fn()}
        onModeChange={vi.fn()}
        mode="freeform"
      />,
    )

    expect(screen.queryByText('AI Empire Article')).toBeNull()
    expect(screen.queryByPlaceholderText(/buscar/i)).toBeNull()
  })
})
