// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import { makeDraft } from './helpers/ab-fixtures'

const push = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ updateAbSiteSettings: vi.fn(), batchStartTests: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: ({ video }: { video: { id: string } }) => <div data-testid="wizard">{video.id}</div>,
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog', () => ({
  VideoPickerDialog: ({ onContinuarRascunho }: { onContinuarRascunho?: (id: string) => void }) => (
    <button type="button" onClick={() => onContinuarRascunho?.('draft-fora')}>Continuar rascunho fantasma</button>
  ),
}))

const base = {
  stats: { activeTests: 0, winRate: null, completedTests: 0, winRateBase: 0, testsWon: 0 },
  cards: [], drafts: [makeDraft({ videoId: 'uuid-1' })], completed: [], paused: [], learnings: null, channelLearnings: null,
  suggested: [], settings: { ...AB_SITE_SETTINGS_DEFAULTS }, siteId: 's', eligibleVideos: [],
}
afterEach(() => { cleanup(); push.mockClear() })

describe('seletor: continuar rascunho fora da lista local (M7 M1)', () => {
  it('id ausente de drafts abre pela rota com ?draft=, nunca fecha sem nada', () => {
    render(<AbLabDashboard {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Novo teste' }))
    fireEvent.click(screen.getByText('Continuar rascunho fantasma'))
    expect(push).toHaveBeenCalledWith('/cms/youtube/ab-lab/new?draft=draft-fora')
  })
})
