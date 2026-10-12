// @vitest-environment node
// A4 Tarefa 11: o modelo da página do VÍDEO próprio — cabeçalho, faixa de seis números com a conta feita, paginador na ordem da lista de
// origem, trilha e a frase de alcance. Puro: recebe `obs` e o dado privado já lido. Cada número é testado em cada estado de dado ausente
// (nulo nunca vira zero) e o que aparece é o MESMO texto do cartão da lista (T7) e do motor.
import { describe, it, expect, vi } from 'vitest'
import { proprioWorld, primeiroProprio, DADOS } from './proprio-fixture'
import { a3World } from './a3-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import type { Dataset, ObsVideo } from '@/lib/youtube/observatorio/types'
import { buildCanalVideos, numNb } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import {
  buildProprioVideoHeader, buildProprioVideoPage, canalProprioDoVideo, validarFaixa, type CelulaVideo,
} from '@/app/cms/(authed)/youtube/competitors/_proprio/video-model'
import { BACK_DO_TOP_IMP, descricaoDaOrigem, origemDoCanal } from '@/app/cms/(authed)/youtube/competitors/_historico/origem-canal'

const DAY = 86_400_000
const ORDEM = ['views', 'curtidas', 'comentarios', 'engajamento', 'multiplo', 'duracao'] as const

/** Um canal próprio com 35 longos acompanhados, todos com mais de 365 dias: o alvo `v0` tem 118 views, 12 curtidas, 6 comentários, 39:57; os 34 outros, 138 views. */
function exato(mexe?: (alvo: ObsVideo, ds: Dataset, outros: ObsVideo[]) => void, n = 35) {
  return proprioWorld({
    mut: ds => {
      const ch = primeiroProprio(ds)
      const modelo = ds.videos.find(v => v.ch === ch.id && v.fmt === 'long' && v.tracked)!
      ds.videos = ds.videos.filter(v => v.ch !== ch.id)
      const todos: ObsVideo[] = []
      for (let i = 0; i < n; i++) {
        const v: ObsVideo = structuredClone(modelo)
        Object.assign(v, {
          id: 'v' + i, ytId: 'yt' + i, title: 'Vídeo ' + i, pub: ds.now - (700 + i) * DAY, ageDays: 700 + i, fmt: 'long', isShort: false, tracked: true,
          views: i === 0 ? 118 : 138, likes: i === 0 ? 12 : 10, comments: i === 0 ? 6 : 3, dur: i === 0 ? 39 * 60 + 57 : 600,
        })
        todos.push(v)
      }
      ds.videos.push(...todos)
      mexe?.(todos[0]!, ds, todos.slice(1))
    },
  })
}
const cel = (w: ReturnType<typeof exato>, id = 'v0', k: typeof ORDEM[number]) => buildProprioVideoHeader(w.obs, id)!.faixa.find(c => c.key === k)!

const BASE = exato()

