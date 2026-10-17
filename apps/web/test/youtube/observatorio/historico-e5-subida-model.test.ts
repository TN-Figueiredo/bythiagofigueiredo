// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DIAS_NECESSARIOS, cartaoDaSubida, celulaDaSubida, type EntradaDaSubida } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/subida-model'

const medida = <T,>(valor: T) => ({ estado: 'medido' as const, valor, n: 1, janela: { de: null, ate: null, dias: null }, notas: [] })
const ent = (o: Partial<EntradaDaSubida>): EntradaDaSubida => ({
  hojeSP: '2026-10-16', semanal: false, saiu: false, diasDeContagem: 15, subidas: medida([]), mudancas: [],
  inicioDaContagem: '2026-10-03', publicadoAntesDoInicio: false, ...o,
})

describe('E5a T20, subida', () => {
  it('a subida pede 2 janelas de 7 dias mais 1', () => {
    expect(DIAS_NECESSARIOS).toBe(15)
  })
  it('menos de 15 dias: "são N. Faltam M: fecha em dd/mm" e N mais M dá o que a regra pede', () => {
    const c = cartaoDaSubida(ent({ diasDeContagem: 9, subidas: { estado: 'nao_medido', motivo: 'sem_leitura', notas: [] } }))
    expect(c.tipo).toBe('nao_medido')
    if (c.tipo !== 'nao_medido') return
    expect(c.motivo).toBe('faltam_dias')
    expect(c.texto).toContain('são 9')
    expect(c.texto).toContain(`Faltam ${DIAS_NECESSARIOS - 9}`)
    expect(c.texto).toContain('fecha em 22/10')
    expect(c.feitos + (DIAS_NECESSARIOS - 9)).toBe(DIAS_NECESSARIOS)
  })
  it('contagem por semana: inconclusivo, sem hachura', () => {
    const c = cartaoDaSubida(ent({ semanal: true }))
    expect(c.tipo).toBe('inconclusivo')
    expect(celulaDaSubida(c, 15).valor).toBe('contagem por semana')
  })
  it('15 dias inteiros e nenhuma subida: "＝ Sem subida"', () => {
    const c = cartaoDaSubida(ent({}))
    expect(c.tipo).toBe('sem_subida')
    if (c.tipo === 'sem_subida') expect(c.titulo).toBe('＝ Sem subida')
    expect(celulaDaSubida(c, 15)).toMatchObject({ valor: 'nenhuma', razao: '＝' })
  })
  it('vídeo que saiu: "a subida não vai ser medida"', () => {
    const c = cartaoDaSubida(ent({ saiu: true, diasDeContagem: 4, subidas: { estado: 'nao_medido', motivo: 'sem_leitura', notas: [] } }))
    expect(c.tipo).toBe('nao_medido')
    if (c.tipo === 'nao_medido') expect(c.texto).toContain('a subida não vai ser medida')
  })
  it('série não lida: não carregou, nunca "sem subida"', () => {
    expect(cartaoDaSubida(ent({ subidas: null })).tipo).toBe('nao_carregou')
  })
  it('nenhuma frase diz "depois da troca" nem afirma causa', () => {
    const c = cartaoDaSubida(ent({ subidas: medida([{ dia: '2026-10-10', ganho7: 5000, ganho7Antes: 1000, fator: 5, mudancasAntes: [] }]), mudancas: null }))
    const txt = JSON.stringify(c)
    expect(txt).not.toMatch(/depois da troca/i)
    if (c.tipo === 'subiu') {
      expect(c.listaCarregou).toBe(false)
      expect(c.nota).toContain('coincidências')
    }
  })
})
