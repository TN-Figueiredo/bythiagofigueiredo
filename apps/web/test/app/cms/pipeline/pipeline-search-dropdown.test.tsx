import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PipelineSearchDropdown } from '@/app/cms/(authed)/pipeline/_components/pipeline-search-dropdown'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PipelineSearchDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input', () => {
    render(<PipelineSearchDropdown />)
    expect(screen.getByPlaceholderText('Buscar pipeline...')).toBeDefined()
  })

  it('does not fetch with less than 2 chars', async () => {
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'a' } })
    await new Promise((r) => setTimeout(r, 400))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches results after debounce with 2+ chars', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pipeline: [{ id: '1', code: 'vid-x', title_pt: 'Test', format: 'video', stage: 'idea' }], blog_posts: [], newsletters: [], collections: [] } }),
    })
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'vid' } })
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), { timeout: 500 })
    await waitFor(() => expect(screen.getByText('vid-x')).toBeDefined())
  })

  it('shows no results message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pipeline: [], blog_posts: [], newsletters: [], collections: [] } }),
    })
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'zzz' } })
    await waitFor(() => expect(screen.getByText(/Nenhum resultado/)).toBeDefined(), { timeout: 500 })
  })

  it('closes on Escape key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pipeline: [{ id: '1', code: 'vid-x', title_pt: 'Test', format: 'video', stage: 'idea' }], blog_posts: [], newsletters: [], collections: [] } }),
    })
    render(<PipelineSearchDropdown />)
    const input = screen.getByPlaceholderText('Buscar pipeline...')
    fireEvent.change(input, { target: { value: 'vid' } })
    await waitFor(() => expect(screen.getByText('vid-x')).toBeDefined(), { timeout: 500 })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('vid-x')).toBeNull()
  })
})
