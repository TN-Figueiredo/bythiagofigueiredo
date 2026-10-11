// @vitest-environment node
// A3 Tarefa 5: o pacote que vai do servidor ao navegador na comparação (modelo, sem tela): só dados simples, os treze
// números de todos os canais, os cinco mais vistos e a publicação em 90 dias.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gzipSync } from 'node:zlib'
import { a3World } from './a3-fixture'
import { buildCompararPack, type CanalPack, type CompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'
import { numerosDoCanal, NUMEROS } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { ownChannelHref } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-channels'
import { link, OBS_BASE } from '@/lib/youtube/observatorio/links'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { createTestObservatory } from './oracle'

beforeEach(() => { sentry.captureMessage.mockClear() })

// o aviso de número inválido vai para o Sentry (a cópia que roda no servidor); aqui só se conta
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

const DAY = 86_400_000
/** Teto do tamanho cru do pacote de 75 canais (guarda barata de regressão; o gzip é o que viaja). */
const TETO_CRU = 800 * 1024
const PALAVRAS_INTERNAS = /\b(pack|pacote|dataset|conjunto do site|motor|sentinela|R73|escala √|ranking)\b/i

const world = a3World
const BASE = world()
const BASE_PACK = buildCompararPack(BASE.obs)
const OWN = 'tnfigueiredo'
const OWN2 = 'tnfigueiredo-en'
const CH = 'leo-khev'
const canal = (p: CompararPack, id: string): CanalPack => p.canais.find(c => c.id === id)!
const vidsOf = (ds: Dataset, id: string) => ds.videos.filter(v => v.ch === id)
const semVideos = (id: string) => (ds: Dataset) => { ds.videos = ds.videos.filter(v => v.ch !== id); ds.channels.find(c => c.id === id)!.undated = [] }
const undated = (n: number, o: Partial<Dataset['channels'][number]['undated'][number]> = {}) => Array.from({ length: n }, (_, i) => ({
  id: `sd-${i}`, ytId: `sdyt${i}`, title: `Sem data ${i}` as string | null, url: `https://youtu.be/sdyt${i}`, isShort: false as boolean | null, dur: 600 as number | null,
  views: 100 + i as number | null, likes: 1 as number | null, comments: 0 as number | null, pinned: false, checkedAt: null as number | null, ...o,
}))

describe('ordem e identidade', () => {
  it('ordem: canais próprios primeiro (ordem do motor), depois concorrentes por inscritos, maior primeiro', () => {
    const owns = BASE.obs.ownChannels().map(c => c.id)
    const comps = BASE.obs.channels.filter(c => !c.own).sort((a, b) => (b.subs ?? -1) - (a.subs ?? -1) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(c => c.id)
    expect(BASE_PACK.ordem).toEqual([...owns, ...comps])
    expect(BASE_PACK.canais.map(c => c.id).sort()).toEqual([...BASE_PACK.ordem].sort())
    expect(BASE_PACK.ordem.length).toBe(BASE.obs.channels.length)
  })
  it('canal com inscritos escondidos vai para o fim dos concorrentes, nunca para o topo', () => {
    const w = world(ds => { ds.channels.find(c => c.id === 'luke-damant')!.subs = null })
    const p = buildCompararPack(w.obs)
    expect(p.ordem[p.ordem.length - 1]).toBe('luke-damant')
  })
  it('os campos de identidade do canal', () => {
    const c = canal(BASE_PACK, CH), ch = BASE.obs.channel(CH)!
    expect(c).toMatchObject({ id: CH, name: ch.name, own: false, niche: 'viagem', nicheLabel: BASE.obs.nicheLabel('viagem'), ini: ch.ini, color: ch.color, semVideos: false })
    expect(c.subsTexto).toBe(BASE.obs.fmt.subs(ch.subs))
    expect(canal(BASE_PACK, OWN).own).toBe(true)
  })
  it('inscritos escondidos: subsTexto null, nunca "—"', () => {
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.subs = null })
    expect(canal(buildCompararPack(w.obs), CH).subsTexto).toBeNull()
  })
  it('canal sem nicho: niche e nicheLabel nulos', () => {
    const w = world(ds => { ds.channels.find(c => c.id === OWN)!.niche = null })
    const c = canal(buildCompararPack(w.obs), OWN)
    expect(c.niche).toBeNull(); expect(c.nicheLabel).toBeNull()
  })
  it('os números do pacote são os de numerosDoCanal, para todos os canais', () => {
    for (const c of BASE_PACK.canais) expect(c.numeros, c.id).toEqual(numerosDoCanal(BASE.obs, c.id))
    expect(Object.keys(canal(BASE_PACK, CH).numeros)).toEqual([...NUMEROS])
  })
  it('comDatas: tem ao menos um vídeo com data; sem vídeos ou só com vídeos sem data, não. semanasRitmo é a janela da regra', () => {
    expect(canal(BASE_PACK, CH).comDatas).toBe(true)
    expect(BASE_PACK.semanasRitmo).toBe(BASE.obs.RULES.habit.weeks)
    const w = world(ds => { semVideos(OWN2)(ds); ds.videos = ds.videos.filter(v => v.ch !== OWN); ds.channels.find(c => c.id === OWN)!.undated = undated(2) })
    const p = buildCompararPack(w.obs)
    expect(canal(p, OWN2).comDatas).toBe(false); expect(canal(p, OWN2).semVideos).toBe(true)
    expect(canal(p, OWN).comDatas).toBe(false); expect(canal(p, OWN).semVideos).toBe(false) // só vídeos sem data
  })
  it('o eixo de 90 dias: início, +30, +60 e hoje', () => {
    const D = BASE.obs.date
    expect(BASE_PACK.now).toBe(BASE.obs.NOW)
    expect(BASE_PACK.inicio90).toBe(BASE.obs.NOW - 90 * DAY)
    expect(BASE_PACK.eixo).toEqual([D.dm(BASE_PACK.inicio90), D.dm(BASE_PACK.inicio90 + 30 * DAY), D.dm(BASE_PACK.inicio90 + 60 * DAY), `hoje, ${D.dm(BASE.obs.NOW)}`])
  })
})

