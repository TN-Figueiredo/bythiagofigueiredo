// @vitest-environment node
/** A5 · E9, Tarefa 7: a sincronização consulta o que o dono apagou (obrigação D-11). Banco falso com roteiro. */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apagadosDaPagina, canalApagado } from '@/lib/youtube/competitor-removed'
import { fakeDb, first, arg, type Call } from './competitor-sync-harness'

const NOW_ISO = '2026-10-24T15:00:00.000Z'
const SITE = 'site-1'
const sb = (db: ReturnType<typeof fakeDb>) => db.client as unknown as SupabaseClient
const eqs = (c: Call) => c.ops.filter(o => o[0] === 'eq').map(o => `${String(o[1][0])}=${String(o[1][1])}`)
const selects = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_removed_items' && first(c) === 'select')
const updates = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_removed_items' && first(c) === 'update')

const linhas = (rows: Array<{ youtube_id: string; return_decision?: string | null; returned_seen_at?: string | null }>) =>
  rows.map(r => ({ return_decision: null, returned_seen_at: null, ...r }))
const roteiro = (o: { rows?: unknown; selErr?: string; updErr?: string }) => (c: Call) => {
  if (c.table !== 'competitor_removed_items') return undefined
  if (first(c) === 'select') return o.selErr ? { data: null, error: { message: o.selErr } } : { data: o.rows ?? [] }
  if (first(c) === 'update') return o.updErr ? { data: null, error: { message: o.updErr } } : { data: null, error: null }
  return undefined
}

describe('A5 E9 T7: apagadosDaPagina', () => {
  it('lista vazia não vai ao banco', async () => {
    const db = fakeDb(roteiro({}))
    expect(await apagadosDaPagina(sb(db), { siteId: SITE, videoIds: [], nowIso: NOW_ISO })).toEqual({ pular: new Set(), vistosAgora: 0 })
    expect(db.calls).toHaveLength(0)
  })

  it('nenhum apagado: pular vazio e nenhum carimbo', async () => {
    const db = fakeDb(roteiro({ rows: [] }))
    const r = await apagadosDaPagina(sb(db), { siteId: SITE, videoIds: ['a', 'b'], nowIso: NOW_ISO })
    expect(r).toEqual({ pular: new Set(), vistosAgora: 0 })
    expect(updates(db)).toHaveLength(0)
  })

  it('apagado sem resposta: pula e carimba a volta (site e kind no select e no update)', async () => {
    const db = fakeDb(roteiro({ rows: linhas([{ youtube_id: 'a' }]) }))
    const r = await apagadosDaPagina(sb(db), { siteId: SITE, videoIds: ['a', 'b'], nowIso: NOW_ISO })
    expect(r).toEqual({ pular: new Set(['a']), vistosAgora: 1 })
    const [s] = selects(db)
    expect(eqs(s!)).toEqual(expect.arrayContaining(['site_id=site-1', 'kind=video']))
    expect(s!.ops.find(o => o[0] === 'in')![1]).toEqual(['youtube_id', ['a', 'b']])
    const [u] = updates(db)
    expect(arg(u!, 'update')).toEqual({ returned_seen_at: NOW_ISO })
    expect(eqs(u!)).toEqual(expect.arrayContaining(['site_id=site-1', 'kind=video']))
    expect(u!.ops.find(o => o[0] === 'in')![1]).toEqual(['youtube_id', ['a']])
  })

  it('apagado já visto: pula e não carimba de novo', async () => {
    const db = fakeDb(roteiro({ rows: linhas([{ youtube_id: 'a', returned_seen_at: '2026-10-20T00:00:00Z' }]) }))
    const r = await apagadosDaPagina(sb(db), { siteId: SITE, videoIds: ['a'], nowIso: NOW_ISO })
    expect(r).toEqual({ pular: new Set(['a']), vistosAgora: 0 })
    expect(updates(db)).toHaveLength(0)
  })

  it('ignorar: pula e não carimba; voltar: não pula', async () => {
    const db = fakeDb(roteiro({ rows: linhas([{ youtube_id: 'a', return_decision: 'ignorar' }, { youtube_id: 'b', return_decision: 'voltar', returned_seen_at: '2026-10-20T00:00:00Z' }]) }))
    const r = await apagadosDaPagina(sb(db), { siteId: SITE, videoIds: ['a', 'b'], nowIso: NOW_ISO })
    expect(r).toEqual({ pular: new Set(['a']), vistosAgora: 0 })
    expect(updates(db)).toHaveLength(0)
  })

  it('o select com erro devolve erro (não "nenhum apagado"); idem tabela ausente e resposta fora da forma', async () => {
    for (const roteiroErro of [roteiro({ selErr: 'boom' }), roteiro({ selErr: 'relation "competitor_removed_items" does not exist' }), () => ({ data: null, error: null })]) {
      const r = await apagadosDaPagina(sb(fakeDb(roteiroErro)), { siteId: SITE, videoIds: ['a'], nowIso: NOW_ISO })
      expect(r).toHaveProperty('erro')
    }
  })

  it('o update do carimbo com erro devolve erro', async () => {
    const db = fakeDb(roteiro({ rows: linhas([{ youtube_id: 'a' }]), updErr: 'boom' }))
    expect(await apagadosDaPagina(sb(db), { siteId: SITE, videoIds: ['a'], nowIso: NOW_ISO })).toHaveProperty('erro')
  })

  it('o filtro do site vem do argumento: outro site não bloqueia (o banco recebe o site pedido)', async () => {
    const db = fakeDb(roteiro({ rows: [] }))
    await apagadosDaPagina(sb(db), { siteId: 'outro-site', videoIds: ['a'], nowIso: NOW_ISO })
    expect(eqs(selects(db)[0]!)).toContain('site_id=outro-site')
  })
})

describe('A5 E9 T7: canalApagado', () => {
  const roteiroCanal = (rows: unknown, err?: string) => (c: Call) => (c.table === 'competitor_removed_items' && first(c) === 'select' ? (err ? { data: null, error: { message: err } } : { data: rows }) : undefined)

  it('nunca apagado: null', async () => {
    expect(await canalApagado(sb(fakeDb(roteiroCanal([]))), SITE, 'UC1')).toBeNull()
  })
  it('apagado: devolve a data e o id; filtros de site, kind canal e id do YouTube', async () => {
    const db = fakeDb(roteiroCanal([{ id: 9, decided_at: '2026-10-10T12:00:00Z' }]))
    expect(await canalApagado(sb(db), SITE, 'UC1')).toEqual({ apagadoEm: '2026-10-10T12:00:00Z', itemId: 9 })
    expect(eqs(selects(db)[0]!)).toEqual(expect.arrayContaining(['site_id=site-1', 'kind=canal', 'youtube_id=UC1']))
  })
  it('erro do banco e resposta fora da forma devolvem erro', async () => {
    expect(await canalApagado(sb(fakeDb(roteiroCanal(null, 'boom'))), SITE, 'UC1')).toHaveProperty('erro')
    expect(await canalApagado(sb(fakeDb(roteiroCanal(null))), SITE, 'UC1')).toHaveProperty('erro')
    expect(await canalApagado(sb(fakeDb(roteiroCanal([{ id: 'x' }]))), SITE, 'UC1')).toHaveProperty('erro')
  })
})
