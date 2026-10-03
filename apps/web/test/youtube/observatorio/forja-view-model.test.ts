// @vitest-environment node
/**
 * Task 35 — the forja view model (header segment, button, cards, drawer) on the oracle dataset, with requests injected
 * from forja-scenarios.ts (session.setBase) or as DB-shaped requests in the dataset. Every "data does not exist" branch
 * has its own honest text (CLAUDE.md "falha em verde").
 */
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle, createTestObservatory } from './oracle'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Dataset } from '@/lib/youtube/observatorio'
import type { ForjaRequest, Niche } from '@/lib/youtube/observatorio/types'
import { buildForjaView, buildForjaDrawerView, comboKey, readingSeal, INCAPABLE_TEXT } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { buildChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'

const oracle = loadOracle()
const fresh = (): Dataset => datasetFromOracle(oracle)
const MIN = 6e4

/** A DB-shaped request (what taskRowToRequest yields), relative to the dataset's NOW. */
function dbReq(ds: Dataset, o: { niche: Niche; type?: string; video?: string; minutesAgo?: number; state?: ForjaRequest['state']; status?: string }): ForjaRequest {
  const type = o.type ?? 'padroes-titulo', createdAt = ds.now - (o.minutesAgo ?? 4) * MIN
  return {
    id: 'db-' + type + '-' + o.niche + '-' + (o.video ?? 'n'), type, niche: o.niche, status: o.status ?? 'pending', video: o.video ?? null,
    target: o.video ? { kind: 'video', niche: o.niche, video: o.video } : { kind: 'niche', niche: o.niche, fmt: 'long' },
    state: o.state ?? 'na fila', createdAt, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
  }
}

describe('header status — the ONLY format (CONVENCOES line 218)', () => {
  const want: Record<string, string> = {
    'na fila': 'na fila · pedido 14:58', 'trabalhando': 'trabalhando desde 14:45', 'atrasado': 'atrasado · pedido 14:33',
    'sem máquina': 'sem máquina desde 12:55', 'nova tentativa': 'nova tentativa · 15:05', 'liberado pelo vigia': 'liberado pelo vigia · 15:05',
    'falhou': 'falhou às 14:21', 'recusado (dado velho)': 'recusado às 14:56', 'publicado': 'publicado às 14:50',
  }
  it.each(Object.entries(want))('%s → "%s"', (state, label) => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase(state, { type: 'padroes-titulo' })
    const v = buildForjaView(obs, { screen: 'outliers', niche: 'ia' })
    expect(v.status!.text).toBe(label)
    const active = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'].includes(state)
    expect(v.status!.active).toBe(active)
    expect(v.status!.terminal).toBe(!active)
    // the chrome segment is the same view (wired through buildChromeView)
    expect(buildChromeView(obs, { tab: 'outliers', niche: 'ia', forja: v }).forja).toBe(v)
  })
  it('with Todos, a busy niche is an ACTIVE line (never a terminal pill)', () => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase('publicado', { type: 'padroes-titulo' })
    const v = buildForjaView(obs, { screen: 'outliers', niche: 'todos' })
    // publicado with Todos: IA published, Viagem still working behind it
    expect(v.status!.active).toBe(true)
    expect(v.status!.terminal).toBe(false)
    expect(v.status!.text).toMatch(/^Viagem: trabalhando desde \d\d:\d\d$/)
    expect(v.status!.lines).toEqual(v.card.lines)
  })
})

describe('"sem máquina" statusText', () => {
  it('one niche: singular sentence, exact', () => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase('sem máquina', { type: 'padroes-titulo' })
    expect(buildForjaView(obs, { screen: 'outliers', niche: 'ia' }).status!.statusText).toBe('Seu pedido das 14:48 está na fila e roda quando a máquina voltar.')
  })
  it('Todos: the official plural, exact', () => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase('sem máquina', { type: 'padroes-titulo' })
    expect(buildForjaView(obs, { screen: 'outliers', niche: 'todos' }).status!.statusText).toBe('Seus pedidos das 14:48 (IA e Viagem) estão na fila e rodam quando a máquina voltar.')
  })
  it('the machine segment says "sem máquina" with the hour of the last poll', () => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase('sem máquina', { type: 'padroes-titulo' })
    expect(buildForjaView(obs, { screen: 'outliers', niche: 'ia' }).machine).toMatchObject({ alive: false, text: 'forja sem máquina · 12:55' })
  })
})

