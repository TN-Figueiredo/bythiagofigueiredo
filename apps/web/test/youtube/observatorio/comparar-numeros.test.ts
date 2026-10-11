// @vitest-environment node
// A3 Tarefa 5: os treze números de um canal na comparação (modelo, sem tela). Cada número: o caso medido, o zero medido e
// cada causa de ausência, afirmando o valor nulo E a frase. Este sistema falha em verde: o teste pergunta "o que sai
// quando o dado não existe?" antes de "quando dá erro?".
import { describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { numerosDoCanal, NUMEROS, NO_NICHO, MOTIVOS, motivoTexto, type Numero, type NumeroId } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { acima2x, durText, vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const DAY = 86_400_000
const PALAVRAS_INTERNAS = /\b(pack|pacote|dataset|conjunto do site|motor|sentinela|R73|escala √|ranking)\b/i

/** O oráculo guarda a duração como "mm:ss"; o dataset de produção a guarda em segundos (ObsVideo.dur). */
function secondsOf(d: unknown): number | null {
  if (typeof d === 'number' || d == null) return d ?? null
  return String(d).split(':').map(Number).reduce((a, x) => a * 60 + x, 0)
}
/** O mundo da A3, com a duração em segundos como a produção a entrega; `mut` roda numa cópia, antes do motor. */
function world(mut?: (ds: Dataset) => void) {
  return a3World(ds => { for (const v of ds.videos) v.dur = secondsOf(v.dur); mut?.(ds) })
}
const BASE = world() // lido uma vez por arquivo
const CH = 'leo-khev' // concorrente sincronizado, com longos e Shorts, 78 longos com mais de 90 dias e 15 com até 90
const OWN = 'tnfigueiredo'
const OWN2 = 'tnfigueiredo-en'
const BF = 'vou-sem-volta' // primeira sincronização (backfill)

const nums = (obs: Observatory, id: string) => numerosDoCanal(obs, id)
const vidsOf = (ds: Dataset, id: string) => ds.videos.filter(v => v.ch === id)
const semVideos = (id: string) => (ds: Dataset) => { ds.videos = ds.videos.filter(v => v.ch !== id); ds.channels.find(c => c.id === id)!.undated = [] }
const naoMedido = (n: Numero, motivo: string) => { expect(n.x).toBeNull(); expect(n.texto).toBeNull(); expect(n.motivo).toBe(motivo) }
const medido = (n: Numero) => { expect(n.x).not.toBeNull(); expect(n.texto).not.toBeNull(); expect(n.motivo).toBeNull() }

describe('os treze números: forma', () => {
  it('são treze, na ordem do spec 18.4, e seis têm régua no nicho', () => {
    expect([...NUMEROS]).toEqual(['inscritos', 'inscritos30', 'longosAcomp', 'longos90', 'ritmo', 'diasUltimo', 'medianaViews', 'vpd', 'vpdPorMil', 'engajamento', 'acima2x', 'duracao', 'trocas30'])
    expect([...NO_NICHO].sort()).toEqual(['inscritos', 'longos90', 'longosAcomp', 'medianaViews', 'vpd', 'vpdPorMil'])
    expect(Object.keys(nums(BASE.obs, CH))).toEqual([...NUMEROS])
  })
  it('canal que não existe lança, não devolve números de mentira', () => {
    expect(() => nums(BASE.obs, 'nao-existe')).toThrow()
  })
})

describe('inscritos', () => {
  it('o número; canal que esconde a contagem → não medido, "inscritos ocultos pelo canal"', () => {
    const n = nums(BASE.obs, CH).inscritos
    expect(n.x).toBe(1_120_000); expect(n.texto).toBe(BASE.obs.fmt.subs(1_120_000)); expect(n.motivo).toBeNull()
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.subs = null })
    naoMedido(nums(w.obs, CH).inscritos, 'inscritos ocultos pelo canal')
  })
  it('zero inscritos é zero medido ("0"), não nulo', () => {
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.subs = 0 })
    const n = nums(w.obs, CH).inscritos
    expect(n.x).toBe(0); expect(n.texto).toBe('0'); expect(n.motivo).toBeNull()
  })
  it('canal em primeira sincronização: a contagem de inscritos é medida; escondida, é "ocultos" (e não a frase da sincronização)', () => {
    expect(nums(BASE.obs, BF).inscritos.x).toBe(128_000)
    const w = world(ds => { ds.channels.find(c => c.id === BF)!.subs = null })
    naoMedido(nums(w.obs, BF).inscritos, 'inscritos ocultos pelo canal')
  })
})

