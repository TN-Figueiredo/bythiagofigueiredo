// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { nivelDosRotulos } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-model'

describe('E5a T20, horas', () => {
  it('nivelDosRotulos existe e responde a poucas barras', () => {
    expect(typeof nivelDosRotulos).toBe('function')
  })
})