describe('button', () => {
  it('Todos + IA busy + Viagem free → free-niche "Pedir leitura de Viagem à forja" / "Ler Viagem"', () => {
    const ds = fresh()
    ds.requests.push(dbReq(ds, { niche: 'ia' }))
    const v = buildForjaView(createObservatory(ds), { screen: 'outliers', niche: 'todos' })
    expect(v.button).toEqual({ mode: 'free-niche', label: 'Pedir leitura de Viagem à forja', short: 'Ler Viagem', ariaLabel: 'Pedir leitura de Viagem à forja' })
    expect(v.status!.active).toBe(true)
    expect(v.status!.terminal).toBe(false)
    expect(v.ask).toEqual({ scope: 'viagem', niches: ['viagem'] })
  })
  it('one niche busy → "Pedido em andamento" (busy), nothing to ask', () => {
    const ds = fresh()
    ds.requests.push(dbReq(ds, { niche: 'ia' }))
    const v = buildForjaView(createObservatory(ds), { screen: 'outliers', niche: 'ia' })
    expect(v.button.mode).toBe('busy')
    expect(v.button.label).toBe('Pedido em andamento')
    expect(v.ask).toBeNull()
    expect(v.cancel).toEqual(['ia'])
  })
  it('capabilities [] → disabled with "A forja ainda não lê pedidos do observatório."', () => {
    const ds = fresh()
    ds.queue.capabilities = []
    const v = buildForjaView(createObservatory(ds), { screen: 'insights', niche: 'viagem' })
    expect(v.capable).toBe(false)
    expect(v.incapableText).toBe('A forja ainda não lê pedidos do observatório.')
    expect(v.button).toMatchObject({ mode: 'disabled', disabledText: INCAPABLE_TEXT })
    expect(v.ask).toBeNull()
  })
  it('capabilities without THIS type → disabled too (the heartbeat announces per type)', () => {
    const ds = fresh()
    ds.queue.capabilities = ['padroes-titulo']
    expect(buildForjaView(createObservatory(ds), { screen: 'mudancas', niche: 'ia' }).button.disabledText).toBe(INCAPABLE_TEXT)
    expect(buildForjaView(createObservatory(ds), { screen: 'outliers', niche: 'ia' }).button.mode).toBe('free')
  })
  it('quota used (published today) → disabled with the quota text', () => {
    const obs = createTestObservatory(fresh())
    const sc = obs.forja.session.setBase('publicado', { type: 'padroes-titulo' })
    expect(sc.quota.usedToday).toBeGreaterThan(0)
    const v = buildForjaView(obs, { screen: 'insights', niche: 'ia' })
    expect(v.button.mode).toBe('disabled')
    expect(v.button.disabledText).toBe('Cota de hoje usada; libera domingo, 25/10 às 00:00')
    expect(v.card.quotaNote).toBe('Cota de hoje usada; libera domingo, 25/10 às 00:00.')
  })
  it('failure does not count: after "falhou" the button asks again', () => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase('falhou', { type: 'padroes-titulo' })
    const v = buildForjaView(obs, { screen: 'insights', niche: 'ia' })
    expect(v.button).toMatchObject({ mode: 'free', label: 'Pedir nova leitura à forja' })
  })
  it('variant: solid in Insights and Histórico, outlined elsewhere; Histórico keeps the header without button', () => {
    const obs = createObservatory(fresh())
    expect(buildForjaView(obs, { screen: 'insights', niche: 'ia' }).variant).toBe('solid')
    expect(buildForjaView(obs, { screen: 'historico', niche: 'ia', videoId: SHOWCASE }).variant).toBe('solid')
    expect(buildForjaView(obs, { screen: 'historico', niche: 'ia', videoId: SHOWCASE }).headerVariant).toBe('none')
    for (const s of ['canais', 'mudancas', 'outliers'] as const) expect(buildForjaView(obs, { screen: s, niche: 'ia' }).variant).toBe('outline')
  })
  it('first reading ever: "Pedir leitura à forja"', () => {
    const ds = fresh()
    ds.readings = []; ds.requests = []
    expect(buildForjaView(createObservatory(ds), { screen: 'outliers', niche: 'ia' }).button.label).toBe('Pedir leitura à forja')
  })
})

