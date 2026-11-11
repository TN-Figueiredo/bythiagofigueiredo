// @vitest-environment node
/** A5 F2b T11: o teto de canais da `serie` vem da medida de produção (Q2 de 11/11/2026), com a data e o p95 gravados; a regra do plano o liga ao p95. */
import { describe, expect, it } from 'vitest'
import { ENTRADA } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `${String(i + 1).repeat(8)}-1111-4111-8111-111111111111`)

describe('tetoDeCanaisDaSerie', () => {
  const t = ACESSO_IA_RULES.tetoDeCanaisDaSerie
  it('guarda o valor, a data e o p95 da medida (n ≥ 20; p95 ≤ 7 s → 6 canais em série, sem pool)', () => {
    expect(t).toEqual({ canais: 6, medidoEm: '2026-11-11', chamadasMedidas: 27, p95Ms: 5_424 })
    expect(t.chamadasMedidas).toBeGreaterThanOrEqual(20)
    expect(t.p95Ms).toBeLessThanOrEqual(7_000)
  })
  it('o esquema aceita exatamente o teto e recusa o seguinte', () => {
    const base = { acao: 'serie', de: '2026-10-01', ate: '2026-10-31', saida: 'tabela' }
    expect(ENTRADA.safeParse({ ...base, canal_ids: ids(t.canais) }).success).toBe(true)
    expect(ENTRADA.safeParse({ ...base, canal_ids: ids(t.canais + 1) }).success).toBe(false)
  })
  it('as constantes do prazo: margem 2 s e estimativa de 8 s por canal', () => {
    expect(ACESSO_IA_RULES.margemDaTabelaMs).toBe(2_000)
    expect(ACESSO_IA_RULES.estimativaPorCanalMs).toBe(8_000)
  })
})
