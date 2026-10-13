// @vitest-environment node
// A regra pura do intervalo da leitura horária (A5 E16, Tarefa 14, parte 2 adiantada). Sem banco, sem rede,
// sem relógio: tudo entra por parâmetro. As datas são em horário de São Paulo (UTC-3, sem verão desde 2019).
import { describe, it, expect } from 'vitest'
import {
  RULE_VERSION,
  fatiaDoDia,
  intervalos,
  type Intervalo,
  type Leitura,
} from '@/lib/youtube/horaria/regra'

const MIN = 60_000
const H = 60 * MIN
const D = 24 * H

/** Instante a partir de uma hora de parede de São Paulo. */
const sp = (iso: string): number => Date.parse(`${iso}-03:00`)

// 2026-10-11 é domingo.
const DOMINGO_00 = sp('2026-10-11T00:00:00')
const PUBLICADO = DOMINGO_00 - 30 * D // vídeo velho demais para qualquer fase, salvo quando o teste muda isso

const leitura = (
  takenAt: number,
  views: number,
  likes: number | null = 0,
  comments: number | null = 0,
): Leitura => ({ takenAt, views, likes, comments })

/** Série horária limpa: uma leitura por hora cheia + 1 minuto, com `views` crescendo `passo` por hora. */
function serieLimpa(inicio: number, horas: number, passo = 10, base = 100): Leitura[] {
  const out: Leitura[] = []
  for (let i = 0; i <= horas; i++) out.push(leitura(inicio + i * H + MIN, base + i * passo, 5 * i, i))
  return out
}

describe('RULE_VERSION', () => {
  it('é 1', () => {
    expect(RULE_VERSION).toBe(1)
  })
})

describe('intervalos: entradas pequenas', () => {
  it('leituras vazias e uma leitura só: nenhum intervalo', () => {
    expect(intervalos([], PUBLICADO)).toEqual([])
    expect(intervalos([leitura(DOMINGO_00, 10)], PUBLICADO)).toEqual([])
  })

  it('duas leituras dão um intervalo, com início, fim e diferenças', () => {
    const r = intervalos([leitura(DOMINGO_00, 100, 10, 1), leitura(DOMINGO_00 + H, 130, 14, 3)], PUBLICADO)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      inicio: DOMINGO_00,
      fim: DOMINGO_00 + H,
      limpo: true,
      casa: 0,
      d: { views: 30, likes: 4, comments: 2 },
    })
  })

  it('leituras fora de ordem são ordenadas e a entrada não é alterada', () => {
    const a = leitura(DOMINGO_00, 100)
    const b = leitura(DOMINGO_00 + H, 110)
    const c = leitura(DOMINGO_00 + 2 * H, 125)
    const entrada = [c, a, b]
    const r = intervalos(entrada, PUBLICADO)
    expect(r.map((i) => [i.inicio, i.fim])).toEqual([
      [DOMINGO_00, DOMINGO_00 + H],
      [DOMINGO_00 + H, DOMINGO_00 + 2 * H],
    ])
    expect(entrada).toEqual([c, a, b])
  })
})

