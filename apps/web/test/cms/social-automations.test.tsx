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
import { AutomationConfigModal } from '@/app/cms/(authed)/social/accounts/_components/automation-config-modal'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const RULE_STUB = {
  id: 'blog_published',
  label: 'blogPublished',
  enabled: false,
  mode: 'draft' as const,
}

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

  it('shows mode labels for each rule', () => {
    render(<AutomationsList strings={en} />)
    // Some rules default to 'draft', some to 'auto_publish'
    const draftLabels = screen.getAllByText(
      `${en.accounts.automations.modeLabel}: ${en.accounts.automations.modeDraft}`,
    )
    const autoLabels = screen.getAllByText(
      `${en.accounts.automations.modeLabel}: ${en.accounts.automations.modeAutoPublish}`,
    )
    expect(draftLabels.length + autoLabels.length).toBe(8)
  })

  it('fires onToggle when switch is clicked', async () => {
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
    const configureButtons = screen.getAllByText(en.accounts.automations.configure)
    expect(configureButtons).toHaveLength(8)
  })

  it('opens config modal when configure button is clicked', async () => {
    render(<AutomationsList strings={en} />)
    const configureButtons = screen.getAllByText(en.accounts.automations.configure)
    fireEvent.click(configureButtons[0])
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
      expect(screen.getByText(en.accounts.config.title)).toBeDefined()
    })
  })

  it('closes the config modal after save', async () => {
    render(<AutomationsList strings={en} />)
    const configureButtons = screen.getAllByText(en.accounts.automations.configure)
    fireEvent.click(configureButtons[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
    fireEvent.click(screen.getByText(en.accounts.config.save))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('aria-checked reflects enabled state', () => {
    render(<AutomationsList strings={en} />)
    // token_expiring and post_failed default to enabled=true (indices 4 and 5)
    const switches = screen.getAllByRole('switch')
    expect(switches[4].getAttribute('aria-checked')).toBe('true')
    expect(switches[5].getAttribute('aria-checked')).toBe('true')
    // blog_published defaults to enabled=false (index 0)
    expect(switches[0].getAttribute('aria-checked')).toBe('false')
  })
})

describe('AutomationConfigModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders when open — shows title and trigger label', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={onClose} onSave={onSave} />,
    )
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText(en.accounts.config.title)).toBeDefined()
    expect(screen.getByText(en.accounts.config.triggerLabel)).toBeDefined()
  })

  it('shows action mode radio inputs', () => {
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={vi.fn()} onSave={vi.fn()} />,
    )
    expect(screen.getByText(en.accounts.automations.modeDraft)).toBeDefined()
    expect(screen.getByText(en.accounts.automations.modeAutoPublish)).toBeDefined()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
  })

  it('shows content template textarea', () => {
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={vi.fn()} onSave={vi.fn()} />,
    )
    expect(screen.getByText(en.accounts.config.contentTemplate)).toBeDefined()
    expect(screen.getByRole('textbox')).toBeDefined()
  })

  it('closes on Escape key', async () => {
    const onClose = vi.fn()
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={onClose} onSave={vi.fn()} />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn()
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={onClose} onSave={vi.fn()} />,
    )
    fireEvent.click(screen.getByText(en.accounts.config.cancel))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSave with updated rule when save clicked', () => {
    const onSave = vi.fn()
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={vi.fn()} onSave={onSave} />,
    )
    fireEvent.click(screen.getByText(en.accounts.config.save))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: RULE_STUB.id }))
  })

  it('shows the automation trigger name inside the modal', () => {
    render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={vi.fn()} onSave={vi.fn()} />,
    )
    expect(screen.getByText(en.accounts.automations.blogPublished)).toBeDefined()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <AutomationConfigModal rule={RULE_STUB} strings={en} onClose={onClose} onSave={vi.fn()} />,
    )
    // The backdrop is the outermost div (first child of body)
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
