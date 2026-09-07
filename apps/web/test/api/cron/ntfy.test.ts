// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { sendNtfyAlert, sendNtfyHeartbeat, isTerminalRefusal } from '@/lib/ops/ntfy'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NTFY_URL', 'https://ntfy.example/topico')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function ok(status = 200) {
  return Promise.resolve(new Response(null, { status }))
}

const BASE = { title: 'T', body: 'B', priority: 'default' as const }

describe('sendNtfyAlert — contrato do resultado', () => {
  it('sem NTFY_URL devolve { alerted:false, reason:"NTFY_URL unset" } e não chama fetch', async () => {
    vi.stubEnv('NTFY_URL', '')
    expect(await sendNtfyAlert(BASE)).toEqual({ alerted: false, reason: 'NTFY_URL unset' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('o campo é ntfyStatus, NUNCA status (uptime-probe espalha isso num objeto com `status`)', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    const r = await sendNtfyAlert(BASE)
    expect(r).toEqual({ alerted: true, ntfyStatus: 200 })
    expect(r).not.toHaveProperty('status')
  })

  it('alerted = res.ok — um 404 não é sucesso', async () => {
    fetchMock.mockReturnValueOnce(ok(404))
    expect(await sendNtfyAlert(BASE)).toMatchObject({ alerted: false, ntfyStatus: 404 })
  })

  it('nunca lança quando o fetch rejeita', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    const r = await sendNtfyAlert(BASE)
    expect(r.alerted).toBe(false)
    expect(r.alertError).toContain('network down')
  })
})

describe('sendNtfyAlert — headers', () => {
  it('mapeia title/priority/tags/click para Title/Priority/Tags/Click', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert({ ...BASE, tags: ['rotating_light'], click: 'https://x/cms/settings/instagram' })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const h = init.headers as Record<string, string>
    expect(h.Title).toBe('T')
    expect(h.Priority).toBe('default')
    expect(h.Tags).toBe('rotating_light')
    expect(h.Click).toBe('https://x/cms/settings/instagram')
    expect(init.body).toBe('B')
  })

  it('AbortSignal.timeout(4_000) por tentativa', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('sendNtfyAlert — credenciais na própria URL (MUST)', () => {
  it('extrai basic-auth do userinfo e manda no header, com a URL limpa', async () => {
    vi.stubEnv('NTFY_URL', 'https://u:p@ntfy.example/topico')
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('https://ntfy.example/topico')
    expect(String(url)).not.toContain('u:p@')
    const h = (init.headers as Record<string, string>)
    expect(h.Authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`)
  })

  it('sem userinfo NÃO manda header Authorization', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    const h = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(h.Authorization).toBeUndefined()
  })

  it('a URL com userinfo nunca aparece em nenhum argumento passado ao fetch', async () => {
    vi.stubEnv('NTFY_URL', 'https://u:p@ntfy.example/topico')
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('u:p@')
  })
})

describe('sendNtfyAlert — re-tentativa', () => {
  it('429 => 2 tentativas, resultado transitório', async () => {
    fetchMock.mockReturnValue(ok(429))
    const r = await sendNtfyAlert(BASE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(r.alerted).toBe(false)
    expect(isTerminalRefusal(r)).toBe(false)
  })

  it('503 => 2 tentativas, transitório', async () => {
    fetchMock.mockReturnValue(ok(503))
    const r = await sendNtfyAlert(BASE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(isTerminalRefusal(r)).toBe(false)
  })

  it('403 => 1 tentativa, TERMINAL', async () => {
    fetchMock.mockReturnValue(ok(403))
    const r = await sendNtfyAlert(BASE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(isTerminalRefusal(r)).toBe(true)
  })

  it('401 e 404 também são terminais', async () => {
    for (const status of [401, 404]) {
      fetchMock.mockClear()
      fetchMock.mockReturnValue(ok(status))
      expect(isTerminalRefusal(await sendNtfyAlert(BASE)), String(status)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  })

  it('sucesso na 2ª tentativa devolve alerted:true', async () => {
    fetchMock.mockReturnValueOnce(ok(429)).mockReturnValueOnce(ok(200))
    expect(await sendNtfyAlert(BASE)).toMatchObject({ alerted: true, ntfyStatus: 200 })
  })
})

describe('sendNtfyHeartbeat', () => {
  it('priority low, tag white_check_mark e SEM Click', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyHeartbeat()
    const h = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(h.Priority).toBe('low')
    expect(h.Tags).toBe('white_check_mark')
    expect(h.Click).toBeUndefined()
  })
})
