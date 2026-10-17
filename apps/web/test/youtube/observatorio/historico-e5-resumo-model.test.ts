// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { resumoDoVideo, type EntradaDoResumo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/resumo-model'

const ent = (o: Partial<EntradaDoResumo>): EntradaDoResumo => ({
  hojeSP: '2026-10-16', inicioDaContagem: '2026-10-03', viewsAgora: 1_020_000,
  idade: { tipo: 'nao_carregou', frase: 'x' }, subida: { tipo: 'nao_carregou', frase: 'y' }, mudancas: null,
  semanal: false, aoVivo: false, diasDeContagem: 5, idadeDoVideoDias: 5, saiu: null, entrouTarde: null,
  zeros: { dias: 0, diasMedidos: 5, horas: null, horasMedidas: null }, ...o,
})
describe('E5a T20, resumo', () => {
  it('vazio: sem contagem ainda', () => {
    const r = resumoDoVideo(ent({ diasDeContagem: 0 }))
    expect(r.variante).toBe('vazio')
    expect(r.frase).toContain('Ainda não há histórico')
  })
  it('saiu: última contagem e views por extenso', () => {
    const r = resumoDoVideo(ent({ saiu: { em: '2026-10-12', ultimaContagem: '2026-10-11' } }))
    expect(r.variante).toBe('saiu')
    expect(r.frase).toContain('saiu do YouTube em 12/10')
    expect(r.faixa.viewsAgora.texto).toBe('1.020.000')
  })
  it('zero: metade ou mais dos dias sem view', () => {
    const r = resumoDoVideo(ent({ viewsAgora: 12, zeros: { dias: 3, diasMedidos: 5, horas: null, horasMedidas: null } }))
    expect(r.variante).toBe('zero')
    expect(r.frase).toContain('medido: 0')
  })
  it('coerência: o número de "Views agora" vem da mesma função da frase', () => {
    const r = resumoDoVideo(ent({ aoVivo: true }))
    expect(r.faixa.viewsAgora.texto).toBe('1,02 milhão')
    expect(r.frase).toContain('1,02 milhão')
  })
})
