// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const resposta = vi.hoisted(() => ({ linha: null as unknown, erroSingle: { code: 'PGRST116', message: 'no rows' } as unknown }))
vi.mock('@/lib/supabase/service', () => {
  const cadeia = {
    select: () => cadeia,
    eq: () => cadeia,
    // .single() sem linha = erro PGRST116; .maybeSingle() sem linha = null sem erro (contrato do PostgREST).
    single: async () => (resposta.linha ? { data: resposta.linha, error: null } : { data: null, error: resposta.erroSingle }),
    maybeSingle: async () => ({ data: resposta.linha, error: null }),
  }
  return { getSupabaseServiceClient: () => ({ from: () => cadeia }) }
})

import { getCronHealth } from '@/lib/cron-health'

describe('getCronHealth', () => {
  let spy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { spy.mockRestore() })

  it('sem linha do vigia: devolve null e não registra erro', async () => {
    resposta.linha = null
    expect(await getCronHealth('ab-watchdog')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
  it('com linha: devolve a linha', async () => {
    resposta.linha = { cron_name: 'ab-watchdog' }
    expect(await getCronHealth('ab-watchdog')).toEqual({ cron_name: 'ab-watchdog' })
  })
})