describe('frozen reading', () => {
  const obs = createObservatory(fresh())
  const v = buildForjaView(obs, { screen: 'insights', niche: 'viagem' })
  const P = obs.forja.byId['padroes-titulo-viagem-20-10']!
  it('the seal: "forja · <model> · <tipo>, <janela> · DD/MM HH:MM (SP)", model from the reading', () => {
    expect(v.reading!.seal).toBe('forja · Gemma 12B · fórmulas, 6 meses · 20/10 06:10 (SP)')
    expect(readingSeal(obs, obs.forja.byId['temas-viagem-20-10']!)).toBe('forja · Gemma 12B · temas, 90 dias · 20/10 06:10 (SP)')
    expect(readingSeal(obs, obs.forja.byId['resumo-trocas-ia-20-10']!)).toBe('forja · Gemma 12B · trocas, 30 dias · 20/10 06:10 (SP)')
  })
  it('the model of a DB reading wins; none at all → "modelo não registrado" (never a hardcoded Gemma 12B)', () => {
    expect(readingSeal(obs, { ...P, model: 'gemma3:12b-it', seal: 'forja · gemma3:12b-it · padroes-titulo' })).toBe('forja · gemma3:12b-it · fórmulas, 6 meses · 20/10 06:10 (SP)')
    expect(readingSeal(obs, { ...P, model: undefined, seal: '' })).toBe('forja · modelo não registrado · fórmulas, 6 meses · 20/10 06:10 (SP)')
  })
  it('items and lead are the frozen text, literally', () => {
    expect(v.reading!.items).toEqual(P.text.items)
    expect(v.reading!.lead).toBe(P.text.lead)
    expect(v.reading!.title).toBe(P.text.title)
  })
  it('"Desde então": capitalised, its own line, no final period; the detail is the engine text', () => {
    const s = obs.forja.since(P.id)!
    expect(v.reading!.since!.shortText).toBe('Desde então: +4 vídeos novos · 3 ganharam base · 7 saíram da janela · 1 canal fora')
    expect(v.reading!.since!.shortText.endsWith('.')).toBe(false)
    expect(v.reading!.since!.text).toBe(s.text)
  })
  it('while a request is active, "Desde então" drops "Peça nova leitura" (textNoAsk)', () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, { niche: 'viagem' }))
    const o2 = createObservatory(ds)
    const r = buildForjaView(o2, { screen: 'insights', niche: 'viagem' }).reading!
    expect(r.since!.text).toBe(o2.forja.since(P.id)!.textNoAsk)
    expect(r.siteNotes).toContain('O pedido de Viagem em andamento vai trazer uma leitura nova.')
  })
  it('evidence link N = outliers({reading, …}).count and the href carries reading=', () => {
    const ev = v.reading!.evidenceLinks
    expect(ev.length).toBeGreaterThan(0)
    const preco = ev.find(e => e.href.includes('formula=preco'))!
    expect(preco.n).toBe(obs.outliers({ reading: P.id, formula: 'preco', min: 0 }).count)
    expect(preco.href).toContain('reading=' + P.id)
    const base = ev[ev.length - 1]!
    expect(base.n).toBe(obs.outliers({ reading: P.id, min: obs.RULES.outlierMin }).count)
  })
  it('the sent data is "Do site", outside the seal', () => {
    expect(v.reading!.sentText).toBe('Dados enviados à forja: ' + P.sent.text.replace(/^dados enviados à forja: /, '') + '.')
  })
  it('resumo-trocas: one "Ver as N trocas" link per group, N = the group size', () => {
    const r = buildForjaView(obs, { screen: 'mudancas', niche: 'ia' }).reading!
    expect(r.evidenceLinks[0]).toMatchObject({ label: 'Ver a troca', n: 1 })
    expect(r.evidenceLinks[0]!.href).toContain('/mudancas?changes=')
  })
})

