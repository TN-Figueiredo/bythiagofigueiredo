// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  curvaDe72Horas,
  marcosDoVideo,
  motivoSemHoras,
  REGRAS_DAS_72_HORAS,
  tracaoDoCanal,
  type CurvaDe72Horas,
  type VideoDaTracao,
} from '@/lib/youtube/observatorio/medidas-telas/tracao-72h'
import { CLASSE_DO_MOTIVO, FRASES_DAS_HORAS, fraseDasHorasSemBarra } from '@/lib/youtube/observatorio/medidas-telas/frases-das-horas'
import type { LeituraPorHora } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'

const H = 3_600_000
const M = 60_000
const PUB = Date.UTC(2026, 8, 1, 12, 0, 0) // publicado na hora cheia
const AGORA = PUB + 100 * H

/** Uma leitura por hora cheia + 2 min, de `de` a `ate` (inclusive), com o contador `f(h)`. */
function leituras(de: number, ate: number, f: (h: number) => number = (h) => h * 10, pular: number[] = []): LeituraPorHora[] {
  const out: LeituraPorHora[] = []
  for (let h = de; h <= ate; h++) {
    if (pular.includes(h)) continue
    out.push({ horaMs: PUB + h * H, lidaEmMs: PUB + h * H + 2 * M, views: f(h), likes: null, comments: null })
  }
  return out
}

describe('M14: curvaDe72Horas', () => {
  it('sem nenhuma leitura: primeiraContagem nula e total não medido, nenhum número vira zero', () => {
    const c = curvaDe72Horas([], PUB, AGORA)
    expect(c.primeiraContagem).toBeNull()
    expect(c.ultimaLeitura).toBeNull()
    expect(c.total72.estado).toBe('nao_medido')
    expect(c.horas.every((h) => h.tipo === 'nao_medido' && h.acumulado === null)).toBe(true)
  })

  it('hora com contagem e ganho zero é medida', () => {
    const c = curvaDe72Horas(leituras(0, 73, () => 500), PUB, AGORA)
    const h = c.horas[10]!
    expect(h.tipo).toBe('medido')
    if (h.tipo === 'medido') expect(h.ganho).toBe(0)
  })

  it('total das 72 horas para na última hora cheia e é o contador lido', () => {
    const c = curvaDe72Horas(leituras(0, 73), PUB, AGORA)
    expect(c.total72).toEqual({ estado: 'medido', valor: 710, n: 74 })
    expect(c.horasSemBarra).toBe(0)
  })

  it('a fração na hora k usa a última leitura com instante até publicação + k h', () => {
    const c = curvaDe72Horas(leituras(0, 73), PUB, AGORA)
    // leitura em 5h02 não conta para a borda de 5 h; a de 4h02 conta
    expect(c.horas[4]!.acumulado).toBe(40)
  })

  it('vídeo com menos de 72 horas: horas futuras ainda não existem e o total é ainda_nao_tem_72_horas', () => {
    const agora = PUB + 10 * H + 5 * M
    const c = curvaDe72Horas(leituras(0, 10), PUB, agora)
    expect(c.horas[20]!.tipo).toBe('ainda_nao_existe')
    expect(c.total72).toEqual({ estado: 'nao_medido', motivo: 'ainda_nao_tem_72_horas' })
  })

  it('hora sem contagem no meio: as duas horas são não medidas, sem barra, e o acumulado fecha', () => {
    const c = curvaDe72Horas(leituras(0, 73, undefined, [30]), PUB, AGORA)
    expect(c.horas[29]!.tipo).toBe('nao_medido')
    expect(c.horas[30]!.tipo).toBe('nao_medido')
    expect(c.horasSemBarra).toBe(2)
    expect(c.horas[31]!.acumulado).toBe(310)
    expect(c.total72.estado).toBe('medido')
  })

  it('leitura às hh:40 e a seguinte às hh:02: nenhuma das duas horas é barra medida', () => {
    const l = leituras(0, 73).filter((x) => x.horaMs !== PUB + 20 * H)
    l.push({ horaMs: PUB + 20 * H, lidaEmMs: PUB + 20 * H + 40 * M, views: 200, likes: null, comments: null })
    const c = curvaDe72Horas(l, PUB, AGORA)
    expect(c.horas[19]!.tipo).not.toBe('medido')
    expect(c.horas[20]!.tipo).not.toBe('medido')
  })

  it('duas leituras a 22 minutos: intervalo não limpo', () => {
    const l = [
      { horaMs: PUB, lidaEmMs: PUB + 2 * M, views: 1, likes: null, comments: null },
      { horaMs: PUB, lidaEmMs: PUB + 24 * M, views: 5, likes: null, comments: null },
      { horaMs: PUB + H, lidaEmMs: PUB + H + 2 * M, views: 9, likes: null, comments: null },
    ]
    const c = curvaDe72Horas(l, PUB, AGORA)
    expect(c.horas[0]!.tipo).toBe('nao_medido')
  })

  it('contador que recua: diminuiu, contado, nunca ganho negativo', () => {
    const c = curvaDe72Horas(leituras(0, 73, (h) => (h === 20 ? 100 : h * 10)), PUB, AGORA)
    expect(c.horas[19]!.tipo).toBe('diminuiu')
    expect(c.horasQueDiminuiram).toBe(1)
    expect(c.horas.some((h) => h.tipo === 'medido' && h.ganho < 0)).toBe(false)
  })

  it('ponta vazia: a última leitura na hora 60 traz ultimaLeitura, total não medido e nenhum número vira zero', () => {
    const c = curvaDe72Horas(leituras(1, 60), PUB, AGORA)
    expect(c.ultimaLeitura).toEqual({ k: 61, views: 600 })
    expect(c.total72).toEqual({ estado: 'nao_medido', motivo: 'sem_contagem_no_fim_das_72_horas' })
    expect(c.horasFinaisSemContagem).toBeGreaterThan(0)
    expect(fraseDasHorasSemBarra(c.horasSemBarra, false)).toBeNull()
  })

  it('a ponta é inclusiva: a 70 minutos da borda é medido; a 71, não', () => {
    const ate = (min: number): LeituraPorHora[] => [
      ...leituras(1, 70),
      { horaMs: PUB + 71 * H, lidaEmMs: PUB + 72 * H - min * M, views: 999, likes: null, comments: null },
    ]
    expect(curvaDe72Horas(ate(70), PUB, AGORA).total72.estado).toBe('medido')
    expect(curvaDe72Horas(ate(71), PUB, AGORA).total72.estado).toBe('nao_medido')
  })

  it('leitura depois da borda 72 não vira "última leitura até a borda"', () => {
    const c = curvaDe72Horas([...leituras(1, 60), ...leituras(73, 73)], PUB, AGORA)
    expect(c.total72).toEqual({ estado: 'nao_medido', motivo: 'sem_contagem_no_fim_das_72_horas' })
  })

  it('a constante da folga é igual à duração máxima de horaria/regra.ts', () => {
    const src = readFileSync('src/lib/youtube/horaria/regra.ts', 'utf8')
    const m = /DURACAO_MAX_MS\s*=\s*(\d+)\s*\*\s*MINUTO/.exec(src)
    expect(Number(m?.[1])).toBe(REGRAS_DAS_72_HORAS.FOLGA_DA_ULTIMA_LEITURA_MIN)
  })
})