describe('href: "Abrir o canal …"', () => {
  it('página para concorrente; ownChannelHref para canal próprio com vídeos; null para canal próprio sem vídeos', () => {
    expect(canal(BASE_PACK, CH).href).toBe(link.canal(CH))
    expect(canal(BASE_PACK, OWN).href).toBe(ownChannelHref(OWN))
    const w = world(semVideos(OWN2))
    const p = buildCompararPack(w.obs)
    expect(canal(p, OWN2).semVideos).toBe(true)
    expect(canal(p, OWN2).href).toBeNull()
    expect(canal(p, OWN).href).toBe(ownChannelHref(OWN))
  })
  it('concorrente sem vídeos continua tendo página (ela diz "ainda não tem vídeos sincronizados"), mas o pacote marca semVideos', () => {
    const w = world(semVideos(CH))
    const c = canal(buildCompararPack(w.obs), CH)
    expect(c.semVideos).toBe(true)
    expect(c.href).toBe(link.canal(CH))
  })
  it('só vídeos sem data: o canal não está "sem vídeos"', () => {
    const w = world(ds => { ds.videos = ds.videos.filter(v => v.ch !== OWN2); ds.channels.find(c => c.id === OWN2)!.undated = undated(2) })
    const c = canal(buildCompararPack(w.obs), OWN2)
    expect(c.semVideos).toBe(false)
    expect(c.href).toBe(ownChannelHref(OWN2))
  })
})