describe('intervalos: o que é limpo', () => {
  const par = (inicio: number, minutos: number) =>
    intervalos([leitura(inicio, 0), leitura(inicio + minutos * MIN, 5)], PUBLICADO)[0] as Intervalo

  it('50 e 70 minutos são limpos, 49 e 71 não', () => {
    expect(par(DOMINGO_00, 50).limpo).toBe(true)
    expect(par(DOMINGO_00, 70).limpo).toBe(true)
    expect(par(DOMINGO_00, 49).limpo).toBe(false)
    expect(par(DOMINGO_00, 71).limpo).toBe(false)
    expect(par(DOMINGO_00, 49).casa).toBeNull()
    expect(par(DOMINGO_00, 71).casa).toBeNull()
  })

  it('a fronteira é exata ao milissegundo', () => {
    const mk = (ms: number) =>
      intervalos([leitura(DOMINGO_00, 0), leitura(DOMINGO_00 + ms, 1)], PUBLICADO)[0] as Intervalo
    expect(mk(50 * MIN - 1).limpo).toBe(false)
    expect(mk(50 * MIN).limpo).toBe(true)
    expect(mk(70 * MIN).limpo).toBe(true)
    expect(mk(70 * MIN + 1).limpo).toBe(false)
  })

  it('começo a 5 minutos da hora cheia é limpo; a 6 minutos não é', () => {
    expect(par(DOMINGO_00 + 5 * MIN, 60).limpo).toBe(true)
    expect(par(DOMINGO_00 + 5 * MIN + 1, 60).limpo).toBe(false)
    expect(par(DOMINGO_00 + 6 * MIN, 60).limpo).toBe(false)
    expect(par(DOMINGO_00 + 6 * MIN, 60).casa).toBeNull()
  })

  it('começar antes da hora cheia (minuto 59) não é limpo', () => {
    expect(par(DOMINGO_00 - MIN, 60).limpo).toBe(false)
  })

  it('buraco de 2 horas é um intervalo longo, sem casa, nunca dividido', () => {
    const r = intervalos(
      [leitura(DOMINGO_00, 100), leitura(DOMINGO_00 + H, 110), leitura(DOMINGO_00 + 3 * H, 150), leitura(DOMINGO_00 + 4 * H, 160)],
      PUBLICADO,
    )
    expect(r).toHaveLength(3)
    expect(r[1]).toMatchObject({ inicio: DOMINGO_00 + H, fim: DOMINGO_00 + 3 * H, limpo: false, casa: null })
    expect(r[1]?.d.views).toBe(40) // a diferença inteira fica num intervalo só
    expect(r[0]?.limpo).toBe(true)
    expect(r[2]?.limpo).toBe(true)
  })

  it('leitura repetida na mesma hora (minuto 0 e minuto 20) deixa dois intervalos não limpos', () => {
    const r = intervalos(
      [leitura(DOMINGO_00, 100), leitura(DOMINGO_00 + 20 * MIN, 104), leitura(DOMINGO_00 + H, 112)],
      PUBLICADO,
    )
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ limpo: false, casa: null })
    expect(r[1]).toMatchObject({ limpo: false, casa: null }) // 40 minutos
    expect(r[0]?.d.views).toBe(4)
    expect(r[1]?.d.views).toBe(8)
  })

  it('duas leituras no mesmo instante: intervalo de duração zero, não limpo, sem casa, diferença 0', () => {
    const r = intervalos([leitura(DOMINGO_00, 100), leitura(DOMINGO_00, 100), leitura(DOMINGO_00 + H, 120)], PUBLICADO)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ inicio: DOMINGO_00, fim: DOMINGO_00, limpo: false, casa: null, d: { views: 0 } })
    expect(r[1]).toMatchObject({ limpo: true, casa: 0, d: { views: 20 } })
  })
})

describe('intervalos: diferenças', () => {
  it('diferença negativa não vira zero e a hora seguinte não a absorve', () => {
    const r = intervalos(
      [leitura(DOMINGO_00, 100, 10, 5), leitura(DOMINGO_00 + H, 95, 9, 4), leitura(DOMINGO_00 + 2 * H, 110, 12, 6)],
      PUBLICADO,
    )
    expect(r[0]?.d).toEqual({ views: -5, likes: -1, comments: -1 })
    // a hora seguinte é a diferença própria (110 - 95), não 110 - 100
    expect(r[1]?.d).toEqual({ views: 15, likes: 3, comments: 2 })
    expect(r[0]?.limpo).toBe(true)
  })

  it('curtidas ocultas num dos lados dão diferença nula, não zero', () => {
    const r = intervalos(
      [leitura(DOMINGO_00, 100, null, 1), leitura(DOMINGO_00 + H, 110, 7, 2), leitura(DOMINGO_00 + 2 * H, 120, null, 3)],
      PUBLICADO,
    )
    expect(r[0]?.d.likes).toBeNull()
    expect(r[1]?.d.likes).toBeNull()
    expect(r[0]?.d.views).toBe(10)
    expect(r[0]?.d.comments).toBe(1)
  })

  it('comentários nulos dos dois lados também dão nulo', () => {
    const r = intervalos([leitura(DOMINGO_00, 1, 1, null), leitura(DOMINGO_00 + H, 2, 2, null)], PUBLICADO)
    expect(r[0]?.d.comments).toBeNull()
    expect(r[0]?.d.likes).toBe(1)
  })

  it('o nulo no meio de uma série contamina só os dois intervalos vizinhos', () => {
    const r = intervalos(
      [
        leitura(DOMINGO_00, 10, 1, 1),
        leitura(DOMINGO_00 + H, 20, 2, 2),
        leitura(DOMINGO_00 + 2 * H, 30, null, 3),
        leitura(DOMINGO_00 + 3 * H, 40, 4, 4),
        leitura(DOMINGO_00 + 4 * H, 50, 5, 5),
      ],
      PUBLICADO,
    )
    expect(r.map((i) => i.d.likes)).toEqual([1, null, null, 1])
    expect(r.map((i) => i.d.views)).toEqual([10, 10, 10, 10])
  })
})

