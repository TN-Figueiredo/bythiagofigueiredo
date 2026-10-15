// @vitest-environment node
/** A5 · E9, Tarefa 4: o leitor da fila (`saiu/schema.ts`, `saiu/ler-fila.ts`) contra o banco falso próprio da etapa. */
import { describe, it, expect, vi } from 'vitest'
import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'
import { schemaE9 } from '@/lib/youtube/observatorio/saiu/schema'
import { contadorDaAba, type FilaLida } from '@/lib/youtube/observatorio/saiu/modelo'
import { fakeSaiu, type Chamada, type Linha, type OpcoesDoFalso } from './saiu-fake-supabase'

const mockSentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => mockSentry)

const S = 'site-1'
const OUTRO = 'site-2'
const AGORA = Date.parse('2026-10-14T15:00:00Z')
const iso = (diasAtras: number): string => new Date(AGORA - diasAtras * 86_400_000).toISOString()
const dia = (diasAtras: number): string => iso(diasAtras).slice(0, 10)

const canalRow = (id: string, o: Linha = {}): Linha => ({
  id, channel_id: `UC${id}`, channel_name: `Canal ${id}`, site_id: S, subscriber_count: 1000, thumbnail_url: null,
  missing_since: null, last_seen_at: iso(3), removal_decision: null, removal_decided_at: null, last_ok_synced_at: iso(0.1), ...o,
})
const aninhado = (id: string, o: Linha = {}): Linha => ({ id, channel_name: `Canal ${id}`, site_id: S, missing_since: null, subscriber_count: 1000, ...o })
const vidRow = (id: string, canal = 'c1', o: Linha = {}): Linha => ({
  id, video_id: `yt${id}`, title: `Título ${id}`, view_count: 100, like_count: 10, comment_count: 5, duration_seconds: 600, is_short: false,
  published_at: iso(60), discovered_at: iso(50), thumbnail_url: `https://img/${id}.jpg`, missing_since: dia(5), last_seen_at: iso(6),
  removal_decision: null, removal_decided_at: null, competitor_channel_id: canal, competitor_channels: aninhado(canal), ...o,
})
const comRow = (id: number, canal = 'c1', video = 'v1', o: Linha = {}): Linha => ({
  id, site_id: S, competitor_channel_id: canal, video_id: video, missing_since: dia(4), removal_decision: null, removal_decided_at: null, parent_id: null,
  competitor_videos: { title: `Título ${video}`, missing_since: null }, canal: { channel_name: `Canal ${canal}`, missing_since: null }, ...o,
})
const remRow = (id: number, o: Linha = {}): Linha => ({
  id, site_id: S, kind: 'video', youtube_id: `yt-r${id}`, competitor_channel_id: 'c1', missing_since: dia(9), decided_at: iso(2 + id / 100),
  blobs_pending: [], archive_pending: false, returned_seen_at: null, return_decision: null, ...o,
})

const PREVIA = { status: 'ok', youtube_id: 'x', rows: { competitor_videos: 1, competitor_video_daily: 41 }, blobs: 2, forja_em_andamento: false }
const rpcPadrao: NonNullable<OpcoesDoFalso['rpc']> = {
  competitor_purge_preview: async () => ({ data: PREVIA, error: null }),
  competitor_comments_preview: async () => ({ data: { status: 'ok', encontrados: 3, respostas: 1, rows: { competitor_video_comments: 4 } }, error: null }),
  competitor_removed_comment_groups: async () => ({ data: [], error: null }),
}

function monta(tabelas: Record<string, Linha[]>, extra: Partial<OpcoesDoFalso> = {}) {
  return fakeSaiu({ tabelas: { competitor_channels: [canalRow('c1')], ...tabelas }, rpc: { ...rpcPadrao, ...(extra.rpc ?? {}) }, falhar: extra.falhar, contagem: extra.contagem })
}
const ler = (f: ReturnType<typeof monta>, o: Partial<{ mostrar: number; podeResponder: boolean }> = {}) =>
  lerFila(f.sb, { siteId: S, mostrar: 10, agoraMs: AGORA, podeResponder: true, ...o })
