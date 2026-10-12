// @vitest-environment node
// % assistido: média do percentual de cada dia pesada pelas views do dia (28 dias), o normal da faixa de duração e a régua
// "na média = até 2 pontos". A unidade de avg_view_percentage é PONTOS de 0 a 100 (a Analytics API entrega 51,5, não 0,515):
// a prova de que o leitor não reescala está em proprio-ler.test.ts ("contrato da unidade de avg_view_percentage").
import { describe, it, expect } from 'vitest'
import {
  assistidoDoVideo, normalDaFaixa, contraNormal, faixaDaDuracao, medianaDe,
  JANELA_ASSISTIDO_DIAS, POUCAS_VIEWS, MIN_VIDEOS_FAIXA, NA_MEDIA_PONTOS, FAIXAS,
} from '@/lib/youtube/observatorio/proprio/assistido'
import type { DiarioCanal, DiarioLinha, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const ULT = '2026-10-10'
const d = (n: number) => addDays(ULT, -n)
const l = (ytId: string, n: number, views: number | null, pct: number | null, dur: number | null = null): DiarioLinha =>
  ({ ytId, dia: d(n), views, pctAssistido: pct, duracaoMediaSeg: dur })
const canal = (linhas: DiarioLinha[], ultimoDia: string | null = ULT): Privado<DiarioCanal> =>
  ({ acesso: 'ok', dado: { canalId: 'c', ultimoDia, linhas, descartados: 0 } })

describe('constantes do brief', () => {
  it('janela de 28 dias, poucas views abaixo de 10, faixa normal a partir de 5 vídeos, na média até 2 pontos', () => {
    expect(JANELA_ASSISTIDO_DIAS).toBe(28)
    expect(POUCAS_VIEWS).toBe(10)
    expect(MIN_VIDEOS_FAIXA).toBe(5)
    expect(NA_MEDIA_PONTOS).toBe(2)
  })
})

describe('assistidoDoVideo: média pesada pelas views', () => {
  it('pesa pelas views do dia: 100 views a 60 e 10 views a 30 = 56,36 (não 45, a média simples)', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 100, 60), l('v', 2, 10, 30)]), 'v')
    expect(r.pct).toBeCloseTo((100 * 60 + 10 * 30) / 110, 10)
    expect(r.pct).not.toBeCloseTo(45, 1)
    expect(r.n).toBe(110)
    expect(r.dias).toBe(2)
    expect(r.motivo).toBeNull()
  })
  it('a unidade são pontos de 0 a 100: 51,5 de entrada sai 51,5, sem reescala', () => {
    expect(assistidoDoVideo(canal([l('v', 1, 40, 51.5)]), 'v').pct).toBe(51.5)
  })
  it('um dia de 0 views no meio não entra: nem na soma, nem no peso, nem na contagem de dias (e o pct nulo dele não derruba)', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 20, 50), l('v', 2, 0, null), l('v', 3, 20, 70)]), 'v')
    expect(r.pct).toBe(60)
    expect(r.n).toBe(40)
    expect(r.dias).toBe(2)
  })
  it('dia com views 0 mas pct preenchido (dado legado) também não entra', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 0, 90), l('v', 2, 10, 40)]), 'v')
    expect(r.pct).toBe(40)
    expect(r.n).toBe(10)
    expect(r.dias).toBe(1)
  })
  it('dia com views mas pct nulo (não medido) fica de fora da base: não vira 0% e não pesa', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 100, null), l('v', 2, 10, 40)]), 'v')
    expect(r.pct).toBe(40)
    expect(r.n).toBe(10)
  })
  it('dia com views nulas (não medido) fica de fora', () => {
    const r = assistidoDoVideo(canal([l('v', 1, null, 80), l('v', 2, 10, 40)]), 'v')
    expect(r.pct).toBe(40)
    expect(r.n).toBe(10)
  })
  it('dia sem linha simplesmente não existe: o resultado só olha os dias que vieram', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 10, 40), l('v', 20, 30, 80)]), 'v')
    expect(r.pct).toBe((10 * 40 + 30 * 80) / 40)
    expect(r.dias).toBe(2)
  })
  it('pct 0 com views é ZERO medido (ninguém passou do começo), não ausente', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 5, 0), l('v', 2, 5, 20)]), 'v')
    expect(r.pct).toBe(10)
    expect(r.dias).toBe(2)
  })
  it('só olha o vídeo pedido', () => {
    const r = assistidoDoVideo(canal([l('v', 1, 10, 40), l('w', 1, 1000, 90)]), 'v')
    expect(r.pct).toBe(40)
    expect(r.n).toBe(10)
  })
})

