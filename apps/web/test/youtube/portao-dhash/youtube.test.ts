// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', () => ({ channelAccountIdForVideo: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))

import { escritorCom, ErroYouTube } from '@/lib/youtube/portao-dhash/youtube'

describe('escritorCom', () => {
  it('definirThumb faz POST com image/jpeg e Bearer, pedindo o token a cada chamada', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }))
    const token = vi.fn(async () => 'tok')
    const e = escritorCom('UC1', token, f as unknown as typeof fetch)
    await e.definirThumb('6jL-jeux_1Y', Buffer.from('jpg'))
    await e.definirThumb('6jL-jeux_1Y', Buffer.from('jpg'))
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=6jL-jeux_1Y&uploadType=media')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok', 'Content-Type': 'image/jpeg' })
    expect(token).toHaveBeenCalledTimes(2)
  })
  it('403 quotaExceeded lança ErroYouTube com status e reason', async () => {
    const f = async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })
    const e = escritorCom('UC1', async () => 't', f as unknown as typeof fetch)
    const err = await e.definirThumb('v', Buffer.from('x')).catch((x: unknown) => x)
    expect(err).toBeInstanceOf(ErroYouTube)
    expect(err).toMatchObject({ status: 403, reason: 'quotaExceeded' })
  })
  it('corpo ilegível dá reason null', async () => {
    const f = async () => new Response('<html>', { status: 500 })
    const e = escritorCom('UC1', async () => 't', f as unknown as typeof fetch)
    expect(await e.definirThumb('v', Buffer.from('x')).catch((x: unknown) => x)).toMatchObject({ status: 500, reason: null })
  })
  it('conferirVideo: items vazio → null; com item → canal e privacidade', async () => {
    const vazio = escritorCom('UC1', async () => 't', (async () => new Response(JSON.stringify({ items: [] }))) as unknown as typeof fetch)
    expect(await vazio.conferirVideo('v')).toBeNull()
    const corpo = { items: [{ snippet: { channelId: 'UC1' }, status: { privacyStatus: 'public' } }] }
    const cheio = escritorCom('UC1', async () => 't', (async () => new Response(JSON.stringify(corpo))) as unknown as typeof fetch)
    expect(await cheio.conferirVideo('v')).toEqual({ canal: 'UC1', privacidade: 'public' })
  })
})
