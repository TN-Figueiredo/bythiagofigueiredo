// @vitest-environment node
// A5 · E7, Tarefa 2: o corpo de hoje de `changes` e `channels`, congelado antes de a etapa mexer no serviço (itens 9, 51, 216),
// e os testes do falso de PostgREST em que o Lote 1 se apoia. Os retratos são os de `__retratos__/`.
// Quem muda o corpo de propósito regenera com `vitest -u` NESTE arquivo e diz no commit por quê.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listCompetitorChanges, listCompetitorChannels } from '@/lib/pipeline/services/competitors'
import { baseE7, criarBancoFalso, contextoDe, aoDia, SITE_A, SITE_B, CANAL_A1, CANAL_A2, CANAL_B1, type Linha, type Tabelas } from './e7-fixture'

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

// ---------------------------------------------------------------------------
// Tarefa 5: a integração do Lote 1 (perfil em channels, campos=todos em changes)
// ---------------------------------------------------------------------------

const retratoDeChanges = () => JSON.parse(readFileSync(join(RETRATOS, 'e7-changes-hoje.json'), 'utf8')) as Record<string, { changes: unknown[]; count: number }>
const versaoDeCampo = (id: number, over: Linha): Linha => ({
  id, site_id: SITE_A, competitor_channel_id: CANAL_A1, video_id: null, field: 'name', value: 'x', first_seen_at: aoDia(2), last_seen_at: aoDia(2),
  window_start: null, precision: '1d', is_current: false, ...over,
})

