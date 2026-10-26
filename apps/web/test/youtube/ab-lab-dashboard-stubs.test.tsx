// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import { propsDoLab } from '../helpers/ab-lab-pagina-props'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/ab-lab',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => <a href={href} className={className}>{children}</a>,
}))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  updateAbSiteSettings: vi.fn().mockResolvedValue({ ok: true }),
  batchStartTests: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/settings-drawer', () => ({
  SettingsDrawer: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-drawer"><button onClick={onClose}>close</button></div>
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

afterEach(() => cleanup())

describe('ab-lab-dashboard sem fadiga', () => {
  it('o painel não mostra cartão nem texto de fadiga', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    expect(screen.queryAllByText(/fadiga/i)).toHaveLength(0)
    expect(screen.queryAllByText(/CTR em declínio/i)).toHaveLength(0)
  })
})

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

describe('AbLabDashboard behavioral', () => {
  it('renders header with "A/B Lab" title', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'A/B Lab' })).toBeDefined()
  })

  it('filter dropdown toggles on click', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    fireEvent.click(screen.getByText('Todos os tipos'))
    expect(screen.getAllByText('Miniatura').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Título').length).toBeGreaterThan(0)
  })

  it('Novo teste button opens video picker', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    fireEvent.click(screen.getByText('Novo teste'))
    expect(screen.getByTestId('video-picker')).toBeDefined()
  })

  it('settings button opens settings drawer', () => {
    render(<AbLabDashboard {...propsDoLab()} />)
    fireEvent.click(screen.getByLabelText('Configurações'))
    expect(screen.getByTestId('settings-drawer')).toBeDefined()
  })
})