async function fila(f: ReturnType<typeof monta>, o: Partial<{ mostrar: number }> = {}): Promise<FilaLida> {
  const r = await ler(f, o)
  if (r.estado !== 'ok') throw new Error(`esperava ok, veio ${JSON.stringify(r)}`)
  return r.fila
}

const e = (c: Chamada, tabela: string, ...marcas: string[]): boolean => c.tabela === tabela && marcas.every(m => c.filtros.some(x => x.startsWith(m)))
const LEITURAS: Array<[string, (c: Chamada) => boolean]> = [
  ['vídeos ausentes', c => e(c, 'competitor_videos', 'not:missing_since')],
  ['canais ausentes', c => e(c, 'competitor_channels', 'not:missing_since')],
  ['comentários ausentes', c => e(c, 'competitor_video_comments', 'not:missing_since')],
  ['auditoria de mantidos', c => e(c, 'audit_log')],
  ['última leitura e contagem de canais', c => c.tabela === 'competitor_channels' && !c.filtros.some(x => x.startsWith('not:missing_since'))],
  ['apagando', c => e(c, 'competitor_removed_items', 'or:archive_pending')],
  ['voltaram', c => e(c, 'competitor_removed_items', 'is:return_decision', 'not:returned_seen_at')],
  ['respondidos de vídeo e canal', c => e(c, 'competitor_removed_items', 'eq:archive_pending')],
]

describe('A5 E9 T4: schemaE9', () => {
  it('tabela ausente devolve schema_ausente, não fila vazia', async () => {
    const f = monta({}, { falhar: c => (c.tabela === 'competitor_missing_baseline' ? '42P01' : false) })
    const r = await ler(f)
    expect(r.estado).toBe('schema_ausente')
    if (r.estado === 'schema_ausente') expect(r.texto).toContain('migration')
    expect(await schemaE9(f.sb)).toContain('migration')
    expect(await schemaE9(monta({}, { falhar: c => (c.tabela === 'competitor_missing_baseline' ? 'PGRST205' : false) }).sb)).toContain('migration')
  })

  it('a guarda que lança devolve schema_ausente com "não foi possível conferir"', async () => {
    const f = monta({}, { falhar: c => (c.tabela === 'competitor_missing_baseline' ? 'lancar' : false) })
    const r = await ler(f)
    expect(r).toMatchObject({ estado: 'schema_ausente' })
    if (r.estado === 'schema_ausente') expect(r.texto.toLowerCase()).toContain('não foi possível conferir')
  })

  it('outro erro de banco ou resposta nula não é "pronto"', async () => {
    expect(((await schemaE9(monta({}, { falhar: c => (c.tabela === 'competitor_missing_baseline' ? 'XX000' : false) }).sb)) ?? '').toLowerCase()).toContain('não foi possível conferir')
    expect(await schemaE9(monta({}).sb)).toBeNull()
  })
})

