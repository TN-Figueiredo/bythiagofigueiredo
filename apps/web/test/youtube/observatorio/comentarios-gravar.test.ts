// @vitest-environment node
// A5 · E14, Tarefa 8: a fronteira TypeScript x SQL (pacote, cinco funções, tempo máximo). Cliente falso, dado 100% inventado.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  anular, gravarRetrato, lerCadastro, lerDevidos, lerGuardados, lerImpacto, lerProva, montarPacote,
} from '@/lib/youtube/observatorio/comentarios/gravar'
import { COMMENT_RULES, MOTIVOS_PASSAGEIROS, ruleParams } from '@/lib/youtube/observatorio/comentarios/regras'
import { loteDe, agregadosDoLote } from '@/lib/youtube/observatorio/comentarios/normalizar'
import { selecionar } from '@/lib/youtube/observatorio/comentarios/selecao'
import { ComentariosErro } from '@/lib/youtube/observatorio/comentarios/erro'
import type { Devido, Destaque, Escolhido } from '@/lib/youtube/observatorio/comentarios/tipos'
import {
  CANAL_ACOMPANHADO, CANAL_DO_VIDEO, H, SENT_NOME, SENT_NOME_TERCEIRO, SENT_TEXTO_TERCEIRO, SENT_TEXTO_TOPO, T0,
  conversa, corpoDeConversas, canal, iso, resposta,
} from './comentarios-fixtures'

// ───── cliente falso ─────
interface Chamada {
  tipo: 'rpc' | 'from'
  nome: string
  args?: Record<string, unknown>
  colunas?: string
  filtros: Array<[string, unknown[]]>
  sinal?: AbortSignal
}
type Resp = { data: unknown; error: unknown }
type Resolvedor = (c: Chamada) => Resp | Promise<Resp> | never

function criarSb(resolver: Resolvedor): { sb: SupabaseClient; chamadas: Chamada[] } {
  const chamadas: Chamada[] = []
  const construtor = (c: Chamada): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['eq', 'limit', 'in', 'order']) b[m] = (...a: unknown[]) => { c.filtros.push([m, a]); return b }
    b.select = (colunas: string) => { c.colunas = colunas; return b }
    b.abortSignal = (s: AbortSignal) => { c.sinal = s; return b }
    b.then = (ok: (r: Resp) => unknown, ko: (e: unknown) => unknown) => {
      chamadas.push(c)
      try { return Promise.resolve(resolver(c)).then(ok, ko) } catch (e) { return Promise.reject(e).then(ok, ko) }
    }
    return b
  }
  const sb = {
    rpc: (nome: string, args: Record<string, unknown>) => construtor({ tipo: 'rpc', nome, args, filtros: [] }),
    from: (nome: string) => construtor({ tipo: 'from', nome, filtros: [] }),
  }
  return { sb: sb as unknown as SupabaseClient, chamadas }
}
const ok = (data: unknown): Resp => ({ data, error: null })
const falha = (code: string, message = 'mensagem do banco'): Resp => ({ data: null, error: { message, details: 'detalhe', hint: null, code } })

const NOW = '2026-01-14T12:00:00.000Z'
const PROVA = {
  identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0, retratos_atrasados: 0,
  retratos_em_erro: 0, erros_por_motivo: {}, retratos_na_janela: 4, retratos_perdidos_7d: 0, perdidos_por_motivo: {},
  retratos_total: 10, retratos_ok: 9, primeira_coleta: iso(T0), ultima_coleta: iso(T0 + H), comentarios_total: 50,
  identidades_total: 40, comentarios_ausentes_sem_decisao: 0,
}
const MARCOS_ESPERADOS = [
  { mark: 1, from_h: 24, until_h: 72 }, { mark: 7, from_h: 168, until_h: 240 }, { mark: 30, from_h: 720, until_h: 888 },
]

// ───── lerProva ─────
describe('lerProva', () => {
  const chamar = (sb: SupabaseClient) => lerProva(sb, { siteId: 'site-1', nowIso: NOW, since: null })

  it('função ausente → schema_ausente (os quatro códigos)', async () => {
    for (const code of ['PGRST202', '42883', '42P01', 'PGRST205']) {
      const { sb } = criarSb(() => falha(code))
      expect(await chamar(sb)).toEqual({ ok: false, motivo: 'schema_ausente' })
    }
  })

  it('erro de rede, exceção, resposta nula, chave faltando, chave "3" em texto, mapa que é lista → prova_ilegivel', async () => {
    const semChave = { ...PROVA } as Record<string, unknown>
    delete semChave.retratos_atrasados
    const casos: Resolvedor[] = [
      () => falha('', 'fetch failed'),
      () => { throw new Error('boom') },
      () => ok(null),
      () => ok(semChave),
      () => ok({ ...PROVA, identidade_vencida: '3' }),
      () => ok({ ...PROVA, identidade_vencida: 1.5 }),
      () => ok({ ...PROVA, identidade_vencida: -1 }),
      () => ok({ ...PROVA, erros_por_motivo: [] }),
      () => ok({ ...PROVA, perdidos_por_motivo: { rede: '2' } }),
      () => ok([PROVA]),
      () => ok({ ...PROVA, primeira_coleta: 5 }),
      () => falha('XX000'),
    ]
    for (const r of casos) {
      const { sb } = criarSb(r)
      expect(await chamar(sb)).toEqual({ ok: false, motivo: 'prova_ilegivel' })
    }
  })

  it('prova inteira lida: devolve as chaves do contrato (mapas e datas nulas aceitos)', async () => {
    const { sb } = criarSb(() => ok({ ...PROVA, erros_por_motivo: { rede: 2 }, primeira_coleta: null, ultima_coleta: null, extra_desconhecida: 7 }))
    const r = await chamar(sb)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.prova.erros_por_motivo).toEqual({ rede: 2 })
      expect(r.prova.primeira_coleta).toBeNull()
      expect(Object.keys(r.prova)).not.toContain('extra_desconhecida')
    }
  })

  it('manda p_since e p_site_id; com since nulo manda null (não omite); p_marks exato; p_grace e p_identity_days', async () => {
    const { sb, chamadas } = criarSb(() => ok(PROVA))
    await lerProva(sb, { siteId: 'site-1', nowIso: NOW, since: '2026-01-01T00:00:00.000Z' })
    await lerProva(sb, { siteId: null, nowIso: NOW, since: null })
    expect(chamadas[0].nome).toBe('competitor_comment_health')
    expect(chamadas[0].args).toEqual({
      p_site_id: 'site-1', p_now: NOW, p_marks: MARCOS_ESPERADOS, p_identity_days: 28, p_grace: '30 hours', p_since: '2026-01-01T00:00:00.000Z',
    })
    expect(chamadas[1].args).toHaveProperty('p_since', null)
    expect(chamadas[1].args).toHaveProperty('p_site_id', null)
    expect(chamadas[1].args?.p_marks).toEqual(MARCOS_ESPERADOS)
  })
})

