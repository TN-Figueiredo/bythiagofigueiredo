// Fase A2, tarefa 2, rodada de conserto 1: a decisão "o cartão está fora da área visível do contêiner que rola?" é pura (o jsdom não tem
// layout); a prova com layout real é do Playwright da Tarefa 4.
import { describe, it, expect } from 'vitest'
import { precisaTrazer } from '@/app/cms/(authed)/youtube/competitors/_canal/cartao-a-vista'

const area = { top: 100, bottom: 700 }

describe('precisaTrazer(alvo, area)', () => {
  it('dentro da área (com a folga): não precisa', () => {
    expect(precisaTrazer({ top: 200, bottom: 450 }, area)).toBe(false)
    expect(precisaTrazer({ top: 108, bottom: 692 }, area)).toBe(false)
  })
  it('acima, abaixo ou cortado numa das bordas: precisa', () => {
    expect(precisaTrazer({ top: -400, bottom: -150 }, area)).toBe(true)
    expect(precisaTrazer({ top: 1500, bottom: 1750 }, area)).toBe(true)
    expect(precisaTrazer({ top: 600, bottom: 850 }, area)).toBe(true)
    expect(precisaTrazer({ top: 20, bottom: 260 }, area)).toBe(true)
  })
  it('sem layout (altura zero da área ou do alvo, como no jsdom): nunca rola', () => {
    expect(precisaTrazer({ top: 0, bottom: 0 }, { top: 0, bottom: 0 })).toBe(false)
    expect(precisaTrazer({ top: 5000, bottom: 5000 }, area)).toBe(false)
    expect(precisaTrazer({ top: 5000, bottom: 5200 }, { top: 0, bottom: 0 })).toBe(false)
  })
  it('alvo mais alto que a área: só precisa se não cruzar a área', () => {
    expect(precisaTrazer({ top: 50, bottom: 900 }, area)).toBe(false)
    expect(precisaTrazer({ top: 800, bottom: 1700 }, area)).toBe(true)
  })
})
