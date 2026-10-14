// @vitest-environment node
// A5 · E4, Tarefa 6: M5(ii), a subida do vídeo e o que mudou antes. Funções puras, dias sintéticos no passado.
import { describe, expect, it } from 'vitest'
import { subidasDoVideo, capitulosDe, mudouCapitulos, type CampoDeMudanca } from '@/lib/youtube/observatorio/medidas/subida'
import { DAY } from '@/lib/youtube/observatorio/time'

const T0 = Date.UTC(2026, 8, 1, 15, 0)
const dia = (i: number) => new Date(T0 + i * DAY - 3 * 36e5).toISOString().slice(0, 10)
const ponto = (i: number, views: number) => ({ dia: dia(i), t: T0 + i * DAY, views })
/** Série diária de `n` dias cujo acumulado é dado por `acum(i)`. */
const serie = (n: number, acum: (i: number) => number) => Array.from({ length: n }, (_, i) => ponto(i, acum(i)))
/** 100 views por dia e um degrau de `bump` no dia `J`: os dias J − 7 a J − 1 enxergam o degrau em `ganho7`; os dias J a J + 6, em `ganho7Antes`. */
const comDegrau = (J: number, bump: number, ritmoDia = 100) => (i: number) => i * ritmoDia + (i >= J ? bump : 0)
const diasDe = (r: ReturnType<typeof subidasDoVideo>) => { if (r.estado !== 'medido') throw new Error('não medido: ' + r.motivo); return r.valor.map(x => x.dia) }

describe('M5 ii: subidas', () => {
  it('ganho exatamente 1.000 é subida; 999 não', () => {
    // ritmo de 50/dia: ganho7Antes = 350, o dobro (700) não pesa; o piso de 1.000 é que decide
    expect(diasDe(subidasDoVideo(serie(30, comDegrau(14, 650, 50)), []))).toContain(dia(7))
    expect(diasDe(subidasDoVideo(serie(30, comDegrau(14, 649, 50)), []))).toEqual([])
  })
  it('exatamente 2 vezes o ganho anterior é subida; 1,99 vezes não', () => {
    // ritmo de 100/dia: ganho7Antes = 700, o dobro é 1.400
    expect(diasDe(subidasDoVideo(serie(30, comDegrau(14, 700)), []))).toContain(dia(7))
    expect(diasDe(subidasDoVideo(serie(30, comDegrau(14, 699)), []))).toEqual([])
  })
  it('ganho anterior zero: é subida com fator nulo', () => {
    const r = subidasDoVideo(serie(30, i => 500 + (i >= 14 ? 2000 : 0)), [])
    expect(r.estado === 'medido' && r.valor[0]).toMatchObject({ dia: dia(7), ganho7: 2000, ganho7Antes: 0, fator: null })
  })
  it('ganho anterior negativo: fator nulo', () => {
    const r = subidasDoVideo(serie(30, i => 5000 - i * 10 + (i >= 14 ? 3000 : 0)), [])
    expect(r.estado === 'medido' && r.valor[0]).toMatchObject({ dia: dia(7), ganho7: 2930, ganho7Antes: -70, fator: null })
  })
  it('conta o fator quando há ganho anterior positivo', () => {
    const r = subidasDoVideo(serie(30, comDegrau(14, 2100)), [])
    expect(r.estado === 'medido' && r.valor[0]).toMatchObject({ dia: dia(7), ganho7: 2800, ganho7Antes: 700, fator: 4 })
  })
  it('falta um dos 15 dias: aquele dia não é avaliado', () => {
    const pts = serie(30, comDegrau(14, 5000)).filter(p => p.dia !== dia(13))
    expect(diasDe(subidasDoVideo(pts, []))).toEqual([])
    expect(subidasDoVideo(pts, []).estado).toBe('medido')
  })
  it('só pontos semanais: serie_diaria_incompleta', () => {
    const pts = [0, 7, 14, 21, 28].map(i => ponto(i, i * 100))
    expect(subidasDoVideo(pts, [])).toMatchObject({ estado: 'nao_medido', motivo: 'serie_diaria_incompleta' })
  })
  it('série vazia', () => {
    expect(subidasDoVideo([], [])).toMatchObject({ estado: 'nao_medido', motivo: 'sem_leitura' })
  })
  it('sete dias seguidos cumprindo: uma subida, no primeiro', () => {
    expect(diasDe(subidasDoVideo(serie(30, comDegrau(14, 5000)), []))).toEqual([dia(7)])
  })
  it('duas subidas separadas', () => {
    expect(diasDe(subidasDoVideo(serie(60, i => i * 100 + (i >= 14 ? 5000 : 0) + (i >= 44 ? 5000 : 0)), []))).toEqual([dia(7), dia(37)])
  })
  it('mudança exatamente 14 dias antes entra; 14 dias e 1 ms não; no próprio dia não', () => {
    const tD = T0 + 7 * DAY
    const m = (campo: CampoDeMudanca, em: number) => ({ campo, em })
    const r = subidasDoVideo(serie(30, comDegrau(14, 5000)), [m('titulo', tD - 14 * DAY), m('miniatura', tD - 14 * DAY - 1), m('descricao', tD), m('tags', tD - 1)])
    if (r.estado !== 'medido') throw new Error('não medido')
    expect(r.valor[0]!.mudancasAntes.map(x => x.campo).sort()).toEqual(['tags', 'titulo'])
  })
  it('trecho completo sem subida: medido com lista vazia', () => {
    expect(subidasDoVideo(serie(25, i => i * 100), [])).toMatchObject({ estado: 'medido', valor: [] })
  })
})

describe('capítulos', () => {
  it('extrai, ignora linha comum, texto nulo dá nulo', () => {
    expect(capitulosDe('Olá\n0:00 Intro\ntexto\n1:23 Parte 1\n1:02:03 Fim')).toEqual(['0:00 Intro', '1:23 Parte 1', '1:02:03 Fim'])
    expect(capitulosDe('sem capítulos aqui')).toEqual([])
    expect(capitulosDe(null)).toBeNull()
  })
  it('duas descrições com listas diferentes são mudança; texto ausente em uma delas não se afirma', () => {
    expect(mudouCapitulos('0:00 A\n1:00 B', '0:00 A\n1:30 B')).toBe(true)
    expect(mudouCapitulos('0:00 A\n1:00 B', 'Outro texto\n0:00 A\n1:00 B')).toBe(false)
    expect(mudouCapitulos(null, '0:00 A')).toBe(false)
    expect(mudouCapitulos('0:00 A', null)).toBe(false)
  })
})
