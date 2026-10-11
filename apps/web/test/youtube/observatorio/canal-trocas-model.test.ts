import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { createTestObservatory } from './oracle'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { EffectResult } from '@/lib/youtube/observatorio/effect'
import { link } from '@/lib/youtube/observatorio/links'
import { buildCanalTrocas } from '@/app/cms/(authed)/youtube/competitors/_canal/trocas-model'
import { effLine } from '@/app/cms/(authed)/youtube/competitors/_chrome/effect-view'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const q = (href: string) => new URL(href, 'http://x').searchParams
const contam = (obs: ReturnType<typeof canalWorld>['obs'], ch: string) => obs.changesIn({ days: 30, channel: ch }).filter(c => c.type !== 'desc')
const norm = (s: string) => s.toLowerCase().replace(/[:—·.,;()]/g, ' ').replace(/\s+/g, ' ').trim()

describe('trocas do canal: o modelo', () => {
  it('conta só título e thumbnail dos últimos 30 dias; descrição fica fora', () => {
    const { obs, chId } = canalWorld()
    const todas = obs.changesIn({ days: 30, channel: chId })
    expect(todas.some(c => c.type === 'desc')).toBe(true)          // o canal do oráculo tem troca de descrição na janela
    const v = buildCanalTrocas(obs, chId)
    expect(v.total).toBe(todas.filter(c => c.type !== 'desc').length)
    expect(v.cards.flatMap(c => c.trocas)).toHaveLength(v.total)
    // o mesmo número do cabeçalho
    expect(String(v.total)).toBe(obs.changesIn({ days: 30, channel: chId }).filter(c => c.type === 'title' || c.type === 'thumb').length + '')
  })

  it('a contagem da aba é "N em 30 d" e o título da seção diz "Trocas de título e thumbnail nos últimos 30 dias"', () => {
    const { obs, chId } = canalWorld()
    const v = buildCanalTrocas(obs, chId)
    expect(v.tabCount).toBe(`${v.total} em 30 d`)
    expect(v.titulo).toBe('Trocas de título e thumbnail nos últimos 30 dias')
    expect(v.intro).toMatch(/Histórico do vídeo/)
  })

  it('um cartão por vídeo, mesmo com trocas não vizinhas no tempo: N vídeos com troca = N cartões', () => {
    const { obs, chId } = canalWorld()
    const videos = new Set(contam(obs, chId).map(c => c.video))
    const v = buildCanalTrocas(obs, chId)
    expect(videos.size).toBeGreaterThan(1)
    expect(v.cards.map(c => c.videoId).sort()).toEqual([...videos].sort())
    const multi = v.cards.find(c => c.trocas.length > 1)!
    expect(multi).toBeTruthy()
    // as trocas desse vídeo não são todas vizinhas: há uma de outro campo ou de outro dia entre elas
    expect(new Set(multi.trocas.map(t => t.campo)).size).toBeGreaterThan(1)
  })

  it('os cartões saem na ordem da troca mais recente de cada vídeo; dentro do cartão, da mais recente para a mais antiga', () => {
    const { obs, chId } = canalWorld()
    const v = buildCanalTrocas(obs, chId)
    const at = (id: string) => obs.change(id)!.at
    const newest = v.cards.map(c => Math.max(...c.trocas.map(t => at(t.id))))
    expect(newest).toEqual([...newest].sort((a, b) => b - a))
    for (const c of v.cards) {
      const ats = c.trocas.map(t => at(t.id))
      expect(ats).toEqual([...ats].sort((a, b) => b - a))
    }
  })

  it('cartão com uma troca: o botão abre já nela (href com troca=) e a troca leva ao mesmo destino', () => {
    const { obs, chId } = canalWorld()
    const one = buildCanalTrocas(obs, chId).cards.find(c => c.trocas.length === 1)!
    expect(one).toBeTruthy()
    expect(q(one.href).get('troca')).toBe(one.trocas[0]!.id)
    expect(one.trocas[0]!.href).toBe(one.href)
  })

  it('cartão com duas ou mais: o botão abre o histórico sem troca= e cada troca tem o seu link com troca=', () => {
    const { obs, chId } = canalWorld()
    const many = buildCanalTrocas(obs, chId).cards.find(c => c.trocas.length > 1)!
    expect(q(many.href).has('troca')).toBe(false)
    for (const t of many.trocas) expect(q(t.href).get('troca')).toBe(t.id)
    expect(new Set(many.trocas.map(t => t.href)).size).toBe(many.trocas.length)
    expect(many.contagem).toBe(`${many.trocas.length} trocas neste vídeo`)
  })

  it('nome acessível do botão: "Abrir histórico do vídeo: <título>"; do link: "Abrir o histórico do vídeo na troca de título de 28/09: <título>"', () => {
    const { obs, chId } = canalWorld()
    for (const c of buildCanalTrocas(obs, chId).cards) {
      expect(c.hrefLabel).toBe('Abrir histórico do vídeo: ' + c.title)
      for (const t of c.trocas) {
        const ch = obs.change(t.id)!
        expect(t.hrefLabel).toBe(`Abrir o histórico do vídeo na troca de ${ch.type === 'title' ? 'título' : 'thumbnail'} de ${obs.date.dm(ch.at)}: ${c.title}`)
      }
    }
    expect(buildCanalTrocas(obs, chId).cards.flatMap(c => c.trocas).some(t => /troca de título de \d\d\/\d\d: /.test(t.hrefLabel))).toBe(true)
  })

  it('cada troca diz o campo, quando foi vista (hora de São Paulo, com ISO) e o antes e o agora', () => {
    const { obs, chId } = canalWorld()
    const todas = buildCanalTrocas(obs, chId).cards.flatMap(c => c.trocas)
    const tit = todas.find(t => t.campo === 'Título trocado')!, th = todas.find(t => t.campo === 'Thumbnail trocada')!
    const ct = obs.change(tit.id)!, cth = obs.change(th.id)!
    expect(tit.quando).toBe(`visto pela 1ª vez ${ct.agoShort} (${ct.whenText})`)
    expect(th.quando).toBe(`vista pela 1ª vez ${cth.agoShort} (${cth.whenText})`)
    expect(tit.iso).toBe(new Date(ct.at).toISOString())
    expect(tit.quandoTitle).toBe(`${obs.date.dmhm(ct.at)} (São Paulo)`)
    expect(tit.antes.texto).toBe(String(ct.before)); expect(tit.agora.texto).toBe(String(ct.after))
    expect(tit.antes.thumb).toBeNull(); expect(th.antes.texto).toBeNull(); expect(th.agora.texto).toBeNull()
  })

  it('thumbnail anterior não arquivada: semArquivo e nenhuma imagem inventada', () => {
    const arquivada = canalWorld()
    const th0 = buildCanalTrocas(arquivada.obs, arquivada.chId).cards.flatMap(c => c.trocas).filter(t => t.campo === 'Thumbnail trocada')
    expect(th0.length).toBeGreaterThan(0)
    for (const t of th0) expect(t.antes.semArquivo).toBe(t.antes.thumb == null)
    const { obs, chId } = canalWorld(ds => { for (const v of ds.videos) for (const t of v.thumbs) t.blobUrl = null })
    const th = buildCanalTrocas(obs, chId).cards.flatMap(c => c.trocas).filter(t => t.campo === 'Thumbnail trocada')
    expect(th.length).toBeGreaterThan(0)
    for (const t of th) { expect(t.antes.thumb).toBeNull(); expect(t.antes.semArquivo).toBe(true); expect(t.agora.thumb).toBeNull() }
  })

  it('a frase de efeito é a mesma do Histórico para a mesma troca', () => {
    const { obs, chId } = canalWorld()
    const SEM_NUMERO = ['aguardando', 'sem-serie', 'sem-antes']
    let conferidas = 0
    for (const card of buildCanalTrocas(obs, chId).cards) {
      const hist = buildHistoricoView(obs, card.videoId, {})
      for (const t of card.trocas) {
        const e = obs.effect(t.id)!
        expect(t.efeito).toBe(effLine(obs, e))
        const cmp = hist.comparisons.find(c => c.changeId === t.id)
        const texto = cmp?.nobase?.strong ?? cmp?.full?.verdictStrong
        if (!texto) continue
        const linha = SEM_NUMERO.includes(e.status) ? t.efeito : t.efeito.replace(/^[^:]+:\s*/, '')
        expect(norm(texto), t.id).toContain(norm(linha))
        conferidas++
      }
    }
    expect(conferidas).toBeGreaterThan(2)
  })

  it('efeito aguardando e sem base, do motor: as frases do spec 5.7, sem número inventado', () => {
    const { obs, chId } = canalWorld()
    const trocas = buildCanalTrocas(obs, chId).cards.flatMap(c => c.trocas)
    const ag = trocas.find(t => obs.effect(t.id)!.status === 'aguardando')!
    const eAg = obs.effect(ag.id)!
    expect(ag.efeito).toBe(`aguardando: ${eAg.collected} de 7 dias coletados, ${eAg.readyText}`)
    const sb = trocas.find(t => obs.effect(t.id)!.status === 'sem-antes')!
    expect(sb.efeito).toBe('sem base: ' + obs.effect(sb.id)!.reason)
    expect(sb.efeito).not.toMatch(/^sem base: \d/)
  })

  it('efeito sem série: "sem série: <motivo>" (vídeo fora dos acompanhados)', () => {
    const { obs, chId } = canalWorld(ds => { const v = ds.videos.find(x => x.id === 'matt-fast-cheap')!; v.tracked = false })
    const t = buildCanalTrocas(obs, chId).cards.find(c => c.videoId === 'matt-fast-cheap')!.trocas[0]!
    const e = obs.effect(t.id)!
    expect(e.status).toBe('sem-serie')
    expect(t.efeito).toBe('sem série: ' + e.reason)
    expect(t.efeito).not.toMatch(/\d/)
  })

  it('sem leitura de efeito: frase honesta, nunca número', () => {
    const { obs } = canalWorld()
    expect(effLine(obs, null)).toBe('sem série: o motor não devolveu leitura de efeito para esta troca')
    const e = { status: 'neutro', label: 'neutro', reason: 'x', n: 5, numbersFlat: 'observado +3% · esperado +1% · n = 5' } as unknown as EffectResult
    expect(effLine(obs, e)).toBe('neutro: observado +3% · esperado +1% · n = 5')
  })

  it('todos os links levam from=canais, canal=<id> e back=?tab=trocas', () => {
    const { obs, chId } = canalWorld()
    const v = buildCanalTrocas(obs, chId)
    const hrefs = v.cards.flatMap(c => [c.href, ...c.trocas.map(t => t.href)])
    expect(hrefs.length).toBeGreaterThan(v.cards.length)
    for (const h of hrefs) {
      expect(h.startsWith(link.historico('x').replace(/x$/, '')), h).toBe(true)
      expect(q(h).get('from')).toBe('canais'); expect(q(h).get('canal')).toBe(chId); expect(q(h).get('back')).toBe('?tab=trocas')
    }
    // o pager anda pelos vídeos com troca, na ordem dos cartões
    expect(q(v.cards[0]!.href).get('ids')).toBe(v.cards.map(c => c.videoId).join(','))
  })

  it('o link "Ver as N trocas em Mudanças" continua no fim', () => {
    const { obs, chId } = canalWorld()
    const v = buildCanalTrocas(obs, chId)
    expect(v.mudancasLink).toEqual({ href: link.mudancas({ channel: chId }), text: `Ver as ${v.total} trocas em Mudanças` })
  })

  it('canal sem troca: "Nenhuma troca de título ou thumbnail nos últimos 30 dias."', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id) })
    const v = buildCanalTrocas(obs, chId)
    expect(v.total).toBe(0); expect(v.cards).toEqual([]); expect(v.mudancasLink).toBeNull()
    expect(v.vazio).toBe('Nenhuma troca de título ou thumbnail nos últimos 30 dias.')
    expect(v.tabCount).toBe('0 em 30 d')
  })

  it('canal em backfill: sem cartão e a frase de que ainda não há o que comparar', () => {
    const { obs, chId } = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'backfill'; s.backfill = { done: 12, total: 48 } })
    const v = buildCanalTrocas(obs, chId)
    expect(v.cards).toEqual([]); expect(v.total).toBe(0)
    expect(v.vazio).toMatch(/ainda não há o que comparar/)
    expect(v.tabCount).toBe('')   // I-2: nem "0 em 30 d"
  })

  it('funciona no conjunto de um canal (scope "canal"), que lança em tudo que agrega entre canais', () => {
    const { ds, chId, obs } = canalWorld()
    const one: Dataset = { ...ds, scope: 'canal', channels: ds.channels.filter(c => c.id === chId), videos: ds.videos.filter(v => v.ch === chId) }
    const v = buildCanalTrocas(createTestObservatory(one), chId)
    expect(v.total).toBe(buildCanalTrocas(obs, chId).total)
    expect(v.cards.length).toBeGreaterThan(0)
  })
})
