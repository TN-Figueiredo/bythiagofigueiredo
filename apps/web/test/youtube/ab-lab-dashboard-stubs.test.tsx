import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { render, screen, fireEvent } from '@testing-library/react'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type { AbLabDashboardProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type {
  AbTestCardView,
  AbTestDraft,
  AbTestSiteSettings,
  DashboardStats,
  LearningsData,
  ChannelLearningsData,
  SuggestedVideo,
} from '@/lib/youtube/ab-types'
import type { FatigueAlert } from '@/app/cms/(authed)/youtube/ab-lab/queries'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: vi.fn() }),
  usePathname: () => '/cms/youtube/ab-lab',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Plus: icon('Plus'), Filter: icon('Filter'), Settings: icon('Settings'),
    FlaskConical: icon('FlaskConical'), Crosshair: icon('Crosshair'), Trophy: icon('Trophy'),
    TrendingUp: icon('TrendingUp'), Sparkles: icon('Sparkles'), Pause: icon('Pause'),
    AlertTriangle: icon('AlertTriangle'), ImageIcon: icon('ImageIcon'),
    ChevronDown: icon('ChevronDown'), ChevronRight: icon('ChevronRight'),
    Image: icon('Image'), Lock: icon('Lock'), Trash2: icon('Trash2'),
    Search: icon('Search'), X: icon('X'), ArrowRight: icon('ArrowRight'),
    Check: icon('Check'), Copy: icon('Copy'),
  }
})

vi.mock('@/lib/youtube/format', () => ({
  brDec: (n: number, d: number) => n.toFixed(d),
  fmtC: (n: number) => String(n),
  fmtBR: (n: number) => String(n),
  fmtRelative: () => 'há 1 dia',
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  updateAbSiteSettings: vi.fn().mockResolvedValue({ ok: true }),
  dismissFatigueAlert: vi.fn().mockResolvedValue({ ok: true }),
  batchStartTests: vi.fn().mockResolvedValue({ ok: true }),
}))

// Mock child components that are complex and not under test
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/kpi', () => ({
  KPI: ({ label, value }: { label: string; value: number | string }) => (
    <div data-testid={`kpi-${label}`}>{value}</div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/active-test-card', () => ({
  ActiveTestCard: ({ test, onOpen }: { test: AbTestCardView; onOpen: (id: string) => void }) => (
    <div data-testid={`active-card-${test.id}`} onClick={() => onOpen(test.id)}>
      {test.name}
    </div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/completed-row', () => ({
  CompletedRow: ({ test, onOpen }: { test: AbTestCardView; onOpen: (id: string) => void }) => (
    <div data-testid={`completed-${test.id}`} onClick={() => onOpen(test.id)}>
      {test.name}
    </div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/drafts-block', () => ({
  DraftsBlock: ({ drafts }: { drafts: AbTestDraft[] }) => (
    <div data-testid="drafts-block">{drafts.length} drafts</div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel', () => ({
  LearningsPanel: () => <div data-testid="learnings-panel" />,
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/settings-drawer', () => ({
  SettingsDrawer: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-drawer"><button onClick={onClose}>close</button></div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/fatigue-card', () => ({
  FatigueCard: ({ alert }: { alert: FatigueAlert }) => (
    <div data-testid={`fatigue-${alert.id}`}>{alert.videoTitle}</div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog', () => ({
  VideoPickerDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="video-picker"><button onClick={onClose}>close-picker</button></div>
  ),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ab-wizard"><button onClick={onClose}>close-wizard</button></div>
  ),
}))

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    activeTests: 2,
    avgConfidence: 72,
    winRate: 60,
    avgLift: 1.5,
    completedTests: 5,
    testsWon: 3,
    ...overrides,
  }
}

function makeSettings(overrides: Partial<AbTestSiteSettings> = {}): AbTestSiteSettings {
  return {
    minDays: 7,
    maxDays: 30,
    confidenceThreshold: 95,
    maxConcurrent: 3,
    autoEndEnabled: true,
    driftCheckEnabled: true,
    driftThreshold: 15,
    ...overrides,
  } as AbTestSiteSettings
}

function makeCard(id: string, overrides: Partial<AbTestCardView> = {}): AbTestCardView {
  return {
    id,
    name: `Test ${id}`,
    type: 'thumbnail',
    status: 'active',
    videoId: `vid-${id}`,
    videoTitle: `Video ${id}`,
    confidence: 72,
    dayOf: 5,
    thumbUrl: null,
    statusNote: null,
    variants: [],
    ...overrides,
  } as AbTestCardView
}

function makeCompleted(id: string): AbTestCardView {
  return makeCard(id, { status: 'completed', name: `Completed ${id}` })
}

function defaultProps(overrides: Partial<AbLabDashboardProps> = {}): AbLabDashboardProps {
  return {
    stats: makeStats(),
    cards: [],
    drafts: [],
    completed: [],
    paused: [],
    learnings: null,
    channelLearnings: null,
    suggested: [],
    settings: makeSettings(),
    siteId: 'site-1',
    eligibleVideos: [],
    fatigueAlerts: [],
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Static analysis / honesty tests                                    */
/* ------------------------------------------------------------------ */

describe('ab-lab-dashboard honesty', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx'),
    'utf-8',
  )

  it('does not contain hardcoded quota 1,5%', () => {
    expect(src).not.toContain('quota 1,5%')
    expect(src).not.toContain('quota 1,5% hoje')
  })

  it('filter button has onClick handler', () => {
    expect(src).toContain('typeFilter')
    expect(src).toContain('setTypeFilter')
  })

  it('ver todos button has onClick handler', () => {
    expect(src).toContain('showAllCompleted')
    expect(src).toContain('setShowAllCompleted')
  })

  it('does not contain fabricated statistics', () => {
    expect(src).not.toContain('Math.random')
    expect(src).not.toContain('placeholder')
  })

  it('uses real router.push for navigation', () => {
    expect(src).toContain('router.push')
  })
})