describe('top5', () => {
  it('os cinco de mais views entre os vídeos guardados (longos e Shorts juntos), com a marca Short', () => {
    const c = canal(BASE_PACK, CH), todos = vidsOf(BASE.ds, CH).filter(v => v.views != null).sort((a, b) => b.views! - a.views! || b.pub - a.pub || a.id.localeCompare(b.id))
    expect(c.top5.map(t => t.id)).toEqual(todos.slice(0, 5).map(v => v.id))
    expect(c.top5.length).toBe(5)
    c.top5.forEach((t, i) => {
      const v = todos[i]!
      expect(t.short).toBe(v.fmt === 'short')
      expect(t.titulo).toBe(v.title)
      expect(t.thumb).toBe(`https://i.ytimg.com/vi/${v.ytId}/mqdefault.jpg`)
      expect(t.href).toBe(link.historico(v.id, { from: 'canais' }))
      expect(t.viewsTexto).toBe(`${BASE.obs.fmt.num(v.views)} views`)
      expect(t.idadeTexto).toBe(BASE.obs.fmt.age(v))
    })
    expect(canal(BASE_PACK, CH).top5Nota).toBe(`5 de ${vidsOf(BASE.ds, CH).length} vídeos guardados, por views.`)
  })
  it('longos e Shorts misturados: o canal do fixture tem os dois entre os cinco ou a marca bate com o formato', () => {
    const marcas = BASE_PACK.canais.flatMap(c => c.top5.map(t => t.short))
    expect(marcas.some(Boolean)).toBe(true); expect(marcas.some(m => !m)).toBe(true)
  })
  it('menos de cinco: a nota diz quantos', () => {
    const w = world(ds => { ds.videos = ds.videos.filter(v => v.ch !== CH || vidsOf(ds, CH).filter(x => x.fmt === 'long').slice(0, 3).includes(v)) })
    const c = canal(buildCompararPack(w.obs), CH)
    expect(c.top5.length).toBe(3); expect(c.top5Nota).toBe('Só 3 vídeos com contagem de views.')
  })
  it('um vídeo só: singular', () => {
    const w = world(ds => { const um = vidsOf(ds, CH)[0]!; ds.videos = ds.videos.filter(v => v.ch !== CH || v === um) })
    expect(canal(buildCompararPack(w.obs), CH).top5Nota).toBe('Só 1 vídeo com contagem de views.')
  })
  it('canal sem vídeos diz isso', () => {
    const c = canal(buildCompararPack(world(semVideos(CH)).obs), CH)
    expect(c.top5).toEqual([]); expect(c.top5Nota).toBe('Este canal não tem vídeos.')
  })
  it('vídeo sem contagem de views não entra (nunca como 0)', () => {
    const w = world(ds => {
      const v = vidsOf(ds, CH).filter(x => x.views != null).sort((a, b) => b.views! - a.views!)
      v[0]!.views = null // o mais visto perde a contagem
    })
    const antes = canal(BASE_PACK, CH).top5.map(t => t.id)
    const c = canal(buildCompararPack(w.obs), CH)
    expect(c.top5.map(t => t.id)).not.toContain(antes[0])
    expect(c.top5.length).toBe(5)
    expect(c.top5.every(t => !t.viewsTexto.startsWith('0 '))).toBe(true)
  })
  it('todos os vídeos sem contagem de views: lista vazia e a nota diz, não "5 de N"', () => {
    const w = world(ds => { vidsOf(ds, CH).forEach(v => { v.views = null }) })
    const c = canal(buildCompararPack(w.obs), CH)
    expect(c.top5).toEqual([]); expect(c.top5Nota).toBe('Nenhum vídeo tem contagem de views.')
  })
  it('vídeo sem data entra, com "sem data" na idade, e abre o histórico', () => {
    const w = world(ds => {
      ds.videos = ds.videos.filter(v => v.ch !== OWN2)
      ds.channels.find(c => c.id === OWN2)!.undated = undated(2, { views: 999_999 })
    })
    const c = canal(buildCompararPack(w.obs), OWN2)
    expect(c.top5.length).toBe(2)
    expect(c.top5[0]).toMatchObject({ idadeTexto: 'sem data', short: false, href: link.historico('sd-0', { from: 'canais' }), thumb: 'https://i.ytimg.com/vi/sdyt0/mqdefault.jpg' })
    expect(c.top5Nota).toBe('Só 2 vídeos com contagem de views.')
  })
  it('título ausente: "sem título", nunca vazio; sem ytId, sem thumb', () => {
    const w = world(ds => {
      ds.videos = ds.videos.filter(v => v.ch !== OWN2)
      ds.channels.find(c => c.id === OWN2)!.undated = undated(1, { title: null, ytId: '' })
    })
    const t = canal(buildCompararPack(w.obs), OWN2).top5[0]!
    expect(t.titulo).toBe('sem título'); expect(t.thumb).toBeNull()
  })
})

