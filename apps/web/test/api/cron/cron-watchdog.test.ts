// @vitest-environment node
/**
 * Tests for GET/POST /api/cron/cron-watchdog — a perna de dentro da Vercel do
 * dead-man-switch de crons.
 *
 * Por que ela existe: até 2026-09-18 a classe "um cron parou de rodar" era
 * detectada só pelo `.github/workflows/health-watch.yml`, e o agendador do
 * GitHub não cumpre o horário — 40 execuções agendadas medidas deram intervalo
 * mediano de 204 min contra os 15 min do `cron:`. Um cron morto ficava
 * invisível por 2 a 6 h.
 *
 * O que estes testes fixam, em ordem de importância:
 *   - a regra de `unknown` (cron que nunca rodou NÃO dispara alarme, senão o
 *     canal berra desde o dia 1 e é ignorado na semana 2);
 *   - `late` em cron `critical` => `down` e prioridade urgent;
 *   - o alerta detectado cujo push não saiu FALHA o run, em vez de registrar
 *     verde — o modo de falha que este projeto existe para eliminar;
 *   - a consulta quebrada falha o run em vez de declarar saúde sem ter olhado.
 *
 * Mock puro (sem banco), no mesmo molde de uptime-probe.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { GET } from '../../../src/app/api/cron/cron-watchdog/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

interface IRow {
  cron_name: string
  last_success_at: string | null
  last_failure_at: string | null
  last_error: string | null
  consecutive_failures: number
  severity: string
}

const DIAS_ATRAS = new Date(Date.now() - 30 * 864e5).toISOString()

function row(over: Partial<IRow> & { cron_name: string }): IRow {
  return {
    last_success_at: DIAS_ATRAS,
    last_failure_at: null,
    last_error: null,
    consecutive_failures: 0,
    severity: 'info',
    ...over,
  }
}

function makeSupabase(rows: IRow[], opts: { selectError?: string; claim?: boolean } = {}) {
  const from = vi.fn((table: string) => {
    if (table !== 'cron_health') return {}
    // `select` é aguardado direto pela rota E encadeado com .eq().single()
    // por recordCronSuccess/recordCronFailure — precisa servir as duas formas.
    const select = vi.fn(() => {
      const payload = opts.selectError
        ? { data: null, error: { message: opts.selectError } }
        : { data: rows, error: null }
      const thenable = Promise.resolve(payload) as Promise<typeof payload> & { eq: unknown }
      thenable.eq = vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { consecutive_failures: 0 } })),
      }))
      return thenable
    })
    return {
      select,
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    }
  })
  const rpc = vi.fn(() => Promise.resolve({ data: opts.claim ?? true, error: null }))
  return { from, rpc }
}

function req() {
  return new Request('http://localhost/api/cron/cron-watchdog', {
    method: 'GET',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

function mockNtfy(status: number | Error) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fn = vi.fn((url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    if (status instanceof Error) return Promise.reject(status)
    return Promise.resolve(new Response(null, { status }))
  })
  return { fn, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', CRON_SECRET)
  vi.stubEnv('NTFY_URL', 'https://ntfy.example/topico')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/cron/cron-watchdog', () => {
  it('sem Authorization devolve 401 e não toca no banco', async () => {
    const sb = makeSupabase([])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as never)
    const res = await GET(new Request('http://localhost/api/cron/cron-watchdog'))
    expect(res.status).toBe(401)
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('nenhuma linha em cron_health => tudo unknown => ok e NENHUM push', async () => {
    // A regra de `unknown` é o que impede o alarme permanente: um cron
    // agendado que nunca rodou é AUSÊNCIA de informação, não evidência de
    // falha. Sem isto o canal berraria desde o primeiro deploy.
    const ntfy = mockNtfy(200)
    vi.stubGlobal('fetch', ntfy.fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(makeSupabase([]) as never)

    const body = (await (await GET(req())).json()) as Record<string, unknown>
    expect(body.status).toBe('ok')
    expect(body.alerted).toBe(false)
    expect(ntfy.calls).toHaveLength(0)
  })

  it('cron info atrasado => degraded, push high nomeando o cron', async () => {
    const ntfy = mockNtfy(200)
    vi.stubGlobal('fetch', ntfy.fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([row({ cron_name: 'publish-scheduled' })]) as never,
    )

    const body = (await (await GET(req())).json()) as Record<string, unknown>
    expect(body.status).toBe('degraded')
    expect(body.lateNames).toEqual(['publish-scheduled'])
    expect(ntfy.calls).toHaveLength(1)
    const headers = ntfy.calls[0]?.init.headers as Record<string, string>
    expect(headers.Priority).toBe('high')
    expect(String(ntfy.calls[0]?.init.body)).toContain('publish-scheduled')
  })

  it('cron critical atrasado => down e prioridade urgent', async () => {
    const ntfy = mockNtfy(200)
    vi.stubGlobal('fetch', ntfy.fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([row({ cron_name: 'sync-youtube', severity: 'critical' })]) as never,
    )

    const body = (await (await GET(req())).json()) as Record<string, unknown>
    expect(body.status).toBe('down')
    const headers = ntfy.calls[0]?.init.headers as Record<string, string>
    expect(headers.Priority).toBe('urgent')
  })

  it('dentro da janela de dedupe não repete o push', async () => {
    const ntfy = mockNtfy(200)
    vi.stubGlobal('fetch', ntfy.fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([row({ cron_name: 'publish-scheduled' })], { claim: false }) as never,
    )

    const body = (await (await GET(req())).json()) as Record<string, unknown>
    expect(body.reason).toBe('deduped')
    expect(ntfy.calls).toHaveLength(0)
  })

  it('atraso DETECTADO com push recusado em definitivo FALHA o run', async () => {
    // Registrar verde aqui seria o pior dos mundos: o sistema sabia, o dono
    // não foi avisado, e o registro dizia que estava tudo bem.
    const ntfy = mockNtfy(403)
    vi.stubGlobal('fetch', ntfy.fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([row({ cron_name: 'publish-scheduled' })]) as never,
    )

    // `withCronLock` transforma o throw em 500 + recordCronFailure, que é o
    // ponto: a saúde DESTE cron cai, o `/api/health` enxerga no ciclo
    // seguinte e a perna do GitHub tem o que ver.
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect((await res.json()).status).toBe('error')
    expect(vi.mocked(Sentry.captureException).mock.calls.some(([e]) => /refused the push/.test(String((e as Error).message)))).toBe(true)
  })

  it('atraso DETECTADO sem NTFY_URL configurado também FALHA o run', async () => {
    vi.stubEnv('NTFY_URL', '')
    vi.stubGlobal('fetch', mockNtfy(200).fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([row({ cron_name: 'publish-scheduled' })]) as never,
    )

    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(Sentry.captureException).mock.calls.some(([e]) => /NTFY_URL unset/.test(String((e as Error).message)))).toBe(true)
  })

  it('recusa TRANSITÓRIA (429) não falha o run — o próximo ciclo tenta de novo', async () => {
    vi.stubGlobal('fetch', mockNtfy(429).fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([row({ cron_name: 'publish-scheduled' })]) as never,
    )

    const body = (await (await GET(req())).json()) as Record<string, unknown>
    expect(body.status).toBe('degraded')
    expect(body.alerted).toBe(false)
  })

  it('consulta a cron_health quebrada FALHA o run em vez de declarar saúde', async () => {
    vi.stubGlobal('fetch', mockNtfy(200).fn)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(
      makeSupabase([], { selectError: 'connection reset' }) as never,
    )

    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(Sentry.captureException).mock.calls.some(([e]) => /cron_health query failed/.test(String((e as Error).message)))).toBe(true)
  })
})
