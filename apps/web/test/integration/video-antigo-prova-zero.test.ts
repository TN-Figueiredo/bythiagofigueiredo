// @vitest-environment node
// M10a (Tarefa 12, item 135): sobre a semente do Observatório, com zero vídeo marcado o conjunto de dados é o do ouro de ANTES da etapa.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { seedObservatory, clearObservatory, ORACLE_NOW } from '../../e2e/fixtures/observatorio-seed'
import { apagarSitesDeTeste } from '../helpers/limpa-cena'
import { GOLDEN_SEMENTE, retrato } from '../youtube/video-antigo/dataset-antes-semente-util'
import { M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))

describe.skipIf(pular)('M10a: zero vídeo marcado, sobre a semente (colunas do toco existem e são nulas)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  beforeAll(async () => { sb = getSupabaseServiceClient(); siteId = (await seedSite(sb)).siteId }, 60_000)
  afterAll(async () => {
    if (!siteId) return
    await clearObservatory(siteId, sb)
    await apagarSitesDeTeste('id = $1', [siteId])
  }, 60_000)

  it('loadDataset(semente, ORACLE_NOW) é idêntico ao ouro, com nenhum vídeo marcado', async () => {
    await seedObservatory(siteId, {}, sb)
    const { data: canais } = await sb.from('competitor_channels').select('id').eq('site_id', siteId)
    const { data, error } = await sb.from('competitor_videos').select('archive_frozen_at, archive_dropped_at').in('competitor_channel_id', (canais ?? []).map(c => c.id as string))
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
    expect((data ?? []).filter(v => v.archive_frozen_at !== null || v.archive_dropped_at !== null)).toEqual([])
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    const atual = JSON.stringify(retrato(ds as unknown as Record<string, unknown>), null, 1) + '\n'
    expect(existsSync(GOLDEN_SEMENTE)).toBe(true)
    expect(atual).toBe(readFileSync(GOLDEN_SEMENTE, 'utf8'))
  }, 120_000)
})
