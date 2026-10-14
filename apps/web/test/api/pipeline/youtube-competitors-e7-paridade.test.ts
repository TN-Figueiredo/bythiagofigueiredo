// @vitest-environment node
// A5 · E7, Tarefa 2: o corpo de hoje de `changes` e `channels`, congelado antes de a etapa mexer no serviço (itens 9, 51, 216),
// e os testes do falso de PostgREST em que o Lote 1 se apoia. Os retratos são os de `__retratos__/`.
// Quem muda o corpo de propósito regenera com `vitest -u` NESTE arquivo e diz no commit por quê.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listCompetitorChanges, listCompetitorChannels } from '@/lib/pipeline/services/competitors'
import { baseE7, criarBancoFalso, contextoDe, SITE_A, SITE_B, CANAL_B1, type Tabelas } from './e7-fixture'

const RETRATOS = join(process.cwd(), 'test/api/pipeline/__retratos__')
const NOVE_CHAVES = ['id', 'channel_id', 'channel_name', 'thumbnail_url', 'subscriber_count', 'video_count', 'last_synced_at', 'added_at', 'avg_engagement'] as const

function novo(): ReturnType<typeof criarBancoFalso> { return criarBancoFalso(baseE7()) }

async function changesDeHoje(): Promise<Record<string, unknown>> {
  const b = novo(), ctx = contextoDe(b)
  const corpo = async (f: Parameters<typeof listCompetitorChanges>[1]) => (await listCompetitorChanges(ctx, f)).data
  return {
    sem_filtro: await corpo({}),
    type_title: await corpo({ type: 'title' }),
    bookmarked_true: await corpo({ bookmarked: true }),
    limit_3: await corpo({ limit: 3 }),
  }
}

async function channelsDeHoje() {
  const r = (await listCompetitorChannels(contextoDe(novo()))).data
  return { count: r.count, channels: r.channels.map(c => Object.fromEntries(NOVE_CHAVES.map(k => [k, (c as unknown as Record<string, unknown>)[k]]))) }
}

describe('o corpo de hoje', () => {
  it('changes de hoje: o corpo é o do retrato', async () => {
    const h = await changesDeHoje()
    await expect(JSON.stringify(h, null, 2) + '\n').toMatchFileSnapshot(join(RETRATOS, 'e7-changes-hoje.json'))
  })

  it('changes de hoje com type, bookmarked e limit', async () => {
    const h = await changesDeHoje()
    const gravado = JSON.parse(readFileSync(join(RETRATOS, 'e7-changes-hoje.json'), 'utf8')) as Record<string, { changes: unknown[]; count: number }>
    for (const k of ['type_title', 'bookmarked_true', 'limit_3']) expect(JSON.stringify(h[k])).toBe(JSON.stringify(gravado[k]))
    expect(gravado['type_title']!.count).toBeGreaterThan(0)
    expect(gravado['limit_3']!.count).toBe(3)
  })

  it('channels de hoje: as nove chaves são as do retrato', async () => {
    await expect(JSON.stringify(await channelsDeHoje(), null, 2) + '\n').toMatchFileSnapshot(join(RETRATOS, 'e7-channels-hoje.json'))
  })

  it('o retrato tem linhas', () => {
    const ch = (JSON.parse(readFileSync(join(RETRATOS, 'e7-changes-hoje.json'), 'utf8')) as { sem_filtro: { changes: unknown[]; count: number } }).sem_filtro
    expect(ch.changes).toHaveLength(8)
    expect(ch.count).toBe(8)
    const cn = JSON.parse(readFileSync(join(RETRATOS, 'e7-channels-hoje.json'), 'utf8')) as { channels: unknown[]; count: number }
    expect(cn.channels).toHaveLength(3)
    expect(cn.count).toBe(3)
  })

  it('o site B não aparece no retrato de A', () => {
    const texto = readFileSync(join(RETRATOS, 'e7-changes-hoje.json'), 'utf8') + readFileSync(join(RETRATOS, 'e7-channels-hoje.json'), 'utf8')
    expect(texto).not.toContain(CANAL_B1)
    expect(texto).not.toContain('Outro')
    expect(texto).not.toContain(SITE_B)
  })
})

