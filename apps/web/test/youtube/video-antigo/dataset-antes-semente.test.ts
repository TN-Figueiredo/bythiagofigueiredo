// @vitest-environment node
// M10a, Tarefa 0 (Yannis Y3): retrato do conjunto de dados da semente do Observatório, com `now` fixo, ANTES da etapa.
// Gerar de novo só por decisão: GERAR_GOLDEN=1 (com o banco local de integração).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { GOLDEN_SEMENTE, retrato } from './dataset-antes-semente-util'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { seedSite } from '../../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { seedObservatory, clearObservatory, ORACLE_NOW } from '../../../e2e/fixtures/observatorio-seed'
import { apagarSitesDeTeste } from '../../helpers/limpa-cena'

describe.skipIf(skipIfNoLocalDb())('retrato da semente do Observatório antes da M10a', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = ''
  beforeAll(async () => { sb = getSupabaseServiceClient(); siteId = (await seedSite(sb)).siteId }, 60_000)
  afterAll(async () => {
    if (!siteId) return
    await clearObservatory(siteId, sb)
    await apagarSitesDeTeste('id = $1', [siteId])
  }, 60_000)

  it('loadDataset(semente, ORACLE_NOW) é idêntico ao arquivo gravado', async () => {
    await seedObservatory(siteId, {}, sb)
    const ds = await loadDataset({ siteId, now: ORACLE_NOW, supabase: sb })
    const atual = JSON.stringify(retrato(ds as unknown as Record<string, unknown>), null, 1) + '\n'
    if (process.env.GERAR_GOLDEN === '1') writeFileSync(process.env.GOLDEN_SAIDA ?? GOLDEN_SEMENTE, atual)
    expect(existsSync(GOLDEN_SEMENTE)).toBe(true)
    expect(atual).toBe(readFileSync(GOLDEN_SEMENTE, 'utf8'))
  }, 120_000)
})