describe('what happens when the data does not exist', () => {
  it('no heartbeat row → "forja sem máquina · nenhuma consulta registrada"', () => {
    const ds = fresh(); ds.queue.lastPollAt = null
    const v = buildForjaView(createObservatory(ds), { screen: 'canais', niche: 'ia' })
    expect(v.machine).toEqual({ alive: false, text: 'forja sem máquina · nenhuma consulta registrada', time: null, title: 'Nenhuma consulta da máquina registrada' })
  })
  it('no heartbeat + a pending request → the request is "sem máquina", never "na fila"', () => {
    const ds = fresh(); ds.queue.lastPollAt = null
    ds.requests.push(dbReq(ds, { niche: 'ia', state: 'sem máquina' }))
    const v = buildForjaView(createObservatory(ds), { screen: 'outliers', niche: 'ia' })
    expect(v.status!.text).toBe('sem máquina desde —')
    expect(v.status!.statusText).toMatch(/^Seu pedido das \d\d:\d\d está na fila e roda quando a máquina voltar\.$/)
  })
  it('no reading → reading null, and each niche says so', () => {
    const ds = fresh(); ds.readings = []
    const v = buildForjaView(createObservatory(ds), { screen: 'mudancas', niche: 'todos' })
    expect(v.reading).toBeNull()
    expect(v.niches.map(n => n.emptyText)).toEqual(['Ainda não há leitura de resumo das trocas de IA.', 'Ainda não há leitura de resumo das trocas de Viagem.'])
  })
  it('a reading with an empty items list → an honest site note', () => {
    const ds = fresh()
    for (const r of ds.readings) if (r.id === 'padroes-titulo-ia-20-10') r.text.items = []
    const v = buildForjaView(createObservatory(ds), { screen: 'insights', niche: 'ia' })
    expect(v.reading!.items).toEqual([])
    expect(v.reading!.siteNotes).toContain('Esta leitura não trouxe itens; só o resumo acima.')
  })
  it('a reading with no text at all → "chegou sem texto"', () => {
    const ds = fresh()
    for (const r of ds.readings) if (r.id === 'padroes-titulo-ia-20-10') r.text = { lead: '', items: [] }
    const v = buildForjaView(createObservatory(ds), { screen: 'insights', niche: 'ia' })
    expect(v.reading!.siteNotes[0]).toBe('A leitura chegou sem texto: a forja não escreveu nada que o validador aceitasse.')
  })
  it('a frozen sent missing → "não ficaram registrados", never an empty line', () => {
    const ds = fresh()
    for (const r of ds.readings) if (r.id === 'padroes-titulo-ia-20-10') r.sent = { ...r.sent, text: '' }
    expect(buildForjaView(createObservatory(ds), { screen: 'insights', niche: 'ia' }).reading!.sentText).toBe('Os dados enviados à forja não ficaram registrados com esta leitura.')
  })
  it('a frozen reading that cites a change the observatory no longer has: no crash, since null, said in "Do site"', () => {
    const ds = fresh()
    for (const r of ds.readings) if (r.id === 'resumo-trocas-ia-20-10') r.sent = { ...r.sent, changeIds: [...(r.sent.changeIds ?? []), 'sumiu/title/9'] }
    const r = buildForjaView(createObservatory(ds), { screen: 'mudancas', niche: 'ia' }).reading!
    expect(r.since).toBeNull()
    expect(r.siteNotes).toContain('Não deu para comparar esta leitura com os dados de hoje: ela cita dados que o observatório não tem mais.')
  })
  it('a reading whose since cannot be computed (unknown id) has since null', () => {
    const obs = createObservatory(fresh())
    expect(obs.forja.since('nao-existe')).toBeNull()
  })
})

