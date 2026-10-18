import { describe, it, expect, vi } from 'vitest'

describe('horaSP não depende do fuso do processo', () => {
  it.each(['Asia/Tokyo', 'America/Sao_Paulo'])('TZ=%s', async tz => {
    vi.stubEnv('TZ', tz)
    process.env.TZ = tz
    vi.resetModules()
    const { horaSP } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/faixa-restauracao-texto')
    expect(horaSP('2026-10-12T08:02:00Z')).toBe('12/10 05:02')
    expect(horaSP('2026-10-13T02:59:00Z')).toBe('12/10 23:59')
    vi.unstubAllEnvs()
  })
})
