// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'

describe('interruptor do Perguntar a uma IA (Yannis 17/10, M2)', () => {
  it('segue desligado até o commit do ligar', () => {
    expect(CONTEXTO_IA_RULES.ligado, 'ligar exige Y5 (plano E17 d1, linha 351), G-6/G-7 provados, e G-5 decidido; o commit do ligar troca este teste').toBe(false)
  })
})
