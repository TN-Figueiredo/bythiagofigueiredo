// @vitest-environment node
// The pure pieces of "histórico com muitas versões" (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 3).
import { describe, it, expect } from 'vitest'
import { loadFase4, plain, VID, DAY, H } from './fase4-world'
import { createObservatory } from '@/lib/youtube/observatorio'
import { parseRange, rangeStart, situationOf, statusLine, kindShort, imageSummary, RANGE_IDS, type Pass } from '@/app/cms/(authed)/youtube/competitors/_historico/many-versions'

const { HM, ds } = loadFase4(), obs = createObservatory(ds)
/** The thumbnail periods of a video as the view model hands them: start, end (the next start, or now), current. */
const passesOf = (id: string): Pass[] => plain(HM.versions(id, 'thumb') as Array<{ label: string; start: number; endLo: number; cur: boolean }>).map(p => ({ label: p.label, startMs: p.start, endMs: p.endLo, cur: p.cur }))
const pub = (id: string) => obs.video(id)!.pub

describe('filtro de período: ?range=', () => {
  it('só 7, 30 e 90 valem, e só quando o filtro é oferecido', () => {
    expect(RANGE_IDS).toEqual(['7', '30', '90', 'tudo'])
    expect(['7', '30', '90'].map(r => parseRange(r, true))).toEqual(['7', '30', '90'])
    for (const bad of [undefined, '', 'tudo', '0', '8', '-7', '7d', '7 ', 'abc', '90;drop']) expect(parseRange(bad, true), String(bad)).toBe('tudo')
    expect(parseRange('7', false)).toBe('tudo')
  })
  it('o período nunca começa antes da publicação', () => {
    const now = ds.now
    expect(rangeStart('tudo', now - 60 * DAY, now)).toBe(now - 60 * DAY)
    expect(rangeStart('7', now - 60 * DAY, now)).toBe(now - 7 * DAY)
    expect(rangeStart('90', now - 60 * DAY, now)).toBe(now - 60 * DAY)
  })
})

describe('situação de uma troca', () => {
  it('sem-antes e sem-serie são "sem base"; o resto tem o próprio nome', () => {
    expect((['ganhou', 'perdeu', 'neutro', 'inconclusivo', 'aguardando', 'sem-antes', 'sem-serie'] as const).map(status => situationOf({ status })))
      .toEqual(['ganhou', 'perdeu', 'neutro', 'inconclusivo', 'aguardando', 'sem-base', 'sem-base'])
  })
  it('motivo curto por tipo de inconclusivo, com os números de RULES', () => {
    expect(kindShort(obs)).toEqual({ 'troca-seguinte': 'outra troca nos 7 dias depois', 'janela-dupla': 'dois campos em menos de 48 h', 'versao-curta': 'versão com menos de 1 dia no ar', 'antes-curto': 'antes curto demais', outro: 'outro motivo' })
  })
  it('a linha de cada troca é a mesma do mockup quando a situação não depende dos pares do canal', () => {
    for (const c of HM.video(VID.dense).changes) {
      const e = obs.effect(c.id)!, h = HM.effect(c.id)
      expect(statusLine(obs, e), c.id).toBe(HM.statusLine(h))
    }
  })
  it('inconclusivo sem tipo (dado de versão antiga) cai em "outro motivo", nunca em undefined', () => {
    expect(statusLine(obs, { id: 'x', type: 'thumb', status: 'inconclusivo', label: 'inconclusivo', reason: '' })).toBe('inconclusivo: outro motivo')
    expect(statusLine(obs, { id: 'x', type: 'thumb', status: 'aguardando', label: 'aguardando', reason: '' })).toBe('aguardando (0 de 7 dias)')
  })
})