describe('assistidoDoVideo: janela de 28 dias que termina no último dia gravado do canal', () => {
  it('o dia -27 entra (28º dia) e o -28 não', () => {
    const r = assistidoDoVideo(canal([l('v', 27, 10, 80), l('v', 28, 1000, 0)]), 'v')
    expect(r.pct).toBe(80)
    expect(r.n).toBe(10)
    expect(r.janela).toEqual({ de: d(27), ate: ULT })
  })
  it('linha depois do último dia não conta (a janela termina no último dia gravado)', () => {
    expect(assistidoDoVideo(canal([l('v', -1, 500, 10), l('v', 0, 10, 50)]), 'v').n).toBe(10)
  })
})

describe('assistidoDoVideo: poucas views', () => {
  it('9 views é pouco; 10 views não é (limite em 10)', () => {
    expect(assistidoDoVideo(canal([l('v', 1, 9, 50)]), 'v')).toMatchObject({ n: 9, pouco: true, pct: 50 })
    expect(assistidoDoVideo(canal([l('v', 1, 10, 50)]), 'v')).toMatchObject({ n: 10, pouco: false, pct: 50 })
  })
  it('9 views somadas em dois dias (4 + 5) é pouco; 10 (5 + 5) não', () => {
    expect(assistidoDoVideo(canal([l('v', 1, 4, 50), l('v', 2, 5, 50)]), 'v').pouco).toBe(true)
    expect(assistidoDoVideo(canal([l('v', 1, 5, 50), l('v', 2, 5, 50)]), 'v').pouco).toBe(false)
  })
})

describe('assistidoDoVideo: sem número, com o motivo (nunca zero)', () => {
  const vazio = { pct: null, n: 0, pouco: false, dias: 0, janela: null }
  it('quem não edita o site: sem-acesso e nenhum número', () => {
    expect(assistidoDoVideo({ acesso: 'negado' }, 'v')).toEqual({ ...vazio, motivo: 'sem-acesso' })
  })
  it('leitura que falhou: leitura-falhou', () => {
    expect(assistidoDoVideo({ acesso: 'erro' }, 'v')).toEqual({ ...vazio, motivo: 'leitura-falhou' })
  })
  it('canal sem nenhum dia gravado: sem-diario', () => {
    expect(assistidoDoVideo(canal([], null), 'v')).toEqual({ ...vazio, motivo: 'sem-diario' })
  })
  it('sem view nos 28 dias (só zeros): sem-views, pct null, n 0', () => {
    expect(assistidoDoVideo(canal([l('v', 1, 0, null), l('v', 2, 0, null)]), 'v')).toEqual({ ...vazio, motivo: 'sem-views', janela: { de: d(27), ate: ULT } })
  })
  it('vídeo sem nenhuma linha no diário: sem-views', () => {
    expect(assistidoDoVideo(canal([l('w', 1, 50, 50)]), 'v')).toMatchObject({ pct: null, n: 0, motivo: 'sem-views' })
  })
  it('views fora da janela não valem: sem-views', () => {
    expect(assistidoDoVideo(canal([l('v', 40, 500, 50)]), 'v')).toMatchObject({ pct: null, motivo: 'sem-views' })
  })
  it('o resultado de quem não tem o token não carrega número nenhum (serializado)', () => {
    const j = JSON.stringify(assistidoDoVideo({ acesso: 'negado' }, 'v'))
    expect(j).toBe('{"pct":null,"n":0,"pouco":false,"dias":0,"janela":null,"motivo":"sem-acesso"}')
  })
})

describe('faixaDaDuracao', () => {
  it('até 5 min (inclusive 300 s), de 5 a 15 min (301 a 900 s) e acima de 15 min', () => {
    expect(faixaDaDuracao(0)).toBe('ate-5')
    expect(faixaDaDuracao(300)).toBe('ate-5')
    expect(faixaDaDuracao(301)).toBe('5-a-15')
    expect(faixaDaDuracao(900)).toBe('5-a-15')
    expect(faixaDaDuracao(901)).toBe('acima-15')
    expect(faixaDaDuracao(7200)).toBe('acima-15')
  })
  it('sem duração (nula, negativa, NaN): sem faixa, nunca "até 5 min"', () => {
    expect(faixaDaDuracao(null)).toBeNull()
    expect(faixaDaDuracao(-1)).toBeNull()
    expect(faixaDaDuracao(Number.NaN)).toBeNull()
  })
  it('as três faixas têm o rótulo do mockup', () => {
    expect(FAIXAS.map(f => f.rotulo)).toEqual(['Até 5 min', '5 a 15 min', 'Acima de 15 min'])
  })
})

describe('medianaDe', () => {
  it('vazio é null; ímpar é o do meio; par é a média dos dois do meio; não é a média simples', () => {
    expect(medianaDe([])).toBeNull()
    expect(medianaDe([7])).toBe(7)
    expect(medianaDe([3, 1, 2])).toBe(2)
    expect(medianaDe([4, 1, 2, 3])).toBe(2.5)
    expect(medianaDe([1, 2, 100])).toBe(2)
  })
})

