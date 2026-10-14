// @vitest-environment node
/** A5 · E9, Tarefa 4: o número da aba (`saiu/contar.ts`). */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { contarFila } from '@/lib/youtube/observatorio/saiu/contar'
import { fakeSaiu } from './saiu-fake-supabase'

const CHAVES = { videos: 3, canais: 1, grupos_de_comentarios: 1, apagando: 2, voltaram: 1 }
const com = (rpc: () => { data: unknown; error: null | { message: string } } | Promise<never>) => fakeSaiu({ tabelas: {}, rpc: { competitor_missing_count: rpc as never } })

describe('A5 E9 T4: contarFila', () => {
  it('devolve o número', async () => {
    expect(await contarFila(com(() => ({ data: CHAVES, error: null })).sb, 'site-1')).toBe(8)
  })

  it('passa o site', async () => {
    const f = com(() => ({ data: CHAVES, error: null }))
    await contarFila(f.sb, 'site-9')
    expect(f.rpcs).toEqual([{ nome: 'competitor_missing_count', args: { p_site: 'site-9' } }])
  })

  it('erro, exceção, nulo, lista e número negativo devolvem null', async () => {
    expect(await contarFila(com(() => ({ data: null, error: { message: 'x' } })).sb, 's')).toBeNull()
    expect(await contarFila({ rpc: async () => { throw new Error('x') } } as unknown as SupabaseClient, 's')).toBeNull()
    expect(await contarFila(com(() => ({ data: null, error: null })).sb, 's')).toBeNull()
    expect(await contarFila(com(() => ({ data: [1, 2], error: null })).sb, 's')).toBeNull()
    expect(await contarFila(com(() => ({ data: { ...CHAVES, apagando: -1 }, error: null })).sb, 's')).toBeNull()
    expect(await contarFila(com(() => ({ data: { videos: 1 }, error: null })).sb, 's')).toBeNull()
    expect(await contarFila(com(() => ({ data: { ...CHAVES, videos: '3' }, error: null })).sb, 's')).toBeNull()
  })
})
