import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/app/cms/(authed)/playlists/[id]/_components/filter-bar'
import type { FilterState, ContentType } from '@/lib/playlists/types'

const emptyFilter: FilterState = { types: new Set(), languages: new Set(), mode: 'all', search: '' }
const defaultCounts: Record<ContentType, number> = { video: 5, blog_post: 12, newsletter: 3, pipeline: 2 }

describe('FilterBar', () => {
  it('renders all type chips', () => {
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Video')).toBeTruthy()
    expect(screen.getByText('Blog')).toBeTruthy()
    expect(screen.getByText('News')).toBeTruthy()
    expect(screen.getByText('Pipe')).toBeTruthy()
  })

  it('renders language chips', () => {
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    expect(screen.getByText('PT-BR')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('renders mode toggle buttons', () => {
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    expect(screen.getByText('Show')).toBeTruthy()
    expect(screen.getByText('Dim')).toBeTruthy()
    expect(screen.getByText('Hide')).toBeTruthy()
  })

  it('shows correct counts on type chips', () => {
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    expect(screen.getByText('22')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('clicking a type chip adds it to filter.types', () => {
    const onChange = vi.fn()
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={onChange} />)
    fireEvent.click(screen.getByText('Video'))
    expect(onChange).toHaveBeenCalledOnce()
    const newFilter = onChange.mock.calls[0]![0] as FilterState
    expect(newFilter.types.has('video')).toBe(true)
    expect(newFilter.types.size).toBe(1)
  })

  it('clicking an active type chip removes it from filter.types', () => {
    const onChange = vi.fn()
    const filter: FilterState = { ...emptyFilter, types: new Set<ContentType>(['video']) }
    render(<FilterBar filter={filter} counts={defaultCounts} totalCount={22} onChange={onChange} />)
    fireEvent.click(screen.getByText('Video'))
    expect(onChange).toHaveBeenCalledOnce()
    const newFilter = onChange.mock.calls[0]![0] as FilterState
    expect(newFilter.types.has('video')).toBe(false)
  })

  it('clicking All clears types', () => {
    const onChange = vi.fn()
    const filter: FilterState = { ...emptyFilter, types: new Set<ContentType>(['video', 'blog_post']) }
    render(<FilterBar filter={filter} counts={defaultCounts} totalCount={22} onChange={onChange} />)
    fireEvent.click(screen.getByText('All'))
    expect(onChange).toHaveBeenCalledOnce()
    const newFilter = onChange.mock.calls[0]![0] as FilterState
    expect(newFilter.types.size).toBe(0)
  })

  it('clicking a language chip toggles it', () => {
    const onChange = vi.fn()
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={onChange} />)
    fireEvent.click(screen.getByText('PT-BR'))
    expect(onChange).toHaveBeenCalledOnce()
    const newFilter = onChange.mock.calls[0]![0] as FilterState
    expect(newFilter.languages.has('pt-br')).toBe(true)
  })

  it('mode toggle switches mode', () => {
    const onChange = vi.fn()
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={onChange} />)
    fireEvent.click(screen.getByText('Dim'))
    expect(onChange).toHaveBeenCalledOnce()
    const newFilter = onChange.mock.calls[0]![0] as FilterState
    expect(newFilter.mode).toBe('dim')
  })

  it('All chip has aria-pressed=true when no types selected', () => {
    render(<FilterBar filter={emptyFilter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    const allBtn = screen.getByText('All').closest('button')!
    expect(allBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('active type chip has aria-pressed=true', () => {
    const filter: FilterState = { ...emptyFilter, types: new Set<ContentType>(['video']) }
    render(<FilterBar filter={filter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    const videoBtn = screen.getByText('Video').closest('button')!
    expect(videoBtn.getAttribute('aria-pressed')).toBe('true')
    const blogBtn = screen.getByText('Blog').closest('button')!
    expect(blogBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('active mode button has aria-pressed=true', () => {
    const filter: FilterState = { ...emptyFilter, mode: 'dim' }
    render(<FilterBar filter={filter} counts={defaultCounts} totalCount={22} onChange={vi.fn()} />)
    expect(screen.getByText('Dim').closest('button')!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Show').closest('button')!.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Hide').closest('button')!.getAttribute('aria-pressed')).toBe('false')
  })
})