describe('M14: marcos', () => {
  it('metade: a primeira hora em que o acumulado chega a 0,5 do total', () => {
    const m = marcosDoVideo(curvaDe72Horas(leituras(0, 73), PUB, AGORA))
    expect(m.metade).toMatchObject({ estado: 'medido', valor: 37 })
    expect(m.um_quarto).toMatchObject({ estado: 'medido', valor: 19 })
  })

  it('primeira contagem já com mais de 1/4: um quarto é ja_tinha_passado e a metade segue medida', () => {
    const l = leituras(8, 73, (h) => 120 + (h - 8) * 4)
    const m = marcosDoVideo(curvaDe72Horas(l, PUB, AGORA))
    expect(m.um_quarto).toMatchObject({ estado: 'nao_medido', motivo: 'ja_tinha_passado' })
    expect(m.metade.estado).toBe('medido')
  })

  it('sem total, os três marcos são não medidos com o mesmo motivo', () => {
    const m = marcosDoVideo(curvaDe72Horas(leituras(1, 60), PUB, AGORA))
    for (const x of Object.values(m)) expect(x).toEqual({ estado: 'nao_medido', motivo: 'sem_contagem_no_fim_das_72_horas' })
  })
})

describe('M14: tracaoDoCanal', () => {
  const video = (curva: CurvaDe72Horas, extra: Partial<VideoDaTracao> = {}): VideoDaTracao => ({
    curva,
    descobertoComHoras: 0,
    aoVivo: false,
    formato: 'long',
    publicadoEmMs: PUB,
    ...extra,
  })
  const boa = (): CurvaDe72Horas => curvaDe72Horas(leituras(0, 73), PUB, AGORA)
  const o = { formato: 'long' as const, agoraMs: AGORA }

  it('3 vídeos com as 72 horas medem o normal; 2 não, e o n vem escrito', () => {
    const tres = tracaoDoCanal([video(boa()), video(boa()), video(boa())], o)
    expect(tres.estado).toBe('medido')
    if (tres.estado === 'medido') expect(tres.valor.metade).toBe(37)
    const dois = tracaoDoCanal([video(boa()), video(boa())], o)
    expect(dois).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 2 })
  })

  it('descoberto com 6 horas entra; com 6 horas e 1 minuto fica fora e é contado', () => {
    const entra = tracaoDoCanal([video(boa()), video(boa()), video(boa(), { descobertoComHoras: 6 })], o)
    expect(entra.estado).toBe('medido')
    const fora = tracaoDoCanal([video(boa()), video(boa()), video(boa(), { descobertoComHoras: 6 + 1 / 60 })], o)
    expect(fora.fora.descobertoTarde).toBe(1)
    expect(fora.estado).toBe('nao_medido')
  })

  it('ao vivo fica fora e é contado; was_live nulo entra', () => {
    const r = tracaoDoCanal([video(boa()), video(boa()), video(boa(), { aoVivo: null }), video(boa(), { aoVivo: true })], o)
    expect(r.fora.aoVivo).toBe(1)
    expect(r.estado).toBe('medido')
  })

  it('exatamente 20% das horas sem contagem entra; uma a mais fica fora', () => {
    const semHoras = (n: number): CurvaDe72Horas => {
      const c = boa()
      return { ...c, horas: c.horas.map((h, i) => (i < n ? { ...h, tipo: 'nao_medido' as const, motivo: 'sem_contagem_nesta_hora' as const } : h)) }
    }
    const a = tracaoDoCanal([video(boa()), video(boa()), video(semHoras(14))], o)
    expect(a.estado).toBe('medido')
    const b = tracaoDoCanal([video(boa()), video(boa()), video(semHoras(15))], o)
    expect(b.fora.incompletos).toBe(1)
  })

  it('vídeo com total não medido fica fora e é contado como incompleto', () => {
    const r = tracaoDoCanal([video(boa()), video(boa()), video(boa()), video(curvaDe72Horas(leituras(1, 60), PUB, AGORA))], o)
    expect(r.fora.incompletos).toBe(1)
    expect(r.estado).toBe('medido')
  })

  it('só os últimos 90 dias e só o formato pedido', () => {
    const velho = video(boa(), { publicadoEmMs: AGORA - 91 * 24 * H })
    const curto = video(boa(), { formato: 'short' })
    const r = tracaoDoCanal([video(boa()), video(boa()), velho, curto], o)
    expect(r).toMatchObject({ estado: 'nao_medido', n: 2 })
  })
})

