// @vitest-environment node
/** A5 · E9, Tarefa 6: o serviço das respostas (`saiu/responder.ts`), com o banco falso próprio e o Blob injetado. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apagarVideo, apagarCanal, apagarComentarios, manter, decidirVolta, tentarDeNovo, ignorarVoltaDoGrupo, concluirApagamentos, sitesComApagamentoPendente,
} from '@/lib/youtube/observatorio/saiu/responder'
import { JANELA_FORJA_MIN } from '@/lib/youtube/observatorio/saiu/modelo'
import { fakeSaiu, type Linha, type OpcoesDoFalso, type RespostaDeRpc } from './saiu-fake-supabase'

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
beforeEach(() => { sentry.captureException.mockClear(); sentry.captureMessage.mockClear() })

const CTX = { siteId: 'site-1', actorId: 'u1', ip: '203.0.113.7', ua: 'agente' }
const URL1 = 'https://x.public.blob.vercel-storage.com/observatorio/thumbs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/h1.jpg'
const PASTA = 'observatorio/thumbs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/'
const ok = (data: unknown): RespostaDeRpc => ({ data, error: null })
const APAGADO = ok({ status: 'apagado', item_id: 7, youtube_id: 'ytX', rows_deleted: {}, blobs: [URL1, PASTA], purge_count: 1 })

type Deps = NonNullable<Parameters<typeof apagarVideo>[4]>
const blobOk = (): NonNullable<Deps['apagarDoBlob']> => vi.fn(async (p: readonly string[]) => ({ feitos: [...p], restam: [], motivo: 'ok' as const }))

function monta(rpc: NonNullable<OpcoesDoFalso['rpc']>, tabelas: Record<string, Linha[]> = {}) {
  return fakeSaiu({ tabelas, rpc: { competitor_removed_blobs_done: async () => ok({ status: 'ok', restam: 0 }), ...rpc } })
}

describe('A5 E9 T6: apagar', () => {
  it('palavra errada não chama o banco', async () => {
    const f = monta({})
    const r = await apagarVideo(f.sb, CTX, 'v1', 'apaga', { apagarDoBlob: blobOk() })
    expect(r.desfecho).toBe('palavra_errada')
    expect(f.rpcs).toHaveLength(0)
  })

  it('apagado com Blob ok devolve apagado e grava os feitos', async () => {
    const f = monta({ competitor_video_purge: async () => APAGADO })
    const blob = blobOk()
    const r = await apagarVideo(f.sb, CTX, 'v1', ' Apagar ', { apagarDoBlob: blob })
    expect(r).toMatchObject({ desfecho: 'apagado' })
    expect(blob).toHaveBeenCalledWith([URL1, PASTA], expect.objectContaining({ prazoMs: 20_000 }))
    expect(f.rpcs.find(x => x.nome === 'competitor_removed_blobs_done')?.args).toEqual({ p_site: 'site-1', p_item: 7, p_done: [URL1, PASTA] })
    expect(f.rpcs.find(x => x.nome === 'competitor_video_purge')?.args).toMatchObject({ p_site: 'site-1', p_video: 'v1', p_actor: 'u1', p_ip: '203.0.113.7', p_ua: 'agente' })
  })

  it('apagar canal e apagar comentários usam as suas funções', async () => {
    const f = monta({
      competitor_channel_purge: async () => APAGADO,
      competitor_comments_purge: async () => ok({ status: 'apagado', comentarios: 4, rows_deleted: {} }),
    })
    expect((await apagarCanal(f.sb, CTX, 'c1', 'APAGAR', { apagarDoBlob: blobOk() })).desfecho).toBe('apagado')
    const blob = blobOk()
    const r = await apagarComentarios(f.sb, CTX, 'c1', [1, 2, 3], 'APAGAR')
    expect(r).toMatchObject({ desfecho: 'apagado', n: 4 })
    expect(blob).not.toHaveBeenCalled()
    expect(f.rpcs.find(x => x.nome === 'competitor_comments_purge')?.args).toMatchObject({ p_site: 'site-1', p_channel: 'c1', p_comment_ids: [1, 2, 3] })
  })

  it('apagado com Blob falhando devolve apagando com a contagem certa; tentarDeNovo depois conclui', async () => {
    let pendente = [URL1, PASTA]
    const f = monta({
      competitor_video_purge: async () => APAGADO,
      competitor_removed_blobs_done: async (a) => { pendente = pendente.filter(x => !(a.p_done as string[]).includes(x)); return ok({ status: 'ok', restam: pendente.length }) },
    }, { competitor_removed_items: [{ id: 7, site_id: 'site-1', blobs_pending: [URL1, PASTA], decided_at: '2026-10-14' }] })
    const falha: Deps['apagarDoBlob'] = vi.fn(async (p: readonly string[]) => ({ feitos: [], restam: [...p], motivo: 'erro' as const }))
    const r1 = await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: falha })
    expect(r1).toMatchObject({ desfecho: 'apagando', faltam: { miniaturas: 1, pastas: 1 } })
    const r2 = await tentarDeNovo(f.sb, CTX, 7, { apagarDoBlob: blobOk() })
    expect(r2.desfecho).toBe('apagado')
    expect(pendente).toEqual([])
  })

  it('Blob parcial: grava só os feitos e devolve apagando com o que falta', async () => {
    const f = monta({ competitor_video_purge: async () => APAGADO })
    const parcial: Deps['apagarDoBlob'] = vi.fn(async () => ({ feitos: [URL1], restam: [PASTA], motivo: 'erro' as const }))
    const r = await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: parcial })
    expect(r).toMatchObject({ desfecho: 'apagando', faltam: { miniaturas: 0, pastas: 1 } })
    expect(f.rpcs.find(x => x.nome === 'competitor_removed_blobs_done')?.args.p_done).toEqual([URL1])
  })

  it('sem token no Blob: apagando com o código blob_nao_configurado', async () => {
    const f = monta({ competitor_video_purge: async () => APAGADO })
    const sem: Deps['apagarDoBlob'] = vi.fn(async (p: readonly string[]) => ({ feitos: [], restam: [...p], motivo: 'blob_nao_configurado' as const }))
    expect(await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: sem })).toMatchObject({ desfecho: 'apagando', codigo: 'blob_nao_configurado' })
    expect(f.rpcs.some(x => x.nome === 'competitor_removed_blobs_done')).toBe(false)
  })

  it('apagado com a gravação dos feitos falhando devolve apagando (nunca apagado)', async () => {
    const f = monta({ competitor_video_purge: async () => APAGADO, competitor_removed_blobs_done: async () => ({ data: null, error: { message: 'x' } }) })
    expect(await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })).toMatchObject({ desfecho: 'apagando' })
    const g = monta({ competitor_video_purge: async () => APAGADO, competitor_removed_blobs_done: async () => { throw new Error('x') } })
    expect((await apagarVideo(g.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })).desfecho).toBe('apagando')
  })

  it.each(['no_ar', 'forja_em_andamento', 'not_found', 'mudou'] as const)('%s passa adiante sem tocar o Blob (conta zero chamadas)', async (status) => {
    const f = monta({ competitor_video_purge: async () => ok({ status, tarefas: 1 }) })
    const blob = blobOk()
    const r = await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blob })
    expect(r.desfecho).toBe(status)
    expect(blob).not.toHaveBeenCalled()
    expect(f.rpcs.some(x => x.nome === 'competitor_removed_blobs_done')).toBe(false)
  })

  it('resposta nula, lista, texto e status desconhecido viram erro com resposta_inesperada', async () => {
    for (const data of [null, [], 'apagado', { status: 'bizarro' }, { nada: 1 }]) {
      const f = monta({ competitor_video_purge: async () => ok(data) })
      expect(await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })).toMatchObject({ desfecho: 'erro', codigo: 'resposta_inesperada' })
    }
  })

  it('erro 57014, 40P01, 23503 e outro viram o código certo', async () => {
    const esperado: Record<string, string> = { '57014': 'tempo_esgotado', '40P01': 'impasse', '23503': 'impedido_por_tabela', XX000: 'erro_de_banco' }
    for (const [code, codigo] of Object.entries(esperado)) {
      const f = monta({ competitor_video_purge: async () => ({ data: null, error: { message: 'segredo do banco', code } }) })
      const r = await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })
      expect(r).toMatchObject({ desfecho: 'erro', codigo })
    }
    const lanca = monta({ competitor_video_purge: async () => { throw new Error('boom') } })
    expect(await apagarVideo(lanca.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })).toMatchObject({ desfecho: 'erro', codigo: 'erro_de_banco' })
  })

  it('IP inválido vira nulo; IPv4 e IPv6 válidos passam', async () => {
    for (const [ip, esperado] of [['203.0.113.7', '203.0.113.7'], ['2001:db8::1', '2001:db8::1'], ['999.1.1.1', null], ['x', null], ['', null], [null, null]] as const) {
      const f = monta({ competitor_video_purge: async () => ok({ status: 'not_found' }) })
      await apagarVideo(f.sb, { ...CTX, ip }, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })
      expect(f.rpcs[0].args.p_ip).toBe(esperado)
    }
  })

  it('a janela passada é a constante importada', async () => {
    const f = monta({ competitor_video_purge: async () => ok({ status: 'not_found' }), competitor_channel_purge: async () => ok({ status: 'not_found' }) })
    await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })
    await apagarCanal(f.sb, CTX, 'c1', 'APAGAR', { apagarDoBlob: blobOk() })
    expect(f.rpcs.map(x => x.args.p_janela_min)).toEqual([JANELA_FORJA_MIN, JANELA_FORJA_MIN])
  })
})

describe('A5 E9 T6: manter e voltar', () => {
  it('manter com lista vazia não chama o banco e devolve nada', async () => {
    const f = monta({})
    expect((await manter(f.sb, CTX, 'video', [])).desfecho).toBe('nada')
    expect(f.rpcs).toHaveLength(0)
  })

  it('manter com 501 ids recusa', async () => {
    const f = monta({})
    const r = await manter(f.sb, CTX, 'video', Array.from({ length: 501 }, (_, i) => `v${i}`))
    expect(r.desfecho).toBe('erro')
    expect(f.rpcs).toHaveLength(0)
  })

  it('manter vídeo e comentário mandam os ids no parâmetro certo', async () => {
    const f = monta({ competitor_missing_keep: async () => ok({ status: 'mantido', mantidos: 2 }) })
    expect(await manter(f.sb, CTX, 'video', ['a', 'b'])).toMatchObject({ desfecho: 'mantido', n: 2 })
    await manter(f.sb, CTX, 'comentario', [1, 2])
    expect(f.rpcs[0].args).toMatchObject({ p_kind: 'video', p_ids: ['a', 'b'], p_comment_ids: null })
    expect(f.rpcs[1].args).toMatchObject({ p_kind: 'comentario', p_ids: null, p_comment_ids: [1, 2] })
  })

  it('decidirVolta chama a função e traduz o status', async () => {
    const f = monta({ competitor_return_decide: async (a) => ok(a.p_item === 1 ? { status: 'ok', kind: 'video', decision: 'voltar' } : { status: 'nada' }) })
    expect((await decidirVolta(f.sb, CTX, 1, 'voltar')).desfecho).toBe('respondido')
    expect((await decidirVolta(f.sb, CTX, 2, 'ignorar')).desfecho).toBe('nada')
  })

  it('tentarDeNovo de linha de outro site não acha e não chama o Blob', async () => {
    const f = monta({}, { competitor_removed_items: [{ id: 9, site_id: 'site-2', blobs_pending: [URL1], decided_at: '2026-10-14' }] })
    const blob = blobOk()
    expect((await tentarDeNovo(f.sb, CTX, 9, { apagarDoBlob: blob })).desfecho).toBe('not_found')
    expect(blob).not.toHaveBeenCalled()
  })

  it('ignorarVoltaDoGrupo: 7 ids, 7 chamadas, n = 7', async () => {
    const f = monta({ competitor_return_decide: async () => ok({ status: 'ok', kind: 'comentario', decision: 'ignorar' }) })
    const r = await ignorarVoltaDoGrupo(f.sb, CTX, [1, 2, 3, 4, 5, 6, 7])
    expect(r).toMatchObject({ desfecho: 'respondido', n: 7 })
    expect(f.rpcs).toHaveLength(7)
    expect(f.rpcs.every(x => x.args.p_decision === 'ignorar')).toBe(true)
  })

  it('ignorarVoltaDoGrupo: a terceira falha: para, devolve erro com n = 2', async () => {
    let n = 0
    const f = monta({ competitor_return_decide: async () => { n += 1; return n === 3 ? { data: null, error: { message: 'x' } } : ok({ status: 'ok' }) } })
    const r = await ignorarVoltaDoGrupo(f.sb, CTX, [1, 2, 3, 4, 5])
    expect(r).toMatchObject({ desfecho: 'erro', n: 2 })
    expect(f.rpcs).toHaveLength(3)
  })

  it('ignorarVoltaDoGrupo: lista vazia e 501 ids não chamam o banco; id de outro site devolve nada e não conta', async () => {
    const f = monta({ competitor_return_decide: async (a) => ok(a.p_item === 2 ? { status: 'nada' } : { status: 'ok' }) })
    expect((await ignorarVoltaDoGrupo(f.sb, CTX, [])).desfecho).toBe('nada')
    expect((await ignorarVoltaDoGrupo(f.sb, CTX, Array.from({ length: 501 }, (_, i) => i))).desfecho).toBe('erro')
    expect(f.rpcs).toHaveLength(0)
    expect(await ignorarVoltaDoGrupo(f.sb, CTX, [1, 2])).toMatchObject({ n: 1 })
    expect(await ignorarVoltaDoGrupo(f.sb, CTX, [2])).toMatchObject({ desfecho: 'nada', n: 0 })
  })
})

describe('A5 E9 T6: conclusão de apagamentos', () => {
  const linhas = (): Linha[] => [
    { id: 3, site_id: 'site-1', blobs_pending: ['c'], decided_at: '2026-10-12T00:00:00Z' },
    { id: 1, site_id: 'site-1', blobs_pending: ['a'], decided_at: '2026-10-10T00:00:00Z' },
    { id: 2, site_id: 'site-1', blobs_pending: ['b'], decided_at: '2026-10-11T00:00:00Z' },
    { id: 4, site_id: 'site-1', blobs_pending: [], decided_at: '2026-10-09T00:00:00Z' },
    { id: 5, site_id: 'site-2', blobs_pending: ['z'], decided_at: '2026-10-08T00:00:00Z' },
  ]

  it('respeita o prazo e a ordem (mais antigo primeiro)', async () => {
    const f = monta({}, { competitor_removed_items: linhas() })
    const chamadas: string[][] = []
    let agora = 0
    const blob: NonNullable<Deps['apagarDoBlob']> = vi.fn(async (p: readonly string[]) => { chamadas.push([...p]); agora += 3_000; return { feitos: [...p], restam: [], motivo: 'ok' as const } })
    const r = await concluirApagamentos(f.sb, 'site-1', { prazoMs: 5_000, deps: { apagarDoBlob: blob, agora: () => agora } })
    expect(chamadas).toEqual([['a'], ['b']])
    expect(r).toEqual({ tentados: 2, concluidos: 2 })
  })

  it('lê no máximo 50 linhas do site, com order e limit escritos', async () => {
    const f = monta({}, { competitor_removed_items: linhas() })
    await concluirApagamentos(f.sb, 'site-1', { prazoMs: 5_000, deps: { apagarDoBlob: blobOk() } })
    const c = f.chamadas[0]
    expect(c.limite).toBe(50)
    expect(c.ordem).toEqual(['decided_at', 'id'])
    expect(c.filtros).toContain('eq:site_id')
  })

  it('sitesComApagamentoPendente: erro devolve erro, nunca lista vazia', async () => {
    const ruim = fakeSaiu({ tabelas: {}, falhar: c => c.tabela === 'competitor_removed_items' })
    const r = await sitesComApagamentoPendente(ruim.sb)
    expect(Array.isArray(r)).toBe(false)
    expect(r).toHaveProperty('erro')
    const bom = monta({}, { competitor_removed_items: linhas() })
    expect(await sitesComApagamentoPendente(bom.sb)).toEqual(['site-2', 'site-1'])
  })
})

describe('A5 E9 T6: nada de título no Sentry', () => {
  it('nenhuma chamada ao Sentry leva título (o banco falso devolve um título e o teste procura por ele nos argumentos)', async () => {
    const f = monta({ competitor_video_purge: async () => ({ data: { titulo: 'TÍTULO-SECRETO' }, error: { message: 'falhou em TÍTULO-SECRETO', code: '57014' } }) })
    await apagarVideo(f.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })
    const g = monta({ competitor_video_purge: async () => ok({ status: 'apagado', item_id: 1, blobs: ['observatorio/thumbs/x/'], titulo: 'TÍTULO-SECRETO' }), competitor_removed_blobs_done: async () => { throw new Error('TÍTULO-SECRETO') } })
    await apagarVideo(g.sb, CTX, 'v1', 'APAGAR', { apagarDoBlob: blobOk() })
    const tudo = JSON.stringify([sentry.captureException.mock.calls, sentry.captureMessage.mock.calls])
    expect(tudo).not.toContain('TÍTULO-SECRETO')
  })
})
