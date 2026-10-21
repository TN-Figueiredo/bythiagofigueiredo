// @vitest-environment node
// A5 · E5a · Tarefa C1: as leituras de contagem da página do canal (M11) e a lista "O que o criador respondeu".
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { falsoComentarios, type Linha } from './comentarios-e5-fake'
import { edicaoDe } from './edicao-teste'
import { leituraDe } from './leitura-teste'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { lerContagemDeRespostas, lerRespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-contagem'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-1'
const OUTRO_SITE = 'site-2'
const CANAL = 'canal-1'
const OUTRO_CANAL = 'canal-2'
const H = 3_600_000
const AGORA = Date.UTC(2026, 9, 15, 12)
const iso = (ms: number): string => new Date(ms).toISOString()
const SENT = 'zz-sentinela-leitor'

const snap = (video: string, mark: number, over: Linha = {}): Linha => ({
  site_id: S, competitor_channel_id: CANAL, video_id: video, mark, status: 'ok', taken_at: iso(AGORA - (40 - mark) * H), ...over,
})
const coment = (id: number, video: string, over: Linha = {}): Linha => ({
  id, site_id: S, competitor_channel_id: CANAL, video_id: video, parent_id: null, is_creator: false, creator_replied: null,
  body: 'texto ' + SENT + id, body_truncated: false, published_at: iso(AGORA - 5 * H), ...over,
})
const marca = (c: number, mark: number, likes: number, over: Linha = {}): Linha => ({ comment_id: c, site_id: S, mark, likes, ...over })
const execucao = (over: Linha = {}): Linha => ({ task: 'retratos_comentarios', status: 'ok', started_at: iso(AGORA - 2 * H), finished_at: iso(AGORA - H), ...over })

function base(): Record<string, Linha[]> {
  return {
    competitor_video_comment_snaps: [snap('v1', 30), snap('v1', 1), snap('v2', 7), snap('v9', 30, { competitor_channel_id: OUTRO_CANAL, taken_at: iso(AGORA - 900 * H) })],
    competitor_video_comments: [
      coment(1, 'v1', { creator_replied: true, body: '@ana adorei' }),
      coment(2, 'v1', { parent_id: 1, is_creator: true, body: 'valeu @ana' }),
      coment(3, 'v2', { creator_replied: false }),
      coment(4, 'v9', { creator_replied: true, competitor_channel_id: OUTRO_CANAL }),
    ],
    competitor_video_comment_marks: [marca(1, 1, 10), marca(1, 7, 25)],
    competitor_video_comment_authors: [{ comment_id: 1, site_id: S, display_name: 'nome', expires_at: iso(AGORA + H) }],
    competitor_agenda_runs: [execucao()],
  }
}
let provasTexto: ProvasDeQuemVe
let provasIdentidade: ProvasDeQuemVe
beforeAll(async () => {
  provasTexto = { leitura: await leituraDe(S), edicao: null }
  provasIdentidade = { leitura: await leituraDe(S), edicao: await edicaoDe(S) }
})

describe('lerContagemDeRespostas (E5a C1)', () => {
  it('por vídeo: o status do retrato de 30 dias e se algum comentário teve resposta do criador', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios(base()).client, { siteId: S, channelId: CANAL, videoIds: ['v1', 'v2', 'v3'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.porVideo.get('v1')).toEqual({ retrato30: 'ok', algumComRespostaDoCriador: true })
    expect(r.dados.porVideo.get('v2')).toEqual({ retrato30: null, algumComRespostaDoCriador: false })
    expect(r.dados.porVideo.get('v3')).toEqual({ retrato30: null, algumComRespostaDoCriador: false })
  })
  it('as datas: a coleta do site, a coleta do canal e a agenda', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios(base()).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.coletaDoSiteDesdeMs).toBe(AGORA - 900 * H)
    expect(r.dados.coletaDoCanalDesdeMs).toBe(AGORA - 39 * H)
    expect(r.dados.ultimoOkDaTarefaMs).toBe(AGORA - H)
    expect(r.dados.primeiraExecucaoDaTarefaMs).toBe(AGORA - 2 * H)
  })
  it('nada nas tabelas: lido, vazio e datas nulas (dado ausente não é zero nem erro)', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios({}).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    expect(r).toMatchObject({ lido: true, dados: { coletaDoSiteDesdeMs: null, coletaDoCanalDesdeMs: null, ultimoOkDaTarefaMs: null, primeiraExecucaoDaTarefaMs: null } })
  })
  it('sem o cruzamento do vídeo com os do canal, contaria vídeo de outro canal: v9 é do outro canal e não conta', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios(base()).client, { siteId: S, channelId: CANAL, videoIds: ['v9'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.porVideo.get('v9')).toEqual({ retrato30: null, algumComRespostaDoCriador: false })
  })
  it('lê só id e video_id dos topos com resposta do criador (filtrados no banco); filtra por site e canal em toda consulta de dado', async () => {
    const db = falsoComentarios(base())
    await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    const c = db.pedidos.find((p) => p.table === 'competitor_video_comments')
    expect(c?.cols).toBe('id, video_id')
    expect(c?.cols).not.toMatch(/body|published_at|youtube_comment_id/)
    expect(c?.eqs).toMatchObject({ creator_replied: true, 'parent_id:is': null })
    for (const p of db.pedidos.filter((x) => x.table !== 'competitor_agenda_runs')) expect(p.eqs.site_id, p.table).toBe(S)
    expect(c?.eqs.competitor_channel_id).toBe(CANAL)
  })
  it('mais de 150 vídeos: o in() é partido em blocos de 150', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => 'x' + i)
    const db = falsoComentarios(base())
    await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ids })
    const blocos = db.pedidos.filter((p) => p.table === 'competitor_video_comments').map((p) => p.ins.video_id?.length)
    expect(blocos).toEqual([150, 150, 20])
  })
  it('150 vídeos x 30 linhas no mesmo canal (4.500): lido, e o último vídeo aparece (paginado por id)', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => 'p' + i)
    const t = base()
    const linhas: Linha[] = []
    let n = 1000
    for (const v of ids) for (let k = 0; k < 30; k++) linhas.push(coment(n++, v, { creator_replied: v === 'p149' && k === 29 }))
    t.competitor_video_comments = linhas
    const db = falsoComentarios(t)
    const r = await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ids })
    if (!r.lido) throw new Error('esperava lido, veio ' + r.codigo)
    expect(r.dados.porVideo.get('p149')?.algumComRespostaDoCriador).toBe(true)
    expect(r.dados.porVideo.get('p0')?.algumComRespostaDoCriador).toBe(false)
  })
  it('página com exatamente 1.000 linhas: pede a seguinte e conta tudo; mais de 1.000 voltas-teto: não lida', async () => {
    const t = base()
    t.competitor_video_comments = Array.from({ length: 1000 }, (_, i) => coment(2000 + i, 'w' + (i % 2), { creator_replied: true }))
    const db = falsoComentarios(t)
    const r = await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ['w0', 'w1'] })
    expect(r.lido).toBe(true)
    expect(db.pedidos.filter((p) => p.table === 'competitor_video_comments').length).toBe(2)
    const grande = base()
    grande.competitor_video_comments = Array.from({ length: 21_000 }, (_, i) => coment(5000 + i, 'g', { creator_replied: true }))
    expect(await lerContagemDeRespostas(falsoComentarios(grande).client, { siteId: S, channelId: CANAL, videoIds: ['g'] }))
      .toEqual({ lido: false, causa: 'erro_do_banco', codigo: 'forma_inesperada' })
  })
  it('erro do banco e tabela ausente: não lida, com o código e sem texto', async () => {
    expect(await lerContagemDeRespostas(falsoComentarios(base(), { erroEm: { competitor_video_comments: { code: '42P01', message: SENT } } }).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] }))
      .toEqual({ lido: false, causa: 'schema_ausente', codigo: 'banco:42p01' })
    const r = await lerContagemDeRespostas(falsoComentarios(base(), { erroEm: { competitor_agenda_runs: { code: 'XX000', message: SENT } } }).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    expect(r.lido).toBe(false)
    expect(JSON.stringify(r)).not.toContain(SENT)
  })
})

