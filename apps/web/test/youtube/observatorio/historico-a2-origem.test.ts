// @vitest-environment node
// Fase A2, tarefa 2: o Histórico aberto a partir da página do canal. A trilha ("Canais › <canal> › Histórico do vídeo"), a frase de
// posição que descreve a lista de origem (spec 3 e 6.5) e os links de Anterior/Próximo que carregam a origem adiante.
// O mundo é o oráculo de 02/10 (canal-fixture), lido uma vez por arquivo; nenhuma mutação aqui.
import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { origemDoCanal } from '@/app/cms/(authed)/youtube/competitors/_historico/origem-canal'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { buildCanalTrocas } from '@/app/cms/(authed)/youtube/competitors/_canal/trocas-model'
import { montarLista } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import { parseCanalState, canalQuery } from '@/app/cms/(authed)/youtube/competitors/_canal/params'

const { obs, chId } = canalWorld()
const NOME = obs.channel(chId)!.name
const all = buildCanalVideos(obs, chId).videos
const hv = (id: string, p: Record<string, string | undefined> = {}) => buildHistoricoView(obs, id, p)
const sp = (href: string) => Object.fromEntries(new URL(href, 'http://x').searchParams) as Record<string, string | undefined>
const q = (href: string | null) => new URL(href!, 'http://x').searchParams
/** A mesma janela de vizinhos que a grade e a aba Trocas escrevem em `ids=`. */
const janela = (ids: readonly string[], i: number) => { const a = Math.max(0, Math.min(i - 50, ids.length - 100)); return ids.slice(a, a + 100) }
/** A lista da grade para um `back=`, como a tela do canal a monta. */
const grade = (back: string, n = 0) => { const st = { ...parseCanalState(sp('/x' + back)), n }; return { back: canalQuery(st), ids: montarLista(all, st).visiveis } }
/** Os parâmetros que o cartão da posição `i` da lista põe no link do Histórico. */
const doCartao = (ids: readonly string[], i: number, back: string) => sp(link.historico(ids[i]!, { from: 'canais', canal: chId, back: back || undefined, ids: janela(ids, i), pos: i + 1, tot: ids.length }))
const trocas = () => { const t = buildCanalTrocas(obs, chId); return { cards: t.cards, ids: t.cards.map(c => c.videoId) } }

describe('origemDoCanal (a frase da lista de origem, lida de back=)', () => {
  it('a frase leva o filtro, a ordenação, a direção e a busca que estavam ativos', () => {
    const o = (back: string | null) => origemDoCanal(back, NOME)
    expect(o('?fmt=longos')!.of).toBe(`de ${NOME} (longos, do mais novo ao mais antigo)`)
    expect(o('?fmt=shorts&sort=vistos')!.of).toBe(`de ${NOME} (Shorts, mais vistos primeiro)`)
    expect(o('?fmt=fixados&sort=multiplo&dir=asc')!.of).toBe(`de ${NOME} (fixados, menor múltiplo primeiro)`)
    expect(o('?sort=multiplo')!.of).toBe(`de ${NOME} (maior múltiplo primeiro)`)
    expect(o('?sort=vpd')!.of).toBe(`de ${NOME} (mais views por dia primeiro)`)
    expect(o('?sort=vpd&dir=asc')!.of).toBe(`de ${NOME} (menos views por dia primeiro)`)
    expect(o('?sort=vistos&dir=asc')!.of).toBe(`de ${NOME} (menos vistos primeiro)`)
    expect(o('?dir=asc')!.of).toBe(`de ${NOME} (do mais antigo ao mais novo)`)
    expect(o('?q=lisboa')!.of).toBe(`de ${NOME} (busca “lisboa”, do mais novo ao mais antigo)`)
    expect(o('?fmt=longos&sort=vistos&q=Rio%20de%20Janeiro&ver=lista&n=80')!.of).toBe(`de ${NOME} (longos, busca “Rio de Janeiro”, mais vistos primeiro)`)
    // o estado padrão é a grade sem filtro: "?" e "" descrevem a grade, não um erro
    expect(o('?')!.of).toBe(`de ${NOME} (do mais novo ao mais antigo)`)
    expect(o('')!.of).toBe(`de ${NOME} (do mais novo ao mais antigo)`)
    // fora da lista: a mesma descrição
    expect(o('?fmt=longos')!.outside).toBe(`fora da lista de ${NOME} (longos, do mais novo ao mais antigo)`)
  })
  it('a aba Trocas tem a sua frase', () => {
    const t = origemDoCanal('?tab=trocas', NOME)!
    expect(t.of).toBe(`com trocas de ${NOME} (trocas dos últimos 30 dias, da mais recente à mais antiga)`)
    expect(t.outside).toBe(`fora da lista de vídeos com trocas de ${NOME} (trocas dos últimos 30 dias, da mais recente à mais antiga)`)
    // o filtro de um vídeo na aba não muda a lista que o pager anda
    expect(origemDoCanal('?tab=trocas&video=abc', NOME)).toEqual(t)
  })
  it('back que não descreve um estado do canal: null', () => {
    for (const bad of [null, 'fmt=longos', '?tab=zzz', '?tab=leitura', '?tab=retencao', '?fmt=abc', '?sort=nada', '?dir=up', '?tab=trocas&fmt=abc']) {
      expect([bad, origemDoCanal(bad, NOME)]).toEqual([bad, null])
    }
  })
})

