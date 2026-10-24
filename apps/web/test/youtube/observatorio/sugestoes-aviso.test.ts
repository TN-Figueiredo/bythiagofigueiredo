// @vitest-environment node
/** F3 T6: `saiuDoAviso` — a faixa "algumas saíram" só quando o aviso é do próprio usuário e algum id dele não está mais aberto. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const captureMessage = vi.fn()
const contarAbertosEntre = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/sinais/leitura', () => ({ contarAbertosEntre: (...a: unknown[]) => contarAbertosEntre(...a) }))

import { saiuDoAviso } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/aviso'

const AGORA = new Date('2026-10-23T12:00:00Z')
const idn = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`

interface Linha { payload: unknown }
function banco(linha: Linha | null | 'erro') {
  const log: unknown[][] = []
  const chain: Record<string, unknown> = {}
  for (const k of ['select', 'eq']) chain[k] = (...a: unknown[]) => { log.push([k, ...a]); return chain }
  chain.maybeSingle = async () => (linha === 'erro' ? { data: null, error: { message: 'x' } } : { data: linha, error: null })
  const sb = { from: (t: string) => { log.push(['from', t]); return chain } }
  return { sb: sb as never, log }
}

beforeEach(() => { captureMessage.mockReset(); contarAbertosEntre.mockReset() })

describe('saiuDoAviso', () => {
  it('chave fora do formato: false sem ir ao banco', async () => {
    for (const k of ['', 'outra:abc', 'nicho:', 'nicho:' + 'a'.repeat(81), 'nicho:a b', 'nicho-resumo', undefined as unknown as string, 'x'.repeat(5000)]) {
      const { sb, log } = banco({ payload: {} })
      expect(await saiuDoAviso(sb, 's', 'u', k, AGORA)).toBe(false)
      expect(log).toEqual([])
    }
  })
  it('aviso de outro usuário ou inexistente: false (a consulta filtra por site, usuário e chave)', async () => {
    const { sb, log } = banco(null)
    expect(await saiuDoAviso(sb, 'site1', 'user1', `nicho:${idn(1)}`, AGORA)).toBe(false)
    expect(log).toEqual(expect.arrayContaining([['from', 'notifications'], ['eq', 'site_id', 'site1'], ['eq', 'user_id', 'user1'], ['eq', 'dedup_key', `nicho:${idn(1)}`]]))
    expect(contarAbertosEntre).not.toHaveBeenCalled()
  })
  it('individual ainda aberto: false; individual fechado: true', async () => {
    const { sb } = banco({ payload: {} })
    contarAbertosEntre.mockResolvedValueOnce(1)
    expect(await saiuDoAviso(sb, 's', 'u', `nicho:${idn(1)}`, AGORA)).toBe(false)
    expect(contarAbertosEntre).toHaveBeenLastCalledWith(sb, 's', [idn(1)], AGORA)
    contarAbertosEntre.mockResolvedValueOnce(0)
    expect(await saiuDoAviso(sb, 's', 'u', `nicho:${idn(1)}`, AGORA)).toBe(true)
  })
  it('resumo de 3 com 1 dispensado: true', async () => {
    const { sb } = banco({ payload: { ids: [idn(1), idn(2), idn(3)] } })
    contarAbertosEntre.mockResolvedValue(2)
    expect(await saiuDoAviso(sb, 's', 'u', 'nicho-resumo:2026-10-23', AGORA)).toBe(true)
  })
  it('resumo de 450 com o 420º dispensado: true', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => idn(i))
    const { sb } = banco({ payload: { ids } })
    contarAbertosEntre.mockResolvedValue(449)
    expect(await saiuDoAviso(sb, 's', 'u', 'nicho-resumo:x', AGORA)).toBe(true)
    expect(contarAbertosEntre.mock.calls[0]![2]).toHaveLength(450)
  })
  it('resumo com id repetido ([a, a, b], ambos abertos): false', async () => {
    const { sb } = banco({ payload: { ids: [idn(1), idn(1), idn(2)] } })
    contarAbertosEntre.mockResolvedValue(2)
    expect(await saiuDoAviso(sb, 's', 'u', 'nicho-resumo:x', AGORA)).toBe(false)
  })
  it('payload sem ids / ids não-array / ids vazios: false', async () => {
    for (const payload of [undefined, null, {}, { ids: 'x' }, { ids: [] }, { ids: [1, 2] }]) {
      const { sb } = banco({ payload })
      expect(await saiuDoAviso(sb, 's', 'u', 'nicho-resumo:x', AGORA)).toBe(false)
    }
    expect(contarAbertosEntre).not.toHaveBeenCalled()
  })
  it('contarAbertosEntre nulo: false (nunca null < n) e Sentry', async () => {
    const { sb } = banco({ payload: { ids: [idn(1), idn(2)] } })
    contarAbertosEntre.mockResolvedValue(null)
    expect(await saiuDoAviso(sb, 's', 'u', 'nicho-resumo:x', AGORA)).toBe(false)
    expect(captureMessage).toHaveBeenCalledWith('sugestoes: contagem do aviso nula', { level: 'warning' })
  })
  it('exceção na contagem: false e Sentry', async () => {
    const { sb } = banco({ payload: { ids: [idn(1)] } })
    contarAbertosEntre.mockRejectedValue(new Error('boom'))
    expect(await saiuDoAviso(sb, 's', 'u', 'nicho-resumo:x', AGORA)).toBe(false)
    expect(captureMessage).toHaveBeenCalledWith('sugestoes: saiuDoAviso falhou', { level: 'warning' })
  })
  it('erro na leitura da notificação: false e Sentry', async () => {
    const { sb } = banco('erro')
    expect(await saiuDoAviso(sb, 's', 'u', `nicho:${idn(1)}`, AGORA)).toBe(false)
    expect(captureMessage).toHaveBeenCalledWith('sugestoes: saiuDoAviso falhou', { level: 'warning' })
  })
})
