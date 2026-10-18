import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

process.env.CRON_SECRET = 'segredo-de-teste-123'

vi.mock('@supabase/supabase-js', () => { throw new Error('carregou') })

import * as rota from '../../../src/app/api/cron/watch-pv/route'
import { contarPagina, rodadaMista, IDS_RAJADA, VIDEO_PV } from '../../../src/app/api/cron/watch-pv/contar'
import { USER_AGENT_LEITOR, ACCEPT_LANGUAGE_LEITOR, urlWatch } from '../../../src/lib/youtube/watch/cabecalhos'
import { executarPv, VALIDA_ATE, LEITURAS_FASE2, type ExecutarDeps } from '../../../src/app/api/cron/watch-pv/executar'

const TIT_A = '5 - Como somos controlados - Consistência e Compromisso (Part 4)'
const TIT_B = 'Consistência e Compromisso (Part 4)'
const RENDERERS = '"videoPrimaryInfoRenderer" "playerOverlayVideoDetailsRenderer" "videoTitleHeaderViewModel"'
const CFG = '"HL":"pt","GL":"BR"'
const pagina = (t: string, extra = '') => `${RENDERERS} ${CFG} "text":"${t}" <meta property="og:title" content="x"> ${extra}`
const A = pagina(TIT_A)
const PAGINA_B = `${RENDERERS} ${CFG} "title":"${TIT_A}" "x":"${TIT_B}" <meta property="og:title" content="x">`

function req(auth: string | null, v: string | null): NextRequest {
  const url = new URL('https://x.test/api/cron/watch-pv' + (v === null ? '' : `?v=${v}`))
  return { headers: new Headers(auth ? { authorization: auth } : {}), nextUrl: url } as unknown as NextRequest
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('rota', () => {
  it('exporta maxDuration 300 e runtime nodejs', () => {
    expect(rota.maxDuration).toBe(300)
    expect(rota.runtime).toBe('nodejs')
  })
  it('401 sem Authorization', async () => {
    expect((await rota.GET(req(null, VIDEO_PV))).status).toBe(401)
  })
  it('401 com segredo errado do mesmo tamanho', async () => {
    const errado = 'Bearer ' + 'x'.repeat(process.env.CRON_SECRET!.length)
    expect((await rota.GET(req(errado, VIDEO_PV))).status).toBe(401)
  })
  it('segredo errado + v errado -> 401 (autenticação antes de v)', async () => {
    expect((await rota.GET(req('Bearer errado', 'x'))).status).toBe(401)
  })
  it('segredo certo + v=x -> 400 sem nenhum fetch; sem v -> 400', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const ok = `Bearer ${process.env.CRON_SECRET}`
    expect((await rota.GET(req(ok, 'x'))).status).toBe(400)
    expect((await rota.GET(req(ok, null))).status).toBe(400)
    expect(f).not.toHaveBeenCalled()
  })
  it('sem CRON_SECRET recusa e não faz fetch', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const guardado = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    try {
      const r = await rota.GET(req('Bearer undefined', VIDEO_PV))
      expect([401, 500]).toContain(r.status)
      expect(f).not.toHaveBeenCalled()
    } finally { process.env.CRON_SECRET = guardado }
  })
  it('depois de VALIDA_ATE devolve 410 sem fetch', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    vi.useFakeTimers(); vi.setSystemTime(VALIDA_ATE + 1000)
    const r = await rota.GET(req(`Bearer ${process.env.CRON_SECRET}`, VIDEO_PV))
    expect(r.status).toBe(410)
    expect(f).not.toHaveBeenCalled()
  })
})

describe('cabeçalhos do leitor', () => {
  it('literais fixos', () => {
    expect(USER_AGENT_LEITOR).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    expect(ACCEPT_LANGUAGE_LEITOR).toBe('pt-BR')
    expect(urlWatch('abc')).toBe('https://www.youtube.com/watch?v=abc&hl=pt-BR&gl=BR')
  })
})

describe('contarPagina', () => {
  it('página A', () => {
    const c = contarPagina(A, 200, null)
    expect(c).toMatchObject({ braco: 'A', renderers: 3, hl: 'pt', gl: 'BR', oficial: true, http: 200 })
  })
  it('página B', () => {
    expect(contarPagina(PAGINA_B, 200, null).braco).toBe('B')
  })
  it('consent.youtube.com -> consentimento', () => {
    expect(contarPagina('', 302, 'https://consent.youtube.com/x').consentimento).toBe(true)
    expect(contarPagina('<a href="https://consent.youtube.com/">', 200, null).consentimento).toBe(true)
  })
  it('sem renderers com "not a bot" (qualquer caixa/apóstrofo) -> roboSemTitulo', () => {
    const c = contarPagina('Please Confirm you’re NOT A BOT', 200, null)
    expect(c.roboSemTitulo).toBe(true)
  })
  it('LOGIN_REQUIRED com renderers -> jogadorBloqueado e não robô', () => {
    const c = contarPagina(A + ' "status":"LOGIN_REQUIRED" not a bot', 200, null)
    expect(c.jogadorBloqueado).toBe(true)
    expect(c.roboSemTitulo).toBe(false)
  })
  it('I2: sem renderers com o título A em videoDetails -> braço ?', () => {
    const html = `"videoDetails":{"videoId":"${VIDEO_PV}","title":"${TIT_A}"}`
    const c = contarPagina(html, 200, null)
    expect(c.renderers).toBe(0)
    expect(c.braco).toBe('?')
  })
  it('M4: "videoDetails":{} sem og:title -> oficial false; com videoId e title -> true', () => {
    expect(contarPagina('"videoDetails":{}', 200, null).oficial).toBe(false)
    expect(contarPagina(`"videoDetails":{"videoId":"${VIDEO_PV}","title":"T"}`, 200, null).oficial).toBe(true)
  })
  it('rodada mista', () => {
    expect(rodadaMista(['A', 'B', 'A'])).toBe(true)
    expect(rodadaMista(['A', 'A', 'A'])).toBe(false)
    expect(rodadaMista(['?', 'B', 'B'])).toBe(false)
    expect(rodadaMista(['A', '?', 'B'])).toBe(true)
  })
})

