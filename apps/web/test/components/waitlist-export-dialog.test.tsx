import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ExportDialog } from '../../src/app/cms/(authed)/waitlists/_components/export-dialog'

afterEach(cleanup)

describe('<ExportDialog>', () => {
  it('shows the status filter + the exclude-suppressed toggle (default ON)', () => {
    render(<ExportDialog slug="launch-a" onClose={vi.fn()} onExport={vi.fn()} />)
    expect(screen.getByTestId('export-status')).toBeTruthy()
    const excludeSuppressed = screen.getByTestId('export-exclude-suppressed') as HTMLInputElement
    expect(excludeSuppressed.checked).toBe(true)
  })

  it('Esc closes the dialog', () => {
    const onClose = vi.fn()
    render(<ExportDialog slug="launch-a" onClose={onClose} onExport={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Export emits the selected options (default = exclude suppressed)', () => {
    const onExport = vi.fn()
    render(<ExportDialog slug="launch-a" onClose={vi.fn()} onExport={onExport} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport.mock.calls[0][0]).toMatchObject({ excludeSuppressed: true })
  })
})