describe('Histórico (leitura-video)', () => {
  it('another video of the same niche with an active request blocks the button, with the reason and a link to it', () => {
    const ds = fresh()
    const obs0 = createObservatory(ds)
    const other = obs0.videos.find(v => v.niche === 'ia' && v.id !== SHOWCASE && v.tracked && !obs0.channel(v.ch)!.own)!
    ds.requests.push(dbReq(ds, { niche: 'ia', type: 'leitura-video', video: other.id }))
    const obs = createObservatory(ds)
    const v = buildForjaView(obs, { screen: 'historico', niche: 'ia', videoId: SHOWCASE })
    expect(v.blockedBy).not.toBeNull()
    expect(v.blockedBy!.href).toBe(obs.link.historico(other.id))
    expect(v.blockedBy!.reason).toMatch(/^Nada enviado: já há uma leitura de vídeo de IA na fila · pedido \d\d:\d\d, do vídeo “/)
    expect(v.button).toMatchObject({ mode: 'disabled', disabledText: v.blockedBy!.reason })
  })
  it('the video reading is the frozen one of THIS video', () => {
    const obs = createObservatory(fresh())
    const v = buildForjaView(obs, { screen: 'historico', niche: 'ia', videoId: SHOWCASE })
    expect(v.reading!.id).toBe('leitura-video-matt-opus55-20-10')
    expect(v.reading!.seal).toBe('forja · Gemma 12B · vídeo · 20/10 06:10 (SP)')
  })
})

describe('a new request is timestamped now', () => {
  it('"enviado agora", never negative minutes', () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, { niche: 'ia', minutesAgo: 0 }))
    const v = buildForjaView(createObservatory(ds), { screen: 'outliers', niche: 'ia' })
    expect(v.card.sentNow).toBe('Pedido de IA enviado agora.')
    expect(v.status!.statusText).not.toMatch(/−|-\d/)
  })
})

describe('drawer (moldura)', () => {
  it('Todos with IA busy: the seletor starts on Viagem and the combo sends only Viagem', () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, { niche: 'ia' }))
    const d = buildForjaDrawerView(createObservatory(ds), { niche: 'todos', type: 'padroes-titulo' })
    expect(d.freeNiches).toEqual(['ia', 'viagem'])
    const c = d.combos[comboKey('padroes-titulo', 'todos')]!
    expect(c.effNiche).toBe('viagem')
    expect(c.partial).toMatch(/^Já há um pedido de IA em andamento \(na fila · pedido \d\d:\d\d\)\. O pedido vai só para Viagem\.$/)
  })
  it('one run card per type with a request, with the engine statusText', () => {
    const obs = createTestObservatory(fresh())
    const sc = obs.forja.session.setBase('na fila', { type: 'padroes-titulo' })
    const d = buildForjaDrawerView(obs, { niche: 'todos' })
    expect(d.runs).toHaveLength(1)
    expect(d.runs[0]!.kase).toBe('queued')
    expect(d.runs[0]!.tit).toBe(sc.statusText)
    expect(d.runs[0]!.eta.big).toBe('15:05')
    expect(d.runs[0]!.cancel).toEqual({ label: 'Cancelar pedidos', niches: ['ia', 'viagem'] })
  })
  it('no heartbeat: the confirm says the forja never polled (no invented hour)', () => {
    const ds = fresh(); ds.queue.lastPollAt = null
    const d = buildForjaDrawerView(createObservatory(ds), { niche: 'ia' })
    expect(d.combos[comboKey('temas', 'ia')]!.confirm.quando).toMatch(/^A forja ainda não consultou a fila; o pedido espera a primeira consulta\. /)
    expect(d.machine.alive).toBe(false)
  })
  it('a running request is not cancellable', () => {
    const obs = createTestObservatory(fresh())
    obs.forja.session.setBase('trabalhando', { type: 'resumo-trocas' })
    const d = buildForjaDrawerView(obs, { niche: 'ia' })
    expect(d.runs[0]!.kase).toBe('running')
    expect(d.runs[0]!.cancel).toBeNull()
    expect(buildForjaView(obs, { screen: 'mudancas', niche: 'ia' }).cancel).toEqual([])
  })
})
