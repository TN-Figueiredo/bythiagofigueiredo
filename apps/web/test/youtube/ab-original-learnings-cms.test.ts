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
const variante = (id: string, tag: string, is_original = false) => ({ id: `v-${id}`, test_id: id, is_original, metadata: { thumbnail_tags: [tag] } })
const mundo = () => ({
  tables: {
    ab_tests: [teste('a', false), teste('b', false), teste('c', false), teste('d', true)],
    ab_test_variants: [variante('a', 'tag-var'), variante('b', 'tag-var'), variante('c', 'tag-var'), variante('d', 'tag-original', true)],
    youtube_channels: [{ id: 'ch1', name: 'Canal' }],
  },
  columns: {
    ab_tests: ['id', 'site_id', 'status', 'winner_variant_id', 'test_type', 'result_metadata', 'youtube_video_id'],
    ab_test_variants: ['id', 'test_id', 'metadata', 'is_original'],
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

describe('M7b T7b: getLearnings conta o vencedor estatístico', () => {
  const t = (id: string, over: Record<string, unknown> = {}) => ({
    id, site_id: SITE, status: 'completed', winner_variant_id: `v-${id}`, test_type: 'thumbnail', result_metadata: null, youtube_video_id: 'yv1', ...over,
  })
  const vs = (id: string, tag: string, original = false) => ({ id: `v-${id}`, test_id: id, is_original: original, metadata: { thumbnail_tags: [tag] } })
  const colunas = {
    ab_tests: ['id', 'site_id', 'status', 'winner_variant_id', 'test_type', 'result_metadata', 'youtube_video_id'],
    ab_test_variants: ['id', 'test_id', 'metadata', 'is_original'],
  }
  const base = () => [t('a'), t('b')]
  const baseV = () => [vs('a', 'x'), vs('b', 'x')]

  it('sugerida B + escolha C: conta B', async () => {
    sb = fakePostgrest({
      tables: {
        ab_tests: [...base(), t('d', { winner_variant_id: 'v-d-c', result_metadata: { v2: { vencedor_sugerido: 'v-d-b' } } })],
        ab_test_variants: [...baseV(), { id: 'v-d-b', test_id: 'd', is_original: false, metadata: { thumbnail_tags: ['tag-b'] } }, { id: 'v-d-c', test_id: 'd', is_original: false, metadata: { thumbnail_tags: ['tag-c'] } }],
      }, columns: colunas,
    })
    const r = await getLearnings(SITE)
    const nomes = r?.tags.map(x => x.tag) ?? []
    expect(r?.totalTests).toBe(3)
    expect(nomes).toContain('tag-b')
    expect(r?.tags.find(x => x.tag === 'tag-c')?.wins ?? 0).toBe(0)
  })
  it('sugerida = original + Manter: não conta e não dobra', async () => {
    sb = fakePostgrest({
      tables: {
        ab_tests: [...base(), t('d', { winner_variant_id: 'v-d-o', result_metadata: { v2: { vencedor_sugerido: 'v-d-o' } } })],
        ab_test_variants: [...baseV(), { id: 'v-d-o', test_id: 'd', is_original: true, metadata: { thumbnail_tags: ['tag-o'] } }],
      }, columns: colunas,
    })
    const r = await getLearnings(SITE)
    expect(r).toBeNull()
  })
  it('inconclusivo sem sugerida e sem vencedor: não conta', async () => {
    sb = fakePostgrest({
      tables: {
        ab_tests: [...base(), t('d', { winner_variant_id: null, result_metadata: { v2: { vencedor_sugerido: null } } })],
        ab_test_variants: [...baseV(), vs('d', 'tag-d')],
      }, columns: colunas,
    })
    expect(await getLearnings(SITE)).toBeNull()
  })
  it('sem escolha do dono mas com sugerida: conta (v2 com winner nulo)', async () => {
    sb = fakePostgrest({
      tables: {
        ab_tests: [...base(), t('d', { winner_variant_id: null, result_metadata: { v2: { vencedor_sugerido: 'v-d' } } })],
        ab_test_variants: [...baseV(), vs('d', 'tag-d')],
      }, columns: colunas,
    })
    const r = await getLearnings(SITE)
    expect(r?.totalTests).toBe(3)
  })
  it('arquivado não conta', async () => {
    sb = fakePostgrest({
      tables: { ab_tests: [...base(), t('d', { status: 'archived' })], ab_test_variants: [...baseV(), vs('d', 'tag-d')] }, columns: colunas,
    })
    expect(await getLearnings(SITE)).toBeNull()
  })
})
