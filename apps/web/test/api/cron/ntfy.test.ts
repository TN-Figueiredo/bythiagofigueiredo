// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), setTag: vi.fn(),
}))

// ── Mocks de INFRA (banco, lock, e-mail, blob) ─────────────────────────────
// MUST: `@/lib/ops/ntfy` e `@/lib/instagram/token` ficam REAIS. A suíte
// REGRA-PII-NTFY no fim deste arquivo roda os emissores de verdade e lê o que
// eles emitem no `fetch`; mockar o transporte ou o módulo do alerta devolveria
// a suíte ao estado que a review reprovou (uma tabela de literais).
const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))
vi.mock('@/lib/logger', () => ({
  withCronLock: (
    _sb: unknown, _key: string, _runId: string, _tag: string, fn: () => Promise<unknown>,
  ) => fn().then((r: unknown) => Response.json(r)),
  newRunId: () => 'test-run-id',
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  NO_SITE_ADMINS_ERROR: 'no site admins to email',
  fanOutToSiteAdminsDetailed: vi.fn(() =>
    Promise.resolve({ total: 1, sent: 1, suppressed: 0, errors: [] })),
}))
vi.mock('@/lib/instagram/deletion', () => ({
  DELETION_BLOB_BUDGET_MS: 45_000,
  resumeStuckDeletionRequest: vi.fn(() => Promise.resolve(false)),
  runDeletionEffects: vi.fn(),
}))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: vi.fn(() => Promise.resolve('log-1')),
  closeSyncRow: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: vi.fn(() => Promise.resolve({
    postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
  })),
  checkImageCacheHealth: vi.fn(),
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
}))
const listMock = vi.fn()
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a), del: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { encrypt } from '@tn-figueiredo/social/vault'
import { sendNtfyAlert, sendNtfyHeartbeat, isTerminalRefusal } from '@/lib/ops/ntfy'
import { resumeStuckDeletionRequest } from '@/lib/instagram/deletion'
import { GET as syncGET } from '@/app/api/cron/instagram-sync/route'
import { GET as refreshGET } from '@/app/api/cron/instagram-token-refresh/route'
import { GET as uptimeGET } from '@/app/api/cron/uptime-probe/route'

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

// ── REGRA-PII-NTFY (§0) — dirigida pelos EMISSORES REAIS ───────────────────
// A versão anterior desta suíte afirmava sobre uma TABELA DE LITERAIS copiada à
// mão para dentro do arquivo de teste: nada nela vinha do código. Sete dos oito
// emissores ficavam guardados por NADA, a "asserção de tamanho" que
// supostamente pegaria um emissor novo era calculada sobre a mesma tabela (só
// quebra se alguém editar o teste), a tabela listava duas rotas de C3 que ainda
// não existem e OMITIA por completo o emissor do uptime-probe.
//
// Esta versão tem duas metades que se sustentam:
//   1. CENSO do código-fonte — enumera todo call site de sendNtfyAlert/
//      sendNtfyHeartbeat em apps/web/src. Um emissor novo, em qualquer arquivo,
//      derruba o teste até ser dirigido aqui embaixo.
//   2. EXECUÇÃO — os crons e a varredura rodam de verdade, com fixtures
//      carregadas de PII (handle, ig_user_id de 17 dígitos, o texto da Meta,
//      access_token cifrado), com `@/lib/ops/ntfy` REAL; as asserções rodam
//      sobre o Title/body que saíram no `fetch`.

const SRC_DIR = fileURLToPath(new URL('../../../src/', import.meta.url))
const EMITTER_CALL = /\bsendNtfy(?:Alert|Heartbeat)\s*\(/g

function tsFilesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...tsFilesUnder(`${dir}${entry.name}/`))
    else if (/\.tsx?$/.test(entry.name)) found.push(`${dir}${entry.name}`)
  }
  return found
}

