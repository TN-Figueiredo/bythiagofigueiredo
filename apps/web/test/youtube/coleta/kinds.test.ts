// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { COLLECTION_KINDS, KIND_RE, ehKind } from '@/lib/youtube/coleta/kinds'
import { COLLECTION_KINDS as REEXPORTADO } from '@/lib/youtube/coleta/types'
import { registrarTentativa } from '@/lib/youtube/coleta/attempts'
import type { AttemptKind, Tentativa } from '@/lib/youtube/coleta/types'
import { fakeSupabase } from './fake-supabase'

describe('catálogo de kind', () => {
  it('todo valor do catálogo casa com KIND_RE e não se repete', () => {
    for (const k of COLLECTION_KINDS) expect(KIND_RE.test(k)).toBe(true)
    expect(new Set(COLLECTION_KINDS).size).toBe(COLLECTION_KINDS.length)
  })
  it('os seis valores antigos continuam no catálogo', () => {
    for (const k of ['sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida']) {
      expect(COLLECTION_KINDS).toContain(k)
    }
  })
  it('o catálogo tem os onze valores, na ordem do plano, e types.ts o reexporta', () => {
    expect([...COLLECTION_KINDS]).toEqual([
      'sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida', 'retencao_7d', 'retencao_30d',
      'dimensoes', 'normalizador_trafego', 'normalizador_alcance_dim',
    ])
    expect(REEXPORTADO).toBe(COLLECTION_KINDS)
  })
  it('ehKind aceita só o catálogo', () => {
    for (const k of COLLECTION_KINDS) expect(ehKind(k)).toBe(true)
    for (const x of ['Ruim!', '', 'DIARIO', ' diario', 'diario ', null, undefined, 3, {}, ['diario']]) expect(ehKind(x)).toBe(false)
  })
  it('KIND_RE recusa maiúscula, símbolo, vazio e mais de 40 caracteres', () => {
    expect(KIND_RE.test('a'.repeat(40))).toBe(true)
    for (const x of ['', 'Ruim', 'a-b', 'a b', 'a'.repeat(41), 'ação']) expect(KIND_RE.test(x)).toBe(false)
  })
  it('registrarTentativa com kind forjado não chama a rpc e deixa a falha', async () => {
    const db = fakeSupabase()
    const ctx = { supabase: db.client, falhas: [] as string[], tentativas: [] as Tentativa[] }
    const forjado = 'x'.repeat(80) as unknown as AttemptKind
    await registrarTentativa(ctx, { site_id: 's', scope_type: 'video', scope_id: 'v', kind: forjado, outcome: 'ok' })
    await registrarTentativa(ctx, { site_id: 's', scope_type: 'video', scope_id: 'v', kind: forjado, outcome: 'ok' })
    expect(db.rpcCalls).toEqual([])
    expect(ctx.falhas).toEqual([`tentativa com kind fora do catálogo: ${'x'.repeat(40)}`])
    expect(ctx.tentativas).toEqual([])
  })
  it('registrarTentativa com kind do catálogo continua chamando a rpc', async () => {
    const db = fakeSupabase()
    const ctx = { supabase: db.client, falhas: [] as string[], tentativas: [] as Tentativa[] }
    await registrarTentativa(ctx, { site_id: 's', scope_type: 'canal', scope_id: 'c', kind: 'dimensoes', outcome: 'ok' })
    expect(db.rpcCalls).toHaveLength(1)
    expect(ctx.falhas).toEqual([])
  })
})
