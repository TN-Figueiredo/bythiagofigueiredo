import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../src/app/cms/(authed)/newsletters/_components/type-drawer', () => ({
  TypeDrawer: () => null,
}))

/* ─── Mocks ─── */

const routerPush = vi.fn()
const routerReplace = vi.fn()
const routerRefresh = vi.fn()
let searchParamsMap = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace, refresh: routerRefresh }),
  useSearchParams: () => searchParamsMap,
  usePathname: () => '/cms/newsletters',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

/* ─── Import after mocks ─── */

import { HubClient } from '../../src/app/cms/(authed)/newsletters/_hub/hub-client'

const sharedData = {
  types: [
    { id: 'type-1', name: 'Weekly Digest', color: '#ea580c', sortOrder: 0, cadencePaused: false, badge: 'MAIN', subscriberCount: 120 },
    { id: 'type-2', name: 'Product Updates', color: '#22c55e', sortOrder: 1, cadencePaused: false, badge: null, subscriberCount: 50 },
  ],
  tabBadges: { editorial: 3, automations: 1 },
  siteTimezone: 'America/Sao_Paulo',
  siteName: 'Test Site',
  defaultLocale: 'en',
}

const tabLabels = {
  overview: 'Overview',
  editorial: 'Editorial',
  schedule: 'Schedule',
  automations: 'Automations',
  audience: 'Audience',
} as const

function renderHub(params: URLSearchParams = new URLSearchParams()) {
  searchParamsMap = params
  return render(
    <HubClient
      sharedData={sharedData}
      defaultTab="overview"
      tabLabels={tabLabels}
      allTypesLabel="All"
      editLabel="Edit"
      locale="en"
      drawerStrings={{
        createTitle: 'New Newsletter Type',
        editTitle: 'Edit Newsletter Type',
        sectionEssentials: 'Essentials',
        sectionLanding: 'Landing Page Content',
        sectionAppearance: 'Appearance',
        sectionSchedule: 'Schedule',
        nameLabel: 'Name',
        namePlaceholder: '',
        taglineLabel: 'Tagline',
        taglinePlaceholder: '',
        localeLabel: 'Language',
        slugLabel: 'Slug',
        slugPreview: '',
        slugWarning: '',
        badgeLabel: 'Badge',
        badgePlaceholder: '',
        badgeHint: '',
        descriptionLabel: 'Description',
        descriptionPlaceholder: '',
        promiseLabel: 'What you get',
        promiseAdd: 'Add item',
        promiseMax: 'Maximum 10 items',
        promiseItemPlaceholder: '',
        colorLabel: 'Accent Color',
        colorDarkLabel: 'Accent Color (Dark)',
        colorDarkHint: '',
        ogImageLabel: 'OG Image URL',
        ogImagePlaceholder: '',
        uploadImage: 'Upload image',
        uploadDragDrop: 'or drag & drop',
        uploadFormats: '',
        uploadUploading: 'Uploading…',
        uploadOr: 'or',
        uploadMaxError: '',
        uploadFormatError: '',
        clearColor: 'Clear',
        removeImage: 'Remove image',
        statusActive: 'Active',
        statusPaused: 'Paused',
        moveUp: 'Move up',
        moveDown: 'Move down',
        removeItem: 'Remove item',
        close: 'Close',
        valRequired: 'Required',
        valMinChars: '',
        valMaxChars: '',
        valInvalidFormat: '',
        valReservedSlug: 'Reserved slug',
        valInvalidHex: '',
        valHttpsRequired: 'Must start with https://',
        valSlugInUse: '',
        typeNotFound: '',
        unknownError: '',
        typeNameToConfirm: '',
        scheduleLink: 'Edit in Schedule tab',
        dangerZone: 'Danger Zone',
        deleteButton: 'Delete Newsletter Type',
        deleteConfirmEmpty: '',
        deleteConfirmDeps: '',
        deleteNameMismatch: '',
        createButton: 'Create',
        saveButton: 'Save Changes',
        creating: 'Creating...',
        saving: 'Saving...',
        cancel: 'Cancel',
        toastCreated: '"{name}" created',
        toastSaved: 'Changes saved',
        toastDeleted: '"{name}" deleted',
      }}
    >
      <div data-testid="tab-content">Content</div>
    </HubClient>,
  )
}

/* ─── Tests ─── */

