// @vitest-environment node
// Leitor da watch (A5 S4, Tarefa 6): A3.
import { describe, it, expect, vi } from 'vitest'

const defeito = vi.hoisted(() => ({ ligado: false }))
vi.mock('@/lib/youtube/watch/parser', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/watch/parser')>()
  return {
    ...m,
    // parser defeituoso simulado: devolve um idioma que o schema recusa (36 caracteres)
    extrairDaWatch: (html: string, id: string) => {
      const r = m.extrairDaWatch(html, id)
      return defeito.ligado ? { ...r, idioma: 'a'.repeat(36) } : r
    },
  }
})
import { lerWatchSemCookie, type OpcoesLeitor } from '@/lib/youtube/watch/leitor'
import { USER_AGENT_LEITOR, urlWatch } from '@/lib/youtube/watch/cabecalhos'
import { leituraWatchSchema } from '@/lib/youtube/teste-youtube'
import {
  PAGINA_A, PAGINA_B, semInitialData, corpoConsentimento, corpoRoboSemTitulo, jogadorBloqueadoDoVercel, layoutNovo,
} from '../../fixtures/watch-html/derivar'

const ID = 'qIg9a7vqcNo'
const UUID = '123e4567-e89b-42d3-a456-426614174000'
const base = (o: Partial<OpcoesLeitor> = {}): OpcoesLeitor => ({ rodadaId: UUID, origemRede: 'vercel', ...o })
const resp = (corpo: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(status >= 300 && status < 400 ? null : corpo, { status, headers })
const fetchDe = (...rs: Array<Response | (() => Promise<Response>)>): typeof fetch => {
  let i = 0
  return vi.fn(async () => {
    const r = rs[Math.min(i++, rs.length - 1)]
    return typeof r === 'function' ? r() : r.clone()
  }) as unknown as typeof fetch
}
const vazia = (r: Awaited<ReturnType<typeof lerWatchSemCookie>>): void => {
  expect(r.leitura.titulosExibidos.every((t) => t.texto === null)).toBe(true)
  expect(r.leitura.tituloOficial).toBeNull()
  expect(r.leitura.miniaturas).toEqual([])
  expect(r.jogadorBloqueado).toBe(false)
}

describe('nunca lança', () => {
  it('fetch que rejeita vira rede', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: (async () => { throw new Error('x') }) as typeof fetch }))
    expect(r.leitura.erro).toBe('rede'); expect(r.http).toBeNull(); vazia(r)
  })
  it('AbortError vira timeout', async () => {
    const e = Object.assign(new Error('a'), { name: 'AbortError' })
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: (async () => { throw e }) as typeof fetch }))
    expect(r.leitura.erro).toBe('timeout'); expect(r.http).toBeNull()
  })
  it('corpo que passa do timeout vira timeout', async () => {
    const lento = { status: 200, headers: new Headers(), text: () => new Promise<string>(() => undefined), body: null } as unknown as Response
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: (async () => lento) as typeof fetch, timeoutMs: 30 }))
    expect(r.leitura.erro).toBe('timeout')
  })
  it('JSON quebrado vira sem_initial_data ou parser', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp('<html>var ytInitialData = {"a":</html>')) }))
    expect(['sem_initial_data', 'parser']).toContain(r.leitura.erro); expect(r.http).toBe(200)
  })
})

describe('status', () => {
  const caso = async (status: number, h: Record<string, string> = {}) =>
    lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp('x', status, h)) }))
  it('429, 404, 503', async () => {
    expect((await caso(429)).leitura.erro).toBe('http_429')
    expect((await caso(404)).leitura.erro).toBe('http_4xx')
    const r = await caso(503); expect(r.leitura.erro).toBe('http_5xx'); expect(r.http).toBe(503)
  })
  it('302 consent e 302 shorts', async () => {
    const c = await caso(302, { location: 'https://consent.youtube.com/m?x=1' })
    expect(c.leitura.erro).toBe('consentimento'); expect(c.http).toBe(302)
    const s = await caso(302, { location: '/shorts/abc' })
    expect(s.leitura.erro).toBe('redirecionado'); expect(s.http).toBe(302)
  })
})

describe('schema e dados', () => {
  const corpos: Record<string, string> = {
    A: PAGINA_A(), B: PAGINA_B(), semInitialData: semInitialData(PAGINA_A()), consentimento: corpoConsentimento(),
    robo: corpoRoboSemTitulo(), bloqueado: jogadorBloqueadoDoVercel(PAGINA_A()), layoutNovo: layoutNovo(PAGINA_A()),
  }
  for (const [nome, corpo] of Object.entries(corpos)) {
    it(`a leitura passa em leituraWatchSchema: ${nome}`, async () => {
      const r = await lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp(corpo)) }))
      expect(leituraWatchSchema.safeParse(r.leitura).success).toBe(true)
    })
  }
  it('página A lida', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp(PAGINA_A())) }))
    expect(r.leitura.erro).toBeNull(); expect(r.leitura.idioma).toBe('pt-BR'); expect(r.http).toBe(200)
    expect(r.leitura.origemRede).toBe('vercel'); expect(r.leitura.rodadaId).toBe(UUID)
  })
  it('robô de player: jogadorBloqueado true e erro null', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp(jogadorBloqueadoDoVercel(PAGINA_A()))) }))
    expect(r.leitura.erro).toBeNull(); expect(r.jogadorBloqueado).toBe(true)
  })
  it('jogadorBloqueadoDoVercel: tituloOficial null e passa no schema', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp(jogadorBloqueadoDoVercel(PAGINA_A()))) }))
    expect(r.leitura.erro).toBeNull(); expect(r.jogadorBloqueado).toBe(true)
    expect(r.leitura.tituloOficial).toBeNull(); expect(r.leitura.titulo_oficial_fonte).toBeNull()
    expect(leituraWatchSchema.safeParse(r.leitura).success).toBe(true)
  })
})

