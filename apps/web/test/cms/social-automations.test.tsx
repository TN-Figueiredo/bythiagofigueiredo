import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/cms/social/accounts',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { AutomationsList } from '@/app/cms/(authed)/social/accounts/_components/automations-list'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

describe('AutomationsList', () => {
  it('renders all 8 automation rules', () => {
    render(<AutomationsList strings={en} />)
    expect(screen.getByText(en.accounts.automations.blogPublished)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.videoPublished)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.newsletterSent)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.evergreenTimer)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.tokenExpiring)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.postFailed)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.abTestComplete)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.playlistUpdated)).toBeDefined()
  })

  it('renders toggle switches for each rule', () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(8)
  })

  it('renders category headers', () => {
    render(<AutomationsList strings={en} />)
    expect(screen.getByText(en.accounts.automations.categoryContent)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.categorySystem)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.categoryOptimization)).toBeDefined()
  })

  it('renders description text for each rule', () => {
    render(<AutomationsList strings={en} />)
    expect(screen.getByText(en.accounts.automations.blogPublishedDesc)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.videoPublishedDesc)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.tokenExpiringDesc)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.evergreenTimerDesc)).toBeDefined()
  })

  it('renders summary bar with correct counts', () => {
    render(<AutomationsList strings={en} />)
    // 8 total rules, 2 active (token_expiring + post_failed), 6 paused
    expect(screen.getByText('8')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('6')).toBeDefined()
  })

  it('shows mode badges (DRAFT / AUTO)', () => {
    render(<AutomationsList strings={en} />)
    const draftBadges = screen.getAllByText('DRAFT')
    const autoBadges = screen.getAllByText('AUTO')
    expect(draftBadges.length + autoBadges.length).toBe(8)
  })

  it('fires toggle when switch is clicked', async () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    const blogSwitch = switches[0]
    const initialState = blogSwitch.getAttribute('aria-checked')
    fireEvent.click(blogSwitch)
    await waitFor(() => {
      expect(blogSwitch.getAttribute('aria-checked')).not.toBe(initialState)
    })
  })

  it('shows configure button for each rule', () => {
    render(<AutomationsList strings={en} />)
    // Each rule has a configure button (text includes "Configure" followed by arrow)
    const configButtons = screen.getAllByText(/Configure/)
    expect(configButtons).toHaveLength(8)
  })

  it('opens inline config panel when configure is clicked', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeDefined()
      expect(screen.getByText(en.accounts.config.actionMode)).toBeDefined()
    })
  })

  it('shows action mode buttons in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.modeDraft)).toBeDefined()
      expect(screen.getByText(en.accounts.automations.modeAutoPublish)).toBeDefined()
    })
  })

  it('shows content template textarea in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.templateLabel)).toBeDefined()
      expect(screen.getByRole('textbox')).toBeDefined()
    })
  })

  it('shows platform buttons in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.targetPlatformsLabel)).toBeDefined()
      expect(screen.getByText(en.platforms.youtube)).toBeDefined()
      expect(screen.getByText(en.platforms.facebook)).toBeDefined()
    })
  })

  it('closes config panel after save', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => expect(screen.getByRole('region')).toBeDefined())
    fireEvent.click(screen.getByText(en.accounts.config.save))
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  it('closes config panel on cancel', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => expect(screen.getByRole('region')).toBeDefined())
    fireEvent.click(screen.getByText(en.accounts.config.cancel))
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  it('aria-checked reflects enabled state', () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    // In the new categorized layout:
    // content_trigger: blog(0), video(1), newsletter(2), playlist(3) — all false
    // system_alert: token_expiring(4), post_failed(5) — both true
    // optimization: evergreen(6), ab_test(7) — both false
    expect(switches[4].getAttribute('aria-checked')).toBe('true')
    expect(switches[5].getAttribute('aria-checked')).toBe('true')
    expect(switches[0].getAttribute('aria-checked')).toBe('false')
  })

  it('delete rule removes it from the list', async () => {
    render(<AutomationsList strings={en} />)
    // Open config for first rule
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => expect(screen.getByRole('region')).toBeDefined())
    // Click delete
    fireEvent.click(screen.getByText(en.accounts.automations.deleteRule))
    await waitFor(() => {
      expect(screen.queryByText(en.accounts.automations.blogPublished)).toBeNull()
      // 7 switches remain
      expect(screen.getAllByRole('switch')).toHaveLength(7)
    })
  })

  it('toggles close when clicking configure on already-open rule', async () => {
    render(<AutomationsList strings={en} />)
    const configButtons = screen.getAllByText(/Configure/)
    fireEvent.click(configButtons[0])
    await waitFor(() => expect(screen.getByRole('region')).toBeDefined())
    // Click the same button again (now shows "Close")
    fireEvent.click(screen.getByText(/Close/))
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull()
    })
  })
})