describe('inscritos em 30 dias', () => {
  const growthOf = (obs: Observatory, id: string) => obs.channelStats(id, 'long').growth30
  it('percentual com a nota "de A para B", os mesmos dois números do cabeçalho do canal', () => {
    const id = 'nate-herk', n = nums(BASE.obs, id).inscritos30, g = growthOf(BASE.obs, id), ch = BASE.obs.channel(id)!
    expect(g.withinRounding).toBe(false) // precondição: crescimento real, fora do arredondamento
    const de = ch.snapshots.find(s => s.t === g.from)!.subs, para = ch.snapshots.find(s => s.t === g.to)!.subs
    expect(n.x).toBeCloseTo(g.pct!, 10)
    expect(n.texto).toBe(`+${BASE.obs.fmt.dec1(g.pct! * 100)}%`)
    expect(n.nota).toBe(`de ${BASE.obs.fmt.int(de)} para ${BASE.obs.fmt.int(para)}`)
    expect(n.motivo).toBeNull()
    expect(n.texto).toBe(buildCanalHeader(BASE.obs, id)!.faixa.find(c => c.key === 'growth30')!.value)
  })
  it('dentro do arredondamento: "≈ 0", com a nota', () => {
    const id = 'bald-and-bankrupt', g = growthOf(BASE.obs, id)
    expect(g.withinRounding).toBe(true) // precondição do fixture: 4,51 mi → 4,51 mi
    const n = nums(BASE.obs, id).inscritos30
    expect(n.texto).toBe('≈ 0'); expect(n.motivo).toBeNull(); expect(n.x).not.toBeNull()
    expect(n.nota).toMatch(/^de [\d.]+ para [\d.]+$/)
  })
  it('canal próprio → não medido com o motivo do spec 16.1 (hoje o canal próprio não tem a contagem diária)', () => {
    for (const id of [OWN, OWN2]) naoMedido(nums(BASE.obs, id).inscritos30, 'sem contagem de 30 dias atrás')
  })
  it('concorrente sem 30 dias de contagem → o motivo do motor ("faltam N d …")', () => {
    const w = world(ds => { const c = ds.channels.find(c => c.id === CH)!; c.snapshots = c.snapshots.slice(-5) })
    const pend = growthOf(w.obs, CH).pending!
    expect(pend).toMatch(/^faltam \d+ d/)
    naoMedido(nums(w.obs, CH).inscritos30, `sem contagem de 30 dias atrás: ${pend}`)
  })
  it('concorrente sem nenhuma contagem → "sem contagem de 30 dias atrás"', () => {
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.snapshots = [] })
    naoMedido(nums(w.obs, CH).inscritos30, 'sem contagem de 30 dias atrás')
  })
  it('a contagem anterior era zero: não há percentual → não medido com a frase, nunca "Infinity%"', () => {
    const w = world(ds => {
      const c = ds.channels.find(c => c.id === CH)!, now = c.snapshots[c.snapshots.length - 1]!
      c.snapshots.filter(s => s.t <= now.t - 30 * DAY).forEach(s => { s.subs = 0 })
    })
    expect(growthOf(w.obs, CH).pct).toBeNull() // precondição
    naoMedido(nums(w.obs, CH).inscritos30, 'sem percentual: o canal não tinha inscritos na contagem anterior')
  })
  it('canal em primeira sincronização → não medido, a frase da sincronização', () => {
    naoMedido(nums(BASE.obs, BF).inscritos30, 'a primeira sincronização ainda não terminou')
  })
})

describe('longos acompanhados', () => {
  it('só longos (não soma Shorts, D10)', () => {
    const n = nums(BASE.obs, CH).longosAcomp, S = BASE.obs.channelStats(CH, 'long')
    const esperado = vidsOf(BASE.ds, CH).filter(v => v.tracked && v.fmt === 'long').length
    expect(esperado).toBe(52) // precondição
    expect(n.x).toBe(esperado); expect(n.texto).toBe('52'); expect(n.motivo).toBeNull()
    expect(S.tracked).toBeGreaterThan(esperado) // o motor soma os Shorts: o número da comparação não é esse
  })
  it('canal só com Shorts: zero medido "0", não nulo', () => {
    const w = world(ds => { ds.videos = ds.videos.filter(v => !(v.ch === CH && v.fmt === 'long')) })
    const n = nums(w.obs, CH).longosAcomp
    expect(n.x).toBe(0); expect(n.texto).toBe('0'); expect(n.motivo).toBeNull()
  })
  it('canal sem vídeos → não medido "sem vídeos"', () => {
    const w = world(semVideos(CH))
    naoMedido(nums(w.obs, CH).longosAcomp, 'sem vídeos')
  })
  it('canal em primeira sincronização → não medido', () => {
    naoMedido(nums(BASE.obs, BF).longosAcomp, 'a primeira sincronização ainda não terminou')
  })
  it('canal próprio sem vídeos → "sem vídeos"', () => {
    const w = world(semVideos(OWN2))
    naoMedido(nums(w.obs, OWN2).longosAcomp, 'sem vídeos')
  })
})

