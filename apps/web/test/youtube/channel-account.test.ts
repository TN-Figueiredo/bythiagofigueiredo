// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { channelAccountIdForVideo } from '@/lib/youtube/channel-account'

/**
 * Banco de mentira com dois canais no mesmo site (PT `UCpt`, EN `UCen`) e um
 * vídeo de cada. Só `youtube_videos` responde: o resolvedor não tem motivo
 * para ler outra tabela.
 */
const VIDEOS: Record<string, { youtube_channels: { channel_id: string } | null }> = {
  'vid-pt': { youtube_channels: { channel_id: 'UCpt' } },
  'vid-en': { youtube_channels: { channel_id: 'UCen' } },
}

function fakeDb(opts: { error?: { code?: string; message: string } } = {}) {
  const calls: { table: string; cols: string; id: string }[] = []
  const from = vi.fn((table: string) => ({
    select: (cols: string) => ({
      eq: (_col: string, id: string) => ({
        single: async () => {
          calls.push({ table, cols, id })
          if (opts.error) return { data: null, error: opts.error }
          const row = VIDEOS[id]
          if (!row) {
            return {
              data: null,
              error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
            }
          }
          return { data: row, error: null }
        },
      }),
    }),
  }))
  return { client: { from } as unknown as SupabaseClient<Database>, calls }
}

describe('channelAccountIdForVideo', () => {
  it('vídeo do canal PT devolve o id UC do PT', async () => {
    const { client, calls } = fakeDb()
    expect(await channelAccountIdForVideo(client, 'vid-pt')).toBe('UCpt')
    expect(calls).toEqual([
      { table: 'youtube_videos', cols: 'youtube_channels!inner(channel_id)', id: 'vid-pt' },
    ])
  })

  it('vídeo do canal EN devolve o id UC do EN (não "o primeiro canal do site")', async () => {
    const { client } = fakeDb()
    expect(await channelAccountIdForVideo(client, 'vid-en')).toBe('UCen')
  })

  it('vídeo inexistente devolve null', async () => {
    const { client } = fakeDb()
    expect(await channelAccountIdForVideo(client, 'vid-que-nao-existe')).toBeNull()
  })

  it('erro do banco lança — não vira null', async () => {
    const { client } = fakeDb({ error: { code: '57014', message: 'statement timeout' } })
    await expect(channelAccountIdForVideo(client, 'vid-pt')).rejects.toThrow(/statement timeout/)
  })

  it('erro do banco sem código também lança', async () => {
    const { client } = fakeDb({ error: { message: 'connection reset' } })
    await expect(channelAccountIdForVideo(client, 'vid-pt')).rejects.toThrow(/connection reset/)
  })
})
