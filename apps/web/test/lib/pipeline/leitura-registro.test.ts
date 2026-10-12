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

import { registrarLeitura, rotaNormalizada, diaSP, diasCorridos, zerarEstadoDoRegistro, DISJUNTOR_FALHAS, DISJUNTOR_PAUSA_MS, ACAO_AVISO, ACAO_RECUSA, TETO_LINHAS_DIA, TETO_REGISTRO_MS } from '@/lib/pipeline/leitura-registro'
import { TETO_LINHAS_DIA_DA_JANELA, montarJanela } from '@/lib/pipeline/leitura-janela'
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
    expect(rotaNormalizada(`/api/pipeline/items/${ID}/sections/roteiro`)).toBe('/api/pipeline/items/[id]/sections/[section]')
    expect(rotaNormalizada('/api/pipeline/topics/42')).toBe('/api/pipeline/topics/[code]')
    expect(rotaNormalizada('/api/pipeline/rota-nova-sem-padrao/42')).toBe('/api/pipeline/rota-nova-sem-padrao/:n')   // fora da lista: cai na troca por marcador
  })
  it('o dia é o de São Paulo: 02:59 UTC ainda é o dia anterior', () => {
    expect(diaSP(new Date('2026-10-14T02:59:00Z'))).toBe('2026-10-13')
    expect(diaSP(new Date('2026-10-14T03:00:00Z'))).toBe('2026-10-14')
  })
  it('o teto que a janela usa para marcar o dia é o mesmo do registrador', () => {
    expect(TETO_LINHAS_DIA_DA_JANELA).toBe(TETO_LINHAS_DIA)
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
      after_data: { site_id: 'site-1', key_id: 'key-1', key_name: 'forja (fila)', rota: '/api/pipeline/items/[id]', metodo: 'GET', tem_read: false },
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
    expect(banco.linhas.map(l => l.after_data.rota)).toEqual(['/api/pipeline/items/[id]', '/api/pipeline/stats'])
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
    expect(banco.linhas[0]).toMatchObject({ action: ACAO_RECUSA, site_id: null, after_data: { key_id: 'key-1', rota: '/api/pipeline/items/[id]', tem_read: false } })
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
    const doErro = () => vi.mocked(Sentry.captureException).mock.calls.filter(c => !/disjuntor/i.test(String((c[0] as Error).message))).length
    for (let i = 0; i < 5; i++) await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(doErro()).toBe(1)   // (o disjuntor abre na 3ª e tem o aviso dele; o erro em si sai uma vez)
    vi.setSystemTime(new Date(AGORA.getTime() + 61 * 60_000))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(doErro()).toBe(2)
  })
  // Onda 3, A (dados I-1a, software I3): a hora de silêncio não atravessa a meia-noite de São Paulo.
  it('a primeira falha de cada dia de São Paulo sempre avisa: 23:50 e 00:05 são dois avisos, não um', async () => {
    banco.erroInsert = { code: '42501', message: 'recusado' }
    const doErro = () => vi.mocked(Sentry.captureException).mock.calls.filter(c => !/disjuntor/i.test(String((c[0] as Error).message))).length
    vi.setSystemTime(new Date('2026-10-14T02:50:00.000Z'))   // 23:50 de 13/10 em São Paulo
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(doErro()).toBe(1)
    vi.setSystemTime(new Date('2026-10-14T03:05:00.000Z'))   // 00:05 de 14/10: 15 minutos depois, outro dia
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(doErro()).toBe(2)
    vi.setSystemTime(new Date('2026-10-14T03:20:00.000Z'))   // ainda 14/10, dentro da hora: calado
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    expect(doErro()).toBe(2)
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

const ID2 = '99999999-8888-4777-8666-555555555555'
describe('registrarLeitura: modo reduzido agrupa por padrão de rota (M3)', () => {
  it('15º dia: dois uuids diferentes na mesma rota gravam UMA linha, com o padrão no campo rota', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido(`/api/pipeline/items/${ID}/sections/roteiro`), chave(['read']), 'aviso')
    await registrarLeitura(pedido(`/api/pipeline/items/${ID2}/sections/roteiro`), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
    expect(banco.linhas[0]!.after_data.rota).toBe('/api/pipeline/items/[id]/sections/[section]')
  })
  it('slug (segmento que não é uuid nem número) também agrupa: dois códigos de tópico, uma linha', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido('/api/pipeline/topics/abc'), chave(['read']), 'aviso')
    await registrarLeitura(pedido('/api/pipeline/topics/xyz'), chave(['read']), 'aviso')
    expect(banco.linhas).toHaveLength(1)
    expect(JSON.stringify(banco.linhas)).not.toContain('texto-secreto')
  })
})