describe('longos em 90 dias', () => {
  it('conta todo longo guardado com data de até 90 dias (D9), acompanhado ou não', () => {
    const w = world(ds => { const v = vidsOf(ds, CH).find(v => v.fmt === 'long' && v.ageDays <= 90)!; v.tracked = false })
    const esperado = vidsOf(w.ds, CH).filter(v => v.fmt === 'long' && v.ageDays <= 90).length
    expect(esperado).toBe(15) // precondição
    const n = nums(w.obs, CH).longos90
    expect(n.x).toBe(15); expect(n.texto).toBe('15'); expect(n.motivo).toBeNull()
  })
  it('0 é zero medido ("0"), não nulo', () => {
    const w = world(ds => { ds.videos = ds.videos.filter(v => !(v.ch === CH && v.fmt === 'long' && v.ageDays <= 90)) })
    const n = nums(w.obs, CH).longos90
    expect(n.x).toBe(0); expect(n.texto).toBe('0'); expect(n.motivo).toBeNull()
  })
  it('canal em primeira sincronização → não medido', () => {
    naoMedido(nums(BASE.obs, BF).longos90, 'a primeira sincronização ainda não terminou')
  })
  it('canal sem vídeos → "sem vídeos"', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).longos90, 'sem vídeos')
  })
})

describe('ritmo', () => {
  const w = (x: number) => (x === 0 ? '0' : BASE.obs.fmt.dec1(x))
  it('"0,2 + 1,0" com a nota "N longos e M Shorts em 13 semanas"', () => {
    const kl = BASE.obs.cadence(CH, 'long'), ks = BASE.obs.cadence(CH, 'short'), n = nums(BASE.obs, CH).ritmo
    expect(n.texto).toBe(`${w(kl.pw)} + ${w(ks.pw)}`)
    expect(n.x).toBeCloseTo(kl.pw + ks.pw, 10)
    expect(n.nota).toBe(`${kl.n} ${kl.n === 1 ? 'longo' : 'longos'} e ${ks.n} ${ks.n === 1 ? 'Short' : 'Shorts'} em 13 semanas`)
    expect(n.motivo).toBeNull()
    expect(kl.pw).toBeGreaterThan(0); expect(ks.pw).toBeGreaterThan(0) // o caso "dois lados diferentes de zero"
  })
  it('é o mesmo ritmo do cabeçalho do canal', () => {
    for (const id of BASE.obs.channels.filter(c => !c.own && c.sync.state === 'ok').map(c => c.id)) {
      const h = buildCanalHeader(BASE.obs, id)!.faixa.find(c => c.key === 'ritmo')!.value!
      expect(nums(BASE.obs, id).ritmo.texto, id).toBe(h.replace(/\b0,0\b/g, '0'))
    }
  })
  it('os dois em zero → x 0 e texto "0 + 0"; um só em zero → "0 + 1,0"', () => {
    const wz = world(ds => { const corte = BASE.obs.NOW - 91 * DAY; ds.videos = ds.videos.filter(v => !(v.ch === CH && v.pub > corte)) })
    const n = nums(wz.obs, CH).ritmo
    expect(n.x).toBe(0); expect(n.texto).toBe('0 + 0'); expect(n.nota).toBe('0 longos e 0 Shorts em 13 semanas'); expect(n.motivo).toBeNull()
    const ws = world(ds => { ds.videos = ds.videos.filter(v => !(v.ch === CH && v.fmt === 'long' && v.pub > BASE.obs.NOW - 91 * DAY)) })
    const n2 = nums(ws.obs, CH).ritmo, ks = ws.obs.cadence(CH, 'short')
    expect(n2.texto).toBe(`0 + ${w(ks.pw)}`)
  })
  it('canal sem vídeos → "sem vídeos"; primeira sincronização → a frase da sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).ritmo, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).ritmo, 'a primeira sincronização ainda não terminou')
  })
})

