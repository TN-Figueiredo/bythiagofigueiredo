// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerLinhasDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista-borda'

/** Cliente falso: toda consulta é encadeável e resolve com `{ data, error }`; a tabela em `falha` devolve erro. */
function clienteFalso(falha: string): SupabaseClient {
  const consulta = (tabela: string): unknown => {
    const r = tabela === falha ? { data: null, error: { message: 'boom' } } : { data: [], error: null }
    const p: Record<string, unknown> = {}
    const cadeia = new Proxy(p, {
      get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok) : () => cadeia),
    })
    return cadeia
  }
  return { from: consulta, rpc: () => consulta('rpc') } as unknown as SupabaseClient
}

describe('lerLinhasDoCaminho: erro de leitura', () => {
  for (const tabela of ['youtube_videos', 'ab_native_fichas', 'ab_native_tests', 'ab_tests']) {
    it(`erro em ${tabela} lança, não devolve lista vazia`, async () => {
      await expect(lerLinhasDoCaminho(clienteFalso(tabela), 's', new Date(), null)).rejects.toThrow(tabela)
    })
  }
})
