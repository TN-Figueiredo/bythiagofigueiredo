// @vitest-environment node
// A4 T1: `resposta_sha256` vai nos params de toda resposta `ok` entregue (hash do texto entregue); recusa não leva a chave.
import { createHash } from 'node:crypto'
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { comContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import { executarChamada, type Responder, type Resposta } from '@/lib/pipeline/mcp/observatorio/executar'

const AGORA = 1_800_000_000_000
const prova = () => fabricarProva('3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', '9a1b2c3d-0000-4000-8000-00000000aaaa', '7c1d2e3f-0000-4000-8000-00000000bbbb', '2999-01-01T00:00:00Z')

function rodar(resposta: Resposta) {
  const linhas: Array<Record<string, unknown>> = []
  const sb = {
    rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1, no_dia_pessoa: 1 }], error: null }) }),
    from: () => ({ insert: (l: Record<string, unknown>) => ({ abortSignal: async () => { linhas.push(l); return { error: null } } }) }),
  }
  const responder: Responder = async () => resposta
  const ctx = { prova: prova(), acesso: { leitura: null, edita: false, negativa: 'sem_direito' as const }, t0: AGORA }
  return comContextoDoObservatorio(ctx, () => executarChamada({ acao: 'listar_canais' }, { sb: sb as never, responder, agora: () => AGORA })).then((r) => ({ r, linhas }))
}

describe('A4 T1: resposta_sha256', () => {
  it('ok: a linha tem o sha256 do texto entregue', async () => {
    const texto = ' canais: ação ✓ — acentuação\n'
    const { r, linhas } = await rodar({ texto, desfecho: 'ok', incluiuPrivado: false, params: { acao: 'listar_canais' } })
    expect(r.texto).toBe(texto)
    const esperado = createHash('sha256').update(texto, 'utf8').digest('hex')
    expect((linhas[0]!.params as Record<string, unknown>).resposta_sha256).toBe(esperado)
  })
  it('pedido_invalido: sem a chave', async () => {
    const { linhas } = await rodar({ texto: 'recusa', desfecho: 'pedido_invalido', incluiuPrivado: false, params: {} })
    expect(linhas[0]!.params as Record<string, unknown>).not.toHaveProperty('resposta_sha256')
  })
  it('nao_encontrado e falhou: sem a chave', async () => {
    for (const d of ['nao_encontrado', 'falhou'] as const) {
      const { linhas } = await rodar({ texto: 'x', desfecho: d, incluiuPrivado: false, params: {} })
      expect(linhas[0]!.params as Record<string, unknown>).not.toHaveProperty('resposta_sha256')
    }
  })
  it('o chamador não escolhe o hash: o que vem em params é sobrescrito pelo do texto', async () => {
    const { linhas } = await rodar({ texto: 'abc', desfecho: 'ok', incluiuPrivado: false, params: { resposta_sha256: 'a'.repeat(64) } })
    expect((linhas[0]!.params as Record<string, unknown>).resposta_sha256).toBe(createHash('sha256').update('abc', 'utf8').digest('hex'))
  })
})
