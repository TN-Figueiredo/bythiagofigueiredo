// @vitest-environment node
/** S8-F4 B2: a original vencedora ("não mudar nada") não ensina tag nenhuma nos aprendizados do CMS. */
import { describe, it, expect, vi } from 'vitest'
import { fakePostgrest } from '../helpers/fake-postgrest'

let sb = fakePostgrest({ tables: {} })
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => sb.client }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { getLearnings, getChannelLearnings } from '@/app/cms/(authed)/youtube/ab-lab/queries'

const SITE = 'site-1'
const teste = (id: string, original: boolean) => ({
  id, site_id: SITE, status: 'completed', winner_variant_id: `v-${id}`, test_type: 'thumbnail', result_metadata: null, youtube_video_id: 'yv1',
  youtube_videos: { channel_id: 'ch1' }, winner: { is_original: original },
})
const variante = (id: string, tag: string) => ({ id: `v-${id}`, test_id: id, metadata: { thumbnail_tags: [tag] } })
const mundo = () => ({
  tables: {
    ab_tests: [teste('a', false), teste('b', false), teste('c', false), teste('d', true)],
    ab_test_variants: [variante('a', 'tag-var'), variante('b', 'tag-var'), variante('c', 'tag-var'), variante('d', 'tag-original')],
    youtube_channels: [{ id: 'ch1', name: 'Canal' }],
  },
  columns: {
    ab_tests: ['id', 'site_id', 'status', 'winner_variant_id', 'test_type', 'result_metadata', 'youtube_video_id'],
    ab_test_variants: ['id', 'test_id', 'metadata'],
    youtube_channels: ['id', 'name'],
  },
})

describe('aprendizados do CMS ignoram a original vencedora', () => {
  it('getLearnings: tag da original fora; contagem de testes só com variantes vencedoras', async () => {
    sb = fakePostgrest(mundo())
    const r = await getLearnings(SITE)
    expect(r?.totalTests).toBe(3)
    expect(r?.tags.map(t => t.tag)).toEqual(['tag-var'])
  })
  it('getChannelLearnings: idem por canal', async () => {
    sb = fakePostgrest(mundo())
    const r = await getChannelLearnings(SITE)
    expect(JSON.stringify(r)).toContain('tag-var')
    expect(JSON.stringify(r)).not.toContain('tag-original')
  })
})
