// @vitest-environment node
/**
 * Tarefa 13, rodada de conserto da 11d (I-1 a I-4): a regra "dado igual não repete" provada com a leitura que o MOTOR monta
 * (`buildSent`, mapeada de volta pelo carregador como na produção), não com uma leitura do oráculo congelada à mão.
 * Regra do resultado: com dado igual o botão fica apagado em TODA tela e o servidor recusa; com dado novo, aceso e o servidor aceita.
 */
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { plain } from './fase4-world'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { toReading, type ReadingRow } from '@/lib/youtube/observatorio/load'
import { createClock } from '@/lib/youtube/observatorio/time'
import { machineOf } from '@/lib/youtube/observatorio/forja/states'
import { planAsk } from '@/lib/youtube/observatorio/forja/session'
import { semNovidadeText } from '@/lib/youtube/observatorio/forja/novidade'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { buildForjaView, forjaReadingView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { Dataset, FrozenReading } from '@/lib/youtube/observatorio/types'

const J = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const MIN = 6e4
let base: Dataset | null = null
const baseDs = (): Dataset => (base ??= plain(datasetFromOracle(loadOracle())))

type Alvo = { niche?: 'ia' | 'viagem'; videoId?: string; fmt?: 'long' | 'short' }
const CASOS: Array<[string, Alvo]> = [
  ['padroes-titulo', { niche: 'ia' }], ['padroes-titulo-shorts', { niche: 'viagem', fmt: 'short' }], ['temas', { niche: 'viagem' }],
  ['resumo-trocas', { niche: 'ia' }], ['leitura-video', { videoId: 'matt-opus55' }],
]

/** A leitura que o motor montaria agora para o alvo, guardada como a produção a guarda (sem `base` do oráculo, só `sent`), escrita depois de tudo. */
function lerAgora(ds: Dataset, type: string, alvo: Alvo, ajusta?: (sent: Record<string, unknown>) => void): FrozenReading {
  const o = createObservatory(ds)
  const sent = J(o.forja.buildSent(type, alvo)) as unknown as Record<string, unknown>
  ajusta?.(sent)
  const niche = alvo.niche ?? o.video(alvo.videoId!)?.niche ?? 'ia'
  return toReading({
    id: 'rec-' + type, task_type: type, niche, video_id: alvo.videoId ?? null, fmt: alvo.fmt ?? null, model: 'Gemma 12B',
    generated_at: new Date(ds.now - MIN).toISOString(), sent, analysis: {}, text: { lead: 'x', items: [] }, evidence: [],
  } as ReadingRow)!
}
/** O conjunto sem pedidos do dia (o caso comum a partir do dia seguinte) e só com a leitura dada. */
function mundoCom(r: FrozenReading, mut?: (ds: Dataset) => void): { obs: Observatory; ds: Dataset } {
  const ds = plain(baseDs())
  mut?.(ds)
  ds.readings = [r]; ds.requests = []
  return { obs: createObservatory(ds), ds }
}
const askServidor = (w: { obs: Observatory; ds: Dataset }, scope: string, target: { type: string; video?: string | null }) => {
  const clock = createClock(w.ds.now, w.ds.seriesStart, w.ds.snap0)
  return planAsk([], machineOf(w.ds.queue.lastPollAt, clock), clock, w.obs.forja.planOpts, scope, target)
}
const nichoDe = (a: Alvo, o: Observatory) => a.niche ?? o.video(a.videoId!)!.niche!

describe('I-4: a leitura que o motor acabou de montar bloqueia um novo pedido com o mesmo dado', () => {
  it.each(CASOS)('%s: leitura recém-feita, mesmo dado → sem novidade, e o servidor recusa com a frase', (type, alvo) => {
    const ds = plain(baseDs())
    const r = lerAgora(ds, type, alvo)
    const w = mundoCom(r)
    const niche = nichoDe(alvo, w.obs)
    expect(w.obs.forja.novidade(type, niche, alvo.videoId ?? null)).toEqual({ pode: false })
    const res = askServidor(w, niche, { type, video: alvo.videoId ?? null })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe(semNovidadeText(alvo.videoId ? 'deste vídeo' : 'de ' + w.obs.nicheLabel(niche)))
  })
  it.each(CASOS)('%s: um registro diário novo desde a leitura → há novidade, e o servidor aceita', (type, alvo) => {
    const ds = plain(baseDs())
    const o = createObservatory(ds)
    // a leitura foi congelada um registro diário antes do último (o que a produção vê no dia seguinte)
    const r = lerAgora(ds, type, alvo, sent => { sent.asOf = createClock(ds.now, ds.seriesStart, ds.snap0).snapTime(o.LAST_IDX - 1) })
    const w = mundoCom(r)
    const niche = nichoDe(alvo, w.obs)
    expect(w.obs.forja.novidade(type, niche, alvo.videoId ?? null)).toMatchObject({ pode: true })
    const res = askServidor(w, niche, { type, video: alvo.videoId ?? null })
    expect(res.ok).toBe(true)
  })
  it('sem leitura nenhuma do alvo: pode, com o porquê "sem-leitura" (o teste que apaga a leitura)', () => {
    const w = mundoCom(lerAgora(plain(baseDs()), 'temas', { niche: 'viagem' }))
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: true, porque: 'sem-leitura' })
  })
})

