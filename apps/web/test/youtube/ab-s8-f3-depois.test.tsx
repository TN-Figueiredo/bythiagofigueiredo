// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Placar, PlacarVariante } from '@/lib/youtube/ab-gravacao/placar'
import { regraDoTeste } from '@/lib/youtube/ab-gravacao/placar'
import { fraseDoPlacar } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-texto'
import { horaDaFalha } from '@/app/cms/(authed)/youtube/ab-lab/_components/hora-da-falha'
import { fakePostgrest } from '../helpers/fake-postgrest'
import { makeTestRow } from '../helpers/ab-fixtures'

const estado = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('../helpers/fake-postgrest').fakePostgrest> }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => estado.fake!.client }))

import { listAbTests, getAbTest, getAbTestFunnel } from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'

function pv(id: string, o: Partial<PlacarVariante> = {}): PlacarVariante {
  return {
    variant_id: id, dias: 0, dias_validos: 0, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0,
    dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: null, impressoes_com_ctr: null, cliques: null, ctr: null, views: null, ...o,
  }
}
function pl(o: Partial<Placar> = {}): Placar {
  return {
    regra: 'v2', estatistica: 'nao_calculada', variantes: [pv('a'), pv('b')], dias_total: 4, dias_descartados: 0,
    dias_variante_desconhecida: 0, atualizado_em: '2026-10-20T10:00:00Z', desatualizado: false, atrasado: false,
    todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
  }
}

describe('S8-F3 depois: Phil 3, frase de dia perdido', () => {
  it('todos os dias não medidos, nenhum aguardando: sem "ainda"', () => {
    const f = fraseDoPlacar(pl({ variantes: [pv('a', { dias_nao_medidos: 2 }), pv('b', { dias_nao_medidos: 1 })] }), 'active')
    expect(f.principal).toBe('Os dias deste teste não foram medidos pelo YouTube (relatório perdido); não há números.')
    expect(f.principal).not.toContain('ainda')
  })
  it('com dia aguardando mantém "ainda"', () => {
    const f = fraseDoPlacar(pl({ variantes: [pv('a', { dias_nao_medidos: 1, dias_aguardando: 1 }), pv('b')] }), 'active')
    expect(f.principal).toContain('sem impressões medidas ainda')
  })
})

describe('S8-F3 depois: Yannis 5, regraDoTeste única', () => {
  it('ausente vale v1, válido passa, inválido lança', () => {
    expect(regraDoTeste({})).toBe('v1')
    expect(regraDoTeste({ regra_duracao: 'v2' })).toBe('v2')
    expect(() => regraDoTeste({ regra_duracao: 'v9' })).toThrow('ab_lab_leitura')
  })
})

describe('S8-F3 depois: rerevisão Yannis 2, hora no servidor', () => {
  it('formata em horário de Brasília', () => {
    expect(horaDaFalha(new Date('2026-10-24T15:07:00Z'))).toBe('12:07')
  })
})

describe('S8-F3 depois: Phil 5, motivo do erro no Cowork', () => {
  const ctx = (): ServiceContext => ({ siteId: 'site-1', permissions: ['read'], supabase: estado.fake!.client as unknown as ServiceContext['supabase'], source: 'api_key' })
  beforeEach(() => {
    const t = { ...makeTestRow({ id: 't1', site_id: 'site-1', status: 'active', started_at: new Date(Date.now() - 5 * 86400000).toISOString() }), regra_duracao: 'v1', variants: [], cycles: [] }
    estado.fake = fakePostgrest({
      tables: { ab_tests: [t], ab_test_variants: [], ab_test_cycles: [{ id: 'c1', test_id: 't1', variant_id: 'v1', cycle_number: 1, started_at: new Date().toISOString(), ended_at: null }], ab_test_polls: [], ab_test_dias: [] },
      fail: q => (q.table === 'ab_test_dias' ? { message: 'boom' } : null),
    })
  })
  it('as três rotas dizem o motivo', async () => {
    for (const f of [() => listAbTests(ctx(), {}), () => getAbTest(ctx(), 't1'), () => getAbTestFunnel(ctx(), 't1')]) {
      await expect(f()).rejects.toThrow('Failed to load A/B scoreboard: erro_de_banco')
    }
  })
})