describe('T11 faixa de números (spec 17.2)', () => {
  it('seis células na ordem views, curtidas, comentários, engajamento, múltiplo, duração', () => {
    const h = buildProprioVideoHeader(BASE.obs, 'v0')!
    expect(h.faixa.map(c => c.key)).toEqual([...ORDEM])
    expect(h.faixa.map(c => c.label)).toEqual(['views', 'curtidas', 'comentários', 'engajamento', 'o normal do canal', 'duração'])
    expect(h.faixa.map(c => c.value)).toEqual(['118', '12', '6', '15,3%', '0,9×', '39:57'])
    expect(h.faixa.every(c => c.missing === null)).toBe(true)
  })

  it('o ⓘ traz a conta FEITA: "(12 curtidas + 6 comentários) ÷ 118 views = 15,3%" e "118 ÷ 138 = 0,9×; 138 é a mediana de views dos outros 34 vídeos"', () => {
    expect(cel(BASE, 'v0', 'engajamento').conta).toContain('(12 curtidas + 6 comentários) ÷ 118 views = 15,3%')
    const m = cel(BASE, 'v0', 'multiplo').conta
    expect(m).toContain('118 ÷ 138 = 0,9×; 138 é a mediana de views dos outros 34 vídeos')
    expect(cel(BASE, 'v0', 'multiplo').sub).toBe('mediana dos outros 34: 138 views')
    // mutante: outros números, outra conta (o texto não é fixo)
    const w2 = exato((alvo, _ds, outros) => { alvo.views = 40; alvo.likes = 1; alvo.comments = 1; for (const o of outros) o.views = 20 })
    expect(cel(w2, 'v0', 'engajamento').conta).toContain('(1 curtida + 1 comentário) ÷ 40 views = 5,0%')
    expect(cel(w2, 'v0', 'multiplo').conta).toContain('40 ÷ 20 = 2,0×; 20 é a mediana de views dos outros 34 vídeos')
  })

  it('os milhares da conta são inteiros exatos, para a conta fechar na tela', () => {
    const w = exato((alvo, _ds, outros) => { alvo.views = 12_345; for (const o of outros) o.views = 9_876 })
    expect(cel(w, 'v0', 'multiplo').conta).toContain('12.345 ÷ 9.876 = 1,3×; 9.876 é a mediana')
  })

  it('toda célula tem conta: a montagem LANÇA se alguma vier vazia (o ⓘ nunca abre vazio)', () => {
    const ok: CelulaVideo = { key: 'views', value: '1', missing: null, label: 'views', sub: null, conta: 'x' }
    expect(() => validarFaixa([ok])).not.toThrow()
    expect(() => validarFaixa([{ ...ok, conta: '' }])).toThrow(/views/)
    expect(() => validarFaixa([{ ...ok, conta: '   ' }])).toThrow()
    // e nenhuma célula, em nenhum estado, sai sem conta, e tem valor OU frase, nunca os dois nem nenhum
    const estados: Array<[string, ReturnType<typeof exato>, string]> = [
      ['base', BASE, 'v0'],
      ['comentário nulo', exato(a => { a.comments = null }), 'v0'],
      ['curtida nula', exato(a => { a.likes = null }), 'v0'],
      ['views zero', exato(a => { a.views = 0 }), 'v0'],
      ['views nulo', exato(a => { a.views = null }), 'v0'],
      ['sem duração', exato(a => { a.dur = null }), 'v0'],
      ['um vídeo só', exato(undefined, 1), 'v0'],
      ['mediana zero', exato((_a, _d, o) => { for (const x of o) x.views = 0 }), 'v0'],
    ]
    for (const [nome, w, id] of estados) {
      const faixa = buildProprioVideoHeader(w.obs, id)!.faixa
      expect(faixa, nome).toHaveLength(6)
      for (const c of faixa) {
        expect(c.conta.trim(), `${nome}/${c.key}`).not.toBe('')
        expect((c.value === null) !== (c.missing === null), `${nome}/${c.key}: valor XOR frase`).toBe(true)
        expect(`${c.value ?? ''}${c.missing ?? ''}`, `${nome}/${c.key}`).not.toMatch(/NaN|Infinity|undefined|null/)
      }
    }
  })

  it('comentário nulo: "não medido" na célula e o motivo na conta; engajamento também fica sem valor, nunca 0%', () => {
    const w = exato(a => { a.comments = null })
    const c = cel(w, 'v0', 'comentarios'), e = cel(w, 'v0', 'engajamento')
    expect(c.value).toBeNull(); expect(c.missing).toBe('não medido')
    expect(c.conta).toMatch(/O YouTube não devolveu a contagem de comentários/)
    expect(e.value).toBeNull(); expect(e.missing).toBe('não medido')
    expect(e.conta).toMatch(/comentários/); expect(e.conta).toMatch(/não é calculado/)
    expect(`${e.value}${e.missing}`).not.toMatch(/0%/)
    // as outras células seguem com número
    expect(cel(w, 'v0', 'views').value).toBe('118')
    expect(cel(w, 'v0', 'curtidas').value).toBe('12')
  })

  it('curtida nula: "não medido", nunca 0; engajamento sem valor', () => {
    const w = exato(a => { a.likes = null })
    expect(cel(w, 'v0', 'curtidas')).toMatchObject({ value: null, missing: 'não medido' })
    expect(cel(w, 'v0', 'engajamento')).toMatchObject({ value: null, missing: 'não medido' })
    expect(cel(w, 'v0', 'engajamento').conta).toMatch(/curtidas/)
  })

  it('curtida e comentário em zero MEDIDO: "0" e engajamento "0,0%" (zero medido não é ausência)', () => {
    const w = exato(a => { a.likes = 0; a.comments = 0 })
    expect(cel(w, 'v0', 'curtidas').value).toBe('0')
    expect(cel(w, 'v0', 'comentarios').value).toBe('0')
    expect(cel(w, 'v0', 'engajamento').value).toBe('0,0%')
    expect(cel(w, 'v0', 'engajamento').conta).toContain('(0 curtidas + 0 comentários) ÷ 118 views = 0,0%')
  })

  it('views zero: engajamento sem valor ("sem views para calcular"), nunca NaN nem Infinity; as views são "0" medido', () => {
    const w = exato(a => { a.views = 0 })
    const e = cel(w, 'v0', 'engajamento')
    expect(e.value).toBeNull(); expect(e.missing).toBe('sem views para calcular')
    expect(e.conta).toMatch(/0 views/)
    expect(cel(w, 'v0', 'views').value).toBe('0')
    const m = cel(w, 'v0', 'multiplo')
    expect(m.value === null ? m.missing : m.value).not.toMatch(/NaN|Infinity/)
  })

  it('views nulo: as três células que dependem dela dizem o motivo; nenhuma vira 0', () => {
    const w = exato(a => { a.views = null })
    const v = cel(w, 'v0', 'views')
    expect(v.value).toBeNull(); expect(v.missing).toMatch(/^sem contagem/)
    expect(cel(w, 'v0', 'engajamento')).toMatchObject({ value: null, missing: 'sem contagem de views' })
    expect(cel(w, 'v0', 'multiplo').value).toBeNull()
    expect(cel(w, 'v0', 'multiplo').missing).toBe('sem contagem de views')
  })

  it('canal com um vídeo só: múltiplo "poucos vídeos para comparar", sem número', () => {
    const w = exato(undefined, 1)
    const m = cel(w, 'v0', 'multiplo')
    expect(m.value).toBeNull(); expect(m.missing).toBe('poucos vídeos para comparar')
    expect(m.conta).toMatch(/nenhum outro vídeo/)
    expect(m.sub).toBeNull()
  })

  it('mediana dos outros em 0 views: sem múltiplo e a conta diz por quê (nunca ∞×)', () => {
    const w = exato((_a, _d, o) => { for (const x of o) x.views = 0 })
    const m = cel(w, 'v0', 'multiplo')
    expect(m.value).toBeNull(); expect(m.missing).toBe('a mediana dos outros é 0 views')
    expect(m.conta).toMatch(/0 views/)
  })

  it('base fraca (menos de 3 outros): o número aparece e a conta avisa', () => {
    const w = exato(undefined, 3)
    const m = cel(w, 'v0', 'multiplo')
    expect(m.value).toBe('0,9×')
    expect(m.conta).toMatch(/Base fraca/)
    expect(m.conta).toContain('os outros 2 vídeos')
  })

  it('um único outro vídeo para comparar: singular ("o outro vídeo"), nunca "1 vídeos"; base fraca avisada (achado da captura em 1440 px)', () => {
    const w = exato(undefined, 2)
    const m = cel(w, 'v0', 'multiplo')
    expect(m.value).toBe('0,9×')
    expect(m.conta).toContain('118 ÷ 138 = 0,9×; 138 é a mediana de views do outro vídeo longo do canal')
    expect(m.conta).not.toMatch(/1 vídeos|outros 1\b/)
    expect(m.conta).toMatch(/Base fraca: só 1 vídeo para comparar/)
    expect(m.sub).toBe('o outro vídeo: 138 views')
  })

  it('sem duração: a célula diz "sem duração" e a conta o motivo, nunca 00:00', () => {
    const w = exato(a => { a.dur = null })
    expect(cel(w, 'v0', 'duracao')).toMatchObject({ value: null, missing: 'sem duração' })
    expect(cel(w, 'v0', 'duracao').conta).toMatch(/não devolveu a duração/)
  })

  it('o múltiplo é o do MOTOR (multiplier.ts): o mesmo número do cartão e do motor, em todos os vídeos do canal', () => {
    const w = proprioWorld()
    const cartoes = new Map(buildCanalVideos(w.obs, w.canalId).videos.map(v => [v.id, v]))
    const vs = w.obs.videos.filter(v => v.ch === w.canalId)
    expect(vs.length).toBeGreaterThan(10)
    for (const v of vs) {
      const h = buildProprioVideoHeader(w.obs, v.id)!, cartao = cartoes.get(v.id)!
      const m = w.obs.multiplier(v.id)
      expect(h.faixa.find(c => c.key === 'multiplo')!.value, v.id).toBe(m.value == null ? null : w.obs.fmt.mult(m.value))
      // mesmo número = mesmo texto que no cartão da lista
      expect(h.faixa.find(c => c.key === 'multiplo')!.value, v.id).toBe(cartao.multText)
      expect(h.faixa.find(c => c.key === 'views')!.value, v.id).toBe(cartao.viewsText)
      expect(h.faixa.find(c => c.key === 'curtidas')!.value, v.id).toBe(cartao.likesText)
      expect(h.faixa.find(c => c.key === 'comentarios')!.value, v.id).toBe(cartao.commentsText)
      expect(h.faixa.find(c => c.key === 'duracao')!.value, v.id).toBe(cartao.durText)
    }
  })

  it('a faixa não depende do dado privado: a mesma em ok, negado, erro, vazio e sem relatório (e o modelo nem o recebe)', () => {
    const base = JSON.stringify(buildProprioVideoHeader(BASE.obs, 'v0'))
    for (const c of ['cheio', 'curto', 'vazio', 'parado', 'negado', 'erro'] as const) {
      const d = DADOS[c](BASE.canalId, BASE.ytIds, BASE.hoje)
      expect(JSON.stringify(buildProprioVideoHeader(BASE.obs, 'v0')), c).toBe(base)
      expect(buildProprioVideoPage(BASE.obs, 'v0', {}, d)!.header.faixa.map(x => x.value), c).toEqual(['118', '12', '6', '15,3%', '0,9×', '39:57'])
    }
  })

  it('vídeo sem data de publicação: a faixa abre, o múltiplo diz o motivo e nenhuma idade é inventada', () => {
    const w = exato((_a, ds) => {
      primeiroProprio(ds).undated.push({ id: 'sem-data-1', ytId: 'ytsd1', title: 'Sem data', url: 'https://youtu.be/ytsd1', isShort: false, dur: 125, views: 50, likes: 5, comments: 1, pinned: false, checkedAt: null })
    })
    const h = buildProprioVideoHeader(w.obs, 'sem-data-1')!
    expect(h).not.toBeNull()
    expect(h.semData).toBe(true)
    expect(h.faixa.map(c => c.value)).toEqual(['50', '5', '1', '12,0%', null, '02:05'])
    const m = h.faixa.find(c => c.key === 'multiplo')!
    expect(m.missing).toBe('sem data de publicação, sem múltiplo')
    expect(h.meta).toMatch(/Sem data de publicação/)
    expect(h.meta).not.toMatch(/há \d+ dias/)
    expect(canalProprioDoVideo(w.obs, 'sem-data-1')?.id).toBe(w.canalId)
  })

  it('nenhuma palavra interna na tela (L2, L3, lote, pack, dataset, motor, day_pt, Reporting, Analytics API, escala √)', () => {
    const estados = [BASE, exato(a => { a.comments = null }), exato(a => { a.views = 0 }), exato(undefined, 1), exato(a => { a.views = null })]
    for (const w of estados) {
      const h = buildProprioVideoHeader(w.obs, 'v0')!
      const texto = [h.titulo, h.meta, ...h.faixa.flatMap(c => [c.value, c.missing, c.label, c.sub, c.conta])].filter(x => x != null).join(' | ')
      expect(texto).not.toMatch(/\bL[234]\b|lote|\bpack\b|pacote|dataset|\bmotor\b|day_pt|Reporting|Analytics API|escala √|undefined/i)
    }
  })
})

