import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

import { AnalyticsHeader } from '@/app/cms/(authed)/analytics/_components/analytics-header'

describe('AnalyticsHeader — v3 tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 6 tab buttons including Fans', () => {
    render(<AnalyticsHeader activeTab="overview" activePeriod="30d" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(6)
  })

  it('tab labels in order: Overview, YouTube, Conteudo, Links, Audiencia, Fas', () => {
    render(<AnalyticsHeader activeTab="overview" activePeriod="30d" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual([
      'Overview', 'YouTube', 'Conteudo', 'Links', 'Audiencia', 'Fas',
    ])
  })

  it('has Fans tab with correct test id', () => {
    render(<AnalyticsHeader activeTab="overview" activePeriod="30d" />)
    expect(screen.getByTestId('tab-fans')).toBeTruthy()
  })

  it('highlights active Fans tab', () => {
    render(<AnalyticsHeader activeTab="fans" activePeriod="30d" />)
    const fansTab = screen.getByTestId('tab-fans')
    expect(fansTab.getAttribute('aria-selected')).toBe('true')
  })

  it('navigates to fans tab on click', () => {
    render(<AnalyticsHeader activeTab="overview" activePeriod="30d" />)
    fireEvent.click(screen.getByTestId('tab-fans'))
    expect(mockReplace).toHaveBeenCalled()
    const url = mockReplace.mock.calls[0][0] as string
    expect(url).toContain('tab=fans')
  })
})