// ───── lerDevidos ─────
const linhaDevido = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
  video_id: 'v-1', youtube_video_id: 'yt-v-1', site_id: 's-1', channel_row_id: 'c-1', channel_youtube_id: CANAL_DO_VIDEO,
  channel_subscribers: 1234, channel_subscribers_hidden: false, mark: 1, t0: iso(T0), deadline: iso(T0 + 72 * H),
  video_comment_count: 57, video_checked_at: iso(T0 + H), prev_status: null, stored_n: 0, total_due: 1, ...o,
})

describe('lerDevidos', () => {
  const chamar = (sb: SupabaseClient, since: string | null = null) => lerDevidos(sb, { nowIso: NOW, since, siteId: null })

  it('[] é lista vazia; null, objeto, erro e linha sem mark são nulo; linha boa vira Devido', async () => {
    expect(await chamar(criarSb(() => ok([])).sb)).toEqual({ linhas: [], total: 0 })
    expect(await chamar(criarSb(() => ok(null)).sb)).toBeNull()
    expect(await chamar(criarSb(() => ok({ a: 1 })).sb)).toBeNull()
    expect(await chamar(criarSb(() => falha('22023')).sb)).toBeNull()
    expect(await chamar(criarSb(() => { throw new Error('x') }).sb)).toBeNull()
    const semMark = linhaDevido()
    delete semMark.mark
    expect(await chamar(criarSb(() => ok([linhaDevido(), semMark])).sb)).toBeNull()
    expect(await chamar(criarSb(() => ok([linhaDevido({ mark: 2 })])).sb)).toBeNull()
    expect(await chamar(criarSb(() => ok([linhaDevido({ stored_n: '3' })])).sb)).toBeNull()
    const r = await chamar(criarSb(() => ok([linhaDevido({ total_due: 31, video_comment_count: null })])).sb)
    expect(r?.total).toBe(31)
    expect(r?.linhas[0]).toMatchObject({ videoId: 'v-1', youtubeVideoId: 'yt-v-1', mark: 1, channelYoutubeId: CANAL_DO_VIDEO, videoCommentCount: null, storedN: 0 })
  })

  it('manda os oito parâmetros por nome, p_marks exato, p_since e p_site_id nulos explícitos', async () => {
    const { sb, chamadas } = criarSb(() => ok([]))
    await chamar(sb)
    await lerDevidos(sb, { nowIso: NOW, since: '2026-01-01T00:00:00.000Z', siteId: 'site-9' })
    expect(chamadas[0].nome).toBe('competitor_comment_due')
    expect(chamadas[0].args).toEqual({
      p_now: NOW, p_marks: MARCOS_ESPERADOS, p_retry_after: '20 hours', p_limit: 200, p_fast_reasons: [...MOTIVOS_PASSAGEIROS],
      p_retry_fast: '15 minutes', p_since: null, p_site_id: null,
    })
    expect(chamadas[1].args).toMatchObject({ p_since: '2026-01-01T00:00:00.000Z', p_site_id: 'site-9' })
  })
})

// ───── lerGuardados e lerCadastro ─────
describe('lerGuardados', () => {
  it('a URL da consulta só tem video_id; devolve id, is_creator e speaker_no', async () => {
    const { sb, chamadas } = criarSb(() => ok([
      { id: 1, youtube_comment_id: 'Ugx-a', parent_id: null, is_creator: false, speaker_no: null },
      { id: 2, youtube_comment_id: 'Ugx-b', parent_id: 1, is_creator: false, speaker_no: 2 },
      { id: 3, youtube_comment_id: 'Ugx-c', parent_id: 1, is_creator: true, speaker_no: null },
    ]))
    const r = await lerGuardados(sb, 'video-uuid-1')
    expect(r).toEqual([
      { id: 1, youtubeId: 'Ugx-a', topo: true, paiId: null, isCreator: false, speakerNo: null },
      { id: 2, youtubeId: 'Ugx-b', topo: false, paiId: 1, isCreator: false, speakerNo: 2 },
      { id: 3, youtubeId: 'Ugx-c', topo: false, paiId: 1, isCreator: true, speakerNo: null },
    ])
    expect(chamadas[0].nome).toBe('competitor_video_comments')
    expect(chamadas[0].colunas).toBe('id, youtube_comment_id, parent_id, is_creator, speaker_no')
    expect(chamadas[0].filtros.filter(([m]) => m !== 'limit')).toEqual([['eq', ['video_id', 'video-uuid-1']]])
  })

  it('speaker_no que não é inteiro positivo vira nulo (linha ilegível), nunca número', async () => {
    const linha = (n: unknown) => ({ id: 2, youtube_comment_id: 'Ugx-b', parent_id: 1, is_creator: false, speaker_no: n })
    for (const ruim of [0, -1, 1.5, '2', NaN]) {
      const r = await lerGuardados(criarSb(() => ok([linha(ruim)])).sb, 'v')
      expect(r?.[0]?.speakerNo).toBeNull()
    }
  })

  it('1.000 linhas lança; erro de banco e linha ilegível dão nulo', async () => {
    const mil = Array.from({ length: 1000 }, (_, i) => ({ id: i, youtube_comment_id: 'Ugx-' + i, parent_id: null, is_creator: false, speaker_no: null }))
    await expect(lerGuardados(criarSb(() => ok(mil)).sb, 'v')).rejects.toBeInstanceOf(ComentariosErro)
    expect(await lerGuardados(criarSb(() => falha('42501')).sb, 'v')).toBeNull()
    expect(await lerGuardados(criarSb(() => ok({})).sb, 'v')).toBeNull()
    expect(await lerGuardados(criarSb(() => ok([{ id: 1, youtube_comment_id: 5, parent_id: null, is_creator: false, speaker_no: null }])).sb, 'v')).toBeNull()
  })
})

