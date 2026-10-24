import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, cleanup } from '@testing-library/react'

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u', email: 'a@b.c' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/' }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLearnings, getVideoTestHistory } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { autoImportWinner } from '@/lib/youtube/thumbnail-library'
import { AbStatusBadge } from '@/app/cms/(authed)/youtube/videos/video-row-actions'
import { bancoFalso } from '../helpers/ab-banco-falso'

afterEach(() => cleanup())
beforeEach(() => vi.clearAllMocks())

describe('S8-F2 T5b: derivados das views saem da tela', () => {
  it('getLearnings: avgLift nulo e nenhuma tag negative, mesmo com lift negativo guardado', async () => {
    const tests = [1, 2, 3].map(i => ({ id: `t${i}`, winner_variant_id: `w${i}`, test_type: 'thumbnail', result_metadata: { ctr_lift_percent: -12 }, confidence_at_completion: 0.97 }))
    const winners = [1, 2, 3].map(i => ({ id: `w${i}`, metadata: { thumbnail_tags: ['rosto'] } }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(bancoFalso({ ab_tests: tests, ab_test_variants: winners }) as never)
    const r = await getLearnings('site-1')
    expect(r).not.toBeNull()
    expect(r!.tags.length).toBeGreaterThan(0)
    for (const t of r!.tags) {
      expect(t.avgLift).toBeNull()
      expect(t.negative).toBeUndefined()
    }
  })

  it('getVideoTestHistory: ctr_lift_percent e confidence_at_completion saem nulos', async () => {
    const row = { id: 't', name: 'n', test_type: 'thumbnail', status: 'completed', started_at: null, completed_at: null, completed_reason: 'winner', confidence_at_completion: 0.97, result_metadata: { ctr_lift_percent: 12 }, winner: { label: 'B' } }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(bancoFalso({ ab_tests: [row] }) as never)
    const r = await getVideoTestHistory('v1')
    expect(r).toHaveLength(1)
    expect(r[0]!.ctr_lift_percent).toBeNull()
    expect(r[0]!.confidence_at_completion).toBeNull()
  })

  it('AbStatusBadge de teste concluído mostra "—", sem % nem +', () => {
    const { container } = render(<AbStatusBadge test={{ id: 't', status: 'completed', started_at: null }} videoId="v" isShort={false} />)
    expect(container.textContent).toBe('—')
  })

  it('autoImportWinner grava lift_at_win nulo mesmo com views diferentes entre as variantes', async () => {
    const db = bancoFalso({
      ab_tests: [{ id: 't', winner_variant_id: 'w', youtube_video_id: 'yv', name: 'N' }],
      ab_test_variants: [{ id: 'w', blob_url: 'https://x/y.jpg', label: 'B' }],
      youtube_videos: [{ title: 'T' }],
      ab_test_cycles: [
        { variant_id: 'w', views: 900 }, { variant_id: 'o', views: 300 }, { variant_id: 'o', views: 300 },
      ],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db as never)
    const r = await autoImportWinner('t', 'site-1')
    expect(r.imported).toBe(true)
    const ins = db.chamadas.find(c => c.tabela === 'thumbnail_library' && c.metodo === 'insert')
    expect(ins).toBeDefined()
    expect((ins!.args[0] as { lift_at_win: unknown }).lift_at_win).toBeNull()
  })

  it('videos/page.tsx não monta result_metadata nem ctr_lift_percent na prop', () => {
    const src = readFileSync('src/app/cms/(authed)/youtube/videos/page.tsx', 'utf8')
    expect(src).not.toContain('ctr_lift_percent')
    expect(src).not.toContain('result_metadata')
  })
})
