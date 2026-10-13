// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerCurva, type PontoCurva } from '@/lib/youtube/observatorio/proprio/retencao-curva'

/** Curva a partir de uma lista de ratios, com t = (i + 1) / n (como a API: 0,01 a 1,00 para 100 pontos). */
function curva(ratios: number[], relative: Array<number | null> | number | null = null): PontoCurva[] {
  const n = ratios.length
  return ratios.map((ratio, i) => ({
    t: (i + 1) / n,
    ratio,
    relative: Array.isArray(relative) ? (relative[i] ?? null) : relative,
  }))
}

/** Plana em `base`, com um degrau de queda de `queda` entre os pontos `em` e `em + 5`. */
function comQueda(n: number, quedas: Array<{ em: number; queda: number }>): number[] {
  const r: number[] = []
  let atual = 0.9
  for (let i = 0; i < n; i++) {
    const q = quedas.find((x) => x.em === i)
    if (q) atual -= q.queda
    r.push(atual)
  }
  return r
}

describe('lerCurva: lista vazia e forma', () => {
  it('lista vazia devolve null', () => {
    expect(lerCurva([])).toBeNull()
  })

  it('um ponto só: lê, sem saídas, sem revistos, incompleta', () => {
    const l = lerCurva([{ t: 0.5, ratio: 0.8, relative: null }])
    expect(l).not.toBeNull()
    expect(l!.pontos).toBe(1)
    expect(l!.completa).toBe(false)
    expect(l!.meio).toBeNull()
    expect(l!.saidas).toEqual([])
    expect(l!.revistos).toEqual([])
    expect(l!.pico).toBe(0.8)
  })

  it('entrada fora de ordem lança (o leitor entrega ordenado)', () => {
    const pontos: PontoCurva[] = [
      { t: 0.2, ratio: 0.9, relative: null },
      { t: 0.1, ratio: 0.8, relative: null },
    ]
    expect(() => lerCurva(pontos)).toThrow()
  })

  it('t repetido lança', () => {
    const pontos: PontoCurva[] = [
      { t: 0.1, ratio: 0.9, relative: null },
      { t: 0.1, ratio: 0.8, relative: null },
    ]
    expect(() => lerCurva(pontos)).toThrow()
  })

  it('ponto sem valor (ratio nulo, NaN, Infinity) lança: nunca vira zero nem é interpolado', () => {
    const nulo = JSON.parse('[{"t":0.1,"ratio":0.9,"relative":null},{"t":0.2,"ratio":null,"relative":null}]') as PontoCurva[]
    expect(() => lerCurva(nulo)).toThrow()
    expect(() => lerCurva(curva([0.9, Number.NaN, 0.7]))).toThrow()
    expect(() => lerCurva(curva([0.9, Number.POSITIVE_INFINITY, 0.7]))).toThrow()
  })

  it('ratio negativo, t fora de 0..1 e relative inválido lançam', () => {
    expect(() => lerCurva([{ t: 0.1, ratio: -0.1, relative: null }])).toThrow()
    expect(() => lerCurva([{ t: 1.2, ratio: 0.5, relative: null }])).toThrow()
    expect(() => lerCurva([{ t: -0.1, ratio: 0.5, relative: null }])).toThrow()
    expect(() => lerCurva([{ t: 0.1, ratio: 0.5, relative: Number.NaN }])).toThrow()
  })
})

describe('lerCurva: pontos e completude (sem interpolar)', () => {
  it('37 pontos: conta 37, não é completa, não preenche', () => {
    const l = lerCurva(curva(Array.from({ length: 37 }, (_, i) => 1 - i * 0.01)))!
    expect(l.pontos).toBe(37)
    expect(l.completa).toBe(false)
  })

  it('100 pontos é completa; 99 e 101 não', () => {
    expect(lerCurva(curva(Array(100).fill(0.6)))!.completa).toBe(true)
    expect(lerCurva(curva(Array(99).fill(0.6)))!.completa).toBe(false)
    expect(lerCurva(curva(Array(101).fill(0.6).map((x, i) => x - i * 1e-4)))!.completa).toBe(false)
  })

  it('curva com buraco no t (37 pontos espalhados): as saídas usam os pontos que existem, com o t de cada um', () => {
    const t = Array.from({ length: 37 }, (_, i) => (i + 1) * 0.02)
    const r = Array.from({ length: 37 }, (_, i) => (i < 10 ? 0.9 : 0.4))
    const l = lerCurva(t.map((x, i) => ({ t: x, ratio: r[i]!, relative: null })))!
    expect(l.saidas).toHaveLength(1)
    expect(l.saidas[0]!.de).toBeCloseTo(t[5]!, 9)
    expect(l.saidas[0]!.ate).toBeCloseTo(t[10]!, 9)
  })
})

