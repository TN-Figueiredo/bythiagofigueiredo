// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

type Perm = string
const chave = vi.hoisted(() => ({ atual: { id: 'k', site_id: 'site-1', name: 'forja', permissions: ['archive_copy'] as string[] } }))
type Resp = { data: unknown; error: { code?: string; message: string; details?: string } | null }
const rpcs = vi.hoisted(() => ({ tabela: {} as Record<string, (args: Record<string, unknown>) => Promise<unknown>>, chamadas: [] as Array<{ fn: string; args: Record<string, unknown> }> }))
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
const sessao = vi.hoisted(() => ({ ok: false }))

vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: chave.atual }) }) }) }),
      update: () => ({ eq: async () => ({}) }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.chamadas.push({ fn, args })
      const f = rpcs.tabela[fn]
      if (!f) throw new Error(`rpc sem programação: ${fn}`)
      return f(args)
    },
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => { if (!sessao.ok) throw new Error('sem sessão'); return { siteId: 'site-1' } } }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))

import { GET as getPlan } from '@/app/api/pipeline/archive/plan/route'
import { POST as postExport } from '@/app/api/pipeline/archive/unit/export/route'
import { POST as postSummary } from '@/app/api/pipeline/archive/month/summary/route'
import { POST as postManifest } from '@/app/api/pipeline/archive/month/manifest/route'
import { POST as postReceived } from '@/app/api/pipeline/archive/unit/received/route'
import { POST as postAttest } from '@/app/api/pipeline/archive/attest/route'
import { POST as postHeartbeat } from '@/app/api/pipeline/archive/heartbeat/route'
import { GET as getPending } from '@/app/api/pipeline/archive/pending/route'
import { GET as getPodeDesligar } from '@/app/api/pipeline/archive/pode-desligar/route'
import { randomBytes } from 'node:crypto'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'

const CANAL = '11111111-1111-4111-8111-111111111111'
const UUID = '22222222-2222-4222-8222-222222222222'
const SHA = 'a'.repeat(64)
const ok = (data: unknown): Resp => ({ data, error: null })
const erro = (message: string, code = 'P0001', details?: string): Resp => ({ data: null, error: { code, message, details } })

let n = 0
type Rota = (req: NextRequest) => Promise<Response>
async function chamar(rota: Rota, o: { perms?: Perm[]; corpo?: unknown; query?: string; metodo?: 'GET' | 'POST'; semChave?: boolean } = {}): Promise<Response> {
  chave.atual = { id: 'k', site_id: 'site-1', name: 'forja', permissions: o.perms ?? ['archive_copy'] }
  const metodo = o.metodo ?? (rota === getPlan || rota === getPending || rota === getPodeDesligar ? 'GET' : 'POST')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!o.semChave) headers['X-Pipeline-Key'] = `k-arq-t11-${++n}`
  const init: RequestInit = { method: metodo, headers }
  if (metodo === 'POST') init.body = JSON.stringify(o.corpo ?? {})
  return rota(new NextRequest(`http://localhost/api/pipeline/archive/x${o.query ?? ''}`, init as never))
}
const json = async (r: Response) => (await r.json()) as { data?: unknown; error?: { code: string; message: string; details?: unknown } }

const plano = {
  plano_id: UUID, gerado_em: '2026-11-28T10:00:00+00:00', modo: 'normal', cursor_seguinte: null, primeira_selagem: null, vermelhos: [],
  canario: { dia: '2026-11-28' }, exportar: [], resumos: [], manifestos: [], aguardando_dono: [], a_apagar: [], reconferir: [], prefixos_ausentes: [],
}
const pendente = { versao: 2, lido_em: '2026-11-28T10:00:00+00:00', total: 0, itens: [] }
const exportCorpo = { classe: 'serie', tabela: 'competitor_video_daily', canal: CANAL, mes: '2026-10' }
const atestarNas = { fonte: 'nas', plano_id: UUID, filhos: { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }, canarios: [], itens: [] }
const atestarB2 = { fonte: 'b2', execucao_id: UUID, itens: [{ arquivo_id: 'canario:numerico', resultado: 'ausente', tentativa: 1 }] }
const batimento = {
  versao: 'abc1234', hora_maquina: '2026-11-28T10:00:00-03:00', nas_ok: true, montagens_ok: { numerico: true, texto: true }, sentinela_ok: { numerico: true, texto: true },
  livre_bytes: { numerico: 10, texto: 10 }, total_bytes: { numerico: 100, texto: 100 }, parado_no_teto: null, ultimo_erro: null,
}
const recebido = { itens: [{ arquivo_id: `u:${UUID}`, sha256: SHA, bytes: 1, linhas: 1, soma: null }] }
const lidaDe = (rows: string[][], extra: Record<string, unknown> = {}) => [{
  rows, row_count: rows.length, control_sum: '3', hash_conteudo: 'h1', columns: [{ nome: 'k' }, { nome: 'views' }], schema_fp: 'fp', ...extra,
}]

