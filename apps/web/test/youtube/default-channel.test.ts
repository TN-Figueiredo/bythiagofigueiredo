// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { defaultOwnChannel, pickDefaultChannel } from '@/lib/youtube/default-channel'

const SITE = 'site-1'
const ch = (id: string, uc: string, created_at: string, locale = 'pt') => ({
  id, channel_id: uc, name: `Canal ${id}`, locale, created_at, site_id: SITE,
})
const conn = (uc: string, revoked_at: string | null = null) => ({
  site_id: SITE, provider: 'youtube', account_id: uc, revoked_at,
})

function fake(tables: Record<string, unknown[]>, errorOn?: string) {
  const make = (table: string) => {
    let rows = [...((tables[table] ?? []) as Array<Record<string, unknown>>)]
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b)
    b.is = (c: string, v: unknown) => ((rows = rows.filter((r) => (r[c] ?? null) === v)), b)
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(
        errorOn === table ? { data: null, error: { message: 'statement timeout' } } : { data: rows, error: null },
      ).then(res, rej)
    return b
  }
  return { from: make } as never
}

describe('defaultOwnChannel', () => {
  it('EN antigo sem OAuth + PT com OAuth → PT', async () => {
    const db = fake({
      youtube_channels: [ch('en', 'UC_EN', '2025-01-01T00:00:00Z', 'en'), ch('pt', 'UC_PT', '2025-06-01T00:00:00Z')],
      social_connections: [conn('UC_PT')],
    })
    expect(await defaultOwnChannel(db, SITE)).toMatchObject({ id: 'pt', channelId: 'UC_PT', hasConnection: true })
  })

  it('nenhum com OAuth → o mais antigo, marcado sem conexão', async () => {
    const db = fake({
      youtube_channels: [ch('b', 'UC_B', '2025-06-01T00:00:00Z'), ch('a', 'UC_A', '2025-01-01T00:00:00Z')],
      social_connections: [conn('UC_A', '2026-01-01T00:00:00Z')],
    })
    expect(await defaultOwnChannel(db, SITE)).toMatchObject({ id: 'a', hasConnection: false })
  })

  it('três canais: o primeiro em cadastro entre os que têm OAuth; empate desempata por id', async () => {
    const db = fake({
      youtube_channels: [
        ch('c', 'UC_C', '2025-03-01T00:00:00Z'),
        ch('z', 'UC_Z', '2025-02-01T00:00:00Z'),
        ch('y', 'UC_Y', '2025-02-01T00:00:00Z'),
      ],
      social_connections: [conn('UC_C'), conn('UC_Z'), conn('UC_Y')],
    })
    expect((await defaultOwnChannel(db, SITE))?.id).toBe('y')
  })

  it('o dado não existe: zero canais → null', async () => {
    expect(await defaultOwnChannel(fake({}), SITE)).toBeNull()
  })

  it('erro de banco lança (nunca null)', async () => {
    const t = { youtube_channels: [ch('a', 'UC_A', '2025-01-01T00:00:00Z')] }
    await expect(defaultOwnChannel(fake(t, 'social_connections'), SITE)).rejects.toThrow(/statement timeout/)
    await expect(defaultOwnChannel(fake(t, 'youtube_channels'), SITE)).rejects.toThrow(/statement timeout/)
  })
})

describe('pickDefaultChannel', () => {
  it('é pura: não muta a entrada', () => {
    const rows = [ch('b', 'UC_B', '2025-06-01T00:00:00Z'), ch('a', 'UC_A', '2025-01-01T00:00:00Z')]
    const copy = [...rows]
    pickDefaultChannel(rows, new Set(['UC_B']))
    expect(rows).toEqual(copy)
  })
})
