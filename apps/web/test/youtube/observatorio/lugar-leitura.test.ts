// @vitest-environment node
// A4 R4 T7: o leitor único de lugares em cache (`lugar/leitura.ts`). Cliente falso com espião; next/cache fiel (fake-next-cache).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeNextCache } from '../../helpers/fake-next-cache'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const SITE = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV }; vi.resetModules(); vi.doUnmock('next/cache') })

interface Linha { video_id: string; chaves: string[]; semente_versao: number }
const id = (i: number): string => 'v' + String(i).padStart(6, '0')

/** Cliente falso: `video_lugares` pagina por range; `lugares` responde por slug. O espião guarda cada `.eq`. */
function banco(linhas: Linha[], opc: { falhaLinhas?: boolean; falhaLugares?: boolean; slugs?: string[] } = {}) {
  const eqs: Array<[string, string, unknown]> = []
  const leituras = { video_lugares: 0, lugares: 0 }
  const db = {
    from(tabela: string) {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = (c: string, v: unknown) => { eqs.push([tabela, c, v]); return q }
      q.order = () => q
      q.range = async (de: number, ate: number) => {
        leituras.video_lugares++
        if (opc.falhaLinhas) return { data: null, error: { message: 'boom', code: 'XX000' } }
        return { data: linhas.slice(de, ate + 1), error: null }
      }
      q.maybeSingle = async () => {
        leituras.lugares++
        if (opc.falhaLugares) return { data: null, error: { message: 'boom' } }
        const slug = eqs.filter(e => e[0] === 'lugares' && e[1] === 'slug').pop()?.[2] as string
        return { data: (opc.slugs ?? []).includes(slug) ? { slug } : null, error: null }
      }
      return q
    },
  }
  return { db: db as never, eqs, leituras }
}

async function carregar() {
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  const mod = await import('@/lib/youtube/observatorio/lugar/leitura')
  return { cache, ...mod }
}

describe('lerMapaDeLugares: os três estados e a conta por lugar', () => {
  it('sem linha, linha com chaves vazias e linha com lugar são três estados; {local, pais} do mesmo vídeo conta 1 vídeo', async () => {
    const { lerMapaDeLugares, lugaresDe, marcadosDe, contagemPorLugar, semLinha } = await carregar()
    const { db } = banco([
      { video_id: id(1), chaves: ['local:vn-hanoi', 'pais:VN'], semente_versao: 2 },
      { video_id: id(2), chaves: [], semente_versao: 2 },
    ])
    const m = await lerMapaDeLugares(db, SITE, '2026-11-10T10:00:00Z')
    expect(lugaresDe(m, id(1))).toEqual(['local:vn-hanoi', 'pais:VN'])
    expect(lugaresDe(m, id(2))).toEqual([])
    expect(lugaresDe(m, id(3))).toBeNull()
    expect(semLinha(m, [id(1), id(2), id(3)])).toEqual([id(3)])
    const a = marcadosDe(m, 'local:vn-hanoi'), b = marcadosDe(m, 'pais:VN')
    expect(a.size).toBe(1); expect(b.size).toBe(1)
    expect(new Set([...a, ...b]).size).toBe(1)
    expect(contagemPorLugar(m, 1)).toEqual([{ slug: 'local:vn-hanoi', n: 1 }, { slug: 'pais:VN', n: 1 }])
  })
  it('slug válido sem nenhum vídeo marcado dá conjunto vazio, nunca nulo', async () => {
    const { lerMapaDeLugares, marcadosDe } = await carregar()
    const { db } = banco([{ video_id: id(1), chaves: ['pais:VN'], semente_versao: 2 }])
    const m = await lerMapaDeLugares(db, SITE, 'a')
    expect(marcadosDe(m, 'local:th-chiang-mai').size).toBe(0)
  })
  it('contagemPorLugar: mínimo 3 por padrão, n decrescente, empate por slug', async () => {
    const { lerMapaDeLugares, contagemPorLugar } = await carregar()
    const linhas: Linha[] = []
    for (let i = 0; i < 3; i++) linhas.push({ video_id: id(i), chaves: ['pais:BR', 'pais:AR'], semente_versao: 2 })
    for (let i = 3; i < 5; i++) linhas.push({ video_id: id(i), chaves: ['pais:BR'], semente_versao: 2 })
    linhas.push({ video_id: id(9), chaves: ['pais:ZZ'], semente_versao: 2 })
    const m = await lerMapaDeLugares(banco(linhas).db, SITE, 'a')
    expect(contagemPorLugar(m)).toEqual([{ slug: 'pais:BR', n: 5 }, { slug: 'pais:AR', n: 3 }])
  })
  it('duas semente_versao no mesmo site: versoes 2 (recálculo); uma só: 1', async () => {
    const { lerMapaDeLugares } = await carregar()
    const dois = await lerMapaDeLugares(banco([{ video_id: id(1), chaves: [], semente_versao: 1 }, { video_id: id(2), chaves: [], semente_versao: 2 }]).db, SITE, 'a')
    expect(dois.versoes).toBe(2)
    const um = await lerMapaDeLugares(banco([{ video_id: id(1), chaves: [], semente_versao: 2 }]).db, SITE, 'b')
    expect(um.versoes).toBe(1)
  })
  it('(a) C1: 1.000 linhas na página 0 e 210 na 1 dão 1.210 ids (readAll, não leitura única)', async () => {
    const { lerMapaDeLugares } = await carregar()
    const linhas = Array.from({ length: 1210 }, (_, i): Linha => ({ video_id: id(i), chaves: ['pais:VN'], semente_versao: 2 }))
    const m = await lerMapaDeLugares(banco(linhas).db, SITE, 'a')
    expect(m.ids).toHaveLength(1210)
  })
})