describe('T11 cabeçalho', () => {
  it('título, link, miniatura, canal e meta (idade, formato)', () => {
    const h = buildProprioVideoHeader(BASE.obs, 'v0')!
    expect(h.id).toBe('v0'); expect(h.titulo).toBe('Vídeo 0')
    expect(h.canal).toEqual({ id: BASE.canalId, name: BASE.obs.channel(BASE.canalId)!.name, href: link.canal(BASE.canalId) })
    expect(h.url).toMatch(/^https?:\/\//)
    expect(h.thumb).toBe('https://i.ytimg.com/vi/yt0/mqdefault.jpg')
    expect(h.meta).toMatch(/^Publicado há 700 dias, em \d\d\/\d\d\/\d{4} \d\d:\d\d \(São Paulo\) · vídeo longo$/)
    expect(h.viewer).not.toBeNull()
    expect(h.semData).toBe(false)
  })

  it('título vazio vira "sem título" e formato não confirmado é dito', () => {
    const w = exato(a => { a.title = '  '; a.isShort = null })
    const h = buildProprioVideoHeader(w.obs, 'v0')!
    expect(h.titulo).toBe('sem título'); expect(h.meta).toMatch(/formato não confirmado/)
  })

  it('Short é Short', () => {
    const w = proprioWorld()
    const curto = w.obs.videos.find(v => v.ch === w.canalId && v.fmt === 'short')!
    expect(buildProprioVideoHeader(w.obs, curto.id)!.meta).toMatch(/· Short$/)
  })

  it('id desconhecido, vídeo de concorrente e vídeo de OUTRO conjunto: null (a rota cai no Histórico / "não encontrado")', () => {
    expect(buildProprioVideoHeader(BASE.obs, 'nao-existe')).toBeNull()
    const w = proprioWorld()
    const conc = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!
    expect(buildProprioVideoHeader(w.obs, conc.id)).toBeNull()
    expect(canalProprioDoVideo(w.obs, conc.id)).toBeNull()
    expect(canalProprioDoVideo(w.obs, 'nao-existe')).toBeNull()
    expect(buildProprioVideoPage(w.obs, conc.id, {}, DADOS.cheio(w.canalId, w.ytIds, w.hoje))).toBeNull()
  })
})

describe('T11 paginador (D11, spec 17.1)', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => 'v' + i)
  const sp = (o: Record<string, string>) => o
  const pag = (id: string, p: Record<string, string> = {}) => buildProprioVideoPage(BASE.obs, id, p, DADOS.cheio(BASE.canalId, BASE.ytIds, BASE.hoje))!.pager
  const href = (to: string, extra: Parameters<typeof link.historico>[1]) => link.historico(to, extra)

  it('sem ids= na URL: a ordem é do mais novo ao mais antigo do canal; "Anterior" apagado no primeiro, com o motivo', () => {
    const p = pag('v0')
    expect(p.position).toBe('vídeo 1 de 35, na ordem da lista: do mais novo ao mais antigo')
    expect(p.prev).toBeNull()
    expect(p.prevOff).toBe('Não há vídeo anterior: este é o primeiro da lista')
    expect(p.nextOff).toBeUndefined()
    expect(p.next).toBe(href('v1', {}))
    expect(p.replace).toBe(true)
    expect(p.compacto).toBe(true)
    expect(p.status).toBe('Vídeo 1 de 35: Vídeo 0')
  })

  it('no último, "Próximo" fica apagado com o motivo', () => {
    const p = pag('v34')
    expect(p.next).toBeNull(); expect(p.nextOff).toBe('Não há próximo vídeo: este é o último da lista')
    expect(p.prevOff).toBeUndefined()
    expect(p.prev).toBe(href('v33', {}))
    expect(p.position).toMatch(/^vídeo 35 de 35, /)
  })

  it('no meio: os dois andam e nenhum motivo de apagado aparece', () => {
    const p = pag('v10')
    expect(p.prev).toBe(href('v9', {})); expect(p.next).toBe(href('v11', {}))
    expect(p.prevOff).toBeUndefined(); expect(p.nextOff).toBeUndefined()
  })

  it('com ids=: anda NESSA ordem (aqui, por impressões: v7, v2, v9), e a frase diz a ordem da lista', () => {
    const origem = { from: 'canais', canal: BASE.canalId, back: '?sort=imp&fmt=longos', ids: 'v7,v2,v9', pos: '2', tot: '3' }
    const p = pag('v2', origem)
    expect(p.prev).toBe(href('v7', { from: 'canais', canal: BASE.canalId, back: '?sort=imp&fmt=longos', ids: ['v7', 'v2', 'v9'], pos: 1, tot: 3 }))
    expect(p.next).toBe(href('v9', { from: 'canais', canal: BASE.canalId, back: '?sort=imp&fmt=longos', ids: ['v7', 'v2', 'v9'], pos: 3, tot: 3 }))
    expect(p.position).toBe('vídeo 2 de 3, na ordem da lista: longos, mais impressões primeiro')
    // pos=1 do v7 estava na URL do v7; aqui o v2 vem como 2: o modelo recalcula pela ordem de ids
    const primeiro = pag('v7', { ...origem, pos: '1' })
    expect(primeiro.prev).toBeNull(); expect(primeiro.prevOff).toMatch(/primeiro da lista/)
    expect(primeiro.position).toMatch(/^vídeo 1 de 3, /)
    const ultimo = pag('v9', { ...origem, pos: '3' })
    expect(ultimo.next).toBeNull(); expect(ultimo.nextOff).toMatch(/último da lista/)
  })

  it('ids= com vídeo de OUTRO canal ou inexistente: filtrado (o paginador fica dentro do canal)', () => {
    const w = proprioWorld()
    const conc = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!.id
    const d = DADOS.cheio(w.canalId, w.ytIds, w.hoje)
    const meus = w.obs.videos.filter(v => v.ch === w.canalId).map(v => v.id)
    const p = buildProprioVideoPage(w.obs, meus[1]!, { from: 'canais', canal: w.canalId, ids: [meus[0], conc, 'lixo', meus[1], meus[2]].join(',') }, d)!.pager
    expect(p.prev).toContain('/video/' + encodeURIComponent(meus[0]!))
    expect(p.next).toContain('/video/' + encodeURIComponent(meus[2]!))
    expect(p.prev! + p.next!).not.toContain(conc)
    expect(p.prev! + p.next!).not.toContain('lixo')
  })

  it('vídeo que não está em ids=: cai na ordem do canal e a frase diz que está fora da lista de origem', () => {
    const p = pag('v5', { from: 'canais', canal: BASE.canalId, ids: 'v1,v2,v3' })
    expect(p.position).toBe('vídeo 6 de 35, fora da lista de origem, na ordem do canal: do mais novo ao mais antigo')
    expect(p.prev).toBe(href('v4', { from: 'canais', canal: BASE.canalId })); expect(p.next).toBe(href('v6', { from: 'canais', canal: BASE.canalId }))
  })

  it('pos/tot valem só se fecham com ids= (vizinhança de uma lista maior): "vídeo 120 de 300"; na borda da janela o motivo manda voltar à lista, sem dizer "último"', () => {
    const origem = { from: 'canais', canal: BASE.canalId, back: '', ids: 'v10,v11,v12', pos: '120', tot: '300' }
    const meio = pag('v11', { ...origem, pos: '121' })
    expect(meio.position).toBe('vídeo 121 de 300, na ordem da lista: do mais novo ao mais antigo')
    const borda = pag('v12', { ...origem, pos: '122' })
    expect(borda.next).toBeNull()
    expect(borda.nextOff).toMatch(/volte à lista/)
    expect(borda.nextOff).not.toMatch(/último/)
    // pos inconsistente (pos > tot): a contagem cai para ids= sozinho
    expect(pag('v11', { ...origem, pos: '500' }).position).toMatch(/^vídeo 2 de 3, /)
    void sp
  })

  it('vídeo sem data: o paginador diz que ele está fora da lista e os dois lados ficam apagados', () => {
    const w = exato((_a, ds) => { primeiroProprio(ds).undated.push({ id: 'sd', ytId: 'ytsd', title: 'x', url: 'https://youtu.be/x', isShort: false, dur: 60, views: 1, likes: 0, comments: 0, pinned: false, checkedAt: null }) })
    const p = buildProprioVideoPage(w.obs, 'sd', {}, DADOS.cheio(w.canalId, w.ytIds, w.hoje))!.pager
    expect(p.prev).toBeNull(); expect(p.next).toBeNull()
    expect(p.prevOff).toMatch(/não tem data/); expect(p.nextOff).toMatch(/não tem data/)
    expect(p.position).toBe('vídeo sem data de publicação, fora da lista do canal')
    expect(p.status).toBe('')
  })

  it('canal com um vídeo só: os dois lados apagados e "vídeo 1 de 1"', () => {
    const w = exato(undefined, 1)
    const p = buildProprioVideoPage(w.obs, 'v0', {}, DADOS.cheio(w.canalId, w.ytIds, w.hoje))!.pager
    expect(p.position).toMatch(/^vídeo 1 de 1, /)
    expect(p.prev).toBeNull(); expect(p.next).toBeNull(); expect(p.prevOff).toBeDefined(); expect(p.nextOff).toBeDefined()
  })

  it('o voltar do pager: backHref é a página do canal com o back= recebido', () => {
    expect(pag('v3', { from: 'canais', canal: BASE.canalId, back: '?sort=imp' }).backHref).toBe(link.canal(BASE.canalId) + '?sort=imp')
    expect(pag('v3').backHref).toBe(link.canal(BASE.canalId))
  })
})

