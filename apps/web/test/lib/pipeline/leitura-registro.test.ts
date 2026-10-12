// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'

type Linha = { action: string; resource_type: string; site_id: string | null; after_data: Record<string, unknown>; created_at: string }
const banco = vi.hoisted(() => ({
  linhas: [] as Linha[],
  erroInsert: null as { code: string; message: string } | null,
  erroSelect: null as { code: string; message: string } | null,
  selects: 0,
  /** (emenda do portão: S19-I5) true = o banco aceita o pedido e nunca responde. */
  pendura: false,
  sinais: [] as AbortSignal[],
}))
const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (tabela: string) => {
      if (tabela !== 'audit_log') throw new Error(`tabela inesperada: ${tabela}`)
      const filtros: Array<(l: Linha) => boolean> = []
      const consulta = {
        is: (c: 'site_id', v: null) => { filtros.push(l => l[c] === v); return consulta },
        in: (c: 'action', vs: string[]) => { filtros.push(l => vs.includes(l[c])); return consulta },
        gte: (c: 'created_at', v: string) => { filtros.push(l => l[c] >= v); return consulta },
        eq: (c: string, v: unknown) => {
          const campo = c.startsWith('after_data->>') ? c.slice('after_data->>'.length) : null
          filtros.push(l => (campo ? String(l.after_data[campo]) === String(v) : (l as unknown as Record<string, unknown>)[c] === v))
          return consulta
        },
        abortSignal: (s: AbortSignal) => { banco.sinais.push(s); return consulta },
        then: (ok: (r: { count: number | null; error: typeof banco.erroSelect }) => unknown) => {
          banco.selects++
          if (banco.pendura) return new Promise<never>(() => {})
          return Promise.resolve(banco.erroSelect ? { count: null, error: banco.erroSelect } : { count: banco.linhas.filter(l => filtros.every(f => f(l))).length, error: null }).then(ok)
        },
      }
      return {
        select: () => consulta,
        // (emenda do portão: S19-I5) a escrita devolve um construtor com abortSignal, como o cliente de verdade.
        insert: (l: Omit<Linha, 'created_at'>) => {
          const feito = async (): Promise<{ error: typeof banco.erroInsert }> => {
            if (banco.erroInsert) return { error: banco.erroInsert }
            banco.linhas.push({ ...l, created_at: new Date().toISOString() })
            return { error: null }
          }
          const escrita = {
            abortSignal: (s: AbortSignal) => { banco.sinais.push(s); return escrita },
            then: (ok: (r: { error: typeof banco.erroInsert }) => unknown, falha?: (e: unknown) => unknown) =>
              (banco.pendura ? new Promise<never>(() => {}) : feito()).then(ok, falha),
          }
          return escrita
        },
      }
    },
  }),
}))

import { registrarLeitura, rotaNormalizada, diaSP, diasCorridos, zerarEstadoDoRegistro, ACAO_AVISO, ACAO_RECUSA, TETO_LINHAS_DIA, TETO_REGISTRO_MS } from '@/lib/pipeline/leitura-registro'
import type { PipelineAuth } from '@/lib/pipeline/auth'

const AGORA = new Date('2026-10-14T15:00:00.000Z')   // 12:00 em São Paulo, 2º dia corrido
const ID = '11111111-2222-4333-8444-555555555555'
const HASH = 'a'.repeat(64)
const pedido = (caminho = `/api/pipeline/items/${ID}`, metodo = 'GET') => new NextRequest(`https://x.test${caminho}?q=texto-secreto`, { method: metodo, headers: { 'X-Pipeline-Key': 'forja_SEGREDO' } })
const chave = (permissions: string[], extra: Partial<PipelineAuth> = {}): PipelineAuth => ({ siteId: 'site-1', permissions, source: 'api_key', keyHash: HASH, keyId: 'key-1', keyName: 'forja (fila)', ...extra })

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA, toFake: ['Date'] })
  vi.clearAllMocks()
  banco.linhas.length = 0
  banco.erroInsert = null
  banco.erroSelect = null
  banco.selects = 0
  banco.pendura = false
  banco.sinais.length = 0
  Object.assign(cfg, { modo: 'aviso', avisoDesde: '2026-10-13', controleFechadoEm: null, conferenciaAte: null })
  zerarEstadoDoRegistro()
})
afterEach(() => vi.useRealTimers())

