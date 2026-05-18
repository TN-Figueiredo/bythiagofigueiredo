import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScriptMetaEditor } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-meta-editor'

describe('ScriptMetaEditor', () => {
  it('renders non-empty meta fields in read mode', () => {
    const meta = { canal: 'EN', formato: 'Storytelling', duracao: '14 min' }
    render(<ScriptMetaEditor meta={meta} isEditing={false} onChange={vi.fn()} />)
    expect(screen.getByText('EN')).toBeTruthy()
    expect(screen.getByText('Storytelling')).toBeTruthy()
    expect(screen.getByText('14 min')).toBeTruthy()
  })

  it('hides empty fields in read mode', () => {
    const meta = { canal: 'EN' }
    const { container } = render(<ScriptMetaEditor meta={meta} isEditing={false} onChange={vi.fn()} />)
    // Only canal label + value should render, not all 6 fields
    // Read mode uses <span> for labels (info-card style), not <label>
    const fields = container.querySelectorAll('.flex.flex-col')
    expect(fields).toHaveLength(1)
  })

  it('shows all 6 fields in edit mode', () => {
    const { container } = render(<ScriptMetaEditor meta={{}} isEditing={true} onChange={vi.fn()} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(6)
  })

  it('calls onChange when editing a field', () => {
    const onChange = vi.fn()
    render(<ScriptMetaEditor meta={{ canal: 'EN' }} isEditing={true} onChange={onChange} />)
    const input = screen.getByLabelText('Canal') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'PT' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ canal: 'PT' }))
  })

  it('returns null when no meta and not editing', () => {
    const { container } = render(<ScriptMetaEditor meta={{}} isEditing={false} onChange={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