describe('T11 trilha', () => {
  const pg = (p: Record<string, string>) => buildProprioVideoPage(BASE.obs, 'v3', p, DADOS.cheio(BASE.canalId, BASE.ytIds, BASE.hoje))!
  const nome = BASE.obs.channel(BASE.canalId)!.name

  it('"Canais › <canal> › Vídeo"; o item do canal volta com o back= recebido e marca a volta ao canal', () => {
    const t = pg({ from: 'canais', canal: BASE.canalId, back: '?sort=imp&fmt=longos' }).crumbs
    expect(t).toEqual([
      { text: 'Canais', href: link.canais() },
      { text: nome, href: link.canal(BASE.canalId) + '?sort=imp&fmt=longos', voltaAoCanal: BASE.canalId },
      { text: 'Vídeo' },
    ])
  })

  it('sem origem: a trilha é a mesma, o item do canal é a página limpa e não marca volta', () => {
    expect(pg({}).crumbs).toEqual([{ text: 'Canais', href: link.canais() }, { text: nome, href: link.canal(BASE.canalId) }, { text: 'Vídeo' }])
  })

  it('back= que não começa com "?" é ignorado (nunca vira parte de um caminho)', () => {
    const t = pg({ from: 'canais', canal: BASE.canalId, back: '/cms/outra-coisa' }).crumbs
    expect(t[1]!.href).toBe(link.canal(BASE.canalId))
  })

  it('canal= de OUTRO canal não marca a volta (o registro é do canal do vídeo)', () => {
    const t = pg({ from: 'canais', canal: 'outro', back: '?sort=imp' })
    expect(t.crumbs[1]).not.toHaveProperty('voltaAoCanal')
    expect(t.fromCanal).toBeNull()
  })

  it('veio de outra tela (Outliers): a primeira migalha é a origem, com o back dela, e o canal é a página limpa', () => {
    const t = pg({ from: 'outliers', back: '?fmt=long' }).crumbs
    expect(t[0]).toEqual({ text: 'Outliers', href: link.outliers().split('?')[0] + '?fmt=long' })
    expect(t[1]).toEqual({ text: nome, href: link.canal(BASE.canalId) })
    expect(t[2]).toEqual({ text: 'Vídeo' })
  })

  it('fromCanal: o id do canal só quando veio da página dele', () => {
    expect(pg({ from: 'canais', canal: BASE.canalId }).fromCanal).toBe(BASE.canalId)
    expect(pg({}).fromCanal).toBeNull()
  })
})