beforeEach(() => {
  rpcs.tabela = {}; rpcs.chamadas = []; sessao.ok = false
  sentry.captureMessage.mockClear(); sentry.captureException.mockClear()
  process.env.OBS_ARQUIVO = 'on'
})
afterEach(() => { delete process.env.OBS_ARQUIVO })

const TODAS: Array<[string, Rota, Perm]> = [
  ['plan', getPlan, 'archive_copy'], ['unit/export', postExport, 'archive_copy'], ['month/summary', postSummary, 'archive_copy'], ['month/manifest', postManifest, 'archive_copy'],
  ['unit/received', postReceived, 'archive_copy'], ['attest', postAttest, 'archive_copy'], ['heartbeat', postHeartbeat, 'archive_copy'],
  ['pending', getPending, 'archive_owner'], ['pode-desligar', getPodeDesligar, 'archive_owner'],
]

describe('autenticação e permissão', () => {
  it('sessão do CMS é recusada: 403 API key required', async () => {
    sessao.ok = true
    for (const [, rota] of TODAS) {
      const r = await chamar(rota, { semChave: true })
      expect(r.status).toBe(403)
      expect((await json(r)).error?.message).toBe('API key required')
    }
  })
  it('chave admin ou write não abre nenhuma das nove (D10)', async () => {
    for (const perms of [['admin'], ['write'], ['read', 'write', 'admin']]) {
      for (const [, rota] of TODAS) expect((await chamar(rota, { perms })).status).toBe(403)
    }
  })
  it('cada rota aceita só a sua permissão (133)', async () => {
    rpcs.tabela.obs_archive_plan = async () => ok(plano)
    expect((await chamar(getPlan, { perms: ['archive_b2'] })).status).toBe(403)
    expect((await chamar(getPlan, { perms: ['archive_b2'], query: '?fonte=b2' })).status).not.toBe(403)
    expect((await chamar(getPlan, { perms: ['archive_copy'], query: '?fonte=b2' })).status).toBe(403)
    for (const rota of [postExport, postReceived, postSummary, postManifest]) expect((await chamar(rota, { perms: ['archive_b2'] })).status).toBe(403)
    expect((await chamar(postAttest, { perms: ['archive_b2'], corpo: atestarNas })).status).toBe(403)
    expect((await chamar(postAttest, { perms: ['archive_copy'], corpo: atestarB2 })).status).toBe(403)
  })
  it('pending e pode-desligar: só archive_owner; archive_owner nas outras: 403 Insufficient permissions', async () => {
    for (const rota of [getPending, getPodeDesligar]) {
      for (const p of ['archive_copy', 'archive_b2', 'archive_read']) expect((await chamar(rota, { perms: [p] })).status).toBe(403)
    }
    for (const [, rota] of TODAS.filter(t => t[2] === 'archive_copy')) {
      const r = await chamar(rota, { perms: ['archive_owner'], corpo: {} })
      expect(r.status).toBe(403)
      expect((await json(r)).error?.message).toBe('Insufficient permissions')
    }
  })
  it('permissão errada com OBS_ARQUIVO apagada: 403, nunca 503 (ordem do C0)', async () => {
    delete process.env.OBS_ARQUIVO
    const r = await chamar(postExport, { perms: ['archive_b2'], corpo: exportCorpo })
    expect(r.status).toBe(403)
  })
  it('OBS_ARQUIVO apagada: arquivo_desligado em toda rota; ON, 1, true também', async () => {
    for (const valor of [undefined, 'ON', '1', 'true', '']) {
      if (valor === undefined) delete process.env.OBS_ARQUIVO; else process.env.OBS_ARQUIVO = valor
      for (const [, rota, perm] of TODAS) {
        const r = await chamar(rota, { perms: [perm] })
        expect(r.status).toBe(503)
        expect((await json(r)).error?.code).toBe('arquivo_desligado')
      }
    }
    expect(rpcs.chamadas).toHaveLength(0)
  })
})