describe('lerMapaDeLugares: repetição e índice', () => {
  it('Phil M-1: video_id repetido (fronteira de página durante a gravação) é ignorado, não conta duas vezes', async () => {
    const { lerMapaDeLugares, contagemPorLugar } = await carregar()
    const m = await lerMapaDeLugares(banco([
      { video_id: id(1), chaves: ['pais:VN'], semente_versao: 2 },
      { video_id: id(1), chaves: ['pais:VN'], semente_versao: 2 },
      { video_id: id(2), chaves: ['pais:VN'], semente_versao: 2 },
    ]).db, SITE, 'a')
    expect(m.ids).toEqual([id(1), id(2)])
    expect(m.chavesPorVideo).toHaveLength(2)
    expect(contagemPorLugar(m, 1)).toEqual([{ slug: 'pais:VN', n: 2 }])
  })
  it('Yannis M-4: lugaresDe e semLinha sobre o mesmo mapa montam o índice uma vez só', async () => {
    const { lerMapaDeLugares, lugaresDe, semLinha } = await carregar()
    const m = await lerMapaDeLugares(banco(Array.from({ length: 50 }, (_, i): Linha => ({ video_id: id(i), chaves: ['pais:VN'], semente_versao: 2 }))).db, SITE, 'a')
    lugaresDe(m, id(1))
    const set = vi.spyOn(Map.prototype, 'set')
    try {
      lugaresDe(m, id(2)); lugaresDe(m, id(3)); semLinha(m, [id(4), 'x'])
      expect(set).not.toHaveBeenCalled()
    } finally { set.mockRestore() }
  })
  it('Yannis M-5: o siteId está na chave: dois sites com o mesmo computed_at ("nunca") não dividem a entrada', async () => {
    const { lerMapaDeLugares, cache } = await carregar()
    const s1 = banco([{ video_id: id(1), chaves: ['pais:VN'], semente_versao: 2 }])
    const s2 = banco([{ video_id: id(2), chaves: ['pais:BR'], semente_versao: 2 }])
    const a = await lerMapaDeLugares(s1.db, 'S1', null)
    const b = await lerMapaDeLugares(s2.db, 'S2', null)
    expect(s1.leituras.video_lugares).toBe(1)
    expect(s2.leituras.video_lugares).toBe(1)
    expect(cache.entries.size).toBe(2)
    expect(b.ids).not.toContain(id(1))
    expect(a.ids).toEqual([id(1)])
  })
})

