import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertRulesEditor } from './alert-rules-editor'
import type { AlertRule } from '../types'

const rules: AlertRule[] = [
  {
    id: 'rule-1',
    metric: 'clicks',
    condition: 'gt',
    threshold: 500,
    window: '24h',
    channel: 'email',
    active: true,
  },
  {
    id: 'rule-2',
    metric: 'unique_visitors',
    condition: 'lt',
    threshold: 10,
    window: '7d',
    channel: 'webhook',
    webhookUrl: 'https://hooks.example.com/abc',
    active: false,
  },
]

describe('AlertRulesEditor', () => {
  const defaultProps = {
    rules,
    onSave: vi.fn().mockResolvedValue({ ok: true }),
    onDelete: vi.fn().mockResolvedValue({ ok: true }),
  }

  it('renders all existing rules', () => {
    render(<AlertRulesEditor {...defaultProps} />)
    expect(screen.getByText(/clicks/i)).toBeInTheDocument()
    expect(screen.getByText(/unique_visitors/i)).toBeInTheDocument()
  })

  it('shows threshold value for each rule', () => {
    render(<AlertRulesEditor {...defaultProps} />)
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows window duration for each rule', () => {
    render(<AlertRulesEditor {...defaultProps} />)
    expect(screen.getByText('24h')).toBeInTheDocument()
    expect(screen.getByText('7d')).toBeInTheDocument()
  })

  it('shows channel for each rule', () => {
    render(<AlertRulesEditor {...defaultProps} />)
    expect(screen.getByText(/email/i)).toBeInTheDocument()
    expect(screen.getByText(/webhook/i)).toBeInTheDocument()
  })

  it('shows active/inactive status', () => {
    render(<AlertRulesEditor {...defaultProps} />)
    const toggles = screen.getAllByRole('checkbox')
    expect(toggles[0]).toBeChecked()
    expect(toggles[1]).not.toBeChecked()
  })

  it('renders add rule button', () => {
    render(<AlertRulesEditor {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument()
  })

  it('shows new rule form when add button clicked', async () => {
    const user = userEvent.setup()
    render(<AlertRulesEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /add rule/i }))
    expect(screen.getByLabelText(/metric/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/condition/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/threshold/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/window/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/channel/i)).toBeInTheDocument()
  })

  it('calls onSave with new rule data when form submitted', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    render(<AlertRulesEditor {...defaultProps} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: /add rule/i }))

    await user.selectOptions(screen.getByLabelText(/metric/i), 'clicks')
    await user.selectOptions(screen.getByLabelText(/condition/i), 'gt')
    await user.clear(screen.getByLabelText(/threshold/i))
    await user.type(screen.getByLabelText(/threshold/i), '1000')
    await user.selectOptions(screen.getByLabelText(/window/i), '6h')
    await user.selectOptions(screen.getByLabelText(/channel/i), 'email')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'clicks',
          condition: 'gt',
          threshold: 1000,
          window: '6h',
          channel: 'email',
        }),
      )
    })
  })

  it('calls onDelete when delete button clicked on a rule', async () => {
    const user = userEvent.setup()
    render(<AlertRulesEditor {...defaultProps} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])
    expect(defaultProps.onDelete).toHaveBeenCalledWith('rule-1')
  })

  it('renders webhook URL field when channel is webhook', async () => {
    const user = userEvent.setup()
    render(<AlertRulesEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /add rule/i }))
    await user.selectOptions(screen.getByLabelText(/channel/i), 'webhook')
    expect(screen.getByLabelText(/webhook url/i)).toBeInTheDocument()
  })

  it('hides webhook URL field when channel is email', async () => {
    const user = userEvent.setup()
    render(<AlertRulesEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /add rule/i }))
    await user.selectOptions(screen.getByLabelText(/channel/i), 'email')
    expect(screen.queryByLabelText(/webhook url/i)).not.toBeInTheDocument()
  })
})
