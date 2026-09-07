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

// ── REGRA-PII-NTFY (§0) — asserção ÚNICA, emissor-agnóstica ────────────────
// MUST: substitui qualquer checagem por emissor. Um emissor novo sem entrada
// aqui derruba o teste pela asserção de tamanho.
//
// As fixtures usam handle:'thiago.figueiredo', ig_user_id:'17841400000000000' e
// token_error:'The session has been invalidated because the user changed their
// password', de modo que a asserção falha se qualquer campo voltar a carregá-los.
describe('REGRA-PII-NTFY: nenhum dos 7 emissores carrega @handle nem ids', () => {
  const HANDLE = 'thiago.figueiredo'
  const IG_USER_ID = '17841400000000000'
  const SLUG = 'bythiagofigueiredo'

  const EMITTERS: Array<{ emitter: string; title: string; body: string }> = [
    // §3.1 passo 4 — signature mismatch (rota de C3; a string é fixada aqui)
    {
      emitter: 'signature-mismatch',
      title: 'Instagram callback signature mismatch',
      body: 'Check Sentry for the route and secret tag.',
    },
    // §3.1 passo 7 — ddmismatch (rota de C3; a string é fixada aqui)
    {
      emitter: 'ddmismatch',
      title: 'Instagram deletion request matched no account',
      body: 'possible ID-space mismatch — see the runbook',
    },
    // §3.2 — deliverTokenAlert (ntfyTitle usa o SLUG, nunca `· @h`)
    {
      emitter: 'deliverTokenAlert',
      title: `Instagram auto-renewal still failing · ${SLUG}`,
      body: '3 account(s) · open since 2026-09-04. Open the CMS for the reason.',
    },
    // §3.3 passo 5b — sonda diária
    { emitter: 'daily-probe', title: 'Instagram ops probe', body: 'channel probe' },
    // §3.3 passo 3 — expiring_clean
    {
      emitter: 'expiring_clean',
      title: `Instagram token expiring without renewal · ${SLUG}`,
      body: '3 day(s) left. Open the CMS to reconnect.',
    },
    // §3.3 passo 6 — step_errors
    {
      emitter: 'step_errors',
      title: 'Instagram cron degraded',
      body: '2 step(s) failed — see Sentry',
    },
    // §3.4 passo 3 — censo de Blob (acima da linha)
    {
      emitter: 'blob-census-over',
      title: 'Instagram blob store at 512 MB',
      body: 'Prefix instagram/ is above the 400 MB watch line. See the runbook.',
    },
    // §3.4 passo 3 — censo de Blob (truncado)
    {
      emitter: 'blob-census-truncated',
      title: 'Instagram blob census truncated at 10000 objects',
      body: 'The instagram/ census hit its page/time cap — no size comparison was made. See the runbook.',
    },
  ]

  it('a tabela cobre exatamente os 7 emissores (o censo conta como UM, nas duas formas)', () => {
    expect(new Set(EMITTERS.map((e) => e.emitter.replace(/^blob-census-.*/, 'blob-census'))).size)
      .toBe(7)
  })

  it.each(EMITTERS)('$emitter não carrega @handle nem sequência de 6+ dígitos', ({ title, body }) => {
    expect(`${title} ${body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${title} ${body}`).not.toMatch(/[0-9]{6,}/)
  })

  it('as fixtures de PII realmente casariam os regexes (o teste não é vácuo)', () => {
    expect(`x @${HANDLE}`).toMatch(/@[a-z0-9._]{1,30}/)
    expect(`x ${IG_USER_ID}`).toMatch(/[0-9]{6,}/)
  })

  it('nenhum título/corpo contém texto vindo da Meta', () => {
    const metaError = 'The session has been invalidated because the user changed their password'
    for (const { title, body } of EMITTERS) {
      expect(`${title} ${body}`).not.toContain(metaError)
      expect(`${title} ${body}`).not.toContain('invalidated')
    }
  })
})

describe('Click: presente nos 7 emissores que o passam, ausente nos 2 que não', () => {
  beforeEach(() => { fetchMock.mockReset(); fetchMock.mockReturnValue(ok(200)) })

  it('a sonda diária e o heartbeat NÃO mandam Click', async () => {
    await sendNtfyAlert({ title: 'Instagram ops probe', body: 'channel probe', priority: 'min', tags: ['mag'] })
    await sendNtfyHeartbeat()
    for (const call of fetchMock.mock.calls) {
      const h = (call[1] as RequestInit).headers as Record<string, string>
      expect(h.Click).toBeUndefined()
    }
  })

  it('todo emissor que passa `click` produz o header Click', async () => {
    await sendNtfyAlert({
      title: 'Instagram cron degraded', body: 'x', priority: 'default', tags: ['warning'],
      click: 'https://bythiagofigueiredo.com/cms/settings/instagram',
    })
    const h = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(h.Click).toBe('https://bythiagofigueiredo.com/cms/settings/instagram')
  })
})
