// @vitest-environment node
// A5 · E14, Tarefa 7b: o único caminho dos comentários para o Sentry. Só código e números.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureMessage = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ captureMessage }))

import { relatarComentarios } from '@/lib/youtube/observatorio/comentarios/relato'

beforeEach(() => captureMessage.mockClear())

describe('relatarComentarios', () => {
  it('relato: extra só leva números', () => {
    relatarComentarios('coletar', 'banco', { n: 3, texto: 'x' as never, nan: NaN, inf: Infinity, txt: '5' as never })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledWith('comentarios: coletar: banco', {
      level: 'error',
      tags: { component: 'sync-youtube', mode: 'comentarios', codigo: 'banco' },
      extra: { n: 3 },
    })
  })

  it('relato: código com texto livre vira codigo_invalido', () => {
    relatarComentarios('anular', 'Falhou: Autor Inventado SENTINELA', {})
    relatarComentarios('coletar', '', {})
    relatarComentarios('coletar', 'banco:23514', {})
    relatarComentarios('coletar', 'a'.repeat(100), {})
    const msgs = captureMessage.mock.calls.map((c) => c[0] as string)
    expect(msgs[0]).toBe('comentarios: anular: codigo_invalido')
    expect(msgs[1]).toBe('comentarios: coletar: codigo_invalido')
    expect(msgs[2]).toBe('comentarios: coletar: banco:23514')
    // 100 letras: cortado em 60 e depois aceito
    expect(msgs[3]).toBe('comentarios: coletar: ' + 'a'.repeat(60))
    const tag = (captureMessage.mock.calls[0][1] as { tags: { codigo: string } }).tags.codigo
    expect(tag).toBe('codigo_invalido')
    expect(JSON.stringify(captureMessage.mock.calls[0])).not.toContain('SENTINELA')
  })
})