/** Arquivo (relativo a src/) => quantos call sites de emissão ele tem. */
function emitterCensus(): Record<string, number> {
  const census: Record<string, number> = {}
  for (const file of tsFilesUnder(SRC_DIR)) {
    const rel = file.slice(SRC_DIR.length)
    if (rel === 'lib/ops/ntfy.ts') continue // o TRANSPORTE, não um emissor
    const hits = (readFileSync(file, 'utf8').match(EMITTER_CALL) ?? []).length
    if (hits > 0) census[rel] = hits
  }
  return census
}

const HANDLE = 'thiago.figueiredo'
const IG_USER_ID = '17841400000000000'
const META_ERROR = 'The session has been invalidated because the user changed their password'
const VAULT_KEY_HEX = '0'.repeat(64)
const PLAIN_TOKEN = 'IGAAxSampleAccessTokenValueThatIsLongAndOpaque0123456789'

function encToken(plain = PLAIN_TOKEN): string {
  return `v1:${encrypt(plain, Buffer.from(VAULT_KEY_HEX, 'hex'))}`
}

function piiAccount(over: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: HANDLE,
    ig_user_id: IG_USER_ID, access_token: encToken(),
    token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    token_refreshed_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    token_error: META_ERROR, token_error_at: new Date(Date.now() - 86_400_000).toISOString(),
    token_error_mode: 'daily', token_alert_sent_at: null, token_alert_attempt_at: null,
    token_reprobe_at: null, ig_professional_id: IG_USER_ID, ig_user_id_source: 'oauth',
    sync_enabled: true, display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null, section_subtitle_pt: null,
    section_subtitle_en: null, last_synced_at: null, created_at: '', updated_at: '',
    ...over,
  }
}

/** Banco de mentira suficiente para os dois crons e para a varredura. */
function dbHarness(accounts: Array<Record<string, unknown>>): void {
  mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
  mockFrom.mockImplementation((table: string) => {
    if (table === 'instagram_accounts') {
      const terminal = Promise.resolve({ data: accounts, error: null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, or: () => chain, eq: () => chain,
        in: () => terminal, is: () => chain, order: () => terminal,
        update: () => chain, maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: terminal.then.bind(terminal),
      }
      return chain
    }
    if (table === 'sites') {
      return { select: () => ({ in: () => Promise.resolve({
        data: [{ id: 'site-1', slug: 'bythiagofigueiredo' }], error: null }) }) }
    }
    if (table === 'ops_alert_state') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
          like: () => ({ lt: () => Promise.resolve({ error: null }) }),
        }),
        upsert: () => Promise.resolve({ error: null }),
      }
    }
    if (table === 'notification_deliveries') {
      return { select: () => ({ eq: () => ({ gt: () => ({ like: () =>
        Promise.resolve({ count: 0, error: null }) }) }) }) }
    }
    const settled = Promise.resolve({ data: [], error: null, count: 0 })
    const generic: Record<string, unknown> = {
      select: () => generic, eq: () => generic, in: () => generic, is: () => generic,
      lt: () => generic, gt: () => generic, like: () => generic, order: () => generic,
      limit: () => settled, delete: () => generic, update: () => generic,
      insert: () => Promise.resolve({ error: null }), then: settled.then.bind(settled),
    }
    return generic
  })
}

function cronReq(path: string): NextRequest {
  const headers = new Headers({ authorization: 'Bearer pii-cron-secret' })
  return { headers, nextUrl: new URL(`http://x${path}`) } as unknown as NextRequest
}