describe('lerRespostasDoCriador (E5a C1)', () => {
  const pedir = (provas: ProvasDeQuemVe | null, over: { videoIds?: string[]; channelId?: string } = {}, tabelas = base()) => {
    const db = falsoComentarios(tabelas)
    return lerRespostasDoCriador(db.client, { siteDaGuarda: S, provas, channelId: over.channelId ?? CANAL, videoIds: over.videoIds ?? ['v1', 'v2'] }).then((r) => ({ r, db }))
  }
  it('nível contagem: lista vazia e o número de itens, sem texto, e a tabela de leituras não é tocada', async () => {
    const { r, db } = await pedir(null)
    expect(r).toEqual({ lido: true, dados: { nivel: 'contagem', total: 1, itens: [] } })
    expect(JSON.stringify(r)).not.toContain(SENT)
    expect(db.pedidos.map((p) => p.table)).toEqual(['competitor_video_comments'])
    expect(db.pedidos[0]?.cols).not.toMatch(/body|published_at/)
  })
  it('nível texto: o comentário, a resposta presa, as curtidas do marco mais recente e o vídeo; menções trocadas', async () => {
    const { r } = await pedir(provasTexto)
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.itens).toEqual([{
      videoId: 'v1', texto: '@… adorei', cortado: false, publicadoEm: iso(AGORA - 5 * H),
      respostas: [{ texto: 'valeu @…', cortado: false, publicadoEm: iso(AGORA - 5 * H) }], respostasDoCriadorGuardadas: 1, curtidas: 25, marco: 7, mencoesTrocadas: 2,
    }])
  })
  it('T1: a consulta das respostas leva is(missing_since, null)', async () => {
    const { db } = await pedir(provasTexto)
    const dasRespostas = db.pedidos.filter((p) => p.ins.parent_id !== undefined)
    expect(dasRespostas.length).toBeGreaterThan(0)
    for (const p of dasRespostas) expect(p.eqs['missing_since:is']).toBeNull()
    expect(db.pedidos.some((p) => p.cols.includes('published_at') && p.ins.parent_id === undefined)).toBe(true)
  })
  it('T1: até 3 respostas por fio, da mais antiga à mais nova, empate por BigInt(id) (9 antes de 10); com 4, corta em 3', async () => {
    const t = base()
    const mesma = iso(AGORA - 3 * H)
    t.competitor_video_comments = [
      ...(t.competitor_video_comments ?? []),
      coment(10, 'v1', { parent_id: 1, is_creator: true, body: 'dez', published_at: mesma }),
      coment(9, 'v1', { parent_id: 1, is_creator: true, body: 'nove', published_at: mesma }),
      coment(11, 'v1', { parent_id: 1, is_creator: true, body: 'onze @bia', published_at: iso(AGORA - 2 * H) }),
    ]
    const { r } = await pedir(provasTexto, {}, t)
    if (!r.lido) throw new Error('esperava lido')
    const it0 = r.dados.itens[0]
    expect(it0?.respostas.map((x) => x.texto)).toEqual(['valeu @…', 'nove', 'dez'])
    expect(it0?.respostas).toHaveLength(3)
    expect(it0?.publicadoEm).toBe(iso(AGORA - 5 * H))
    expect(it0?.mencoesTrocadas).toBe(2)
  })
  it('F2-T1: a consulta das respostas leva eq(is_creator, true) e linha filha de terceiro nunca entra', async () => {
    const t = base()
    t.competitor_video_comments = [
      ...(t.competitor_video_comments ?? []),
      coment(40, 'v1', { parent_id: 1, is_creator: false, body: 'TERCEIRO-' + SENT, published_at: iso(AGORA - 4 * H) }),
    ]
    const { r, db } = await pedir(provasTexto, {}, t)
    for (const p of db.pedidos.filter((x) => x.ins.parent_id !== undefined)) expect(p.eqs.is_creator).toBe(true)
    if (!r.lido) throw new Error('esperava lido')
    expect(JSON.stringify(r)).not.toContain('TERCEIRO-')
    expect(r.dados.itens[0]?.respostas).toHaveLength(1)
    expect(r.dados.itens[0]?.respostasDoCriadorGuardadas).toBe(1)
  })
  it('F2-T1: com 5 respostas do criador mostra 3 e informa 5 guardadas', async () => {
    const t = base()
    t.competitor_video_comments = [
      ...(t.competitor_video_comments ?? []),
      ...[41, 42, 43, 44].map((id) => coment(id, 'v1', { parent_id: 1, is_creator: true, body: 'r' + id, published_at: iso(AGORA - (id - 30) * 60_000) })),
    ]
    const { r } = await pedir(provasTexto, {}, t)
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.itens[0]?.respostas).toHaveLength(3)
    expect(r.dados.itens[0]?.respostasDoCriadorGuardadas).toBe(5)
  })
  it('T1: as menções de todas as respostas somam em mencoesTrocadas', async () => {
    const t = base()
    t.competitor_video_comments = [
      ...(t.competitor_video_comments ?? []),
      coment(12, 'v1', { parent_id: 1, is_creator: true, body: 'oi @bia', published_at: iso(AGORA - 2 * H) }),
    ]
    const { r } = await pedir(provasTexto, {}, t)
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.itens[0]?.mencoesTrocadas).toBe(3)
  })
  it('não consulta a tabela de identidade em nível nenhum (e a menção é trocada também no nível identidade)', async () => {
    for (const provas of [null, provasTexto, provasIdentidade]) {
      const { r, db } = await pedir(provas)
      expect(db.pedidos.map((p) => p.table), String(provas?.edicao)).not.toContain('competitor_video_comment_authors')
      if (r.lido && r.dados.itens.length) expect(r.dados.itens[0]?.texto).toBe('@… adorei')
    }
  })
  it('vídeo de outro canal não entra, mesmo na lista de ids (cruzamento)', async () => {
    const { r } = await pedir(provasTexto, { videoIds: ['v9'] })
    expect(r).toMatchObject({ lido: true, dados: { total: 0, itens: [] } })
  })
  it('sem o filtro de site, o comentário de outro site apareceria: nunca aparece', async () => {
    const t = base()
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), coment(70, 'v1', { site_id: OUTRO_SITE, creator_replied: true })]
    const { r } = await pedir(null, {}, t)
    expect(r).toMatchObject({ lido: true, dados: { total: 1 } })
  })
  it('muitos vídeos e muitas linhas (4.500): lido, com a contagem certa nos três níveis', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => 'p' + i)
    const t = base()
    const linhas: Linha[] = []
    let n = 1000
    for (const v of ids) for (let k = 0; k < 30; k++) linhas.push(coment(n++, v, { creator_replied: k === 0 }))
    for (let k = 0; k < 150; k++) linhas.push(coment(9000 + k, 'p' + k, { parent_id: 1000 + k * 30, is_creator: true, body: 'resp' }))
    t.competitor_video_comments = linhas
    for (const provas of [null, provasTexto]) {
      const { r } = await pedir(provas, { videoIds: ids }, t)
      if (!r.lido) throw new Error('esperava lido, veio ' + r.codigo)
      expect(r.dados.total, String(provas)).toBe(150)
      if (provas) expect(r.dados.itens.length).toBe(150)
    }
  })
  it('nível texto: total é o número de itens listados (topo sem a resposta presa não conta)', async () => {
    const t = base()
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), coment(60, 'v1', { creator_replied: true })]
    const { r: texto } = await pedir(provasTexto, {}, t)
    expect(texto).toMatchObject({ lido: true, dados: { total: 1 } })
    const { r: cont } = await pedir(null, {}, t)
    expect(cont).toMatchObject({ lido: true, dados: { total: 2 } })
  })
  it('I-1 (trem 6): comentário de topo que saiu do YouTube e resposta do criador que saiu nunca entram, em nenhum nível', async () => {
    const t = base()
    t.competitor_video_comments = [
      ...(t.competitor_video_comments ?? []),
      coment(80, 'v1', { creator_replied: true, body: 'topo-saiu-' + SENT, missing_since: '2026-10-12' }),
      coment(81, 'v1', { parent_id: 80, is_creator: true, body: 'resp-do-topo-que-saiu' }),
      coment(82, 'v2', { creator_replied: true, body: 'topo-no-ar' }),
      coment(83, 'v2', { parent_id: 82, is_creator: true, body: 'resp-saiu-' + SENT, missing_since: '2026-10-12' }),
    ]
    const { r: texto } = await pedir(provasTexto, {}, t)
    if (!texto.lido) throw new Error('esperava lido')
    const json = JSON.stringify(texto)
    for (const proibido of ['topo-saiu-', 'resp-do-topo-que-saiu', 'resp-saiu-']) expect(json).not.toContain(proibido)
    expect(texto.dados.itens.map((i) => i.videoId)).toEqual(['v1'])
    expect(texto.dados.total).toBe(1)
    const { r: cont } = await pedir(null, {}, t)
    // no nível contagem o topo que saiu não conta; o topo no ar sem resposta presa conta (sem texto, não dá para saber)
    expect(cont).toMatchObject({ lido: true, dados: { nivel: 'contagem', total: 2, itens: [] } })
  })
  it('erro do banco: não lida', async () => {
    const db = falsoComentarios(base(), { erroEm: { competitor_video_comments: { code: 'XX000' } } })
    const r = await lerRespostasDoCriador(db.client, { siteDaGuarda: S, provas: null, channelId: CANAL, videoIds: ['v1'] })
    expect(r.lido).toBe(false)
  })
})