describe('lerCurva: meio', () => {
  it('nunca cruza 0,5: meio null', () => {
    expect(lerCurva(curva([1, 0.9, 0.8, 0.7, 0.6, 0.5]))!.meio).toBeNull()
  })

  it('exatamente 0,5 não cruza (é preciso ficar abaixo)', () => {
    expect(lerCurva(curva([0.6, 0.5, 0.5]))!.meio).toBeNull()
  })

  it('cruza no primeiro ponto: meio = primeiro t', () => {
    const p = curva([0.4, 0.3, 0.2])
    expect(lerCurva(p)!.meio).toBe(p[0]!.t)
  })

  it('cruza no meio da curva: o t do primeiro ponto abaixo de 0,5', () => {
    const p = curva([0.9, 0.7, 0.45, 0.6, 0.3])
    expect(lerCurva(p)!.meio).toBe(p[2]!.t)
  })

  it('volta a subir acima de 0,5 depois: vale o primeiro cruzamento', () => {
    const p = curva([0.9, 0.49, 0.8, 0.3])
    expect(lerCurva(p)!.meio).toBe(p[1]!.t)
  })
})

describe('lerCurva: maiores saídas', () => {
  it('duas quedas grandes a 30 pontos uma da outra: as duas, em ordem de posição', () => {
    const p = curva(comQueda(100, [{ em: 60, queda: 0.3 }, { em: 30, queda: 0.2 }]))
    const l = lerCurva(p)!
    // a queda entre i e i+5 é a mesma para qualquer i que cubra o degrau; a regra pega o primeiro por ordem estável
    expect(l.saidas).toHaveLength(2)
    expect(l.saidas[0]!.de).toBeLessThan(l.saidas[1]!.de)
    expect(l.saidas[0]!.ratioDe - l.saidas[0]!.ratioAte).toBeCloseTo(0.2, 9)
    expect(l.saidas[1]!.ratioDe - l.saidas[1]!.ratioAte).toBeCloseTo(0.3, 9)
  })

  it('duas quedas a 8 pontos uma da outra: só a maior, mais a seguinte que diste mais de 12', () => {
    const p = curva(comQueda(100, [{ em: 20, queda: 0.3 }, { em: 28, queda: 0.25 }, { em: 70, queda: 0.1 }]))
    const l = lerCurva(p)!
    expect(l.saidas).toHaveLength(2)
    const quedas = l.saidas.map((s) => +(s.ratioDe - s.ratioAte).toFixed(9))
    expect(quedas).toContain(0.3)
    expect(quedas).toContain(0.1)
    expect(quedas).not.toContain(0.25)
    expect(l.saidas[0]!.de).toBeLessThan(l.saidas[1]!.de)
  })

  it('distância de exatamente 12 pontos não basta (precisa de mais de 12); 13 basta', () => {
    // degrau de 0,3 em 10 (janelas i 5..9, a escolhida é i=5) e um mergulho de um ponto só em j (única janela i=j-5)
    const base = (j: number) => {
      const r = comQueda(40, [{ em: 10, queda: 0.3 }])
      r[j] = 0.4
      return r
    }
    const a = lerCurva(curva(base(22)))! // janela i=17, a 12 de i=5
    expect(a.saidas).toHaveLength(1)
    const b = lerCurva(curva(base(23)))! // janela i=18, a 13 de i=5
    expect(b.saidas).toHaveLength(2)
  })

  it('cada saída leva o t e o ratio dos pontos i e i+5', () => {
    const p = curva(comQueda(40, [{ em: 10, queda: 0.4 }]))
    const l = lerCurva(p)!
    expect(l.saidas).toHaveLength(1)
    const s = l.saidas[0]!
    const i = p.findIndex((x) => x.t === s.de)
    expect(i).toBeGreaterThanOrEqual(0)
    expect(p[i + 5]!.t).toBe(s.ate)
    expect(s.ratioDe).toBe(p[i]!.ratio)
    expect(s.ratioAte).toBe(p[i + 5]!.ratio)
  })

  it('curva que só sobe: sem saídas', () => {
    expect(lerCurva(curva(Array.from({ length: 40 }, (_, i) => 0.3 + i * 0.01)))!.saidas).toEqual([])
  })

  it('curva plana: sem saídas (queda zero não é saída)', () => {
    expect(lerCurva(curva(Array(40).fill(0.5)))!.saidas).toEqual([])
  })

  it('12 pontos: sem saídas e não completa, mesmo com queda grande', () => {
    const l = lerCurva(curva([0.9, 0.9, 0.9, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]))!
    expect(l.saidas).toEqual([])
    expect(l.completa).toBe(false)
  })

  it('13 pontos já podem ter saída', () => {
    const l = lerCurva(curva([0.9, 0.9, 0.9, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]))!
    expect(l.saidas.length).toBeGreaterThan(0)
  })

  it('no máximo duas, mesmo com três quedas separadas', () => {
    const l = lerCurva(curva(comQueda(100, [{ em: 10, queda: 0.1 }, { em: 40, queda: 0.15 }, { em: 80, queda: 0.12 }])))!
    expect(l.saidas).toHaveLength(2)
  })
})

