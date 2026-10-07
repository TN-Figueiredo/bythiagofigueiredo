// @vitest-environment node
// R121 "trocas em sequência" (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 1).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loadFase4, setThumbs, setTitles, plain, VID, DAY, H } from './fase4-world'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { PACK_VERSION } from '@/lib/youtube/observatorio/pack'
import { runsOf, runText, runCore, runShort, runCardText, runDays, runDefinition, RUN_CAVEAT } from '@/lib/youtube/observatorio/test-run'

const FIX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/observatorio/fase4-dados.cjs')
const runOf = (obs: ReturnType<typeof createObservatory>, id: string) => obs.change(id)!.testRun

describe('fixture do mockup da Fase 4', () => {
  it('fase4-dados.cjs é a cópia do dados.js aprovado (sha256)', () => {
    expect(crypto.createHash('sha256').update(fs.readFileSync(FIX)).digest('hex')).toBe('f5f47d6da9b09b3750ff9701f6c9f6a8e070870837d145292bab8ae5292d5254')
  })
  it('o mundo carrega no motor de produção com as mesmas trocas do mockup', () => {
    const { HM, ds } = loadFase4(), obs = createObservatory(ds)
    for (const v of HM.videos) expect(obs.changes.filter(c => c.video === v.id).map(c => c.id).sort(), v.id).toEqual(plain(v.changes.map((c: { id: string }) => c.id)).sort())
  })
})

describe('R121: testRun em deriveChanges', () => {
  it('a regra vem de RULES.testRunGapDays = 14, lida da constante', () => {
    expect(RULES.testRunGapDays).toBe(14)
  })
  it('A → B → A → C em 3 dias é UMA sequência de 3 trocas (conta trocas, não versões)', () => {
    const { ds } = loadFase4(), t = ds.now - 10 * DAY
    setThumbs(ds, VID.few, [['A'], ['B', t], ['A', t + DAY], ['C', t + 3 * DAY]])
    const obs = createObservatory(ds), ids = [1, 2, 3].map(i => VID.few + '/thumb/' + i)
    expect(ids.map(id => runOf(obs, id))).toEqual([1, 2, 3].map(pos => ({ id: VID.few + '/thumb/seq1', n: 3, pos, from: t, to: t + 3 * DAY, open: true })))
  })
  it('intervalo acima de 14 dias separa em duas; a primeira fica encerrada', () => {
    const { ds } = loadFase4(), n = ds.now
    setTitles(ds, VID.few, [n - 40 * DAY, n - 30 * DAY, n - 10 * DAY, n - 5 * DAY])
    const obs = createObservatory(ds), r = [1, 2, 3, 4].map(i => runOf(obs, VID.few + '/title/' + i)!)
    expect(r.map(x => [x.id, x.n, x.pos, x.open])).toEqual([[VID.few + '/title/seq1', 2, 1, false], [VID.few + '/title/seq1', 2, 2, false], [VID.few + '/title/seq2', 2, 1, true], [VID.few + '/title/seq2', 2, 2, true]])
  })
  it('limite exato: 14 dias entre duas trocas ainda é a mesma sequência; 14 dias e 1 ms não é', () => {
    const a = loadFase4(), b = loadFase4(), n = a.ds.now
    setTitles(a.ds, VID.few, [n - 30 * DAY, n - 16 * DAY])
    setTitles(b.ds, VID.few, [n - 30 * DAY, n - 16 * DAY + 1])
    expect(runOf(createObservatory(a.ds), VID.few + '/title/1')!.n).toBe(2)
    const ob = createObservatory(b.ds)
    expect([runOf(ob, VID.few + '/title/1'), runOf(ob, VID.few + '/title/2')]).toEqual([null, null])
  })
  it('"aberta" = a última troca tem até 14 dias, inclusive', () => {
    const a = loadFase4(), b = loadFase4(), n = a.ds.now
    setTitles(a.ds, VID.few, [n - 20 * DAY, n - 14 * DAY])
    setTitles(b.ds, VID.few, [n - 20 * DAY, n - 14 * DAY - 1])
    expect(runOf(createObservatory(a.ds), VID.few + '/title/2')!.open).toBe(true)
    expect(runOf(createObservatory(b.ds), VID.few + '/title/2')!.open).toBe(false)
  })
  it('o dado não existe: uma troca só é null (conferido), nunca undefined; vídeo sem troca não tem nada', () => {
    const { ds } = loadFase4()
    setThumbs(ds, VID.few, [['A'], ['B', ds.now - 2 * DAY]])
    const obs = createObservatory(ds)
    expect(runOf(obs, VID.few + '/thumb/1')).toBeNull()
    expect(obs.changes.every(c => c.testRun !== undefined)).toBe(true)
  })
  it('descrição nunca forma sequência, mesmo com 4 trocas em 9 dias', () => {
    const { ds } = loadFase4(), obs = createObservatory(ds)
    const descs = obs.changes.filter(c => c.video === VID.dense && c.type === 'desc')
    expect(descs.length).toBe(4)
    expect(descs.map(c => c.testRun)).toEqual([null, null, null, null])
  })
  it('título e thumbnail do mesmo vídeo têm sequências separadas', () => {
    const { ds } = loadFase4(), obs = createObservatory(ds)
    const ids = new Set(obs.changes.filter(c => c.video === VID.dense && c.testRun).map(c => c.testRun!.id))
    expect([...ids].sort()).toEqual([VID.dense + '/thumb/seq1', VID.dense + '/title/seq1'])
  })
  it('paridade com o motor do mockup em todas as trocas dos cinco vídeos', () => {
    const { HM, ds } = loadFase4(), obs = createObservatory(ds)
    for (const v of HM.videos) for (const c of v.changes) expect(obs.change(c.id)!.testRun ?? null, c.id).toEqual(plain(c.testRun ?? null))
  })
  it('o oráculo de 02/10: toda troca sai com testRun definido e as três sequências conhecidas', () => {
    const obs = createObservatory(datasetFromOracle(loadOracle()))
    expect(obs.changes.every(c => c.testRun !== undefined)).toBe(true)
    const runs = [...new Map(obs.changes.filter(c => c.testRun).map(c => [c.testRun!.id, c.testRun!])).values()].map(r => [r.id, r.n]).sort()
    expect(runs).toEqual([['matt-opus55/thumb/seq1', 3], ['matt-opus55/title/seq1', 2], ['nomade-turcomenistao/thumb/seq1', 2]])
  })
  it('testRun é derivado depois de desempacotar: o pacote em cache não muda de versão', () => {
    expect(PACK_VERSION).toBe(1)
  })
})