describe('lerCadastro', () => {
  it('lê os canais acompanhados e os do dono do site, em paralelo', async () => {
    const { sb, chamadas } = criarSb((c) => c.nome === 'competitor_channels'
      ? ok([{ id: 'linha-1', channel_id: CANAL_ACOMPANHADO }])
      : ok([{ channel_id: canal(3) }]))
    const r = await lerCadastro(sb, 'site-1')
    expect(r?.acompanhados.get(CANAL_ACOMPANHADO)).toBe('linha-1')
    expect(r?.proprios.has(canal(3))).toBe(true)
    expect(chamadas.map((c) => c.nome).sort()).toEqual(['competitor_channels', 'youtube_channels'])
    for (const c of chamadas) expect(c.filtros).toContainEqual(['eq', ['site_id', 'site-1']])
  })
  it('erro em qualquer das duas, ou resposta que não é lista, é nulo', async () => {
    expect(await lerCadastro(criarSb((c) => (c.nome === 'youtube_channels' ? falha('42501') : ok([]))).sb, 's')).toBeNull()
    expect(await lerCadastro(criarSb((c) => (c.nome === 'competitor_channels' ? ok(null) : ok([]))).sb, 's')).toBeNull()
    expect(await lerCadastro(criarSb(() => ok([])).sb, 's')).toEqual({ acompanhados: new Map(), proprios: new Set() })
  })
})

// ───── montarPacote ─────
const devido = (o: Partial<Devido> = {}): Devido => ({
  videoId: 'v-1', youtubeVideoId: 'yt-v-1', siteId: 's-1', channelRowId: 'c-1', channelYoutubeId: CANAL_DO_VIDEO,
  channelSubscribers: 437000000, channelSubscribersHidden: false, mark: 1, t0: iso(T0), deadline: iso(T0 + 72 * H),
  videoCommentCount: 57, videoCheckedAt: iso(T0 + H), prevStatus: null, storedN: 0, totalDue: 1, ...o,
})
const TIRADO = iso(T0 + 30 * H)

function loteDeItens(itens: unknown[]) {
  const l = loteDe(corpoDeConversas(itens), CANAL_DO_VIDEO)
  if (l === null) throw new Error('fixture ilegível')
  return l
}

function pacoteOk(itens: unknown[], extra: Partial<Parameters<typeof montarPacote>[0]> = {}, destaques = new Map<string, Destaque>()) {
  const lote = loteDeItens(itens)
  const escolhidos = selecionar(lote.conversas, destaques)
  return montarPacote({
    devido: devido(), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos, consulta: { n: 2, desconhecidos: 1 },
    agregados: agregadosDoLote(lote, T0), unidades: 3, ...extra,
  })
}

const SNAP_CHAVES = [
  'taken_at', 'from_h', 'until_h', 'status', 'error_reason', 'pool_size', 'pool_complete', 'video_comment_count', 'selected_count',
  'featured_lookup_n', 'featured_unknown_n', 'rule_version', 'rule_params', 'units_used', 'pool_stats', 'identity_days', 'creator_replies_max', 'third_party_replies_max',
].sort()
const comentariosDe = (p: { comments: unknown[] }) => p.comments as Array<Record<string, unknown>>
const snapDe = (p: { snap: unknown }) => p.snap as Record<string, unknown>

