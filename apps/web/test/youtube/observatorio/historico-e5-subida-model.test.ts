// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DIAS_NECESSARIOS } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/subida-model'

describe('E5a T20, subida', () => {
  it('a subida pede 2 janelas de 7 dias mais 1', () => {
    expect(DIAS_NECESSARIOS).toBe(15)
  })
})