describe('registrarLeitura: disjuntor (M1)', () => {
  const falhar = async (n: number) => { for (let i = 0; i < n; i++) await registrarLeitura(pedido(), chave(['read']), 'aviso') }
  it('fecha -> abre após N falhas seguidas -> não toca o banco durante a pausa -> meio-aberto -> fecha no sucesso', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    expect(banco.selects).toBeGreaterThan(0)
    const antes = banco.selects
    // aberto: nem consulta, nem insert
    banco.erroInsert = null
    await falhar(3)
    expect(banco.linhas).toHaveLength(0)
    expect(banco.selects).toBe(antes)
    // passada a pausa: uma tentativa (meio-aberto); com o banco de volta, grava e fecha
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    await falhar(1)
    expect(banco.linhas).toHaveLength(1)
    await falhar(2)
    expect(banco.linhas).toHaveLength(3)
  })
  it('meio-aberto que falha reabre na hora; o intervalo recomeça', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    await falhar(1)   // tentativa, falha
    banco.erroInsert = null
    await falhar(2)   // aberto de novo: não grava
    expect(banco.linhas).toHaveLength(0)
  })
  it('um sucesso zera a contagem: N-1 falhas, um sucesso, N-1 falhas e outro sucesso não abrem', async () => {
    for (let rodada = 0; rodada < 2; rodada++) {
      banco.erroInsert = { code: '08006', message: 'caiu' }
      await falhar(DISJUNTOR_FALHAS - 1)
      banco.erroInsert = null
      await falhar(1)
    }
    expect(banco.linhas).toHaveLength(2)
  })
  it('estouros de tempo seguidos também abrem: depois disso a leitura não espera nada', async () => {
    vi.useFakeTimers({ now: AGORA })
    banco.pendura = true
    for (let i = 0; i < DISJUNTOR_FALHAS; i++) {
      const p = registrarLeitura(pedido(), chave(['read']), 'aviso')
      await vi.advanceTimersByTimeAsync(TETO_REGISTRO_MS + 1)
      await p
    }
    let terminou = false
    void registrarLeitura(pedido(), chave(['read']), 'aviso').then(() => { terminou = true })
    await vi.advanceTimersByTimeAsync(0)   // sem avançar o relógio: se esperasse o teto, não teria terminado
    expect(terminou).toBe(true)
  })
  it('deixa rastro enquanto aberto: Sentry com tipo gravacao (o que marca o dia como não medido), no máximo uma por hora', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    await falhar(20)   // aberto: nenhuma enxurrada
    const chamadas = vi.mocked(Sentry.captureException).mock.calls
    expect(chamadas.length).toBeLessThanOrEqual(2)   // a falha em si + o aviso de disjuntor aberto
    for (const c of chamadas) expect(c[1]).toMatchObject({ tags: { action: 'leitura_registro', tipo: 'gravacao' } })
    expect(chamadas.some(c => /disjuntor/i.test(String((c[0] as Error).message)))).toBe(true)
  })
  // Onda 3, F (software M1): a trava do meio-aberto. Duas leituras simultâneas não podem as duas tentar gravar.
  it('meio-aberto com o banco pendurado: duas leituras ao mesmo tempo, UMA só ida ao banco', async () => {
    vi.useFakeTimers({ now: AGORA })
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    banco.erroInsert = null
    banco.pendura = true
    const idasAntes = banco.sinais.length   // cada ida ao banco leva um AbortSignal
    const a = registrarLeitura(pedido(), chave(['read']), 'aviso')
    const b = registrarLeitura(pedido('/api/pipeline/stats'), chave(['read']), 'aviso')
    await vi.advanceTimersByTimeAsync(0)
    expect(banco.sinais.length - idasAntes).toBe(1)
    await vi.advanceTimersByTimeAsync(TETO_REGISTRO_MS + 1)
    await Promise.all([a, b])
  })
  // Onda 3, F (software M2): o aviso de dentro do disjuntor aberto tem de existir por si, não só o da abertura.
  it('leitura pulada durante o meio-aberto (a hora do aviso da abertura já passou) deixa o aviso na hora, antes de a tentativa terminar', async () => {
    vi.useFakeTimers({ now: AGORA })
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    vi.setSystemTime(new Date(AGORA.getTime() + 61 * 60_000))   // 61 min depois: o limite de 1 por hora liberou
    banco.erroInsert = null
    banco.pendura = true
    const antes = vi.mocked(Sentry.captureException).mock.calls.length
    const a = registrarLeitura(pedido(), chave(['read']), 'aviso')   // a tentativa do meio-aberto, pendurada
    const b = registrarLeitura(pedido(), chave(['read']), 'aviso')   // pulada: tem de avisar agora
    await vi.advanceTimersByTimeAsync(0)
    const novas = vi.mocked(Sentry.captureException).mock.calls.slice(antes)
    expect(novas).toHaveLength(1)
    expect(String((novas[0]![0] as Error).message)).toMatch(/disjuntor.*aberto/i)
    expect(novas[0]![1]).toMatchObject({ tags: { action: 'leitura_registro', tipo: 'gravacao' } })
    await vi.advanceTimersByTimeAsync(TETO_REGISTRO_MS + 1)
    await Promise.all([a, b])
  })
  // Onda 3, F (software M2): reescrito. O antigo chamava montarJanela([]) e passava com ou sem disjuntor.
  it('um dia inteiro de disjuntor aberto NÃO é dia medido: o dia sai das linhas do banco simulado, e a leitura perdida vai na linha seguinte', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    banco.erroInsert = null
    await falhar(50)   // o banco já voltou, mas o disjuntor segue aberto: nada gravado
    expect(banco.linhas).toHaveLength(0)
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    await falhar(1)   // meio-aberto: grava e fecha, levando o buraco no dado
    expect(banco.linhas).toHaveLength(1)
    const linha = banco.linhas[0]!
    expect(linha.after_data).toMatchObject({ perdidas: DISJUNTOR_FALHAS + 50, perdidas_desde: AGORA.toISOString() })
    const dia = diaSP(AGORA)
    const porDia = new Map<string, { dia_sp: string; controle: number; sem_read: number; perdidas: number }>()
    for (const l of banco.linhas) {
      const d = diaSP(new Date(l.created_at))
      const atual = porDia.get(d) ?? { dia_sp: d, controle: 0, sem_read: 0, perdidas: 0 }
      if (l.after_data.tem_read === true) atual.controle++
      else atual.sem_read++
      atual.perdidas += Number(l.after_data.perdidas ?? 0)
      porDia.set(d, atual)
    }
    expect(porDia.get(dia)!.controle).toBe(1)   // o dia TEM linha de controle, e mesmo assim:
    const j = montarJanela([...porDia.values()], { desde: '2026-10-13', hoje: '2026-10-15' })
    expect(j.dias.find(d => d.dia === dia)).toMatchObject({ estado: 'nao_medido', motivo: 'leituras_perdidas' })
  })
})

