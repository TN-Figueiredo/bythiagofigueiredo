// @vitest-environment node
// A3 Tarefa 6: a "Leitura rápida" do par (spec 18.3): calculada dos mesmos números, sem IA. Nunca "ganha", "vencedor" ou "perdedor";
// no máximo três itens por linha; linha sem item não aparece; nunca cita um número que nenhum dos dois canais tem.
import { describe, it, expect, vi } from 'vitest'
import { canalDe, pacoteDe, type OpcoesCanal, type Val } from './par-helpers'
import { buildPar, type ParView } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { NUMEROS, type NumeroId } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { a3World } from './a3-fixture'
import { buildCompararPack } from '@/app/cms/(authed)/youtube/competitors/_comparar/pack'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

type N = Partial<Record<NumeroId, Val>>
const par = (a: N, b: N, oa: OpcoesCanal = {}, ob: OpcoesCanal = {}): ParView =>
  buildPar(pacoteDe([canalDe('aa', { name: 'Aa', ...oa, n: a }), canalDe('bb', { name: 'Bb', ...ob, n: b })]), 'aa', 'bb')
const maior = (v: ParView, lado: 0 | 1) => v.leitura.find(i => i.simbolo === 'maior' && i.lado === lado)
const igual = (v: ParView) => v.leitura.find(i => i.simbolo === 'igual')
const sem = (v: ParView) => v.leitura.find(i => i.simbolo === 'sem')

