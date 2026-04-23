import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu, ContextMenuItem, ContextMenuDivider } from '@/components/cms/ui/context-menu'

describe('ContextMenu', () => {
  it('renders nothing when closed', () => {
    render(
      <ContextMenu open={false} onClose={() => {}}>
        <span>menu content</span>
      </ContextMenu>
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('renders menu with children when open', () => {
    render(
      <ContextMenu open={true} onClose={() => {}}>
        <span>menu content</span>
      </ContextMenu>
    )
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByText('menu content')).toBeTruthy()
  })

  it('calls onClose on outside click', () => {
    const onClose = vi.fn()
    render(
      <div>
        <ContextMenu open={true} onClose={onClose}>
          <span>inside menu</span>
        </ContextMenu>
        <button data-testid="outside">outside</button>
      </div>
    )
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu open={true} onClose={onClose}>
        <span>menu</span>
      </ContextMenu>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when clicking inside the menu', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu open={true} onClose={onClose}>
        <span data-testid="inside">inside menu</span>
      </ContextMenu>
    )
    fireEvent.mouseDown(screen.getByTestId('inside'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not attach listeners when closed', () => {
    const onClose = vi.fn()
    render(
      <ContextMenu open={false} onClose={onClose}>
        <span>menu</span>
      </ContextMenu>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ContextMenuItem', () => {
  it('renders label text', () => {
    render(<ContextMenuItem label="Edit post" />)
    expect(screen.getByText('Edit post')).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ContextMenuItem label="Delete" onClick={onClick} />)
    fireEvent.click(screen.getByRole('menuitem'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders icon when provided', () => {
    render(<ContextMenuItem icon="✏️" label="Edit" />)
    expect(screen.getByText('✏️')).toBeTruthy()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ContextMenuItem label="Disabled action" disabled={true} />)
    const btn = screen.getByRole('menuitem') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<ContextMenuItem label="Disabled" disabled={true} onClick={onClick} />)
    fireEvent.click(screen.getByRole('menuitem'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ContextMenuDivider', () => {
  it('renders a divider element', () => {
    const { container } = render(<ContextMenuDivider />)
    const divider = container.querySelector('.bg-cms-border')
    expect(divider).toBeTruthy()
  })
})
