import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailMonogram } from '../../../src/emails/components/email-monogram'

describe('EmailMonogram', () => {
  it('renders TF monogram with italic F in accent color', async () => {
    const html = await render(React.createElement(EmailMonogram))
    expect(html).toContain('T')
    expect(html).toContain('F')
    expect(html).toContain('#FF8240')
  })

  it('centers the monogram', async () => {
    const html = await render(React.createElement(EmailMonogram))
    expect(html).toContain('center')
  })
})