describe('Leitura rápida: "é maior em"', () => {
  it('uma linha por lado que é maior em algo, "<quem> é maior em: …", com no máximo três itens e "e mais N"', () => {
    const v = par(
      { longosAcomp: 50, longos90: 20, medianaViews: 3700, vpd: 90, inscritos: 1000, acima2x: 1 },
      { longosAcomp: 10, longos90: 10, medianaViews: 1000, vpd: 30, inscritos: 100, acima2x: 5 },
      { own: true },
    )
    expect(v.leitura.filter(i => i.simbolo === 'maior').length).toBe(2)
    const a = maior(v, 0)!, b = maior(v, 1)!
    expect(a.texto).toBe('Você é maior em: inscritos (10×), longos acompanhados (5,0×), mediana de views (3,7×) e mais 2.')
    expect(b.texto).toBe('Bb é maior em: vídeos acima de 2× (5,0×).')
    expect(a.lado).toBe(0); expect(b.lado).toBe(1)
    // exatamente três itens: sem "e mais"
    const tres = par({ longosAcomp: 50, medianaViews: 3700, vpd: 90 }, { longosAcomp: 10, medianaViews: 1000, vpd: 30 })
    expect(maior(tres, 0)!.texto).toBe('Aa é maior em: longos acompanhados (5,0×), mediana de views (3,7×) e views por dia (3,0×).')
    // um e dois itens
    expect(maior(par({ vpd: 60 }, { vpd: 30 }), 0)!.texto).toBe('Aa é maior em: views por dia (2,0×).')
    expect(maior(par({ vpd: 60, longosAcomp: 90 }, { vpd: 30, longosAcomp: 30 }), 0)!.texto).toBe('Aa é maior em: longos acompanhados (3,0×) e views por dia (2,0×).')
  })

  it('os itens vêm do de maior diferença para o menor; contra zero vem primeiro e escreve "(2 contra 0)"', () => {
    const v = par(
      { longosAcomp: 15, medianaViews: 900, longos90: 2, vpd: 12, inscritos: 130 },
      { longosAcomp: 10, medianaViews: 100, longos90: 0, vpd: 4, inscritos: 100 },
    )
    expect(maior(v, 0)!.texto).toBe('Aa é maior em: longos em 90 dias (2 contra 0), mediana de views (9,0×), views por dia (3,0×) e mais 2.')
    // o desempate é a ordem das linhas na tabela
    const emp = par({ longosAcomp: 20, vpd: 20 }, { longosAcomp: 10, vpd: 10 })
    expect(maior(emp, 0)!.texto).toBe('Aa é maior em: longos acompanhados (2,0×) e views por dia (2,0×).')
    // abaixo de 2×, "+N%"
    expect(maior(par({ inscritos: 154 }, { inscritos: 100 }), 0)!.texto).toBe('Aa é maior em: inscritos (+54%).')
  })

  it('contra zero em ritmo e em vídeos acima de 2×: o valor do lado maior, sem razão infinita', () => {
    const v = par({ ritmo: [0.2, '0,2 + 0'], acima2x: [3, '3 de 11'] }, { ritmo: 0, acima2x: 0 })
    expect(maior(v, 0)!.texto).toBe('Aa é maior em: ritmo de publicação (0,2 por semana contra 0) e vídeos acima de 2× (3 contra 0).')
    const w = par({ longosAcomp: 0, vpd: 0 }, { longosAcomp: 6, vpd: 2.5 })
    expect(maior(w, 1)!.texto).toBe('Bb é maior em: longos acompanhados (6 contra 0) e views por dia (2,5 contra 0).')
    expect(JSON.stringify(v.leitura)).not.toMatch(/Infinity|NaN/)
  })

  it('engajamento e duração escrevem os dois valores ("14,9% contra 9,6%"); os outros, a diferença', () => {
    const v = par(
      { engajamento: [0.149, '14,9%'], duracao: [754, '12:34'], medianaViews: [3700, '3,7 mil'] },
      { engajamento: [0.096, '9,6%'], duracao: [300, '05:00'], medianaViews: [1000, '1,0 mil'] },
      { own: true },
    )
    expect(maior(v, 0)!.texto).toBe('Você é maior em: mediana de views (3,7×), duração (12:34 contra 05:00) e engajamento (14,9% contra 9,6%).')
    // com um lado em zero, ainda os dois valores
    const z = par({ engajamento: [0.149, '14,9%'] }, { engajamento: [0, '0,0%'] })
    expect(maior(z, 0)!.texto).toBe('Aa é maior em: engajamento (14,9% contra 0,0%).')
  })

  it('"publicação mais recente" entra na linha de quem publicou por último', () => {
    const v = par({ diasUltimo: 5 }, { diasUltimo: 40 })
    expect(maior(v, 0)!.texto).toBe('Aa é maior em: publicação mais recente.')
    expect(maior(v, 1)).toBeUndefined()
    const w = par({ diasUltimo: 40, longosAcomp: 20 }, { diasUltimo: 5, longosAcomp: 10 })
    expect(maior(w, 0)!.texto).toBe('Aa é maior em: longos acompanhados (2,0×).')
    expect(maior(w, 1)!.texto).toBe('Bb é maior em: publicação mais recente.')
    // o item de recência é o último: com três de diferença ele vira o "e mais 1"
    const c = par({ diasUltimo: 3, longosAcomp: 40, vpd: 30, medianaViews: 20 }, { diasUltimo: 90, longosAcomp: 10, vpd: 10, medianaViews: 10 })
    expect(maior(c, 0)!.texto).toBe('Aa é maior em: longos acompanhados (4,0×), views por dia (3,0×), mediana de views (2,0×) e mais 1.')
    // dias iguais: ninguém publicou depois
    expect(maior(par({ diasUltimo: 7 }, { diasUltimo: 7 }), 0)).toBeUndefined()
  })

  it('inscritos em 30 dias e trocas não entram em "é maior em" (nem em "praticamente iguais")', () => {
    const v = par({ inscritos30: 0.2, trocas30: 9 }, { inscritos30: 0.05, trocas30: 1 })
    expect(v.leitura).toEqual([])
    const e = par({ inscritos30: 0.2, trocas30: 9 }, { inscritos30: 0.2, trocas30: 9 })
    expect(e.leitura).toEqual([])
    const w = par({ inscritos30: 0.2, trocas30: 9, vpd: 30 }, { inscritos30: 0.05, trocas30: 1, vpd: 10 })
    expect(maior(w, 0)!.texto).toBe('Aa é maior em: views por dia (3,0×).')
  })

  it('nunca "ganha", "vencedor", "perdedor" nem "melhor": o bloco é sobre tamanho, não sobre valor', () => {
    const v = par({ longosAcomp: 50, vpd: 90, engajamento: [0.2, '20,0%'] }, { longosAcomp: 10, vpd: 30, engajamento: [0.1, '10,0%'] }, { own: true })
    for (const i of v.leitura) expect(i.texto).not.toMatch(/ganha|vencedor|perdedor|melhor|vence|perde/i)
  })

  it('o mesmo número nunca aparece nos dois lados, e o lado do item é o de quem tem mais (inverter troca o lado e nada mais)', () => {
    const a: N = { longosAcomp: 50, vpd: 3, medianaViews: 300, diasUltimo: 4 }, b: N = { longosAcomp: 10, vpd: 9, medianaViews: 100, diasUltimo: 40 }
    const v = par(a, b), w = par(b, a)
    expect(maior(v, 0)!.texto).toBe('Aa é maior em: longos acompanhados (5,0×), mediana de views (3,0×) e publicação mais recente.')
    expect(maior(v, 1)!.texto).toBe('Bb é maior em: views por dia (3,0×).')
    expect(maior(w, 0)!.texto).toBe('Aa é maior em: views por dia (3,0×).')
    expect(maior(w, 1)!.texto).toBe('Bb é maior em: longos acompanhados (5,0×), mediana de views (3,0×) e publicação mais recente.')
  })
})