describe('M14: motivoSemHoras, em ordem', () => {
  const v = { publicadoEmMs: PUB, descobertoEmMs: PUB + H }
  it('nenhuma linha no site', () => expect(motivoSemHoras(v, { primeiraHoraDoSiteMs: null })).toBe('leitura_por_hora_nao_comecou'))
  it('publicado antes da primeira hora do site', () =>
    expect(motivoSemHoras(v, { primeiraHoraDoSiteMs: PUB + H })).toBe('publicado_antes_da_leitura_por_hora'))
  it('descoberto depois das 72 horas', () =>
    expect(motivoSemHoras({ ...v, descobertoEmMs: PUB + 76 * H }, { primeiraHoraDoSiteMs: PUB })).toBe('entrou_tarde'))
  it('senão, sem contagem nas 72 horas', () => expect(motivoSemHoras(v, { primeiraHoraDoSiteMs: PUB })).toBe('sem_contagem_nas_72_horas'))
})

describe('frases das horas', () => {
  it('todo motivo tem classe e frase; falhou e parada são "não carregou"', () => {
    for (const k of Object.keys(FRASES_DAS_HORAS) as Array<keyof typeof FRASES_DAS_HORAS>) {
      const f = FRASES_DAS_HORAS[k]({ n: 1, k: 60, views: 1200 })
      expect(f.curta.length).toBeGreaterThan(0)
      expect(f.longa.length).toBeGreaterThan(0)
      expect(CLASSE_DO_MOTIVO[k]).toBeDefined()
    }
    expect(CLASSE_DO_MOTIVO.leitura_falhou).toBe('nao_carregou')
  })
  it('a ponta vazia diz a hora e as views; "poucos vídeos" diz o hoje', () => {
    expect(FRASES_DAS_HORAS.sem_contagem_no_fim_das_72_horas({ k: 60, views: 1200 }).longa).toBe(
      'não medido: a leitura por hora parou na hora 60, com 1.200 views até ali; o total das 72 horas não foi lido',
    )
    expect(FRASES_DAS_HORAS.poucos_videos({ n: 1 }).longa).toBe('menos de 3 vídeos com as 72 primeiras horas acompanhadas (hoje 1).')
  })
  it('"horas sem barra" só com total lido', () => {
    expect(fraseDasHorasSemBarra(2, true)).toBe('2 horas sem barra: o ganho delas está no total, não nas barras')
    expect(fraseDasHorasSemBarra(2, false)).toBeNull()
    expect(fraseDasHorasSemBarra(0, true)).toBeNull()
  })
})