describe('dias desde o último vídeo', () => {
  it('dias inteiros até agora, com a nota "publicado em …"', () => {
    const n = nums(BASE.obs, CH).diasUltimo, D = BASE.obs.date
    const ult = Math.max(...vidsOf(BASE.ds, CH).map(v => v.pub))
    expect(n.x).toBe(Math.floor((BASE.obs.NOW - ult) / DAY)); expect(n.texto).toBe(String(n.x)); expect(n.motivo).toBeNull()
    expect(n.nota).toBe(`publicado em ${D.dmOrDmy(ult)}`)
  })
  it('publicado há menos de um dia é zero medido ("0")', () => {
    const w = world(ds => { const v = vidsOf(ds, CH).reduce((a, b) => (a.pub > b.pub ? a : b)); v.pub = BASE.obs.NOW - 3_600_000; v.ageDays = 0 })
    const n = nums(w.obs, CH).diasUltimo
    expect(n.x).toBe(0); expect(n.texto).toBe('0'); expect(n.motivo).toBeNull()
  })
  it('só vídeos sem data de publicação → não medido "nenhum vídeo com data de publicação"', () => {
    const w = world(ds => {
      const c = ds.channels.find(c => c.id === CH)!
      c.undated = [{ id: 'sd-1', ytId: 'abc', title: 'Sem data', url: 'https://youtu.be/abc', isShort: false, dur: 600, views: 10, likes: 1, comments: 0, pinned: false, checkedAt: null }]
      ds.videos = ds.videos.filter(v => v.ch !== CH)
    })
    naoMedido(nums(w.obs, CH).diasUltimo, 'nenhum vídeo com data de publicação')
  })
  it('canal sem vídeos → "sem vídeos"; primeira sincronização → a frase da sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).diasUltimo, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).diasUltimo, 'a primeira sincronização ainda não terminou')
  })
  it('Short conta: o último vídeo é o mais recente de qualquer formato (como o cabeçalho)', () => {
    const h = buildCanalHeader(BASE.obs, CH)!.todos.find(c => c.key === 'ultimoVideo')!
    const n = nums(BASE.obs, CH).diasUltimo
    expect(h.base).toContain(n.nota!.replace('publicado em ', '').slice(0, 5))
  })
})

describe('mediana de views dos longos', () => {
  it('é igual à célula do cabeçalho do canal (header-model) para o mesmo canal', () => {
    for (const id of BASE.obs.channels.filter(c => c.sync.state !== 'backfill').map(c => c.id)) {
      const h = buildCanalHeader(BASE.obs, id)!.todos.find(c => c.key === 'medianaViews')!.value!
      const n = nums(BASE.obs, id).medianaViews
      expect(h.startsWith(`${BASE.obs.fmt.num(n.x)} longos`), id).toBe(true)
      expect(n.texto).toBe(BASE.obs.fmt.num(n.x))
    }
  })
  it('zero medido: todas as views dos longos em zero → "0"', () => {
    const w = world(ds => { vidsOf(ds, CH).filter(v => v.fmt === 'long').forEach(v => { v.views = 0 }) })
    const n = nums(w.obs, CH).medianaViews
    expect(n.x).toBe(0); expect(n.texto).toBe('0'); expect(n.motivo).toBeNull()
  })
  it('nenhum longo com contagem de views → não medido, nunca 0', () => {
    const w = world(ds => { vidsOf(ds, CH).filter(v => v.fmt === 'long').forEach(v => { v.views = null }) })
    naoMedido(nums(w.obs, CH).medianaViews, 'nenhum longo com contagem de views')
  })
  it('canal sem vídeos → "sem vídeos"; primeira sincronização → a frase da sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).medianaViews, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).medianaViews, 'a primeira sincronização ainda não terminou')
  })
})

