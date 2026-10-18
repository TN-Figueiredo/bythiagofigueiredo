// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LockCountdown } from '@/app/cms/(authed)/youtube/ab-lab/_components/lock-countdown'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

// 02:30Z de 13/10 = 23:30 de 12/10 em São Paulo; em Tóquio o relógio local já diz 13/10.
describe('LockCountdown: data no fuso do canal (D5)', () => {
  it.each(['Asia/Tokyo', 'America/Sao_Paulo'])('TZ=%s mostra 12 de outubro', tz => {
    vi.stubEnv('TZ', tz)
    process.env.TZ = tz
    const { container } = render(
      <LockCountdown dayOf={1} durationDays={14} confidence={0} confidenceTarget={95} cyclesCompleted={0} createdAt="2026-10-13T02:30:00Z" />,
    )
    expect(container.textContent).toMatch(/12\s+de\s+out|12\s+out/i)
    expect(container.textContent).not.toMatch(/13\s+de\s+out|13\s+out/i)
    void screen
  })
})
