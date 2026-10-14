// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { AtualizarEnquantoEmAndamento } from '@/app/cms/(authed)/youtube/ab-lab/_components/atualizar-enquanto-em-andamento'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T09:00:00Z')); refresh.mockReset() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('AtualizarEnquantoEmAndamento', () => {
  it('refresh a cada 10 s enquanto < 6 min; para aos 6 min', () => {
    render(<AtualizarEnquantoEmAndamento emAndamentoDesde="2026-10-12T08:59:00Z" />) // 1 min atrás
    vi.advanceTimersByTime(30_000)
    expect(refresh).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(6 * 60_000)
    const n = refresh.mock.calls.length
    expect(n).toBeLessThanOrEqual(3 + 30) // nunca passa dos 6 min de idade
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(n)
  })
  it('no unmount o intervalo some', () => {
    const { unmount } = render(<AtualizarEnquantoEmAndamento emAndamentoDesde="2026-10-12T08:59:00Z" />)
    vi.advanceTimersByTime(10_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    unmount()
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('sem em_andamento ou já com mais de 6 min: nunca chama', () => {
    render(<AtualizarEnquantoEmAndamento emAndamentoDesde={null} />)
    render(<AtualizarEnquantoEmAndamento emAndamentoDesde="2026-10-12T08:50:00Z" />)
    vi.advanceTimersByTime(120_000)
    expect(refresh).not.toHaveBeenCalled()
  })
})