describe('montarPacote', () => {
  it('retrato ok tem todas as chaves, com from_h e until_h do marco e sem video_age_hours; identity_days 28; rule_params com os limites das faixas', () => {
    const p = pacoteOk([conversa(1), conversa(2)])
    const s = snapDe(p)
    expect(Object.keys(s).sort()).toEqual(SNAP_CHAVES)
    expect(s).toMatchObject({ taken_at: TIRADO, from_h: 24, until_h: 72, status: 'ok', error_reason: null, pool_size: 2, pool_complete: true,
      video_comment_count: 57, selected_count: 2, featured_lookup_n: 2, featured_unknown_n: 1, rule_version: 2, units_used: 3,
      identity_days: 28, creator_replies_max: 5, third_party_replies_max: 20 })
    expect(s).not.toHaveProperty('video_age_hours')
    expect(s.rule_params).toEqual(ruleParams())
    expect(JSON.stringify(s.rule_params)).toContain('"10m_mais",10000000')
    const m7 = snapDe(pacoteOk([conversa(1)], { devido: devido({ mark: 7 }) }))
    expect([m7.from_h, m7.until_h]).toEqual([168, 240])
    const m30 = snapDe(pacoteOk([conversa(1)], { devido: devido({ mark: 30 }) }))
    expect([m30.from_h, m30.until_h]).toEqual([720, 888])
  })

  it('o criador sai com author nulo; os outros levam o autor nos três campos, o lote traz a posição e o slot', () => {
    const p = pacoteOk([conversa(1, { canalId: CANAL_DO_VIDEO, nome: 'Criador Inventado' }), conversa(2, { nome: SENT_NOME, canalId: canal(222) })])
    const cs = comentariosDe(p)
    const criador = cs.find((c) => c.youtube_comment_id === 'Ugx-sintetico-01')
    const outro = cs.find((c) => c.youtube_comment_id === 'Ugx-sintetico-02')
    expect(criador).toMatchObject({ is_creator: true, author: null, slot: 'criador', parent_youtube_id: null, via: 'lote' })
    expect(JSON.stringify(criador)).not.toContain('Criador Inventado')
    expect(outro?.author).toEqual({ display_name: SENT_NOME, channel_id: canal(222), avatar_url: 'https://exemplo.invalid/foto/2.jpg' })
    expect(outro).toMatchObject({ is_creator: false, likes: 2, reply_count: 0, relevance_rank: 2, slot: 'curtidos' })
  })

  it('nenhuma resposta de terceiro: só as do criador entram, sem autor, sem slot, ligadas ao pai', () => {
    const pai = 'Ugx-sintetico-01'
    const p = pacoteOk([conversa(1, {
      canalId: canal(222),
      respostas: [
        resposta(pai, 1, { canalId: CANAL_DO_VIDEO, texto: 'Resposta do criador inventada' }),
        resposta(pai, 2, { canalId: canal(501), texto: SENT_TEXTO_TERCEIRO, nome: SENT_NOME_TERCEIRO }),
      ],
    })])
    const texto = JSON.stringify(p)
    expect(texto).not.toContain(SENT_TEXTO_TERCEIRO)
    expect(texto).not.toContain(SENT_NOME_TERCEIRO)
    expect(texto).not.toContain(canal(501))
    const respostas = comentariosDe(p).filter((c) => c.parent_youtube_id !== null)
    expect(respostas).toHaveLength(1)
    expect(respostas[0]).toMatchObject({ parent_youtube_id: pai, is_creator: true, body: 'Resposta do criador inventada' })
    expect(respostas[0]).not.toHaveProperty('author')
    expect(respostas[0]).not.toHaveProperty('slot')
  })

  it('resposta que diz ser do criador mas é de outro canal não passa (defesa extra)', () => {
    const lote = loteDeItens([conversa(1, { canalId: canal(222), respostas: [resposta('Ugx-sintetico-01', 1, { canalId: CANAL_DO_VIDEO })] })])
    lote.conversas[0].respostasDoCriador[0].autorCanalId = canal(777)
    const p = montarPacote({ devido: devido(), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos: selecionar(lote.conversas, new Map()), consulta: { n: 0, desconhecidos: 0 }, unidades: 1 })
    expect(comentariosDe(p).filter((c) => c.parent_youtube_id !== null)).toHaveLength(0)
  })

  it('retrato que não é ok sai com comments vazio, missing vazio e sem pool_stats', () => {
    const lote = loteDeItens([conversa(1)])
    for (const [estado, motivo] of [['sem_comentarios', undefined], ['desligados', undefined], ['erro', 'rede']] as const) {
      const p = montarPacote({
        devido: devido(), tiradoEm: TIRADO, estado, motivo, lote, escolhidos: selecionar(lote.conversas, new Map()),
        agregados: agregadosDoLote(lote, T0), ausentes: ['Ugx-x'], consulta: { n: 0, desconhecidos: 0 }, unidades: 1,
      })
      expect(p.comments).toEqual([])
      expect(p.missing).toEqual([])
      expect(snapDe(p)).not.toHaveProperty('pool_stats')
      expect(snapDe(p).status).toBe(estado)
      expect(snapDe(p).error_reason).toBe(estado === 'erro' ? 'rede' : null)
    }
  })

  it('sem_comentarios grava a contagem lida (0), não a guardada; erro sem motivo ou com motivo fora do catálogo é recusado', () => {
    const p = montarPacote({ devido: devido({ videoCommentCount: 99 }), tiradoEm: TIRADO, estado: 'sem_comentarios', consulta: { n: 0, desconhecidos: 0 }, unidades: 1 })
    expect(snapDe(p).video_comment_count).toBe(0)
    expect(snapDe(p).pool_size).toBeNull()
    const base = { devido: devido(), tiradoEm: TIRADO, consulta: { n: 0, desconhecidos: 0 }, unidades: 1 }
    expect(() => montarPacote({ ...base, estado: 'erro' })).toThrow()
    expect(() => montarPacote({ ...base, estado: 'erro', motivo: 'Texto Livre' as never })).toThrow()
  })

  it('nenhum número de inscritos nem razão em nenhuma chave (sentinela 437000000); pool_stats só tem número e sim/não', () => {
    const destaques = new Map<string, Destaque>([['Ugx-sintetico-03', { motivo: 'inscritos', canalRowId: null, faixaTamanho: '10m_mais', faixaRazao: '100x_1000x' }]])
    const p = pacoteOk([conversa(1), conversa(2), conversa(3, { canalId: canal(333) })], { conferenciaFalhou: true }, destaques)
    const texto = JSON.stringify(p)
    expect(texto).not.toContain('437000000')
    expect(comentariosDe(p).find((c) => c.youtube_comment_id === 'Ugx-sintetico-03')).toMatchObject({
      featured_reason: 'inscritos', featured_size_band: '10m_mais', featured_ratio_band: '100x_1000x', featured_channel_id: null,
    })
    const stats = snapDe(p).pool_stats as Record<string, unknown>
    for (const v of Object.values(stats)) expect(['number', 'boolean']).toContain(typeof v)
    expect(stats.conferencia_falhou).toBe(true)
    expect(stats.conversas).toBe(3)
  })

  it('id que está no lote e em porId sai uma vez, como lote, com o slot; id repetido no mesmo grupo sai uma vez', () => {
    const lote = loteDeItens([conversa(1), conversa(2)])
    const porId = new Map([
      ['Ugx-sintetico-01', { texto: 'texto novo', cortado: false, editadoEm: null, curtidas: 9, respostasTotal: null }],
      ['Ugx-guardado-99', { texto: 'texto guardado', cortado: false, editadoEm: null, curtidas: 4, respostasTotal: null }],
    ])
    const escolhidos = selecionar(lote.conversas, new Map())
    const dup: Escolhido[] = [...escolhidos, escolhidos[0]]
    const p = montarPacote({ devido: devido({ mark: 7 }), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos: dup, porId, consulta: { n: 0, desconhecidos: 0 }, unidades: 4 })
    const ids = comentariosDe(p).map((c) => c.youtube_comment_id)
    expect(ids.filter((i) => i === 'Ugx-sintetico-01')).toHaveLength(1)
    expect(comentariosDe(p).find((c) => c.youtube_comment_id === 'Ugx-sintetico-01')).toMatchObject({ via: 'lote', slot: 'curtidos' })
    expect(comentariosDe(p).find((c) => c.youtube_comment_id === 'Ugx-guardado-99')).toMatchObject({ via: 'id', likes: 4, body: 'texto guardado' })
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('guardado não escolhido que veio no lote leva as respostas do criador vistas agora, com slot nulo e a posição; sem autor', () => {
    const itens = Array.from({ length: 14 }, (_, i) => conversa(i + 1, {
      curtidas: 100 - i,
      // as quatro primeiras enchem a vaga do criador; a 14ª também foi respondida por ele, mas não cabe mais
      respostas: i < 4 ? [resposta(`Ugx-sintetico-${String(i + 1).padStart(2, '0')}`, 1, { canalId: CANAL_DO_VIDEO })] : undefined,
    }))
    // a 14ª (a menos curtida) fica fora dos 12 escolhidos mas já estava guardada; o criador respondeu a ela
    itens[13] = conversa(14, { curtidas: 1, canalId: canal(414), nome: SENT_NOME, respostas: [resposta('Ugx-sintetico-14', 1, { canalId: CANAL_DO_VIDEO, texto: 'Resposta tardia do criador' })] })
    const lote = loteDeItens(itens)
    const escolhidos = selecionar(lote.conversas, new Map())
    expect(escolhidos.map((e) => e.conversa.id)).not.toContain('Ugx-sintetico-14')
    const p = montarPacote({
      devido: devido({ mark: 7 }), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos,
      guardados: [{ id: 14, youtubeId: 'Ugx-sintetico-14', topo: true, paiId: null, isCreator: false, speakerNo: null }], consulta: { n: 0, desconhecidos: 0 }, unidades: 2,
    })
    const topo = comentariosDe(p).find((c) => c.youtube_comment_id === 'Ugx-sintetico-14')
    expect(topo).toMatchObject({ slot: null, relevance_rank: 14, via: 'lote', is_creator: false, likes: 1 })
    expect(topo).not.toHaveProperty('author')
    expect(comentariosDe(p).find((c) => c.parent_youtube_id === 'Ugx-sintetico-14')).toMatchObject({ body: 'Resposta tardia do criador', is_creator: true })
    expect(JSON.stringify(p)).not.toContain(SENT_NOME)
  })

  it('curtidas nulas na conferência por id: não vira zero, o comentário não é enviado nem marcado ausente', () => {
    const lote = loteDeItens([conversa(1)])
    const porId = new Map([
      ['Ugx-sem-curtida', { texto: 'sem curtida legível', cortado: false, editadoEm: null, curtidas: null, respostasTotal: null }],
      ['Ugx-com-zero', { texto: 'zero de verdade', cortado: false, editadoEm: null, curtidas: 0, respostasTotal: null }],
    ])
    const p = montarPacote({
      devido: devido({ mark: 7 }), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos: selecionar(lote.conversas, new Map()), porId,
      ausentes: ['Ugx-sem-curtida', 'Ugx-sumiu', 'Ugx-sumiu', 'Ugx-sintetico-01'], consulta: { n: 0, desconhecidos: 0 }, unidades: 2,
    })
    const ids = comentariosDe(p).map((c) => c.youtube_comment_id)
    expect(ids).not.toContain('Ugx-sem-curtida')
    expect(comentariosDe(p).find((c) => c.youtube_comment_id === 'Ugx-com-zero')?.likes).toBe(0)
    expect(p.missing).toEqual(['Ugx-sumiu'])
  })

  it('mais de 12 escolhidos é recusado (não pode acontecer)', () => {
    const lote = loteDeItens(Array.from({ length: 13 }, (_, i) => conversa(i + 1)))
    const escolhidos = [...lote.conversas].map((conversaX) => ({ conversa: conversaX, grupo: 'curtidos' as const, destaque: null }))
    expect(() => montarPacote({ devido: devido(), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos, consulta: { n: 0, desconhecidos: 0 }, unidades: 1 })).toThrow()
  })
})

// ───── a identidade do autor: LGPD ─────
describe('identidade do autor (LGPD)', () => {
  it('o nome, o id do canal e a foto do autor só aparecem em author; nunca em snap, rule_params, corpo nem p_missing', async () => {
    const ID_AUTOR = 'UCsentinelaAUTOR000000001'
    const FOTO = 'https://exemplo.invalid/foto/SENTINELA-FOTO.jpg'
    const item = conversa(1, { nome: SENT_NOME, canalId: ID_AUTOR, texto: SENT_TEXTO_TOPO })
    const sn = (item.snippet as Record<string, unknown>).topLevelComment as { snippet: Record<string, unknown> }
    sn.snippet.authorProfileImageUrl = FOTO
    const p = pacoteOk([item, conversa(2, { canalId: canal(5) })])
    const { sb, chamadas } = criarSb(() => ok({ status: 'gravado' }))
    await gravarRetrato(sb, 'v-1', 1, p)
    const args = chamadas[0].args as Record<string, unknown>
    const comentario = (args.p_comments as Array<Record<string, unknown>>).find((c) => c.youtube_comment_id === 'Ugx-sintetico-01')
    expect(comentario?.author).toEqual({ display_name: SENT_NOME, channel_id: ID_AUTOR, avatar_url: FOTO })
    // varre tudo o que vai ao banco: tirando author, a sentinela some
    const semAuthor = JSON.stringify(args, (chave, v: unknown) => (chave === 'author' ? undefined : v))
    for (const s of [SENT_NOME, ID_AUTOR, FOTO, 'SENTINELA-FOTO']) expect(semAuthor).not.toContain(s)
    // e o texto do comentário só está em body
    const semBody = JSON.stringify(args, (chave, v: unknown) => (chave === 'body' ? undefined : v))
    expect(semBody).not.toContain(SENT_TEXTO_TOPO)
    expect(JSON.stringify(args.p_snap)).not.toContain('SENTINELA')
    expect(JSON.stringify(args.p_missing)).not.toContain('SENTINELA')
  })

  it('o erro do banco com a sentinela em message e details não sai de gravarRetrato', async () => {
    const { sb } = criarSb(() => ({ data: null, error: { message: `Failing row contains (${SENT_NOME})`, details: `(${SENT_TEXTO_TOPO})`, hint: SENT_NOME, code: '23514' } }))
    const r = await gravarRetrato(sb, 'v-1', 1, pacoteOk([conversa(1)]))
    expect(r).toEqual({ ok: false, codigo: 'banco:23514' })
    expect(JSON.stringify(r)).not.toContain('SENTINELA')
  })
})

// ───── gravarRetrato ─────
describe('gravarRetrato', () => {
  it('uma só ida ao banco (uma transação): o retrato e os comentários vão juntos, por nome de parâmetro', async () => {
    const { sb, chamadas } = criarSb(() => ok({ status: 'gravado', retrato: 'ok', recebidos: 2, comentarios_novos: 2, nao_gravados: 0 }))
    const p = pacoteOk([conversa(1), conversa(2)])
    const r = await gravarRetrato(sb, 'v-1', 1, p)
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].nome).toBe('apply_competitor_comment_snap')
    expect(Object.keys(chamadas[0].args ?? {}).sort()).toEqual(['p_comments', 'p_mark', 'p_missing', 'p_snap', 'p_video'])
    expect(chamadas[0].args).toMatchObject({ p_video: 'v-1', p_mark: 1, p_snap: p.snap, p_comments: p.comments, p_missing: [] })
    expect(r).toEqual({ ok: true, resultado: { status: 'gravado', retrato: 'ok', recebidos: 2, comentarios_novos: 2, nao_gravados: 0 } })
  })

  it('fora_da_tolerancia, ja_existe e video_ausente são resultado, não erro; a repetição não duplica (ja_existe)', async () => {
    for (const status of ['fora_da_tolerancia', 'ja_existe', 'video_ausente']) {
      const { sb } = criarSb(() => ok({ status, idade_h: 80.5, anterior: 'ok' }))
      const r = await gravarRetrato(sb, 'v-1', 1, pacoteOk([conversa(1)]))
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.resultado.status).toBe(status)
    }
  })

  it('retrato sem comentários e com comentários desligados são estados gravados, com uma ida e sem lista', async () => {
    for (const estado of ['sem_comentarios', 'desligados'] as const) {
      const { sb, chamadas } = criarSb(() => ok({ status: 'gravado', retrato: estado, recebidos: 0 }))
      const p = montarPacote({ devido: devido(), tiradoEm: TIRADO, estado, consulta: { n: 0, desconhecidos: 0 }, unidades: 1 })
      const r = await gravarRetrato(sb, 'v-1', 1, p)
      expect(r.ok).toBe(true)
      expect(chamadas[0].args?.p_comments).toEqual([])
      expect((chamadas[0].args?.p_snap as Record<string, unknown>).status).toBe(estado)
    }
  })

  it('erro do banco devolve só o código; função ausente também (nunca "gravou zero"); resposta ilegível não é sucesso', async () => {
    expect(await gravarRetrato(criarSb(() => falha('PGRST202')).sb, 'v', 1, pacoteOk([conversa(1)]))).toEqual({ ok: false, codigo: 'banco:pgrst202' })
    expect(await gravarRetrato(criarSb(() => falha('')).sb, 'v', 1, pacoteOk([conversa(1)]))).toEqual({ ok: false, codigo: 'banco:sem_codigo' })
    expect(await gravarRetrato(criarSb(() => { throw new Error('boom ' + SENT_NOME) }).sb, 'v', 1, pacoteOk([conversa(1)]))).toEqual({ ok: false, codigo: 'inesperado:error' })
    for (const lixo of [null, { status: 'outro' }, [], { recebidos: 3 }]) {
      const r = await gravarRetrato(criarSb(() => ok(lixo)).sb, 'v', 1, pacoteOk([conversa(1)]))
      expect(r.ok).toBe(false)
    }
  })

  it('marco 7 com a janela do marco 1 não é enviado; marco e janela certos chamam uma vez', async () => {
    const { sb, chamadas } = criarSb(() => ok({ status: 'gravado' }))
    const pacote1 = pacoteOk([conversa(1)])
    expect(await gravarRetrato(sb, 'v', 7, pacote1)).toEqual({ ok: false, codigo: 'tolerancia_incoerente' })
    const pacote7 = pacoteOk([conversa(1)], { devido: devido({ mark: 7 }) })
    expect(await gravarRetrato(sb, 'v', 1, pacote7)).toEqual({ ok: false, codigo: 'tolerancia_incoerente' })
    const semJanela = { ...pacote1, snap: { ...(pacote1.snap as Record<string, unknown>), from_h: undefined } as never }
    expect(await gravarRetrato(sb, 'v', 1, semJanela)).toEqual({ ok: false, codigo: 'tolerancia_incoerente' })
    expect(await gravarRetrato(sb, 'v', 3 as never, pacote1)).toEqual({ ok: false, codigo: 'tolerancia_incoerente' })
    expect(chamadas).toHaveLength(0)
    expect((await gravarRetrato(sb, 'v', 7, pacote7)).ok).toBe(true)
    expect(chamadas).toHaveLength(1)
  })
})