describe('T11 alcance: a frase do dado privado (a faixa não o usa; o lugar fica para "Este vídeo no canal")', () => {
  const nota = (d: ReturnType<typeof DADOS.cheio>) => buildProprioVideoPage(BASE.obs, 'v0', {}, d)!.alcanceNota
  it('lido: sem frase; negado, erro, sem relatório e nada lido: cada um com a sua, nunca número', () => {
    expect(nota(DADOS.cheio(BASE.canalId, BASE.ytIds, BASE.hoje))).toBeNull()
    expect(nota(DADOS.negado(BASE.canalId, BASE.ytIds, BASE.hoje))).toBe('Impressões e cliques deste vídeo: só quem edita o site vê este número.')
    expect(nota(DADOS.erro(BASE.canalId, BASE.ytIds, BASE.hoje))).toBe('Impressões e cliques deste vídeo: a leitura do alcance falhou agora; recarregue a página.')
    expect(nota(DADOS.vazio(BASE.canalId, BASE.ytIds, BASE.hoje))).toBe('Impressões e cliques deste vídeo: ainda sem relatório de alcance deste canal.')
  })

  it('negado: nada do dado privado na página montada (nem número, nem série)', () => {
    const cheio = DADOS.cheio(BASE.canalId, BASE.ytIds, BASE.hoje)
    const a = JSON.stringify(buildProprioVideoPage(BASE.obs, 'v0', {}, DADOS.negado(BASE.canalId, BASE.ytIds, BASE.hoje)))
    const b = JSON.stringify(buildProprioVideoPage(BASE.obs, 'v0', {}, { alcance: { acesso: 'negado' }, diario: cheio.diario }))
    expect(a).toBe(b)
    expect(a).not.toMatch(/187|"imp"|ctr/)
  })
})