describe('A5 E9 T4: lerFila', () => {
  it.each(LEITURAS)('leitura com erro (%s) devolve erro, nunca fila parcial', async (_nome, casa) => {
    const f = monta({ competitor_videos: [vidRow('v1')] }, { falhar: c => casa(c) })
    const r = await ler(f)
    expect(r.estado).toBe('erro')
  })

  it('a agregação dos comentários apagados com erro devolve erro', async () => {
    const f = monta({}, { rpc: { competitor_removed_comment_groups: async () => ({ data: null, error: { message: 'x' } }) } })
    expect((await ler(f)).estado).toBe('erro')
  })

  it('vídeo de canal ausente não aparece solto; o canal é um item só', async () => {
    const f = monta({
      competitor_channels: [canalRow('c1', { missing_since: dia(7) })],
      competitor_videos: [vidRow('v1', 'c1', { competitor_channels: aninhado('c1', { missing_since: dia(7) }) }), vidRow('v2', 'c1', { competitor_channels: aninhado('c1', { missing_since: dia(7) }) })],
    })
    const r = await fila(f)
    expect(r.esperando.map(i => i.tipo)).toEqual(['canal'])
    expect(r.totalEsperando).toBe(1)
  })

  it('vídeo com missing_since próprio em canal ausente também não aparece solto', async () => {
    const f = monta({
      competitor_channels: [canalRow('c1', { missing_since: dia(7) })],
      competitor_videos: [vidRow('v1', 'c1', { missing_since: dia(5), competitor_channels: aninhado('c1', { missing_since: dia(7) }) })],
    })
    expect((await fila(f)).esperando.map(i => i.tipo)).toEqual(['canal'])
  })

  it('comentários de um canal viram um item, com os vídeos e as contagens', async () => {
    const f = monta({
      competitor_video_comments: [comRow(1, 'c1', 'v1'), comRow(2, 'c1', 'v1'), comRow(3, 'c1', 'v2', { competitor_videos: { title: 'Outro', missing_since: null } })],
    })
    const r = await fila(f)
    expect(r.esperando).toHaveLength(1)
    const g = r.esperando[0]
    expect(g.tipo).toBe('comentarios')
    expect(g.idsDoGrupo).toEqual([1, 2, 3])
    expect(g.videosDoGrupo).toEqual([{ titulo: 'Título v1', comentarios: 2 }, { titulo: 'Outro', comentarios: 1 }])
    expect(g.titulo).toBe('3 comentários de 2 vídeos')
  })

  it('comentário ausente de vídeo ausente não vira item (vai com o vídeo)', async () => {
    const f = monta({ competitor_video_comments: [comRow(1, 'c1', 'v1', { competitor_videos: { title: 'x', missing_since: dia(3) } })] })
    const r = await fila(f)
    expect(r.esperando).toHaveLength(0)
    expect(r.totalEsperando).toBe(0)
  })

  it('mantido vai para respondidos e não para esperando', async () => {
    const f = monta({ competitor_videos: [vidRow('v1', 'c1', { removal_decision: 'manter', removal_decided_at: iso(1) })] })
    const r = await fila(f)
    expect(r.esperando).toHaveLength(0)
    expect(r.respondidos).toMatchObject([{ tipo: 'video', situacao: 'mantido', titulo: 'Título v1' }])
  })

  it('apagado com blobs_pending vai para apagando; sem pendência vai para respondidos', async () => {
    const f = monta({ competitor_removed_items: [remRow(1, { blobs_pending: ['observatorio/thumbs/x/'] }), remRow(2)] })
    const r = await fila(f)
    expect(r.apagando.map(i => i.itemId)).toEqual([1])
    expect(r.respondidos.map(i => i.itemId)).toEqual([2])
    expect(r.respondidos[0].situacao).toBe('apagado')
  })

  it('apagado que voltou sem resposta vai para voltaram com pedeResposta; com resposta vai para respondidos', async () => {
    const f = monta({ competitor_removed_items: [remRow(1, { returned_seen_at: iso(1) }), remRow(2, { returned_seen_at: iso(1), return_decision: 'ignorar' })] })
    const r = await fila(f)
    expect(r.voltaram).toMatchObject([{ itemIds: [1], pedeResposta: true, tipo: 'video' }])
    expect(r.respondidos.map(i => i.itemId)).toEqual([2])
  })

  it('mantido que voltou ao ar aparece em voltaram só como informação, e some depois de 30 dias', async () => {
    const f = monta({
      audit_log: [
        { id: 'a1', site_id: S, action: 'competitor_missing_keep', resource_type: 'competitor_video', resource_id: 'v1', created_at: iso(10) },
        { id: 'a2', site_id: S, action: 'competitor_missing_keep', resource_type: 'competitor_video', resource_id: 'v2', created_at: iso(40) },
      ],
      competitor_videos: [vidRow('v1', 'c1', { missing_since: null, removal_decision: 'manter' }), vidRow('v2', 'c1', { missing_since: null, removal_decision: 'manter' })],
    })
    const r = await fila(f)
    expect(r.voltaram).toMatchObject([{ pedeResposta: false, tipo: 'video', titulo: 'Título v1' }])
    expect(contadorDaAba(r)).toBe(0)
  })

  it('a fila de um site não mostra item do outro (um caso por leitura)', async () => {
    const f = monta({
      competitor_channels: [canalRow('c1'), canalRow('x1', { site_id: OUTRO, missing_since: dia(2) })],
      competitor_videos: [vidRow('vx', 'x1', { competitor_channels: aninhado('x1', { site_id: OUTRO }) })],
      competitor_video_comments: [comRow(9, 'x1', 'vx', { site_id: OUTRO })],
      audit_log: [{ id: 'ax', site_id: OUTRO, action: 'competitor_missing_keep', resource_type: 'competitor_video', resource_id: 'vx', created_at: iso(2) }],
      competitor_removed_items: [
        remRow(1, { site_id: OUTRO, blobs_pending: ['observatorio/thumbs/x/'] }),
        remRow(2, { site_id: OUTRO, returned_seen_at: iso(1) }),
        remRow(3, { site_id: OUTRO }),
      ],
    })
    const r = await fila(f)
    expect(r.esperando).toHaveLength(0)
    expect(r.apagando).toHaveLength(0)
    expect(r.voltaram).toHaveLength(0)
    expect(r.respondidos).toHaveLength(0)
    expect(r.canaisDoSite).toBe(1)
    for (const c of f.chamadas.filter(x => x.tabela !== 'competitor_missing_baseline' && !(x.tabela === 'competitor_video_versions'))) {
      const filtraSite = c.filtros.some(x => /site_id$/.test(x))
      expect(filtraSite, `${c.tabela} ${c.filtros.join(' ')}`).toBe(true)
    }
    for (const rp of f.rpcs.filter(x => x.nome !== 'competitor_purge_preview' && x.nome !== 'competitor_comments_preview')) expect(rp.args.p_site).toBe(S)
  })

  it('campos nulos ficam nulos (título, views, discovered_at), nunca zero nem texto vazio', async () => {
    const f = monta({ competitor_videos: [vidRow('v1', 'c1', { title: null, view_count: null, like_count: null, comment_count: null, discovered_at: null, duration_seconds: null, is_short: null, published_at: null, thumbnail_url: null })] })
    const i = (await fila(f)).esperando[0]
    expect(i).toMatchObject({ titulo: null, views: null, curtidas: null, comentarios: null, vistoPrimeiro: null, duracaoSeg: null, formato: null, publicadoEm: null, miniaturaUrl: null })
  })

  it('prévia que falha num item: o item vem com previa.erro e os outros com a prévia', async () => {
    const f = monta({ competitor_videos: [vidRow('v1'), vidRow('v2')] }, {
      rpc: { competitor_purge_preview: async (a) => (a.p_id === 'v1' ? { data: null, error: { message: 'nível 3' } } : { data: PREVIA, error: null }) },
    })
    const r = await fila(f)
    const [a, b] = r.esperando
    expect('erro' in a.previa).toBe(true)
    expect('linhas' in b.previa).toBe(true)
  })

  it('só os N primeiros pedem prévia (conta as chamadas: 10 com 25 itens)', async () => {
    const f = monta({ competitor_videos: Array.from({ length: 25 }, (_, i) => vidRow(`v${String(i).padStart(2, '0')}`)) })
    const r = await fila(f, { mostrar: 10 })
    expect(f.rpcs.filter(x => x.nome === 'competitor_purge_preview')).toHaveLength(10)
    expect(r.esperando).toHaveLength(10)
    expect(r.totalEsperando).toBe(25)
  })

  it('a prévia traz a janela da forja e as versões por campo', async () => {
    const f = monta({
      competitor_videos: [vidRow('v1')],
      competitor_video_versions: [
        { video_id: 'v1', field: 'title', competitor_videos: { competitor_channel_id: 'c1' } },
        { video_id: 'v1', field: 'title', competitor_videos: { competitor_channel_id: 'c1' } },
        { video_id: 'v1', field: 'thumb', competitor_videos: { competitor_channel_id: 'c1' } },
      ],
    })
    const p = (await fila(f)).esperando[0].previa
    expect('linhas' in p && p.versoes).toEqual({ title: 2, thumb: 1, desc: 0 })
    expect(f.rpcs.find(x => x.nome === 'competitor_purge_preview')?.args).toMatchObject({ p_site: S, p_kind: 'video', p_id: 'v1', p_janela_min: 30 })
  })

  it('ordem: o mais antigo primeiro; empate pela chave', async () => {
    const f = monta({ competitor_videos: [vidRow('vb', 'c1', { missing_since: dia(2) }), vidRow('va', 'c1', { missing_since: dia(2) }), vidRow('vc', 'c1', { missing_since: dia(9) })] })
    expect((await fila(f)).esperando.map(i => i.chave)).toEqual(['vc', 'va', 'vb'])
  })

  it('20.001 comentários ausentes devolve erro com o número', async () => {
    const f = monta({ competitor_video_comments: [comRow(1)] }, { contagem: (t, _n, real) => (t === 'competitor_video_comments' ? 20_001 : real) })
    const r = await ler(f)
    expect(r.estado).toBe('erro')
    if (r.estado === 'erro') expect(r.detalhe).toContain('20001')
  })

  it('linha de comentário apagado não leva o id para o item (só a contagem por canal)', async () => {
    const f = monta({ competitor_removed_items: [remRow(1, { kind: 'comentario', youtube_id: 'UgxSEGREDO', returned_seen_at: iso(1) })] }, {
      rpc: { competitor_removed_comment_groups: async () => ({ data: [{ competitor_channel_id: 'c1', comentarios: 7, decided_at: iso(2) }], error: null }) },
    })
    const r = await fila(f)
    expect(JSON.stringify(r)).not.toContain('UgxSEGREDO')
    expect(r.respondidos.some(i => i.tipo === 'comentarios' && i.comentarios === 7)).toBe(true)
  })

  it('1.001 linhas em competitor_removed_items (comentários apagados): o item apagando mais antigo e o item que voltou aparecem', async () => {
    const muitas = Array.from({ length: 1001 }, (_, i) => remRow(i + 10, { kind: 'comentario', youtube_id: `k${i}`, decided_at: iso(1) }))
    const f = monta({
      competitor_removed_items: [...muitas, remRow(1, { blobs_pending: ['observatorio/thumbs/x/'], decided_at: iso(30) }), remRow(2, { returned_seen_at: iso(1), decided_at: iso(20) })],
    })
    const r = await fila(f)
    expect(r.apagando.map(i => i.itemId)).toEqual([1])
    expect(r.voltaram.some(v => v.itemIds.includes(2))).toBe(true)
  })

  it('1.001 vídeos ausentes: vêm os 1.001 (duas páginas), em ordem estável', async () => {
    const f = monta({ competitor_videos: Array.from({ length: 1001 }, (_, i) => vidRow(`v${String(i).padStart(4, '0')}`)) })
    const r = await fila(f, { mostrar: 3 })
    expect(r.totalEsperando).toBe(1001)
    expect(f.chamadas.filter(c => e(c, 'competitor_videos', 'not:missing_since'))).toHaveLength(2)
  })

  it('leitura que traz menos linhas que a contagem devolve erro', async () => {
    const f = monta({ competitor_videos: [vidRow('v1'), vidRow('v2')] }, { contagem: (t, _n, real) => (t === 'competitor_videos' ? real + 5 : real) })
    expect((await ler(f)).estado).toBe('erro')
  })

  it('toda leitura de lista manda order e count exact (o banco falso recusa a chamada sem os dois)', async () => {
    const f = monta({ competitor_videos: [vidRow('v1')], competitor_removed_items: [remRow(1)] })
    await fila(f)
    for (const c of f.chamadas.filter(x => x.faixa)) {
      expect(c.ordem.length).toBeGreaterThan(0)
      expect(c.count).toBe('exact')
    }
  })

  it('já respondidos: 51 apagados mostram 50 e respondidosTotal 51', async () => {
    const f = monta({ competitor_removed_items: Array.from({ length: 51 }, (_, i) => remRow(i + 1)) })
    const r = await fila(f)
    expect(r.respondidos).toHaveLength(50)
    expect(r.respondidosTotal).toBe(51)
  })

  it('comentários apagados vêm da agregação, um por canal', async () => {
    const f = monta({}, { rpc: { competitor_removed_comment_groups: async () => ({ data: [{ competitor_channel_id: 'c1', comentarios: 7, decided_at: iso(1) }, { competitor_channel_id: 'c2', comentarios: 2, decided_at: iso(3) }], error: null }) } })
    const r = await fila(f)
    expect(r.respondidos.filter(i => i.tipo === 'comentarios').map(i => i.comentarios)).toEqual([7, 2])
    expect(f.chamadas.some(c => c.tabela === 'competitor_removed_items' && c.filtros.includes('eq:kind') && c.faixa)).toBe(false)
  })

  it('comentários que voltaram, de um canal, viram um item com os ids das linhas', async () => {
    const f = monta({ competitor_removed_items: [3, 4, 5].map(id => remRow(id, { kind: 'comentario', youtube_id: `k${id}`, returned_seen_at: iso(1) })) })
    const r = await fila(f)
    expect(r.voltaram).toHaveLength(1)
    expect(r.voltaram[0]).toMatchObject({ tipo: 'comentarios', itemIds: [3, 4, 5], comentarios: 3, pedeResposta: true })
    expect(contadorDaAba(r)).toBe(1)
  })

  it('linha que está apagando e voltou aparece só em apagando, com a data da volta', async () => {
    const f = monta({ competitor_removed_items: [remRow(1, { blobs_pending: ['observatorio/thumbs/x/'], returned_seen_at: iso(1) })] })
    const r = await fila(f)
    expect(r.apagando).toMatchObject([{ itemId: 1, voltouEm: iso(1) }])
    expect(r.voltaram).toHaveLength(0)
    expect(contadorDaAba(r)).toBe(1)
  })

  it('a prévia do grupo de comentários traz as respostas do criador (3 e 1)', async () => {
    const f = monta({ competitor_video_comments: [comRow(1), comRow(2), comRow(3)] })
    const p = (await fila(f)).esperando[0].previa
    expect('linhas' in p && p.respostasDoCriador).toBe(1)
    expect(f.rpcs.find(x => x.nome === 'competitor_comments_preview')?.args).toMatchObject({ p_site: S, p_channel: 'c1', p_comment_ids: [1, 2, 3] })
  })

  it('totalEsperando com 25 itens e mostrar = 10 é 25', async () => {
    const f = monta({ competitor_videos: Array.from({ length: 25 }, (_, i) => vidRow(`v${i}`)) })
    expect((await fila(f, { mostrar: 10 })).totalEsperando).toBe(25)
  })

  it('apagando e linha que voltou sem resposta não entram em respondidos nem em respondidosTotal; as três condições vão na consulta', async () => {
    const f = monta({ competitor_removed_items: [
      remRow(1, { blobs_pending: ['observatorio/thumbs/x/'] }), remRow(2, { archive_pending: true }), remRow(3, { returned_seen_at: iso(1) }), remRow(4),
    ] })
    const r = await fila(f)
    expect(r.respondidos.map(i => i.itemId)).toEqual([4])
    expect(r.respondidosTotal).toBe(1)
    const c = f.chamadas.find(x => x.filtros.includes('eq:archive_pending'))
    expect(c?.filtros).toEqual(expect.arrayContaining(['eq:archive_pending', 'eq:blobs_pending']))
    expect(c?.filtros.some(x => x.startsWith('or:returned_seen_at'))).toBe(true)
  })

  it('50 linhas recentes apagando ou voltando e 3 respondidas mais antigas: o bloco mostra as 3 e respondidosTotal é 3', async () => {
    const recentes = Array.from({ length: 50 }, (_, i) => remRow(i + 100, { blobs_pending: ['observatorio/thumbs/x/'], decided_at: iso(0.5) }))
    const f = monta({ competitor_removed_items: [...recentes, remRow(1, { decided_at: iso(40) }), remRow(2, { decided_at: iso(41) }), remRow(3, { decided_at: iso(42) })] })
    const r = await fila(f)
    expect(r.respondidos).toHaveLength(3)
    expect(r.respondidosTotal).toBe(3)
  })

  it('a contagem que vale é a da última página (1.500 linhas, a primeira página diz 1.500 e a segunda diz 1.499: erro)', async () => {
    const f = monta({ competitor_videos: Array.from({ length: 1500 }, (_, i) => vidRow(`v${String(i).padStart(4, '0')}`)) }, {
      contagem: (t, n, real) => (t === 'competitor_videos' && n === 1 ? real - 1 : real),
    })
    expect((await ler(f)).estado).toBe('erro')
  })

  it('nenhum título vai ao Sentry', async () => {
    mockSentry.captureException.mockClear()
    const f = monta({ competitor_videos: [vidRow('v1', 'c1', { title: 'TÍTULO-SECRETO' })] }, { falhar: c => e(c, 'audit_log') })
    await ler(f)
    expect(mockSentry.captureException).toHaveBeenCalled()
    expect(JSON.stringify(mockSentry.captureException.mock.calls)).not.toContain('TÍTULO-SECRETO')
  })

  it('canal ausente: item com canalNoAr falso e prévia de canal', async () => {
    const f = monta({ competitor_channels: [canalRow('c1', { missing_since: dia(7) })] })
    const r = await fila(f)
    expect(r.esperando[0]).toMatchObject({ tipo: 'canal', canalNoAr: false, chave: 'c1', codigo: 'UCc1', titulo: 'Canal c1' })
    expect(f.rpcs.find(x => x.nome === 'competitor_purge_preview')?.args).toMatchObject({ p_kind: 'canal', p_id: 'c1' })
  })

  it('fila vazia: sem erro, com a última leitura e a contagem de canais', async () => {
    const r = await fila(monta({}))
    expect(r).toMatchObject({ totalEsperando: 0, canaisDoSite: 1, podeResponder: true })
    expect(r.ultimaLeituraDosCanais).toBe(iso(0.1))
  })
})

