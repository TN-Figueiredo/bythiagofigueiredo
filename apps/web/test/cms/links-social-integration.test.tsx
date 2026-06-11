/**
 * @vitest-environment happy-dom
 *
 * NOTE: this file originally tested <SocialSummaryBar> and <SourceBreakdownChart>,
 * both deleted in f4fd7198 (2026-05-29 links redesign) — the file was left orphaned
 * and failed module resolution ever since. The social-attribution intent survives in
 * <SourceBars> (the redesign's source-breakdown successor), which is what we pin here:
 * social-origin clicks must stay visible in the links dashboard breakdown.
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SourceBars } from '../../src/app/cms/(authed)/links/_components/source-bars'

describe('SourceBars — social source integration', () => {
  const sources = [
    { id: 'blog', clicks: 120, pct: 39 },
    { id: 'social', clicks: 85, pct: 28 },
    { id: 'newsletter', clicks: 45, pct: 15 },
    { id: 'campaign', clicks: 30, pct: 10 },
    { id: 'manual', clicks: 15, pct: 5 },
    { id: 'video', clicks: 10, pct: 3 },
  ]

  it('renders a row for every source including social', () => {
    const { container } = render(<SourceBars sources={sources} />)
    const rows = container.querySelectorAll('[data-source-row]')
    expect(rows.length).toBe(6)
  })

  it('renders social click count', () => {
    render(<SourceBars sources={sources} />)
    expect(screen.getByText('85')).toBeDefined()
    expect(screen.getByText('120')).toBeDefined()
  })

  it('uses custom label when provided', () => {
    render(<SourceBars sources={[{ id: 'social', label: 'Redes sociais', clicks: 9, pct: 100 }]} />)
    expect(screen.getByText('Redes sociais')).toBeDefined()
  })

  it('exposes the chart as an accessible image', () => {
    render(<SourceBars sources={sources} />)
    expect(screen.getByRole('img', { name: /Distribuicao de cliques por origem/ })).toBeDefined()
  })
})
