// @vitest-environment node
// A5 · E4, Tarefa 7: M10, pico sem cauda (item 55 do spec). Função pura.
import { describe, expect, it } from 'vitest'
import { picoSemCauda, TEXTO_OBRIGATORIO_M10, NOME_INTERNO_M10, type EntradaPico } from '@/lib/youtube/observatorio/medidas/pico'

/** Um vídeo que cumpre as três condições com folga mínima: V30 2×, cauda e reação em metade, ainda rende 2%. */
const base = (over: Partial<EntradaPico> = {}, canal: Partial<EntradaPico['canal']> = {}): EntradaPico => ({
  wasLive: false, idadeDias: 120, v30: 2000, cauda: 0.2, aindaRende: 0.02, reacao: { taxa: 0.01, componente: 'os_dois' },
  canal: { nElegiveis: 5, medianaV30: 1000, medianaCauda: 0.4, medianaReacao: 0.02, ...canal }, ...over,
})
const leitura = (e: EntradaPico) => { const m = picoSemCauda(e); return m.estado === 'medido' ? m.valor.leitura : m.motivo }

describe('M10: pico sem cauda', () => {
  it('as três exatamente no limite: pico_sem_cauda', () => {
    expect(leitura(base())).toBe('pico_sem_cauda')
  })
  it('V30 exatamente 2 vezes a mediana cumpre; 1,99 não', () => {
    expect(leitura(base({ v30: 2000 }))).toBe('pico_sem_cauda')
    expect(leitura(base({ v30: 1990 }))).toBe('nao_e_o_caso')
  })
  it('cauda exatamente metade cumpre; um pouco acima não', () => {
    expect(leitura(base({ cauda: 0.2 }))).toBe('pico_sem_cauda')
    expect(leitura(base({ cauda: 0.2001 }))).toBe('nao_e_o_caso')
  })
  it('ainda rende exatamente 2% cumpre; 2,01% não', () => {
    expect(leitura(base({ aindaRende: 0.02 }))).toBe('pico_sem_cauda')
    expect(leitura(base({ aindaRende: 0.0201 }))).toBe('nao_e_o_caso')
  })
  it('reação exatamente metade cumpre', () => {
    expect(leitura(base({ reacao: { taxa: 0.01, componente: 'os_dois' } }))).toBe('pico_sem_cauda')
    expect(leitura(base({ reacao: { taxa: 0.0101, componente: 'os_dois' } }))).toBe('nao_e_o_caso')
  })
  it('duas de três condições é nao_e_o_caso (os três pares)', () => {
    expect(leitura(base({ v30: 1000 }))).toBe('nao_e_o_caso')
    expect(leitura(base({ cauda: 0.5 }))).toBe('nao_e_o_caso')
    expect(leitura(base({ reacao: { taxa: 0.02, componente: 'os_dois' } }))).toBe('nao_e_o_caso')
    const m = picoSemCauda(base({ v30: 1000 }))
    expect(m.estado === 'medido' && m.valor.condicoes).toEqual({ muitasViewsCedo: false, quaseNadaDepois: true, poucaReacao: true })
  })
  it('curtidas ocultas e comentários desligados: sem_reacao_publica, mesmo com as outras duas cumpridas', () => {
    expect(leitura(base({ reacao: null }))).toBe('sem_reacao_publica')
  })
  it('canal com 4 elegíveis não mede, com 5 mede', () => {
    expect(picoSemCauda(base({}, { nElegiveis: 4 }))).toMatchObject({ estado: 'nao_medido', motivo: 'poucos_videos', n: 4, minimo: 5 })
    expect(picoSemCauda(base({}, { nElegiveis: 5 })).estado).toBe('medido')
  })
  it('ao vivo e estreia ficam fora', () => {
    expect(leitura(base({ wasLive: true }))).toBe('ao_vivo_ou_estreia')
  })
  it('V30 de 999 não mede, de 1.000 mede', () => {
    expect(leitura(base({ v30: 999 }))).toBe('poucas_views')
    expect(picoSemCauda(base({ v30: 1000 }, { medianaV30: 400 })).estado).toBe('medido')
  })
  it('idade 89 não mede', () => {
    expect(leitura(base({ idadeDias: 89 }))).toBe('idade_menor_que_90')
    expect(picoSemCauda(base({ idadeDias: 90 })).estado).toBe('medido')
  })
  it('sem V30', () => {
    expect(leitura(base({ v30: null }))).toBe('sem_v30')
  })
  it('mediana zero ou nula: base_zero', () => {
    expect(leitura(base({}, { medianaV30: 0 }))).toBe('base_zero')
    expect(leitura(base({}, { medianaCauda: 0 }))).toBe('base_zero')
    expect(leitura(base({}, { medianaReacao: null }))).toBe('base_zero')
  })
  it('cauda ou ainda rende nulos: serie_diaria_incompleta', () => {
    expect(leitura(base({ cauda: null }))).toBe('serie_diaria_incompleta')
    expect(leitura(base({ aindaRende: null }))).toBe('serie_diaria_incompleta')
  })
  it('o texto obrigatório é o do spec e não tem a palavra "retenção"', () => {
    expect(TEXTO_OBRIGATORIO_M10.startsWith('Indício, não medição. Este vídeo teve muitas views nos primeiros 30 dias')).toBe(true)
    expect(TEXTO_OBRIGATORIO_M10.endsWith('quanto tempo as pessoas assistiram ao vídeo de outro canal.')).toBe(true)
    expect(TEXTO_OBRIGATORIO_M10.toLowerCase()).not.toContain('retenção')
    expect(NOME_INTERNO_M10).toBe('pico_sem_cauda')
  })
  // (revisão Yannis 14/10, I2) o texto é o do spec letra por letra, e `numeros` é o que a tela mostra como "os números usados"
  it('o texto obrigatório é idêntico ao do spec, inteiro', () => {
    expect(TEXTO_OBRIGATORIO_M10).toBe(
      'Indício, não medição. Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público (curtidas e comentários). Isso costuma acontecer quando o YouTube para de recomendar um vídeo; essa é uma hipótese nossa sobre como a recomendação funciona, não um dado. O YouTube não mostra a ninguém de fora quanto tempo as pessoas assistiram ao vídeo de outro canal.',
    )
  })
  it('numeros: cada campo é o valor certo (sete valores todos diferentes entre si)', () => {
    const m = picoSemCauda(base(
      { v30: 2500, cauda: 0.15, aindaRende: 0.015, reacao: { taxa: 0.012, componente: 'os_dois' } },
      { medianaV30: 1000, medianaCauda: 0.4, medianaReacao: 0.03 },
    ))
    expect(m.estado === 'medido' && m.valor.leitura).toBe('pico_sem_cauda')
    expect(m.estado === 'medido' && m.valor.numeros).toEqual({ v30: 2500, medianaV30: 1000, cauda: 0.15, medianaCauda: 0.4, aindaRende: 0.015, reacao: 0.012, medianaReacao: 0.03 })
  })
  it('o resultado não tem campo de nota nem de percentual', () => {
    const m = picoSemCauda(base())
    expect(m.estado === 'medido' && Object.keys(m.valor).sort()).toEqual(['condicoes', 'leitura', 'numeros'])
  })
})