describe('lerCurva: trechos revistos', () => {
  it('subida de 0,01 não é revisto', () => {
    expect(lerCurva(curva([0.5, 0.5, 0.51, 0.5]))!.revistos).toEqual([])
  })

  it('subida de 0,05 em três pontos: um revisto com de e ate certos', () => {
    const p = curva([0.6, 0.5, 0.52, 0.55, 0.4])
    const l = lerCurva(p)!
    expect(l.revistos).toEqual([{ de: p[1]!.t, ate: p[3]!.t }])
  })

  it('subida de exatamente 0,02 conta (0,02 ou mais), mesmo com ponto flutuante', () => {
    const p = curva([0.3, 0.1, 0.12, 0.05])
    expect(lerCurva(p)!.revistos).toEqual([{ de: p[1]!.t, ate: p[2]!.t }])
  })

  it('subida em degraus pequenos que somam 0,02 ou mais é um trecho só', () => {
    const p = curva([0.5, 0.4, 0.41, 0.42, 0.43, 0.3])
    expect(lerCurva(p)!.revistos).toEqual([{ de: p[1]!.t, ate: p[4]!.t }])
  })

  it('ponto igual ao anterior interrompe a sequência (sobe de um ponto ao seguinte)', () => {
    const p = curva([0.6, 0.5, 0.5, 0.51, 0.3])
    expect(lerCurva(p)!.revistos).toEqual([])
  })

  it('as três maiores, em ordem de posição', () => {
    const p = curva([
      0.9, 0.7, 0.75, // sobe 0,05 (índices 1-2)
      0.6, 0.7, // 0,10 (3-4)
      0.5, 0.52, // 0,02 (5-6)
      0.3, 0.45, // 0,15 (7-8)
      0.1,
    ])
    const l = lerCurva(p)!
    expect(l.revistos).toEqual([
      { de: p[1]!.t, ate: p[2]!.t },
      { de: p[3]!.t, ate: p[4]!.t },
      { de: p[7]!.t, ate: p[8]!.t },
    ])
  })

  it('curva que só desce: sem revistos', () => {
    expect(lerCurva(curva([0.9, 0.8, 0.7, 0.6]))!.revistos).toEqual([])
  })
})

describe('lerCurva: pico', () => {
  it('ratio 1,3 (replays): pico 1,3, sem corte', () => {
    expect(lerCurva(curva([1, 1.3, 0.8]))!.pico).toBe(1.3)
  })

  it('pico em curva normal é o primeiro ponto', () => {
    expect(lerCurva(curva([0.97, 0.7, 0.4]))!.pico).toBe(0.97)
  })

  it('ratio acima de 1 não quebra a leitura do meio nem das saídas', () => {
    const l = lerCurva(curva([1.4, 1.35, 1.3, 1.0, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]))!
    expect(l.pico).toBe(1.4)
    expect(l.meio).not.toBeNull()
    expect(Number.isFinite(l.saidas[0]!.ratioDe)).toBe(true)
  })
})