describe('T11 origem do canal próprio (descricaoDaOrigem)', () => {
  it('ordenar por impressões é uma ordem do canal próprio e vira frase; o concorrente continua sem ela', () => {
    expect(descricaoDaOrigem('?sort=imp')).toBe('mais impressões primeiro')
    expect(descricaoDaOrigem('?sort=imp&dir=asc&fmt=longos&q=abc')).toBe('longos, busca “abc”, menos impressões primeiro')
    expect(descricaoDaOrigem('')).toBe('do mais novo ao mais antigo')
    expect(origemDoCanal('?sort=imp', 'Leo')).toBeNull()      // concorrente: 'imp' não existe (expectativa inalterada)
  })
  it('estados que o canal próprio não escreve numa lista de vídeos dão null (aba, ordem e formato do concorrente)', () => {
    for (const b of ['?tab=retencao', '?tab=trocas', '?tab=leitura', '?sort=vpd', '?fmt=fixados', '?sort=lixo', 'sem-interrogacao']) expect(descricaoDaOrigem(b), b).toBeNull()
  })
  it('o do concorrente não mudou', () => {
    expect(origemDoCanal('?fmt=longos&sort=vpd', 'Leo')).toEqual({ of: 'de Leo (longos, mais views por dia primeiro)', outside: 'fora da lista de Leo (longos, mais views por dia primeiro)' })
  })
})