describe('pub90', () => {
  it('um item por vídeo com data nos últimos 90 dias, com a marca do formato', () => {
    const c = canal(BASE_PACK, CH), v90 = vidsOf(BASE.ds, CH).filter(v => v.ageDays <= 90)
    expect(c.pub90.length).toBe(v90.length)
    expect(c.pub90.filter(p => p.fmt === 'long').length).toBe(v90.filter(v => v.fmt === 'long').length)
    expect(c.pub90.filter(p => p.fmt === 'long').length).toBe(c.numeros.longos90.x) // a faixa e o número são a mesma conta
    for (const p of c.pub90) { expect(p.t).toBeGreaterThanOrEqual(BASE_PACK.inicio90); expect(p.t).toBeLessThanOrEqual(BASE_PACK.now); expect(p.dataTexto.length).toBeGreaterThan(0) }
  })
  it('a data do traço é a do vídeo; só o traço de quem é de 90 dias e meio é puxado para o início do eixo', () => {
    const w = world(ds => { const v = vidsOf(ds, CH).find(v => v.ageDays <= 90)!; v.pub = BASE.obs.NOW - 90.5 * DAY; v.ageDays = 90 })
    const p = buildCompararPack(w.obs), c = canal(p, CH)
    const velho = c.pub90.find(x => x.t === p.inicio90)
    expect(velho).toBeDefined()
    expect(velho!.dataTexto).toBe(w.obs.date.dmhm(BASE.obs.NOW - 90.5 * DAY))
  })
  it('estreia agendada (publicação depois de agora) não cai à direita de "hoje": o traço fica em agora (M7)', () => {
    const w = world(ds => { const v = vidsOf(ds, CH).find(v => v.ageDays <= 90)!; v.pub = BASE.obs.NOW + 3 * 3_600_000; v.ageDays = 0 })
    const p = buildCompararPack(w.obs), c = canal(p, CH)
    expect(Math.max(...c.pub90.map(x => x.t))).toBe(p.now)
    expect(c.pub90.every(x => x.t <= p.now && x.t >= p.inicio90)).toBe(true)
    expect(c.pub90.length).toBe(c.numeros.longos90.x! + c.pub90.filter(x => x.fmt !== 'long').length) // a contagem não muda
  })
  it('isShort nulo → fmt null e a nota conta "de formato não confirmado"', () => {
    const w = world(ds => { vidsOf(ds, CH).filter(v => v.ageDays <= 90).slice(0, 2).forEach(v => { v.isShort = null }) })
    const c = canal(buildCompararPack(w.obs), CH)
    expect(c.pub90.filter(p => p.fmt === null).length).toBe(2)
    expect(c.pub90Nota).toContain('2 de formato não confirmado')
  })
  it('a nota conta longos e Shorts', () => {
    const c = canal(BASE_PACK, CH), v90 = vidsOf(BASE.ds, CH).filter(v => v.ageDays <= 90)
    const nl = v90.filter(v => v.fmt === 'long').length, ns = v90.filter(v => v.fmt === 'short').length
    expect(c.pub90Nota).toBe(`${nl} ${nl === 1 ? 'longo' : 'longos'} e ${ns} ${ns === 1 ? 'Short' : 'Shorts'} nos últimos 90 dias.`)
  })
  it('canal sem vídeo em 90 dias diz o último', () => {
    const w = world(ds => { ds.videos = ds.videos.filter(v => !(v.ch === CH && v.ageDays <= 90)) })
    const c = canal(buildCompararPack(w.obs), CH), ult = Math.max(...vidsOf(w.ds, CH).map(v => v.pub))
    expect(c.pub90).toEqual([])
    expect(c.pub90Nota).toBe(`Nenhum vídeo nos últimos 90 dias; o último foi em ${w.obs.date.dmOrDmy(ult)}, ${w.obs.date.ago(ult)}.`)
  })
  it('canal que ainda sincroniza: o aviso "pode haver mais vídeos" vem também quando não há vídeo nos últimos 90 dias (M6)', () => {
    const w = world(ds => { vidsOf(ds, 'vou-sem-volta').forEach((v, i) => { v.ageDays = 120 + i; v.pub = BASE.obs.NOW - v.ageDays * DAY }) })
    const c = canal(buildCompararPack(w.obs), 'vou-sem-volta')
    expect(vidsOf(w.ds, 'vou-sem-volta').length).toBeGreaterThan(0) // precondição: tem vídeos, nenhum recente
    expect(BASE.obs.channel('vou-sem-volta')!.sync.state).toBe('backfill')
    expect(c.pub90).toEqual([])
    expect(c.pub90Nota).toMatch(/^Nenhum vídeo nos últimos 90 dias; o último foi em .+\. A sincronização do canal ainda não terminou: pode haver mais vídeos\.$/)
  })
  it('canal sem nenhum vídeo → "ainda sem vídeos sincronizados"', () => {
    const c = canal(buildCompararPack(world(semVideos(CH)).obs), CH)
    expect(c.pub90).toEqual([]); expect(c.pub90Nota).toBe('ainda sem vídeos sincronizados')
  })
  it('só vídeos sem data: a nota diz isso, não "sem vídeos"', () => {
    const w = world(ds => { ds.videos = ds.videos.filter(v => v.ch !== OWN2); ds.channels.find(c => c.id === OWN2)!.undated = undated(2) })
    const c = canal(buildCompararPack(w.obs), OWN2)
    expect(c.pub90).toEqual([]); expect(c.pub90Nota).toBe('Os vídeos deste canal ainda não têm data de publicação.')
  })
})

