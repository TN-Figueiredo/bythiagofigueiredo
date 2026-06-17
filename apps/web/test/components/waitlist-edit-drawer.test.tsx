import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WaitlistEditDrawer } from '../../src/app/cms/(authed)/waitlists/_components/edit-drawer'

afterEach(cleanup)

describe('<WaitlistEditDrawer>', () => {
  it('(a) Esc closes the drawer', () => {
    const onClose = vi.fn()
    render(<WaitlistEditDrawer mode="create" onClose={onClose} onSubmit={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('(b) Save reads the uncontrolled contentEditable intro into the payload', () => {
    const onSubmit = vi.fn()
    render(<WaitlistEditDrawer mode="create" onSubmit={onSubmit} onClose={vi.fn()} />)

    // Name is required for a valid submit; set it so Save proceeds.
    fireEvent.change(screen.getByTestId('wl-name'), { target: { value: 'Launch List' } })

    // The intro editor is an UNCONTROLLED contentEditable — write directly to the node.
    const intro = screen.getByTestId('wl-intro-editor')
    intro.textContent = 'Ships in March. Be first.'

    fireEvent.click(screen.getByRole('button', { name: /create waitlist/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.intro).toContain('Ships in March. Be first.')
  })

  it('(c) submit calls onSubmit with slug (auto-filled from name), name, and intro', () => {
    const onSubmit = vi.fn()
    render(<WaitlistEditDrawer mode="create" onSubmit={onSubmit} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('wl-name'), { target: { value: 'Nômade Dev · Turma 1' } })
    screen.getByTestId('wl-intro-editor').textContent = 'intro body'

    fireEvent.click(screen.getByRole('button', { name: /create waitlist/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.name).toBe('Nômade Dev · Turma 1')
    expect(payload.slug).toBe('nmade-dev-turma-1') // slugify strips the diacritic ô and the ·
    expect(payload.intro).toBe('intro body')
  })

  it('does not submit when the name is empty (shows the required hint instead)', () => {
    const onSubmit = vi.fn()
    render(<WaitlistEditDrawer mode="create" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /create waitlist/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