describe('Leitura rápida: "praticamente iguais" e "sem como comparar"', () => {
  it('"＝ Praticamente iguais: …" corta em três', () => {
    const v = par({ longosAcomp: 10, duracao: [600, '10:00'], inscritos: 100 }, { longosAcomp: 10.5, duracao: [610, '10:10'], inscritos: 105 })
    expect(igual(v)!.texto).toBe('Praticamente iguais: inscritos, longos acompanhados e duração.')
    expect(igual(v)!.lado).toBeNull()
    const cinco = par({ inscritos: 10, longosAcomp: 10, longos90: 10, ritmo: 10, vpd: 10 }, { inscritos: 10, longosAcomp: 10, longos90: 10, ritmo: 10, vpd: 10 })
    expect(igual(cinco)!.texto).toBe('Praticamente iguais: inscritos, longos acompanhados, longos em 90 dias e mais 2.')
    expect(maior(cinco, 0)).toBeUndefined()
    // zero nos dois é igual; um lado em zero não é
    const z = par({ longos90: 0, vpd: 0 }, { longos90: 0, vpd: 4 })
    expect(igual(z)!.texto).toBe('Praticamente iguais: longos em 90 dias.')
    expect(maior(z, 1)!.texto).toBe('Bb é maior em: views por dia (4 contra 0).')
  })

  it('"Sem como comparar ainda: N números (falta o dado do seu canal em …)"', () => {
    const v = par(
      { inscritos: 100, longosAcomp: 10, vpd: null, vpdPorMil: null, inscritos30: null },
      { inscritos: 50, longosAcomp: 10, vpd: 5, vpdPorMil: 0.4, inscritos30: 0.02 },
      { own: true },
    )
    expect(sem(v)!.texto).toBe('Sem como comparar ainda: 3 números (falta o dado do seu canal em inscritos em 30 dias, views por dia e views por dia por mil inscritos).')
    expect(sem(v)!.lado).toBeNull()
    // mais de três: os dois primeiros e "e mais N"
    const m = par(
      { inscritos: 100, vpd: null, vpdPorMil: null, inscritos30: null, trocas30: null },
      { inscritos: 50, vpd: 5, vpdPorMil: 0.4, inscritos30: 0.02, trocas30: 3 },
      { own: true },
    )
    expect(sem(m)!.texto).toBe('Sem como comparar ainda: 4 números (falta o dado do seu canal em inscritos em 30 dias, views por dia e mais 2).')
    // um número só no singular; os dois lados faltando coisas diferentes
    const u = par({ inscritos: 1, medianaViews: null }, { inscritos: 2, medianaViews: 3 })
    expect(sem(u)!.texto).toBe('Sem como comparar ainda: 1 número (falta o dado de Aa em mediana de views).')
    const d = par({ inscritos: 1, medianaViews: null, vpd: 4 }, { inscritos: 2, medianaViews: 3, vpd: null })
    expect(sem(d)!.texto).toBe('Sem como comparar ainda: 2 números (falta o dado de Aa em mediana de views; falta o dado de Bb em views por dia).')
  })

  it('só cita o que existe: uma linha em que os DOIS lados não têm dado (fora) nunca aparece na Leitura rápida', () => {
    const v = par({ inscritos: 100, engajamento: null, vpd: null }, { inscritos: 50, engajamento: null, vpd: 3 })
    const fora = v.fora.map(f => f.toLowerCase())
    expect(fora).toContain('engajamento nos longos')
    const tudo = v.leitura.map(i => i.texto).join(' | ')
    expect(tudo).not.toMatch(/engajamento/)
    expect(tudo).toMatch(/views por dia/) // essa tem dado de um lado só e entra como "sem como comparar"
  })

  it('dois canais próprios: ninguém é "Você" e o dado que falta é "de <nome>"', () => {
    const v = par({ inscritos: 100, vpd: null, longosAcomp: 30 }, { inscritos: 50, vpd: 4, longosAcomp: 10 }, { own: true }, { own: true })
    expect(maior(v, 0)!.texto).toBe('Aa é maior em: longos acompanhados (3,0×) e inscritos (2,0×).')
    expect(sem(v)!.texto).toBe('Sem como comparar ainda: 1 número (falta o dado de Aa em views por dia).')
  })
})