describe('sonda de miniatura', () => {
  const img = (): Response => new Response(new Uint8Array([1, 2, 3]), { status: 404 })
  const comSonda = (rs: Array<Response>): typeof fetch => {
    let i = 0
    return vi.fn(async (u: string | URL | Request) => {
      const url = String(u)
      if (url.includes('ytimg.com')) return img()
      return rs[Math.min(i++, rs.length - 1)].clone()
    }) as unknown as typeof fetch
  }
  it('só com erro null: 429 não sonda', async () => {
    const f = comSonda([resp('x', 429)])
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: f, sondarMiniatura: true }))
    expect(r.leitura.miniaturas).toEqual([])
    expect(vi.mocked(f).mock.calls.every(([u]) => !String(u).includes('ytimg.com'))).toBe(true)
  })
  it('200 sonda 1 miniatura', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: comSonda([resp(PAGINA_A())]), sondarMiniatura: true }))
    expect(r.leitura.miniaturas).toHaveLength(1)
    expect(leituraWatchSchema.safeParse(r.leitura).success).toBe(true)
  })
  it('429 na 1ª e 200 na 2ª', async () => {
    const f = comSonda([resp('x', 429), resp(PAGINA_A())])
    const a = await lerWatchSemCookie(ID, base({ fetchImpl: f, sondarMiniatura: true }))
    const b = await lerWatchSemCookie(ID, base({ fetchImpl: f, sondarMiniatura: true }))
    expect(a.leitura.erro).toBe('http_429'); expect(a.leitura.miniaturas).toEqual([])
    expect(b.leitura.erro).toBeNull(); expect(b.leitura.miniaturas).toHaveLength(1)
  })
  it('sem a opção não sonda', async () => {
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: comSonda([resp(PAGINA_A())]) }))
    expect(r.leitura.miniaturas).toEqual([])
  })
})

describe('relógio, opções e requisição', () => {
  it('lidaEm é o instante da resposta', async () => {
    let t = 1000
    const f = (async () => { t = 2000; return resp(PAGINA_A()) }) as typeof fetch
    const r = await lerWatchSemCookie(ID, base({ fetchImpl: f, agora: () => t }))
    expect(r.leitura.lidaEm).toBe(new Date(2000).toISOString())
  })
  it('opção inválida lança TypeError antes da rede', async () => {
    const f = vi.fn() as unknown as typeof fetch
    await expect(lerWatchSemCookie('x'.repeat(10), base({ fetchImpl: f }))).rejects.toBeInstanceOf(TypeError)
    await expect(lerWatchSemCookie(ID, base({ fetchImpl: f, rodadaId: 'nao-uuid' }))).rejects.toBeInstanceOf(TypeError)
    await expect(lerWatchSemCookie(ID, { ...base({ fetchImpl: f }), origemRede: 'x' as 'vercel' })).rejects.toBeInstanceOf(TypeError)
    expect(f).not.toHaveBeenCalled()
  })
  it('igual ao P-V', () => {
    expect(USER_AGENT_LEITOR).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
    expect(urlWatch('x'.repeat(11))).toContain('hl=pt-BR&gl=BR')
  })
  it('nenhum Cookie enviado', async () => {
    const f = vi.fn(async () => resp(PAGINA_A()))
    await lerWatchSemCookie(ID, base({ fetchImpl: f as unknown as typeof fetch }))
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    const h = Object.fromEntries(Object.entries(init.headers as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))
    expect(url).toBe(urlWatch(ID))
    expect(h.cookie).toBeUndefined(); expect(h['accept-language']).toBe('pt-BR'); expect(h['user-agent']).toBe(USER_AGENT_LEITOR)
    expect(init.redirect).toBe('manual'); expect(init.cache).toBe('no-store')
  })
  it('schema recusa (parser defeituoso simulado) vira erro parser com os campos zerados', async () => {
    defeito.ligado = true
    try {
      const r = await lerWatchSemCookie(ID, base({ fetchImpl: fetchDe(resp(PAGINA_A())) }))
      expect(r.leitura.erro).toBe('parser'); expect(r.http).toBe(200); vazia(r)
      expect(r.leitura.idioma).toBeNull()
      expect(leituraWatchSchema.safeParse(r.leitura).success).toBe(true)
    } finally { defeito.ligado = false }
  })
})
