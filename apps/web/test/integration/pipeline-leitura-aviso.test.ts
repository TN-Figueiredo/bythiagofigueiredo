// @vitest-environment node
// E19: a linha entra em audit_log de verdade (cliente de serviço, sem ator, site_id nulo), os filtros por after_data->>
// funcionam no PostgREST, e o feed de atividade do painel não recebe nenhuma delas (F-A).
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'

const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { registrarLeitura, zerarEstadoDoRegistro, diaSP, ACAO_AVISO } from '@/lib/pipeline/leitura-registro'
import { fetchActivityFeed } from '@/app/cms/(authed)/_components/dashboard-queries'
import type { PipelineAuth } from '@/lib/pipeline/auth'

describe.skipIf(skipIfNoLocalDb())('E19: registro de leitura no banco local', () => {
  // Criado em beforeAll: com o banco ausente o describe é pulado e o ambiente (test/setup.ts) não tem as variáveis.
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const keyId = randomUUID()
  let siteId = ''
  const auth = (permissions: string[]): PipelineAuth => ({ siteId, permissions, source: 'api_key', keyHash: 'h'.repeat(64), keyId, keyName: 'teste-e19' })
  const req = (rota: string) => new NextRequest(`https://x.test/api/pipeline/${rota}`)
  const minhas = async () => (await sb.from('audit_log').select('id, site_id, actor_user_id, after_data').eq('action', ACAO_AVISO).eq('after_data->>key_id', keyId)).data ?? []
  const hojeMenos = (dias: number) => diaSP(new Date(Date.now() - dias * 86_400_000))

  beforeAll(async () => { sb = getSupabaseServiceClient(); siteId = (await seedSite(sb)).siteId })
  beforeEach(() => { zerarEstadoDoRegistro(); Object.assign(cfg, { modo: 'aviso', avisoDesde: hojeMenos(1), controleFechadoEm: null, conferenciaAte: null }) })
  afterAll(async () => {
    await sb.from('audit_log').delete().eq('after_data->>key_id', keyId)
    await sb.from('audit_log').delete().eq('site_id', siteId)
  })

  it('a linha é aceita sem ator e com site_id nulo; o site fica em after_data', async () => {
    await registrarLeitura(req('stats'), auth(['read']), 'aviso')
    const linhas = await minhas()
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ site_id: null, actor_user_id: null, after_data: { site_id: siteId, key_id: keyId, rota: '/api/pipeline/stats', metodo: 'GET', tem_read: true } })
  })

  it('40 linhas de aviso: o feed de atividade do site devolve as mesmas linhas de antes', async () => {
    await sb.from('audit_log').insert({ action: 'update', resource_type: 'blog_posts', site_id: siteId })
    const antes = await fetchActivityFeed(siteId)
    for (let i = 0; i < 40; i++) await registrarLeitura(req(`items/${randomUUID()}`), auth(i % 2 ? ['read'] : ['intelligence']), 'aviso')
    expect((await minhas()).length).toBeGreaterThanOrEqual(40)
    const depois = await fetchActivityFeed(siteId)
    expect(depois).toEqual(antes)
    expect(JSON.stringify(depois)).not.toContain('pipeline_leitura')
  })

  it('15º dia: a conferência de duplicata funciona contra o PostgREST (after_data->>), uma linha só', async () => {
    cfg.avisoDesde = hojeMenos(20)
    const rota = 'links/fixo-e19'
    await registrarLeitura(req(rota), auth(['read']), 'aviso')
    zerarEstadoDoRegistro()
    await registrarLeitura(req(rota), auth(['read']), 'aviso')
    expect((await minhas()).filter(l => (l.after_data as { rota: string }).rota === `/api/pipeline/${rota}`)).toHaveLength(1)
  })
})