describe('I-2: vídeo — o "dado atual" usa a conta do congelamento (min do último registro do site e do último ponto do PRÓPRIO vídeo)', () => {
  const ALVO = 'matt-opus55'
  it('vídeo cujo último ponto ficou para trás do canal: a leitura recém-feita diz "sem novidade" (antes: "dado novo" para sempre)', () => {
    const ds = plain(baseDs())
    const v = ds.videos.find(x => x.id === ALVO)!
    const lastIdx = createObservatory(ds).LAST_IDX
    expect(v.series[v.series.length - 1]!.idx).toBeGreaterThanOrEqual(lastIdx - 1) // ponto de partida: o vídeo estava em dia
    v.series = v.series.filter(p => p.idx < lastIdx - 2) // ... e agora parou 3 registros antes do canal
    const r = lerAgora(ds, 'leitura-video', { videoId: ALVO })
    const w = mundoCom(r, d => { d.videos.find(x => x.id === ALVO)!.series = v.series })
    expect(w.obs.forja.novidade('leitura-video', 'ia', ALVO)).toEqual({ pode: false })
    expect(askServidor(w, 'ia', { type: 'leitura-video', video: ALVO }).ok).toBe(false)
    // a mesma conta no "Desde então": nenhum registro diário novo é prometido
    expect(w.obs.forja.since(r.id)!.shortText).toBe('desde então: nada mudou')
  })
  it('vídeo sem nenhum ponto: sem novidade depois da primeira leitura (a série vazia não é "dado novo")', () => {
    const ds = plain(baseDs())
    ds.videos.find(x => x.id === ALVO)!.series = []
    const r = lerAgora(ds, 'leitura-video', { videoId: ALVO })
    const w = mundoCom(r, d => { d.videos.find(x => x.id === ALVO)!.series = [] })
    expect(w.obs.forja.novidade('leitura-video', 'ia', ALVO)).toEqual({ pode: false })
    expect(askServidor(w, 'ia', { type: 'leitura-video', video: ALVO }).ok).toBe(false)
  })
  it('vídeo parado ganha um ponto novo: há novidade (o dado mudou de verdade)', () => {
    const ds = plain(baseDs())
    const v = ds.videos.find(x => x.id === ALVO)!
    const lastIdx = createObservatory(ds).LAST_IDX
    const completa = v.series
    v.series = completa.filter(p => p.idx < lastIdx - 1)
    const r = lerAgora(ds, 'leitura-video', { videoId: ALVO })
    const w = mundoCom(r, d => { d.videos.find(x => x.id === ALVO)!.series = completa })
    expect(w.obs.forja.novidade('leitura-video', 'ia', ALVO)).toMatchObject({ pode: true, porque: 'dado-novo' })
  })
})