describe('lerMapaDeLugares: cache por cálculo e falha', () => {
  it('(b) P-1: computed_at A = 1 leitura, repetição = 0, B = a 2ª; a entrada de A nunca serve B', async () => {
    const { lerMapaDeLugares, cache } = await carregar()
    const x = banco([{ video_id: id(1), chaves: ['pais:VN'], semente_versao: 2 }])
    await lerMapaDeLugares(x.db, SITE, 'A')
    expect(x.leituras.video_lugares).toBe(1)
    await lerMapaDeLugares(x.db, SITE, 'A')
    expect(x.leituras.video_lugares).toBe(1)
    await lerMapaDeLugares(x.db, SITE, 'B')
    expect(x.leituras.video_lugares).toBe(2)
    expect(cache.entries.size).toBe(2)
  })
  it('a entrada usa a chave fixa (nome da entrada, não o texto do callback) e leva lidoEm', async () => {
    const { lerMapaDeLugares, cache } = await carregar()
    const m = await lerMapaDeLugares(banco([]).db, SITE, 'A')
    expect(typeof m.lidoEm).toBe('number')
    expect([...cache.entries.keys()][0]).toMatch(/^lugares-mapa:local-/)
  })
  it('(20) banco falha: lança, nada é guardado, a 2ª chamada relê', async () => {
    const { lerMapaDeLugares, cache } = await carregar()
    const ruim = banco([], { falhaLinhas: true })
    await expect(lerMapaDeLugares(ruim.db, SITE, 'A')).rejects.toThrow()
    expect(cache.entries.size).toBe(0)
    await expect(lerMapaDeLugares(ruim.db, SITE, 'A')).rejects.toThrow()
    expect(ruim.leituras.video_lugares).toBe(2)
  })
  it('(e) m9: toda leitura de video_lugares leva .eq(site_id) e .eq(origem, competidor)', async () => {
    const { lerMapaDeLugares } = await carregar()
    const x = banco(Array.from({ length: 1100 }, (_, i): Linha => ({ video_id: id(i), chaves: [], semente_versao: 2 })))
    await lerMapaDeLugares(x.db, SITE, 'A')
    const doSite = x.eqs.filter(e => e[0] === 'video_lugares' && e[1] === 'site_id')
    expect(doSite.length).toBe(2)
    expect(doSite.every(e => e[2] === SITE)).toBe(true)
    expect(x.eqs.filter(e => e[1] === 'origem' && e[2] === 'competidor')).toHaveLength(2)
  })
  it('(f) 15.000 vídeos sintéticos cabem em 700 KB no formato compacto', async () => {
    const { lerMapaDeLugares } = await carregar()
    const linhas = Array.from({ length: 15000 }, (_, i): Linha => ({ video_id: '12345678-1234-4234-8234-' + String(i).padStart(12, '0'), chaves: i % 3 ? ['local:vn-hanoi', 'pais:VN'] : [], semente_versao: 2 }))
    const m = await lerMapaDeLugares(banco(linhas).db, SITE, 'A')
    expect(JSON.stringify(m).length).toBeLessThanOrEqual(700_000)
  })
  it('acima do orçamento a entrada não é guardada, mas o mapa volta', async () => {
    const { lerMapaDeLugares, cache } = await carregar()
    const linhas = Array.from({ length: 40000 }, (_, i): Linha => ({ video_id: '12345678-1234-4234-8234-' + String(i).padStart(12, '0'), chaves: ['pais:VN'], semente_versao: 2 }))
    const m = await lerMapaDeLugares(banco(linhas).db, SITE, 'A')
    expect(m.ids).toHaveLength(40000)
    expect(cache.entries.size).toBe(0)
  })
})

describe('situacaoDoSlug (antes do cache)', () => {
  it('existe, nao_existe e (d) P-5 falhou: erro nunca vira nao_existe; nenhuma entrada de cache', async () => {
    const { situacaoDoSlug, cache } = await carregar()
    const ok = banco([], { slugs: ['pais:VN'] })
    expect(await situacaoDoSlug(ok.db, 'pais:VN')).toBe('existe')
    expect(await situacaoDoSlug(ok.db, 'pais:ZZ')).toBe('nao_existe')
    expect(await situacaoDoSlug(banco([], { falhaLugares: true }).db, 'pais:VN')).toBe('falhou')
    expect(cache.entries.size).toBe(0)
    expect(cache.misses).toHaveLength(0)
  })
})

describe('estadoDoLugar', () => {
  const agora = { calculado: true, velho: false, computado_em: '2026-11-10T10:00:00Z' }
  it('(7) fresco = ok; 40 h = atrasado; sem linha = nunca; leitura nula = falhou (não nunca)', async () => {
    const { estadoDoLugar } = await carregar()
    expect(estadoDoLugar(agora, true)).toBe('ok')
    expect(estadoDoLugar({ ...agora, velho: true }, true)).toBe('atrasado')
    expect(estadoDoLugar({ calculado: false, velho: false, computado_em: null }, true)).toBe('nunca')
    expect(estadoDoLugar(null, true)).toBe('falhou')
  })
  it('(14) OBS_SINAIS_NICHO apagada: nunca calculado vira desligado; com cálculo fresco segue ok', async () => {
    delete process.env.OBS_SINAIS_NICHO
    const { estadoDoLugar } = await carregar()
    const { calculoLigadoNoAmbiente } = await import('@/lib/youtube/observatorio/sinais/leitura')
    expect(calculoLigadoNoAmbiente()).toBe(false)
    expect(estadoDoLugar({ calculado: false, velho: false, computado_em: null }, calculoLigadoNoAmbiente())).toBe('desligado')
    expect(estadoDoLugar(agora, calculoLigadoNoAmbiente())).toBe('ok')
  })
})
