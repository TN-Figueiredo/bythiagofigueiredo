import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LaunchRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/launch-renderer'

describe('LaunchRenderer', () => {
  const baseProps = {
    content: {
      launch_type: 'seed',
      plc_sequence: [
        { number: 1, title: 'The Opportunity', theme: 'opportunity', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: '2026-07-01', status: 'drafted', key_message: 'AI is changing everything', mental_triggers: ['authority'] },
        { number: 2, title: 'The Framework', theme: 'teaching', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
        { number: 3, title: 'Ownership', theme: 'ownership', content_format: 'video', pipeline_ref: null, campaign_ref: null, planned_date: null, status: 'planned', key_message: '', mental_triggers: [] },
      ],
      cart_open_date: null,
      cart_close_date: null,
      early_bird_deadline: null,
      bonuses: [],
      email_campaign_id: null,
      mental_triggers: { authority: null, social_proof: null, reciprocity: null, scarcity: null, community: null, anticipation: null },
      notes: '',
    },
    isEditing: false,
    lang: 'shared',
    onContentChange: vi.fn(),
  }

  it('renders PLC titles', () => {
    render(<LaunchRenderer {...baseProps} />)
    expect(screen.getByText('The Opportunity')).toBeTruthy()
  })

  it('renders launch type label', () => {
    render(<LaunchRenderer {...baseProps} />)
    // launch_type 'seed' is displayed as the Portuguese label 'Semente'
    expect(screen.getByText('Semente')).toBeTruthy()
  })
})
