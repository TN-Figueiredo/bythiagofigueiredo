// @vitest-environment node
/**
 * M9 Tarefa 11: a rota C14 (`POST /archive/expurgo`) e os ajustes de attest/plan. Com o cliente do banco simulado (molde de
 * test/api/pipeline-archive.test.ts); o SQL em si é coberto pelos testes de integração `manutencao-m9-*`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const chave = vi.hoisted(() => ({ atual: { id: 'k', site_id: 'site-1', name: 'dono', permissions: ['archive_owner'] as string[] } }))
type Resp = { data: unknown; error: { code?: string; message: string; details?: string } | null }
const rpcs = vi.hoisted(() => ({ tabela: {} as Record<string, (args: Record<string, unknown>) => Promise<unknown>>, chamadas: [] as Array<{ fn: string; args: Record<string, unknown> }> }))
const tabelas = vi.hoisted(() => ({ lidas: {} as Record<string, { data: unknown; error: unknown }>, consultas: [] as string[] }))
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (t: string) => {
      if (t === 'pipeline_api_keys') {
        return { select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: chave.atual }) }) }) }), update: () => ({ eq: async () => ({}) }) }
      }
      tabelas.consultas.push(t)
      const fim = { maybeSingle: async () => tabelas.lidas[t] ?? { data: null, error: null } }
      return { select: () => ({ eq: () => ({ eq: () => fim }) }) }
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.chamadas.push({ fn, args })
      const f = rpcs.tabela[fn]
      if (!f) throw new Error(`rpc sem programação: ${fn}`)
      return f(args)
    },
  }),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => { throw new Error('sem sessão') } }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true }) }))

import { POST as postExpurgo } from '@/app/api/pipeline/archive/expurgo/route'
import { POST as postAttest } from '@/app/api/pipeline/archive/attest/route'
import { GET as getPlan } from '@/app/api/pipeline/archive/plan/route'
import { GET as getPending } from '@/app/api/pipeline/archive/pending/route'

const CANAL = '11111111-1111-4111-8111-111111111111'
const UUID = '22222222-2222-4222-8222-222222222222'
const SHA = 'a'.repeat(64)
const ok = (data: unknown): Resp => ({ data, error: null })
const erro = (message: string, code = 'P0001'): Resp => ({ data: null, error: { code, message } })

let n = 0
type Rota = (req: NextRequest) => Promise<Response>
async function chamar(rota: Rota, o: { perms?: string[]; corpo?: unknown; query?: string; semChave?: boolean; bruto?: string } = {}): Promise<Response> {
  chave.atual = { id: 'k', site_id: 'site-1', name: 'dono', permissions: o.perms ?? ['archive_owner'] }
  const get = rota === getPlan || rota === getPending
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!o.semChave) headers['X-Pipeline-Key'] = `k-arq-t11e-${++n}`
  const init: RequestInit = { method: get ? 'GET' : 'POST', headers }
  if (!get) init.body = o.bruto ?? JSON.stringify(o.corpo ?? {})
  return rota(new NextRequest(`http://localhost/api/pipeline/archive/x${o.query ?? ''}`, init as never))
}
const json = async (r: Response) => (await r.json()) as { data?: unknown; error?: { code: string; message: string; details?: unknown } }

const unidade = { row_count: 3, control_sum: '9', hash_conteudo: SHA, schema_fp: SHA, sha256_bytes: SHA, csv_sha256: SHA, file_bytes: 10, partes: 1, min_key: null, max_key: null, parts: [] }
const registrar = {
  passo: 'registrar', item_id: 'item:7', classe: 'serie', canal: CANAL, mes: '2026-09',
  alvos: [{ alvo_id: 5, removidas: 3, unidade }],
  resumo: { versao: 2, vazio: false, canal_sha256: SHA, canal_bytes: 1, canal_rows: 1, video_sha256: SHA, video_bytes: 1, video_rows: 1, tabelas_lidas: ['competitor_video_daily'] },
}
const aberto = {
  grupos: [{
    classe: 'serie', canal: CANAL, mes: '2026-09', filho: 'numerico',
    alvos: [{ alvo_id: 5, tabela: 'competitor_video_daily', versao: 1, linhas: 3, soma: '9007199254740993', coluna_controle: 'views', schema_fp: SHA, hash_conteudo: SHA,
      esperadas: 3, chaves: [], refs: [], arquivos: [{ caminho: 'serie/x.csv.gz', sha256: SHA, parte: 1 }] }],
    outras: [], vazias: [], resumo: null, mes_online: true, dias_do_mes: 30,
  }],
  esperando: 0,
}
const atestarNas = { fonte: 'nas', plano_id: UUID, filhos: { numerico: { montado: true, sentinela: true }, texto: { montado: true, sentinela: true } }, canarios: [], itens: [] }
const atestarB2 = { fonte: 'b2', execucao_id: UUID, itens: [{ arquivo_id: 'canario:numerico', resultado: 'ausente', tentativa: 1 }] }
const prefNas = { alvo: `canal:${CANAL}`, filho: 'texto', prefixo: `serie/canais/${CANAL}/`, estado: 'ausente', snapshots: 'ausente' }
const respNas = { itens: [], canarios: [] }
const respB2 = { execucao: { estado: 'controle_ok', negativo_ok: true, canario_ok: { numerico: true, texto: true } }, itens: [] }

beforeEach(() => {
  rpcs.tabela = {}; rpcs.chamadas = []; tabelas.lidas = {}; tabelas.consultas = []
  sentry.captureMessage.mockClear(); sentry.captureException.mockClear()
  process.env.OBS_ARQUIVO = 'on'
})
afterEach(() => { delete process.env.OBS_ARQUIVO })

describe('C14 expurgo: autenticação', () => {
  it('sem chave: 401; chave sem archive_owner: 403; OBS_ARQUIVO apagada: 503', async () => {
    expect((await chamar(postExpurgo, { semChave: true, corpo: { passo: 'abrir', item_id: 'item:7' } })).status).toBe(401)
    for (const p of ['archive_copy', 'archive_b2', 'archive_read', 'write', 'admin']) {
      expect((await chamar(postExpurgo, { perms: [p], corpo: { passo: 'abrir', item_id: 'item:7' } })).status).toBe(403)
    }
    delete process.env.OBS_ARQUIVO
    const r = await chamar(postExpurgo, { corpo: { passo: 'abrir', item_id: 'item:7' } })
    expect(r.status).toBe(503)
    expect(rpcs.chamadas).toHaveLength(0)
  })
})

describe('C14 expurgo: abrir', () => {
  it('devolve os grupos; o site é o da chave; soma é texto', async () => {
    rpcs.tabela.obs_archive_expurgo_open = async () => ok(aberto)
    const r = await chamar(postExpurgo, { corpo: { passo: 'abrir', item_id: 'item:7' } })
    expect(r.status).toBe(200)
    const d = (await json(r)).data as typeof aberto
    expect(d.grupos[0]!.alvos[0]!.arquivos).toHaveLength(1)
    expect(d.grupos[0]!.alvos[0]!.hash_conteudo).toBe(SHA)
    expect(d.grupos[0]!.alvos[0]!.soma).toBe('9007199254740993')
    expect(rpcs.chamadas).toEqual([{ fn: 'obs_archive_expurgo_open', args: { p_site: 'site-1', p_item_id: '7' } }])
  })
  it('item que não existe: 404 item_desconhecido, sem Sentry', async () => {
    rpcs.tabela.obs_archive_expurgo_open = async () => erro('item_desconhecido')
    const r = await chamar(postExpurgo, { corpo: { passo: 'abrir', item_id: 'item:99' } })
    expect(r.status).toBe(404)
    expect((await json(r)).error?.code).toBe('item_desconhecido')
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })
  it('item_id que não é item:<n>: 400 sem chamar o banco; JSON quebrado: 400', async () => {
    expect((await chamar(postExpurgo, { corpo: { passo: 'abrir', item_id: `canal:${CANAL}` } })).status).toBe(400)
    expect((await chamar(postExpurgo, { bruto: '{nao' })).status).toBe(400)
    expect(rpcs.chamadas).toHaveLength(0)
  })
  it('resposta fora do esquema nunca vira 200', async () => {
    rpcs.tabela.obs_archive_expurgo_open = async () => ok({ grupos: 'x' })
    const r = await chamar(postExpurgo, { corpo: { passo: 'abrir', item_id: 'item:7' } })
    expect(r.status).toBe(500)
    expect(sentry.captureMessage).toHaveBeenCalled()
  })
})

describe('C14 expurgo: registrar', () => {
  it('200 com o JSON da função; o corpo vai ao banco sem passo e sem item_id', async () => {
    rpcs.tabela.obs_archive_expurgo_record = async () => ok({ status: 'ok', alvos: [{ alvo_id: 5, estado: 'aguardando_nova', arquivo_id: `u:${UUID}`, versao: 2 }], resumo: { arquivo_id: `s:${UUID}`, versao: 2 } })
    const r = await chamar(postExpurgo, { corpo: registrar })
    expect(r.status).toBe(200)
    const a = rpcs.chamadas[0]!.args as { p_grupo: Record<string, unknown> }
    expect(rpcs.chamadas[0]!.fn).toBe('obs_archive_expurgo_record')
    expect(rpcs.chamadas[0]!.args).toMatchObject({ p_site: 'site-1', p_item_id: '7' })
    expect(a.p_grupo).not.toHaveProperty('passo'); expect(a.p_grupo).not.toHaveProperty('item_id')
    expect(a.p_grupo).toHaveProperty('alvos')
  })
  it('toda recusa da função vira 409 com o mesmo código (alvo_id junto) e não vai ao Sentry', async () => {
    const codigos = ['resumo_versao_mudou', 'base_mudou', 'contagem_divergente', 'grupo_incompleto', 'resumo_com_unidade_nao_lida', 'alvo_de_outro_item',
      'alvo_fora_de_copiar', 'mes_destacado_em_transito', 'expurgo_em_curso', 'sem_destino', 'canal_removido', 'um_codigo_novo_da_sql']
    for (const motivo of codigos) {
      rpcs.tabela.obs_archive_expurgo_record = async () => ok({ status: 'recusado', motivo, alvo_id: 5 })
      const r = await chamar(postExpurgo, { corpo: registrar })
      expect(r.status).toBe(409)
      const e = (await json(r)).error!
      expect(e.code).toBe(motivo)
      expect(e.details).toEqual({ alvo_id: 5 })
    }
    expect(sentry.captureException).not.toHaveBeenCalled(); expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('recusa sem alvo_id: 409 sem details', async () => {
    rpcs.tabela.obs_archive_expurgo_record = async () => ok({ status: 'recusado', motivo: 'resumo_versao_mudou' })
    const r = await chamar(postExpurgo, { corpo: registrar })
    expect(r.status).toBe(409)
    expect((await json(r)).error).toEqual({ code: 'resumo_versao_mudou', message: 'resumo versao mudou' })
  })
  it('mes_destacado_em_transito lançado pelo gatilho (P0001, com ou sem meses): 409 e Sentry NÃO chamado', async () => {
    for (const msg of ['mes_destacado_em_transito', 'mes_destacado_em_transito: 2026-09']) {
      rpcs.tabela.obs_archive_expurgo_record = async () => erro(msg)
      const r = await chamar(postExpurgo, { corpo: registrar })
      expect(r.status).toBe(409)
      expect((await json(r)).error?.code).toBe('mes_destacado_em_transito')
    }
    expect(sentry.captureException).not.toHaveBeenCalled(); expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('exceção desconhecida do banco: 500 sem detalhe e Sentry chamado', async () => {
    rpcs.tabela.obs_archive_expurgo_record = async () => erro('segredo do banco', 'XX000')
    const r = await chamar(postExpurgo, { corpo: registrar })
    expect(r.status).toBe(500)
    expect(JSON.stringify(await json(r))).not.toContain('segredo')
    expect(sentry.captureMessage).toHaveBeenCalled()
  })
  it('400 de forma: sha256_bytes com 63 caracteres; resumo sem tabelas_lidas', async () => {
    const ruim = { ...registrar, alvos: [{ alvo_id: 5, removidas: 3, unidade: { ...unidade, sha256_bytes: 'a'.repeat(63) } }] }
    expect((await chamar(postExpurgo, { corpo: ruim })).status).toBe(400)
    const { tabelas_lidas: _t, ...semLidas } = registrar.resumo
    expect((await chamar(postExpurgo, { corpo: { ...registrar, resumo: semLidas } })).status).toBe(400)
    expect(rpcs.chamadas).toHaveLength(0)
  })
})

describe('C14 expurgo: bloquear e canal', () => {
  it('bloquear: chama a função com o alvo e o motivo; motivo fora da lista: 400', async () => {
    rpcs.tabela.obs_archive_expurgo_block = async () => ok({ status: 'ok' })
    const r = await chamar(postExpurgo, { corpo: { passo: 'bloquear', item_id: 'item:7', alvo_id: 5, motivo: 'antiga_ausente' } })
    expect(r.status).toBe(200)
    expect(rpcs.chamadas[0]).toEqual({ fn: 'obs_archive_expurgo_block', args: { p_site: 'site-1', p_alvo: 5, p_motivo: 'antiga_ausente' } })
    expect((await chamar(postExpurgo, { corpo: { passo: 'bloquear', item_id: 'item:7', alvo_id: 5, motivo: 'outro' } })).status).toBe(400)
  })
  it('bloquear: alvo fora de copiar é 409; alvo desconhecido é 404', async () => {
    rpcs.tabela.obs_archive_expurgo_block = async () => ok({ status: 'recusado', motivo: 'alvo_fora_de_copiar', alvo_id: 5 })
    expect((await chamar(postExpurgo, { corpo: { passo: 'bloquear', item_id: 'item:7', alvo_id: 5, motivo: 'antiga_ausente' } })).status).toBe(409)
    rpcs.tabela.obs_archive_expurgo_block = async () => erro('item_desconhecido')
    expect((await chamar(postExpurgo, { corpo: { passo: 'bloquear', item_id: 'item:7', alvo_id: 5, motivo: 'antiga_ausente' } })).status).toBe(404)
  })
  it('canal: uuid sem remoção nem canal é 200 canal_desconhecido; canal vivo é canal_nao_removido; sem rpc', async () => {
    let r = await chamar(postExpurgo, { corpo: { passo: 'canal', channel_ref: CANAL } })
    expect(r.status).toBe(200)
    expect((await json(r)).data).toEqual({ motivo: 'canal_desconhecido', prefixos: [] })
    tabelas.lidas.competitor_channels = { data: { id: CANAL }, error: null }
    r = await chamar(postExpurgo, { corpo: { passo: 'canal', channel_ref: CANAL } })
    expect(((await json(r)).data as { motivo: string }).motivo).toBe('canal_nao_removido')
    expect(rpcs.chamadas).toHaveLength(0)
  })
  it('canal: a decisão da remoção dá o motivo (guardar, apagar, sem decisão)', async () => {
    for (const [decisao, motivo] of [['guardar', 'canal_guardado'], ['apagar', 'ok'], [null, 'sem_destino']] as const) {
      tabelas.lidas.obs_archive_channel_removals = { data: { archive_decision: decisao, completed_at: null }, error: null }
      const r = await chamar(postExpurgo, { corpo: { passo: 'canal', channel_ref: CANAL } })
      expect(((await json(r)).data as { motivo: string }).motivo).toBe(motivo)
    }
  })
  it('canal: falha de leitura é 500 com Sentry', async () => {
    tabelas.lidas.obs_archive_channel_removals = { data: null, error: { message: 'x' } }
    const r = await chamar(postExpurgo, { corpo: { passo: 'canal', channel_ref: CANAL } })
    expect(r.status).toBe(500)
    expect(sentry.captureException).toHaveBeenCalled()
  })
})

describe('attest com prefixos (C4, resolve C10)', () => {
  it('nas: chama attest_nas sem prefixos no corpo e depois attest_prefixos; devolve prefixos na mesma resposta', async () => {
    rpcs.tabela.obs_archive_attest_nas = async () => ok(respNas)
    rpcs.tabela.obs_archive_attest_prefixos = async () => ok({ prefixos: [{ alvo: prefNas.alvo, filho: 'texto', prefixo: prefNas.prefixo, resposta: 'aceito' }] })
    const r = await chamar(postAttest, { perms: ['archive_copy'], corpo: { ...atestarNas, prefixos: [prefNas] } })
    expect(r.status).toBe(200)
    expect(((await json(r)).data as { prefixos: Array<{ resposta: string }> }).prefixos[0]!.resposta).toBe('aceito')
    expect(rpcs.chamadas.map(c => c.fn)).toEqual(['obs_archive_attest_nas', 'obs_archive_attest_prefixos'])
    expect(rpcs.chamadas[0]!.args.p_body).not.toHaveProperty('prefixos')
    expect(rpcs.chamadas[1]!.args).toEqual({ p_site: 'site-1', p_fonte: 'nas', p_execucao: null, p_filhos: atestarNas.filhos, p_prefixos: [prefNas] })
  })
  it('b2: execucao_id e nomes vão à função', async () => {
    rpcs.tabela.obs_archive_attest_b2 = async () => ok(respB2)
    rpcs.tabela.obs_archive_attest_prefixos = async () => ok({ prefixos: [] })
    const pref = { alvo: `item:7`, filho: 'numerico', prefixo: 'serie/x/', estado: 'presente', nomes: ['serie/x/a.csv.gz'] }
    const r = await chamar(postAttest, { perms: ['archive_b2'], corpo: { ...atestarB2, prefixos: [pref] } })
    expect(r.status).toBe(200)
    expect(rpcs.chamadas[1]!.args).toEqual({ p_site: 'site-1', p_fonte: 'b2', p_execucao: UUID, p_filhos: {}, p_prefixos: [pref] })
  })
  it('sem prefixos ou com lista vazia: igual à M3b (só o attest existente, sem a chave prefixos na resposta)', async () => {
    rpcs.tabela.obs_archive_attest_nas = async () => ok(respNas)
    for (const corpo of [atestarNas, { ...atestarNas, prefixos: [] }]) {
      rpcs.chamadas = []
      const r = await chamar(postAttest, { perms: ['archive_copy'], corpo })
      expect(r.status).toBe(200)
      expect((await json(r)).data).toEqual(respNas)
      expect(rpcs.chamadas.map(c => c.fn)).toEqual(['obs_archive_attest_nas'])
    }
  })
  it('b2 sem execucao_id: 400', async () => {
    const { execucao_id: _e, ...semExec } = atestarB2
    expect((await chamar(postAttest, { perms: ['archive_b2'], corpo: { ...semExec, prefixos: [{ alvo: 'item:7', filho: 'numerico', prefixo: 'a/', estado: 'ausente' }] } })).status).toBe(400)
  })
  it('combinação errada é 400: snapshots no b2, nomes no nas', async () => {
    const b2 = { alvo: 'item:7', filho: 'numerico', prefixo: 'a/', estado: 'ausente' }
    expect((await chamar(postAttest, { perms: ['archive_b2'], corpo: { ...atestarB2, prefixos: [{ ...b2, snapshots: 'ausente' }] } })).status).toBe(400)
    expect((await chamar(postAttest, { perms: ['archive_copy'], corpo: { ...atestarNas, prefixos: [{ ...prefNas, nomes: ['a'] }] } })).status).toBe(400)
    expect(rpcs.chamadas).toHaveLength(0)
  })
  it('recusa prefixo inseguro, alvo fora do formato, mais de 20 nomes e nome fora do alfabeto', async () => {
    const mal = (p: Record<string, unknown>, fonte: 'nas' | 'b2' = 'nas') => chamar(postAttest, fonte === 'nas'
      ? { perms: ['archive_copy'], corpo: { ...atestarNas, prefixos: [{ ...prefNas, ...p }] } }
      : { perms: ['archive_b2'], corpo: { ...atestarB2, prefixos: [{ alvo: 'item:7', filho: 'numerico', prefixo: 'a/', estado: 'presente', nomes: ['a'], ...p }] } })
    for (const prefixo of ['../x/', 'a/../b/', '/abs/', 'a//b/', '.', '']) expect((await mal({ prefixo })).status).toBe(400)
    expect((await mal({ alvo: 'item:0' })).status).toBe(400)
    expect((await mal({ alvo: 'canal:xyz' })).status).toBe(400)
    expect((await mal({ nomes: Array.from({ length: 21 }, (_, i) => `a${i}`) }, 'b2')).status).toBe(400)
    expect((await mal({ nomes: ['a b'] }, 'b2')).status).toBe(400)
    expect((await mal({ nomes: ['../a'] }, 'b2')).status).toBe(400)
    expect(rpcs.chamadas).toHaveLength(0)
  })
  it('erro do banco em attest_prefixos: 500 (nunca 200 sem a parte dos prefixos)', async () => {
    rpcs.tabela.obs_archive_attest_nas = async () => ok(respNas)
    rpcs.tabela.obs_archive_attest_prefixos = async () => erro('boom', 'XX000')
    const r = await chamar(postAttest, { perms: ['archive_copy'], corpo: { ...atestarNas, prefixos: [prefNas] } })
    expect(r.status).toBe(500)
  })
})

describe('plan e pending (C5, C13)', () => {
  const base = {
    plano_id: UUID, gerado_em: '2026-11-28T10:00:00+00:00', modo: 'normal', cursor_seguinte: null, primeira_selagem: null, vermelhos: [],
    canario: { dia: '2026-11-28' }, exportar: [], resumos: [], manifestos: [], aguardando_dono: [], a_apagar: [], reconferir: [],
  }
  it('plan: prefixos_ausentes preenchido (lista de dicts) passa; dict fora da forma é 500', async () => {
    const linha = { alvo: `canal:${CANAL}`, filho: 'texto', prefixo: `serie/canais/${CANAL}/`, e_prefixo: true, provar_snapshots: true }
    rpcs.tabela.obs_archive_plan = async () => ok({ ...base, prefixos_ausentes: [linha] })
    let r = await chamar(getPlan, { perms: ['archive_copy'] })
    expect(r.status).toBe(200)
    expect(((await json(r)).data as { prefixos_ausentes: unknown[] }).prefixos_ausentes).toEqual([linha])
    rpcs.tabela.obs_archive_plan = async () => ok({ ...base, prefixos_ausentes: [{ ...linha, prefixo: '../x' }] })
    r = await chamar(getPlan, { perms: ['archive_copy'] })
    expect(r.status).toBe(500)
  })
  it('b2/plan: prefixos_ausentes sem provar_snapshots', async () => {
    const linha = { alvo: 'item:7', filho: 'numerico', prefixo: 'serie/x/', e_prefixo: true }
    rpcs.tabela.obs_archive_b2_plan = async () => ok({
      execucao_id: UUID, gerado_em: '2026-11-28T10:00:00+00:00', modo: 'normal', cursor_seguinte: null, primeira_selagem: null, vermelhos: [],
      estado: { numerico: 'nada_devido', texto: 'nada_devido' }, teto_bytes_dia: 1, teto_bytes_mes: 1,
      controle_negativo: { arquivo_id: 'controle_negativo', filho: 'numerico', caminho: 'x' },
      canarios: [{ arquivo_id: 'canario:numerico', filho: 'numerico', caminho: null }, { arquivo_id: 'canario:texto', filho: 'texto', caminho: null }],
      arquivos: [], prefixos_ausentes: [linha], retomado_de: null, cobertura: null,
    })
    const r = await chamar(getPlan, { perms: ['archive_b2'], query: '?fonte=b2' })
    expect(r.status).toBe(200)
    expect(((await json(r)).data as { prefixos_ausentes: unknown[] }).prefixos_ausentes).toEqual([linha])
  })
  it('pending: versao 2 passa; versao 1 é 500 (o leitor é da versão 2)', async () => {
    rpcs.tabela.obs_archive_owner_pending = async () => ok({ versao: 2, lido_em: '2026-11-28T10:00:00+00:00', total: 0, itens: [] })
    const r = await chamar(getPending)
    expect(r.status).toBe(200)
    expect(((await json(r)).data as { versao: number }).versao).toBe(2)
    rpcs.tabela.obs_archive_owner_pending = async () => ok({ versao: 1, lido_em: '2026-11-28T10:00:00+00:00', total: 0, itens: [] })
    expect((await chamar(getPending)).status).toBe(500)
  })
})

describe('record (C3)', () => {
  it('expurgo_em_curso é código conhecido: 409', async () => {
    const { STATUS_DO_CODIGO } = await import('@/lib/youtube/observatorio/arquivo-mensal/contrato')
    expect((STATUS_DO_CODIGO as Record<string, number>).expurgo_em_curso).toBe(409)
  })
})