describe('o pacote como um todo', () => {
  it('o pacote é só dado simples: JSON.parse(JSON.stringify(pack)) é igual ao pacote', () => {
    expect(JSON.parse(JSON.stringify(BASE_PACK))).toEqual(BASE_PACK)
    const w = world(ds => { semVideos(OWN2)(ds); ds.channels.find(c => c.id === CH)!.subs = null })
    const p = buildCompararPack(w.obs)
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
    // undefined sumiria no JSON: nenhum campo pode ser undefined
    const sem = (x: unknown, via: string): void => {
      if (x === undefined) throw new Error('undefined em ' + via)
      if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) sem(v, via + '.' + k)
    }
    sem(p, 'pack')
  })
  it('um número em estado inesperado não derruba o pacote: vira "não medido" e um aviso vai ao Sentry, uma vez por número', () => {
    sentry.captureMessage.mockClear()
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.subs = Number.NaN })
    const p = buildCompararPack(w.obs)
    expect(canal(p, CH).numeros.inscritos).toEqual({ x: null, texto: null, motivo: 'este número não pôde ser calculado', nota: null })
    expect(canal(p, 'nate-herk').numeros.inscritos.x).not.toBeNull()
    const chamadas = sentry.captureMessage.mock.calls.filter(c => String(c[0]).includes(CH))
    expect(chamadas.length).toBeGreaterThanOrEqual(1)
    expect(chamadas[0]![0]).toMatch(/comparação/); expect(chamadas[0]![1]).toMatchObject({ level: 'warning', extra: { canal: CH, numero: 'inscritos' } })
    sentry.captureMessage.mockClear()
    buildCompararPack(BASE.obs) // sem número inválido: nenhum aviso
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('nenhum texto do pacote traz palavra interna', () => {
    const textos: string[] = []
    const ver = (x: unknown): void => { if (typeof x === 'string') textos.push(x); else if (x && typeof x === 'object') Object.values(x).forEach(ver) }
    ver(BASE_PACK)
    ver(buildCompararPack(world(ds => { semVideos(OWN2)(ds); semVideos('paddy-doyle')(ds) }).obs))
    for (const t of textos) expect(t).not.toMatch(PALAVRAS_INTERNAS)
  })
  it('o pacote chama só o conjunto do site: buildCompararPack num conjunto de um canal lança', () => {
    const { ds } = world()
    const um: Dataset = { ...ds, scope: 'canal', channels: ds.channels.filter(c => c.id === CH), videos: ds.videos.filter(v => v.ch === CH) }
    expect(() => buildCompararPack(createTestObservatory(um))).toThrow()
  })
  it('tamanho: 75 canais com 200 vídeos DIFERENTES cada ficam abaixo de 250 KB com gzip e de um teto no cru (registrar o medido)', () => {
    const { ds } = world()
    const modelo = ds.videos.filter(v => v.ch === 'sabrina-ramonov').slice(0, 200)
    const molde = ds.channels.find(c => c.id === 'sabrina-ramonov')!
    // gerador com semente fixa (mulberry32): dado variado e repetível, sem Math.random
    let seed = 20_261_011
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296 }
    const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
    const ALFA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'
    const ytId = () => Array.from({ length: 11 }, () => ALFA[int(0, ALFA.length - 1)]).join('')
    const SIL = ['ba', 'ko', 'ri', 'mu', 'tel', 'zon', 'fa', 'lu', 'gen', 'pri', 'vo', 'cra', 'sin', 'do', 'ver', 'mat', 'ex', 'pol', 'qui', 'nes']
    const palavra = () => Array.from({ length: int(1, 4) }, () => SIL[int(0, SIL.length - 1)]).join('')
    const titulo = () => Array.from({ length: int(4, 11) }, palavra).join(' ')
    const canais: Dataset['channels'] = [], videos: Dataset['videos'] = []
    const proprios = ds.channels.filter(c => c.own)
    canais.push(...proprios); videos.push(...ds.videos.filter(v => proprios.some(c => c.id === v.ch)))
    for (let i = 0; i < 73; i++) {
      const id = `ch-${i}`, nome = `${palavra()} ${palavra()}`
      canais.push({
        ...molde, id, name: nome, fullName: `${nome} ${palavra()}`, subs: int(1_000, 9_000_000), handle: `@${palavra()}${i}`,
        snapshots: molde.snapshots.map(s => ({ ...s, subs: Math.round(s.subs * (0.2 + rnd() * 3)), views: Math.round(s.views * (0.2 + rnd() * 3)) })),
      })
      modelo.forEach((v, j) => {
        const idade = rnd() < 0.5 ? int(0, 90) : int(91, 1800), pub = ds.now - idade * DAY - int(0, DAY - 1)
        const views = Math.round(10 ** (2 + rnd() * 5)), k = 0.1 + rnd() * 4
        videos.push({
          ...v, id: `${id}-v${j}-${ytId()}`, ch: id, ytId: ytId(), title: titulo(), pub, ageDays: idade, tracked: rnd() < 0.7, views,
          likes: Math.round(views * rnd() * 0.08), comments: Math.round(views * rnd() * 0.01), dur: int(20, 5_400), isShort: rnd() < 0.3 ? true : rnd() < 0.05 ? null : false,
          fmt: 'long', series: v.series.map(p => ({ ...p, views: Math.round(p.views * k) })),
        })
      })
    }
    for (const v of videos) if (v.isShort === true) v.fmt = 'short'
    const grande: Dataset = { ...ds, channels: canais, videos }
    expect(canais.length).toBe(75)
    // dado de verdade variado: os títulos e os ids não se repetem entre canais
    expect(new Set(videos.filter(v => v.ch.startsWith('ch-')).map(v => v.title)).size).toBeGreaterThan(14_000)
    expect(new Set(videos.filter(v => v.ch.startsWith('ch-')).map(v => v.ytId)).size).toBeGreaterThan(14_000)
    const t0 = Date.now()
    const p = buildCompararPack(createTestObservatory(grande))
    const json = JSON.stringify(p), gz = gzipSync(json).length
    // eslint-disable-next-line no-console
    console.info(`pacote com 75 canais × 200 vídeos variados: ${(json.length / 1024).toFixed(1)} KB sem compressão, ${(gz / 1024).toFixed(1)} KB com gzip, ${Date.now() - t0} ms para montar`)
    expect(p.canais.length).toBe(75)
    expect(gz).toBeLessThan(250 * 1024)
    expect(json.length).toBeLessThan(TETO_CRU)
  }, 120_000)
})

describe('link.comparar', () => {
  it('a e b na ordem fixa; sem argumentos, a rota sem query', () => {
    expect(link.comparar()).toBe(`${OBS_BASE}/comparar`)
    expect(link.comparar('x', 'y')).toBe(`${OBS_BASE}/comparar?a=x&b=y`)
    expect(link.comparar(undefined, 'y')).toBe(`${OBS_BASE}/comparar?b=y`)
    expect(link.comparar('x')).toBe(`${OBS_BASE}/comparar?a=x`)
    expect(link.comparar('', '')).toBe(`${OBS_BASE}/comparar`)
    expect(link.comparar('a b', 'c&d')).toBe(`${OBS_BASE}/comparar?a=a+b&b=c%26d`)
  })
})
