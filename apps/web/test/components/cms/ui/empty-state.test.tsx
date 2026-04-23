import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/cms/ui/empty-state'

describe('EmptyState', () => {
  const baseProps = {
    icon: '📭',
    title: 'No posts yet',
    description: 'Create your first post to get started.',
  }

  it('renders the icon', () => {
    render(<EmptyState {...baseProps} />)
    expect(screen.getByText('📭')).toBeTruthy()
  })

  it('renders the title', () => {
    render(<EmptyState {...baseProps} />)
    expect(screen.getByText('No posts yet')).toBeTruthy()
  })

  it('renders the description', () => {
    render(<EmptyState {...baseProps} />)
    expect(screen.getByText('Create your first post to get started.')).toBeTruthy()
  })

  it('renders action button when provided', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        {...baseProps}
        actions={<button onClick={onClick}>New Post</button>}
      />
    )
    const btn = screen.getByText('New Post')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not render actions container when not provided', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    expect(screen.queryByRole('button')).toBeNull()
    // actions wrapper uses flex gap — check it's absent
    const flexContainers = container.querySelectorAll('.flex.gap-3.justify-center')
    expect(flexContainers.length).toBe(0)
  })

  it('renders hint cards when hints are provided', () => {
    const hints = [
      { icon: '✍️', title: 'Write', description: 'Compose your content.' },
      { icon: '🚀', title: 'Publish', description: 'Go live instantly.' },
    ]
    render(<EmptyState {...baseProps} hints={hints} />)
    expect(screen.getByText('Write')).toBeTruthy()
    expect(screen.getByText('Publish')).toBeTruthy()
    expect(screen.getByText('Compose your content.')).toBeTruthy()
  })

  it('does not render hints grid when hints is empty', () => {
    const { container } = render(<EmptyState {...baseProps} hints={[]} />)
    expect(container.querySelector('.grid')).toBeNull()
  })

  it('does not render hints grid when hints is not provided', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    expect(container.querySelector('.grid')).toBeNull()
  })
})