describe('views por dia e por mil inscritos', () => {
  it('iguais a channelStats (concorrente)', () => {
    for (const id of BASE.obs.channels.filter(c => !c.own && c.sync.state !== 'backfill').map(c => c.id)) {
      const S = BASE.obs.channelStats(id, 'long'), n = nums(BASE.obs, id)
      expect(n.vpd.x, id).toBe(S.vpdMedian)
      expect(n.vpd.texto, id).toBe(vpdText(S.vpdMedian, BASE.obs.fmt.num))
      expect(n.vpdPorMil.x, id).toBe(S.perMilSubs)
      expect(n.vpdPorMil.texto, id).toBe(BASE.obs.fmt.dec1(S.perMilSubs!))
    }
  })
  it('o texto de views por dia por mil é o da célula da lista de Canais (escala "por mil") e o do cabeçalho', () => {
    const v = buildCanaisView(BASE.obs, { niche: 'todos', limit: 75, fmt: 'longos', scale: 'per-mil' })
    const linhas = [...v.list.ranked, ...v.list.unranked].filter(r => !r.own && r.cells.vpd.kind === 'ok')
    expect(linhas.length).toBeGreaterThan(8) // o laço tem o que olhar
    for (const r of linhas) {
      const cel = r.cells.vpd
      if (cel.kind !== 'ok') continue
      expect(nums(BASE.obs, r.id).vpdPorMil.texto, r.id).toBe(cel.big)
      expect(buildCanalHeader(BASE.obs, r.id)!.todos.find(c => c.key === 'vpdPorMil')!.value, r.id).toBe(cel.big)
    }
  })
  it('canal próprio → não medido "a coleta diária do seu canal começa em breve", nos dois números', () => {
    for (const id of [OWN, OWN2]) {
      const n = nums(BASE.obs, id)
      naoMedido(n.vpd, 'a coleta diária do seu canal começa em breve')
      naoMedido(n.vpdPorMil, 'a coleta diária do seu canal começa em breve')
    }
  })
  it('concorrente sem 2º registro diário → "aguarda o 2º registro diário", nos dois', () => {
    const w = world(ds => { vidsOf(ds, CH).forEach(v => { v.series = []; v.firstIdx = null }) })
    expect(w.obs.channelStats(CH, 'long').vpdMedian).toBeNull() // precondição
    const n = nums(w.obs, CH)
    naoMedido(n.vpd, 'aguarda o 2º registro diário'); naoMedido(n.vpdPorMil, 'aguarda o 2º registro diário')
  })
  it('inscritos ocultos: views por dia medido, por mil → "inscritos ocultos pelo canal"', () => {
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.subs = null })
    const n = nums(w.obs, CH)
    medido(n.vpd); naoMedido(n.vpdPorMil, 'inscritos ocultos pelo canal')
  })
  it('canal sem vídeos e primeira sincronização', () => {
    const a = nums(world(semVideos(CH)).obs, CH), b = nums(BASE.obs, BF)
    naoMedido(a.vpd, 'sem vídeos'); naoMedido(a.vpdPorMil, 'sem vídeos')
    naoMedido(b.vpd, 'a primeira sincronização ainda não terminou'); naoMedido(b.vpdPorMil, 'a primeira sincronização ainda não terminou')
  })
  it('views por dia abaixo de 10 com uma casa decimal; zero exato é "0" (vpdText)', () => {
    // série achatada: a mediana cai para zero
    const w0 = world(ds => { vidsOf(ds, CH).forEach(v => { const p0 = v.series[0]; v.series = p0 ? v.series.map(p => ({ ...p, views: p0.views })) : [] }) })
    expect(w0.obs.channelStats(CH, 'long').vpdMedian).toBe(0) // precondição: sem condicional, o zero tem de existir
    const n0 = nums(w0.obs, CH)
    expect(n0.vpd.x).toBe(0); expect(n0.vpd.texto).toBe('0'); expect(n0.vpd.motivo).toBeNull()
    expect(n0.vpdPorMil.x).toBe(0); expect(n0.vpdPorMil.texto).toBe('0')
    // série achatada pela metade do caminho: abaixo de 10, uma casa
    const f = 4 / BASE.obs.channelStats(CH, 'long').vpdMedian!
    const w1 = world(ds => { vidsOf(ds, CH).forEach(v => { const p0 = v.series[0]; if (p0) v.series = v.series.map(p => ({ ...p, views: p0.views + (p.views - p0.views) * f })) }) })
    const x = nums(w1.obs, CH).vpd
    expect(x.x!).toBeGreaterThan(0.1); expect(x.x!).toBeLessThan(10)
    expect(x.texto).toMatch(/^\d,\d$/)
    expect(x.texto).toBe(vpdText(x.x, w1.obs.fmt.num))
  })
  it('por mil positivo que arredonda para 0,0 diz "menos de 0,1", nunca "0,0"', () => {
    const w = world(ds => { ds.channels.find(c => c.id === CH)!.subs = 900_000_000_000 })
    const n = nums(w.obs, CH).vpdPorMil
    expect(n.x!).toBeGreaterThan(0); expect(n.x!).toBeLessThan(0.05)
    expect(n.texto).toBe('menos de 0,1')
  })
})

