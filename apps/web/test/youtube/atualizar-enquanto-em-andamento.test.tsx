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
    expect(refresh).toHaveBeenCalledTimes(29) // ticks de 10 s a 290 s; o do 300º s tem 6 min exatos e para (o parecer dizia 30)
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(29)
  })
  it('data inválida: nunca chama', () => {
    render(<AtualizarEnquantoEmAndamento emAndamentoDesde="lixo" />)
    vi.advanceTimersByTime(120_000)
    expect(refresh).not.toHaveBeenCalled()
  })
  it('troca de prop reinicia o intervalo', () => {
    const { rerender } = render(<AtualizarEnquantoEmAndamento emAndamentoDesde="2026-10-12T08:59:00Z" />)
    vi.advanceTimersByTime(5_000)
    rerender(<AtualizarEnquantoEmAndamento emAndamentoDesde="2026-10-12T08:59:30Z" />)
    vi.advanceTimersByTime(9_000) // 14 s desde o início, 9 s desde a troca: o intervalo antigo não dispara
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    expect(refresh).toHaveBeenCalledTimes(1)
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