describe('pending e pode-desligar', () => {
  it('pending: zero medido é 200 com total 0, no-store e limite', async () => {
    rpcs.tabela.obs_archive_owner_pending = async () => ok(pendente)
    const r = await chamar(getPending, { perms: ['archive_owner'] })
    expect(r.status).toBe(200)
    expect((await json(r)).data).toEqual(pendente)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('x-ratelimit-remaining')).not.toBeNull()
    expect(rpcs.chamadas).toEqual([{ fn: 'obs_archive_owner_pending', args: { p_site: 'site-1' } }])
  })
  it('pending: fora da forma nunca vira vazio', async () => {
    for (const ruim of [null, {}, [], { ...pendente, total: 3 }, { ...pendente, versao: 1 }]) {
      sentry.captureMessage.mockClear()
      rpcs.tabela.obs_archive_owner_pending = async () => ok(ruim)
      const r = await chamar(getPending, { perms: ['archive_owner'] })
      expect(r.status).toBe(500)
      expect((await json(r)).error?.code).toBe('erro_do_banco')
      expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    }
  })
  for (const [nome, rota, fn] of [['pending', getPending, 'obs_archive_owner_pending'], ['pode-desligar', getPodeDesligar, 'obs_archive_pode_desligar']] as const) {
    it(`${nome}: erro do banco`, async () => {
      rpcs.tabela[fn] = async () => erro('function does not exist', '42883')
      let r = await chamar(rota, { perms: ['archive_owner'] })
      expect(r.status).toBe(500); expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
      rpcs.tabela[fn] = async () => erro('canceling statement', '57014')
      r = await chamar(rota, { perms: ['archive_owner'] })
      expect(r.status).toBe(504)
      rpcs.tabela[fn] = async () => { throw new Error('rede') }
      r = await chamar(rota, { perms: ['archive_owner'] })
      expect(r.status).toBe(500); expect(sentry.captureException).toHaveBeenCalledTimes(1)
    })
    it(`${nome}: parâmetro de busca é 400`, async () => {
      const r = await chamar(rota, { perms: ['archive_owner'], query: '?x=1' })
      expect(r.status).toBe(400)
      expect((await json(r)).error?.code).toBe('VALIDATION_ERROR')
    })
  }
  it('pode-desligar: pode true com faltam vazio e pode false com a lista', async () => {
    rpcs.tabela.obs_archive_pode_desligar = async () => ok({ pode: true, faltam: [] })
    let r = await chamar(getPodeDesligar, { perms: ['archive_owner'] })
    expect(r.status).toBe(200)
    expect((await json(r)).data).toEqual({ pode: true, faltam: [] })
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('x-ratelimit-remaining')).not.toBeNull()
    expect(rpcs.chamadas).toEqual([{ fn: 'obs_archive_pode_desligar', args: { p_site: 'site-1' } }])
    const faltam = [{ motivo: 'mes_nao_recebido', classe: 'serie', tabela: null, mes: '2026-10', detalhe: null }]
    rpcs.tabela.obs_archive_pode_desligar = async () => ok({ pode: false, faltam })
    r = await chamar(getPodeDesligar, { perms: ['archive_owner'] })
    expect(r.status).toBe(200)
    expect((await json(r)).data).toEqual({ pode: false, faltam })
  })
  it('pode-desligar: fora da forma ou incoerente é 500, nunca 200', async () => {
    const f = [{ motivo: 'mes_nao_recebido', classe: null, tabela: null, mes: null, detalhe: null }]
    const ruins = [null, {}, [], { pode: 'true', faltam: [] }, { pode: true, faltam: f }, { pode: false, faltam: [] }, { pode: false, faltam: [{ motivo: 'inventado' }] }]
    for (const ruim of ruins) {
      sentry.captureMessage.mockClear()
      rpcs.tabela.obs_archive_pode_desligar = async () => ok(ruim)
      const r = await chamar(getPodeDesligar, { perms: ['archive_owner'] })
      expect(r.status).toBe(500)
      expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    }
  })
})