/* ------------------------------------------------------------------ */
/*  step-variantes honesty                                             */
/* ------------------------------------------------------------------ */

describe('step-variantes honesty', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components/step-variantes.tsx'),
    'utf-8',
  )

  it('does not contain PLACEHOLDER_TAKES', () => {
    expect(src).not.toContain('PLACEHOLDER_TAKES')
  })

  it('does not contain regerar no-op link', () => {
    // The file uses e.preventDefault() legitimately for drag-drop, but should
    // NOT contain a fake "regerar" link that just prevents default
    expect(src).not.toContain('>regerar<')
    expect(src).not.toContain('regerar')
  })

  it('does not contain fabricated data', () => {
    expect(src).not.toContain('Math.random')
    expect(src).not.toContain('FAKE_')
    expect(src).not.toContain('TODO_PLACEHOLDER')
  })
})

/* ------------------------------------------------------------------ */
/*  Behavioral tests                                                   */
/* ------------------------------------------------------------------ */

describe('AbLabDashboard behavioral', () => {
  it('renders header with "A/B Lab" title', () => {
    render(<AbLabDashboard {...defaultProps()} />)
    expect(screen.getByText('A/B Lab')).toBeDefined()
  })

  it('shows "Nenhum teste ativo" when no active cards', () => {
    render(<AbLabDashboard {...defaultProps({ cards: [] })} />)
    expect(screen.getByText('Nenhum teste ativo')).toBeDefined()
  })

  it('shows active test count when cards exist', () => {
    const cards = [makeCard('1'), makeCard('2')]
    render(<AbLabDashboard {...defaultProps({ cards })} />)
    expect(screen.getByText('2 testes ativos')).toBeDefined()
  })

  it('filter dropdown toggles on click', () => {
    const cards = [makeCard('1')]
    render(<AbLabDashboard {...defaultProps({ cards })} />)

    // Filter button shows default label
    const filterBtn = screen.getByText('Todos os tipos')
    fireEvent.click(filterBtn)

    // Dropdown options appear
    expect(screen.getByText('Thumbnail')).toBeDefined()
    expect(screen.getByText('Título')).toBeDefined()
  })

  it('filter by type hides non-matching cards', () => {
    const cards = [
      makeCard('1', { type: 'thumbnail', name: 'Thumb Test' }),
      makeCard('2', { type: 'title', name: 'Title Test' }),
    ]
    render(<AbLabDashboard {...defaultProps({ cards })} />)

    // Open filter dropdown
    fireEvent.click(screen.getByText('Todos os tipos'))

    // The dropdown renders buttons inside a menu div — find all "Thumbnail" texts
    // and click the one that is a button (dropdown option)
    const thumbnailOptions = screen.getAllByText('Thumbnail')
    const dropdownOption = thumbnailOptions.find(el => el.tagName === 'BUTTON')
    expect(dropdownOption).toBeDefined()
    fireEvent.click(dropdownOption!)

    expect(screen.getByText('Thumb Test')).toBeDefined()
    expect(screen.queryByText('Title Test')).toBeNull()
  })

  it('ver todos toggles completed list expansion', () => {
    const completed = Array.from({ length: 5 }, (_, i) => makeCompleted(`c${i}`))
    render(<AbLabDashboard {...defaultProps({ completed })} />)

    // Initially shows only 3
    expect(screen.getByText('Completed c0')).toBeDefined()
    expect(screen.getByText('Completed c1')).toBeDefined()
    expect(screen.getByText('Completed c2')).toBeDefined()
    expect(screen.queryByText('Completed c3')).toBeNull()

    // Click "ver todos"
    const verTodos = screen.getByText(/ver todos/)
    fireEvent.click(verTodos)

    // Now all visible
    expect(screen.getByText('Completed c3')).toBeDefined()
    expect(screen.getByText('Completed c4')).toBeDefined()

    // Toggle back
    fireEvent.click(screen.getByText('ver menos'))
    expect(screen.queryByText('Completed c3')).toBeNull()
  })

  it('clicking active card navigates to detail page', () => {
    const cards = [makeCard('abc123')]
    render(<AbLabDashboard {...defaultProps({ cards })} />)

    fireEvent.click(screen.getByTestId('active-card-abc123'))
    expect(pushMock).toHaveBeenCalledWith('/cms/youtube/ab-lab/abc123')
  })

  it('Novo teste button opens video picker', () => {
    render(<AbLabDashboard {...defaultProps()} />)

    fireEvent.click(screen.getByText('Novo teste'))
    expect(screen.getByTestId('video-picker')).toBeDefined()
  })

  it('settings button opens settings drawer', () => {
    render(<AbLabDashboard {...defaultProps()} />)

    const settingsBtn = screen.getByLabelText('Configurações')
    fireEvent.click(settingsBtn)
    expect(screen.getByTestId('settings-drawer')).toBeDefined()
  })

  it('KPI strip renders when there is data', () => {
    const cards = [makeCard('1')]
    render(<AbLabDashboard {...defaultProps({ cards })} />)
    expect(screen.getByTestId('kpi-Testes ativos')).toBeDefined()
    expect(screen.getByTestId('kpi-Win rate')).toBeDefined()
  })
})