// Onda 3, B (dados I-1b): o buraco do disjuntor visível NO DADO. Estado em memória por instância.
describe('registrarLeitura: leituras perdidas ficam no dado', () => {
  const falhar = async (n: number) => { for (let i = 0; i < n; i++) await registrarLeitura(pedido(), chave(['read']), 'aviso') }
  it('conta as que passaram sem registro (as que falharam e as puladas pelo disjuntor), leva na PRÓXIMA linha gravada e zera depois', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)   // 3 falhas: 3 perdidas, disjuntor aberto
    banco.erroInsert = null
    await falhar(4)                  // puladas: +4
    expect(banco.linhas).toHaveLength(0)
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    await falhar(2)                  // a 1ª grava (leva o buraco), a 2ª é normal
    expect(banco.linhas).toHaveLength(2)
    expect(banco.linhas[0]!.after_data).toMatchObject({ perdidas: DISJUNTOR_FALHAS + 4, perdidas_desde: AGORA.toISOString() })
    expect(banco.linhas[1]!.after_data).not.toHaveProperty('perdidas')
    expect(banco.linhas[1]!.after_data).not.toHaveProperty('perdidas_desde')
  })
  it('a contagem só zera depois da gravação aceita: gravação que falha leva as perdidas adiante, e a falha entra na conta', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    await falhar(1)                  // meio-aberto falha: +1 (4 no total), reabre
    banco.erroInsert = null
    vi.setSystemTime(new Date(AGORA.getTime() + 2 * DISJUNTOR_PAUSA_MS + 2))
    await falhar(1)
    expect(banco.linhas[0]!.after_data).toMatchObject({ perdidas: DISJUNTOR_FALHAS + 1, perdidas_desde: AGORA.toISOString() })
  })
  it('um buraco novo depois do zero tem o seu próprio instante de início', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(1)
    banco.erroInsert = null
    const depois = new Date(AGORA.getTime() + 10 * 60_000)
    vi.setSystemTime(depois)
    await falhar(1)
    expect(banco.linhas[0]!.after_data).toMatchObject({ perdidas: 1, perdidas_desde: AGORA.toISOString() })
    banco.erroInsert = { code: '08006', message: 'caiu' }
    const outro = new Date(AGORA.getTime() + 20 * 60_000)
    vi.setSystemTime(outro)
    await falhar(1)
    banco.erroInsert = null
    vi.setSystemTime(new Date(AGORA.getTime() + 30 * 60_000))
    await falhar(1)
    expect(banco.linhas[1]!.after_data).toMatchObject({ perdidas: 1, perdidas_desde: outro.toISOString() })
  })
  it('sessão de usuário não conta como perdida (não é leitura por chave)', async () => {
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await falhar(DISJUNTOR_FALHAS)
    for (let i = 0; i < 5; i++) await registrarLeitura(pedido(), { siteId: 'site-1', permissions: ['read'], source: 'session' }, 'aviso')
    banco.erroInsert = null
    vi.setSystemTime(new Date(AGORA.getTime() + DISJUNTOR_PAUSA_MS + 1))
    await falhar(1)
    expect(banco.linhas[0]!.after_data).toMatchObject({ perdidas: DISJUNTOR_FALHAS })
  })
  it('modo reduzido: a linha com o buraco é gravada mesmo com a marca do dia já vista', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))   // 15º dia: reduzido
    await falhar(1)                  // grava e marca (chave, rota, método)
    banco.erroInsert = { code: '08006', message: 'caiu' }
    await registrarLeitura(pedido('/api/pipeline/stats'), chave(['read']), 'aviso')   // perde uma
    banco.erroInsert = null
    await falhar(1)                  // mesma marca já vista: sem o buraco não gravaria
    expect(banco.linhas).toHaveLength(2)
    expect(banco.linhas[1]!.after_data).toMatchObject({ perdidas: 1 })
  })
})

// Onda 3, F (dados M-1)
describe('registrarLeitura: duplicata do modo reduzido respeita tem_read', () => {
  it('chave que perde o read no meio do dia: a linha tem_read = false do dia é gravada mesmo com a tem_read = true já lá', async () => {
    vi.setSystemTime(new Date('2026-10-27T15:00:00.000Z'))
    await registrarLeitura(pedido(), chave(['read']), 'aviso')
    zerarEstadoDoRegistro()   // outra instância: só o banco sabe da linha de hoje
    await registrarLeitura(pedido(), chave(['intelligence']), 'aviso')
    expect(banco.linhas.map(l => l.after_data.tem_read)).toEqual([true, false])
  })
})