describe('textos da sequência', () => {
  const { HM, ds } = loadFase4(), obs = createObservatory(ds)
  const open = runsOf(obs.changes.filter(c => c.video === VID.open), 'thumb')[0]!, closed = runsOf(obs.changes.filter(c => c.video === VID.closed), 'thumb')[0]!
  it('os textos aprovados, palavra por palavra', () => {
    expect(runCore(open)).toBe('5 trocas em 9 dias')
    expect(runText(obs.date, open)).toBe('trocas em sequência: 5 trocas em 9 dias, ainda aberta')
    expect(runText(obs.date, closed)).toBe('trocas em sequência: 5 trocas em 9 dias, encerrada em 11/11')
    expect(runShort(open)).toBe('5 trocas em sequência')
    expect(runCardText(open)).toBe('parte de 5 trocas em sequência em 9 dias')
    expect(RUN_CAVEAT).toBe('Pode ser um teste; o YouTube não informa.')
    expect(runDefinition(14)).toBe('Trocas em sequência: trocas do mesmo campo com até 14 dias entre uma e outra. Pode ser um teste; o YouTube não informa.')
  })
  it('"encerrada em" é a data da última troca', () => {
    expect(obs.date.dm(closed.to)).toBe('11/11')
    expect(closed.to).toBe(obs.change(VID.closed + '/thumb/5')!.at)
  })
  it('"em X dias" nunca é menos de 1: duas trocas com 2 horas de diferença', () => {
    expect(runDays({ id: 'x', n: 2, pos: 1, from: 0, to: 2 * H, open: true })).toBe(1)
    expect(runCore({ id: 'x', n: 2, pos: 1, from: 0, to: 2 * H, open: true })).toBe('2 trocas em 1 dia')
  })
  it('mesmos textos que o mockup para todas as sequências', () => {
    for (const v of HM.videos) for (const t of ['thumb', 'title'] as const)
      expect(runsOf(obs.changes.filter(c => c.video === v.id), t).map(r => runText(obs.date, r)), v.id + t).toEqual(plain(HM.runs(v.id, t).map(HM.runText)))
  })
  it('testRun ausente (desconhecido) e null (conferido) não entram em runsOf', () => {
    const cs = obs.changes.filter(c => c.video === VID.open).map(c => ({ ...c, testRun: undefined }))
    expect(runsOf(cs, 'thumb')).toEqual([])
    expect(runsOf(obs.changes.filter(c => c.video === VID.few), 'thumb')).toEqual([])
  })
})
