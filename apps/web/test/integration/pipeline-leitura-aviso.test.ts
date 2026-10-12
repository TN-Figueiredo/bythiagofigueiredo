// @vitest-environment node
// E19: a linha entra em audit_log de verdade (cliente de serviço, sem ator, site_id nulo), os filtros por after_data->>
// funcionam no PostgREST, e o feed de atividade do painel não recebe nenhuma delas (F-A).
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { createClient } from '@supabase/supabase-js'
import { seedSite, signUserJwt, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'

const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { registrarLeitura, zerarEstadoDoRegistro, diaSP, rotaNormalizada, ACAO_AVISO, RECURSO_CHAVE } from '@/lib/pipeline/leitura-registro'
import { fetchActivityFeed } from '@/app/cms/(authed)/_components/dashboard-queries'
import type { PipelineAuth } from '@/lib/pipeline/auth'

describe.skipIf(skipIfNoLocalDb())('E19: registro de leitura no banco local', () => {
  // Criado em beforeAll: com o banco ausente o describe é pulado e o ambiente (test/setup.ts) não tem as variáveis.
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const keyId = randomUUID()
  let siteId = ''
  const auth = (permissions: string[]): PipelineAuth => ({ siteId, permissions, source: 'api_key', keyHash: 'h'.repeat(64), keyId, keyName: 'teste-e19' })
  const req = (rota: string) => new NextRequest(`https://x.test/api/pipeline/${rota}`)
  const minhas = async () => (await sb.from('audit_log').select('id, resource_type, site_id, actor_user_id, after_data').eq('action', ACAO_AVISO).eq('after_data->>key_id', keyId)).data ?? []
  const hojeMenos = (dias: number) => diaSP(new Date(Date.now() - dias * 86_400_000))

  beforeAll(async () => { sb = getSupabaseServiceClient(); siteId = (await seedSite(sb)).siteId })
  beforeEach(() => { zerarEstadoDoRegistro(); Object.assign(cfg, { modo: 'aviso', avisoDesde: hojeMenos(1), controleFechadoEm: null, conferenciaAte: null }) })
  afterAll(async () => {
    // Tudo o que o teste semeia sai daqui: as linhas do registro, as do feed e o site (a org mestra é reaproveitada pelo seedSite).
    const apagados = [
      await sb.from('audit_log').delete().eq('after_data->>key_id', keyId),
      await sb.from('audit_log').delete().eq('site_id', siteId),
    ]
    for (const { error } of apagados) expect(error).toBeNull()
    expect((await sb.from('sites').delete().eq('id', siteId)).error).toBeNull()
  })

  it('a linha é aceita sem ator e com site_id nulo; o site fica em after_data', async () => {
    await registrarLeitura(req('stats'), auth(['read']), 'aviso')
    const linhas = await minhas()
    expect(linhas).toHaveLength(1)
    expect(JSON.stringify(linhas[0])).not.toContain('h'.repeat(64)) // o hash da chave não vai para a linha
    expect(linhas[0]).toMatchObject({ resource_type: RECURSO_CHAVE, site_id: null, actor_user_id: null, after_data: { site_id: siteId, key_id: keyId, rota: '/api/pipeline/stats', metodo: 'GET', tem_read: true } })
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
    // O registro grava o PADRÃO da rota (`/api/pipeline/links/[id]`), não o caminho com o identificador.
    const padrao = rotaNormalizada(`/api/pipeline/${rota}`)
    await registrarLeitura(req(rota), auth(['read']), 'aviso')
    zerarEstadoDoRegistro()
    await registrarLeitura(req(rota), auth(['read']), 'aviso')
    expect((await minhas()).filter(l => (l.after_data as { rota: string }).rota === padrao)).toHaveLength(1)
  })

  it('/admin/audit por URL (?action=pipeline_leitura_aviso): quem não é super admin não vê a linha (org_id nulo, RLS audit_log_read)', async () => {
    await registrarLeitura(req('stats'), auth(['read']), 'aviso')
    expect((await minhas()).length).toBeGreaterThanOrEqual(1)
    const { jwt } = signUserJwt(undefined, 'editor')
    const authed = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const { data, error } = await authed.from('audit_log').select('id').eq('action', ACAO_AVISO).eq('after_data->>key_id', keyId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})