describe('plan, attest, received, heartbeat', () => {
  it('plan: a resposta passa pelo esquema estrito; sha256 a mais em um item é 500 erro_do_banco (132)', async () => {
    rpcs.tabela.obs_archive_plan = async () => ok(plano)
    const bom = await chamar(getPlan)
    expect(bom.status).toBe(200)
    const txt = JSON.stringify(await json(bom))
    for (const k of ['hash_conteudo', 'row_count', 'control_sum', 'sha256_esperado']) expect(txt).not.toContain(k)
    expect(rpcs.chamadas[0]).toEqual({ fn: 'obs_archive_plan', args: { p_site: 'site-1', p_completo: false, p_cursor: null } })
    const item = { arquivo_id: `u:${UUID}`, tipo: 'unidade', filho: 'numerico', caminho: 'serie/x', classe: 'serie', tabela: 'competitor_video_daily', canal: CANAL, mes: '2026-10', versao: 1, coluna_controle: 'views', sha256: SHA }
    rpcs.tabela.obs_archive_plan = async () => ok({ ...plano, reconferir: [item] })
    const ruim = await chamar(getPlan)
    expect(ruim.status).toBe(500)
    expect((await json(ruim)).error?.code).toBe('erro_do_banco')
    expect(sentry.captureMessage).toHaveBeenCalled()
  })
  it('plan: completo e cursor viram argumentos; cursor acima de 200 caracteres é 400', async () => {
    rpcs.tabela.obs_archive_plan = async () => ok(plano)
    await chamar(getPlan, { query: '?completo=1&cursor=abc' })
    expect(rpcs.chamadas[0]!.args).toEqual({ p_site: 'site-1', p_completo: true, p_cursor: 'abc' })
    expect((await chamar(getPlan, { query: `?cursor=${'x'.repeat(201)}` })).status).toBe(400)
  })
  it('plan com 1.000 itens em reconferir cabe na resposta (Yannis I5)', async () => {
    const item = { arquivo_id: `p:${UUID}:01`, tipo: 'parte', filho: 'numerico', caminho: `serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.p01.csv.gz`, classe: 'serie',
      tabela: 'competitor_video_daily', canal: CANAL, mes: '2026-10', versao: 1, coluna_controle: 'views' }
    rpcs.tabela.obs_archive_plan = async () => ok({ ...plano, reconferir: Array.from({ length: 1000 }, () => item) })
    const r = await chamar(getPlan)
    expect(r.status).toBe(200)
    expect(JSON.stringify(await json(r)).length).toBeLessThan(4_000_000)
  })
  it('plan?fonte=b2 usa obs_archive_b2_plan', async () => {
    rpcs.tabela.obs_archive_b2_plan = async () => ok({ nao: 'e um plano' })
    const r = await chamar(getPlan, { perms: ['archive_b2'], query: '?fonte=b2' })
    expect(rpcs.chamadas[0]!.fn).toBe('obs_archive_b2_plan')
    expect(r.status).toBe(500)
  })
  it('attest nas devolve canarios (Phil I4)', async () => {
    rpcs.tabela.obs_archive_attest_nas = async () => ok({ itens: [], canarios: [{ filho: 'numerico', dia: '2026-11-28', resposta: 'aceito' }] })
    const r = await chamar(postAttest, { corpo: { ...atestarNas, canarios: [{ filho: 'numerico', dia: '2026-11-28', sha256: SHA }] } })
    expect(r.status).toBe(200)
    expect((await json(r)).data).toEqual({ itens: [], canarios: [{ filho: 'numerico', dia: '2026-11-28', resposta: 'aceito' }] })
    expect(rpcs.chamadas[0]!.fn).toBe('obs_archive_attest_nas')
  })
  it('attest b2 vai para obs_archive_attest_b2', async () => {
    rpcs.tabela.obs_archive_attest_b2 = async () => ok({ execucao: { estado: 'aguardando_controle', negativo_ok: false, canario_ok: { numerico: false, texto: false } }, itens: [{ arquivo_id: 'canario:numerico', resposta: 'aceito' }] })
    const r = await chamar(postAttest, { perms: ['archive_b2'], corpo: atestarB2 })
    expect(r.status).toBe(200)
    expect(rpcs.chamadas[0]!.fn).toBe('obs_archive_attest_b2')
  })
  it('attest prefixo_ausente na M3b: 400 VALIDATION_ERROR', async () => {
    const corpo = { ...atestarNas, itens: [{ arquivo_id: 'x:y', resultado: 'prefixo_ausente' }] }
    const r = await chamar(postAttest, { corpo })
    expect(r.status).toBe(400)
    expect((await json(r)).error?.code).toBe('VALIDATION_ERROR')
  })
  it('received: nunca traz o valor esperado', async () => {
    rpcs.tabela.obs_archive_receive = async () => ok({ itens: [{ arquivo_id: `u:${UUID}`, resultado: 'recebida' }], selados: [{ classe: 'serie', mes: '2026-10', versao: 1 }] })
    const r = await chamar(postReceived, { corpo: recebido })
    expect(r.status).toBe(200)
    const txt = JSON.stringify(await json(r))
    for (const k of ['hash_conteudo', 'row_count', 'control_sum', 'sha256_esperado', 'sha256']) expect(txt).not.toContain(k)
    expect(rpcs.chamadas[0]!.args).toEqual({ p_site: 'site-1', p_items: recebido.itens })
  })
  it('heartbeat: o trabalhador vem da permissão; worker no corpo é 400', async () => {
    rpcs.tabela.obs_archive_heartbeat_write = async () => ok({ gravado: true, teto: null })
    expect((await chamar(postHeartbeat, { corpo: { ...batimento, worker: 'respondedor' } })).status).toBe(400)
    expect(rpcs.chamadas).toHaveLength(0)
    expect((await chamar(postHeartbeat, { corpo: batimento })).status).toBe(200)
    expect(rpcs.chamadas[0]!.args.p_worker).toBe('copiador')
    await chamar(postHeartbeat, { perms: ['archive_b2'], corpo: batimento })
    await chamar(postHeartbeat, { perms: ['archive_read'], corpo: batimento })
    expect(rpcs.chamadas.map(c => c.args.p_worker)).toEqual(['copiador', 'conferir_b2', 'respondedor'])
  })
  it('heartbeat sem total_bytes: 400 (Pedido 5)', async () => {
    const { total_bytes: _t, ...sem } = batimento
    void _t
    expect((await chamar(postHeartbeat, { corpo: sem })).status).toBe(400)
  })
})