describe('A5 E9: consertos do portão de 14/10', () => {
  it('I-1/I-5: no máximo 10 prévias em voo, e as 30 chegam', async () => {
    let emVoo = 0
    let maximo = 0
    const f = monta({ competitor_videos: Array.from({ length: 30 }, (_, i) => vidRow(`v${i}`)) }, {
      rpc: {
        competitor_purge_preview: async () => {
          emVoo += 1
          maximo = Math.max(maximo, emVoo)
          await new Promise(r => setTimeout(r, 5))
          emVoo -= 1
          return { data: PREVIA, error: null }
        },
      },
    })
    const r = await fila(f, { mostrar: 30 })
    expect(r.esperando).toHaveLength(30)
    expect(r.esperando.every(i => !('erro' in i.previa))).toBe(true)
    expect(f.rpcs.filter(x => x.nome === 'competitor_purge_preview')).toHaveLength(30)
    expect(maximo).toBeGreaterThan(1)
    expect(maximo).toBeLessThanOrEqual(10)
  })

  it('M-2: os mantidos que voltaram são lidos em blocos de 100 ids, sem cortar em silêncio', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `m${i}`)
    const f = monta({
      audit_log: ids.map(id => ({ id: `a${id}`, site_id: S, action: 'competitor_missing_keep', resource_type: 'competitor_video', resource_id: id, created_at: iso(3) })),
      competitor_videos: ids.map(id => vidRow(id, 'c1', { missing_since: null, removal_decision: 'manter' })),
    })
    const r = await fila(f)
    expect(r.voltaram).toHaveLength(250)
    expect(f.chamadas.filter(c => e(c, 'competitor_videos', 'in:id'))).toHaveLength(3)
  })

  it('M-5: o grupo mantido aparece em respondidos mesmo com comentário novo esperando no mesmo canal', async () => {
    const f = monta({ competitor_video_comments: [comRow(1, 'c1', 'v1', { removal_decision: 'manter', removal_decided_at: iso(1) }), comRow(2, 'c1', 'v1')] })
    const r = await fila(f)
    expect(r.esperando).toHaveLength(1)
    expect(r.respondidos).toMatchObject([{ tipo: 'comentarios', situacao: 'mantido', comentarios: 1 }])
  })

  it('M-6: contagem nula dos canais do site é erro de leitura, não "nenhum canal"', async () => {
    const f = monta({}, { contagem: (t, n, real) => (t === 'competitor_channels' && n === 1 ? null : real) })
    const r = await ler(f)
    expect(r.estado).toBe('erro')
  })

  it('Phil I-2: lotes_exportados vem da prévia; chave ausente é null, nunca 0', async () => {
    const com = monta({ competitor_videos: [vidRow('v1')] }, { rpc: { competitor_purge_preview: async () => ({ data: { ...PREVIA, lotes_exportados: 2 }, error: null }) } })
    expect((await fila(com)).esperando[0]!.previa).toMatchObject({ lotesExportados: 2 })
    const sem = monta({ competitor_videos: [vidRow('v1')] })
    const p = (await fila(sem)).esperando[0]!.previa
    expect('lotesExportados' in p ? p.lotesExportados : 'x').toBeNull()
  })
})