describe('intervalos: fase', () => {
  const fase = (idadeMs: number, duracao = H) => {
    const inicio = DOMINGO_00
    return intervalos([leitura(inicio, 0), leitura(inicio + duracao, 1)], inicio - idadeMs)[0]?.fase
  }

  it('vídeo de 2 dias é lancamento, de 5 dias é depois, de 15 dias é nulo', () => {
    expect(fase(2 * D)).toBe('lancamento')
    expect(fase(5 * D)).toBe('depois')
    expect(fase(15 * D)).toBeNull()
  })

  it('as fronteiras: 72 h ainda é lancamento, 72 h e 1 ms é depois; 14 dias ainda é depois, depois disso nulo', () => {
    expect(fase(72 * H)).toBe('lancamento')
    expect(fase(72 * H + 1)).toBe('depois')
    expect(fase(14 * D)).toBe('depois')
    expect(fase(14 * D + 1)).toBeNull()
    expect(fase(0)).toBe('lancamento')
  })

  it('início antes da publicação (idade negativa) não tem fase', () => {
    expect(fase(-1)).toBeNull()
  })

  it('a fase vale também para intervalo longo, pela idade no começo', () => {
    expect(fase(71 * H, 5 * H)).toBe('lancamento')
  })

  it('nenhum intervalo tem duas fases: a fase é a do começo, mesmo cruzando as 72 h', () => {
    const publicado = DOMINGO_00 - 71 * H - 30 * MIN
    const leituras = serieLimpa(DOMINGO_00, 4) // cruza as 72 h de idade na hora 1
    const r = intervalos(leituras, publicado)
    for (const i of r) expect(['lancamento', 'depois', null]).toContain(i.fase)
    expect(r.map((i) => i.fase)).toEqual(['lancamento', 'depois', 'depois', 'depois'])
  })
})

describe('intervalos: a casa', () => {
  it('a casa é a hora de São Paulo em que o intervalo começou (domingo 23:00 -> 23; segunda 00:00 -> 24)', () => {
    const r = intervalos(
      [
        leitura(sp('2026-10-11T23:00:00'), 1),
        leitura(sp('2026-10-12T00:00:00'), 2),
        leitura(sp('2026-10-12T01:00:00'), 3),
      ],
      PUBLICADO,
    )
    expect(r.map((i) => i.casa)).toEqual([23, 24])
  })

  it('o último intervalo da semana (sábado 23:00) é a casa 167', () => {
    const r = intervalos([leitura(sp('2026-10-17T23:00:00'), 1), leitura(sp('2026-10-18T00:00:00'), 2)], PUBLICADO)
    expect(r[0]?.casa).toBe(167)
  })

  it('a hora é a de São Paulo, não a de UTC: domingo 22:00 UTC é 19:00 em São Paulo (casa 19)', () => {
    const inicio = Date.UTC(2026, 9, 11, 22, 0, 0) // 19:00 em São Paulo
    const r = intervalos([leitura(inicio, 1), leitura(inicio + H, 2)], PUBLICADO)
    expect(r[0]?.casa).toBe(19)
  })

  it('o início a até 5 minutos da hora cheia cai na hora cheia anterior (00:04 -> casa 24)', () => {
    const r = intervalos([leitura(sp('2026-10-12T00:04:00'), 1), leitura(sp('2026-10-12T01:04:00'), 2)], PUBLICADO)
    expect(r[0]?.casa).toBe(24)
  })
})

/** 24 intervalos limpos de um dia (domingo), cada um com `d.views = vs[i]`. */
function diaLimpo(vs: readonly number[], opcoes: { likes?: (number | null)[] } = {}): Intervalo[] {
  const leituras: Leitura[] = []
  let acc = 1000
  for (let i = 0; i <= 24; i++) {
    leituras.push(leitura(DOMINGO_00 + i * H + MIN, acc, 0, 0))
    acc += vs[i] ?? 0
  }
  const todos = intervalos(leituras, PUBLICADO)
  const dia = todos.slice(0, 24)
  if (opcoes.likes) dia.forEach((iv, i) => (iv.d.likes = opcoes.likes?.[i] ?? 0))
  return dia
}

