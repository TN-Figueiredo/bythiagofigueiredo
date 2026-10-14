// A5 E5a, Tarefa 2: lerExtrasDosCanais.
import { describe, expect, it } from 'vitest'
import { lerExtrasDosCanais } from '@/lib/youtube/observatorio/medidas-telas/ler-extras-dos-canais'
import { falsoPostgrest } from './medidas-fixture'

const linha = (id: string, site: string, extra: Record<string, unknown> = {}) => ({ id, site_id: site, missing_since: null, subscribers_hidden: false, last_ok_synced_at: '2026-10-13T10:00:00Z', ...extra })

describe('E5a T2: lerExtrasDosCanais', () => {
  it('lê só os canais do site (mutação: sem o filtro devolveria o de outro site)', async () => {
    const { sb, consultas } = falsoPostgrest({ competitor_channels: [linha('a', 's1'), linha('b', 's2', { subscribers_hidden: true })] })
    const r = await lerExtrasDosCanais(sb, { siteId: 's1' })
    expect(r.lido).toBe(true)
    if (!r.lido) return
    expect([...r.dados.keys()]).toEqual(['a'])
    expect(consultas[0]!.filtros).toContainEqual({ op: 'eq', coluna: 'site_id', valor: 's1' })
  })
  it('traz os três campos, nulos ficam nulos', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: [linha('a', 's1', { missing_since: '2026-10-01T00:00:00Z', subscribers_hidden: null, last_ok_synced_at: null })] })
    const r = await lerExtrasDosCanais(sb, { siteId: 's1' })
    expect(r.lido && r.dados.get('a')).toEqual({ missingSince: '2026-10-01T00:00:00Z', subscribersHidden: null, lastOkSyncedAt: null })
  })
  it('extras não lidos: parte não lida com a causa, nunca mapa vazio', async () => {
    const { sb } = falsoPostgrest({}, { erros: { competitor_channels: { code: 'XX000', message: 'segredo' } } })
    expect(await lerExtrasDosCanais(sb, { siteId: 's1' })).toEqual({ lido: false, causa: 'erro_do_banco' })
    const f = falsoPostgrest({}, { lancam: ['competitor_channels'] })
    expect(await lerExtrasDosCanais(f.sb, { siteId: 's1' })).toEqual({ lido: false, causa: 'erro_do_banco' })
    const g = falsoPostgrest({})
    expect(await lerExtrasDosCanais(g.sb, { siteId: 's1' })).toEqual({ lido: false, causa: 'schema_ausente' })
  })
  it('pagina: 1.200 canais voltam inteiros', async () => {
    const todos = Array.from({ length: 1200 }, (_, k) => linha('c' + String(k).padStart(4, '0'), 's1'))
    const { sb } = falsoPostgrest({ competitor_channels: todos })
    const r = await lerExtrasDosCanais(sb, { siteId: 's1' })
    expect(r.lido && r.dados.size).toBe(1200)
  })
})
