// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parsePassos, KINDS_DO_PASSO } from '@/lib/youtube/coleta/passos-parciais'

describe('parsePassos', () => {
  it('sem parâmetro: execução completa', () => {
    expect(parsePassos(null)).toEqual({ ok: true, passos: null })
  })
  it('lista válida vira conjunto', () => {
    const r = parsePassos('jobs,relatorios')
    expect(r.ok && r.passos && [...r.passos].sort()).toEqual(['jobs', 'relatorios'])
  })
  it('repetido colapsa', () => {
    const r = parsePassos('jobs,jobs')
    expect(r.ok && r.passos?.size).toBe(1)
  })
  it.each(['', 'JOBS', 'jobs,,relatorios', 'diario'])('%j é recusado', raw => {
    const r = parsePassos(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0)
  })
  it('KINDS_DO_PASSO', () => {
    expect(KINDS_DO_PASSO).toEqual({
      jobs: ['sondagem'], relatorios: ['relatorio'], alcance: ['relatorio'],
      normalizadores: ['normalizador_trafego', 'normalizador_alcance_dim'],
    })
  })
})