describe('erros do banco', () => {
  it('57014 vira tempo_esgotado 504', async () => {
    rpcs.tabela.obs_archive_plan = async () => erro('canceling', '57014')
    const r = await chamar(getPlan)
    expect(r.status).toBe(504)
    expect((await json(r)).error?.code).toBe('tempo_esgotado')
  })
  it('códigos novos do contrato saem com o status do contrato', async () => {
    const casos: Array<[string, number]> = [['mes_fora_do_banco', 409], ['ja_no_arquivo', 409], ['resumo_da_m10b', 409], ['faixa_invalida', 422], ['tabela_ausente', 409]]
    for (const [codigo, status] of casos) {
      rpcs.tabela.obs_archive_channel_units = async () => erro(codigo)
      const r = await chamar(postSummary, { corpo: { classe: 'serie', canal: CANAL, mes: '2026-10' } })
      expect(r.status).toBe(status)
      expect((await json(r)).error?.code).toBe(codigo)
    }
  })
  it('erro escondido vai ao Sentry (Yannis I12)', async () => {
    rpcs.tabela.obs_archive_plan = async () => { throw new Error('x') }
    let r = await chamar(getPlan)
    expect(r.status).toBe(500)
    expect((await json(r)).error?.code).toBe('erro_do_banco')
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    rpcs.tabela.obs_archive_plan = async () => erro('mensagem_que_ninguem_conhece', 'P0001')
    r = await chamar(getPlan)
    expect(r.status).toBe(500)
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})

describe('unit/export', () => {
  const programar = (rows: string[][], record: Resp = ok({ status: 'nova', arquivo_id: `u:${UUID}`, versao: 1 })) => {
    rpcs.tabela.obs_archive_content_hash = async () => ok([{ row_count: rows.length, control_sum: '3', hash_conteudo: 'h1' }])
    rpcs.tabela.obs_archive_read_unit = async () => ok(lidaDe(rows))
    rpcs.tabela.obs_archive_record = async () => record
  }
  it('unidade inteira: bytes gzip, cabeçalhos e soma da fonte', async () => {
    programar([['a', '1'], ['b', '2']])
    const r = await chamar(postExport, { corpo: exportCorpo })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/gzip')
    expect(r.headers.get('x-arquivo-id')).toBe(`u:${UUID}`)
    expect(r.headers.get('x-arquivo-caminho')).toBe(`serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.csv.gz`)
    expect(r.headers.get('x-arquivo-linhas')).toBe('2')
    expect(r.headers.get('x-arquivo-soma')).toBe('3')
    expect(r.headers.get('x-arquivo-partes')).toBe('1')
    expect(r.headers.get('x-arquivo-coluna-controle')).toBe('views')
    const rec = rpcs.chamadas.find(c => c.fn === 'obs_archive_record')!.args.p_payload as Record<string, unknown>
    expect(rec).toMatchObject({ row_count: 2, control_sum: '3', hash_conteudo: 'h1', mes: '2026-10-01', partes: 1, parts: [] })
  })
  it('unidade com zero linha: JSON vazia true, nunca arquivo só com cabeçalho', async () => {
    programar([])
    const r = await chamar(postExport, { corpo: exportCorpo })
    expect(r.status).toBe(200)
    expect((await json(r)).data).toEqual({ arquivo_id: `u:${UUID}`, versao: 1, vazia: true, linhas: 0 })
  })
  it('par fora da política: 422 classe_tabela_invalida, nunca 400', async () => {
    const r = await chamar(postExport, { corpo: { ...exportCorpo, tabela: 'competitor_raw' } })
    expect(r.status).toBe(422)
    expect((await json(r)).error?.code).toBe('classe_tabela_invalida')
  })
  it('unidade acima do teto: 413 sem chamar read_unit', async () => {
    rpcs.tabela.obs_archive_content_hash = async () => ok([{ row_count: 60_001, control_sum: '0', hash_conteudo: 'h' }])
    const r = await chamar(postExport, { corpo: exportCorpo })
    expect(r.status).toBe(413)
    expect(rpcs.chamadas.map(c => c.fn)).toEqual(['obs_archive_content_hash'])
  })
  it('content_hash fora do esquema: 500 e Sentry', async () => {
    rpcs.tabela.obs_archive_content_hash = async () => ok(null)
    expect((await chamar(postExport, { corpo: exportCorpo })).status).toBe(500)
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('record recusa (canal_removido): 409 com o código', async () => {
    programar([['a', '1']], ok({ status: 'canal_removido' }))
    const r = await chamar(postExport, { corpo: exportCorpo })
    expect(r.status).toBe(409)
    expect((await json(r)).error?.code).toBe('canal_removido')
  })
  it('read_unit que muda a cada chamada: 409 mudou_durante_a_leitura', async () => {
    let i = 0
    rpcs.tabela.obs_archive_content_hash = async () => ok([{ row_count: 6000, control_sum: '0', hash_conteudo: 'h' }])
    rpcs.tabela.obs_archive_read_unit = async () => ok(lidaDe(Array.from({ length: 5000 }, () => ['a', '1']), { row_count: 6000, hash_conteudo: `h${i++}` }))
    const r = await chamar(postExport, { corpo: exportCorpo })
    expect(r.status).toBe(409)
    expect((await json(r)).error?.code).toBe('mudou_durante_a_leitura')
  })
  it('unidade inteira em várias partes: soma vazia, parts contíguas, e cada parte k confere com o registrado (Yannis I2)', async () => {
    const todas = Array.from({ length: 20_000 }, (_, i) => [`k${i}`, randomBytes(150).toString('hex')])
    rpcs.tabela.obs_archive_content_hash = async () => ok([{ row_count: todas.length, control_sum: '3', hash_conteudo: 'h1' }])
    rpcs.tabela.obs_archive_read_unit = async (a) => {
      const o = Number(a.p_offset)
      return ok(lidaDe(todas.slice(o, o + Number(a.p_limit)), { row_count: todas.length }))
    }
    rpcs.tabela.obs_archive_record = async () => ok({ status: 'nova', arquivo_id: `u:${UUID}`, versao: 1 })
    const r = await chamar(postExport, { corpo: exportCorpo })
    expect(r.status).toBe(200)
    expect(r.headers.get('x-arquivo-soma')).toBe('')
    expect(r.headers.get('x-arquivo-id')).toBe(`p:${UUID}:01`)
    const pay = rpcs.chamadas.find(c => c.fn === 'obs_archive_record')!.args.p_payload as { partes: number; parts: Array<{ parte: number; sha256_bytes: string; row_count: number; row_offset: number }> }
    expect(pay.partes).toBeGreaterThanOrEqual(2)
    expect(pay.parts).toHaveLength(pay.partes)
    expect(pay.parts[0]!.sha256_bytes).toBe(r.headers.get('x-arquivo-sha256'))
    let off = 0
    for (const p of pay.parts) { expect(p.row_offset).toBe(off); off += p.row_count }
    expect(off).toBe(todas.length)
    for (const p of pay.parts.slice(1)) {
      rpcs.tabela.obs_archive_unit_part_info = async () => ok({ status: 'ok', unidade_id: UUID, versao: 1, partes: pay.partes, de: p.row_offset, ate: p.row_offset + p.row_count, sha256: p.sha256_bytes, recebida: false })
      const rk = await chamar(postExport, { corpo: { ...exportCorpo, parte: p.parte } })
      expect(rk.status).toBe(200)
      expect(rk.headers.get('x-arquivo-sha256')).toBe(p.sha256_bytes)
      expect(rk.headers.get('x-arquivo-soma')).toBe('')
    }
  })
  describe('parte', () => {
    const rows = [['a', '1'], ['b', '2']]
    const info = async (sha: string) => ok({ status: 'ok', unidade_id: UUID, versao: 1, partes: 2, de: 0, ate: 2, sha256: sha, recebida: false })
    const shaDaParte = async () => (await exportarUnidade({ ler: async () => ({ colunas: ['k', 'views'], linhas: rows, contagem: 2, soma: null }) }, null, { tabela: 't', canal: CANAL, de: 'x', ate: 'x', rotulo: 'x' })).sha256
    it('linhas da parte e soma vazia (Pedido 13)', async () => {
      rpcs.tabela.obs_archive_unit_part_info = async () => info(await shaDaParte())
      rpcs.tabela.obs_archive_read_unit = async () => ok(lidaDe(rows))
      const r = await chamar(postExport, { corpo: { ...exportCorpo, parte: 2 } })
      expect(r.status).toBe(200)
      expect(r.headers.get('x-arquivo-id')).toBe(`p:${UUID}:02`)
      expect(r.headers.get('x-arquivo-linhas')).toBe('2')
      expect(r.headers.get('x-arquivo-soma')).toBe('')
      expect(r.headers.get('x-arquivo-partes')).toBe('2')
      expect(r.headers.get('x-arquivo-parte')).toBe('2')
      expect(r.headers.get('x-arquivo-caminho')).toBe(`serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.p02.csv.gz`)
    })
    it('sha diferente do registrado: marca refazer e responde 409 parte_mudou', async () => {
      rpcs.tabela.obs_archive_unit_part_info = async () => info(SHA)
      rpcs.tabela.obs_archive_read_unit = async () => ok(lidaDe(rows))
      rpcs.tabela.obs_archive_mark_redo = async () => ok(null)
      const r = await chamar(postExport, { corpo: { ...exportCorpo, parte: 2 } })
      expect(r.status).toBe(409)
      expect((await json(r)).error?.code).toBe('parte_mudou')
      expect(rpcs.chamadas.at(-1)).toEqual({ fn: 'obs_archive_mark_redo', args: { p_unit: UUID, p_reason: 'parte_mudou' } })
    })
    it('mark_redo falha: 500, nunca 409 parte_mudou como se estivesse gravado (Phil I1)', async () => {
      rpcs.tabela.obs_archive_unit_part_info = async () => info(SHA)
      rpcs.tabela.obs_archive_read_unit = async () => ok(lidaDe(rows))
      rpcs.tabela.obs_archive_mark_redo = async () => erro('x', '42883')
      const r = await chamar(postExport, { corpo: { ...exportCorpo, parte: 2 } })
      expect(r.status).toBe(500)
      expect((await json(r)).error?.code).toBe('erro_do_banco')
    })
    it('faixa que muda entre páginas: grava mudou_durante_a_leitura antes do 409 (Phil I2)', async () => {
      const grande = Array.from({ length: 6000 }, () => ['a', '1'])
      rpcs.tabela.obs_archive_unit_part_info = async () => ok({ status: 'ok', unidade_id: UUID, versao: 1, partes: 2, de: 0, ate: 6000, sha256: SHA, recebida: false })
      let i = 0
      rpcs.tabela.obs_archive_read_unit = async (a) => ok(lidaDe(grande.slice(0, Number(a.p_limit)), { row_count: 6000, hash_conteudo: `h${i++}` }))
      rpcs.tabela.obs_archive_mark_redo = async () => ok(null)
      const r = await chamar(postExport, { corpo: { ...exportCorpo, parte: 2 } })
      expect(r.status).toBe(409)
      expect((await json(r)).error?.code).toBe('mudou_durante_a_leitura')
      expect(rpcs.chamadas.at(-1)).toEqual({ fn: 'obs_archive_mark_redo', args: { p_unit: UUID, p_reason: 'mudou_durante_a_leitura' } })
    })
    it('part_info com um campo a menos: 500, nunca as', async () => {
      rpcs.tabela.obs_archive_unit_part_info = async () => ok({ status: 'ok', unidade_id: UUID, versao: 1, partes: 2, de: 0, ate: 2, recebida: false })
      const r = await chamar(postExport, { corpo: { ...exportCorpo, parte: 2 } })
      expect(r.status).toBe(500)
      expect((await json(r)).error?.code).toBe('erro_do_banco')
    })
    it('part_info recusa (nao_devida): 409', async () => {
      rpcs.tabela.obs_archive_unit_part_info = async () => ok({ status: 'nao_devida' })
      const r = await chamar(postExport, { corpo: { ...exportCorpo, parte: 2 } })
      expect(r.status).toBe(409)
      expect((await json(r)).error?.code).toBe('nao_devida')
    })
  })
})

describe('month/summary e month/manifest', () => {
  const corpo = { classe: 'serie', canal: CANAL, mes: '2026-10' }
  const linhas = {
    versao: 1, vazio: false, unit_hashes: { 'u:x': 'h' },
    colunas_canal: ['canal', 'tabela'], colunas_video: ['video', 'canal'], canal: [[CANAL, 'competitor_video_daily']], video: [['v1', CANAL]],
  }
  it('resumo: recalcula cada unidade, grava e devolve os arquivos em base64', async () => {
    rpcs.tabela.obs_archive_channel_units = async () => ok([`u:${UUID}`])
    rpcs.tabela.obs_archive_unit_rehash = async () => ok({ igual: true })
    rpcs.tabela.obs_archive_summary_rows = async () => ok(linhas)
    rpcs.tabela.obs_archive_record = async () => ok({ status: 'nova', arquivo_id: `s:${UUID}`, versao: 1 })
    const r = await chamar(postSummary, { corpo })
    expect(r.status).toBe(200)
    const d = (await json(r)).data as { arquivo_base: string; versao: number; vazio: boolean; arquivos: Array<{ arquivo_id: string; papel: string; caminho: string; conteudo_base64: string }> }
    expect(d.arquivo_base).toBe(`s:${UUID}`)
    expect(d.arquivos.map(a => a.arquivo_id)).toEqual([`s:${UUID}:canal`, `s:${UUID}:video`])
    expect(d.arquivos[0]!.caminho).toBe(`serie/canais/${CANAL}/resumo/2026-10.v1.canal.csv.gz`)
    expect(Buffer.from(d.arquivos[0]!.conteudo_base64, 'base64').length).toBeGreaterThan(0)
    expect(rpcs.chamadas.map(c => c.fn)).toEqual(['obs_archive_channel_units', 'obs_archive_unit_rehash', 'obs_archive_summary_rows', 'obs_archive_record'])
    expect(rpcs.chamadas[1]!.args).toEqual({ p_unit: UUID })
  })
  it('resumo: hash recalculado diferente é 409 conteudo_mudou e não calcula o resumo', async () => {
    rpcs.tabela.obs_archive_channel_units = async () => ok([`u:${UUID}`])
    rpcs.tabela.obs_archive_unit_rehash = async () => ok({ igual: false })
    const r = await chamar(postSummary, { corpo })
    expect(r.status).toBe(409)
    expect((await json(r)).error?.code).toBe('conteudo_mudou')
    expect(rpcs.chamadas.map(c => c.fn)).not.toContain('obs_archive_summary_rows')
  })
  it('resumo: unidades_pendentes leva os pendentes em details', async () => {
    rpcs.tabela.obs_archive_channel_units = async () => ok([])
    rpcs.tabela.obs_archive_summary_rows = async () => erro('unidades_pendentes', 'P0001', `u:${UUID},faltando:competitor_video_early`)
    const r = await chamar(postSummary, { corpo })
    expect(r.status).toBe(409)
    expect((await json(r)).error?.details).toEqual([`u:${UUID}`, 'faltando:competitor_video_early'])
  })
  it('resumo vazio: vazio true e arquivos []', async () => {
    rpcs.tabela.obs_archive_channel_units = async () => ok([])
    rpcs.tabela.obs_archive_summary_rows = async () => ok({ ...linhas, vazio: true, canal: [], video: [] })
    rpcs.tabela.obs_archive_record = async () => ok({ status: 'nova', arquivo_id: `s:${UUID}`, versao: 1 })
    const d = (await json(await chamar(postSummary, { corpo }))).data as { vazio: boolean; arquivos: unknown[] }
    expect(d).toMatchObject({ vazio: true, arquivos: [] })
  })
  it('manifesto: monta, grava o registro e devolve json e sha256', async () => {
    rpcs.tabela.obs_archive_manifest_rows = async () => ok({
      classe: 'serie', mes: '2026-10', versao: 1, gerado_em: '2026-11-28T00:00:00-03:00',
      arquivos: [{ arquivo_id: `u:${UUID}`, tipo: 'unidade', caminho: `serie/canais/${CANAL}/competitor_video_daily/2026-10.v1.csv.gz`, canal: CANAL, tabela: 'competitor_video_daily', linhas: 2, soma: '3', sha256: SHA, csv_sha256: SHA, estado: 'normal' }],
      contagens: { unidades_canal_removido: 0, unidades_perdidas: 0, unidades_expurgadas: 0 },
    })
    rpcs.tabela.obs_archive_record_manifest = async () => ok({ versao: 1 })
    const r = await chamar(postManifest, { corpo: { classe: 'serie', mes: '2026-10' } })
    expect(r.status).toBe(200)
    const d = (await json(r)).data as { versao: number; arquivos: Array<{ arquivo_id: string; caminho: string; tipo: string }> }
    expect(d.arquivos.map(a => a.arquivo_id)).toEqual(['m:serie:2026-10:v1:json', 'm:serie:2026-10:v1:sha256'])
    expect(d.arquivos.map(a => a.caminho)).toEqual(['serie/manifestos/2026-10.v1.json', 'serie/manifestos/2026-10.v1.sha256'])
    const args = rpcs.chamadas.at(-1)!.args
    expect(args).toMatchObject({ p_class: 'serie', p_month: '2026-10-01', p_versao: 1 })
  })
  it('manifesto: resumos_pendentes é 409 com os canais em details', async () => {
    rpcs.tabela.obs_archive_manifest_rows = async () => erro('resumos_pendentes', 'P0001', CANAL)
    const r = await chamar(postManifest, { corpo: { classe: 'serie', mes: '2026-10' } })
    expect(r.status).toBe(409)
    expect((await json(r)).error?.details).toEqual([CANAL])
  })
})
