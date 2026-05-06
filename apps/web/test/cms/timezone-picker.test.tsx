import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimezonePicker } from '../../src/app/cms/(authed)/settings/_components/timezone-picker'

describe('TimezonePicker', () => {
  it('renders with selected timezone', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} />)
    const trigger = screen.getByTestId('timezone-picker-trigger')
    expect(trigger.textContent).toContain('America/Sao_Paulo')
  })

  it('opens dropdown on click', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    expect(screen.queryByTestId('timezone-picker-dropdown')).not.toBeNull()
  })

  it('shows common timezones in dropdown', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    expect(screen.queryByTestId('timezone-option-America/Sao_Paulo')).not.toBeNull()
    expect(screen.queryByTestId('timezone-option-America/New_York')).not.toBeNull()
    expect(screen.queryByTestId('timezone-option-Europe/London')).not.toBeNull()
    expect(screen.queryByTestId('timezone-option-Asia/Tokyo')).not.toBeNull()
    expect(screen.queryByTestId('timezone-option-UTC')).not.toBeNull()
  })

  it('filters timezones on search', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    const searchInput = screen.getByTestId('timezone-picker-search')
    fireEvent.change(searchInput, { target: { value: 'Tokyo' } })
    expect(screen.queryByTestId('timezone-option-Asia/Tokyo')).not.toBeNull()
    expect(screen.queryByTestId('timezone-option-America/Sao_Paulo')).toBeNull()
  })

  it('calls onChange when timezone is selected', () => {
    const onChange = vi.fn()
    render(<TimezonePicker value="America/Sao_Paulo" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    fireEvent.click(screen.getByTestId('timezone-option-Europe/London'))
    expect(onChange).toHaveBeenCalledWith('Europe/London')
  })

  it('closes dropdown after selection', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    expect(screen.queryByTestId('timezone-picker-dropdown')).not.toBeNull()
    fireEvent.click(screen.getByTestId('timezone-option-UTC'))
    expect(screen.queryByTestId('timezone-picker-dropdown')).toBeNull()
  })

  it('highlights the currently selected timezone', () => {
    render(<TimezonePicker value="UTC" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    const option = screen.getByTestId('timezone-option-UTC')
    expect(option.className).toContain('border-indigo-500')
  })

  it('disables when disabled prop is true', () => {
    render(<TimezonePicker value="UTC" onChange={vi.fn()} disabled />)
    const trigger = screen.getByTestId('timezone-picker-trigger')
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows "No timezones found" for no-match search', () => {
    render(<TimezonePicker value="UTC" onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('timezone-picker-trigger'))
    fireEvent.change(screen.getByTestId('timezone-picker-search'), {
      target: { value: 'zzzzzznotazone' },
    })
    expect(screen.queryByText('No timezones found')).not.toBeNull()
  })

  it('shows abbreviation badge and UTC offset', () => {
    render(<TimezonePicker value="America/Sao_Paulo" onChange={vi.fn()} />)
    const trigger = screen.getByTestId('timezone-picker-trigger')
    expect(trigger.textContent).toMatch(/UTC/)
  })
})
