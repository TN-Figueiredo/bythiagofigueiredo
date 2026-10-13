// @vitest-environment node
// As chamadas da leitura horária (A5 E16, Tarefa 8): videos.list em blocos de 50, `fetch` falso, nenhuma rede.
import { describe, it, expect } from 'vitest'
import { lerContadores, type ResultadoLeitura } from '@/lib/youtube/horaria/leitura'
import { HORARIA_CHAMADA_MS } from '@/lib/youtube/agenda/relogio'

const CHAVE = 'AIzaSy-CHAVE-SECRETA-DE-TESTE'
const SENTINELA = 'TEXTO-SENTINELA-DO-CORPO-DO-ERRO'
const AGORA = Date.UTC(2026, 9, 12, 12, 0, 0)

const ids = (n: number, prefixo = 'v'): string[] => Array.from({ length: n }, (_, i) => `${prefixo}${String(i).padStart(4, '0')}`)
const pedidosDe = (url: string): string[] => (new URL(url).searchParams.get('id') ?? '').split(',').filter(Boolean)

type Item = Record<string, unknown>
const item = (id: string, extra: Item = {}): Item => ({
  id,
  statistics: { viewCount: '100', likeCount: '10', commentCount: '2' },
  status: { privacyStatus: 'public' },
  ...extra,
})
const resposta = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

interface Falso { fetchImpl: typeof fetch; urls: string[]; sinais: Array<AbortSignal | null | undefined> }
function falso(responder: (url: string, n: number) => Response | Promise<Response>): Falso {
  const urls: string[] = []
  const sinais: Array<AbortSignal | null | undefined> = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    urls.push(url)
    sinais.push(init?.signal)
    return responder(url, urls.length - 1)
  }) as typeof fetch
  return { fetchImpl, urls, sinais }
}
/** Responde a cada bloco com um item para cada id pedido. */
const todosOk = (url: string): Response => resposta({ items: pedidosDe(url).map(id => item(id)) })

const ler = (lista: readonly string[], f: Falso, podeComecar: () => boolean = () => true): Promise<ResultadoLeitura> =>
  lerContadores(lista, { apiKey: CHAVE, fetchImpl: f.fetchImpl, agora: () => AGORA, podeComecar })

