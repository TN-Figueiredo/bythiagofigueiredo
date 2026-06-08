import { describe, it, expect } from 'vitest'
import { PILLARS, type PillarId } from '@/lib/pipeline/pillars'

describe('PILLARS', () => {
  it('has exactly the 5 pillars with ids/labels/colors', () => {
    expect(PILLARS.map(p => p.id)).toEqual(['viagem', 'ia', 'codigo', 'games', 'nas'])
  })

  it('binds each pillar to a hex color', () => {
    const byId = Object.fromEntries(PILLARS.map(p => [p.id, p.color]))
    expect(byId.viagem).toBe('#22b8d6')
    expect(byId.ia).toBe('#8b8cf6')
    expect(byId.codigo).toBe('#fb7a52')
    expect(byId.games).toBe('#f43f5e')
    expect(byId.nas).toBe('#22c55e')
  })

  it('PillarId enumerates the ids (type-level smoke)', () => {
    const id: PillarId = 'viagem'
    expect(PILLARS.some(p => p.id === id)).toBe(true)
  })
})