describe('resumo por imagem', () => {
  it('estado 2 do mockup: 5 + 4 + 4 + 5 + 6 = 24 passagens; 22,6 + 8,2 + 4,8 + 10,7 + 13,9 = 60,2 d', () => {
    const s = imageSummary(obs, VID.many, passesOf(VID.many), pub(VID.many), ds.now)
    expect(s.rows.map(r => [r.label, r.passes, r.durText])).toEqual([['A', 5, '≈ 22,6 d'], ['B', 4, '≈ 8,2 d'], ['C', 4, '≈ 4,8 d'], ['D', 5, '≈ 10,7 d'], ['E', 6, '≈ 13,9 d']])
    expect([s.total.images, s.total.passes, s.total.durText, s.returned]).toEqual([5, 24, '≈ 60,2 d', 5])
    expect(s.rows.reduce((a, r) => a + r.tenths, 0)).toBe(602)
    expect(s.rows.reduce((a, r) => a + r.ms, 0)).toBe(ds.now - pub(VID.many))
  })
  it('passagens e tempo iguais aos do mockup nos cinco vídeos, com e sem corte', () => {
    for (const v of HM.videos) for (const from of [null, ds.now - 7 * DAY, ds.now - 30 * DAY]) {
      const f = from == null ? v.pub : Math.max(from, v.pub)
      const mine = imageSummary(obs, v.id, passesOf(v.id), f, ds.now), theirs = plain(HM.imageSummary(v.id, from, ds.now)) as Array<{ label: string; passes: number; durText: string }>
      expect(mine.rows.map(r => [r.label, r.passes, r.durText]), v.id + ' ' + from).toEqual(theirs.map(r => [r.label, r.passes, r.durText]))
    }
  })
  it('a média é a das passagens que têm média no cartão, ponderada pelas horas de registro', () => {
    const passes = passesOf(VID.many), s = imageSummary(obs, VID.many, passes, pub(VID.many), ds.now)
    for (const row of s.rows) {
      let sum = 0, w = 0
      for (const p of passes.filter(x => x.label === row.label)) { const r = obs.periodRate(VID.many, p.startMs, p.endMs); if (r.vpd != null) { sum += r.vpd * r.coveredHours; w += r.coveredHours } }
      expect(row.rateText, row.label).toBe('≈ ' + obs.fmt.num(sum / w))
    }
  })
  it('imagem só com passagens de menos de 1 dia: sem média, com a frase da contagem certa', () => {
    const s = imageSummary(obs, VID.dense, passesOf(VID.dense), pub(VID.dense), ds.now), by = Object.fromEntries(s.rows.map(r => [r.label, r.rateText]))
    expect(by.B).toBe('menos de 1 dia em cada passagem, sem média')
    expect(by.C).toBe('menos de 1 dia em cada passagem, sem média')
    const one = imageSummary(obs, VID.dense, [{ label: 'X', startMs: ds.now - 5 * H, endMs: ds.now, cur: true }], ds.now - 5 * H, ds.now)
    expect(one.rows[0]!.rateText).toBe('menos de 1 dia no ar, sem média')
  })
  it('a imagem A do estado 4 não mistura as quatro passagens curtas na média', () => {
    const passes = passesOf(VID.dense), s = imageSummary(obs, VID.dense, passes, pub(VID.dense), ds.now)
    const long = passes.filter(p => p.label === 'A' && p.endMs - p.startMs >= DAY)
    expect([passes.filter(p => p.label === 'A').length, long.length]).toEqual([6, 2])
    let sum = 0, w = 0
    for (const p of long) { const r = obs.periodRate(VID.dense, p.startMs, p.endMs); sum += r.vpd! * r.coveredHours; w += r.coveredHours }
    expect(s.rows.find(r => r.label === 'A')!.rateText).toBe('≈ ' + obs.fmt.num(sum / w))
  })
  it('com corte, a ordem das linhas continua a das letras e `returned` continua o do vídeo inteiro', () => {
    const s = imageSummary(obs, VID.many, passesOf(VID.many), ds.now - 7 * DAY, ds.now)
    expect(s.rows.map(r => [r.label, r.passes])).toEqual([['D', 1], ['E', 2]])
    expect(s.returned).toBe(5)
  })
  it('o dado não existe: nenhuma passagem, intervalo vazio e vídeo sem registro diário', () => {
    expect(imageSummary(obs, VID.many, [], pub(VID.many), ds.now)).toEqual({ rows: [], total: { images: 0, passes: 0, ms: 0, durText: 'menos de 0,1 d', rateText: '≈ ' + obs.fmt.num(obs.periodRate(VID.many, pub(VID.many), ds.now).vpd) }, returned: 0 })
    expect(imageSummary(obs, VID.many, passesOf(VID.many), ds.now, ds.now).rows).toEqual([])
    const bare = loadFase4(); bare.ds.videos.find(v => v.id === VID.many)!.series = []; bare.ds.videos.find(v => v.id === VID.many)!.firstIdx = null
    const s = imageSummary(createObservatory(bare.ds), VID.many, passesOf(VID.many), pub(VID.many), ds.now)
    expect(new Set(s.rows.map(r => r.rateText))).toEqual(new Set(['sem registro diário no período']))
    expect(s.total.rateText).toBe('sem registro diário no período')
  })
  it('mais de 26 imagens: as linhas seguem a ordem de entrada, não a ordem alfabética do rótulo', () => {
    const many: Pass[] = ['A', 'Z1', 'Z10', 'Z2'].map((label, i) => ({ label, startMs: ds.now - (8 - i * 2) * DAY, endMs: ds.now - (6 - i * 2) * DAY, cur: i === 3 }))
    expect(imageSummary(obs, VID.many, many, ds.now - 8 * DAY, ds.now).rows.map(r => r.label)).toEqual(['A', 'Z1', 'Z10', 'Z2'])
  })
})