describe('FU-CANAL-CRIADOR: o fio cuja raiz é do criador não conta nem lista', () => {
  // v1: espectador respondido (id 1) + raiz do criador com auto-resposta (id 5, 6); v2: só espectador sem resposta (id 3); v3: só o fio do criador
  const fixture = (): Record<string, Linha[]> => {
    const t = base()
    t.competitor_video_comment_snaps = [...(t.competitor_video_comment_snaps ?? []), snap('v3', 30)]
    t.competitor_video_comments = [
      ...(t.competitor_video_comments ?? []),
      coment(5, 'v1', { is_creator: true, creator_replied: true, body: 'FIXADO-' + SENT }),
      coment(6, 'v1', { parent_id: 5, is_creator: true, body: 'auto-resposta' }),
      coment(7, 'v3', { is_creator: true, creator_replied: true, body: 'FIXADO3-' + SENT }),
      coment(8, 'v3', { parent_id: 7, is_creator: true, body: 'auto-resposta 3' }),
    ]
    return t
  }
  it('lista: sai o fio do criador; total = itens; a consulta do passo 1 leva is_creator=false', async () => {
    const db = falsoComentarios(fixture())
    const r = await lerRespostasDoCriador(db.client, { siteDaGuarda: S, provas: provasTexto, channelId: CANAL, videoIds: ['v1', 'v2', 'v3'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.itens).toHaveLength(1)
    expect(r.dados.total).toBe(r.dados.itens.length)
    expect(JSON.stringify(r)).not.toContain('FIXADO')
    const topo = db.pedidos.filter((x) => x.table === 'competitor_video_comments' && x.eqs['parent_id:is'] === null)
    expect(topo.length).toBeGreaterThan(0)
    for (const p of topo) expect(p.eqs.is_creator).toBe(false)
  })
  it('contagem: mesmo número, sem texto', async () => {
    const db = falsoComentarios(fixture())
    const r = await lerRespostasDoCriador(db.client, { siteDaGuarda: S, provas: null, channelId: CANAL, videoIds: ['v1', 'v2', 'v3'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.nivel).toBe('contagem')
    expect(r.dados.total).toBe(1)
    for (const p of db.pedidos.filter((x) => x.table === 'competitor_video_comments')) expect(p.eqs.is_creator).toBe(false)
  })
  it('M11: vídeo só com o fio do criador = sem; vídeo com espectador respondido = com', async () => {
    const db = falsoComentarios(fixture())
    const r = await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ['v1', 'v2', 'v3'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.porVideo.get('v1')?.algumComRespostaDoCriador).toBe(true)
    expect(r.dados.porVideo.get('v2')?.algumComRespostaDoCriador).toBe(false)
    expect(r.dados.porVideo.get('v3')?.algumComRespostaDoCriador).toBe(false)
    expect(db.pedidos.find((p) => p.table === 'competitor_video_comments')?.eqs.is_creator).toBe(false)
  })
})
