import { afterEach, describe, expect, it } from 'vitest'
import { modoPausaPorDetectado } from '@/lib/youtube/teste-youtube/nativo/flag'

describe('modoPausaPorDetectado', () => {
  const original = process.env.AB_PAUSA_POR_DETECTADO
  afterEach(() => {
    if (original === undefined) delete process.env.AB_PAUSA_POR_DETECTADO
    else process.env.AB_PAUSA_POR_DETECTADO = original
  })
  it('variável apagada = off', () => {
    delete process.env.AB_PAUSA_POR_DETECTADO
    expect(modoPausaPorDetectado()).toBe('off')
  })
  it('log e on exatos', () => {
    expect(modoPausaPorDetectado({ AB_PAUSA_POR_DETECTADO: 'log' })).toBe('log')
    expect(modoPausaPorDetectado({ AB_PAUSA_POR_DETECTADO: 'on' })).toBe('on')
  })
  it.each(['ON', 'true', '1', '', ' on', 'Log', 'off'])('%j = off', (v) => {
    expect(modoPausaPorDetectado({ AB_PAUSA_POR_DETECTADO: v })).toBe('off')
  })
  it('lê process.env por padrão', () => {
    process.env.AB_PAUSA_POR_DETECTADO = 'log'
    expect(modoPausaPorDetectado()).toBe('log')
  })
})
