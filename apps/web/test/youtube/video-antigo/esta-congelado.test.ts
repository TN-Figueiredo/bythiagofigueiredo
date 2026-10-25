// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { estaCongelado, estaNoArquivo, estadoDoVideo, marcaDoArquivo, COLUNAS_DA_MARCA } from '@/lib/youtube/video-antigo/esta-congelado'

const D = '2026-10-01T00:00:00Z'
describe('esta-congelado (M10a, Tarefa 6)', () => {
  it('os três estados', () => {
    expect(estadoDoVideo({ archive_frozen_at: null, archive_dropped_at: null })).toBe('ativo')
    expect(estadoDoVideo({ archive_frozen_at: D, archive_dropped_at: null })).toBe('leitura_mensal')
    expect(estadoDoVideo({ archive_frozen_at: D, archive_dropped_at: D })).toBe('no_arquivo')
  })
  it('undefined, null e data', () => {
    expect(estaCongelado({})).toBe(false)
    expect(estaCongelado({ archive_frozen_at: null })).toBe(false)
    expect(estaCongelado({ archive_frozen_at: D })).toBe(true)
    expect(estaNoArquivo({})).toBe(false)
    expect(estaNoArquivo({ archive_dropped_at: D })).toBe(true)
  })
  it('no arquivo sem archive_frozen_at (impossível pelo gatilho) é no_arquivo', () => {
    expect(estadoDoVideo({ archive_dropped_at: D })).toBe('no_arquivo')
  })
  it('marcaDoArquivo: nulo para ativo, par para os outros dois', () => {
    expect(marcaDoArquivo({})).toBeNull()
    expect(marcaDoArquivo({ archive_frozen_at: D })).toEqual({ estado: 'leitura_mensal', desde: D })
    expect(marcaDoArquivo({ archive_frozen_at: D, archive_dropped_at: D })).toEqual({ estado: 'no_arquivo', desde: D })
  })
  it('colunas da marca', () => { expect(COLUNAS_DA_MARCA).toBe('archive_frozen_at, archive_dropped_at') })
})