describe('engajamento', () => {
  /** Longos do canal com a engajamento dado: gravidos, sem os outros longos. */
  const comEng = (grupos: Array<{ ageDays: number; n: number; views: number | null; likes: number | null; comments: number | null }>) => (ds: Dataset) => {
    const outros = ds.videos.filter(v => !(v.ch === CH && v.fmt === 'long'))
    const molde = ds.videos.find(v => v.ch === CH && v.fmt === 'long')!
    let i = 0
    const novos = grupos.flatMap(g => Array.from({ length: g.n }, () => ({ ...molde, id: `eng-${i++}`, ageDays: g.ageDays, pub: BASE.obs.NOW - g.ageDays * DAY - 3_600_000, tracked: true, views: g.views, likes: g.likes, comments: g.comments })))
    ds.videos = [...outros, ...novos]
  }
  it('SEM janela de 90 dias: entra todo longo guardado com views > 0, curtidas e comentários não nulos', () => {
    const w = world(comEng([{ ageDays: 400, n: 5, views: 1000, likes: 150, comments: 50 }, { ageDays: 10, n: 2, views: 1000, likes: 40, comments: 10 }]))
    const n = nums(w.obs, CH).engajamento
    expect(n.x).toBeCloseTo(0.2, 10); expect(n.texto).toBe('20,0%'); expect(n.motivo).toBeNull() // mediana de 5×0,20 e 2×0,05
  })
  it('comentário nulo fica de fora, não entra como 0; views 0 e curtida nula também', () => {
    const w = world(comEng([
      { ageDays: 30, n: 4, views: 1000, likes: 150, comments: 50 },      // 0,20
      { ageDays: 30, n: 6, views: 1000, likes: 0, comments: null },      // fora (se entrasse como 0, a mediana cairia a 0)
      { ageDays: 30, n: 3, views: 0, likes: 5, comments: 5 },            // fora: dividir por zero
      { ageDays: 30, n: 3, views: 1000, likes: null, comments: 3 },      // fora
    ]))
    const n = nums(w.obs, CH).engajamento
    expect(n.x).toBeCloseTo(0.2, 10); expect(n.texto).toBe('20,0%')
    expect(n.nota).toContain('4 longos')
  })
  it('difere do engajamento do cabeçalho do canal quando há longos com mais de 90 dias, e a nota diz a base', () => {
    const w = world(comEng([{ ageDays: 400, n: 6, views: 1000, likes: 450, comments: 50 }, { ageDays: 20, n: 3, views: 1000, likes: 80, comments: 20 }]))
    const h = buildCanalHeader(w.obs, CH)!.faixa.find(c => c.key === 'engajamento')!.value
    const n = nums(w.obs, CH).engajamento
    expect(h).toBe('10,0%')
    expect(n.texto).toBe('50,0%')
    expect(n.nota).toBe('mediana de 9 longos guardados, de qualquer idade')
  })
  it('zero medido: curtidas e comentários em zero → "0,0%"', () => {
    const w = world(comEng([{ ageDays: 30, n: 3, views: 500, likes: 0, comments: 0 }]))
    const n = nums(w.obs, CH).engajamento
    expect(n.x).toBe(0); expect(n.texto).toBe('0,0%'); expect(n.motivo).toBeNull()
  })
  it('nenhum longo com curtidas e comentários → não medido', () => {
    const w = world(comEng([{ ageDays: 30, n: 3, views: 500, likes: 4, comments: null }]))
    naoMedido(nums(w.obs, CH).engajamento, 'nenhum longo com curtidas e comentários')
  })
  it('canal sem vídeos → "sem vídeos"; primeira sincronização → a frase da sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).engajamento, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).engajamento, 'a primeira sincronização ainda não terminou')
  })
})

