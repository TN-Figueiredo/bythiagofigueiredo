// @vitest-environment node
// A4 Tarefa 5 (lista de Canais): o canal próprio entra com as views por dia reais do diário, no lugar dele; cada ausência diz o motivo.
// Este sistema falha em verde: cada caso afirma o valor nulo E a frase, e o "nunca vira zero" tem teste próprio.
import { afterEach, describe, it, expect } from 'vitest'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams, type CanaisRow, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { fraseSeuCanal, motivoTexto, type MotivoSemMedida } from '@/app/cms/(authed)/youtube/competitors/_canais/posicao-model'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import type { ExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { motivoVpdTexto, type MotivoSemVpd, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'

// Arquivo todo síncrono e pesado: uma macrotarefa por teste, para o executor do Vitest responder no CI (ver canais-a3-posicao.test.ts).
afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const BASE = a3World() // lido uma vez por arquivo
const dm = (d: DiaYt) => d.slice(8) + '/' + d.slice(5, 7)
const JANELA = { de: '2026-09-11', ate: '2026-10-08' }
const medido = (valor: number, n = 3): VpdCanal => ({ valor, motivo: null, n, janela: JANELA, ultimoDia: JANELA.ate })
const semValor = (motivo: MotivoSemVpd, ultimoDia: DiaYt | null = null): VpdCanal => ({ valor: null, motivo, n: 0, janela: null, ultimoDia })
const extras = (m: Record<string, VpdCanal>): ExtrasProprio => ({ vpd: new Map(Object.entries(m)), dm })
const NBSP = / /g

const view = (p: Partial<CanaisParams> = {}, obs: Observatory = BASE.obs, ex?: ExtrasProprio): CanaisView => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p }, ex)
const all = (v: CanaisView): CanaisRow[] => [...v.list.ranked, ...v.list.unranked]
const byId = (v: CanaisView, id: string) => all(v).find(r => r.id === id)!
const cheia = (v: CanaisView, id: string) => {
  const l = v.own.block!.linhas.find(x => x.id === id)!
  if (l.tipo !== 'cheia') throw new Error('linha fina: ' + id)
  return l
}
/** Produção: o carregador não dá série diária ao canal próprio (D2 do plano). */
const semDiario = (ds: Dataset) => { for (const v of ds.videos) if (ds.channels.find(c => c.id === v.ch)!.own) { v.series = []; v.firstIdx = null } }
const [OWN1, OWN2] = BASE.owns as [string, string]