function relogio(msPorLeitura: number, corpo: (n: number) => string = () => A) {
  let t = Date.UTC(2026, 9, 20, 12, 22)
  let n = 0, emVoo = 0, maxVoo = 0
  const inicios: number[] = []
  const t0 = t
  const fake = (async () => {
    inicios.push(t - t0)
    n++; emVoo++; maxVoo = Math.max(maxVoo, emVoo)
    const html = corpo(n)
    t += msPorLeitura
    await Promise.resolve()
    emVoo--
    return new Response(html, { status: 200 })
  }) as unknown as typeof fetch
  const deps: ExecutarDeps = { fetch: fake, agora: () => t, dormir: async (ms) => { t += ms }, regiao: 'gru1' }
  return { deps, stats: () => ({ n, maxVoo, inicios }) }
}

describe('executarPv (relógio falso)', () => {
  it('caminho feliz: cortado null, 48 lidas, 30 leituras na fase 1, no máximo 3 em voo', async () => {
    const r = relogio(1000)
    const out = await executarPv(r.deps)
    expect(out.cortado).toBeNull()
    expect(out.fase2.lidas).toBe(LEITURAS_FASE2)
    expect(LEITURAS_FASE2).toBe(IDS_RAJADA.length * 3)
    expect(out.fase1.resumo.leituras).toBe(30)
    expect(r.stats().n).toBe(78)
    expect(r.stats().maxVoo).toBeLessThanOrEqual(3)
  })
  it('I1: fase 1 lenta (9 s por leitura) -> nenhuma rodada começa depois de 200 s', async () => {
    const r = relogio(9000)
    const out = await executarPv(r.deps)
    expect(out.cortado).not.toBeNull()
    for (const rod of out.fase1.rodadas) {
      const ini = Date.parse(rod.leituras[0]!.t) - Date.parse(out.inicio)
      expect(ini).toBeLessThan(200_000)
    }
    expect(out.fase1.rodadas.length).toBeLessThan(10)
  })
  it('I1: fase 2 com leituras de 10 s -> nenhuma começa depois de 270 s, cortado fase2, lidas < 48', async () => {
    const r = relogio(10_000)
    const out = await executarPv(r.deps)
    expect(out.cortado === 'fase1' || out.cortado === 'fase2').toBe(true)
    expect(out.fase2.lidas).toBeLessThan(48)
    expect(Math.max(...r.stats().inicios)).toBeLessThan(270_000)
  })
  it('M-T1-2: fase 1 cortada mantém cortado fase1', async () => {
    const out = await executarPv(relogio(9000).deps)
    expect(out.cortado).toBe('fase1')
  })
  it('fase 1 terminando em ~207 s ainda faz a fase 2 (começa entre 200 e 235 s)', async () => {
    const r = relogio(1400)
    const out = await executarPv(r.deps)
    expect(out.fase1.rodadas.length).toBe(10)
    expect(out.fase2.lidas).toBeGreaterThan(0)
    const ini = r.stats().inicios[30]!
    expect(ini).toBeGreaterThan(200_000)
    expect(ini).toBeLessThanOrEqual(235_000)
  })
  it('fase 2 iniciada depois de 200 s é cortada em 270 s', async () => {
    const r = relogio(1400, undefined)
    // leituras da fase 2 lentas: relógio avança 10 s só a partir da 31a leitura
    let n = 0
    const base = r.deps.fetch
    const deps = { ...r.deps, fetch: (async (...a: Parameters<typeof fetch>) => { n++; const res = await base(...a); if (n > 30) await r.deps.dormir(9000); return res }) as typeof fetch }
    const out = await executarPv(deps)
    expect(out.fase2.lidas).toBeGreaterThan(0)
    expect(out.cortado).toBe('fase2')
    expect(Math.max(...r.stats().inicios)).toBeLessThan(270_000)
  })
  it('braço ? para página sem renderers e rodada [?, B, B] não é mista; não importa nada de banco', async () => {
    const r = relogio(500, (n) => (n % 3 === 1 ? 'sem renderers' : PAGINA_B))
    const out = await executarPv(r.deps)
    expect(out.fase1.rodadas[0]!.leituras.map((l) => l.braco)).toEqual(['?', 'B', 'B'])
    expect(out.fase1.rodadas[0]!.mista).toBe(false)
  })
  it('leitura que falha vira http 0 com erro rede, sem derrubar a execução', async () => {
    const r = relogio(100)
    const deps = { ...r.deps, fetch: (async () => { throw new Error('boom') }) as unknown as typeof fetch }
    const out = await executarPv(deps)
    expect(out.fase1.rodadas[0]!.leituras[0]).toMatchObject({ http: 0, erro: 'rede' })
  })
})