describe('changes (Lote 1)', () => {
  it('sem o parâmetro é o corpo de hoje, byte a byte (itens 9 e 51)', async () => {
    const esperado = JSON.stringify(retratoDeChanges()['sem_filtro'])
    for (const f of [{}, { campos: null }, { campos: '' }, { campos: undefined }]) {
      const r = (await listCompetitorChanges(contextoDe(novo()), f)).data
      expect(JSON.stringify(r)).toBe(esperado)
      expect(Object.keys(r)).toEqual(['changes', 'count'])
    }
  })

  it('sem o parâmetro nenhuma consulta nova é feita', async () => {
    const b = novo()
    await listCompetitorChanges(contextoDe(b), {})
    expect(b.total('competitor_field_versions')).toBe(0)
  })

  it('com campos=todos: changes e count iguais aos de hoje, mais a chave', async () => {
    const b = novo()
    b.tabelas['competitor_field_versions'] = [versaoDeCampo(1, { precision: 'first', first_seen_at: aoDia(5) }), versaoDeCampo(2, { value: 'y' })]
    const r = (await listCompetitorChanges(contextoDe(b), { campos: 'todos' })).data
    const hoje = retratoDeChanges()['sem_filtro']!
    expect(JSON.stringify(r.changes)).toBe(JSON.stringify(hoje.changes))
    expect(r.count).toBe(hoje.count)
    expect(r.mudancas_de_campo?.estado).toBe('lido')
    expect(Object.keys(r)).toEqual(['changes', 'count', 'mudancas_de_campo'])
  })

  it('campos=todos usa o mesmo limite das trocas', async () => {
    const b = novo()
    b.tabelas['competitor_field_versions'] = [versaoDeCampo(1, { precision: 'first', first_seen_at: aoDia(5) }), versaoDeCampo(2, { value: 'y' })]
    const r = (await listCompetitorChanges(contextoDe(b), { campos: 'todos', limit: 3 })).data
    expect(r.mudancas_de_campo).toMatchObject({ estado: 'lido', limite: 3 })
  })

  it('campos=todos com a tabela ausente não derruba changes', async () => {
    const b = novo(); b.falha('competitor_field_versions', 'ausente')
    const r = (await listCompetitorChanges(contextoDe(b), { campos: 'todos' })).data
    expect(JSON.stringify(r.changes)).toBe(JSON.stringify(retratoDeChanges()['sem_filtro']!.changes))
    expect(r.mudancas_de_campo).toMatchObject({ estado: 'nao_lido', motivo: 'tabela_ausente' })
  })

  it.each(['tudo', 'TODOS', 'todos,x'])('campos=%s: 400 e nenhuma consulta', async valor => {
    const b = novo()
    await expect(listCompetitorChanges(contextoDe(b), { campos: valor })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(b.consultas).toHaveLength(0)
  })

  it('erro em competitor_changes continua 500, com e sem o parâmetro', async () => {
    for (const campos of [null, 'todos']) {
      const b = novo(); b.falha('competitor_changes', 'erro')
      await expect(listCompetitorChanges(contextoDe(b), { campos })).rejects.toMatchObject({ code: 'DB_ERROR', status: 500 })
    }
  })
})

describe('channels (Lote 1)', () => {
  it('as nove chaves de hoje não mudaram (item 216)', async () => {
    const gravado = JSON.parse(readFileSync(join(RETRATOS, 'e7-channels-hoje.json'), 'utf8')) as unknown
    expect(JSON.parse(JSON.stringify(await channelsDeHoje()))).toEqual(gravado)
  })

  it('todo canal tem perfil, nos dois estados', async () => {
    const b = novo()
    b.tabelas['competitor_field_versions'] = [
      versaoDeCampo(1, { field: 'custom_url', value: '@alfa', is_current: true, competitor_channel_id: CANAL_A1 }),
      versaoDeCampo(2, { field: 'country', value: 'BR', is_current: true, competitor_channel_id: CANAL_A1 }),
    ]
    const { channels } = (await listCompetitorChannels(contextoDe(b))).data
    expect(channels).toHaveLength(3)
    for (const c of channels) expect(c.perfil.estado === 'lido' || c.perfil.estado === 'nao_lido').toBe(true)
    expect(channels.find(c => c.id === CANAL_A1)!.perfil).toMatchObject({ estado: 'lido', handle: '@alfa', pais: 'BR' })
    expect(channels.find(c => c.id === CANAL_A2)!.perfil).toMatchObject({ estado: 'nao_lido', motivo: 'canal_ainda_nao_relido' })
  })

  it('lerPerfis que lança não derruba a lista: 200, nove chaves iguais, perfil nao_lido', async () => {
    for (const quando of [undefined, (c: { colunas: string[] }) => c.colunas.includes('published_at')]) {
      const b = novo()
      if (quando) b.falha('competitor_channels', 'lanca', quando); else b.falha('competitor_field_versions', 'lanca')
      const { channels, count } = (await listCompetitorChannels(contextoDe(b))).data
      expect(count).toBe(3)
      for (const c of channels) expect(c.perfil).toMatchObject({ estado: 'nao_lido', motivo: 'erro_do_banco' })
      const nove = channels.map(c => Object.fromEntries(NOVE_CHAVES.map(k => [k, (c as unknown as Record<string, unknown>)[k]])))
      expect(JSON.parse(JSON.stringify({ count, channels: nove }))).toEqual(await (async () => JSON.parse(readFileSync(join(RETRATOS, 'e7-channels-hoje.json'), 'utf8')))())
    }
  })

  it('channels filtra os canais pelo site: o canal de B não aparece', async () => {
    const b = novo()
    const { channels } = (await listCompetitorChannels(contextoDe(b))).data
    expect(channels.map(c => c.id)).not.toContain(CANAL_B1)
    expect(b.doTabela('competitor_channels')[0]!.filtros).toContainEqual({ op: 'eq', coluna: 'site_id', valor: SITE_A })
    expect((await listCompetitorChannels(contextoDe(novo(), SITE_B))).data.channels.map(c => c.id)).toEqual([CANAL_B1])
  })
})

describe('a rota changes', () => {
  async function chamar(url: string) {
    vi.resetModules()
    const listar = vi.fn(async () => ({ data: { changes: [], count: 0 } }))
    vi.doMock('@/lib/pipeline/helpers', () => ({
      authenticateRead: async () => ({ auth: { source: 'api_key', siteId: SITE_A } }),
      pipelineSuccess: (d: unknown) => new Response(JSON.stringify({ data: d }), { status: 200 }),
    }))
    vi.doMock('@/lib/pipeline/services/http-adapter', () => ({ authToServiceContext: () => ({ siteId: SITE_A }), serviceErrorToResponse: () => new Response(null, { status: 500 }) }))
    vi.doMock('@/lib/pipeline/services/competitors', () => ({ listCompetitorChanges: listar }))
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/changes/route')
    const { NextRequest } = await import('next/server')
    await GET(new NextRequest(url))
    vi.doUnmock('@/lib/pipeline/helpers'); vi.doUnmock('@/lib/pipeline/services/http-adapter'); vi.doUnmock('@/lib/pipeline/services/competitors')
    return listar.mock.calls[0] as unknown as [unknown, { campos: string | null }]
  }

  it('a rota repassa campos; sem o parâmetro, repassa null', async () => {
    expect((await chamar('http://x.test/api/pipeline/youtube/competitors/changes?campos=todos'))[1].campos).toBe('todos')
    expect((await chamar('http://x.test/api/pipeline/youtube/competitors/changes'))[1].campos).toBeNull()
  })
})