// ───── tempo máximo ─────
describe('tempo máximo de cada ida ao banco', () => {
  afterEach(() => { vi.useRealTimers() })

  /** Fica pendurado e, como o cliente real, RESOLVE com um erro (não lança) quando o sinal aborta. */
  const pendurado: Resolvedor = (c) => new Promise<Resp>((resolve) => {
    c.sinal?.addEventListener('abort', () => resolve({ data: null, error: { message: 'AbortError: signal is aborted without reason', details: '', hint: '', code: '' } }))
  })

  it('ida que não responde: lerProva, lerDevidos e gravarRetrato voltam em até dbTimeoutMs com prova_ilegivel, nulo e banco:tempo_esgotado', async () => {
    vi.useFakeTimers()
    const { sb } = criarSb(pendurado)
    const prova = lerProva(sb, { siteId: null, nowIso: NOW, since: null })
    const devidos = lerDevidos(sb, { nowIso: NOW, since: null, siteId: null })
    const gravar = gravarRetrato(sb, 'v', 1, pacoteOk([conversa(1)]))
    await vi.advanceTimersByTimeAsync(COMMENT_RULES.dbTimeoutMs)
    expect(await prova).toEqual({ ok: false, motivo: 'prova_ilegivel' })
    expect(await devidos).toBeNull()
    expect(await gravar).toEqual({ ok: false, codigo: 'banco:tempo_esgotado' })
  })

  it('o cliente que nem reage ao sinal também é cortado; lerGuardados, lerCadastro, anular e lerImpacto cortam', async () => {
    vi.useFakeTimers()
    const { sb } = criarSb(() => new Promise<Resp>(() => undefined))
    const g = lerGuardados(sb, 'v')
    const c = lerCadastro(sb, 's')
    const a = anular(sb).catch((e: unknown) => e)
    const i = lerImpacto(sb, 's', 'c').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(COMMENT_RULES.dbTimeoutMs)
    expect(await g).toBeNull()
    expect(await c).toBeNull()
    expect(await a).toMatchObject({ message: expect.stringMatching(/^AbortError/) })
    expect(await i).toMatchObject({ message: expect.stringMatching(/^AbortError/) })
  })

  it('o tempo máximo obedece ao relógio falso: dbTimeoutMs − 1 não aborta e mais 1 aborta; nenhum arquivo de comentarios/ usa o sinal pronto do runtime', async () => {
    vi.useFakeTimers()
    const { sb, chamadas } = criarSb(pendurado)
    const prova = lerProva(sb, { siteId: null, nowIso: NOW, since: null })
    await vi.advanceTimersByTimeAsync(COMMENT_RULES.dbTimeoutMs - 1)
    expect(chamadas[0].sinal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(chamadas[0].sinal?.aborted).toBe(true)
    await prova
    vi.useRealTimers()
    // varredura: o sinal pronto do runtime não obedece ao relógio falso. api.ts (HTTP, não banco) é a exceção de origem (Tarefa 6, já no HEAD).
    const dir = join(__dirname, '../../../src/lib/youtube/observatorio/comentarios')
    const proibido = 'AbortSignal' + '.timeout'
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && n !== 'api.ts')) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toContain(proibido)
    }
  })

  it('o tempo pendente é limpo quando a ida responde (nenhum timer sobra)', async () => {
    vi.useFakeTimers()
    const { sb } = criarSb(() => ok(PROVA))
    await lerProva(sb, { siteId: null, nowIso: NOW, since: null })
    expect(vi.getTimerCount()).toBe(0)
  })
})