describe('vídeos acima de 2×', () => {
  it('"k de n" dos longos de até 90 dias; igual ao cabeçalho', () => {
    for (const id of BASE.obs.channels.filter(c => !c.own && c.sync.state !== 'backfill').map(c => c.id)) {
      const S = BASE.obs.channelStats(id, 'long'), n = nums(BASE.obs, id).acima2x
      expect(n.x, id).toBe(S.outliers90); expect(n.texto, id).toBe(`${S.outliers90} de ${S.pctOutliersN}`); expect(n.motivo).toBeNull()
      expect(buildCanalHeader(BASE.obs, id)!.faixa.find(c => c.key === 'acima2x')!.value, id).toBe(String(S.outliers90))
    }
  })
  it('zero medido: nenhum acima de 2×, mas há longos com múltiplo → "0 de n", não nulo', () => {
    const n = nums(BASE.obs, CH).acima2x, S = BASE.obs.channelStats(CH, 'long')
    expect(S.outliers90).toBe(0); expect(S.pctOutliersN).toBe(11) // precondição do fixture
    expect(n.x).toBe(0); expect(n.texto).toBe('0 de 11'); expect(n.motivo).toBeNull()
    expect(acima2x({ pctOutliersN: 5, outliers90: 0 })).toEqual({ k: 0, de: 5 })
    expect(acima2x({ pctOutliersN: 0, outliers90: 0 })).toBeNull()
  })
  it('sem nenhum longo com múltiplo em 90 dias → não medido (concorrente e canal próprio têm frases diferentes)', () => {
    const sem = (id: string) => (ds: Dataset) => { ds.videos = ds.videos.filter(v => !(v.ch === id && v.fmt === 'long' && v.ageDays <= 90)) }
    naoMedido(nums(world(sem(CH)).obs, CH).acima2x, 'nenhum vídeo com múltiplo em 90 dias')
    naoMedido(nums(world(sem(OWN)).obs, OWN).acima2x, 'nenhum vídeo seu nos últimos 90 dias')
  })
  it('canal sem vídeos → "sem vídeos"; primeira sincronização → a frase da sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).acima2x, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).acima2x, 'a primeira sincronização ainda não terminou')
  })
})

describe('duração mediana dos longos', () => {
  it('mm:ss ou h:mm:ss, igual ao cabeçalho', () => {
    expect(durText(754)).toBe('12:34'); expect(durText(3725)).toBe('1:02:05'); expect(durText(59)).toBe('00:59')
    for (const id of BASE.obs.channels.filter(c => c.sync.state !== 'backfill').map(c => c.id)) {
      const n = nums(BASE.obs, id).duracao, h = buildCanalHeader(BASE.obs, id)!.todos.find(c => c.key === 'duracaoMediana')!.value
      expect(n.texto, id).toBe(h); expect(n.texto).toBe(n.x == null ? null : durText(n.x))
    }
    expect(nums(BASE.obs, CH).duracao.x).not.toBeNull()
  })
  it('hora cheia: h:mm:ss', () => {
    const w = world(ds => { vidsOf(ds, CH).filter(v => v.fmt === 'long').forEach(v => { v.dur = 3725 }) })
    const n = nums(w.obs, CH).duracao
    expect(n.x).toBe(3725); expect(n.texto).toBe('1:02:05')
  })
  it('sem duração guardada → não medido "nenhum longo com duração"', () => {
    const w = world(ds => { vidsOf(ds, CH).filter(v => v.fmt === 'long').forEach(v => { v.dur = null }) })
    naoMedido(nums(w.obs, CH).duracao, 'nenhum longo com duração')
  })
  it('canal sem vídeos → "sem vídeos"; primeira sincronização → a frase da sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).duracao, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).duracao, 'a primeira sincronização ainda não terminou')
  })
})

describe('trocas em 30 dias', () => {
  it('título e thumbnail (não descrição), igual ao cabeçalho', () => {
    const id = 'matt-wolfe', todas = BASE.obs.changesIn({ days: 30, channel: id })
    const contam = todas.filter(c => c.type === 'title' || c.type === 'thumb').length
    expect(todas.length).toBeGreaterThan(contam) // há troca de descrição na janela
    const n = nums(BASE.obs, id).trocas30
    expect(n.x).toBe(contam); expect(n.texto).toBe(String(contam)); expect(n.motivo).toBeNull()
    expect(buildCanalHeader(BASE.obs, id)!.todos.find(c => c.key === 'trocas30')!.value).toBe(String(contam))
  })
  it('zero medido: nenhuma troca em 30 dias → "0"', () => {
    const n = nums(BASE.obs, CH).trocas30
    expect(BASE.obs.changesIn({ days: 30, channel: CH }).length).toBe(0)
    expect(n.x).toBe(0); expect(n.texto).toBe('0'); expect(n.motivo).toBeNull()
  })
  it('canal próprio → não medido "as trocas do seu canal ficam no A/B Lab"', () => {
    for (const id of [OWN, OWN2]) naoMedido(nums(BASE.obs, id).trocas30, 'as trocas do seu canal ficam no A/B Lab')
  })
  it('canal sem vídeos e primeira sincronização', () => {
    naoMedido(nums(world(semVideos(CH)).obs, CH).trocas30, 'sem vídeos')
    naoMedido(nums(BASE.obs, BF).trocas30, 'a primeira sincronização ainda não terminou')
  })
  it('canal próprio sem vídeos diz "sem vídeos" (a ausência de vídeos vem antes do A/B Lab)', () => {
    naoMedido(nums(world(semVideos(OWN2)).obs, OWN2).trocas30, 'sem vídeos')
  })
})

