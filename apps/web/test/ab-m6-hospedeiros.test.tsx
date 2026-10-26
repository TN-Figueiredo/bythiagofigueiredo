// @vitest-environment jsdom
// M6 (pendência do lote 2): `onAbrirExistente` nos hospedeiros do assistente.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('lucide-react', () => new Proxy({} as Record<string, unknown>, {
  get: (_t, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : () => null),
  has: (_t, prop) => typeof prop === 'string' && prop !== 'then',
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ updateAbSiteSettings: vi.fn(), batchStartTests: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: (p: { video: { id: string }; existingDraftId?: string; onAbrirExistente: (id: string, s: string) => void }) => (
    <div data-testid="wizard" data-video={p.video.id} data-draft={p.existingDraftId ?? ''}>
      <button type="button" onClick={() => p.onAbrirExistente('x1', 'draft')}>abrir-draft</button>
      <button type="button" onClick={() => p.onAbrirExistente('x2', 'active')}>abrir-ativo</button>
    </div>
  ),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog', () => ({
  VideoPickerDialog: ({ onSelect }: { onSelect: (v: { id: string; title: string; thumbnailUrl: string | null }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 'uuid-1', title: 'Vídeo 1', thumbnailUrl: null })}>Escolher Vídeo 1</button>
  ),
}))

import { NewTestClient } from '@/app/cms/(authed)/youtube/ab-lab/new/client'
import { AbLabDashboard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import { makeDraft } from './helpers/ab-fixtures'

beforeEach(() => { push.mockClear(); vi.spyOn(console, 'error').mockImplementation(() => undefined) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('M6: onAbrirExistente nos hospedeiros', () => {
  it('new/client: rascunho navega para ?draft=id; outro status para a ficha do teste', () => {
    render(<NewTestClient siteId="s" iniciarTeste={vi.fn()} settings={{} as never} initialVideoId="u1"
      eligibleVideos={[{ id: 'u1', title: 'V', thumbnailUrl: null, durationSeconds: 60, channelHandle: '@x', hasActiveTest: false, statusDoTeste: null, bloqueio: null, publishedAt: null, viewCount: null, previousLift: null, sourcePipelineId: null }]} />)
    fireEvent.click(screen.getByText('abrir-draft'))
    expect(push).toHaveBeenLastCalledWith('/cms/youtube/ab-lab/new?draft=x1')
    fireEvent.click(screen.getByText('abrir-ativo'))
    expect(push).toHaveBeenLastCalledWith('/cms/youtube/ab-lab/x2')
  })
  const base = {
    stats: { activeTests: 0, winRate: null, completedTests: 0, winRateBase: 0, testsWon: 0 },
    cards: [], completed: [], paused: [], learnings: null, channelLearnings: null, suggested: [],
    settings: { ...AB_SITE_SETTINGS_DEFAULTS }, siteId: 's', eligibleVideos: [], iniciarTeste: vi.fn(),
  }
  const abrirAssistente = () => { fireEvent.click(screen.getByRole('button', { name: 'Novo teste' })); fireEvent.click(screen.getByText('Escolher Vídeo 1')) }
  it('painel: rascunho fora da lista local navega; teste em outro status navega para a ficha', () => {
    render(<AbLabDashboard {...base} drafts={[]} />)
    abrirAssistente()
    fireEvent.click(screen.getByText('abrir-draft'))
    expect(push).toHaveBeenLastCalledWith('/cms/youtube/ab-lab/new?draft=x1')
    fireEvent.click(screen.getByText('abrir-ativo'))
    expect(push).toHaveBeenLastCalledWith('/cms/youtube/ab-lab/x2')
  })
  it('painel: rascunho que está na lista local abre no lugar, sem navegar', () => {
    render(<AbLabDashboard {...base} drafts={[makeDraft({ id: 'x1', videoId: 'v-x1' })]} />)
    abrirAssistente()
    fireEvent.click(screen.getByText('abrir-draft'))
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByTestId('wizard').getAttribute('data-draft')).toBe('x1')
    expect(screen.getByTestId('wizard').getAttribute('data-video')).toBe('v-x1')
  })
})
