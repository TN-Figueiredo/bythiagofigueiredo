import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/app/cms/(authed)/playlists/[id]/_components/filter-bar'
import type { FilterState, ContentType } from '@/lib/playlists/types'

const defaultFilter: FilterState = { types: new Set(), languages: new Set(), mode: 'all', search: '' }

const counts: Record<ContentType, number> = {
  video: 4,
  blog_post: 6,
  newsletter: 2,
  pipeline: 3,
}

const defaultProps = {
  filter: defaultFilter,
  counts,
  totalCount: 15,
  onChange: vi.fn(),
}

describe('FilterBar', () => {
  it('renders All chip with total count', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('15')).toBeTruthy()
  })

  it('renders type chips with counts', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('Video')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Blog')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
  })

  it('renders language chips', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('PT-BR')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
  })

  it('renders mode toggle with 3 options', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('Dim')).toBeTruthy()
    expect(screen.getByText('Hide')).toBeTruthy()
  })

  it('calls onChange when type chip is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar {...defaultProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('Video'))
    expect(onChange).toHaveBeenCalled()
    const newFilter = onChange.mock.calls[0][0] as FilterState
    expect(newFilter.types.has('video')).toBe(true)
  })

  it('calls onChange when language chip is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar {...defaultProps} onChange={onChange} />)
    fireEvent.click(screen.getByText('PT-BR'))
    expect(onChange).toHaveBeenCalled()
    const newFilter = onChange.mock.calls[0][0] as FilterState
    expect(newFilter.languages.has('pt-br')).toBe(true)
  })

  it('highlights active type chip', () => {
    const activeFilter: FilterState = { ...defaultFilter, types: new Set(['video' as ContentType]) }
    render(<FilterBar {...defaultProps} filter={activeFilter} />)
    const videoChip = screen.getByText('Video').closest('button')!
    expect(videoChip.className).toContain('text-white')
  })

  it('clicking All clears type filter', () => {
    const onChange = vi.fn()
    const activeFilter: FilterState = { ...defaultFilter, types: new Set(['video' as ContentType]) }
    render(<FilterBar {...defaultProps} filter={activeFilter} onChange={onChange} />)
    fireEvent.click(screen.getByText('All'))
    expect(onChange).toHaveBeenCalled()
    const newFilter = onChange.mock.calls[0][0] as FilterState
    expect(newFilter.types.size).toBe(0)
  })
})