describe('o mesmo canal mostra o mesmo número na comparação, no cabeçalho do canal e na lista de Canais', () => {
  it('ritmo, crescimento e views por dia por mil batem com a célula da lista', () => {
    const v = buildCanaisView(BASE.obs, { niche: 'todos', limit: 75, fmt: 'longos', scale: 'per-mil' })
    const rows = [...v.list.ranked, ...v.list.unranked].filter(r => !r.own && r.sync.state === 'ok')
    expect(rows.length).toBeGreaterThan(8)
    for (const r of rows) {
      const n = nums(BASE.obs, r.id)
      const g = r.cells.growth
      if (g.kind === 'ok' || g.kind === 'flat') expect(n.inscritos30.texto?.replace(/\s/g, ''), r.id).toBe(g.big.replace(/\s/g, ''))
      if (r.cells.cadence.kind === 'ok') expect(n.ritmo.texto!.split(' + ')[0]!.replace(/^0$/, '0,0'), r.id).toBe(r.cells.cadence.pw)
    }
  })
})

describe('invariantes sobre todos os canais', () => {
  /** Um mundo com todas as causas de ausência ao mesmo tempo. */
  const extremo = world(ds => {
    semVideos('paddy-doyle')(ds)
    ds.channels.find(c => c.id === 'nomade-raiz')!.subs = null
    vidsOf(ds, 'dale-philip').forEach(v => { v.series = []; v.firstIdx = null })
    semVideos(OWN2)(ds)
    ds.videos = ds.videos.filter(v => !(v.ch === 'matheus-fonseca' && v.fmt === 'long'))
    ds.channels.find(c => c.id === 'luke-damant')!.snapshots = []
  })
  const mundos: Array<[string, Observatory]> = [['base', BASE.obs], ['extremo', extremo.obs]]
  const todos = (obs: Observatory) => obs.channels.flatMap(c => NUMEROS.map(k => ({ id: c.id, k, n: nums(obs, c.id)[k] })))

  it('texto null ⇔ x null ⇔ motivo preenchido; nenhum texto é "—", "NaN", "Infinity" ou vazio', () => {
    for (const [nome, obs] of mundos) {
      for (const { id, k, n } of todos(obs)) {
        const rotulo = `${nome}/${id}/${k}`
        expect(n.texto == null, rotulo).toBe(n.x == null)
        expect(n.motivo == null, rotulo).toBe(n.x != null)
        if (n.x != null) { expect(Number.isFinite(n.x), rotulo).toBe(true); expect(n.texto!.trim().length, rotulo).toBeGreaterThan(0) }
        else expect(n.motivo!.trim().length, rotulo).toBeGreaterThan(0)
        for (const s of [n.texto, n.motivo, n.nota]) if (s != null) expect(s, rotulo).not.toMatch(/^—$|NaN|Infinity|undefined|null/)
      }
    }
  })
  it('o mundo extremo tem de verdade nulos de cada tipo (o teste acima não passa por não ter o que olhar)', () => {
    const motivos = new Set(todos(extremo.obs).map(x => x.n.motivo).filter((m): m is string => m != null))
    for (const frase of ['inscritos ocultos pelo canal', 'sem vídeos', 'a primeira sincronização ainda não terminou', 'aguarda o 2º registro diário',
      'a coleta diária do seu canal começa em breve', 'as trocas do seu canal ficam no A/B Lab', 'sem contagem de 30 dias atrás']) expect(motivos.has(frase), frase).toBe(true)
    expect([...motivos].some(m => m.startsWith('sem contagem de 30 dias atrás'))).toBe(true)
  })
  it('nenhum motivo traz palavra interna (todos os motivos possíveis e todos os que saem no fixture)', () => {
    for (const m of MOTIVOS) expect(motivoTexto(m), m.k).not.toMatch(PALAVRAS_INTERNAS)
    for (const [, obs] of mundos) for (const { n } of todos(obs)) for (const s of [n.motivo, n.nota, n.texto]) if (s) expect(s).not.toMatch(PALAVRAS_INTERNAS)
  })
  it('cada tipo de motivo tem uma frase própria e não vazia', () => {
    const frases = MOTIVOS.map(m => motivoTexto(m))
    for (const f of frases) expect(f.trim().length).toBeGreaterThan(0)
    expect(new Set(frases).size).toBe(frases.length)
  })
})
