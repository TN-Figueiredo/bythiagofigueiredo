import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EditorToolbar } from '../../src/editor/toolbar'

describe('EditorToolbar', () => {
  it('fires onAction with "bold" when B button clicked', () => {
    const onAction = vi.fn()
    render(<EditorToolbar onAction={onAction} componentNames={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /bold/i }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'bold' })
  })

  it('opens component dropdown and fires onAction with component insert', () => {
    const onAction = vi.fn()
    render(<EditorToolbar onAction={onAction} componentNames={['Callout', 'YouTube']} />)
    fireEvent.click(screen.getByRole('button', { name: /insert component/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /callout/i }))
    expect(onAction).toHaveBeenCalledWith({ kind: 'component', name: 'Callout' })
  })
})