describe('rotaNormalizada, diaSP, diasCorridos', () => {
  it('troca uuid e número por marcador e nunca traz a query string', () => {
    expect(rotaNormalizada(`/api/pipeline/items/${ID}/sections/roteiro`)).toBe('/api/pipeline/items/:id/sections/roteiro')
    expect(rotaNormalizada('/api/pipeline/topics/42')).toBe('/api/pipeline/topics/:n')
  })
  it('o dia é o de São Paulo: 02:59 UTC ainda é o dia anterior', () => {
    expect(diaSP(new Date('2026-10-14T02:59:00Z'))).toBe('2026-10-13')
    expect(diaSP(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14')
  })
  it('o dia do deploy é o dia 1', () => {
    expect(diasCorridos('2026-10-13', '2026-10-13')).toBe(1)
    expect(diasCorridos('2026-10-13', '2026-10-27')).toBe(15)
  })
})

describe('registrarLeitura, modo aviso', () => {
  it('chave só com intelligence grava tem_read = false, com id, nome, rota e método, site_id nulo e o site em after_data', async () => {
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
    expect(banco.linhas[0]).toMatchObject({
      action: ACAO_AVISO, resource_type: 'pipeline_api_key', site_id: null,
      after_data: { site_id: 'site-1', key_id: 'key-1', key_name: 'forja (fila)', rota: '/api/pipeline/items/:id', metodo: 'GET', tem_read: false },
    })
  })
  it('controle positivo: chave com read grava a mesma linha com tem_read = true; write e admin também contam como read', async () => {
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['write']), 'aviso')
    await registrarLeitura(pedido(), chave(['admin']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.tem_read)).toEqual([true, true, true])
  })
  it('a linha não contém a chave, o hash nem a query string', async () => {
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    const texto = JSON.stringify(banco.linhas)
    expect(texto).not.toContain('forja_SEGREDO')
    expect(texto).not.toContain(HASH)
    expect(texto).not.toContain('texto-secreto')
  })
  it('sessão de usuário não grava', async () => {
    await registrarLeitura(pedido(), { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' }, 'aviso')
    expect(banco.linhas).toHaveLength(0)
  })
  it('gravação que falha não lança e vai ao Sentry', async () => {
    banco.erroInsert = { code: '08006', message: 'conexão caiu' }
    await expect(registrarLeitura(pedido(), chave(['read']), 'aviso')).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
  it('chave sem nome: key_name nulo, a linha é gravada', async () => {
    await registrarLeitura(pedido(), chave(['read'], { keyName: undefined }), 'aviso')
    expect(banco.linhas[0]!.after_data.key_name).toBeNull()
  })
})

describe('registrarLeitura: o registro tem fim e tem teto', () => {
  it('janela fechada: leitura com read não grava; leitura sem read continua gravando', async () => {
    cfg.controleFechadoEm = '2026-10-21'
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.tem_read)).toEqual([false])
  })
  it('15º dia corrido sem fechar: duas leituras da mesma chave na mesma rota no mesmo dia gravam uma linha só', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['read']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.rota)).toEqual(['/api/pipeline/items/:id', '/api/pipeline/stats'])
  })
  it('15º dia, outra instância (memória zerada): a linha de hoje no banco impede a segunda', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    zerarEstadoDoRegistro()
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
  })
  it('14º dia ainda grava cheio', async () => {
    vi.setSystemTime(new Date('2026-10-26T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(2)
  })
  it('teto do dia: com 5.000 linhas hoje, passa a uma por chave, rota e dia (para as duas espécies)', async () => {
    const hoje = new Date().toISOString()
    for (let i = 0; i < TETO_LINHAS_DIA; i++) banco.linhas.push({ action: ACAO_AVISO, resource_type: 'pipeline_api_key', site_id: null, after_data: { key_id: 'outra', rota: '/x', metodo: 'GET', tem_read: true }, created_at: hoje })
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas).toHaveLength(TETO_LINHAS_DIA + 1)
  })
  it('a contagem do teto é lida uma vez a cada 5 minutos por instância, não a cada leitura', async () => {
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.selects).toBe(1)
  })
  it('contagem do teto que falha: o registro segue cheio (prefere medir) e o erro vai ao Sentry', async () => {
    banco.erroSelect = { code: '57014', message: 'timeout' }
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe('registrarLeitura, modo recusa', () => {
  beforeEach(() => { cfg.modo = 'recusa' })
  it('recusa grava pipeline_leitura_recusada com os mesmos campos', async () => {
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas[0]).toMatchObject({ action: ACAO_RECUSA, site_id: null, after_data: { key_id: 'key-1', rota: '/api/pipeline/items/:id', tem_read: false } })
  })
  it('leitura aceita grava o controle só até conferenciaAte (as 48 horas da conferência), e nesse período grava todas', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-30T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(0)
    cfg.conferenciaAte = '2026-11-01T00:00:00.000Z'   // dentro da conferência, mesmo passado o 15º dia: sem modo reduzido
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(2)
  })
  it('sem conferenciaAte, leitura aceita não grava nada', async () => {
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(0)
  })

  // (emenda do portão: D-I4, S19-M2) O modo recusa também tem teto no tempo.
  it('dentro das 48 horas da conferência a recusa grava todas (é o que o item 210 lê)', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-22T15:00:00.000Z'))
    for (let i = 0; i < 3; i++) await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(3)
  })
  it('passada a conferência, a recusa é sempre reduzida: 50 recusas da mesma chave na mesma rota, dois dias depois, gravam UMA linha', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-25T15:00:00.000Z'))
    for (let i = 0; i < 50; i++) await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(1)
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(2)   // outra rota: outra linha
    vi.setSystemTime(new Date('2026-10-26T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(3)   // outro dia: outra linha
  })
  it('passada a conferência, outra instância (memória zerada) não grava a segunda linha do dia', async () => {
    cfg.conferenciaAte = '2026-10-23T00:00:00.000Z'
    vi.setSystemTime(new Date('2026-10-25T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    zerarEstadoDoRegistro()
    await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(1)
  })
  it('modo recusa sem conferenciaAte (não deveria ser publicado): reduzido, nunca cheio', async () => {
    for (let i = 0; i < 10; i++) await registrarLeitura(pedido(), chave(['intelligence']), 'recusada')
    expect(banco.linhas).toHaveLength(1)
  })
})

// (emenda do portão: S19-I5, S19-M1, D-M10)
describe('registrarLeitura: teto de tempo, e o Sentry sem enxurrada', () => {
  it('banco que aceita a conexão e não responde: o registro desiste em 1,5 s, a leitura segue, e a falha vai ao Sentry como gravação', async () => {
    vi.useFakeTimers({ now: AGORA })   // neste teste o relógio de setTimeout também é falso
    banco.pendura = true
    let terminou = false
    const p = registrarLeitura(pedido(), chave(['read']), 'aviso').then(() => { terminou = true })
    await vi.advanceTimersByTimeAsync(TETO_REGISTRO_MS - 1)
    expect(terminou).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await p
    expect(terminou).toBe(true)
    expect(banco.linhas).toHaveLength(0)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureException).mock.calls[0]![1]).toMatchObject({ tags: { action: 'leitura_registro', tipo: 'gravacao' } })
    expect(banco.sinais.length).toBeGreaterThan(0)
    expect(banco.sinais.every(s => s.aborted)).toBe(true)
  })
  it('gravação recusada de forma sistemática: uma captura por hora por instância, não uma por leitura', async () => {
    banco.erroInsert = { code: '42501', message: 'recusado' }
    for (let i = 0; i < 5; i++) await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(AGORA.getTime() + 61 * 60_000))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
  })
  it('falha de contagem e falha de gravação têm tipos diferentes: uma não cala a outra', async () => {
    banco.erroSelect = { code: '57014', message: 'timeout' }
    banco.erroInsert = { code: '42501', message: 'recusado' }
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(vi.mocked(Sentry.captureException).mock.calls.map(c => (c[1] as { tags: { tipo: string } }).tags.tipo).sort()).toEqual(['contagem', 'gravacao'])
  })
  it('dia que bate no teto: uma mensagem no Sentry, não uma por leitura', async () => {
    const hoje = new Date().toISOString()
    for (let i = 0; i < TETO_LINHAS_DIA; i++) banco.linhas.push({ action: ACAO_AVISO, resource_type: 'pipeline_api_key', site_id: null, after_data: { key_id: 'outra', rota: '/x', metodo: 'GET', tem_read: true }, created_at: hoje })
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['read']), 'aviso')
    const doTeto = vi.mocked(Sentry.captureMessage).mock.calls.filter(c => String(c[0]).includes('teto'))
    expect(doTeto).toHaveLength(1)
  })
})
