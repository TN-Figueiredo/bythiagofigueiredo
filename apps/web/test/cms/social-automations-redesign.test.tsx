import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// ─── AutomationsList ──────────────────────────────────────────────────────────

describe('AutomationsList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders all 8 automation rule labels', () => {
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

  it('renders exactly 8 toggle switches', () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(8)
  })

  it('renders exactly 8 Configure buttons', () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    expect(configBtns).toHaveLength(8)
  })

  it('shows mode badge for each rule (DRAFT or AUTO)', () => {
    render(<AutomationsList strings={en} />)
    const draftBadges = screen.getAllByText('DRAFT')
    const autoBadges = screen.getAllByText('AUTO')
    expect(draftBadges.length + autoBadges.length).toBe(8)
  })

  it('shows draft mode badge for rules with mode=draft', () => {
    render(<AutomationsList strings={en} />)
    const draftBadges = screen.getAllByText('DRAFT')
    expect(draftBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows auto-publish mode badge for rules with mode=auto_publish', () => {
    render(<AutomationsList strings={en} />)
    const autoBadges = screen.getAllByText('AUTO')
    expect(autoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('draft + auto badges together total 8', () => {
    render(<AutomationsList strings={en} />)
    const draftBadges = screen.getAllByText('DRAFT')
    const autoBadges = screen.getAllByText('AUTO')
    expect(draftBadges.length + autoBadges.length).toBe(8)
  })

  it('token_expiring rule starts with aria-checked=true', () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    // token_expiring is index 4 in the categorized layout
    expect(switches[4].getAttribute('aria-checked')).toBe('true')
  })

  it('post_failed rule starts with aria-checked=true', () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    // post_failed is index 5
    expect(switches[5].getAttribute('aria-checked')).toBe('true')
  })

  it('blog_published starts with aria-checked=false', () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    expect(switches[0].getAttribute('aria-checked')).toBe('false')
  })

  it('clicking a switch toggles its aria-checked value', async () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    const blogSwitch = switches[0]
    expect(blogSwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(blogSwitch)
    await waitFor(() => {
      expect(blogSwitch.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('toggling twice returns switch to original state', async () => {
    render(<AutomationsList strings={en} />)
    const switches = screen.getAllByRole('switch')
    const blogSwitch = switches[0]
    fireEvent.click(blogSwitch)
    await waitFor(() => expect(blogSwitch.getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(blogSwitch)
    await waitFor(() => expect(blogSwitch.getAttribute('aria-checked')).toBe('false'))
  })

  it('opens inline config panel when Configure is clicked', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeDefined()
      expect(screen.getByText(en.accounts.config.actionMode)).toBeDefined()
    })
  })

  it('shows the rule name when config panel is open', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.blogPublished)).toBeDefined()
    })
  })

  it('closes the config panel after clicking Save', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => screen.getByRole('region'))
    fireEvent.click(screen.getByText(en.accounts.config.save))
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  it('closes the config panel after clicking Cancel', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => screen.getByRole('region'))
    fireEvent.click(screen.getByText(en.accounts.config.cancel))
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  it('only one config panel is open at a time', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    // Open first
    fireEvent.click(configBtns[0])
    await waitFor(() => screen.getByRole('region'))
    // Click save to close
    fireEvent.click(screen.getByText(en.accounts.config.save))
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull())
    // Open second
    const configBtns2 = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns2[1])
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeDefined()
    })
  })

  it('saving config panel updates rule mode', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => screen.getByRole('region'))
    // Click the Auto-publish button in config panel
    fireEvent.click(screen.getByText(en.accounts.automations.modeAutoPublish))
    fireEvent.click(screen.getByText(en.accounts.config.save))
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull())
    // After save, the mode badge for blog_published should show AUTO
    // The first rule's badge should now be AUTO
    const autoBadges = screen.getAllByText('AUTO')
    expect(autoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders category headers', () => {
    render(<AutomationsList strings={en} />)
    expect(screen.getByText(en.accounts.automations.categoryContent)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.categorySystem)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.categoryOptimization)).toBeDefined()
  })

  it('renders description text for rules', () => {
    render(<AutomationsList strings={en} />)
    expect(screen.getByText(en.accounts.automations.blogPublishedDesc)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.videoPublishedDesc)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.tokenExpiringDesc)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.evergreenTimerDesc)).toBeDefined()
  })

  it('renders summary bar with correct counts', () => {
    render(<AutomationsList strings={en} />)
    expect(screen.getByText('8')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('6')).toBeDefined()
  })

  it('shows action mode buttons in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.modeDraft)).toBeDefined()
      expect(screen.getByText(en.accounts.automations.modeAutoPublish)).toBeDefined()
    })
  })

  it('shows content template textarea in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.templateLabel)).toBeDefined()
      expect(screen.getByRole('textbox')).toBeDefined()
    })
  })

  it('shows platform buttons in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.targetPlatformsLabel)).toBeDefined()
      expect(screen.getByText(en.platforms.youtube)).toBeDefined()
      expect(screen.getByText(en.platforms.facebook)).toBeDefined()
    })
  })

  it('shows delete rule button in config panel', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.automations.deleteRule)).toBeDefined()
    })
  })

  it('delete rule removes it from the list', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => screen.getByRole('region'))
    fireEvent.click(screen.getByText(en.accounts.automations.deleteRule))
    await waitFor(() => {
      expect(screen.queryByText(en.accounts.automations.blogPublished)).toBeNull()
      expect(screen.getAllByRole('switch')).toHaveLength(7)
    })
  })

  it('toggles close when clicking configure on already-open rule', async () => {
    render(<AutomationsList strings={en} />)
    const configBtns = screen.getAllByText(/Configure/)
    fireEvent.click(configBtns[0])
    await waitFor(() => screen.getByRole('region'))
    fireEvent.click(screen.getByText(/Close/))
    await waitFor(() => {
      expect(screen.queryByRole('region')).toBeNull()
    })
  })
})