describe('lerContadores', () => {
  it('lista vazia não chama nada', async () => {
    const f = falso(todosOk)
    const r = await ler([], f)
    expect(f.urls).toHaveLength(0)
    expect(r.chamadas).toBe(0)
    expect(r.contagens).toEqual([])
    expect(r.idsQueFicaram).toEqual([])
    expect(r.falhas).toBe(0)
  })

  it('50 ids: 1 chamada; 51 ids: 2; 120 ids: 3', async () => {
    for (const [n, esperado] of [[50, 1], [51, 2], [120, 3]] as const) {
      const f = falso(todosOk)
      const r = await ler(ids(n), f)
      expect(r.chamadas).toBe(esperado)
      expect(f.urls).toHaveLength(esperado)
      expect(r.contagens).toHaveLength(n)
    }
  })

  it('57 vídeos de 15 canais: 2 chamadas', async () => {
    const f = falso(todosOk)
    const r = await ler(ids(57), f)
    expect(r.chamadas).toBe(2)
    expect(pedidosDe(f.urls[0]!)).toHaveLength(50)
    expect(pedidosDe(f.urls[1]!)).toHaveLength(7)
  })

  it('a chamada pede as três partes', async () => {
    const f = falso(todosOk)
    await ler(['abc'], f)
    expect(f.urls[0]).toContain('part=statistics,liveStreamingDetails,status')
    expect(f.urls[0]!.startsWith('https://www.googleapis.com/youtube/v3/videos?')).toBe(true)
  })

  it('a chamada leva um AbortSignal com prazo', async () => {
    const f = falso(todosOk)
    await ler(['abc'], f)
    expect(f.sinais[0]).toBeInstanceOf(AbortSignal)
    expect(HORARIA_CHAMADA_MS).toBe(8_000)
  })

  it('id repetido é pedido uma vez', async () => {
    const f = falso(todosOk)
    const r = await ler(['a1', 'b2', 'a1'], f)
    expect(pedidosDe(f.urls[0]!)).toEqual(['a1', 'b2'])
    expect(r.contagens.map(c => c.ytId)).toEqual(['a1', 'b2'])
  })

  it('200 sem items é falha do bloco, não "nenhum vídeo"', async () => {
    const f = falso(() => resposta({}))
    const lista = ids(3)
    const r = await ler(lista, f)
    expect(r.falhas).toBe(1)
    expect(r.idsQueFicaram).toEqual(lista)
    expect(r.naoDevolvidos).toBe(0)
    expect(r.idsNaoDevolvidos).toEqual([])
    expect(r.primeiraFalha).toEqual({ tipo: 'api_sem_lista', http: null })
  })

  it('200 com items nulo é falha do bloco', async () => {
    const f = falso(() => resposta({ items: null }))
    const lista = ids(3)
    const r = await ler(lista, f)
    expect(r.falhas).toBe(1)
    expect(r.idsQueFicaram).toEqual(lista)
    expect(r.naoDevolvidos).toBe(0)
    expect(r.primeiraFalha?.tipo).toBe('api_sem_lista')
  })

  it('200 com corpo que não é objeto ou não é JSON é falha do bloco', async () => {
    for (const mk of [() => resposta([1, 2]), () => resposta(null), () => new Response('<html>oi</html>', { status: 200 })]) {
      const f = falso(mk)
      const r = await ler(ids(2), f)
      expect(r.falhas).toBe(1)
      expect(r.naoDevolvidos).toBe(0)
      expect(r.primeiraFalha?.tipo).toBe('api_sem_lista')
    }
  })

  it('200 com error é falha do bloco', async () => {
    const f = falso(() => resposta({ error: { code: 400, message: SENTINELA }, items: [] }))
    const lista = ids(3)
    const r = await ler(lista, f)
    expect(r.falhas).toBe(1)
    expect(r.idsQueFicaram).toEqual(lista)
    expect(r.naoDevolvidos).toBe(0)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_sem_lista', http: null })
  })

  it('200 com items vazio para 50 ids é falha do bloco', async () => {
    const f = falso(() => resposta({ items: [] }))
    const lista = ids(50)
    const r = await ler(lista, f)
    expect(r.falhas).toBe(1)
    expect(r.idsQueFicaram).toEqual(lista)
    expect(r.naoDevolvidos).toBe(0)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_vazia', http: null })
  })

  it('200 com items vazio para 6 ids é falha; para 5 são cinco não devolvidos', async () => {
    const f6 = falso(() => resposta({ items: [] }))
    const r6 = await ler(ids(6), f6)
    expect(r6.falhas).toBe(1)
    expect(r6.naoDevolvidos).toBe(0)
    expect(r6.primeiraFalha?.tipo).toBe('api_vazia')

    const f5 = falso(() => resposta({ items: [] }))
    const lista = ids(5)
    const r5 = await ler(lista, f5)
    expect(r5.falhas).toBe(0)
    expect(r5.naoDevolvidos).toBe(5)
    expect(r5.idsNaoDevolvidos).toEqual(lista)
    expect(r5.idsQueFicaram).toEqual([])
    expect(r5.primeiraFalha).toBeUndefined()
  })

  it('500 num bloco não derruba o outro', async () => {
    const f = falso((url, n) => (n === 0 ? todosOk(url) : resposta({ error: { message: SENTINELA } }, 500)))
    const lista = ids(57)
    const r = await ler(lista, f)
    expect(r.contagens).toHaveLength(50)
    expect(r.idsQueFicaram).toEqual(lista.slice(50))
    expect(r.idsQueFicaram).toHaveLength(7)
    expect(r.falhas).toBe(1)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_http', http: 500 })
  })

  it('429 e 5xx são api_http com o número', async () => {
    for (const status of [429, 503]) {
      const f = falso(() => resposta({}, status))
      const r = await ler(ids(2), f)
      expect(r.primeiraFalha).toEqual({ tipo: 'api_http', http: status })
      expect(r.cotaEsgotada).toBe(false)
    }
  })

  it('403 de cota', async () => {
    for (const reason of ['quotaExceeded', 'dailyLimitExceeded']) {
      const f = falso(() => resposta({ error: { code: 403, errors: [{ reason, domain: 'youtube.quota' }] } }, 403))
      const lista = ids(3)
      const r = await ler(lista, f)
      expect(r.cotaEsgotada).toBe(true)
      expect(r.primeiraFalha).toEqual({ tipo: 'api_cota', http: 403 })
      expect(r.falhas).toBe(1)
      expect(r.idsQueFicaram).toEqual(lista)
    }
  })

  it('depois de um 403 de cota a onda seguinte não começa: os ids que sobraram são contados', async () => {
    const f = falso(() => resposta({ error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }, 403))
    const lista = ids(450) // 9 blocos: ondas de 4, 4 e 1
    const r = await ler(lista, f)
    expect(r.chamadas).toBe(4)
    expect(f.urls).toHaveLength(4)
    expect(r.cotaEsgotada).toBe(true)
    expect(r.idsQueFicaram).toEqual(lista)
    expect(r.idsQueFicaram).toHaveLength(450)
  })

  it('403 de cota no meio da onda: os blocos em voo terminam, a onda seguinte não começa', async () => {
    const f = falso((url, n) => (n === 1 ? resposta({ error: { errors: [{ reason: 'dailyLimitExceeded' }] } }, 403) : todosOk(url)))
    const lista = ids(250) // 5 blocos: onda de 4 + 1
    const r = await ler(lista, f)
    expect(r.chamadas).toBe(4)
    expect(r.contagens).toHaveLength(150)
    expect(r.cotaEsgotada).toBe(true)
    expect(r.idsQueFicaram).toEqual([...lista.slice(50, 100), ...lista.slice(200)])
  })

  it('viewCount negativo não vira contagem', async () => {
    const f = falso(url => resposta({ items: pedidosDe(url).map(id => item(id, { statistics: { viewCount: '-5', likeCount: '1' } })) }))
    const r = await ler(ids(2), f)
    expect(r.contagens).toEqual([])
    expect(r.semContagem).toBe(2)
    expect(r.naoDevolvidos).toBe(0)
  })

  it('os ids vão codificados na URL e não injetam parâmetro', async () => {
    const f = falso(todosOk)
    const r = await ler(['a&part=snippet', 'b c', 'ok1'], f)
    const url = f.urls[0]!
    expect(url).toContain('id=a%26part%3Dsnippet,b%20c,ok1&key=')
    expect(new URL(url).searchParams.getAll('part')).toEqual(['statistics,liveStreamingDetails,status'])
    expect(pedidosDe(url)).toEqual(['a&part=snippet', 'b c', 'ok1'])
    expect(r.contagens.map(c => c.ytId)).toEqual(['a&part=snippet', 'b c', 'ok1'])
  })

  it('403 proibido não é cota', async () => {
    const f = falso(() => resposta({ error: { code: 403, errors: [{ reason: 'forbidden' }] } }, 403))
    const r = await ler(ids(3), f)
    expect(r.cotaEsgotada).toBe(false)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_http', http: 403 })
  })

  it('403 com corpo ilegível não é cota', async () => {
    const f = falso(() => new Response('nao-json', { status: 403 }))
    const r = await ler(ids(3), f)
    expect(r.cotaEsgotada).toBe(false)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_http', http: 403 })
  })

  it('a chamada que passa do tempo', async () => {
    const f = falso(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')))
    const lista = ids(3)
    const r = await ler(lista, f)
    expect(r.falhas).toBe(1)
    expect(r.idsQueFicaram).toEqual(lista)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_tempo', http: null })
  })

  it('timeout no 2º de 3 blocos: o 1º e o 3º valem, nada é perdido além do 2º', async () => {
    const f = falso((url, n) => (n === 1 ? Promise.reject(new DOMException('t', 'TimeoutError')) : todosOk(url)))
    const lista = ids(120)
    const r = await ler(lista, f)
    expect(r.chamadas).toBe(3)
    expect(r.falhas).toBe(1)
    expect(r.contagens).toHaveLength(70)
    expect(r.idsQueFicaram).toEqual(lista.slice(50, 100))
    expect(r.primeiraFalha?.tipo).toBe('api_tempo')
  })

  it('timeout na 1ª onda e relógio acabado: a onda seguinte não é tentada e o que ficou de fora é contado', async () => {
    let chamadasAoRelogio = 0
    const f = falso((url, n) => (n === 1 ? Promise.reject(new DOMException('t', 'TimeoutError')) : todosOk(url)))
    const lista = ids(250) // 5 blocos: onda de 4 + 1
    const r = await lerContadores(lista, {
      apiKey: CHAVE, fetchImpl: f.fetchImpl, agora: () => AGORA,
      podeComecar: () => ++chamadasAoRelogio === 1,
    })
    expect(r.chamadas).toBe(4)
    expect(r.falhas).toBe(1)
    expect(r.contagens).toHaveLength(150)
    expect(r.idsQueFicaram).toEqual([...lista.slice(50, 100), ...lista.slice(200)])
  })

  it('erro de rede que não é de tempo é api_http sem número', async () => {
    const f = falso(() => Promise.reject(new TypeError('fetch failed')))
    const r = await ler(ids(2), f)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_http', http: null })
    expect(r.falhas).toBe(1)
  })

  it('a primeira falha é a do primeiro bloco, mesmo que outro tenha respondido antes', async () => {
    const f = falso((url, n) => (n === 0
      ? new Promise<Response>(res => setTimeout(() => res(resposta({}, 502)), 20))
      : resposta({}, 500)))
    const r = await ler(ids(100), f)
    expect(r.falhas).toBe(2)
    expect(r.primeiraFalha).toEqual({ tipo: 'api_http', http: 502 })
  })

  it('vídeo pedido e não devolvido não vira linha', async () => {
    const f = falso(url => resposta({ items: pedidosDe(url).slice(0, 2).map(id => item(id)) }))
    const lista = ['a1', 'b2', 'c3']
    const r = await ler(lista, f)
    expect(r.naoDevolvidos).toBe(1)
    expect(r.idsNaoDevolvidos).toEqual(['c3'])
    expect(r.contagens.map(c => c.ytId)).toEqual(['a1', 'b2'])
    expect(r.falhas).toBe(0)
    expect(r.semContagem).toBe(0)
  })

  it('item que não foi pedido é ignorado', async () => {
    const f = falso(url => resposta({ items: [...pedidosDe(url).map(id => item(id)), item('estranho')] }))
    const r = await ler(['a1', 'b2'], f)
    expect(r.contagens.map(c => c.ytId)).toEqual(['a1', 'b2'])
    expect(r.naoDevolvidos).toBe(0)
  })

  it('item pedido em OUTRO bloco não vale neste', async () => {
    const lista = ids(60)
    // o primeiro bloco devolve também um id do segundo bloco; o segundo bloco devolve só os seus
    const f = falso((url, n) => resposta({ items: n === 0 ? [...pedidosDe(url).map(id => item(id)), item(lista[55]!)] : pedidosDe(url).map(id => item(id)) }))
    const r = await ler(lista, f)
    expect(r.contagens.filter(c => c.ytId === lista[55])).toHaveLength(1)
    expect(r.contagens).toHaveLength(60)
  })

  it('o mesmo item repetido na resposta vale uma vez; item sem id ou que não é objeto é ignorado', async () => {
    const f = falso(() => resposta({ items: [item('a1'), item('a1'), { statistics: { viewCount: '5' } }, null, 'x', 7] }))
    const r = await ler(['a1', 'b2'], f)
    expect(r.contagens.map(c => c.ytId)).toEqual(['a1'])
    expect(r.idsNaoDevolvidos).toEqual(['b2'])
  })

  it('sem statistics, e sem viewCount', async () => {
    const f = falso(() => resposta({ items: [{ id: 'a1' }, { id: 'b2', statistics: { likeCount: '3' } }] }))
    const r = await ler(['a1', 'b2'], f)
    expect(r.semContagem).toBe(2)
    expect(r.contagens).toEqual([])
    expect(r.naoDevolvidos).toBe(0)
  })

  it('curtidas ocultas e comentários desligados são nulo', async () => {
    const f = falso(() => resposta({ items: [{ id: 'a1', statistics: { viewCount: '40' } }] }))
    const r = await ler(['a1'], f)
    expect(r.contagens).toHaveLength(1)
    expect(r.contagens[0]).toMatchObject({ ytId: 'a1', views: 40, likes: null, comments: null })
  })

  it('viewCount "0" é zero medido', async () => {
    const f = falso(() => resposta({ items: [{ id: 'a1', statistics: { viewCount: '0', likeCount: '0', commentCount: '0' } }] }))
    const r = await ler(['a1'], f)
    expect(r.contagens[0]).toMatchObject({ views: 0, likes: 0, comments: 0 })
    expect(r.semContagem).toBe(0)
  })

  it('viewCount ilegível não vira zero', async () => {
    const f = falso(() => resposta({ items: [{ id: 'a1', statistics: { viewCount: 'muitos' } }] }))
    const r = await ler(['a1'], f)
    expect(r.contagens).toEqual([])
    expect(r.semContagem).toBe(1)
  })

  it('ao vivo em andamento não é lido; ao vivo que acabou é', async () => {
    const f = falso(() => resposta({ items: [
      item('a1', { liveStreamingDetails: { actualStartTime: '2026-10-12T10:00:00Z' } }),
      item('b2', { liveStreamingDetails: { actualStartTime: '2026-10-12T08:00:00Z', actualEndTime: '2026-10-12T09:00:00Z' } }),
    ] }))
    const r = await ler(['a1', 'b2'], f)
    expect(r.aoVivo).toBe(1)
    expect(r.contagens.map(c => c.ytId)).toEqual(['b2'])
    expect(r.naoDevolvidos).toBe(0)
    expect(r.semContagem).toBe(0)
  })

  it('a privacidade vem da resposta; ausente é nulo', async () => {
    const f = falso(() => resposta({ items: [
      item('a1', { status: { privacyStatus: 'public' } }),
      item('b2', { status: { privacyStatus: 'unlisted' } }),
      { id: 'c3', statistics: { viewCount: '1' } },
      item('d4', { status: {} }),
    ] }))
    const r = await ler(['a1', 'b2', 'c3', 'd4'], f)
    expect(r.contagens.map(c => c.privacidade)).toEqual(['public', 'unlisted', null, null])
  })

  it('lidoEm é o instante em que aquele bloco respondeu', async () => {
    let t = AGORA
    const f = falso(todosOk)
    const r = await lerContadores(ids(100), { apiKey: CHAVE, fetchImpl: f.fetchImpl, agora: () => (t += 1_000), podeComecar: () => true })
    const lidos = new Set(r.contagens.map(c => c.lidoEm))
    expect(lidos.size).toBe(2)
    for (const l of lidos) expect(Number.isNaN(Date.parse(l))).toBe(false)
    expect(r.contagens[0]!.lidoEm).toBe(new Date(AGORA + 1_000).toISOString())
  })

  it('o relógio acabou antes da segunda onda', async () => {
    let n = 0
    const f = falso(todosOk)
    const lista = ids(450) // 9 blocos
    const r = await lerContadores(lista, { apiKey: CHAVE, fetchImpl: f.fetchImpl, agora: () => AGORA, podeComecar: () => ++n === 1 })
    expect(r.chamadas).toBe(4)
    expect(r.idsQueFicaram).toHaveLength(250)
    expect(r.idsQueFicaram).toEqual(lista.slice(200))
    expect(r.contagens).toHaveLength(200)
    expect(r.falhas).toBe(0)
  })

  it('as ondas têm no máximo 4 blocos em paralelo', async () => {
    let ativas = 0, pico = 0
    const f = falso(async url => {
      ativas++; pico = Math.max(pico, ativas)
      await new Promise(res => setTimeout(res, 5))
      ativas--
      return todosOk(url)
    })
    const r = await ler(ids(450), f)
    expect(r.chamadas).toBe(9)
    expect(pico).toBe(4)
    expect(r.contagens).toHaveLength(450)
  })

  it('a chave e o corpo do erro não aparecem no resultado', async () => {
    const f1 = falso(() => resposta({ error: { message: `${SENTINELA} key=${CHAVE}` } }, 400))
    const f2 = falso(url => Promise.reject(new TypeError(`fetch failed: ${url}`)))
    const f3 = falso(() => resposta({ error: { message: SENTINELA, errors: [{ reason: 'quotaExceeded' }] } }, 403))
    for (const f of [f1, f2, f3]) {
      const r = await ler(ids(3), f)
      const json = JSON.stringify(r)
      expect(json).not.toContain(CHAVE)
      expect(json).not.toContain('googleapis.com')
      expect(json).not.toContain(SENTINELA)
      expect(json).not.toContain('key=')
    }
  })
})