describe('I-3: o "Desde então" mede a janela de 30 dias contra a mesma referência do envio', () => {
  /**
   * Uma troca de título de um vídeo de IA cai na faixa onde os dois relógios discordam: depois do início da janela do ENVIO (asOf − 30 d) e antes
   * do início da janela medida contra o relógio (now − 30 d, ~3 h à frente de asOf). Ela entra na leitura e, contra o relógio, já "saiu".
   */
  const comTrocaNaBorda = (ds: Dataset) => {
    const asOf = ds.snap0 + createObservatory(ds).LAST_IDX * 864e5
    const v = ds.videos.find(x => x.id === 'matt-opus55')!
    v.titles[0]!.first_seen = asOf - 35 * 864e5; v.titles[1]!.first_seen = asOf - 32 * 864e5; v.titles[2]!.first_seen = asOf - 30 * 864e5 + 36e5
  }
  it('resumo das trocas recém-feito, com uma troca na borda da janela: ela é enviada, não "saiu", e o "Desde então" diz que nada mudou', () => {
    const ds = plain(baseDs()); comTrocaNaBorda(ds)
    const r = lerAgora(ds, 'resumo-trocas', { niche: 'ia' })
    expect(r.sent.changeIds).toContain('matt-opus55/title/2') // a troca da borda foi enviada
    const w = mundoCom(r, comTrocaNaBorda)
    const s = w.obs.forja.since(r.id)!
    expect(s.shortText).toBe('desde então: nada mudou')
    expect(s.text).not.toMatch(/saiu|saíram/)
    expect(w.obs.forja.novidade('resumo-trocas', 'ia', null)).toEqual({ pode: false })
    expect(askServidor(w, 'ia', { type: 'resumo-trocas' }).ok).toBe(false)
  })
  it('resumo das trocas recém-feito sem nada na borda: nada mudou (o caso simples)', () => {
    const r = lerAgora(plain(baseDs()), 'resumo-trocas', { niche: 'ia' })
    expect(mundoCom(r).obs.forja.since(r.id)!.shortText).toBe('desde então: nada mudou')
  })
  it('uma troca nova depois da leitura continua sendo novidade', () => {
    const ds = plain(baseDs())
    const o = createObservatory(ds)
    const r = lerAgora(ds, 'resumo-trocas', { niche: 'ia' })
    // a leitura fica 'velha': foi escrita antes da troca mais nova do nicho
    const novas = o.changesIn({}).filter(c => c.niche === 'ia')
    expect(novas.length).toBeGreaterThan(0)
    // (onda final, I-1) a leitura de antes não levou a troca mais nova do nicho: o envio de agora a leva, então é novidade de verdade
    const maisNova = novas.reduce((a, b) => (b.at > a.at ? b : a))
    const sem = J(r)
    sem.sent.changeIds = (sem.sent.changeIds as string[]).filter(id => id !== maisNova.id)
    sem.sent.ids = (sem.sent.ids as string[]).filter(id => id !== maisNova.id)
    const w = mundoCom({ ...sem, generatedAt: maisNova.at - 1 })
    expect(w.obs.forja.novidade('resumo-trocas', 'ia', null)).toMatchObject({ pode: true })
  })
})