// ───── anular e lerImpacto ─────
describe('anular', () => {
  const RESULT = { apagadas: 3, comentarios_carimbados: 3, vencidas_ha_mais_de_1_dia: 0, restantes: 10 }

  it('sem site manda p_site_id nulo; com site manda o site; devolve as quatro contagens', async () => {
    const { sb, chamadas } = criarSb(() => ok(RESULT))
    expect(await anular(sb)).toEqual(RESULT)
    await anular(sb, 'site-1')
    expect(chamadas[0].nome).toBe('competitor_comment_identity_purge')
    expect(chamadas[0].args).toEqual({ p_site_id: null })
    expect(chamadas[1].args).toEqual({ p_site_id: 'site-1' })
  })

  it('contagem em texto, negativa, não inteira ou ausente lança ComentariosErro(resposta_ilegivel), nunca vira 0', async () => {
    for (const lixo of [{ ...RESULT, apagadas: '3' }, { ...RESULT, restantes: -1 }, { ...RESULT, apagadas: 1.5 }, null, { apagadas: 1 }]) {
      await expect(anular(criarSb(() => ok(lixo)).sb)).rejects.toMatchObject({ name: 'ComentariosErro', codigo: 'resposta_ilegivel' })
    }
  })

  it('erro do banco lança um objeto saneado: mantém o código, perde message, details e hint', async () => {
    const e = await anular(criarSb(() => ({ data: null, error: { message: `Failing row (${SENT_NOME})`, details: SENT_TEXTO_TOPO, hint: SENT_NOME, code: 'PGRST202' } })).sb).catch((x: unknown) => x)
    expect(e).toMatchObject({ code: 'PGRST202' })
    expect(JSON.stringify(e)).not.toContain('SENTINELA')
    expect(String((e as { message: unknown }).message)).not.toContain('SENTINELA')
  })
})

