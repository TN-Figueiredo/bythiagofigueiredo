// @vitest-environment node
// Comentários em produção · T1: o modelo puro do fio único.
import { describe, it, expect } from 'vitest'
import { rotuloDoAutor, RESPOSTAS_VISIVEIS, type CriadorDoFio } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/fio-model'

const criador: CriadorDoFio = { nome: 'Matheus Fonseca', avatar: null, ini: 'M', color: '#123456' }

describe('rotuloDoAutor', () => {
  it('espectador é "Espectador"', () => {
    expect(rotuloDoAutor({ tipo: 'espectador' }, criador)).toBe('Espectador')
  })
  it('criador usa o nome do canal', () => {
    expect(rotuloDoAutor({ tipo: 'criador' }, criador)).toBe('Matheus Fonseca')
  })
  it('identidade usa o nome; grande e reservado não têm nome', () => {
    expect(rotuloDoAutor({ tipo: 'identidade', nome: 'Ana', fotoUrl: null, ate: '01/11' }, criador)).toBe('Ana')
    expect(rotuloDoAutor({ tipo: 'grande', faixa: null }, criador)).not.toContain('Ana')
  })
  it('RESPOSTAS_VISIVEIS é 3', () => {
    expect(RESPOSTAS_VISIVEIS).toBe(3)
  })
})
