import { describe, it, expect, vi } from 'vitest'
import {
  duracaoDoVideo, dataHoraDePublicacao, dataDePublicacao, textoDeVisualizacoes,
} from '@/lib/youtube/ab-linha-video'

describe('ab-linha-video', () => {
  it('duracaoDoVideo', () => {
    expect(duracaoDoVideo(768)).toBe('12:48')
    expect(duracaoDoVideo(3725)).toBe('1:02:05')
    expect(duracaoDoVideo(0)).toBeNull()
  })
  it('datas em America/Sao_Paulo, mês abreviado sem ponto', () => {
    expect(dataHoraDePublicacao('2026-10-21T21:32:00Z')).toBe('21 out 2026, 18:32')
    expect(dataHoraDePublicacao('2026-10-02T12:40:00Z')).toBe('02 out 2026, 09:40')
    expect(dataDePublicacao('2026-10-21T21:32:00Z')).toBe('21 out 2026')
  })
  it('textoDeVisualizacoes', () => {
    expect(textoDeVisualizacoes(12345)).toBe('12.345 visualizações')
    expect(textoDeVisualizacoes(1)).toBe('1 visualização')
    expect(textoDeVisualizacoes(0)).toBe('0 visualizações')
  })
  it('não recria o formatador por chamada', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat')
    dataHoraDePublicacao('2026-10-21T21:32:00Z')
    dataHoraDePublicacao('2026-10-22T21:32:00Z')
    dataDePublicacao('2026-10-22T21:32:00Z')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