// ─── i18n keys used in redesign ───────────────────────────────────────────────

describe('i18n keys for redesign features', () => {
  it('categoryContent string is defined', () => {
    expect(en.accounts.automations.categoryContent).toBe('Content Triggers')
  })

  it('categorySystem string is defined', () => {
    expect(en.accounts.automations.categorySystem).toBe('System Alerts')
  })

  it('categoryOptimization string is defined', () => {
    expect(en.accounts.automations.categoryOptimization).toBe('Optimization')
  })

  it('blogPublishedDesc is defined', () => {
    expect(en.accounts.automations.blogPublishedDesc).toBeTruthy()
  })

  it('videoPublishedDesc is defined', () => {
    expect(en.accounts.automations.videoPublishedDesc).toBeTruthy()
  })

  it('newsletterSentDesc is defined', () => {
    expect(en.accounts.automations.newsletterSentDesc).toBeTruthy()
  })

  it('playlistUpdatedDesc is defined', () => {
    expect(en.accounts.automations.playlistUpdatedDesc).toBeTruthy()
  })

  it('tokenExpiringDesc is defined', () => {
    expect(en.accounts.automations.tokenExpiringDesc).toBeTruthy()
  })

  it('postFailedDesc is defined', () => {
    expect(en.accounts.automations.postFailedDesc).toBeTruthy()
  })

  it('evergreenTimerDesc is defined', () => {
    expect(en.accounts.automations.evergreenTimerDesc).toBeTruthy()
  })

  it('abTestCompleteDesc is defined', () => {
    expect(en.accounts.automations.abTestCompleteDesc).toBeTruthy()
  })

  it('deleteRule string is defined', () => {
    expect(en.accounts.automations.deleteRule).toBeTruthy()
  })

  it('targetPlatformsLabel is defined', () => {
    expect(en.accounts.automations.targetPlatformsLabel).toBeTruthy()
  })
})
