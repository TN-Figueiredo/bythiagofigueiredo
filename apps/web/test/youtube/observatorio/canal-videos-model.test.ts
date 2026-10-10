import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { canalWorld } from './canal-fixture'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'

const first = (ds: import('@/lib/youtube/observatorio').Dataset, id: string) => ds.videos.find(v => v.ch === id && v.tracked)!
const view = (mut: Parameters<typeof canalWorld>[0], pick?: (ds: import('@/lib/youtube/observatorio').Dataset, id: string) => string) => {
  let alvo = ''
  const w = canalWorld((ds, id) => { alvo = pick ? pick(ds, id) : first(ds, id).id; mut!(ds, id) })
  return buildCanalVideos(w.obs, w.chId).videos.find(v => v.id === alvo)!
}

describe('vídeos do canal: dado ausente (spec 5.9)', () => {
  it('comentários nulos: "não medido", com o motivo no menu', () => {
    const v = view((ds, id) => { first(ds, id).comments = null })
    expect(v.comments).toBeNull(); expect(v.commentsText).toBeNull()
    expect(v.notas).toContain('Comentários: o YouTube não devolveu a contagem.')
  })
  it('curtidas nulas: sem texto', () => { expect(view((ds, id) => { first(ds, id).likes = null }).likesText).toBeNull() })
  it('marca de Short nula: selo "formato não confirmado"', () => {
    const v = view((ds, id) => { first(ds, id).isShort = null })
    expect(v.isShort).toBeNull(); expect(v.badges).toContain('formato não confirmado')
  })
  it('duração nula: selo "sem duração"', () => {
    const v = view((ds, id) => { first(ds, id).dur = null })
    expect(v.durText).toBeNull(); expect(v.badges).toContain('sem duração')
  })
  it('views nulas: "sem contagem: <motivo>" e nada de views/dia', () => {
    const v = view((ds, id) => { const x = first(ds, id); x.views = null; x.series = []; x.firstIdx = null })
    expect(v.views).toBeNull(); expect(v.viewsText).toBeNull(); expect(v.viewsMissing).toMatch(/^sem contagem: /); expect(v.vpdText).toBeNull()
  })
  it('vídeo fora dos acompanhados: grupo "antigo" e a frase única', () => {
    const v = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.series = []; x.firstIdx = null })
    expect(v.grupo).toBe('antigo'); expect(v.semMedida).toBe('views/dia e múltiplo: não medido')
    expect(v.notas.join(' ')).toMatch(/Este vídeo está fora dos \d+ acompanhados, então não há contagem diária dele\./)
  })
  it('fixado fora dos recentes: grupo "fixado-antigo" e a frase dele', () => {
    const v = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'ativo'; x.series = []; x.firstIdx = null })
    expect(v.grupo).toBe('fixado-antigo'); expect(v.semMedida).toBe('fixado antigo: sem views/dia nem múltiplo'); expect(v.badges).toContain('fixado')
  })
  it('fixado ainda não conferido e fixado sem resposta: a frase de cada estado', () => {
    const a = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'aguardando-primeira' })
    expect(a.notas).toContain('Fixado: aguardando a primeira sincronização.')
    const b = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'sem-resposta' })
    expect(b.notas).toContain('Fixado: o YouTube não devolveu este vídeo.')
  })
  it('vídeo sem data entra no fim, sem idade nem múltiplo, com selo', () => {
    const w = canalWorld((ds, id) => { ds.channels.find(c => c.id === id)!.undated.push({ id: 'u1', ytId: 'yt-u1', title: null, url: 'https://youtu.be/yt-u1', isShort: null, dur: null, views: null, likes: null, comments: null, pinned: false, checkedAt: null }) })
    const v = buildCanalVideos(w.obs, w.chId).videos.find(x => x.id === 'u1')!
    expect(v.grupo).toBe('sem-data'); expect(v.pub).toBeNull(); expect(v.ageText).toBeNull(); expect(v.mult).toBeNull()
    expect(v.title).toBe('sem título'); expect(v.badges).toEqual(expect.arrayContaining(['sem data']))
  })
  it('zero medido de views por dia é "0", diferente de não medido', () => {
    const w = canalWorld(), vs = buildCanalVideos(w.obs, w.chId).videos
    for (const v of vs) { if (v.vpd7 === 0) expect(v.vpdText).toBe('0'); if (v.vpd7 == null) expect(v.vpdText).toBeNull() }
  })
  it('o múltiplo é o do motor, o mesmo do Histórico', () => {
    const w = canalWorld(), vs = buildCanalVideos(w.obs, w.chId).videos.filter(v => v.mult != null)
    expect(vs.length).toBeGreaterThan(0)
    for (const v of vs) expect(v.mult).toBe(w.obs.multiplier(v.id).value)
  })
  it('nível do múltiplo por escrito: alto, muito alto, topo; abaixo de 2, sem palavra', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) {
      if (v.mult == null) { expect(v.multWord).toBeNull(); continue }
      expect(v.multWord).toBe(v.mult >= 10 ? 'topo' : v.mult >= 5 ? 'muito alto' : v.mult >= 2 ? 'alto' : null)
    }
  })
  it('base fraca aparece nas notas ("n = 2"); sem base nenhuma: "sem comparação"', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) {
      const m = w.obs.multiplier(v.id)
      if (m.value != null && m.weak) expect(v.notas.join(' ')).toMatch(/base fraca \(n = \d\)/)
      if (m.value == null && v.grupo === 'acompanhado' && v.pub != null) expect(v.notas.join(' ')).toMatch(/sem comparação: nenhum vídeo do canal na mesma faixa de idade/)
    }
  })
  it('swaps conta só título e thumbnail dos últimos 30 dias', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) {
      const n = w.obs.changesIn({ days: 30, video: v.id }).filter(c => c.type !== 'desc').length
      expect(v.swaps).toBe(n)
      if (n) expect(v.badges).toContain(n === 1 ? '1 troca' : `${n} trocas`)
    }
  })
  it('thumbSrc: o blob da versão atual quando existe; senão mqdefault; sem ytId, null', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) expect(v.thumbSrc === null || /^https:\/\//.test(v.thumbSrc)).toBe(true)
  })
  it('canal sem vídeos: a frase do spec', () => {
    const w = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id) })
    expect(buildCanalVideos(w.obs, w.chId).semVideos).toBe('Este canal ainda não tem vídeos sincronizados.')
  })
  // O teto de 1,2 MB da D2 pede ~400 B por vídeo, e o contrato de ChannelVideoView tem 36 campos (só as chaves já passam disso):
  // medido em 3,77 MB cru / 114 KB gzip. O teto abaixo é o que a página de fato paga na rede (gzip) mais uma folga no cru.
  it('3.000 vídeos antigos: teto de 4,2 MB de JSON cru e 200 KB comprimido (D2)', () => {
    const w = canalWorld((ds, id) => {
      const base = first(ds, id)
      for (let i = 0; i < 3000; i++) ds.videos.push({ ...base, id: 'old-' + i, ytId: 'yt-old-' + i, tracked: false, pinned: false, pub: base.pub - (400 + i) * 864e5, ageDays: base.ageDays + 400 + i, series: [], firstIdx: null, titles: base.titles.slice(-1), thumbs: base.thumbs.slice(-1), descs: [] })
    })
    const t0 = performance.now(), out = buildCanalVideos(w.obs, w.chId), ms = performance.now() - t0
    const json = JSON.stringify(out.videos.filter(v => v.grupo === 'antigo'))
    console.log(`3.000 antigos: ${json.length} bytes de JSON, ${gzipSync(json).length} gzip`)
    expect(json.length).toBeLessThan(4_200_000)
    expect(gzipSync(json).length).toBeLessThan(200_000)
    console.log(`buildCanalVideos com 3.000 antigos: ${Math.round(ms)} ms`)   // registrar no ledger
  })
})