describe('o falso de PostgREST', () => {
  const tabelas = (): Tabelas => ({
    t: [
      { id: 3, k: 'a', n: 30, d: null, t: '2026-10-01T10:00:00.000001+00:00' },
      { id: 1, k: 'b', n: 10, d: 'x', t: '2026-10-01T10:00:00.000001+00:00' },
      { id: 2, k: 'a', n: 20, d: null, t: '2026-10-01T09:00:00.000000+00:00' },
      { id: 4, k: 'c', n: 40, d: 'y', t: '2026-10-01T10:00:00.000001+00:00' },
    ],
  })
  const ids = async (q: PromiseLike<{ data: unknown }>) => ((await q).data as Array<{ id: number }>).map(r => r.id)

  it('o falso recusa método que não conhece', () => {
    const b = criarBancoFalso(tabelas())
    const q = b.sb.from('t').select('*') as unknown as Record<string, unknown>
    expect(q['textSearch']).toBeUndefined()
    expect(() => (q['textSearch'] as () => void)()).toThrow()
  })

  it('eq, in, is, neq, order e range do falso filtram de verdade', async () => {
    const b = criarBancoFalso(tabelas())
    expect(await ids(b.sb.from('t').select('id').eq('k', 'a').order('id'))).toEqual([2, 3])
    expect(await ids(b.sb.from('t').select('id').in('id', [1, 4]).order('id'))).toEqual([1, 4])
    expect(await ids(b.sb.from('t').select('id').is('d', null).order('id'))).toEqual([2, 3])
    expect(await ids(b.sb.from('t').select('id').neq('k', 'a').order('id'))).toEqual([1, 4])
    expect(await ids(b.sb.from('t').select('id').order('n', { ascending: false }))).toEqual([4, 3, 2, 1])
    expect(await ids(b.sb.from('t').select('id').order('id').range(1, 2))).toEqual([2, 3])
    expect(await ids(b.sb.from('t').select('id').order('id').limit(1))).toEqual([1])
  })

  it('or do falso filtra a forma da continuação e lança nas outras', async () => {
    const b = criarBancoFalso(tabelas())
    // depois da linha de id 3 (t = 10:00:00.000001) na ordem t desc, id desc: t menor, ou igual com id menor
    const r = await ids(b.sb.from('t').select('id').or('t.lt."2026-10-01T10:00:00.000001+00:00",and(t.eq."2026-10-01T10:00:00.000001+00:00",id.lt.3)').order('id'))
    expect(r).toEqual([1, 2])
    await expect(Promise.resolve(b.sb.from('t').select('id').or('k.eq.a,k.eq.b'))).rejects.toThrow(/continuação/)
  })

  it('order decrescente sem nullsFirst põe os nulos primeiro', async () => {
    const b = criarBancoFalso(tabelas())
    expect(await ids(b.sb.from('t').select('id').order('d', { ascending: false }).order('id'))).toEqual([2, 3, 4, 1])
    expect(await ids(b.sb.from('t').select('id').order('d', { ascending: true }).order('id'))).toEqual([1, 4, 2, 3])
    expect(await ids(b.sb.from('t').select('id').order('d', { ascending: false, nullsFirst: false }).order('id'))).toEqual([4, 1, 2, 3])
  })

  it('a incorporação inner descarta a linha sem relação, e a tabela ausente devolve 42P01', async () => {
    const b = criarBancoFalso(baseE7())
    b.tabelas['competitor_videos'] = b.tabelas['competitor_videos']!.filter(v => v['id'] !== 'd00000001-0000-4000-8000-000000000000')
    const r = await b.sb.from('competitor_changes').select('id, competitor_videos!inner(title, competitor_channels!inner(channel_name))').eq('site_id', SITE_A)
    expect((r.data as unknown[]).length).toBeLessThan(8)
    b.falha('competitor_changes', 'ausente')
    const a = await b.sb.from('competitor_changes').select('id')
    expect(a.error?.code).toBe('42P01')
  })

  it('registra tabela, colunas, filtros e abortSignal', async () => {
    const b = criarBancoFalso(baseE7())
    await b.sb.from('competitor_channels').select('id, channel_name').eq('site_id', SITE_A).abortSignal(AbortSignal.timeout(1000))
    const c = b.doTabela('competitor_channels')[0]!
    expect(c.colunas).toEqual(['id', 'channel_name'])
    expect(c.filtros).toEqual([{ op: 'eq', coluna: 'site_id', valor: SITE_A }])
    expect(c.abortSignal).toBe(true)
  })
})
