// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, loadOracleOwns, datasetFromOracle, createTestObservatory } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { headerAsk } from '@/app/cms/(authed)/youtube/competitors/_historico/forja-card-model'
import { buildMudancasView, mudancasList, effectView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'

const oracle = loadOracle()
const obs = createObservatory(datasetFromOracle(oracle))

/** The mockup's demo picks (historico-video.html pickStates), one per edge case. */
const PICK = {
  full: 'matt-opus55', pre: 'nate-ai-agent-business', few: 'matt-fast-cheap', none: 'matt-gpt6-astra', noreg: 'paddy-doyle-l0',
  untr: 'luke-damant-l71', old: 'preguica-hailuo', err: 'esq-lawsuit', bf: 'vou-sem-volta-s0',
} as const

const lane = (id: string, type: 'title' | 'thumb' | 'desc') => buildHistoricoView(obs, id, {}).lanes.find(l => l.type === type)!

describe('historico view model', () => {
  it('the picks are the mockup demo videos (oracle SHOWCASE)', () => {
    expect(oracle.SHOWCASE).toBe(PICK.full)
  })

  it('each demo video gets its state', () => {
    for (const [k, id] of Object.entries(PICK)) expect([k, buildHistoricoView(obs, id, {}).state]).toEqual([k, k])
  })

  it('participle follows the type: title visto/trocado; thumbnail and description vista/trocada', () => {
    const t = lane(PICK.full, 'title').versions[1]!, th = lane(PICK.full, 'thumb').versions[1]!, d = lane(PICK.full, 'desc').versions[1]!
    expect([t.participle, t.changedParticiple]).toEqual(['visto', 'trocado'])
    expect([th.participle, th.changedParticiple]).toEqual(['vista', 'trocada'])
    expect([d.participle, d.changedParticiple]).toEqual(['vista', 'trocada'])
    // the texts use it: the title T2 start is a 6 h window ("visto pela 1ª vez"), T1 ends "trocado entre …"
    expect(t.from).toBe('visto pela 1ª vez 11/10 12h')
    expect(lane(PICK.full, 'title').versions[0]!.to).toBe('trocado entre 11/10 06h e 12h')
    expect(lane(PICK.full, 'desc').versions[0]!.to).toBe('trocada entre 14/10 06h e 12h')
    expect(lane(PICK.full, 'title').markers[0]!.aria).toBe('Título trocado entre 11/10 06h e 12h')
    expect(lane(PICK.full, 'thumb').markers[0]!.aria).toBe('Thumbnail trocada em 13/10 09:40')
  })

  it('"pelo menos" when the start was not observed (first_seen = seriesStart)', () => {
    const v = lane(PICK.none, 'thumb').versions[0]!
    expect(obs.video(PICK.none)!.thumbs[0]!.first_seen).toBe(obs.SERIES_START)
    expect(v.atLeast).toBe(true)
    expect(v.dur).toMatch(/^pelo menos /)
    expect(v.from).toBe('vista desde ' + obs.SERIES_START_LABEL)
    // a version known from publication is not "pelo menos"
    const t1 = lane(PICK.full, 'title').versions[0]!
    expect(t1.atLeast).toBe(false)
    expect(t1.from).toBe('06/10 13:00 (publicação)')
  })

  it('"pelo menos" when the end was not observed (channel stalled)', () => {
    const v = lane(PICK.err, 'title').versions[0]!
    expect(v.atLeast).toBe(true)
    expect(v.to).toBe('até 21/10 18:00 (última conferência)')
    expect(v.dur).toMatch(/^pelo menos /)
  })

  it('windows of 6 h / 1 d, and the exact minute for thumbnails', () => {
    expect(lane(PICK.full, 'title').versions[1]!.precision).toBe('6h')
    expect(lane(PICK.full, 'title').versions[1]!.win).not.toBeNull()
    expect(lane(PICK.full, 'thumb').versions[1]!.precision).toBe('min')
    expect(lane(PICK.full, 'thumb').versions[1]!.from).toBe('13/10 09:40')
    expect(lane(PICK.pre, 'title').versions[1]!.precision).toBe('1d')
    expect(lane(PICK.pre, 'title').markers[0]!.tip.when).toMatch(/janela de 1 dia, sincronização antiga/)
  })

  it('pager rebuilds the origin list from ids= and keeps from/back/ids', () => {
    const ids = [PICK.none, PICK.full, PICK.few]
    const v = buildHistoricoView(obs, PICK.full, { from: 'mudancas', ids: ids.join(','), back: '?niche=ia' })
    const keep = { from: 'mudancas' as const, ids, back: '?niche=ia' }
    expect(v.pager!.prev).toBe(obs.link.historico(PICK.none, keep))
    expect(v.pager!.next).toBe(obs.link.historico(PICK.few, keep))
    expect(v.pager!.prev).toContain('from=mudancas')
    expect(v.pager!.prev).toContain('back=%3Fniche%3Dia')
    expect(v.pager!.prev).toContain('ids=' + encodeURIComponent(ids.join(',')))
    expect(v.pager!.position).toBe('vídeo 2 de 3 em Mudanças, na ordem da lista aberta')
    expect(v.crumbs.href).toBe('/cms/youtube/competitors/mudancas?niche=ia')
    // at the ends there is no way back
    const first = buildHistoricoView(obs, PICK.none, { from: 'mudancas', ids: ids.join(',') })
    expect(first.pager!.prev).toBeNull()
  })

  it('without from, the breadcrumb is Mudanças and the list is the Mudanças default', () => {
    const v = buildHistoricoView(obs, PICK.full, {})
    expect(v.crumbs.crumb).toBe('Mudanças')
    expect(v.crumbs.href).toBe(obs.link.mudancas({ video: PICK.full }))
    expect(v.pager!.position).toMatch(/^vídeo \d+ de \d+ com trocas em Mudanças \(todos os nichos, 30 dias, \d+ trocas\)$/)
  })

  it('from=canais lists the channel videos and adds the channel crumb', () => {
    const v = buildHistoricoView(obs, PICK.full, { from: 'canais' })
    expect(v.crumbs.crumb).toBe('Canais')
    expect(v.crumbs.sub!.text).toBe(obs.channel(obs.video(PICK.full)!.ch)!.name)
    expect(v.pager!.position).toMatch(/^vídeo \d+ de \d+ de Matt Wolfe \(longos acompanhados, do mais novo ao mais antigo\)$/)
    expect(v.pager!.next ?? v.pager!.prev).toContain('from=canais')
  })

  describe('item do canal na trilha (a página do canal substitui o painel)', () => {
    const CH = (id: string) => obs.video(id)!.ch
    const ownVideo = (() => { const o = createObservatory(datasetFromOracle(loadOracleOwns('2'))); const v = o.videos.find(x => o.channel(x.ch)!.own && x.fmt === 'long')!; return { o, id: v.id, ch: v.ch } })()
    it('vindo do canal (canal=<id>): o item do canal volta à página do canal com o estado de back', () => {
      const back = '?tab=trocas'
      const v = buildHistoricoView(obs, PICK.full, { from: 'canais', canal: CH(PICK.full), back })
      expect(v.crumbs.sub!.href).toBe(obs.link.canal(CH(PICK.full)) + back)
      expect(v.crumbs.sub!.href).toBe('/cms/youtube/competitors/canal/matt-wolfe?tab=trocas')
      const g = buildHistoricoView(obs, PICK.full, { from: 'canais', canal: CH(PICK.full), back: '?fmt=shorts&sort=views&from=outliers' })
      expect(g.crumbs.sub!.href).toBe('/cms/youtube/competitors/canal/matt-wolfe?fmt=shorts&sort=views&from=outliers')
    })
    it('vindo do canal sem back: a página do canal pura', () => {
      expect(buildHistoricoView(obs, PICK.full, { from: 'canais', canal: CH(PICK.full) }).crumbs.sub!.href).toBe(obs.link.canal(CH(PICK.full)))
    })
    it('vindo de Mudanças, Outliers ou Insights: o item do canal aponta para a página do canal, sem back', () => {
      for (const from of ['mudancas', 'outliers', 'insights']) {
        const v = buildHistoricoView(obs, PICK.full, { from, back: '?niche=ia' })
        expect(v.crumbs.sub, from).toEqual({ text: obs.channel(CH(PICK.full))!.name, href: obs.link.canal(CH(PICK.full)) })
      }
      expect(buildHistoricoView(obs, PICK.full, {}).crumbs.sub!.href).toBe(obs.link.canal(CH(PICK.full)))
      // from=canais por um link antigo (sem canal=): também sem back
      expect(buildHistoricoView(obs, PICK.full, { from: 'canais', back: '?niche=ia' }).crumbs.sub!.href).toBe(obs.link.canal(CH(PICK.full)))
    })
    it('canal= de outro canal não vira back do canal deste vídeo', () => {
      expect(buildHistoricoView(obs, PICK.full, { from: 'canais', canal: 'luke-damant', back: '?tab=trocas' }).crumbs.sub!.href).toBe(obs.link.canal(CH(PICK.full)))
    })
    it('vídeo de canal próprio: o item do canal continua abrindo o painel de Canais', () => {
      const v = buildHistoricoView(ownVideo.o, ownVideo.id, { from: 'canais' })
      expect(v.crumbs.sub!.href).toBe(ownVideo.o.link.canais({ channel: ownVideo.ch }))
      // e de outras origens um canal próprio não ganha item de canal (não há página dele)
      expect(buildHistoricoView(ownVideo.o, ownVideo.id, { from: 'mudancas' }).crumbs.sub).toBeNull()
    })
    it('troca= na URL é ignorado sem erro (a chegada pela troca é da A2)', () => {
      const a = buildHistoricoView(obs, PICK.full, { from: 'canais', canal: CH(PICK.full), back: '?tab=trocas' })
      const b = buildHistoricoView(obs, PICK.full, { from: 'canais', canal: CH(PICK.full), back: '?tab=trocas', troca: 'qualquer-coisa' })
      expect(b.state).toBe('full')
      expect(b.crumbs).toEqual(a.crumbs)
      expect(b.pager).toEqual(a.pager)
    })
  })

  it('an unknown id is the not-found state, never a throw', () => {
    const v = buildHistoricoView(obs, 'nao-existe', { from: 'outliers' })
    expect(v.state).toBe('not-found')
    expect(v.video).toBeNull()
    expect(v.notFound!.title).toBe('Vídeo não encontrado: “nao-existe”.')
    expect(v.notFound!.back).toBe('Voltar para Outliers')
    expect(v.crumbs.crumb).toBe('Outliers')
  })

  it('the views/day curve is steps; the expected curve comes from the engine', () => {
    const c = buildHistoricoView(obs, PICK.full, {}).chart!
    expect(c.bins.length).toBeGreaterThan(5)
    for (let i = 1; i < c.bins.length; i++) expect(c.bins[i]!.a).toBeCloseTo(c.bins[i - 1]!.b, 6)
    expect(c.bins.every(b => b.y >= 0 && b.y <= 1)).toBe(true)
    const exp = obs.expectedCurve(PICK.full).filter(p => p.vpdAnchored != null && p.t - p.from >= 864e5 - 60e3)
    expect(c.expected).toEqual(exp.map(p => ({ t: p.t, vpd: p.vpdAnchored })))
    expect(c.expectedMethod).toBe(obs.expectedCurve(PICK.full).methodLabel)
    expect(c.compressedBefore).toBeNull()
  })

  it('the period before the series start is compressed for old videos', () => {
    const v = buildHistoricoView(obs, PICK.pre, { range: 'tudo' })
    expect(v.chart!.compressedBefore).toBe(obs.SERIES_START)
    expect(v.chart!.pre!.lines[0]).toBe('antes de ' + obs.SERIES_START_LABEL)
    expect(v.legends['']!.some(l => /dias antes de 03\/10 comprimidos à esquerda/.test(l.text))).toBe(true)
  })

  it('few records: no curve, honest text', () => {
    const v = buildHistoricoView(obs, PICK.few, {})
    expect(v.chart!.few).toBe(true)
    expect(v.chart!.empty!.title).toBe('Ainda não há curva: só 1 registro diário.')
    expect(v.chart!.table).toBeNull()
  })

  it('R53: the effect of a change is the same object Mudanças shows', () => {
    const v = buildHistoricoView(obs, PICK.full, {})
    expect(v.comparisons.length).toBeGreaterThan(0)
    const mud = buildMudancasView(obs, { niche: 'todos', win: '90' }, new Set())
    let compared = 0
    for (const c of v.comparisons) {
      expect(c.effect).toEqual(effectView(obs, obs.change(c.changeId)!))
      const hero = mud.heroes.find(h => h.id === c.changeId)
      if (hero) { expect(c.effect).toEqual(hero.effect); compared++ }
    }
    expect(compared).toBeGreaterThan(0)
    // R115: the showcase video has no decided comparison any more; the default is the first decided pair when there is one, else the first pair
    const decidedPairs = v.comparisons.filter(c => ['neutro', 'ganhou', 'perdeu'].includes(c.effect.status))
    expect(v.defaultPair).toBe((decidedPairs[0] ?? v.comparisons[0])!.changeId)
    const d = v.comparisons.find(c => c.changeId === v.defaultPair)!
    expect(d.full!.verdictText).toContain(d.effect.detail)
    // the reverted thumbnail is one comparison A → B → A
    expect(v.comparisons.some(c => /^Thumbnail A → B: .+ · B → A: /.test(c.chip))).toBe(true)
  })
  it('R115: some video of the oracle still opens on a decided comparison', () => {
    const withDecided = obs.changes.filter(c => ['neutro', 'ganhou', 'perdeu'].includes(obs.effect(c.id)!.status)).map(c => c.video)
    expect(withDecided.length).toBeGreaterThan(0)
    const hv = buildHistoricoView(obs, withDecided[0]!, {})
    expect(['neutro', 'ganhou', 'perdeu']).toContain(hv.comparisons.find(c => c.changeId === hv.defaultPair)!.effect.status)
  })

  describe('production-shaped first versions (precision first, first_seen = sync time)', () => {
    const H3 = 3 * 36e5
    /** Rewrites a video's first title/thumbnail/description as the sync writes them (competitor-versions.ts). */
    const productionShaped = (id: string, firstSeen: (pub: number) => number) => {
      const ds = datasetFromOracle(oracle)
      const vv = ds.videos.find(x => x.id === id)!
      for (const arr of [vv.titles, vv.thumbs, vv.descs] as Array<Array<{ prec: unknown; first_seen: number; seenSinceArchive?: boolean }>>) {
        if (!arr[0]) continue
        arr[0].prec = 'first'; arr[0].first_seen = firstSeen(vv.pub); delete arr[0].seenSinceArchive
      }
      return createObservatory(ds)
    }
    it('published after the archive start: stands from publication, no "pelo menos", no archive region or note', () => {
      const id = obs.videos.find(x => x.tracked && x.pub >= obs.SERIES_START && x.titles.length === 1 && x.descs.length === 1 && x.thumbs.length === 1
        && obs.channel(x.ch)!.sync.state === 'ok' && obs.channel(x.ch)!.sync.added == null && x.series.length >= 2)!.id
      const o2 = productionShaped(id, pub => pub + H3)
      const v = buildHistoricoView(o2, id, {})
      for (const l of v.lanes) {
        const first = l.versions[0]!
        expect([l.type, first.from]).toEqual([l.type, o2.date.dmOrDmy(o2.video(id)!.pub) + ' ' + o2.date.hm(o2.video(id)!.pub) + ' (publicação)'])
        expect([l.type, first.atLeast, first.precision]).toEqual([l.type, false, 'publicacao'])
        expect(first.fromH).toBe(0)
      }
      expect(v.lanes.find(l => l.type === 'thumb')!.pre).toBeNull()
      expect(v.versions!.thumbs.notes.some(n => /Thumbnail vista desde/.test(n.text))).toBe(false)
      expect(v.versions!.titles.same).toBe('Mesmo título desde a publicação.')
      expect(JSON.stringify(v)).not.toMatch(/pelo menos|vist[oa] desde|não registrada/)
    })
    it('published before the archive start: the start was not observed', () => {
      const o2 = productionShaped(PICK.old, () => o2SS() + H3)
      function o2SS() { return obs.SERIES_START }
      const v = buildHistoricoView(o2, PICK.old, {})
      const t1 = v.lanes.find(l => l.type === 'title')!.versions[0]!
      expect(t1.atLeast).toBe(true)
      expect(t1.from).toMatch(/^visto desde /)
      const th = v.lanes.find(l => l.type === 'thumb')!
      expect(th.pre!.title).toBe('Thumbnail antes de 03/10: não registrada')
      expect(v.versions!.thumbs.notes.some(n => /^Thumbnail vista desde 03\/10, quando o arquivo de imagens começou/.test(n.text))).toBe(true)
    })
  })

  describe('pager rebuilds the exact origin list (shared list code)', () => {
    it('Mudanças: same parseFilters/query/sort as the screen', () => {
      const back = '?win=90&type=title'
      const L = mudancasList(obs, { win: '90', type: 'title', niche: 'todos' }, new Set())
      const id = L.visibleVideos[1]!
      const v = buildHistoricoView(obs, id, { from: 'mudancas', back })
      expect(v.pager!.position).toBe('vídeo 2 de ' + L.visibleVideos.length + ' com trocas em Mudanças (todos os nichos, títulos, 90 dias, ' + L.ordered.length + ' trocas)')
      expect(v.pager!.prev).toBe(obs.link.historico(L.visibleVideos[0]!, { from: 'mudancas', back }))
      expect(v.crumbs.href).toBe('/cms/youtube/competitors/mudancas' + back)
    })
    it('Mudanças "só salvas": the saved set from the swipe rows', () => {
      const savedIds = obs.changes.filter(c => !obs.channel(c.ch)!.own && c.at > obs.NOW - 30 * 864e5).slice(0, 3).map(c => c.id)
      const saved = new Set(savedIds)
      const L = mudancasList(obs, { saved: '1', niche: 'todos' }, saved)
      expect(L.ordered.length).toBe(3)
      const id = L.visibleVideos[0]!
      const v = buildHistoricoView(obs, id, { from: 'mudancas', back: '?saved=1' }, { savedChangeIds: saved })
      expect(v.pager!.position).toBe('vídeo 1 de ' + L.visibleVideos.length + ' com trocas em Mudanças (todos os nichos, 30 dias, só salvas, 3 trocas)')
      // without the saved set the list is empty: the video is outside it, never a different list
      expect(buildHistoricoView(obs, id, { from: 'mudancas', back: '?saved=1' }).pager!.position).toMatch(/^fora da lista de Mudanças/)
    })
    it('Outliers: the screen list (defaults, age aliases, sort)', () => {
      const ov = buildOutliersView(obs, { age: 'all', sort: 'vpd', niche: 'todos' })
      expect(ov.pageIds.length).toBeGreaterThan(2)
      const v = buildHistoricoView(obs, ov.pageIds[1]!, { from: 'outliers', back: '?age=all&sort=vpd' })
      expect(v.pager!.position).toBe('vídeo 2 de ' + ov.pageIds.length + ' em Outliers (todos os nichos, longos, todas as idades, 2,0× ou mais, por views/dia)')
      expect(v.pager!.next).toBe(obs.link.historico(ov.pageIds[2]!, { from: 'outliers', back: '?age=all&sort=vpd' }))
    })
    it('Outliers with a reading: the reading scope applies', () => {
      const rid = Object.keys(obs.forja.byId).find(id => obs.forja.readingScope(id))!
      expect(rid).toBeTruthy()
      const ov = buildOutliersView(obs, { reading: rid, niche: 'todos' })
      expect(ov.pageIds.length).toBeGreaterThan(0)
      const v = buildHistoricoView(obs, ov.pageIds[0]!, { from: 'outliers', back: '?reading=' + rid })
      expect(v.pager!.position).toMatch(new RegExp('^vídeo 1 de ' + ov.pageIds.length + ' em Outliers \\(.*escopo da leitura'))
    })
  })

  it('thumbnails show the archived blob when present, else the honest text', () => {
    expect(lane(PICK.full, 'thumb').versions[0]!.thumb).toEqual({ src: null, missing: 'A imagem desta versão não foi arquivada.', alt: 'Thumbnail A' })
    expect(lane(PICK.none, 'thumb').versions[0]!.thumb!.missing).toBe('A imagem desta versão não foi arquivada.')
    // what lies before the archive uses the series start label
    const pre = buildHistoricoView(obs, PICK.pre, { range: 'tudo' })
    expect(pre.lanes.find(l => l.type === 'thumb')!.pre!.text).toBe('antes de ' + obs.SERIES_START_LABEL)
    expect(pre.comparisons[0]!.ba![0]!.thumb!.missing).toBe('Thumbnail antes de ' + obs.SERIES_START_LABEL + ': não registrada')
    const ds = datasetFromOracle(oracle)
    ds.videos.find(x => x.id === PICK.full)!.thumbs[0]!.blobUrl = 'https://blob.example/a.jpg'
    const o2 = createObservatory(ds)
    expect(buildHistoricoView(o2, PICK.full, {}).lanes.find(l => l.type === 'thumb')!.versions[0]!.thumb!.src).toBe('https://blob.example/a.jpg')
  })

  it('an old video with the thumbnail seen since the archive says so (antes de DD/MM)', () => {
    const v = buildHistoricoView(obs, PICK.old, {})
    expect(v.lanes.find(l => l.type === 'thumb')!.pre!.title).toBe('Thumbnail antes de 03/10: não registrada')
    expect(v.header!.counts).toEqual([{ type: null, text: 'Nenhuma troca registrada' }])
    expect(v.versions!.titles.same).toBe('Sem troca de título vista desde 31/05.')
  })

  it('untracked (R117): no chart, but the stored versions are there; the notice says what is shown', () => {
    const v = buildHistoricoView(obs, PICK.untr, {})
    const ch = obs.channel(obs.video(PICK.untr)!.ch)!
    expect(v.chart).toBeNull()
    expect(v.untracked!.href).toBe(obs.link.canais({ channel: ch.id }))
    expect(v.untracked!.notice).toBe('Este vídeo está fora dos ' + ch.video_limit + ' mais recentes acompanhados de ' + ch.name + '. Mostramos o histórico de títulos, thumbnails e descrições guardado. O gráfico de views só aparece para vídeos acompanhados ou fixados.')
    expect(v.lanes.map(l => l.versions.length)).toEqual([1, 1, 1])
    expect(v.versions!.titles.items).toHaveLength(1)
    expect(v.comparisons).toEqual([])
    expect(v.lanesAxis).not.toBeNull()
    expect(v.pin).toEqual({ pinned: false, used: 0, limit: obs.RULES.pinLimit, state: null, note: null })
    expect(v.header!.views).toEqual({ num: null, text: 'contagem de views não acompanhada' })
  })

  it('no text carries NaN/undefined/null', () => {
    for (const id of Object.values(PICK)) {
      const s = JSON.stringify(buildHistoricoView(obs, id, { from: 'outliers' }))
      expect(s).not.toMatch(/NaN|undefined|\[object Object\]/)
    }
  })
})

// Task 35b (fidelity sweep): production stores added_at for EVERY channel; the oracle keeps sync.added only for a
// channel added after the observatory began, and a backfilling channel has no good sync (sync.last null) in production
describe('historico view model — production-shaped sync data', () => {
  const prodShaped = () => {
    const ds = datasetFromOracle(oracle)
    ds.channels.forEach((c, i) => {
      if (c.sync.added == null) c.sync.added = ds.obsStart + i * 60e3 // founding channels: added on the observatory's first day
      if (c.sync.state === 'backfill') c.sync.last = null   // never synced OK yet (loader: last = last_ok_synced_at)
    })
    return createObservatory(ds)
  }
  it('a founding channel (added on the observatory\'s first day) is not a recent add: "Visto desde 31/05", never "na 1ª conferência"', () => {
    const o = prodShaped()
    expect(o.OBS_START).toBe(obs.OBS_START)
    const t = buildHistoricoView(o, PICK.old, {}).lanes.find(l => l.type === 'title')!.versions[0]!
    expect(t.from).toBe(buildHistoricoView(obs, PICK.old, {}).lanes.find(l => l.type === 'title')!.versions[0]!.from)
    expect(t.from).toMatch(/^visto desde 31\/05$/)
  })
  it('a channel still fetching its videos is unchecked since it was added', () => {
    const v = buildHistoricoView(prodShaped(), PICK.bf, {})
    expect(v.versions!.titles.same).toMatch(/^Sem troca de título vista desde 24\/10; não conferido desde 24\/10 14:20, canal adicionado há \d+ min, buscando vídeos \(18 de 50\)\.$/)
  })
})

// Tarefa 8 (A2): o cartão antigo (o da pílula, "Nada foi publicado.", o link "Para pedir de novo, use…") saiu; o cartão novo (`forjaCard`, modelo da
// Tarefa 7) diz a mesma coisa de outro jeito, e o botão do cabeçalho é quem manda pedir de novo. Os testes que fixavam o cartão antigo foram trocados por estes.
describe('historico view model — forja card "pedir de novo"', () => {
  const card = (state: string) => {
    const o = createTestObservatory(datasetFromOracle(oracle))
    o.forja.session.setBase(state, { type: 'leitura-video', video: PICK.full })
    return buildHistoricoView(o, PICK.full, {})
  }
  it('falhou: "Não deu", sem etapa de sucesso, o botão do cartão vira "Pedir de novo" e o do cabeçalho "Pedir leitura à forja de novo"', () => {
    const v = card('falhou')
    expect(v.forjaCard!.situacao).toBe('nao-deu')
    expect(v.forjaCard!.frase).toMatch(/^Não deu: .* Pode pedir de novo\.$/)
    expect(v.forjaCard!.botao).toMatchObject({ label: 'Pedir de novo', habilitado: true, visivel: true })
    expect(headerAsk(v.forjaCard!)).toMatchObject({ label: 'Pedir leitura à forja de novo', modo: 'pedir' })
  })
  it('recusado: "Precisa de você", a ação "Sincronizar este canal" e o botão apagado até o canal sincronizar', () => {
    const v = card('recusado (dado velho)')
    expect(v.forjaCard!.situacao).toBe('precisa-de-voce')
    expect(v.forjaCard!.acoes.map(a => a.label)).toEqual(['Sincronizar este canal'])
    expect(v.forjaCard!.botao).toMatchObject({ habilitado: false, por: 'sincronizar' })
    expect(headerAsk(v.forjaCard!).modo).toBe('apagado')
  })
})

// Task 35b fix 2, refeito na Tarefa 8: a linha da leitura e o "Desde então" do cartão novo
describe('historico view model — forja card readings', () => {
  const card = (state: string) => {
    const o = createTestObservatory(datasetFromOracle(oracle))
    o.forja.session.setBase(state, { type: 'leitura-video', video: PICK.full })
    return buildHistoricoView(o, PICK.full, {}).forjaCard!
  }
  it('o selo diz o dia e a hora em que a leitura foi gerada, em São Paulo', () => {
    const c = card('publicado')
    expect(c.leitura!.selo).toBe('forja · Gemma 12B · em treino · gerada 24/10 14:50 (SP)')
    expect(c.anterior!.selo).toMatch(/^forja · .* · em treino · gerada 20\/10 \d\d:\d\d \(SP\)$/)
  })
  it('publicado: nem a leitura nova nem a "Leitura anterior" traz "Do site: desde então"', () => {
    const c = card('publicado')
    expect(c.leitura).not.toBeNull()
    expect(c.leitura!.doSite).toEqual([])
    expect(c.anterior).not.toBeNull()
    expect(c.anterior!.doSite).toEqual([])
  })
  it('todo outro estado mantém o "desde então" na leitura que mostra', () => {
    for (const s of ['na fila', 'trabalhando', 'atrasado', 'falhou']) {
      const c = card(s)
      expect([s, c.leitura!.doSite[0]?.startsWith('desde então')]).toEqual([s, true])
    }
  })
})