describe('I-1: o painel lateral de Canais usa a mesma função do servidor', () => {
  const IA = () => baseDs().channels.find(c => !c.own && c.niche === 'ia')!.id
  const drawerDe = (w: { obs: Observatory }) => buildCanaisView(w.obs, { niche: 'todos', limit: 75, channel: IA() }).drawerForja!
  it('dado igual e SEM pedido no dia: o botão do painel está apagado e traz a frase (o caso normal do dia seguinte)', () => {
    const r = lerAgora(plain(baseDs()), 'resumo-trocas', { niche: 'ia' })
    const w = mundoCom(r)
    expect(w.obs.forja.session.current('ia', { type: 'resumo-trocas' }).empty).toBe(true) // sem pedido na janela
    const d = drawerDe(w)
    expect(d.button.disabled).toBe(true)
    expect(d.why).toContain(semNovidadeText('de IA'))
    expect(askServidor(w, 'ia', { type: 'resumo-trocas' }).ok).toBe(false) // o servidor recusa: a mesma resposta
  })
  it('dado novo e sem pedido: o botão fica aceso e o servidor aceita', () => {
    const ds = plain(baseDs())
    const o = createObservatory(ds)
    const r = lerAgora(ds, 'resumo-trocas', { niche: 'ia' }, sent => { sent.asOf = createClock(ds.now, ds.seriesStart, ds.snap0).snapTime(o.LAST_IDX - 1) })
    const w = mundoCom(r)
    const d = drawerDe(w)
    expect(d.button.disabled).toBe(false)
    expect(d.why).not.toContain('já usa o dado mais recente')
    expect(askServidor(w, 'ia', { type: 'resumo-trocas' }).ok).toBe(true)
  })
  it('pedido que FALHOU com a leitura em dia: o botão continua apagado (o servidor recusa)', () => {
    const r = lerAgora(plain(baseDs()), 'resumo-trocas', { niche: 'ia' })
    const ds = plain(baseDs())
    ds.readings = [r]
    ds.requests = [{ id: 'f1', type: 'resumo-trocas', niche: 'ia', status: 'failed', state: 'falhou', video: null, target: { kind: 'niche', niche: 'ia', fmt: 'long' }, createdAt: ds.now - 5 * MIN, claimedAt: null, startedAt: null, publishedAt: null, failedAt: ds.now - 2 * MIN, attempt: 1, refusedReason: null, readingId: null } as unknown as Dataset['requests'][number]]
    const w = { obs: createObservatory(ds), ds }
    expect(drawerDe(w).button.disabled).toBe(true)
  })
  it('o painel, o botão do cabeçalho e o servidor dizem o mesmo, com dado igual e com dado novo', () => {
    for (const novo of [false, true]) {
      const ds = plain(baseDs())
      const o = createObservatory(ds)
      const r = lerAgora(ds, 'resumo-trocas', { niche: 'ia' }, novo ? sent => { sent.asOf = createClock(ds.now, ds.seriesStart, ds.snap0).snapTime(o.LAST_IDX - 1) } : undefined)
      const w = mundoCom(r)
      const servidor = askServidor(w, 'ia', { type: 'resumo-trocas' }).ok
      const cab = buildForjaView(w.obs, { screen: 'mudancas', niche: 'ia' })
      expect(servidor, `novo=${novo}`).toBe(novo)
      expect(drawerDe(w).button.disabled, `painel, novo=${novo}`).toBe(!novo)
      expect(cab.button.mode === 'disabled', `cabeçalho, novo=${novo}`).toBe(!novo)
    }
  })
})

