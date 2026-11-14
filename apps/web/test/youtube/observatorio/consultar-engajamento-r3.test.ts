// @vitest-environment node
/** C1 R3: engajamento entra nas métricas padrão da `consultar` (o servidor já calcula; a IA não divide curtidas por views). */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))

import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'

const consulta = (e: object) => {
  const t = traduzir(ENTRADA.parse({ acao: 'consultar', ...e }))
  if (!t.ok) throw new Error(t.frase)
  return t.pedido.consulta!
}

describe('R3: engajamento nas métricas padrão', () => {
  it('consultar sem `metricas` traz a coluna de engajamento (e as quatro de antes)', () => {
    const c = consulta({})
    expect(c.metricas).toEqual(expect.arrayContaining(['views', 'likes', 'comentarios', 'multiplicador', 'engajamento']))
  })
  it('com `metricas` explícito, o padrão não é imposto', () => {
    expect(consulta({ metricas: ['views'] }).metricas).not.toContain('engajamento')
  })
})