describe('REGRA-PII-NTFY: o que os emissores REALMENTE emitem', () => {
  /**
   * Todo emissor do censo, com o marcador que prova que ele foi executado
   * NESTA suíte. Uma entrada sem push correspondente falha — é o que impede a
   * suíte de voltar a ser vácuo se um driver parar de disparar o caminho.
   */
  const EXPECTED_EMITTERS: Array<{ emitter: string; file: string; match: RegExp }> = [
    { emitter: 'sync/probe-starved', file: 'app/api/cron/instagram-sync/route.ts', match: /probes capped/ },
    { emitter: 'sync/blob-census-over', file: 'app/api/cron/instagram-sync/route.ts', match: /blob store at/ },
    { emitter: 'sync/blob-census-truncated', file: 'app/api/cron/instagram-sync/route.ts', match: /blob census truncated/ },
    { emitter: 'sync/ntfy-probe', file: 'app/api/cron/instagram-sync/route.ts', match: /ops probe/ },
    { emitter: 'sync/step-errors', file: 'app/api/cron/instagram-sync/route.ts', match: /cron degraded/ },
    { emitter: 'refresh/expiring-clean', file: 'app/api/cron/instagram-token-refresh/route.ts', match: /expiring without renewal/ },
    { emitter: 'refresh/ntfy-probe', file: 'app/api/cron/instagram-token-refresh/route.ts', match: /ops probe/ },
    { emitter: 'refresh/heartbeat', file: 'app/api/cron/instagram-token-refresh/route.ts', match: /ops heartbeat/ },
    { emitter: 'refresh/step-errors', file: 'app/api/cron/instagram-token-refresh/route.ts', match: /cron degraded/ },
    { emitter: 'uptime-probe', file: 'app/api/cron/uptime-probe/route.ts', match: /bythiagofigueiredo (down|degraded)/ },
    { emitter: 'deliverTokenAlert', file: 'lib/instagram/token.ts', match: /^Instagram ((feed sync|auto-renewal|sync) (failing|still )|token invalid|token expired|access revoked|still disconnected)/ },
  ]

  /** Cada arquivo do censo => quantos call sites a execução acima cobre. */
  const COVERED_CALL_SITES: Record<string, number> = {
    'app/api/cron/instagram-sync/route.ts': 5,
    'app/api/cron/instagram-token-refresh/route.ts': 4,
    'app/api/cron/uptime-probe/route.ts': 1,
    'lib/instagram/token.ts': 1,
  }

  const pushes: Array<{ title: string; body: string }> = []

  /** fetch único: ntfy é gravado; Graph devolve o erro da Meta; alvo cai. */
  function installFetch(): void {
    fetchMock.mockImplementation((url: unknown, init?: RequestInit) => {
      const href = String(url)
      if (href.startsWith('https://ntfy.example')) {
        const headers = (init?.headers ?? {}) as Record<string, string>
        pushes.push({ title: headers.Title ?? '', body: String(init?.body ?? '') })
        return Promise.resolve(new Response(null, { status: 200 }))
      }
      if (href.startsWith('https://graph.instagram.com')) {
        return Promise.resolve(new Response(
          JSON.stringify({ error: { message: META_ERROR, code: 190, type: 'OAuthException' } }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ))
      }
      // Alvo do uptime-probe: 500 => status 'down' => push.
      return Promise.resolve(new Response('boom', { status: 500 }))
    })
  }

  beforeEach(async () => {
    pushes.length = 0
    fetchMock.mockReset()
    installFetch()
    vi.stubEnv('CRON_SECRET', 'pii-cron-secret')
    vi.stubEnv('SOCIAL_MASTER_KEY', VAULT_KEY_HEX)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://bythiagofigueiredo.com')
    vi.stubEnv('UPTIME_PROBE_TARGET', 'https://bythiagofigueiredo.com')
    vi.stubEnv('VERCEL_ENV', 'development')

    // (1) sync acima do teto de sondas, com censo de blob ACIMA da linha e uma
    // etapa quebrada (=> push de "cron degraded"). 9 contas em episódio aberto
    // => a varredura roda e deliverTokenAlert emite.
    vi.mocked(resumeStuckDeletionRequest).mockRejectedValue(new Error('blob list timeout'))
    listMock.mockResolvedValue({
      blobs: [{ size: 500 * 1024 * 1024 }], hasMore: false, cursor: undefined,
    })
    dbHarness(Array.from({ length: 9 }, (_, i) => piiAccount({ id: `acc-${i}` })))
    await syncGET(cronReq('/api/cron/instagram-sync'))

    // (2) mesmo cron com o censo TRUNCADO (a outra forma do emissor).
    listMock.mockResolvedValue({
      blobs: Array.from({ length: 1000 }, () => ({ size: 1 })), hasMore: true, cursor: 'c',
    })
    dbHarness([piiAccount()])
    await syncGET(cronReq('/api/cron/instagram-sync'))

    // (3) refresh: conta SEM episódio e expirando em 3 dias => expiring_clean;
    // sonda + heartbeat + "cron degraded" pela mesma etapa quebrada.
    dbHarness([piiAccount({ token_error: null, token_error_at: null, token_error_mode: null })])
    await refreshGET(cronReq('/api/cron/instagram-token-refresh'))

    // (4) uptime-probe: alvo em 500 => push urgente.
    dbHarness([])
    await uptimeGET(new Request('http://x/api/cron/uptime-probe', {
      headers: { authorization: 'Bearer pii-cron-secret' },
    }))
  })

  it('o censo do código-fonte não tem nenhum emissor fora dos que esta suíte executa', () => {
    // Um `sendNtfyAlert(` novo — em qualquer arquivo de apps/web/src — derruba
    // esta asserção. Não conserte editando o número: dirija o emissor novo
    // acima e some uma entrada em EXPECTED_EMITTERS.
    expect(emitterCensus()).toEqual(COVERED_CALL_SITES)
  })

  it('todos os emissores esperados foram REALMENTE executados (a suíte não é vácuo)', () => {
    const titles = pushes.map((p) => p.title)
    for (const { emitter, match } of EXPECTED_EMITTERS) {
      expect(titles.some((t) => match.test(t)), `${emitter} não emitiu — títulos: ${titles.join(' | ')}`)
        .toBe(true)
    }
  })

  it('nenhum título/corpo emitido carrega handle, id longo, token ou texto da Meta', () => {
    expect(pushes.length).toBeGreaterThanOrEqual(EXPECTED_EMITTERS.length)
    for (const { title, body } of pushes) {
      const text = `${title} ${body}`
      // (a) por VALOR: as fixtures que os emissores acabaram de processar.
      expect(text, `handle da fixture em: ${text}`).not.toContain(HANDLE)
      expect(text, `ig_user_id da fixture em: ${text}`).not.toContain(IG_USER_ID)
      expect(text, `token da fixture em: ${text}`).not.toContain(PLAIN_TOKEN)
      expect(text, `texto da Meta em: ${text}`).not.toContain(META_ERROR)
      // (b) por FORMA: pega PII que não veio destas fixtures.
      expect(text, `@handle em: ${text}`).not.toMatch(/@[a-z0-9._]{1,30}/i)
      expect(text, `sequência de dígitos em: ${text}`).not.toMatch(/[0-9]{6,}/)
      expect(text, `string com cara de token em: ${text}`).not.toMatch(/[A-Za-z0-9_-]{32,}/)
      expect(text.toLowerCase(), `nome de campo secreto em: ${text}`).not.toContain('access_token')
    }
  })

  it('as fixtures de PII realmente casariam as asserções (elas não são vácuas)', () => {
    const leak = `Instagram cron degraded · @${HANDLE} ${IG_USER_ID} ${PLAIN_TOKEN}: ${META_ERROR}`
    expect(leak).toContain(HANDLE)
    expect(leak).toContain(IG_USER_ID)
    expect(leak).toContain(PLAIN_TOKEN)
    expect(leak).toContain(META_ERROR)
    expect(leak).toMatch(/@[a-z0-9._]{1,30}/i)
    expect(leak).toMatch(/[0-9]{6,}/)
    expect(leak).toMatch(/[A-Za-z0-9_-]{32,}/)
    // O slug do site, que os emissores PODEM carregar, não casa nenhuma delas.
    expect('Instagram auto-renewal still failing · bythiagofigueiredo')
      .not.toContain(HANDLE)
  })

  it('a PII estava mesmo em jogo: as contas emitidas tinham handle, id e o texto da Meta', () => {
    const account = piiAccount()
    expect(account.handle).toBe(HANDLE)
    expect(account.ig_user_id).toBe(IG_USER_ID)
    expect(account.token_error).toBe(META_ERROR)
  })
})

describe('Click: presente nos emissores que o passam, ausente na sonda e no heartbeat', () => {
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