describe('lerCurva: relativa', () => {
  it('relative em 30 de 100 pontos: null (menos da metade)', () => {
    const rel = Array.from({ length: 100 }, (_, i) => (i < 30 ? 0.9 : null))
    expect(lerCurva(curva(Array(100).fill(0.5).map((x, i) => x - i * 1e-4), rel))!.relativa).toBeNull()
  })

  it('relative em exatamente metade dos pontos: lê (menos da metade é que anula)', () => {
    const rel = Array.from({ length: 10 }, (_, i) => (i < 5 ? 0.9 : null))
    expect(lerCurva(curva(Array(10).fill(0.5), rel))!.relativa).toBe('acima')
  })

  it('nenhum ponto com relative: null', () => {
    expect(lerCurva(curva([0.9, 0.8, 0.7]))!.relativa).toBeNull()
  })

  it('mediana 0,60: acima; 0,50: na-media; 0,40: abaixo', () => {
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.6))!.relativa).toBe('acima')
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.5))!.relativa).toBe('na-media')
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.4))!.relativa).toBe('abaixo')
  })

  it('fronteiras: 0,55 e 0,45 são na-media; logo acima/abaixo mudam', () => {
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.55))!.relativa).toBe('na-media')
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.56))!.relativa).toBe('acima')
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.45))!.relativa).toBe('na-media')
    expect(lerCurva(curva([0.9, 0.8, 0.7], 0.44))!.relativa).toBe('abaixo')
  })

  it('é a mediana, não a média: um ponto extremo não vira o veredito', () => {
    expect(lerCurva(curva([0.9, 0.8, 0.7, 0.6, 0.5], [0.5, 0.5, 0.5, 0.5, 5]))!.relativa).toBe('na-media')
  })

  it('mediana de quantidade par é a média dos dois do meio', () => {
    expect(lerCurva(curva([0.9, 0.8, 0.7, 0.6], [0.4, 0.5, 0.6, 0.9]))!.relativa).toBe('na-media') // (0,5+0,6)/2 = 0,55
    expect(lerCurva(curva([0.9, 0.8, 0.7, 0.6], [0.4, 0.5, 0.7, 0.9]))!.relativa).toBe('acima') // 0,6
  })

  it('relative nulo não vira zero: nulos ficam de fora da mediana', () => {
    // 3 de 5 pontos com 0,6; os 2 nulos, se virassem zero, derrubariam a mediana para abaixo
    expect(lerCurva(curva([0.9, 0.8, 0.7, 0.6, 0.5], [0.6, null, 0.6, null, 0.6]))!.relativa).toBe('acima')
  })
})

describe('lerCurva: curva real da C0.1 (canal do próprio dono)', () => {
  const fx = JSON.parse(
    readFileSync(join(__dirname, '..', 'coleta', 'fixtures', 'retencao', 'c01-vida-so2.json'), 'utf8'),
  ) as { resposta: { rows: number[][] } }
  const pontos: PontoCurva[] = fx.resposta.rows.map((r) => ({ t: r[0]!, ratio: r[1]!, relative: r[2] ?? null }))

  it('100 pontos, completa', () => {
    const l = lerCurva(pontos)!
    expect(l.pontos).toBe(100)
    expect(l.completa).toBe(true)
  })

  it('meio: o quarto ponto (t 0,04, ratio 0,4513), conferido à mão', () => {
    expect(pontos[3]).toEqual({ t: 0.04, ratio: 0.45130000000000003, relative: 0.56705 })
    expect(pontos[2]!.ratio).toBeGreaterThanOrEqual(0.5)
    expect(lerCurva(pontos)!.meio).toBe(0.04)
  })

  it('maiores saídas: as duas, nas posições conferidas à mão (queda de 5 pontos)', () => {
    const l = lerCurva(pontos)!
    expect(l.saidas).toHaveLength(2)
    // maior queda em 5 pontos: do 1.º ao 6.º (0,9735 -> 0,3940) = 0,5795
    expect(l.saidas[0]).toEqual({ de: 0.01, ate: 0.06, ratioDe: pontos[0]!.ratio, ratioAte: pontos[5]!.ratio })
    // a seguinte a mais de 12 pontos de distância
    expect(l.saidas[1]!.de - l.saidas[0]!.de).toBeGreaterThan(0.12)
  })

  it('pico é o primeiro ponto; relativa lida; nada não finito', () => {
    const l = lerCurva(pontos)!
    expect(l.pico).toBeCloseTo(0.9735, 9)
    expect(l.relativa).not.toBeNull()
    expect(l.revistos.length).toBeLessThanOrEqual(3)
    expect(JSON.stringify(l)).not.toMatch(/NaN|Infinity|null.*undefined/)
  })
})

describe('lerCurva: nenhuma saída não finita', () => {
  it('em formas variadas, todo número devolvido é finito', () => {
    const casos = [
      curva([1]),
      curva([0, 0, 0]),
      curva(Array(100).fill(0)),
      curva([1.3, 1.2, 1.1, 0.4, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05]),
    ]
    for (const c of casos) {
      const l = lerCurva(c)!
      const nums: number[] = [l.pontos, l.pico, ...(l.meio === null ? [] : [l.meio])]
      for (const s of l.saidas) nums.push(s.de, s.ate, s.ratioDe, s.ratioAte)
      for (const r of l.revistos) nums.push(r.de, r.ate)
      for (const n of nums) expect(Number.isFinite(n)).toBe(true)
    }
  })

  it('não altera a entrada', () => {
    const p = curva([0.9, 0.8, 0.85, 0.5])
    const antes = JSON.stringify(p)
    lerCurva(p)
    expect(JSON.stringify(p)).toBe(antes)
  })
})
