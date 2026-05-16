import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineFilterBar } from '@/app/cms/(authed)/pipeline/_components/pipeline-filter-bar'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms/pipeline/video',
}))

describe('PipelineFilterBar', () => {
  it('renders filter chips for language, priority, link', () => {
    render(<PipelineFilterBar />)
    expect(screen.getByText('Vínculo')).toBeDefined()
    expect(screen.getByText('Language')).toBeDefined()
    expect(screen.getByText('Priority')).toBeDefined()
  })

  it('updates URL params when chip selected', () => {
    render(<PipelineFilterBar />)
    fireEvent.click(screen.getByText('Priority'))
    fireEvent.click(screen.getByText('P5'))
    expect(mockReplace).toHaveBeenCalled()
  })
})