describe('lerImpacto', () => {
  const OK = { status: 'ok', comment_snaps: 4, comments: 20, comment_marks: 40, comment_authors: 15, featured_elsewhere: 2 }

  it('contagem "8" em texto lança; not_found devolve nulo; resposta boa devolve as cinco contagens', async () => {
    await expect(lerImpacto(criarSb(() => ok({ ...OK, comments: '8' })).sb, 's', 'c')).rejects.toMatchObject({ codigo: 'resposta_ilegivel' })
    await expect(lerImpacto(criarSb(() => ok({ ...OK, comment_marks: -2 })).sb, 's', 'c')).rejects.toMatchObject({ codigo: 'resposta_ilegivel' })
    await expect(lerImpacto(criarSb(() => ok(null)).sb, 's', 'c')).rejects.toMatchObject({ codigo: 'resposta_ilegivel' })
    expect(await lerImpacto(criarSb(() => ok({ status: 'not_found' })).sb, 's', 'c')).toBeNull()
    const { sb, chamadas } = criarSb(() => ok(OK))
    expect(await lerImpacto(sb, 'site-1', 'canal-1')).toEqual({ comment_snaps: 4, comments: 20, comment_marks: 40, comment_authors: 15, featured_elsewhere: 2 })
    expect(chamadas[0].nome).toBe('competitor_channel_comment_impact')
    expect(chamadas[0].args).toEqual({ p_site_id: 'site-1', p_channel_id: 'canal-1' })
  })
})