/* ------------------------------------------------------------------------------------------------------------------------------------ */
/* Onda final, I-1: no mesmo registro diário, o botão acende só se o envio de agora difere do envio congelado da leitura                  */
/* ------------------------------------------------------------------------------------------------------------------------------------ */
describe('I-1 (onda final): mesmo registro diário — decide o envio de agora contra o congelado, não o texto do "Desde então"', () => {
  const H = 36e5
  const asOfDe = (ds: Dataset) => createClock(ds.now, ds.seriesStart, ds.snap0).snapTime(createObservatory(ds).LAST_IDX)
  /** Uma troca de título do vídeo, vista em `at` (o relógio da semente está ~3 h à frente do último registro diário). */
  function trocaTitulo(ds: Dataset, videoId: string, at: number, texto = 'Título novo de teste') {
    const v = ds.videos.find(x => x.id === videoId)!
    const ult = v.titles[v.titles.length - 1]!
    ult.current = false
    v.titles.push({ ...ult, id: videoId + '/title/novo', first_seen: at, last_seen: ds.now, current: true, prec: 'min', window: null, text: texto })
    v.title = texto
  }
  const idsEnviados = (r: FrozenReading) => (r.sent.ids as string[])

  it('(a) título trocado depois do último registro diário: a leitura recém-feita diz "1 título trocado" no Desde então, mas o botão fica apagado e o servidor recusa', () => {
    const ds0 = plain(baseDs())
    const r = lerAgora(ds0, 'padroes-titulo', { niche: 'ia' })
    const alvo = idsEnviados(r)[0]!
    const at = asOfDe(ds0) + H
    expect(at).toBeLessThan(ds0.now) // a troca caiu depois do último registro diário e antes de agora
    const w = mundoCom(r, ds => trocaTitulo(ds, alvo, at))
    expect(w.obs.forja.since(r.id)!.shortText).toContain('1 título trocado') // o texto da tela continua existindo
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: false })
    const res = askServidor(w, 'ia', { type: 'padroes-titulo' })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe(semNovidadeText('de IA'))
    expect(w.obs.forja.session.ask('ia', { type: 'padroes-titulo' }).ok).toBe(false)
  })
  it('(a) e o envio que se montaria agora é, de fato, igual ao congelado (a premissa do conserto)', () => {
    const ds0 = plain(baseDs())
    const r = lerAgora(ds0, 'padroes-titulo', { niche: 'ia' })
    const w = mundoCom(r, ds => trocaTitulo(ds, idsEnviados(r)[0]!, asOfDe(ds0) + H))
    const agora = J(w.obs.forja.buildSent('padroes-titulo', { niche: 'ia' }))
    expect(agora.ids).toEqual(r.sent.ids)
    expect(agora.text).toBe(r.sent.text)
  })
  it('(b) leitura com corte (mais de 400 vídeos, aqui com o teto em 3): "antigos entraram" no Desde então, botão apagado, servidor recusa', () => {
    const teto = RULES.forja as { maxVideos: number }, original = teto.maxVideos
    teto.maxVideos = 3
    try {
      const r = lerAgora(plain(baseDs()), 'padroes-titulo', { niche: 'ia' })
      expect(r.sent.capped).toBe(true)
      const w = mundoCom(r)
      expect(w.obs.forja.since(r.id)!.shortText).toMatch(/antigos? entra/)
      expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: false })
      expect(askServidor(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(false)
    } finally { teto.maxVideos = original }
  })
  it('(c) troca nova depois da leitura, no mesmo registro: o Desde então conta "+1 troca nova", mas o envio novo não a leva — botão apagado, servidor recusa', () => {
    const ds0 = plain(baseDs())
    const r = lerAgora(ds0, 'resumo-trocas', { niche: 'ia' })
    // um vídeo do nicho sem nenhuma troca antes: a troca nova é a única diferença (num vídeo com trocas, o veredito das anteriores também mudaria o envio)
    const o0 = createObservatory(ds0), comTroca = new Set(o0.changesIn({}).map(c => c.video))
    const solto = ds0.videos.find(v => v.niche === 'ia' && !comTroca.has(v.id) && !ds0.channels.find(c => c.id === v.ch)!.own && (r.sent.channels as string[]).includes(v.ch))!.id
    const w = mundoCom(r, ds => trocaTitulo(ds, solto, ds.now - 30e3))
    expect(w.obs.forja.since(r.id)!.shortText).toContain('+1 troca nova')
    const cab = buildForjaView(w.obs, { screen: 'mudancas', niche: 'ia' })
    expect(w.obs.forja.novidade('resumo-trocas', 'ia', null)).toEqual({ pode: false })
    expect(cab.button.mode).toBe('disabled')
    expect(askServidor(w, 'ia', { type: 'resumo-trocas' }).ok).toBe(false)
    const drawer = buildCanaisView(w.obs, { niche: 'todos', limit: 75, channel: baseDs().channels.find(c => !c.own && c.niche === 'ia')!.id }).drawerForja!
    expect(drawer.button.disabled).toBe(true)
  })
  it('o cartão da leitura não manda "pedir nova leitura" quando o botão está apagado: diz que o que mudou só entra depois da próxima coleta', () => {
    const ds0 = plain(baseDs())
    const r = lerAgora(ds0, 'padroes-titulo', { niche: 'ia' })
    const w = mundoCom(r, ds => trocaTitulo(ds, idsEnviados(r)[0]!, asOfDe(ds0) + H))
    const v = forjaReadingView(w.obs, w.obs.forja.byId[r.id]!, { active: false, isNew: false, activeNote: null })
    expect(v.since!.shortText).toContain('1 título trocado')
    expect(v.since!.text).not.toContain('Peça nova leitura')
    expect(v.since!.text).toContain('só entra numa leitura nova depois da próxima coleta')
  })

  // o que continua sendo novidade de verdade
  it('canal que ficaria fora do pedido novo: há novidade (o envio muda) e o cartão continua mandando pedir', () => {
    const r = lerAgora(plain(baseDs()), 'padroes-titulo', { niche: 'ia' })
    const canal = (r.sent.channels as string[])[0]!
    const w = mundoCom(r, ds => { ds.channels.find(c => c.id === canal)!.sync.last = ds.now - 10 * 864e5 })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toMatchObject({ pode: true, porque: 'dado-novo' })
    expect(askServidor(w, 'ia', { type: 'padroes-titulo' }).ok).toBe(true)
    const v = forjaReadingView(w.obs, w.obs.forja.byId[r.id]!, { active: false, isNew: false, activeNote: null })
    expect(v.since!.text).toContain('Peça nova leitura à forja')
  })
  it('vídeo enviado que saiu do observatório: há novidade', () => {
    const r = lerAgora(plain(baseDs()), 'padroes-titulo', { niche: 'ia' })
    const sumiu = idsEnviados(r)[0]!
    const w = mundoCom(r, ds => { ds.videos = ds.videos.filter(v => v.id !== sumiu) })
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toMatchObject({ pode: true, porque: 'dado-novo' })
  })
  it('leitura de vídeo + troca nova do vídeo (o pacote do vídeo vai até agora): há novidade', () => {
    const r = lerAgora(plain(baseDs()), 'leitura-video', { videoId: 'matt-opus55' })
    const w = mundoCom(r, ds => trocaTitulo(ds, 'matt-opus55', ds.now - 30e3))
    expect(w.obs.forja.novidade('leitura-video', 'ia', 'matt-opus55')).toMatchObject({ pode: true, porque: 'dado-novo' })
    expect(askServidor(w, 'ia', { type: 'leitura-video', video: 'matt-opus55' }).ok).toBe(true)
  })

  // dado ausente: a leitura sem envio congelado completo (linha antiga) mantém o comportamento de antes
  it('leitura sem o envio congelado (sem ids/itens): volta ao Desde então — título trocado ainda libera (comportamento anterior)', () => {
    const ds0 = plain(baseDs())
    const r = lerAgora(ds0, 'padroes-titulo', { niche: 'ia' }, sent => { delete sent.ids; delete sent.items })
    expect(r.sent.ids).toBeUndefined()
    const w = mundoCom(r, ds => trocaTitulo(ds, (lerAgora(ds0, 'padroes-titulo', { niche: 'ia' }).sent.ids as string[])[0]!, asOfDe(ds0) + H))
    expect(w.obs.forja.novidade('padroes-titulo', 'ia', null)).toEqual({ pode: true, porque: 'dado-novo' })
  })
  it('o envio congelado guardado pelo banco (chaves em outra ordem, como no jsonb) continua igual ao de agora', () => {
    const ds0 = plain(baseDs())
    const r = lerAgora(ds0, 'resumo-trocas', { niche: 'ia' })
    const embaralhado = (x: unknown): unknown => Array.isArray(x) ? x.map(embaralhado)
      : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x as Record<string, unknown>).reverse().map(([k, v]) => [k, embaralhado(v)])) : x
    r.sent = embaralhado(r.sent) as FrozenReading['sent']
    expect(mundoCom(r).obs.forja.novidade('resumo-trocas', 'ia', null)).toEqual({ pode: false })
  })
})