describe('T11 concorrente com o mesmo id de vídeo não existe aqui: a rota decide pelo canal do vídeo', () => {
  it('canalProprioDoVideo devolve o canal próprio do vídeo próprio e null para o do concorrente', () => {
    const w = a3World(undefined, '2')
    const proprio = w.obs.videos.find(v => w.obs.channel(v.ch)!.own)!
    const conc = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!
    expect(canalProprioDoVideo(w.obs, proprio.id)?.id).toBe(proprio.ch)
    expect(canalProprioDoVideo(w.obs, conc.id)).toBeNull()
  })
})

describe('T13.0 H1/H2: a frase do paginador diz a ordem que o site sabe, nunca outra', () => {
  const origem = { from: 'canais', canal: BASE.canalId, ids: 'v7,v2,v9', pos: '2', tot: '3' }
  const pag = (id: string, p: Record<string, string>) => buildProprioVideoPage(BASE.obs, id, p, DADOS.cheio(BASE.canalId, BASE.ytIds, BASE.hoje))!.pager

  it('lista por data (grade no padrão): "na ordem da lista: do mais novo ao mais antigo"', () => {
    expect(pag('v2', { ...origem, back: '' }).position).toBe('vídeo 2 de 3, na ordem da lista: do mais novo ao mais antigo')
  })
  it('lista por impressões: "na ordem da lista: mais impressões primeiro"', () => {
    expect(pag('v2', { ...origem, back: '?sort=imp' }).position).toBe('vídeo 2 de 3, na ordem da lista: mais impressões primeiro')
  })
  it('vindo do top de "Como o canal está" (marcador próprio no back): "na ordem do top de impressões", nunca "do mais novo"', () => {
    const p = pag('v2', { ...origem, back: BACK_DO_TOP_IMP })
    expect(p.position).toBe('vídeo 2 de 3, na ordem do top de impressões')
    expect(p.position).not.toMatch(/mais novo/)
    // o marcador atravessa o Anterior/Próximo: o vizinho continua dizendo a ordem do top
    expect(p.prev).toBe(link.historico('v7', { from: 'canais', canal: BASE.canalId, back: BACK_DO_TOP_IMP, ids: ['v7', 'v2', 'v9'], pos: 1, tot: 3 }))
    expect(pag('v9', { ...origem, back: BACK_DO_TOP_IMP, pos: '3' }).position).toBe('vídeo 3 de 3, na ordem do top de impressões')
  })
  it('back que só abre a seção (?painel=1, link antigo sem marcador) não descreve lista: o paginador não afirma ordem nenhuma', () => {
    const p = pag('v2', { ...origem, back: '?painel=1' })
    expect(p.position).toBe('vídeo 2 de 3, na ordem da lista: a da lista aberta')
    expect(p.position).not.toMatch(/mais novo/)
    expect(descricaoDaOrigem('?painel=1')).toBeNull()
    expect(descricaoDaOrigem(BACK_DO_TOP_IMP)).toBeNull()
    expect(descricaoDaOrigem('?painel=1&sort=imp')).toBe('mais impressões primeiro')   // painel junto de uma ordenação conhecida: a ordenação vale
  })
  it('sem ids=, com back que descreve outra ordem (favorito antigo): a tela anda pela data e diz "na ordem do canal", não "da lista"', () => {
    const p = pag('v5', { from: 'canais', canal: BASE.canalId, back: '?sort=vistos' })
    expect(p.position).toBe('vídeo 6 de 35, na ordem do canal: do mais novo ao mais antigo')
    expect(pag('v5', { from: 'canais', canal: BASE.canalId, back: '?painel=1' }).position).toBe('vídeo 6 de 35, na ordem do canal: do mais novo ao mais antigo')
    // sem back, ou com a grade no padrão, a lista de origem É a ordem do canal: a frase de antes
    expect(pag('v5', {}).position).toBe('vídeo 6 de 35, na ordem da lista: do mais novo ao mais antigo')
    expect(pag('v5', { from: 'canais', canal: BASE.canalId, back: '' }).position).toBe('vídeo 6 de 35, na ordem da lista: do mais novo ao mais antigo')
  })
  it('vindo de Outliers/Mudanças/Insights/Comparar o `from` e o `back` seguem nos links do vizinho (sem cast: o tipo é o de link.historico)', () => {
    const p = pag('v2', { from: 'outliers', back: '?window=7', ids: 'v7,v2,v9' })
    expect(p.position).toBe('vídeo 2 de 3, na ordem da lista aberta')
    expect(p.next).toBe(link.historico('v9', { from: 'outliers', back: '?window=7', ids: ['v7', 'v2', 'v9'] }))
    expect(pag('v5', { from: 'lixo' }).next).toBe(link.historico('v6', {}))
  })
})