describe('Histórico vindo da página do canal', () => {
  it('vindo da grade (canal=<id>, back=?fmt=longos): "vídeo 7 de N de <canal> (longos, do mais novo ao mais antigo)"', () => {
    const { back, ids } = grade('?fmt=longos')
    expect(back).toBe('?fmt=longos')
    expect(ids.length).toBeGreaterThan(20)
    const v = hv(ids[6]!, doCartao(ids, 6, back))
    expect(v.state).not.toBe('not-found')
    expect(v.pager!.position).toBe(`vídeo 7 de ${ids.length} de ${NOME} (longos, do mais novo ao mais antigo)`)
    expect(v.pager!.status).toBe(`Vídeo 7 de ${ids.length}: ${obs.video(ids[6]!)!.title}`)
    // a grade no estado padrão não escreve back=: o link vale como a grade sem filtro
    const d = grade('')
    expect(doCartao(d.ids, 2, d.back).back).toBeUndefined()
    expect(hv(d.ids[2]!, doCartao(d.ids, 2, d.back)).pager!.position).toBe(`vídeo 3 de ${d.ids.length} de ${NOME} (do mais novo ao mais antigo)`)
  })
  it('vindo da aba Trocas (back=?tab=trocas): "vídeo 2 de N com trocas de <canal> (trocas dos últimos 30 dias, da mais recente à mais antiga)"', () => {
    const { ids } = trocas()
    expect(ids.length).toBeGreaterThan(1)
    for (const i of [0, ids.length - 1]) {
      const v = hv(ids[i]!, doCartao(ids, i, '?tab=trocas'))
      expect(v.pager!.position).toBe(`vídeo ${i + 1} de ${ids.length} com trocas de ${NOME} (trocas dos últimos 30 dias, da mais recente à mais antiga)`)
      expect(v.crumbs.sub!.href).toBe(link.canal(chId) + '?tab=trocas')
    }
  })
  it('pos e tot contam a lista de origem mesmo com ids cortado em 100 vizinhos', () => {
    const { back, ids } = grade('', 1000)
    expect(ids.length).toBeGreaterThan(110)
    for (const i of [0, 60, ids.length - 1]) {
      const p = doCartao(ids, i, back)
      expect(p.ids!.split(',').length).toBe(100)
      const v = hv(ids[i]!, p)
      expect(v.pager!.position, 'posição ' + (i + 1)).toBe(`vídeo ${i + 1} de ${ids.length} de ${NOME} (do mais novo ao mais antigo)`)
      expect(v.pager!.status).toMatch(new RegExp(`^Vídeo ${i + 1} de ${ids.length}: `))
      // os vizinhos andam uma posição, o total não muda
      if (v.pager!.prev) expect([q(v.pager!.prev).get('pos'), q(v.pager!.prev).get('tot')]).toEqual([String(i), String(ids.length)])
      if (v.pager!.next) expect([q(v.pager!.next).get('pos'), q(v.pager!.next).get('tot')]).toEqual([String(i + 2), String(ids.length)])
    }
  })
  it('origem que não dá para descrever: back inválido, pos/tot ausentes, pos > tot, pos que não bate com ids → frase genérica contando só ids', () => {
    const { back, ids } = grade('?fmt=longos')
    const i = 6, ok = doCartao(ids, i, back)
    const janelaN = ok.ids!.split(',').length
    const k = ok.ids!.split(',').indexOf(ids[i]!)
    const so = (p: Record<string, string | undefined>) => hv(ids[i]!, p).pager!
    const contaIds = new RegExp(`^vídeo ${k + 1} de ${janelaN} `)
    // pos/tot ausentes, só um deles, pos > tot, pos antes do começo possível da janela, tot menor que a janela
    for (const bad of [{ pos: undefined, tot: undefined }, { tot: undefined }, { pos: undefined }, { pos: '60', tot: '51' }, { pos: '2', tot: '80' }, { pos: '7', tot: '30' }, { pos: 'x', tot: '80' }, { pos: '0', tot: '0' }, { pos: '-3', tot: '50' }, { pos: '7.5', tot: '80' }]) {
      const pg = so({ ...ok, ...bad })
      expect([JSON.stringify(bad), pg.position]).toEqual([JSON.stringify(bad), expect.stringMatching(contaIds)])
      expect(pg.position).toBe(`vídeo ${k + 1} de ${janelaN} de ${NOME} (longos, do mais novo ao mais antigo)`)
      expect(pg.position).not.toMatch(/vídeo 0 de|vídeo \d+ de 0 /)
      // o status e os links também ficam sem a posição inventada
      expect(pg.status).toBe(`Vídeo ${k + 1} de ${janelaN}: ${obs.video(ids[i]!)!.title}`)
      for (const h of [pg.prev, pg.next]) if (h) expect([q(h).has('pos'), q(h).has('tot')]).toEqual([false, false])
    }
    // back inválido: a frase não descreve ordem nenhuma, só a lista aberta
    for (const bad of ['?tab=zzz', '?fmt=abc', 'fmt=longos']) {
      const pg = so({ ...ok, back: bad })
      expect(pg.position, bad).toBe(`vídeo ${i + 1} de ${ids.length} na lista aberta de ${NOME}`)
    }
  })
  it('canal= de outro canal: ignora canal, pos e tot (o vídeo manda)', () => {
    const { back, ids } = grade('?fmt=longos')
    const p = doCartao(ids, 6, back)
    const n = p.ids!.split(',').length
    const outro = obs.channels.find(c => c.id !== chId)!
    const v = hv(ids[6]!, { ...p, canal: outro.id, pos: '7', tot: '9999' })
    const ref = hv(ids[6]!, { ...p, canal: undefined, pos: undefined, tot: undefined })
    expect(v.pager).toEqual(ref.pager)
    expect(v.crumbs).toEqual(ref.crumbs)
    // a frase de hoje: conta só `ids` e diz "acompanhados"; nunca o total que veio em tot=
    expect(v.pager!.position).toBe(`vídeo 7 de ${n} de ${NOME} (longos acompanhados, do mais novo ao mais antigo)`)
    for (const h of [v.pager!.prev, v.pager!.next]) if (h) expect(['canal', 'pos', 'tot'].filter(k => q(h).has(k))).toEqual([])
    // o item do canal na trilha é a página limpa, sem o estado de outro canal
    expect(v.crumbs.sub!.href).toBe(link.canal(chId))
    expect(v.crumbs.canal).toBeNull()
  })
  it('Anterior e Próximo levam canal=, back=, ids= e pos±1/tot adiante; nunca levam troca=', () => {
    const { back, ids } = grade('?fmt=longos&sort=vistos')
    // um vídeo da grade que tem troca com par em "Antes e depois": a chegada pela troca só vale nele, nunca nos vizinhos
    const i = ids.findIndex((id, j) => j > 3 && j < ids.length - 3 && obs.changes.some(c => c.video === id && obs.effect(c.id) != null))
    expect(i).toBeGreaterThan(0)
    const troca = obs.changes.find(c => c.video === ids[i] && obs.effect(c.id) != null)!.id
    const p = doCartao(ids, i, back)
    const v = hv(ids[i]!, { ...p, troca, range: 'tudo' })
    expect(v.arrival).not.toBeNull()
    for (const [h, pos, alvo] of [[v.pager!.prev, i, ids[i - 1]], [v.pager!.next, i + 2, ids[i + 1]]] as const) {
      const u = new URL(h!, 'http://x')
      expect(u.pathname).toBe(link.historico(alvo!).split('?')[0])
      expect(u.searchParams.get('from')).toBe('canais')
      expect(u.searchParams.get('canal')).toBe(chId)
      expect(u.searchParams.get('back')).toBe(back)
      expect(u.searchParams.get('ids')).toBe(p.ids)
      expect([u.searchParams.get('pos'), u.searchParams.get('tot')]).toEqual([String(pos), String(ids.length)])
      expect(['troca', 'range'].filter(k => u.searchParams.has(k))).toEqual([])
    }
    expect(v.pager!.replace).toBe(true)
  })
  it('vindo do canal: o crumb "Canais" aponta para a lista de Canais sem o estado do canal; o item do canal aponta para a página com o estado (back)', () => {
    const { back, ids } = grade('?fmt=longos&sort=vistos')
    const v = hv(ids[3]!, doCartao(ids, 3, back))
    const semCanal = hv(ids[3]!, { from: 'canais' })
    expect(v.crumbs.href).toBe(semCanal.crumbs.href)
    expect(v.crumbs.href).not.toMatch(/fmt=|sort=|tab=/)
    expect(v.crumbs.crumb).toBe('Canais')
    expect(v.crumbs.sub).toEqual({ text: NOME, href: link.canal(chId) + back })
    expect(v.pager!.backHref).toBe(v.crumbs.href)
    expect(v.crumbs.canal).toBe(chId)
    // canal= que não é o do vídeo: não é uma origem de canal
    expect(hv(ids[3]!, { ...doCartao(ids, 3, back), canal: 'outro' }).crumbs.canal).toBeNull()
  })
  it('lista de origem vazia (sem ids e sem lista reconstruível): pager null', () => {
    const { back, ids } = grade('?fmt=longos')
    const p = doCartao(ids, 4, back)
    expect(hv(ids[4]!, { ...p, ids: undefined }).pager).toBeNull()
    expect(hv(ids[4]!, { ...p, ids: 'nao-existe,tambem-nao' }).pager).toBeNull()
    // a trilha continua levando de volta
    expect(hv(ids[4]!, { ...p, ids: undefined }).crumbs.sub!.href).toBe(link.canal(chId) + back)
  })
  it('origens antigas (Mudanças, Outliers, Insights, Canais sem canal=): frase e links iguais aos de hoje', () => {
    const [a, b, c] = obs.videos.filter(v => v.tracked && v.fmt === 'long' && v.ch === chId).slice(0, 3).map(v => v.id) as [string, string, string]
    const ids = [a, b, c]
    const NOT = ['canal', 'pos', 'tot', 'troca', 'range']
    // Canais sem canal=: a frase fixa de hoje e o link que só leva from, ids e back
    const canais = hv(b, { from: 'canais', ids: ids.join(','), back: '?niche=todos' })
    expect(canais.pager!.position).toBe(`vídeo 2 de 3 de ${NOME} (longos acompanhados, do mais novo ao mais antigo)`)
    expect(canais.pager!.prev).toBe(link.historico(a, { from: 'canais', ids, back: '?niche=todos' }))
    expect(canais.pager!.next).toBe(link.historico(c, { from: 'canais', ids, back: '?niche=todos' }))
    expect(canais.pager!.status).toBe(`Vídeo 2 de 3: ${obs.video(b)!.title}`)
    expect(canais.pager!.replace).toBe(true)
    for (const from of ['mudancas', 'outliers'] as const) {
      const v = hv(b, { from, ids: ids.join(',') })
      expect(v.pager!.position).toMatch(/^vídeo 2 de 3 em (Mudanças|Outliers), na ordem da lista aberta$/)
      expect(v.pager!.prev).toBe(link.historico(a, { from, ids }))
      expect(v.pager!.next).toBe(link.historico(c, { from, ids }))
      expect(NOT.filter(k => q(v.pager!.next).has(k))).toEqual([])
      expect(v.crumbs.canal).toBeNull()
    }
    // Insights: sem lista, o pager existe e diz de onde veio, como hoje
    const ins = hv(b, { from: 'insights' })
    expect(ins.pager).toMatchObject({ prev: null, next: null, position: 'aberto a partir de Insights', status: '' })
  })
})
