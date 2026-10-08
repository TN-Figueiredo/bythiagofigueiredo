// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase } from './fake-supabase'

const rpcArgs = { p_site_id: 's', p_scope_type: 'video', p_scope_id: 'v', p_kind: 'meta', p_outcome: 'ok' }

describe('fakeSupabase estrito', () => {
  it('rpc sem handler devolve PGRST202', async () => {
    const r = await fakeSupabase().client.rpc('nao_existe')
    expect(r.error).toMatchObject({ code: 'PGRST202' })
    expect(r.data).toBeNull()
  })
  it('yt_own_attempt_record: not null, CHECKs e truncamento de 500', async () => {
    const db = fakeSupabase()
    expect((await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_site_id: null })).error).toMatchObject({ code: '23502' })
    for (const k of ['p_scope_type', 'p_kind', 'p_outcome']) {
      expect((await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, [k]: 'x' })).error).toMatchObject({ code: '23514' })
    }
    await db.client.rpc('yt_own_attempt_record', { ...rpcArgs, p_error: 'a'.repeat(600) })
    expect((db.tables.yt_own_collection_attempts![0]!.error as string).length).toBe(500)
  })
  it('order: asc põe nulos por último, desc por primeiro, nullsFirst respeitado', async () => {
    const db = fakeSupabase({ t: [{ a: 2 }, { a: null }, { a: 1 }] })
    const ord = async (o: { ascending?: boolean; nullsFirst?: boolean }) =>
      ((await db.client.from('t').select('a').order('a', o)).data as Array<{ a: number | null }>).map(r => r.a)
    expect(await ord({ ascending: true })).toEqual([1, 2, null])
    expect(await ord({ ascending: false })).toEqual([null, 2, 1])
    expect(await ord({ ascending: true, nullsFirst: true })).toEqual([null, 1, 2])
    expect(await ord({ ascending: false, nullsFirst: false })).toEqual([2, 1, null])
  })
  it('single/maybeSingle: PGRST116', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }, { a: 2 }] })
    expect((await db.client.from('t').select('*').single()).error).toMatchObject({ code: 'PGRST116' })
    expect((await db.client.from('t').select('*').eq('a', 9).single()).error).toMatchObject({ code: 'PGRST116' })
    expect((await db.client.from('t').select('*').maybeSingle()).error).toMatchObject({ code: 'PGRST116' })
    expect((await db.client.from('t').select('*').eq('a', 9).maybeSingle())).toMatchObject({ data: null, error: null })
    expect((await db.client.from('t').select('*').eq('a', 1).single()).data).toEqual({ a: 1 })
  })
  it('not só com is/eq; or lança', () => {
    const q = fakeSupabase().client.from('t').select('*')
    expect(() => q.not('a', 'in', '(1)')).toThrow()
    expect(() => q.or('a.eq.1')).toThrow('or() não é suportado pelo banco em memória')
  })
  it('not is/eq', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }, { a: null }, { a: 2 }] })
    expect((await db.client.from('t').select('*').not('a', 'is', null)).data).toHaveLength(2)
    expect((await db.client.from('t').select('*').not('a', 'eq', 1)).data).toEqual([{ a: 2 }])
  })
  it('escrita devolve data null sem select; com select devolve linhas', async () => {
    const db = fakeSupabase({ t: [{ id: 1, a: 1 }] })
    expect((await db.client.from('t').insert({ id: 2, a: 2 })).data).toBeNull()
    expect((await db.client.from('t').update({ a: 5 }).eq('id', 1)).data).toBeNull()
    expect((await db.client.from('t').update({ a: 6 }).eq('id', 1).select('a')).data).toEqual([{ a: 6 }])
    expect((await db.client.from('t').delete().eq('id', 2).select()).data).toHaveLength(1)
  })
  it('chaves únicas: 23505 no insert duplicado e 42P10 no onConflict sem chave', async () => {
    const db = fakeSupabase()
    const t = db.client.from('yt_reporting_reports')
    expect((await t.insert({ report_id: 'r' })).error).toBeNull()
    expect((await db.client.from('yt_reporting_reports').insert({ report_id: 'r' })).error).toMatchObject({ code: '23505' })
    expect((await db.client.from('yt_reporting_reports').upsert({ report_id: 'r' }, { onConflict: 'report_id' })).error).toBeNull()
    expect((await db.client.from('yt_reporting_reports').upsert({ report_id: 'r' }, { onConflict: 'outra' })).error).toMatchObject({ code: '42P10' })
  })
  it('neq exclui nulos', async () => {
    const db = fakeSupabase({ t: [{ a: 1 }, { a: null }, { b: 1 }, { a: 2 }] })
    expect((await db.client.from('t').select('*').neq('a', 1)).data).toEqual([{ a: 2 }])
  })
  it('projeção, clones e memoização', async () => {
    const db = fakeSupabase({ t: [{ a: 1, b: 2, c: 3 }] })
    const q = db.client.from('t').select('a, b')
    const r1 = await q
    expect(r1.data).toEqual([{ a: 1, b: 2 }])
    ;(r1.data as Array<{ a: number }>)[0]!.a = 99
    expect(db.tables.t![0]!.a).toBe(1)
    const w = db.client.from('t').insert({ a: 7 })
    await w; await w
    expect(db.tables.t).toHaveLength(2)
  })
})
