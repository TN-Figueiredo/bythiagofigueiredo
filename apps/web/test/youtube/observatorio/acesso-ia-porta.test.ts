// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 4: a prova e a porta do acesso externo da IA (plano, 4.2).
 * O cliente de serviço é simulado e conta cada chamada; as travas leem o modo e a data de conferência simulados.
 * Em cada caso o que importa é também o que NÃO pode ter sido chamado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let modoSimulado: 'aviso' | 'recusa' = 'recusa'
vi.mock('@/lib/pipeline/leitura-modo', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/pipeline/leitura-modo')>()
  return { ...real, modoLeitura: () => ({ ...real.modoLeitura(), modo: modoSimulado }) }
})

vi.mock('@/lib/youtube/observatorio/acesso-ia/regras', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/observatorio/acesso-ia/regras')>()
  return { ...real, ACESSO_IA_RULES: { ...real.ACESSO_IA_RULES } }
})

vi.mock('@/lib/youtube/observatorio/acesso-ia/interruptor', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/observatorio/acesso-ia/interruptor')>()
  return { ...real, acessoExternoLigado: vi.fn(real.acessoExternoLigado) }
})

vi.mock('@/lib/youtube/observatorio/acesso-ia/prova', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/observatorio/acesso-ia/prova')>()
  return { ...real, fabricarProva: vi.fn(real.fabricarProva) }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const servico = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => {
    if (servico.cliente === null) throw new Error('cliente de serviço não montado neste teste')
    return servico.cliente
  }),
}))

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { chaveProvada, ChaveDoPerfilProvada, fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { abrirPorta, type Recusa } from '@/lib/youtube/observatorio/acesso-ia/porta'
import { estadoDaPessoa, pediuApagamento, veOSite } from '@/lib/youtube/observatorio/acesso-ia/pessoa'
import { fraseDeVencida, type ChaveLida } from '@/lib/pipeline/chave'

const AGORA = Date.parse('2026-10-13T15:00:00.000Z')
const DIA = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()
const ENV_ON = { OBSERVATORIO_IA_EXTERNA: 'on' } as NodeJS.ProcessEnv
const DATA_CONFERIDA = '2026-10-20'

const CHAVE: ChaveLida = {
  id: 'key-1',
  siteId: 'site-1',
  name: 'observatorio-20261013-ab12',
  permissions: ['observatorio_leitura'],
  userId: 'user-1',
  expiresAt: iso(AGORA + 30 * DIA),
}

type Erro = { status?: number; code?: string; message?: string } | null
type Resp<T> = { data: T; error: Erro }
type Cenario = Partial<Record<'usuario' | 'apagamento' | 'vinculo', Resp<unknown> | 'lanca' | 'pendente'>>

const responder = (x: Resp<unknown> | 'lanca' | 'pendente' | undefined): Promise<unknown> => {
  if (x === 'lanca') return Promise.reject(new Error('o banco quebrou'))
  if (x === 'pendente' || x === undefined) return new Promise(() => {})
  return Promise.resolve(x)
}

const OK_USUARIO: Resp<unknown> = { data: { user: { id: 'user-1', banned_until: null } }, error: null }
const OK_APAGAMENTO: Resp<unknown> = { data: [], error: null }
const OK_VINCULO: Resp<unknown> = { data: true, error: null }
const TUDO_CERTO: Cenario = { usuario: OK_USUARIO, apagamento: OK_APAGAMENTO, vinculo: OK_VINCULO }

interface Registro {
  getUserById: Array<unknown[]>
  rpc: Array<{ nome: string; args: unknown }>
  from: string[]
  lgpd: Array<[string, unknown[]]>
  sinais: AbortSignal[]
}

function montarCliente(c: Cenario): Registro {
  const reg: Registro = { getUserById: [], rpc: [], from: [], lgpd: [], sinais: [] }
  const cadeia: Record<string, (...a: unknown[]) => unknown> = {}
  for (const m of ['select', 'eq', 'not', 'is', 'limit']) {
    cadeia[m] = (...a: unknown[]) => { reg.lgpd.push([m, a]); return cadeia }
  }
  cadeia.abortSignal = (s: unknown) => { reg.sinais.push(s as AbortSignal); return responder(c.apagamento) }
  servico.cliente = {
    auth: { admin: { getUserById: (...a: unknown[]) => { reg.getUserById.push(a); return responder(c.usuario) } } },
    rpc: (nome: string, args: unknown) => {
      reg.rpc.push({ nome, args })
      return { abortSignal: (s: AbortSignal) => { reg.sinais.push(s); return responder(c.vinculo) } }
    },
    from: (t: string) => { reg.from.push(t); return cadeia },
  }
  return reg
}

const recusaDe = async (chave: ChaveLida, vencida: boolean, env: NodeJS.ProcessEnv): Promise<Recusa> => {
  const r = await abrirPorta(chave, vencida, AGORA, env)
  if (r.ok) throw new Error('esperava recusa')
  return r.recusa
}

beforeEach(() => {
  vi.clearAllMocks()
  servico.cliente = null
  modoSimulado = 'recusa'
  Object.assign(ACESSO_IA_RULES, { e19RecusaConferidaEm: DATA_CONFERIDA, prazoPorIdaMs: 5_000 })
})

describe('a porta: os passos 1 a 4 não tocam o banco', () => {
  it('perfil misto: 403, sem ler as travas, sem banco', async () => {
    const r = await recusaDe({ ...CHAVE, permissions: ['observatorio_leitura', 'read'] }, false, ENV_ON)
    expect(r).toMatchObject({ status: 403, frase: 'chave de perfil misto: recusada', motivo: 'misto', registrar: false })
    expect(acessoExternoLigado).not.toHaveBeenCalled()
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ level: 'warning', extra: { keyId: 'key-1' } }))
  })

  it.each([
    ['a variável apagada (de verdade)', undefined, 'recusa' as const, DATA_CONFERIDA],
    ['a E19 em aviso', ENV_ON, 'aviso' as const, DATA_CONFERIDA],
    ['a E19 sem a conferência anotada', ENV_ON, 'recusa' as const, null],
  ])('travas fechadas por %s: 503, sem banco', async (_nome, env, modo, data) => {
    modoSimulado = modo
    Object.assign(ACESSO_IA_RULES, { e19RecusaConferidaEm: data })
    delete process.env.OBSERVATORIO_IA_EXTERNA
    const r = env === undefined ? await abrirPorta(CHAVE, false, AGORA) : await abrirPorta(CHAVE, false, AGORA, env)
    expect(r).toMatchObject({ ok: false, recusa: { status: 503, frase: 'acesso externo desligado', motivo: 'desligado', registrar: false } })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(fabricarProva).not.toHaveBeenCalled()
  })

  it('user_id nulo: 401 sem pessoa, sem banco', async () => {
    const r = await recusaDe({ ...CHAVE, userId: null }, false, ENV_ON)
    expect(r).toMatchObject({ status: 401, frase: 'chave sem pessoa: peça outra ao dono', motivo: 'sem_pessoa', registrar: false })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('expires_at nula: 401 sem validade, sem banco', async () => {
    const r = await recusaDe({ ...CHAVE, expiresAt: null }, false, ENV_ON)
    expect(r).toMatchObject({ status: 401, frase: 'chave sem validade: peça outra ao dono', motivo: 'sem_validade', registrar: false })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('vencida: 401 com a data na frase, sem banco', async () => {
    const venceu = iso(AGORA - 3 * DIA)
    const r = await recusaDe({ ...CHAVE, expiresAt: venceu }, true, ENV_ON)
    expect(r).toMatchObject({ status: 401, frase: fraseDeVencida(venceu), motivo: 'vencida', registrar: false })
    expect(r.frase).toMatch(/^chave vencida em \d{2}\/\d{2}: peça outra ao dono$/)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('vencida=false com expiresAt no passado: nega 401 (a porta confere a data, não confia só no booleano), sem banco', async () => {
    const venceu = iso(AGORA - 3 * DIA)
    const r = await recusaDe({ ...CHAVE, expiresAt: venceu }, false, ENV_ON)
    expect(r).toMatchObject({ status: 401, frase: fraseDeVencida(venceu), motivo: 'vencida', registrar: false })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('a fronteira: expiresAt igual a agora nega (como resolverChave: <= agora)', async () => {
    expect((await recusaDe({ ...CHAVE, expiresAt: iso(AGORA) }, false, ENV_ON)).motivo).toBe('vencida')
    expect((await recusaDe({ ...CHAVE, expiresAt: iso(AGORA - 1) }, false, ENV_ON)).motivo).toBe('vencida')
  })

  it('os dois divergem: vencida=true com expiresAt no futuro também nega (o mais fechado vale)', async () => {
    expect((await recusaDe({ ...CHAVE, expiresAt: iso(AGORA + 30 * DIA) }, true, ENV_ON)).motivo).toBe('vencida')
  })

  it('expiresAt ilegível ou relógio ilegível (NaN): nega 401 sem lançar', async () => {
    expect((await recusaDe({ ...CHAVE, expiresAt: 'amanhã' }, false, ENV_ON)).motivo).toBe('vencida')
    expect((await recusaDe({ ...CHAVE, expiresAt: '2030-01-01' }, false, ENV_ON)).motivo).toBe('vencida')
    const r = await abrirPorta(CHAVE, false, Number.NaN, ENV_ON)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.recusa).toMatchObject({ status: 401, motivo: 'vencida' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('a ordem: com tudo errado ao mesmo tempo (misto, desligado, sem pessoa, vencida) a resposta é a do primeiro passo; e assim para cada par vizinho', async () => {
    modoSimulado = 'aviso'
    const tudoErrado: ChaveLida = { ...CHAVE, permissions: ['observatorio_leitura', 'read'], userId: null, expiresAt: iso(AGORA - DIA) }
    expect((await recusaDe(tudoErrado, true, {})).motivo).toBe('misto')
    expect((await recusaDe({ ...tudoErrado, permissions: ['observatorio_leitura'] }, true, {})).motivo).toBe('desligado')
    expect((await recusaDe({ ...tudoErrado, permissions: ['observatorio_leitura'] }, true, ENV_ON)).motivo).toBe('desligado')
    modoSimulado = 'recusa'
    expect((await recusaDe({ ...tudoErrado, permissions: ['observatorio_leitura'] }, true, ENV_ON)).motivo).toBe('sem_pessoa')
    expect((await recusaDe({ ...tudoErrado, permissions: ['observatorio_leitura'], userId: 'user-1', expiresAt: null }, true, ENV_ON)).motivo).toBe('sem_validade')
    expect((await recusaDe({ ...tudoErrado, permissions: ['observatorio_leitura'], userId: 'user-1' }, true, ENV_ON)).motivo).toBe('vencida')
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
})

describe('a porta: o passo 5 (a pessoa e o pedido de apagamento)', () => {
  it('pessoa banida: 403, registrar = true, desfecho banida, can_view_site_as não é chamada', async () => {
    const reg = montarCliente({ ...TUDO_CERTO, usuario: { data: { user: { banned_until: iso(AGORA + 60_000) } }, error: null } })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 403, frase: 'sem acesso ao site', motivo: 'sem_acesso', registrar: true, desfecho: 'banida' })
    expect(reg.rpc).toEqual([])
    expect(fabricarProva).not.toHaveBeenCalled()
  })

  it('pessoa ausente (404 da API de administração): 403, registrar = true, desfecho ausente, can_view_site_as não é chamada', async () => {
    const reg = montarCliente({ ...TUDO_CERTO, usuario: { data: { user: null }, error: { status: 404, code: 'user_not_found', message: 'x' } } })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 403, motivo: 'sem_acesso', registrar: true, desfecho: 'ausente' })
    expect(reg.rpc).toEqual([])
  })

  it('banned_until no passado: ativa (fronteira); igual a agora: ativa; um milissegundo depois: banida', async () => {
    for (const [banidoAte, esperado] of [[iso(AGORA - 1), 'ativa'], [iso(AGORA), 'ativa'], [iso(AGORA + 1), 'banida']] as const) {
      montarCliente({ ...TUDO_CERTO, usuario: { data: { user: { banned_until: banidoAte } }, error: null } })
      expect((await estadoDaPessoa('user-1', { agora: AGORA })).estado).toBe(esperado)
    }
  })

  it.each([
    ['dá erro', { data: { user: null }, error: { status: 500, code: 'unexpected_failure', message: 'x' } } as Resp<unknown>],
    ['lança', 'lanca' as const],
    ['não responde (prazo curto, relógio de verdade)', 'pendente' as const],
    ['devolve sem usuário e sem erro (fora de forma)', { data: { user: null }, error: null } as Resp<unknown>],
  ])('a API de administração %s: 503 nao_conferido, registrar = false', async (_n, usuario) => {
    Object.assign(ACESSO_IA_RULES, { prazoPorIdaMs: 20 })
    const reg = montarCliente({ ...TUDO_CERTO, usuario })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 503, motivo: 'nao_conferido', registrar: false, frase: 'não foi possível conferir o acesso agora: tente de novo em instantes' })
    expect(reg.rpc).toEqual([])
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('banimento nulo e pedido de apagamento confirmado: 403, registrar = true, desfecho apagamento_pedido, can_view_site_as não é chamada', async () => {
    const reg = montarCliente({ ...TUDO_CERTO, apagamento: { data: [{ id: 'pedido-1' }], error: null } })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 403, motivo: 'sem_acesso', registrar: true, desfecho: 'apagamento_pedido' })
    expect(reg.rpc).toEqual([])
  })

  it('pedido cancelado, só de exportação ou ainda não confirmado: a consulta não os devolve e a porta passa', async () => {
    // O filtro vive na consulta (cancelled_at nula, type = account_deletion, phase_1_completed_at não nula): o banco devolve lista vazia.
    montarCliente({ ...TUDO_CERTO, apagamento: { data: [], error: null } })
    const r = await abrirPorta(CHAVE, false, AGORA, ENV_ON)
    expect(r.ok).toBe(true)
  })

  it('nenhuma linha lida sem erro: passa (ausência que é zero lido)', async () => {
    montarCliente(TUDO_CERTO)
    expect(await pediuApagamento('user-1')).toBe('nao')
  })

  it.each([
    ['erro genérico', { data: null, error: { code: '57014', message: 'x' } } as Resp<unknown>],
    ['42P01 (tabela ausente)', { data: null, error: { code: '42P01', message: 'x' } } as Resp<unknown>],
    ['PGRST205 (tabela fora do cache)', { data: null, error: { code: 'PGRST205', message: 'x' } } as Resp<unknown>],
    ['lança', 'lanca' as const],
    ['não responde em 20 ms', 'pendente' as const],
    ['dado nulo sem erro', { data: null, error: null } as Resp<unknown>],
  ])('a leitura de lgpd_requests %s: 503 nao_conferido, registrar = false, nunca "passa"', async (_n, apagamento) => {
    Object.assign(ACESSO_IA_RULES, { prazoPorIdaMs: 20 })
    const reg = montarCliente({ ...TUDO_CERTO, apagamento })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 503, motivo: 'nao_conferido', registrar: false })
    expect(reg.rpc).toEqual([])
    expect(fabricarProva).not.toHaveBeenCalled()
  })

  it('a consulta filtra pelo user_id DA CHAVE, por type = account_deletion, por phase_1_completed_at não nula e por cancelled_at nula', async () => {
    const reg = montarCliente(TUDO_CERTO)
    await abrirPorta({ ...CHAVE, userId: 'user-da-chave' }, false, AGORA, ENV_ON)
    expect(reg.from).toEqual(['lgpd_requests'])
    expect(reg.lgpd).toEqual([
      ['select', ['id']],
      ['eq', ['user_id', 'user-da-chave']],
      ['eq', ['type', 'account_deletion']],
      ['not', ['phase_1_completed_at', 'is', null]],
      ['is', ['cancelled_at', null]],
      ['limit', [1]],
    ])
    expect(reg.getUserById).toEqual([['user-da-chave']])
  })

  it('o definitivo vale mais que o inconclusivo: banida ganha de erro na leitura do apagamento; pedido confirmado ganha de erro na API de administração', async () => {
    montarCliente({ ...TUDO_CERTO, usuario: { data: { user: { banned_until: iso(AGORA + DIA) } }, error: null }, apagamento: 'lanca' })
    expect(await recusaDe(CHAVE, false, ENV_ON)).toMatchObject({ status: 403, desfecho: 'banida', registrar: true })
    montarCliente({ ...TUDO_CERTO, usuario: 'lanca', apagamento: { data: [{ id: 'p' }], error: null } })
    expect(await recusaDe(CHAVE, false, ENV_ON)).toMatchObject({ status: 403, desfecho: 'apagamento_pedido', registrar: true })
  })
})

describe('a porta: o passo 6 (o vínculo com o site)', () => {
  it('can_view_site_as false: 403, registrar = true, desfecho sem_vinculo', async () => {
    montarCliente({ ...TUDO_CERTO, vinculo: { data: false, error: null } })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 403, frase: 'sem acesso ao site', motivo: 'sem_acesso', registrar: true, desfecho: 'sem_vinculo' })
    expect(fabricarProva).not.toHaveBeenCalled()
  })

  it.each([
    ['null', { data: null, error: null } as Resp<unknown>],
    ["o texto 'true'", { data: 'true', error: null } as Resp<unknown>],
    ['o número 1', { data: 1, error: null } as Resp<unknown>],
    ['erro PGRST202 (função ausente)', { data: null, error: { code: 'PGRST202', message: 'x' } } as Resp<unknown>],
    ['lança', 'lanca' as const],
  ])('can_view_site_as devolve %s: 503 nao_conferido, registrar = false', async (_n, vinculo) => {
    montarCliente({ ...TUDO_CERTO, vinculo })
    const r = await recusaDe(CHAVE, false, ENV_ON)
    expect(r).toMatchObject({ status: 503, motivo: 'nao_conferido', registrar: false })
    expect(fabricarProva).not.toHaveBeenCalled()
  })

  it('can_view_site_as não responde em 20 ms (prazo curto, relógio de verdade): 503 nao_conferido, e a chamada recebeu sinal de cancelamento', async () => {
    const reg = montarCliente({ ...TUDO_CERTO, vinculo: 'pendente' })
    expect(await veOSite('user-1', 'site-1', { prazoMs: 20 })).toBe('nao_conferido')
    expect(reg.sinais).toHaveLength(1)
    expect(reg.sinais[0]!.aborted).toBe(true)
  })

  it('sem opcoes o prazo de veOSite, de estadoDaPessoa e de pediuApagamento é 5.000', async () => {
    montarCliente(TUDO_CERTO)
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await veOSite('user-1', 'site-1')
    await pediuApagamento('user-1')
    await estadoDaPessoa('user-1')
    expect(espia.mock.calls.map((c) => c[0])).toEqual([5_000, 5_000, 5_000])
    espia.mockRestore()
  })

  it('a função do banco recebe o user_id e o site_id da linha da chave, e mais nada', async () => {
    const reg = montarCliente(TUDO_CERTO)
    await abrirPorta({ ...CHAVE, userId: 'user-da-chave', siteId: 'site-da-chave' }, false, AGORA, ENV_ON)
    expect(reg.rpc).toEqual([{ nome: 'can_view_site_as', args: { p_user: 'user-da-chave', p_site: 'site-da-chave' } }])
  })
})

describe('a porta: tudo certo e a prova', () => {
  it('a fronteira da validade: 1 ms depois de agora ainda abre', async () => {
    montarCliente(TUDO_CERTO)
    expect((await abrirPorta({ ...CHAVE, expiresAt: iso(AGORA + 1) }, false, AGORA, ENV_ON)).ok).toBe(true)
  })

  it('a prova carrega o site, a pessoa, a chave e o vencimento DA CHAVE; JSON.stringify não mostra nada; structuredClone não passa em chaveProvada', async () => {
    montarCliente(TUDO_CERTO)
    const r = await abrirPorta(CHAVE, false, AGORA, ENV_ON)
    if (!r.ok) throw new Error('esperava prova')
    expect(r.prova).toBeInstanceOf(ChaveDoPerfilProvada)
    expect(r.prova.siteId).toBe('site-1')
    expect(r.prova.userId).toBe('user-1')
    expect(r.prova.keyId).toBe('key-1')
    expect(r.prova.venceEm).toBe(CHAVE.expiresAt)
    expect(chaveProvada(r.prova)).toBe(true)
    expect(JSON.stringify(r.prova)).toBe('{}')
    expect(Object.keys(r.prova)).toEqual([])
    expect(chaveProvada(structuredClone(r.prova))).toBe(false)
    expect(Object.isFrozen(r.prova)).toBe(true)
    expect(fabricarProva).toHaveBeenCalledTimes(1)
  })

  it('nada se passa por prova: objeto literal, protótipo vazio e subclasse não passam em chaveProvada', () => {
    expect(chaveProvada({ siteId: 's', userId: 'u', keyId: 'k', venceEm: 'v' })).toBe(false)
    expect(chaveProvada(Object.create(ChaveDoPerfilProvada.prototype))).toBe(false)
    expect(chaveProvada(null)).toBe(false)
    expect(chaveProvada(undefined)).toBe(false)
    expect(chaveProvada('prova')).toBe(false)
  })

  it('o construtor recusa quem não tem a chave do módulo (Reflect.construct não fabrica)', () => {
    expect(() => Reflect.construct(ChaveDoPerfilProvada as unknown as new (...a: unknown[]) => object, ['s', 'u', 'k', 'v', Symbol('x')])).toThrow(TypeError)
  })

  it('em nenhum caminho de recusa uma ChaveDoPerfilProvada é construída; no caminho feliz, exatamente uma', async () => {
    const recusas: Array<[ChaveLida, boolean, NodeJS.ProcessEnv, Cenario]> = [
      [{ ...CHAVE, permissions: ['observatorio_leitura', 'read'] }, false, ENV_ON, TUDO_CERTO],
      [CHAVE, false, {}, TUDO_CERTO],
      [{ ...CHAVE, userId: null }, false, ENV_ON, TUDO_CERTO],
      [{ ...CHAVE, expiresAt: null }, false, ENV_ON, TUDO_CERTO],
      [CHAVE, true, ENV_ON, TUDO_CERTO],
      [CHAVE, false, ENV_ON, { ...TUDO_CERTO, usuario: { data: { user: { banned_until: iso(AGORA + DIA) } }, error: null } }],
      [CHAVE, false, ENV_ON, { ...TUDO_CERTO, apagamento: { data: [{ id: 'p' }], error: null } }],
      [CHAVE, false, ENV_ON, { ...TUDO_CERTO, vinculo: { data: false, error: null } }],
      [CHAVE, false, ENV_ON, { ...TUDO_CERTO, vinculo: 'lanca' }],
    ]
    for (const [chave, vencida, env, cenario] of recusas) {
      montarCliente(cenario)
      expect((await abrirPorta(chave, vencida, AGORA, env)).ok).toBe(false)
    }
    expect(fabricarProva).not.toHaveBeenCalled()
    montarCliente(TUDO_CERTO)
    expect((await abrirPorta(CHAVE, false, AGORA, ENV_ON)).ok).toBe(true)
    expect(fabricarProva).toHaveBeenCalledTimes(1)
  })
})