describe('Leitura rápida: quando não aparece', () => {
  it('linha sem itens não aparece; par sem nada a dizer devolve lista vazia', () => {
    const v = par({ longosAcomp: 50 }, { longosAcomp: 10 })
    expect(maior(v, 1)).toBeUndefined(); expect(igual(v)).toBeUndefined(); expect(sem(v)).toBeUndefined()
    expect(v.leitura.length).toBe(1)
    expect(par({}, {}).leitura).toEqual([])
    expect(par({ inscritos30: 0.3 }, { inscritos30: 0.1 }).leitura).toEqual([])
  })
  it('o canal próprio sem vídeos contra um concorrente completo: nada de "é maior" fantasma, e o que falta é dito', () => {
    const w = a3World(ds => { ds.videos = ds.videos.filter(v => v.ch !== 'tnfigueiredo-en'); ds.channels.find(c => c.id === 'tnfigueiredo-en')!.undated = [] })
    const p = buildCompararPack(w.obs)
    const v = buildPar(p, 'tnfigueiredo-en', 'leo-khev')
    expect(v.leitura.filter(i => i.simbolo === 'maior' && i.lado === 0)).toEqual([]) // o canal sem vídeos não é maior em nada
    const s = v.leitura.find(i => i.simbolo === 'sem')!
    expect(s.texto).toMatch(/^Sem como comparar ainda: 12 números \(falta o dado do seu canal em /)
    expect(v.leitura.find(i => i.simbolo === 'maior' && i.lado === 1)!.texto).toMatch(/^Leo Khev é maior em: /)
  })
  it('todos os pares do fixture: no máximo quatro entradas, três itens por linha, e a ordem é maior(A), maior(B), iguais, sem', () => {
    const w = a3World()
    const p = buildCompararPack(w.obs)
    let vistos = 0
    for (const a of p.ordem) for (const b of p.ordem) {
      if (a === b) continue
      const v = buildPar(p, a, b)
      expect(v.leitura.length).toBeLessThanOrEqual(4)
      const ordem = v.leitura.map(i => (i.simbolo === 'maior' ? `maior${i.lado}` : i.simbolo))
      expect(ordem, `${a}×${b}`).toEqual(['maior0', 'maior1', 'igual', 'sem'].filter(k => ordem.includes(k)))
      for (const i of v.leitura) {
        vistos++
        expect((i.lado === null), `${a}×${b}`).toBe(i.simbolo !== 'maior')
        if (i.simbolo === 'maior') expect(i.texto).not.toMatch(/Infinity|NaN|undefined/)
      }
      // a mesma linha nunca é "maior" dos dois lados (cada número tem um lado só)
      const doLado = (l: 0 | 1) => v.leitura.find(i => i.simbolo === 'maior' && i.lado === l)?.texto ?? ''
      const itens = (t: string) => t.replace(/^.* é maior em: /, '').replace(/\.$/, '').replace(/ e mais \d+$/, '').split(/\), | e (?=[a-zç]+ )|, (?=[a-zç]+ )/)
      const nomes = (t: string) => itens(t).map(x => x.replace(/ \(.*$/, '').replace(/\)$/, '').trim())
      const a0 = new Set(nomes(doLado(0))), b0 = nomes(doLado(1))
      for (const n of b0) if (n) expect(a0.has(n) && n !== '', `${a}×${b} ${n}`).toBe(false)
    }
    expect(vistos).toBeGreaterThan(150)
  })
  it('as linhas citadas existem: todo número citado em "é maior em" ou "iguais" tem os dois lados medidos', () => {
    const w = a3World()
    const p = buildCompararPack(w.obs)
    const curto: Record<NumeroId, string> = {
      inscritos: 'inscritos', inscritos30: 'inscritos em 30 dias', longosAcomp: 'longos acompanhados', longos90: 'longos em 90 dias', ritmo: 'ritmo de publicação',
      diasUltimo: 'tempo desde o último vídeo', medianaViews: 'mediana de views', vpd: 'views por dia', vpdPorMil: 'views por dia por mil inscritos', engajamento: 'engajamento',
      acima2x: 'vídeos acima de 2×', duracao: 'duração', trocas30: 'trocas em 30 dias',
    }
    for (const a of p.ordem) for (const b of p.ordem) {
      if (a === b) continue
      const v = buildPar(p, a, b)
      for (const i of v.leitura) {
        if (i.simbolo === 'sem') continue
        for (const id of NUMEROS) {
          const l = v.linhas.find(x => x.id === id)
          const citado = new RegExp(`(: |, | e )${curto[id].replace(/[+×]/g, '\\$&')}(?= \\(|\\.|,| e |$)`).test(i.texto)
          if (citado) {
            expect(l, `${a}×${b} cita ${id}`).toBeDefined()
            expect(l!.lados[0].x != null && l!.lados[1].x != null, `${a}×${b} cita ${id} sem dado`).toBe(true)
          }
        }
      }
    }
  })
})
