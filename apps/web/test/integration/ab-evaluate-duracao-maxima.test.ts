import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite, seedYoutubeChannelAndVideo } from '../helpers/db-seed'

// A fase só fala com o YouTube se o original estiver no Blob; aqui ele está fora de propósito.
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { phaseEvaluateActiveTests } from '@/lib/youtube/ab-evaluate-phases'

const DIA = 24 * 3_600_000

describe.skipIf(skipIfNoLocalDb())('ab-evaluate: duração máxima contra o banco', () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  let siteId: string
  let videoId: string
  let channelId: string
  const testesCriados: string[] = []

  beforeAll(async () => {
    siteId = (await seedSite(supabase)).siteId
    const seeded = await seedYoutubeChannelAndVideo(supabase, siteId)
    videoId = seeded.videoId
    channelId = seeded.channelId
  })

  async function apagarTestes() {
    for (const id of testesCriados.splice(0)) {
      await supabase.from('ab_test_cycles').delete().eq('test_id', id)
      await supabase.from('ab_test_variants').delete().eq('test_id', id)
      await supabase.from('ab_tests').delete().eq('id', id)
    }
  }

  afterEach(apagarTestes)

  afterAll(async () => {
    await apagarTestes()
    if (videoId) await supabase.from('youtube_videos').delete().eq('id', videoId)
    if (channelId) await supabase.from('youtube_channels').delete().eq('id', channelId)
    if (siteId) await supabase.from('sites').delete().eq('id', siteId)
  })

  async function semearTeste(o: {
    tipo: 'thumbnail' | 'title'
    diasNoAr: number
    ciclosAbertos: number
    status?: 'active' | 'completed'
    vencedorSugerido?: boolean
  }) {
    const iniciado = new Date(Date.now() - o.diasNoAr * DIA).toISOString()
    const { data: t, error } = await supabase
      .from('ab_tests')
      .insert({
        site_id: siteId,
        youtube_video_id: videoId,
        name: 'Duração máxima',
        test_type: o.tipo,
        status: o.status ?? 'active',
        started_at: iniciado,
        original_title: 'Título original',
        original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
        config: { max_duration_days: 14, confidence_threshold: 0.95, burn_in_days: 0, rotation_pattern: 'abba' },
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const testeId = t!.id as string
    testesCriados.push(testeId)

    const variantes: string[] = []
    for (const [i, label] of ['original', 'variant_b'].entries()) {
      const { data: v, error: ev } = await supabase
        .from('ab_test_variants')
        .insert({ test_id: testeId, label, is_original: i === 0, sort_order: i, title_text: i === 0 ? null : 'Outro título' })
        .select('id')
        .single()
      expect(ev).toBeNull()
      variantes.push(v!.id as string)
    }
    for (let n = 0; n < o.ciclosAbertos; n++) {
      const { error: ec } = await supabase
        .from('ab_test_cycles')
        .insert({ test_id: testeId, variant_id: variantes[n % 2], cycle_number: n, started_at: new Date(Date.now() - (n + 1) * DIA).toISOString() })
      expect(ec).toBeNull()
    }
    if (o.vencedorSugerido) {
      const { error: eu } = await supabase
        .from('ab_tests')
        .update({
          winner_variant_id: variantes[1],
          grace_expires_at: new Date(Date.now() + DIA).toISOString(),
          confidence_at_completion: 0.97,
        })
        .eq('id', testeId)
      expect(eu).toBeNull()
    }
    return { testeId }
  }

  async function lerTeste(id: string) {
    const { data, error } = await supabase.from('ab_tests').select('*').eq('id', id).single()
    expect(error).toBeNull()
    return data as Record<string, unknown>
  }

  async function contarCiclosAbertos(id: string) {
    const { count } = await supabase
      .from('ab_test_cycles')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', id)
      .is('ended_at', null)
    return count ?? 0
  }

  it('thumbnail vencida: encerra só o active, fecha os ciclos, limpa vencedor e carência', async () => {
    const { testeId } = await semearTeste({ tipo: 'thumbnail', diasNoAr: 15, ciclosAbertos: 2, vencedorSugerido: true })
    const r = await phaseEvaluateActiveTests(supabase as never)
    expect(r.resolved).toBeGreaterThanOrEqual(1)
    expect(r.errors).toBeGreaterThanOrEqual(1) // original fora do Blob + variante que foi ao ar
    const t = await lerTeste(testeId)
    expect(t).toMatchObject({
      status: 'completed', completed_reason: 'inconclusive', confidence_at_completion: null,
      winner_variant_id: null, grace_expires_at: null, winner_applied_at: null, applied_by: null,
    })
    expect(t.status_note).toMatch(/original não restaurado/)
    expect(await contarCiclosAbertos(testeId)).toBe(0)
  })

  it('teste de título vencido: encerra sem status_note', async () => {
    const { testeId } = await semearTeste({ tipo: 'title', diasNoAr: 15, ciclosAbertos: 1 })
    expect((await phaseEvaluateActiveTests(supabase as never)).resolved).toBeGreaterThanOrEqual(1)
    const t = await lerTeste(testeId)
    expect(t.status).toBe('completed')
    expect(t.status_note).toBeNull()
  })

  it('teste com 3 dias não muda nenhuma linha', async () => {
    const { testeId } = await semearTeste({ tipo: 'thumbnail', diasNoAr: 3, ciclosAbertos: 1 })
    const antes = await lerTeste(testeId)
    await phaseEvaluateActiveTests(supabase as never)
    expect(await lerTeste(testeId)).toEqual(antes)
    expect(await contarCiclosAbertos(testeId)).toBe(1)
  })

  it('teste encerrado à mão (completed, com vencedor) não é tocado', async () => {
    const { testeId } = await semearTeste({ tipo: 'title', diasNoAr: 15, ciclosAbertos: 0, status: 'completed', vencedorSugerido: true })
    const antes = await lerTeste(testeId)
    await phaseEvaluateActiveTests(supabase as never)
    expect(await lerTeste(testeId)).toEqual(antes)
  })
})
