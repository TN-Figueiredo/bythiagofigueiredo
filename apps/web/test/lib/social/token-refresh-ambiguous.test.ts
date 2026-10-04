// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Guarda contra conexão ambígua: `ensureFreshToken(site, 'youtube')` sem conta
 * não pode escolher "a conexão conectada por último" quando o site tem mais de
 * um canal conectado.
 *
 * O banco de mentira guarda linhas de `social_connections` e aplica os filtros
 * de verdade (`eq`, `is null`, ordem por `connected_at`), para o teste não
 * depender da forma da cadeia de chamadas.
 */
interface Row {
  id: string
  site_id: string
  provider: string
  account_id: string
  connected_at: string
  revoked_at: string | null
  access_token_enc: string
  refresh_token_enc: string | null
  token_expires_at: string
  metadata: null
  bluesky_did: null
  bluesky_access_jwt_enc: null
  bluesky_refresh_jwt_enc: null
  bluesky_jwt_expires_at: null
}

let rows: Row[] = []
let countError: { message: string } | null = null

function query() {
  let filtered = [...rows]
  let head = false
  const q = {
    select(_cols: string, opts?: { count?: string; head?: boolean }) {
      head = !!opts?.head
      return q
    },
    eq(col: string, val: string) {
      filtered = filtered.filter((r) => (r as unknown as Record<string, unknown>)[col] === val)
      return q
    },
    is(col: string, val: null) {
      filtered = filtered.filter((r) => (r as unknown as Record<string, unknown>)[col] === val)
      return q
    },
    order(col: string, o: { ascending: boolean }) {
      filtered.sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[col])
        const bv = String((b as unknown as Record<string, unknown>)[col])
        return o.ascending ? av.localeCompare(bv) : bv.localeCompare(av)
      })
      return q
    },
    limit(n: number) {
      filtered = filtered.slice(0, n)
      return q
    },
    async single() {
      if (filtered.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      return { data: filtered[0], error: null }
    },
    then(resolve: (v: unknown) => void) {
      if (head) {
        resolve(countError ? { count: null, error: countError } : { count: filtered.length, error: null })
        return
      }
      resolve({ data: filtered, error: null })
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: () => query() }),
}))
vi.mock('@tn-figueiredo/social/vault', () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ''),
  getMasterKey: () => Buffer.from('k'),
}))

import {
  ensureFreshToken,
  AmbiguousConnectionError,
  NoActiveConnectionError,
} from '@/lib/social/token-refresh'

const HOUR = 3600_000
function conn(over: Partial<Row>): Row {
  return {
    id: 'c',
    site_id: 'site-1',
    provider: 'youtube',
    account_id: 'UCpt',
    connected_at: new Date(Date.now() - 10 * HOUR).toISOString(),
    revoked_at: null,
    access_token_enc: 'enc:tok',
    refresh_token_enc: null,
    token_expires_at: new Date(Date.now() + 2 * HOUR).toISOString(),
    metadata: null,
    bluesky_did: null,
    bluesky_access_jwt_enc: null,
    bluesky_refresh_jwt_enc: null,
    bluesky_jwt_expires_at: null,
    ...over,
  }
}

/** PT conectado primeiro; EN reconectado depois — "a mais recente" é a do OUTRO canal. */
const PT = conn({ id: 'c-pt', account_id: 'UCpt', access_token_enc: 'enc:tok-pt', connected_at: new Date(Date.now() - 48 * HOUR).toISOString() })
const EN = conn({ id: 'c-en', account_id: 'UCen', access_token_enc: 'enc:tok-en', connected_at: new Date(Date.now() - 1 * HOUR).toISOString() })

beforeEach(() => {
  rows = []
  countError = null
})

describe('ensureFreshToken — youtube sem conta', () => {
  it('uma conexão ativa: devolve o token dela, como hoje', async () => {
    rows = [PT]
    await expect(ensureFreshToken('site-1', 'youtube')).resolves.toEqual({
      accessToken: 'tok-pt',
      connectionId: 'c-pt',
    })
  })

  it('duas conexões ativas: recusa com AmbiguousConnectionError (count 2), em vez de pegar a mais recente', async () => {
    rows = [PT, EN]
    const err = await ensureFreshToken('site-1', 'youtube').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AmbiguousConnectionError)
    expect((err as AmbiguousConnectionError).count).toBe(2)
    expect((err as AmbiguousConnectionError).provider).toBe('youtube')
    expect((err as AmbiguousConnectionError).name).toBe('AmbiguousConnectionError')
    expect((err as Error).message).toMatch(/2 active youtube connections/)
  })

  it('zero conexões: o erro de hoje ("No active youtube connection…")', async () => {
    rows = []
    const err = await ensureFreshToken('site-1', 'youtube').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NoActiveConnectionError)
    expect(err).not.toBeInstanceOf(AmbiguousConnectionError)
    expect((err as Error).message).toBe('No active youtube connection found for site site-1')
  })

  it('conexão revogada não conta: uma ativa + uma revogada (a mais recente) devolve a ativa', async () => {
    rows = [PT, { ...EN, revoked_at: new Date().toISOString(), access_token_enc: '' }]
    await expect(ensureFreshToken('site-1', 'youtube')).resolves.toMatchObject({ accessToken: 'tok-pt' })
  })

  it('conexão de outro site não conta', async () => {
    rows = [PT, { ...EN, site_id: 'site-2' }]
    await expect(ensureFreshToken('site-1', 'youtube')).resolves.toMatchObject({ accessToken: 'tok-pt' })
  })

  it('a contagem falhou: recusa (não cai no "mais recente")', async () => {
    rows = [PT, EN]
    countError = { message: 'statement timeout' }
    await expect(ensureFreshToken('site-1', 'youtube')).rejects.toThrow(/statement timeout/)
  })
})

describe('ensureFreshToken — youtube com conta', () => {
  it('nunca é ambíguo: devolve o token do canal pedido, mesmo sendo o mais antigo', async () => {
    rows = [PT, EN]
    await expect(ensureFreshToken('site-1', 'youtube', 'UCpt')).resolves.toMatchObject({ accessToken: 'tok-pt' })
    await expect(ensureFreshToken('site-1', 'youtube', 'UCen')).resolves.toMatchObject({ accessToken: 'tok-en' })
  })

  it('conta revogada: "No active…", nunca o token do outro canal', async () => {
    rows = [{ ...PT, revoked_at: new Date().toISOString(), access_token_enc: '' }, EN]
    await expect(ensureFreshToken('site-1', 'youtube', 'UCpt')).rejects.toThrow(
      'No active youtube connection found for site site-1',
    )
  })
})

describe('ensureFreshToken — outros provedores', () => {
  it('instagram sem conta e duas conexões: comportamento de hoje (a mais recente)', async () => {
    rows = [
      conn({ id: 'ig-old', provider: 'instagram', account_id: 'ig1', access_token_enc: 'enc:ig-old', connected_at: new Date(Date.now() - 48 * HOUR).toISOString(), token_expires_at: new Date(Date.now() + 30 * 24 * HOUR).toISOString() }),
      conn({ id: 'ig-new', provider: 'instagram', account_id: 'ig2', access_token_enc: 'enc:ig-new', connected_at: new Date(Date.now() - 1 * HOUR).toISOString(), token_expires_at: new Date(Date.now() + 30 * 24 * HOUR).toISOString() }),
    ]
    await expect(ensureFreshToken('site-1', 'instagram')).resolves.toEqual({
      accessToken: 'ig-new',
      connectionId: 'ig-new',
    })
  })
})