describe('T13.0 H3: a tela do vídeo monta o cartão de UM vídeo, não o canal inteiro', () => {
  const w = proprioWorld({
    mut: ds => {
      primeiroProprio(ds).undated.push({ id: 'sem-data-h3', ytId: 'ytsdh3', title: 'Sem data', url: 'https://youtu.be/ytsdh3', isShort: false, dur: 125, views: 1500, likes: 5, comments: 1, pinned: false, checkedAt: null })
    },
  })
  const todos = buildCanalVideos(w.obs, w.canalId).videos
  const alvo = todos.find(c => c.grupo !== 'sem-data')!

  it('devolve só esse cartão, igual ao da lista inteira (datado e sem data); id que não é do canal, lista vazia', () => {
    expect(todos.length).toBeGreaterThan(3)
    expect(buildCanalVideos(w.obs, w.canalId, { soVideo: alvo.id }).videos).toEqual([alvo])
    const semData = todos.find(c => c.id === 'sem-data-h3')!
    expect(buildCanalVideos(w.obs, w.canalId, { soVideo: 'sem-data-h3' }).videos).toEqual([semData])
    expect(buildCanalVideos(w.obs, w.canalId, { soVideo: 'nao-e-deste-canal' }).videos).toEqual([])
    // sem a opção, a lista continua inteira
    expect(buildCanalVideos(w.obs, w.canalId).videos).toHaveLength(todos.length)
  })
  it('o cabeçalho do vídeo consulta as trocas (changesIn) UMA vez, não uma por vídeo do canal', () => {
    const espia = vi.spyOn(w.obs, 'changesIn')
    try {
      buildCanalVideos(w.obs, w.canalId)
      const inteira = espia.mock.calls.length
      expect(inteira).toBeGreaterThanOrEqual(todos.filter(c => c.grupo !== 'sem-data').length)
      espia.mockClear()
      expect(buildProprioVideoHeader(w.obs, alvo.id)!.id).toBe(alvo.id)
      expect(espia).toHaveBeenCalledTimes(1)
      espia.mockClear()
      expect(buildProprioVideoHeader(w.obs, 'sem-data-h3')!.semData).toBe(true)
      expect(espia).not.toHaveBeenCalled()
    } finally { espia.mockRestore() }
  })
  it('o cabeçalho montado assim é o mesmo de antes (a faixa não muda)', () => {
    const h = buildProprioVideoHeader(w.obs, alvo.id)!
    expect(h.titulo).toBe(alvo.title); expect(h.faixa.find(c => c.key === 'views')!.value).toBe(alvo.viewsText)
  })
})

describe('T13.0 H18/NB: o espaço antes de "mil" não quebra linha (U+00A0), na lista, na faixa e nas réguas', () => {
  it('numNb põe NBSP antes de "mil" e "mi"; abaixo de mil não há espaço nenhum a trocar', () => {
    const F = { num: (n: number) => (n >= 1_000_000 ? `${n / 1_000_000} mi` : n >= 1000 ? `${n / 1000} mil` : String(n)) }
    expect(numNb(F, 1500)).toBe('1.5\u00A0mil')
    expect(numNb(F, 2_000_000)).toBe('2\u00A0mi')
    expect(numNb(F, 12)).toBe('12')
  })
  it('a views de 1.500 do cartão e da faixa saem com NBSP', () => {
    const w = proprioWorld({ mut: ds => { const v = ds.videos.find(x => x.ch === primeiroProprio(ds).id)!; v.views = 1500 } })
    const c = buildCanalVideos(w.obs, w.canalId).videos.find(x => x.views === 1500)!
    expect(c.viewsText).toBe('1,5\u00A0mil')
    expect(buildProprioVideoHeader(w.obs, c.id)!.faixa.find(x => x.key === 'views')!.value).toBe('1,5\u00A0mil')
  })
})
