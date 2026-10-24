// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { decidirCampo, type Rodada } from '@/lib/youtube/teste-youtube/observados/inferir'

const H = 3_600_000
/** PRNG determinístico (mulberry32). Semente fixa 2023: não se troca semente nem limite para fazer passar. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ALVOS = 5000
const RODADAS = 40

/** Teste A/B de verdade (duas versões sorteadas por leitura com `pA`), 40 rodadas de 3 leituras, avaliado só na 40ª. */
function simular(pA: number, rnd: () => number): { terminouOuTroca: number; ms: number } {
  const t0 = performance.now()
  let n = 0
  for (let k = 0; k < ALVOS; k++) {
    const rs: Rodada[] = []
    for (let i = 0; i < RODADAS; i++) {
      const versoes = new Set<string>()
      for (let j = 0; j < 3; j++) versoes.add(rnd() < pA ? 'A' : 'B')
      rs.push({ tMs: i * 6 * H, rodadaId: `r${i}`, versoes })
    }
    const d = decidirCampo('titulo', rs, { publicadoMs: -48 * H, agoraMs: (RODADAS - 1) * 6 * H + H })
    if (d.estado === 'terminou' || d.estado === 'troca') n++
  }
  return { terminouOuTroca: n, ms: performance.now() - t0 }
}

describe('simulação com semente (§9.3): teste vivo quase nunca é declarado terminado ou troca', () => {
  for (const [nome, pA] of [['80/20', 0.8], ['90/10', 0.9]] as const) {
    it(`pesos ${nome}: < 50 falsos "terminou/troca" em ${ALVOS} alvos (fração < 0,01) e < 5 s`, () => {
      const r = simular(pA, mulberry32(2023))
      expect(r.terminouOuTroca).toBeLessThan(50)
      expect(r.ms).toBeLessThan(5000)
    })
  }
})