describe('Newsletter Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsMap = new URLSearchParams()
  })

  describe('tab bar', () => {
    it('renders all 5 tabs', () => {
      renderHub()
      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeTruthy()
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(5)
    })

    it('marks overview as active by default', () => {
      renderHub()
      const tabs = screen.getAllByRole('tab')
      const overviewTab = tabs.find((t) => t.textContent?.includes('Overview'))
      expect(overviewTab?.getAttribute('aria-selected')).toBe('true')
    })

    it('marks editorial as active from URL param', () => {
      renderHub(new URLSearchParams('tab=editorial'))
      const tabs = screen.getAllByRole('tab')
      const editorialTab = tabs.find((t) => t.textContent?.includes('Editorial'))
      expect(editorialTab?.getAttribute('aria-selected')).toBe('true')
    })

    it('navigates on tab click via replace (preserves back-button)', () => {
      renderHub()
      const tabs = screen.getAllByRole('tab')
      const scheduleTab = tabs.find((t) => t.textContent?.includes('Schedule'))!
      fireEvent.click(scheduleTab)
      expect(routerReplace).toHaveBeenCalledWith(expect.stringContaining('tab=schedule'), { scroll: false })
    })

    it('omits tab param when switching to default overview tab', () => {
      renderHub(new URLSearchParams('tab=editorial'))
      const tabs = screen.getAllByRole('tab')
      const overviewTab = tabs.find((t) => t.textContent?.includes('Overview'))!
      fireEvent.click(overviewTab)
      expect(routerReplace).toHaveBeenCalledWith('/cms/newsletters', { scroll: false })
    })

    it('shows editorial badge count', () => {
      renderHub()
      const tabs = screen.getAllByRole('tab')
      const editorialTab = tabs.find((t) => t.textContent?.includes('Editorial'))
      expect(editorialTab?.textContent).toContain('3')
    })

    it('shows automations badge count', () => {
      renderHub()
      const tabs = screen.getAllByRole('tab')
      const autoTab = tabs.find((t) => t.textContent?.includes('Automations'))
      expect(autoTab?.textContent).toContain('1')
    })
  })

  describe('header', () => {
    it('renders newsletter title', () => {
      renderHub()
      expect(screen.getByText('Newsletters')).toBeTruthy()
    })

    it('renders New Edition button', () => {
      renderHub()
      const button = screen.getByText('New Edition').closest('button')
      expect(button).toBeTruthy()
      fireEvent.click(button!)
      expect(routerPush).toHaveBeenCalledWith('/cms/newsletters/new')
    })

    it('renders notifications button with aria-label', () => {
      renderHub()
      expect(screen.getByLabelText('Notifications')).toBeTruthy()
    })
  })

  describe('type filter chips', () => {
    it('renders All chip and type chips', () => {
      renderHub()
      expect(screen.getByText('All')).toBeTruthy()
      expect(screen.getByText('Weekly Digest')).toBeTruthy()
      expect(screen.getByText('Product Updates')).toBeTruthy()
    })

    it('has radiogroup role with aria-label', () => {
      renderHub()
      const radiogroup = screen.getByRole('radiogroup')
      expect(radiogroup.getAttribute('aria-label')).toBe('Filter by newsletter type')
    })

    it('marks All as checked by default', () => {
      renderHub()
      const radios = screen.getAllByRole('radio')
      const allChip = radios.find((r) => r.textContent?.includes('All'))
      expect(allChip?.getAttribute('aria-checked')).toBe('true')
    })
  })

  describe('tab panel', () => {
    it('renders tab panel with children', () => {
      renderHub()
      expect(screen.getByTestId('tab-content')).toBeTruthy()
    })

    it('sets correct id on tabpanel', () => {
      renderHub(new URLSearchParams('tab=schedule'))
      const panel = screen.getByRole('tabpanel')
      expect(panel.id).toBe('tabpanel-schedule')
    })
  })
})

/* ─── Server Action Tests ─── */

describe('newsletter server actions', () => {
  it('exports moveEdition', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/actions')
    expect(typeof mod.moveEdition).toBe('function')
  })

  it('exports toggleCadence', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/actions')
    expect(typeof mod.toggleCadence).toBe('function')
  })

  it('exports updateSendTime', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/actions')
    expect(typeof mod.updateSendTime).toBe('function')
  })

  it('exports toggleWorkflow', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/actions')
    expect(typeof mod.toggleWorkflow).toBe('function')
  })

  it('exports retryEdition', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/actions')
    expect(typeof mod.retryEdition).toBe('function')
  })
})