describe('normalDaFaixa', () => {
  const v = (dur: number | null, pct: number | null) => ({ dur, pct })
  const cinco = (dur: number, pcts: number[]) => pcts.map(p => v(dur, p))
  it('sempre devolve as três faixas, na ordem', () => {
    expect(normalDaFaixa([]).map(f => f.faixa)).toEqual(['ate-5', '5-a-15', 'acima-15'])
  })
  it('4 vídeos com views na faixa: sem normal (precisa de 5); 5: com normal', () => {
    const quatro = normalDaFaixa(cinco(600, [40, 50, 60, 70]))
    expect(quatro[1]).toEqual({ faixa: '5-a-15', videos: 4, comViews: 4, normal: null })
    const cincoV = normalDaFaixa(cinco(600, [40, 50, 60, 70, 80]))
    expect(cincoV[1]).toEqual({ faixa: '5-a-15', videos: 5, comViews: 5, normal: 60 })
  })
  it('a mediana, não a média: 1, 2, 100, 3, 4 = 3', () => {
    expect(normalDaFaixa(cinco(600, [1, 2, 100, 3, 4]))[1]!.normal).toBe(3)
  })
  it('vídeo sem views (pct nulo) não conta para os 5: 4 com views + 3 sem = sem normal', () => {
    const r = normalDaFaixa([...cinco(600, [40, 50, 60, 70]), v(600, null), v(600, null), v(600, null)])
    expect(r[1]).toEqual({ faixa: '5-a-15', videos: 7, comViews: 4, normal: null })
  })
  it('cada vídeo só entra na sua faixa; vídeo sem duração não entra em nenhuma', () => {
    const r = normalDaFaixa([...cinco(200, [10, 20, 30, 40, 50]), ...cinco(1200, [60, 70, 80, 90, 100]), v(null, 99)])
    expect(r.map(f => [f.videos, f.normal])).toEqual([[5, 30], [0, null], [5, 80]])
  })
  it('as fronteiras: 300 s cai na primeira, 301 na segunda, 900 na segunda, 901 na terceira', () => {
    const r = normalDaFaixa([v(300, 1), v(301, 2), v(900, 3), v(901, 4)])
    expect(r.map(f => f.videos)).toEqual([1, 2, 1])
  })
  it('faixa vazia: 0 vídeos, sem normal', () => {
    expect(normalDaFaixa([])[0]).toEqual({ faixa: 'ate-5', videos: 0, comViews: 0, normal: null })
  })
  it('pct 0 medido conta como vídeo com views (zero medido não é ausente)', () => {
    expect(normalDaFaixa(cinco(600, [0, 0, 0, 0, 10]))[1]).toMatchObject({ comViews: 5, normal: 0 })
  })
})

describe('contraNormal: na média = até 2 pontos, em pontos INTEIROS arredondados', () => {
  it('exatamente 2 pontos de diferença: na média (para cima e para baixo)', () => {
    expect(contraNormal(52, 50)).toEqual({ dif: 2, leitura: 'na-media' })
    expect(contraNormal(48, 50)).toEqual({ dif: -2, leitura: 'na-media' })
  })
  it('exatamente 3 pontos: acima / abaixo', () => {
    expect(contraNormal(53, 50)).toEqual({ dif: 3, leitura: 'acima' })
    expect(contraNormal(47, 50)).toEqual({ dif: -3, leitura: 'abaixo' })
  })
  it('arredonda ANTES de decidir: 2,4 é 2 (na média) e 2,6 é 3 (acima); 2,5 vai para 3 nos dois sentidos', () => {
    expect(contraNormal(52.4, 50)).toEqual({ dif: 2, leitura: 'na-media' })
    expect(contraNormal(52.6, 50)).toEqual({ dif: 3, leitura: 'acima' })
    expect(contraNormal(47.6, 50)).toEqual({ dif: -2, leitura: 'na-media' })
    expect(contraNormal(47.4, 50)).toEqual({ dif: -3, leitura: 'abaixo' })
    expect(contraNormal(52.5, 50)).toEqual({ dif: 3, leitura: 'acima' })
    expect(contraNormal(47.5, 50)).toEqual({ dif: -3, leitura: 'abaixo' })
  })
  it('0,4 ponto é 0, "na média" sem sinal; igual ao normal também', () => {
    expect(contraNormal(50.4, 50)).toEqual({ dif: 0, leitura: 'na-media' })
    expect(contraNormal(50, 50)).toEqual({ dif: 0, leitura: 'na-media' })
  })
  it('-0 nunca aparece (a tela escreve o sinal pela diferença)', () => {
    expect(Object.is(contraNormal(49.7, 50)!.dif, -0)).toBe(false)
  })
  it('sem normal (faixa com menos de 5 vídeos) ou sem % do vídeo: null, nunca "na média"', () => {
    expect(contraNormal(50, null)).toBeNull()
    expect(contraNormal(null, 50)).toBeNull()
    expect(contraNormal(null, null)).toBeNull()
  })
})