describe('A4.5 lista: o canal próprio entra na posição de Views/dia', () => {
  it('canal próprio COM views por dia medidas entra na posição de Views/dia, no lugar dele, com o valor escrito por vpdText', () => {
    const v = view({ sort: 'vpd', scale: 'abs' }, BASE.obs, extras({ [OWN1]: medido(2.4), [OWN2]: semValor('sem-diario') }))
    const linha = byId(v, OWN1)
    expect(v.list.ranked).toContain(linha)
    expect(linha.pos).not.toBeNull()
    expect(linha.valor.vpd).toBe(2.4)
    // oráculo independente: 1 + quantos concorrentes medidos têm valor MAIOR e escrito diferente
    const outros = all(v).filter(r => !r.own && r.valor.vpd != null).map(r => r.valor.vpd!)
    expect(outros.length).toBeGreaterThan(8) // o laço tem o que olhar
    const txt = (x: number) => vpdText(x, BASE.obs.fmt.num)
    expect(linha.pos).toEqual({ pos: 1 + outros.filter(x => x > 2.4 && txt(x) !== txt(2.4)).length, de: outros.length + 1, empate: outros.some(x => txt(x) === txt(2.4)) })
    // a célula e a frase escrevem o mesmo número, pelo mesmo formatador
    expect(linha.cells.vpd).toMatchObject({ kind: 'ok', big: '2,4', n: 3 })
    expect(cheia(v, OWN1).frase).toBe(`${linha.pos!.pos}º de ${linha.pos!.de} no geral${linha.pos!.empate ? ' (empate)' : ''}, em views/dia nos longos, com 2,4.`)
    // quem fica no lugar certo: a lista ordenada por valor, o próprio no meio dos concorrentes
    const ordem = v.list.ranked.map(r => r.valor.vpd!)
    expect(ordem).toEqual([...ordem].sort((a, b) => b - a))
    // o outro canal próprio, sem número, não entrou
    expect(v.list.unranked.map(r => r.id)).toContain(OWN2)
  })

  it('zero medido (canal parado) entra na posição com "0", atrás de qualquer positivo, e NÃO vai para "sem medida"', () => {
    const v = view({ sort: 'vpd', scale: 'abs' }, BASE.obs, extras({ [OWN1]: medido(0, 2), [OWN2]: semValor('sem-diario') }))
    const linha = byId(v, OWN1)
    expect(linha.valor.vpd).toBe(0) // zero medido não é nulo
    expect(v.list.unranked.map(r => r.id)).not.toContain(OWN1)
    const positivos = all(v).filter(r => !r.own && r.valor.vpd != null && r.valor.vpd > 0.05).length
    expect(linha.pos!.pos).toBe(1 + positivos)
    expect(linha.cells.vpd).toMatchObject({ kind: 'ok', big: '0' })
    expect(cheia(v, OWN1).frase).toMatch(/, em views\/dia nos longos, com 0\.$/)
    expect(linha.semMedida).toBeNull()
    // atrás de todos os que têm valor maior, na ordem da lista
    const i = v.list.ranked.findIndex(r => r.id === OWN1)
    for (const r of v.list.ranked.slice(0, i)) expect(r.valor.vpd!).toBeGreaterThanOrEqual(0)
  })

  const SEIS: Array<[MotivoSemVpd, DiaYt | null, string]> = [
    ['sem-acesso', null, 'só quem edita o site vê as views por dia do seu canal'],
    ['leitura-falhou', null, 'a leitura das views por dia falhou agora; recarregue a página'],
    ['sem-diario', null, 'a coleta diária ainda não gravou este canal'],
    ['diario-parado', '2026-10-02', 'a coleta diária deste canal parou em 02/10'],
    ['sem-longos', '2026-10-08', 'nenhum vídeo longo acompanhado'],
    ['poucos-dias', '2026-10-08', 'menos de 7 dias medidos nos últimos 28'],
  ]
  it('cada motivo (sem-acesso, leitura-falhou, sem-diario, diario-parado, sem-longos, poucos-dias) deixa o canal sob "Ainda sem medida para ordenar" com a frase do motivo', () => {
    for (const [m, ultimo, texto] of SEIS) for (const dir of ['desc', 'asc'] as const) {
      const c = semValor(m, ultimo)
      expect(motivoVpdTexto(m, c, dm), m).toBe(texto) // a frase não é a que o teste tira do próprio código
      const v = view({ sort: 'vpd', dir }, BASE.obs, extras({ [OWN1]: c, [OWN2]: c }))
      for (const id of [OWN1, OWN2]) {
        const r = byId(v, id)
        const frase = `Ainda sem views por dia medidas: ${texto}. Sem posição nesta ordenação.`
        expect(r.valor.vpd, `${m}/${id}: nulo nunca vira zero`).toBeNull()
        expect(r.pos, m).toBeNull()
        expect(r.semMedida, m).toBe('sem-views-dia-proprio')
        expect(v.list.unranked.map(x => x.id), m).toContain(id)
        expect(v.list.ranked.map(x => x.id), m).not.toContain(id)
        expect(cheia(v, id).frase, m).toBe(frase)
        expect(cheia(v, id).vizinhos, m).toBeNull()
        // o bloco, o cartão e o anúncio (leitor de tela) dizem a MESMA frase
        expect(motivoTexto(r.semMedida!, r.semMedidaTexto ?? undefined), m).toBe(frase)
        expect(fraseSeuCanal(null, v.conjunto, r.semMedida, r.semMedidaTexto ?? undefined), m).toBe(frase)
        expect(r.cells.vpd, m).toMatchObject({ kind: 'na' })
      }
      expect(v.pe!.texto, m).toBe('seu canal · ' + cheia(v, v.pe!.canalId).frase)
      expect(v.list.divisor!.titulo, m).toBe(`Ainda sem medida para ordenar (${v.list.unranked.length})`)
    }
  })

  it('sem extras (o dado não foi lido): o canal próprio continua sem medida, com a frase de "sem-diario"; nunca um número', () => {
    const w = a3World(semDiario) // como em produção: o motor não tem série do canal próprio
    for (const scale of ['abs', 'per-mil'] as const) {
      const v = view({ sort: 'vpd', scale }, w.obs)
      for (const id of w.owns) {
        const r = byId(v, id)
        expect(r.valor.vpd, `${id}/${scale}`).toBeNull()
        expect(r.pos).toBeNull()
        expect(r.semMedida).toBe('sem-views-dia-proprio')
        expect(cheia(v, id).frase).toBe('Ainda sem views por dia medidas: a coleta diária ainda não gravou este canal. Sem posição nesta ordenação.')
        expect(r.cells.vpd).toMatchObject({ kind: 'na', text: 'Sem views diárias do seu canal.' }) // a célula é a de hoje
      }
    }
  })

  it('a frase "começa em breve" não existe mais em nenhum texto do modelo, em nenhuma ordenação × formato × nicho', () => {
    const w = a3World(semDiario)
    const mundos: Array<[string, ExtrasProprio | undefined]> = [
      ['sem extras', undefined],
      ['medido', extras({ [OWN1]: medido(3.1), [OWN2]: medido(0) })],
      ...SEIS.map(([m, u]): [string, ExtrasProprio] => [m, extras({ [OWN1]: semValor(m, u), [OWN2]: semValor(m, u) })]),
    ]
    const niches = ['todos', ...w.obs.ownChannels().map(c => c.niche).filter((n): n is string => n != null).slice(0, 1)]
    let n = 0
    for (const [nome, ex] of mundos) for (const sort of ['subs', 'vpd', 'active', 'outliers', 'swaps', 'growth'] as const) for (const fmt of ['longos', 'todos', 'shorts'] as const) for (const niche of niches) {
      const json = JSON.stringify(view({ sort, fmt, niche }, w.obs, ex))
      expect(json, `${nome}/${sort}/${fmt}/${niche}`).not.toMatch(/começa em breve/i)
      n++
    }
    expect(n).toBe(mundos.length * 6 * 3 * niches.length)
    const motivos: MotivoSemMedida[] = ['sem-videos', 'sem-shorts', 'sem-views-dia-proprio', 'aguarda-2o-registro', 'buscando-videos', 'inscritos-ocultos', 'sem-nicho', 'ordenacao-sem-posicao']
    for (const m of motivos) expect(motivoTexto(m), m).not.toMatch(/começa em breve/i)
  })

  it('por mil inscritos: valor ÷ (inscritos ÷ 1000); inscritos ocultos ou zero continuam com o motivo de hoje', () => {
    const subs = BASE.obs.channel(OWN1)!.subs!
    expect(subs).toBeGreaterThan(0)
    const ex = extras({ [OWN1]: medido(3), [OWN2]: semValor('sem-diario') })
    const v = view({ sort: 'vpd', scale: 'per-mil' }, BASE.obs, ex)
    const r = byId(v, OWN1)
    expect(r.valor.vpd).toBeCloseTo(3 / (subs / 1000), 10)
    expect(r.cells.vpd).toMatchObject({ kind: 'ok', big: vpdText(3 / (subs / 1000), BASE.obs.fmt.num)!.replace(/ (mil|mi)$/, ' $1') })
    if (r.cells.vpd.kind !== 'ok') throw new Error('a célula deveria ter o número')
    expect(r.cells.vpd.abs).toBe('3,0') // a mesma medida absoluta, ao lado
    expect(r.pos).not.toBeNull()
    // inscritos ocultos: não há por mil; o motivo é o dos concorrentes ("inscritos ocultos"), e o absoluto continua medido
    const oculto = a3World(ds => { semDiario(ds); ds.channels.find(c => c.id === OWN1)!.subs = null })
    const vo = view({ sort: 'vpd', scale: 'per-mil' }, oculto.obs, ex)
    const ro = byId(vo, OWN1)
    expect(ro.valor.vpd).toBeNull(); expect(ro.pos).toBeNull(); expect(ro.semMedida).toBe('inscritos-ocultos')
    expect(ro.cells.vpd).toMatchObject({ kind: 'na', text: 'Inscritos ocultos: veja em Absoluto.' })
    expect(byId(view({ sort: 'vpd', scale: 'abs' }, oculto.obs, ex), OWN1).valor.vpd).toBe(3)
    // zero inscritos: dividir daria infinito; fica sem medida, com a frase, nunca Infinity nem 0
    const zero = a3World(ds => { semDiario(ds); ds.channels.find(c => c.id === OWN1)!.subs = 0 })
    const rz = byId(view({ sort: 'vpd', scale: 'per-mil' }, zero.obs, ex), OWN1)
    expect(rz.valor.vpd).toBeNull(); expect(rz.pos).toBeNull(); expect(rz.semMedida).toBe('sem-views-dia-proprio')
    expect(cheia(view({ sort: 'vpd', scale: 'per-mil' }, zero.obs, ex), OWN1).frase).toBe('Ainda sem views por dia medidas: o canal ainda não tem inscritos. Sem posição nesta ordenação.')
    expect(JSON.stringify(view({ sort: 'vpd', scale: 'per-mil' }, zero.obs, ex))).not.toMatch(/Infinity|NaN/)
  })

  it('dois canais próprios: cada um com o seu número; o que não tem vídeo continua "sem vídeos"', () => {
    const sem = OWN2
    const w = a3World(ds => { semDiario(ds); ds.videos = ds.videos.filter(v => v.ch !== sem) })
    const ex = extras({ [OWN1]: medido(5.5), [sem]: medido(9) }) // mesmo com um número vindo de fora, quem não tem vídeo não ganha posição
    const v = view({ sort: 'vpd', scale: 'abs' }, w.obs, ex)
    expect(byId(v, OWN1).valor.vpd).toBe(5.5)
    expect(byId(v, OWN1).pos).not.toBeNull()
    expect(byId(v, sem).pos).toBeNull()
    expect(byId(v, sem).semMedida).toBe('sem-videos')
    expect(v.own.block!.linhas.find(l => l.id === sem)!.tipo).toBe('fina')
    // com os dois com vídeo e números diferentes: cada um com o seu, e o de maior valor na frente
    const v2 = view({ sort: 'vpd', scale: 'abs' }, BASE.obs, extras({ [OWN1]: medido(5.5), [OWN2]: medido(1.2) }))
    expect(byId(v2, OWN1).valor.vpd).toBe(5.5); expect(byId(v2, OWN2).valor.vpd).toBe(1.2)
    expect(byId(v2, OWN1).pos!.pos).toBeLessThan(byId(v2, OWN2).pos!.pos)
    expect(byId(v2, OWN1).cells.vpd).toMatchObject({ kind: 'ok', big: '5,5' }); expect(byId(v2, OWN2).cells.vpd).toMatchObject({ kind: 'ok', big: '1,2' })
  })

  const FRASE_LONGOS = 'as views por dia do seu canal só são medidas nos vídeos longos'

  it('no filtro Shorts o número dos longos NÃO entra na posição dos Shorts; a frase diz que a medida é dos longos', () => {
    const w = a3World(semDiario) // produção: o motor não tem série do canal próprio
    const v = view({ sort: 'vpd', fmt: 'shorts', scale: 'abs' }, w.obs, extras({ [OWN1]: medido(7), [OWN2]: medido(7) }))
    for (const id of [OWN1, OWN2]) {
      const r = byId(v, id)
      expect(r.pos, id).toBeNull()
      expect(r.valor.vpd, id).toBeNull()
      expect(r.semMedida, id).toBe('sem-views-dia-proprio')
      expect(cheia(v, id).frase, id).toBe(`Ainda sem views por dia medidas: ${FRASE_LONGOS}. Sem posição nesta ordenação.`)
    }
    // Todos: ordena pelos longos (o número entra) e a medida dos Shorts é outra: a segunda linha da célula diz o mesmo que o bloco
    const t = view({ sort: 'vpd', fmt: 'todos', scale: 'abs' }, w.obs, extras({ [OWN1]: medido(7) }))
    const r = byId(t, OWN1)
    expect(r.valor.vpd).toBe(7)
    expect(t.list.ranked).toContain(r)
    expect(r.cells.vpd).toMatchObject({ kind: 'ok', big: '7,0' })
    expect(r.cells.vpd2).toMatchObject({ kind: 'na' })
  })

  it('a célula do canal próprio nos Shorts e na segunda linha de "Todos" diz a mesma frase do bloco, no texto e na dica; a frase velha ("só dos concorrentes") não existe', () => {
    const w = a3World(semDiario)
    const ex = extras({ [OWN1]: medido(7), [OWN2]: medido(7) })
    const FRASE = 'As views por dia do seu canal só são medidas nos vídeos longos.'
    // Shorts: a célula principal
    const s = view({ sort: 'vpd', fmt: 'shorts', scale: 'abs' }, w.obs, ex)
    const rs = byId(s, OWN1)
    expect(rs.cells.vpd).toEqual({ kind: 'na', text: FRASE, title: FRASE })
    // a mesma frase do bloco "Seu canal" (que a escreve em minúscula, no meio da sua frase)
    expect(cheia(s, OWN1).frase.toLowerCase()).toContain(FRASE.slice(0, -1).toLowerCase())
    // Todos: a segunda linha (Shorts) do canal que TEM Short; a primeira (longos) segue com o número
    const t = view({ sort: 'vpd', fmt: 'todos', scale: 'abs' }, w.obs, ex)
    const rt = byId(t, OWN1)
    expect(rt.cells.vpd).toMatchObject({ kind: 'ok', big: '7,0' })
    expect(rt.cells.vpd2).toEqual({ kind: 'na', text: FRASE, title: FRASE })
    // nenhuma célula do canal próprio, em nenhum formato, repete a frase velha
    for (const fmt of ['todos', 'longos', 'shorts'] as const) {
      const json = JSON.stringify(view({ sort: 'vpd', fmt, scale: 'abs' }, w.obs, ex))
      expect(json, fmt).not.toMatch(/só dos concorrentes|Sem views diárias do seu canal/)
    }
    // o concorrente não muda: a mesma célula de Shorts com e sem extras
    const sem = view({ sort: 'vpd', fmt: 'shorts', scale: 'abs' }, w.obs)
    for (const r of all(sem).filter(x => !x.own)) expect(byId(s, r.id).cells, r.id).toEqual(r.cells)
  })

  it('as posições dos concorrentes antes e depois de o canal próprio ficar medido: nenhum número muda; a posição renumera só para quem ficou atrás dele', () => {
    const w = a3World(semDiario)
    const antes = view({ sort: 'vpd', scale: 'abs' }, w.obs)
    const comp = all(antes).filter(r => !r.own && r.valor.vpd != null)
    expect(comp.length).toBeGreaterThan(8)
    const ordem = comp.map(r => r.valor.vpd!).sort((x, y) => x - y)
    const X = ordem[ordem.length >> 1]! + 0.37 // entre dois concorrentes, num valor que nenhum escreve igual
    const txt = (n: number) => vpdText(n, w.obs.fmt.num)
    const depois = view({ sort: 'vpd', scale: 'abs' }, w.obs, extras({ [OWN1]: medido(X), [OWN2]: semValor('sem-diario') }))
    let atras = 0, adiante = 0
    for (const r of comp) {
      const d = byId(depois, r.id)
      expect(d.valor, r.id).toEqual(r.valor)       // o número do concorrente não muda
      expect(d.cells, r.id).toEqual(r.cells)
      expect(r.pos, r.id).not.toBeNull(); expect(d.pos, r.id).not.toBeNull()
      const sobe = X > r.valor.vpd! && txt(X) !== txt(r.valor.vpd!) // o próprio passa à frente deste concorrente
      expect(d.pos!.de, r.id).toBe(r.pos!.de + 1)  // o conjunto ganhou um canal medido
      expect(d.pos!.pos, r.id).toBe(r.pos!.pos + (sobe ? 1 : 0))
      expect(d.pos!.empate, r.id).toBe(r.pos!.empate || txt(X) === txt(r.valor.vpd!))
      if (sobe) atras++; else adiante++
    }
    expect(atras).toBeGreaterThan(0); expect(adiante).toBeGreaterThan(0) // o laço viu os dois lados
    // o próprio entrou no lugar certo: 1 + quantos concorrentes têm valor maior
    expect(byId(depois, OWN1).pos).toEqual({ pos: 1 + adiante, de: comp.length + 1, empate: false })
  })

  it('o dado novo só mexe no canal próprio: as linhas dos concorrentes saem iguais com e sem extras', () => {
    const sem = view({ sort: 'vpd' }, BASE.obs)
    const com = view({ sort: 'vpd' }, BASE.obs, extras({ [OWN1]: medido(4), [OWN2]: semValor('poucos-dias', '2026-10-08') }))
    for (const r of all(sem).filter(x => !x.own)) {
      const o = byId(com, r.id)
      expect(o.cells, r.id).toEqual(r.cells); expect(o.valor, r.id).toEqual(r.valor); expect(o.semMedida, r.id).toEqual(r.semMedida)
    }
  })

  it('a célula do canal próprio escreve a base: a janela do diário, e a ressalva do canal parado continua', () => {
    const v = view({ sort: 'vpd', scale: 'abs' }, BASE.obs, extras({ [OWN1]: medido(0, 2) }))
    const c = byId(v, OWN1).cells.vpd
    if (c.kind !== 'ok') throw new Error('a célula deveria ter o número')
    expect(c.big).toBe('0'); expect(c.n).toBe(2); expect(c.weak).toBe(true) // 2 vídeos é base fraca
    expect(c.tail ?? '').toContain('de 11/09 a 08/10')
    expect(c.title).toBe('média dos últimos 28 dias do YouTube com medida (de 11/09 a 08/10), mediana de 2 longos')
    expect((c.tail ?? '').replace(NBSP, ' ')).not.toMatch(/undefined|null/)
  })
})
