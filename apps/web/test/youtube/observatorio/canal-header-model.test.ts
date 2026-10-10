import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'

describe('cabeçalho do canal', () => {
  it('seis células na faixa, doze em "Todos os números", na ordem do spec', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    expect(h.faixa.map(c => c.key)).toEqual(['subs', 'growth30', 'ritmo', 'vpd', 'engajamento', 'acima2x'])
    expect(h.todos.map(c => c.key)).toEqual(['trocas30', 'vpdPorMil', 'vpdShorts', 'engShorts', 'multTipico', 'maiorMult', 'ultimoVideo', 'habito', 'duracaoMediana', 'viewsSomadas', 'medianaViews', 'tema'])
  })
  it('todo número tem base escrita: o ⓘ nunca abre vazio', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    for (const c of [...h.faixa, ...h.todos]) expect(c.base.trim().length, c.key).toBeGreaterThan(0)
  })
  it('célula sem dado tem frase, nunca zero nem traço', () => {
    const { obs, chId } = canalWorld()
    for (const c of [...buildCanalHeader(obs, chId)!.faixa, ...buildCanalHeader(obs, chId)!.todos]) {
      if (c.value == null) expect(c.missing, c.key).toBeTruthy()
      else { expect(c.value).not.toBe('—'); expect(c.missing).toBeNull() }
    }
  })
  it('os números batem com o painel de Canais de hoje para o mesmo canal', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    const S = obs.channelStats(chId, 'long')
    const drawer = buildCanaisView(obs, { niche: 'todos', nicheExplicit: false, limit: 75, channel: chId, scale: 'abs' }).drawer!
    const stat = (label: RegExp) => drawer.stats.find(s => label.test(s.label))!.value
    expect(h.faixa.find(c => c.key === 'ritmo')!.value).toBe(stat(/^Ritmo/))
    expect(h.faixa.find(c => c.key === 'engajamento')!.value ?? '—').toBe(stat(/^Engajamento/))
    if (S.vpdMedian != null) expect(h.faixa.find(c => c.key === 'vpd')!.value).not.toBeNull()
  })
  it('trocas em 30 dias contam só título e thumbnail: uma troca de descrição não entra', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    const todas = obs.changesIn({ days: 30, channel: chId })
    const contam = todas.filter(c => c.type === 'title' || c.type === 'thumb')
    expect(todas.some(c => c.type === 'desc')).toBe(true)          // o canal do oráculo tem troca de descrição na janela
    expect(contam.length).toBeLessThan(todas.length)
    expect(h.todos.find(c => c.key === 'trocas30')!.value).toBe(String(contam.length))
  })
  it('sem longo em 90 dias: "nenhum longo em 90 dias" no engajamento', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id || v.fmt !== 'long' || v.ageDays > 90) })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'engajamento')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('nenhum longo em 90 dias')
  })
  it('base com menos de 3 vídeos mostra "n = 2"', () => {
    const { obs, chId } = canalWorld((ds, id) => {
      const longs = ds.videos.filter(v => v.ch === id && v.fmt === 'long' && v.tracked)
      const keep = new Set(longs.slice(0, 2).map(v => v.id))
      ds.videos = ds.videos.filter(v => v.ch !== id || v.fmt !== 'long' || keep.has(v.id))
    })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'vpd')!
    if (c.value != null) expect(c.n).toMatch(/^n = [12]$/)
  })
  it('sem duas contagens de inscritos com 30 dias entre elas: "sem contagem de 30 dias atrás"', () => {
    const { obs, chId } = canalWorld((ds, id) => { const c = ds.channels.find(x => x.id === id)!; c.snapshots = c.snapshots.slice(-1) })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'growth30')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('sem contagem de 30 dias atrás')
  })
  it('inscritos ocultos pelo canal: frase, não zero', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.channels.find(x => x.id === id)!.subs = null })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'subs')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('inscritos ocultos pelo canal')
  })
  it('sem tema: "sem tema ainda"', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id) v.theme = null }) })
    expect(buildCanalHeader(obs, chId)!.todos.find(x => x.key === 'tema')!.missing).toBe('sem tema ainda')
  })
  it('a linha 3 soma certo: acompanhados + fixados antigos + mais antigos + sem data = total', () => {
    const { obs, chId } = canalWorld(), k = buildCanalHeader(obs, chId)!.counts
    expect(k.tracked + k.pinnedOld + k.older + k.undated).toBe(k.total)
  })
  it('partes que valem zero somem da frase de sincronização', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    if (h.counts.pinnedOld === 0) expect(h.sync.text).not.toMatch(/fixado/)
    expect(h.sync.text).toMatch(/^Sincronizado há /)
  })
  it('sincronização atrasada e com erro mudam o tom e abrem a faixa', () => {
    const late = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'atrasado' })
    const hl = buildCanalHeader(late.obs, late.chId)!
    expect(hl.sync.tone).toBe('warn'); expect(hl.sync.text).toMatch(/^Sincronização atrasada: a última foi /); expect(hl.sync.banner).toMatch(/^Atenção: dados de /)
    const err = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'erro'; s.msg = 'quota'; s.errorSince = ds.now - 36e5 })
    const he = buildCanalHeader(err.obs, err.chId)!
    expect(he.sync.tone).toBe('danger'); expect(he.sync.banner).toMatch(/^Erro: a última sincronização falhou em /)
  })
  it('canal em backfill: faixa "Sincronizando: N de M vídeos" e nenhuma célula com número', () => {
    const { obs, chId } = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'backfill'; s.backfill = { done: 12, total: 48 } })
    const h = buildCanalHeader(obs, chId)!
    expect(h.backfill).toEqual({ done: 12, total: 48 })
    expect(h.sync.banner).toBe('Sincronizando: 12 de 48 vídeos. Os números aparecem quando a sincronização terminar.')
    for (const c of h.faixa.filter(x => x.key !== 'subs')) expect(c.value, c.key).toBeNull()
  })
  it('canal fora do conjunto: null', () => { expect(buildCanalHeader(canalWorld().obs, 'nao-existe')).toBeNull() })

  // --- além do brief: comportamento que os casos acima só tocavam de raso -----------------------------------------------
  it('duração mediana: mm:ss da mediana dos longos acompanhados; sem duração, a frase', () => {
    const w = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id && v.fmt === 'long' && v.tracked) v.dur = 600 }) })
    expect(buildCanalHeader(w.obs, w.chId)!.todos.find(x => x.key === 'duracaoMediana')!.value).toBe('10:00')
    const long = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id && v.fmt === 'long' && v.tracked) v.dur = 3725 }) })
    expect(buildCanalHeader(long.obs, long.chId)!.todos.find(x => x.key === 'duracaoMediana')!.value).toBe('1:02:05')
    const none = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id && v.fmt === 'long') v.dur = null }) })
    const c = buildCanalHeader(none.obs, none.chId)!.todos.find(x => x.key === 'duracaoMediana')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('sem duração nos longos')
  })
  it('o valor real do oráculo é uma duração legível, não NaN', () => {
    const { obs, chId } = canalWorld(), c = buildCanalHeader(obs, chId)!.todos.find(x => x.key === 'duracaoMediana')!
    expect(c.value).toMatch(/^\d{1,2}:\d{2}(:\d{2})?$/)
  })
  it('views somadas contam só os acompanhados com views; as sem contagem ficam fora e o ⓘ diz quantas', () => {
    const w = canalWorld((ds, id) => { const t = ds.videos.filter(v => v.ch === id && v.tracked); t[0]!.views = null; t[1]!.views = null })
    const h = buildCanalHeader(w.obs, w.chId)!, c = h.todos.find(x => x.key === 'viewsSomadas')!
    expect(c.base).toMatch(/^soma de \d+ vídeos acompanhados; 2 sem contagem ficam fora$/)
    const sum = w.obs.videos.filter(v => v.ch === w.chId && v.tracked && v.views != null).reduce((a, v) => a + v.views!, 0)
    expect(c.value).toBe(w.obs.fmt.num(sum))
  })
  it('tema dominante: aparece com o rótulo quando passa dos limites, e a base diz "N de M longos"', () => {
    const w = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id) v.theme = 'lancamento-de-modelo' }) })
    const c = buildCanalHeader(w.obs, w.chId)!.todos.find(x => x.key === 'tema')!
    expect(c.value).toBe(w.obs.theme('lancamento-de-modelo')!.label); expect(c.missing).toBeNull()
    expect(c.base).toMatch(/^\d+ de \d+ longos de até 90 dias$/)
  })
  it('sem Short acompanhado: as duas células de Shorts dizem a frase', () => {
    const w = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id || v.fmt !== 'short') })
    const h = buildCanalHeader(w.obs, w.chId)!
    expect(h.todos.find(x => x.key === 'vpdShorts')!.missing).toBe('nenhum Short acompanhado')
    expect(h.todos.find(x => x.key === 'engShorts')!.missing).toBe('nenhum Short em 90 dias')
  })
  it('zero medido é "0": nenhum longo acima de 2× não vira frase', () => {
    const w = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id) v.pub = v.pub - 200 * 864e5, v.ageDays += 200 }) })
    const c = buildCanalHeader(w.obs, w.chId)!.faixa.find(x => x.key === 'acima2x')!
    expect(c.value).toBe('0'); expect(c.missing).toBeNull()
  })
  it('fixado antigo e sem data entram na frase e na soma, com plural certo', () => {
    const w = canalWorld((ds, id) => {
      const old = ds.videos.filter(v => v.ch === id && !v.tracked)
      old[0]!.pinned = true; old[1]!.pinned = true
      ds.channels.find(x => x.id === id)!.undated = [1, 2].map(i => ({ id: 'u' + i, ytId: 'y' + i, title: null, url: 'https://x', isShort: i === 1 ? null : false, dur: null, views: null, likes: null, comments: null, pinned: false, checkedAt: null }))
    })
    const h = buildCanalHeader(w.obs, w.chId)!, k = h.counts
    expect(k.pinnedOld).toBe(2); expect(k.undated).toBe(2)
    expect(k.tracked + k.pinnedOld + k.older + k.undated).toBe(k.total)
    expect(h.sync.text).toContain('2 fixados antigos'); expect(h.sync.text).toContain('2 sem data de publicação')
    expect(h.result).toMatch(/, 1 com formato não confirmado\.$/)
  })
  it('um fixado só: singular', () => {
    const w = canalWorld((ds, id) => { ds.videos.filter(v => v.ch === id && !v.tracked)[0]!.pinned = true })
    expect(buildCanalHeader(w.obs, w.chId)!.sync.text).toContain(', 1 fixado antigo,')
  })
  it('a linha de resultado soma os três grupos e o total bate', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    const nums = [...h.result.matchAll(/(\d+) (longos?|Shorts?|com formato)/g)].map(m => Number(m[1]))
    expect(nums.reduce((a, b) => a + b, 0)).toBe(h.counts.total)
    expect(h.result).toMatch(new RegExp('^' + h.counts.total + ' vídeos: '))
  })
  it('canal sem nenhum vídeo: frases, nenhum número inventado', () => {
    const w = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id) })
    const h = buildCanalHeader(w.obs, w.chId)!
    expect(h.result).toBe('Nenhum vídeo guardado.'); expect(h.sync.text).toMatch(/· nenhum vídeo guardado$/)
    expect(h.todos.find(x => x.key === 'ultimoVideo')!.missing).toBe('nenhum vídeo guardado')
    expect(h.todos.find(x => x.key === 'viewsSomadas')!.value).toBeNull()
    expect(h.faixa.find(x => x.key === 'vpd')!.missing).toBe('sem contagem diária ainda')
    for (const c of [...h.faixa, ...h.todos]) expect(c.base.trim().length, c.key).toBeGreaterThan(0)
  })
  it('erro e atraso: as duas frases do banner, com e sem última sincronização boa', () => {
    const e = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'erro'; s.msg = 'quota'; s.errorSince = ds.now - 36e5 })
    const he = buildCanalHeader(e.obs, e.chId)!
    expect(he.sync.banner).toMatch(/^Erro: a última sincronização falhou em \d\d\/\d\d \d\d:\d\d\. Os números são de \d\d\/\d\d\.$/)
    const never = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'erro'; s.msg = 'quota'; s.last = null; s.errorSince = null })
    expect(buildCanalHeader(never.obs, never.chId)!.sync.banner).toBe('Erro: a última sincronização falhou. Este canal nunca sincronizou com sucesso.')
    const late = canalWorld((ds, id) => { ds.channels.find(x => x.id === id)!.sync.state = 'atrasado' })
    expect(buildCanalHeader(late.obs, late.chId)!.sync.banner).toMatch(/^Atenção: dados de \d\d\/\d\d \d\d:\d\d\. A sincronização está atrasada\.$/)
  })
  it('backfill: as doze de "Todos os números" também ficam sem número, com a mesma frase', () => {
    const { obs, chId } = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'backfill'; s.backfill = { done: 12, total: 48 } })
    for (const c of buildCanalHeader(obs, chId)!.todos) { expect(c.value, c.key).toBeNull(); expect(c.missing, c.key).toBe('quando a sincronização terminar') }
  })
})