describe('fatiaDoDia', () => {
  const vs = Array.from({ length: 24 }, (_, i) => i + 1) // soma 300

  it('a fatia tem 24 posições, soma 1 (±0,001) e respeita a hora', () => {
    const f = fatiaDoDia(diaLimpo(vs), 'views', 200)
    expect(f).not.toBeNull()
    expect(f).toHaveLength(24)
    expect((f ?? []).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3)
    expect(f?.[0]).toBeCloseTo(1 / 300, 6)
    expect(f?.[23]).toBeCloseTo(24 / 300, 6)
  })

  it('a ordem do dia na entrada não importa: a posição vem da casa', () => {
    const dia = diaLimpo(vs).reverse()
    const f = fatiaDoDia(dia, 'views', 200)
    expect(f?.[0]).toBeCloseTo(1 / 300, 6)
    expect(f?.[23]).toBeCloseTo(24 / 300, 6)
  })

  it('o mínimo é inclusivo: soma igual ao mínimo tem fatia, uma a menos não', () => {
    expect(fatiaDoDia(diaLimpo(vs), 'views', 300)).not.toBeNull()
    expect(fatiaDoDia(diaLimpo(vs), 'views', 301)).toBeNull()
  })

  it('dia abaixo do mínimo não tem fatia', () => {
    expect(fatiaDoDia(diaLimpo(vs), 'views', 1000)).toBeNull()
  })

  it('dia com intervalo longo não tem fatia', () => {
    const dia = diaLimpo(vs)
    const longo = { ...(dia[5] as Intervalo), limpo: false, casa: null }
    expect(fatiaDoDia([...dia.slice(0, 5), longo, ...dia.slice(6)], 'views', 1)).toBeNull()
  })

  it('dia com menos de 24 intervalos, ou com 25, não tem fatia', () => {
    const dia = diaLimpo(vs)
    expect(fatiaDoDia(dia.slice(0, 23), 'views', 1)).toBeNull()
    expect(fatiaDoDia([...dia, dia[0] as Intervalo], 'views', 1)).toBeNull()
    expect(fatiaDoDia([], 'views', 1)).toBeNull()
  })

  it('24 intervalos que repetem uma hora (e faltam outra) não têm fatia', () => {
    const dia = diaLimpo(vs)
    const repetido = [...dia.slice(0, 23), dia[0] as Intervalo]
    expect(fatiaDoDia(repetido, 'views', 1)).toBeNull()
  })

  it('dia com queda não tem fatia daquele contador, e tem dos outros', () => {
    const dia = diaLimpo(vs)
    for (const iv of dia) {
      iv.d.likes = 5
      iv.d.comments = 3
    }
    ;(dia[10] as Intervalo).d.likes = -2
    expect(fatiaDoDia(dia, 'likes', 1)).toBeNull()
    expect(fatiaDoDia(dia, 'views', 1)).not.toBeNull()
    expect(fatiaDoDia(dia, 'comments', 1)).not.toBeNull()
  })

  it('diferença nula (oculto) em um intervalo derruba só aquele contador', () => {
    const dia = diaLimpo(vs, { likes: Array.from({ length: 24 }, () => 5) })
    ;(dia[3] as Intervalo).d.likes = null
    expect(fatiaDoDia(dia, 'likes', 1)).toBeNull()
    expect(fatiaDoDia(dia, 'views', 1)).not.toBeNull()
  })

  it('diferença zero é válida; todas zero com mínimo 0 não divide por zero e não tem fatia', () => {
    const umaSo = Array.from({ length: 24 }, (_, i) => (i === 7 ? 40 : 0))
    const f = fatiaDoDia(diaLimpo(umaSo), 'views', 10)
    expect(f?.[7]).toBe(1)
    expect(f?.filter((x) => x === 0)).toHaveLength(23)
    expect(fatiaDoDia(diaLimpo(Array.from({ length: 24 }, () => 0)), 'views', 0)).toBeNull()
  })

  it('misturar dias da semana na mesma lista não é um dia', () => {
    const dia = diaLimpo(vs)
    const outro = diaLimpo(vs).map((iv) => ({ ...iv, casa: (iv.casa ?? 0) + 24 }))
    expect(fatiaDoDia([...dia.slice(0, 12), ...outro.slice(12)], 'views', 1)).toBeNull()
  })
})