// ───── F2-coleta: respostas de espectadores ─────
describe('montarPacote: respostas de espectadores (F2-coleta)', () => {
  const SENT_CANAL_T = canal(777)
  const SENT_FOTO_T = 'https://exemplo.invalid/foto/SENTINELA-FOTO-T.jpg'
  const comCriador = (extra: Array<Record<string, unknown>>, o: Record<string, unknown> = {}) => conversa(1, {
    curtidas: 50, respostas: [resposta('Ugx-sintetico-01', 1, { canalId: CANAL_DO_VIDEO }), ...extra], ...o,
  })
  const terceiros = (n: number) => Array.from({ length: n }, (_, i) => resposta('Ugx-sintetico-01', 10 + i, { canalId: canal(200 + i), texto: `Espectador ${i}` }))
  const numeros = (ids: string[]) => new Map(ids.map((id, i) => [id, i + 1]))
  const idsT = (n: number) => Array.from({ length: n }, (_, i) => `Ugx-sintetico-01.Resposta-sintetica-${10 + i}`)
  const T = (p: { comments: unknown[] }) => comentariosDe(p).filter((c) => c.is_creator === false && c.parent_youtube_id !== null)

  it('(a) fio com resposta do criador e 3 espectadores: 3 linhas com as chaves exatas, sem author', () => {
    const p = pacoteOk([comCriador(terceiros(3))], { speakers: numeros(idsT(3)) })
    const t = T(p)
    expect(t).toHaveLength(3)
    for (const l of t) {
      expect(Object.keys(l).sort()).toEqual(['body', 'body_truncated', 'edited_at', 'is_creator', 'likes', 'parent_youtube_id', 'published_at', 'speaker_no', 'via', 'youtube_comment_id'])
      expect(l).toMatchObject({ is_creator: false, via: 'lote', parent_youtube_id: 'Ugx-sintetico-01' })
    }
    expect(t.map((l) => l.speaker_no)).toEqual([1, 2, 3])
  })

  it('(b) fio sem resposta do criador: nenhuma linha de espectador', () => {
    const p = pacoteOk([conversa(1, { respostas: terceiros(3) })], { speakers: numeros(idsT(3)) })
    expect(T(p)).toHaveLength(0)
  })

  it('(c) guardado que veio no lote sem ser escolhido: os espectadores dele também saem', () => {
    const itens = Array.from({ length: 14 }, (_, i) => conversa(i + 1, {
      curtidas: 100 - i,
      respostas: i < 4 ? [resposta(`Ugx-sintetico-${String(i + 1).padStart(2, '0')}`, 1, { canalId: CANAL_DO_VIDEO })] : undefined,
    }))
    itens[13] = conversa(14, { curtidas: 1, respostas: [resposta('Ugx-sintetico-14', 1, { canalId: CANAL_DO_VIDEO }), resposta('Ugx-sintetico-14', 2, { canalId: canal(300) })] })
    const lote = loteDeItens(itens)
    const escolhidos = selecionar(lote.conversas, new Map())
    expect(escolhidos.map((e) => e.conversa.id)).not.toContain('Ugx-sintetico-14')
    const id = 'Ugx-sintetico-14.Resposta-sintetica-02'
    const p = montarPacote({
      devido: devido({ mark: 7 }), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos, consulta: { n: 0, desconhecidos: 0 }, unidades: 2,
      guardados: [{ id: 14, youtubeId: 'Ugx-sintetico-14', topo: true, paiId: null, isCreator: false, speakerNo: null }], speakers: new Map([[id, 2]]),
    })
    expect(T(p).map((l) => l.youtube_comment_id)).toEqual([id])
  })

  it('(d) LGPD: nome, canal e foto do espectador não aparecem em lugar nenhum do pacote', () => {
    const r = resposta('Ugx-sintetico-01', 10, { canalId: SENT_CANAL_T, nome: SENT_NOME_TERCEIRO, texto: SENT_TEXTO_TERCEIRO })
    ;(r.snippet as Record<string, unknown>).authorProfileImageUrl = SENT_FOTO_T
    const p = pacoteOk([comCriador([r])], { speakers: numeros(idsT(1)) })
    expect(T(p)).toHaveLength(1)
    const json = JSON.stringify(p)
    for (const proibido of [SENT_NOME_TERCEIRO, SENT_CANAL_T, SENT_FOTO_T]) expect(json).not.toContain(proibido)
    expect(json).toContain(SENT_TEXTO_TERCEIRO) // o texto vai; o resto não
  })

  it('(e) o snap traz creator_replies_max 5, third_party_replies_max 20 e rule_version 2; sem terceiros o máximo é 0', () => {
    const p = pacoteOk([comCriador(terceiros(1))], { speakers: numeros(idsT(1)) })
    expect(snapDe(p)).toMatchObject({ creator_replies_max: 5, third_party_replies_max: 20, rule_version: 2 })
    const q = pacoteOk([comCriador(terceiros(1))], { speakers: numeros(idsT(1)), semTerceiros: true })
    expect(snapDe(q).third_party_replies_max).toBe(0)
    expect(T(q)).toHaveLength(0)
  })

  it('(e2) retrato sem terceiros grava o teto efetivo 0 no rule_params e marca terceiros_sem_numeracao no pool_stats', () => {
    const q = pacoteOk([comCriador(terceiros(1))], { speakers: numeros(idsT(1)), semTerceiros: true, terceirosSemNumeracao: 2 })
    expect((snapDe(q).rule_params as Record<string, unknown>).third_party_replies_max).toBe(0)
    expect((snapDe(q).pool_stats as Record<string, unknown>).terceiros_sem_numeracao).toBe(2)
    const p = pacoteOk([comCriador(terceiros(1))], { speakers: numeros(idsT(1)) })
    expect((snapDe(p).rule_params as Record<string, unknown>).third_party_replies_max).toBe(20)
    expect((snapDe(p).pool_stats as Record<string, unknown>).terceiros_sem_numeracao ?? 0).toBe(0)
  })

  it('(f) espectador sem número no mapa não sai', () => {
    const ids = idsT(3)
    const p = pacoteOk([comCriador(terceiros(3))], { speakers: new Map([[ids[0] as string, 1], [ids[2] as string, 2]]) })
    expect(T(p).map((l) => l.youtube_comment_id)).toEqual([ids[0], ids[2]])
  })

  it('(g) menções trocadas por @…; resposta do criador não é alterada', () => {
    const t = resposta('Ugx-sintetico-01', 10, { canalId: canal(200), texto: '@joao123 concordo' })
    const c = resposta('Ugx-sintetico-01', 1, { canalId: CANAL_DO_VIDEO, texto: '@joao123 obrigado' })
    const p = pacoteOk([conversa(1, { curtidas: 5, respostas: [c, t] })], { speakers: numeros(idsT(1)) })
    expect(T(p)[0]).toMatchObject({ body: '@… concordo' })
    expect(comentariosDe(p).find((x) => x.is_creator === true)).toMatchObject({ body: '@joao123 obrigado' })
  })

  it('(i) achado por id: espectador guardado perde a menção; resposta do criador e topo ficam intactos', () => {
    const lote = loteDeItens([conversa(1)])
    const base = { texto: '@joao123 oi', cortado: false, editadoEm: null, curtidas: 1, respostasTotal: null }
    const porId = new Map([['T1', base], ['C1', base], ['TOPO', base]])
    const p = montarPacote({
      devido: devido({ mark: 7 }), tiradoEm: TIRADO, estado: 'ok', lote, escolhidos: [], consulta: { n: 0, desconhecidos: 0 }, unidades: 2,
      guardados: [
        { id: 1, youtubeId: 'TOPO', topo: true, paiId: null, isCreator: false, speakerNo: null },
        { id: 2, youtubeId: 'T1', topo: false, paiId: 1, isCreator: false, speakerNo: 2 },
        { id: 3, youtubeId: 'C1', topo: false, paiId: 1, isCreator: true, speakerNo: null },
      ], porId,
    })
    const por = (id: string) => comentariosDe(p).find((c) => c.youtube_comment_id === id)
    expect(por('T1')).toMatchObject({ via: 'id', body: '@… oi' })
    expect(por('C1')).toMatchObject({ via: 'id', body: '@joao123 oi' })
    expect(por('TOPO')).toMatchObject({ via: 'id', body: '@joao123 oi' })
  })

  it('(h) ordem: espectadores na ordem dos escolhidos, depois dos guardados; dentro do fio, da mais antiga à mais nova', () => {
    const mais_nova = resposta('Ugx-sintetico-01', 30, { canalId: canal(230), publicadoEm: iso(T0 + 30 * H) })
    const mais_antiga = resposta('Ugx-sintetico-01', 11, { canalId: canal(211), publicadoEm: iso(T0 + 11 * H) })
    const p = pacoteOk([comCriador([mais_nova, mais_antiga])], {
      speakers: new Map([['Ugx-sintetico-01.Resposta-sintetica-30', 2], ['Ugx-sintetico-01.Resposta-sintetica-11', 1]]),
    })
    expect(T(p).map((l) => l.youtube_comment_id)).toEqual(['Ugx-sintetico-01.Resposta-sintetica-11', 'Ugx-sintetico-01.Resposta-sintetica-30'])
  })
})

describe('gravarRetrato: contagens de espectadores', () => {
  const pacote = { snap: { from_h: 24, until_h: 72 }, comments: [], missing: [] }
  it('aceita as cinco contagens novas e continua aceitando o resultado antigo', async () => {
    const novo = { status: 'gravado', terceiros_novos: 2, terceiros_atualizados: 1, terceiros_apagados: 3, terceiros_fora_do_teto: 4, terceiros_sem_fio: 5 }
    const a = await gravarRetrato(criarSb(() => ok(novo)).sb, 'v', 1, pacote)
    expect(a).toMatchObject({ ok: true, resultado: { terceiros_novos: 2, terceiros_atualizados: 1, terceiros_apagados: 3, terceiros_fora_do_teto: 4, terceiros_sem_fio: 5 } })
    const b = await gravarRetrato(criarSb(() => ok({ status: 'gravado', recebidos: 3 })).sb, 'v', 1, pacote)
    expect(b).toMatchObject({ ok: true })
    expect(b.ok && b.resultado.terceiros_novos).toBeUndefined()
    const c = await gravarRetrato(criarSb(() => ok({ status: 'gravado', terceiros_novos: -1, terceiros_apagados: 1.5 })).sb, 'v', 1, pacote)
    expect(c.ok && c.resultado.terceiros_novos).toBeUndefined()
    expect(c.ok && c.resultado.terceiros_apagados).toBeUndefined()
  })
})
