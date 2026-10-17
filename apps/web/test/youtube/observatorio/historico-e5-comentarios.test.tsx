// @vitest-environment node
// A5 · E5a, Tarefa C3 (mockup 20): a seção "Comentários de destaque" na página do vídeo de concorrente.
// Server components async: chamados como função (`await ComentariosDeDestaque(props)`), com o leitor falso. A página é afirmada na árvore de `await Page(props)`.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Suspense, isValidElement, type ReactElement, type ReactNode } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canalWorld } from './canal-fixture'

const mocks = vi.hoisted(() => ({
  carregar: vi.fn(),
  servico: vi.fn(() => ({ from: vi.fn() })),
  montarVideo: vi.fn(),
  acesso: vi.fn(),
  leitor: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
import * as Sentry from '@sentry/nextjs'
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: mocks.servico }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-canal', () => ({ carregarMedidasDoCanalInteiro: mocks.carregar }))
vi.mock('@/lib/youtube/observatorio/comentarios/leitor', () => ({ lerComentariosDeDestaque: mocks.leitor }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({ acessoPrivado: mocks.acesso }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/montar', () => ({ montarVideo: mocks.montarVideo, assistidoDoVideo: vi.fn(), origemDoVideo: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/own-menu', () => ({ ownMenuOf: () => [] }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-leitura', () => ({ leituraSemConsulta: () => null, lerLeituraDoVideo: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn(), cancelForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ pinVideo: vi.fn(), unpinVideo: vi.fn(), syncCompetitorNow: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/contexto-ia-actions', () => ({ gerarPacoteIa: vi.fn() }))

import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { BlocosDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/blocos-do-video'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ComentariosDeDestaque, FAIXA_PERMISSAO_NAO_CONFERIDA, lerSecaoDeComentarios, type ProvasResolvidas } from '@/app/cms/(authed)/youtube/competitors/_historico/comentarios-de-destaque'
import { EstadoDoPainel } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/estados'
import { SecaoDeComentarios } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/secao'
import { FRASES } from '@/app/cms/(authed)/youtube/competitors/_chrome/comentarios/frases'
import HistoricoPage from '@/app/cms/(authed)/youtube/competitors/video/[id]/page'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { IObservatorioDeMedidas } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import type { ProvasDeQuemVe, ComentariosContagem } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'

const COMP = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const { obs, ds } = canalWorld()
const FULL = 'matt-opus55'
const video = obs.videos.find((v) => v.id === FULL)!
const view = buildHistoricoView(obs, FULL, {})
const AGORA = ds.now
const naoLida = { lido: false as const, causa: 'erro_do_banco' as const }
const canal = (): CanalInteiro => ({
  medidas: { porFormato: {}, m3a: {}, m8: {}, porVideo: new Map(), falhas: [] } as unknown as CanalInteiro['medidas'],
  videos: { lido: true, dados: [] }, retratos: { lido: true, dados: [] }, marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } },
  serie: naoLida, mudancas: naoLida, horas: naoLida, falhas: [], esgotou: [],
})
type El = ReactElement<Record<string, unknown>>
const blocos = async (extra: Record<string, unknown>) => (await BlocosDoVideo({
  obterSb: () => ({}) as SupabaseClient, siteId: 's1', obs: obs as unknown as IObservatorioDeMedidas, agoraMs: AGORA, view, video, linkSaiu: null, ...extra,
})) as El
const filhos = (n: ReactNode): ReactNode[] => (isValidElement(n) ? (([] as ReactNode[]).concat((n.props as { children?: ReactNode }).children ?? [])) : [])
function achar(n: ReactNode, pred: (e: ReactElement<Record<string, unknown>>) => boolean): El | null {
  if (Array.isArray(n)) { for (const f of n) { const r = achar(f, pred); if (r) return r } return null }
  if (!isValidElement(n)) return null
  const e = n as El
  if (pred(e)) return e
  return achar((e.props as { children?: ReactNode }).children, pred)
}
const contagem: ComentariosContagem = {
  nivel: 'contagem', comentarios: [],
  marcos: { 1: { estado: 'desligados' }, 7: { estado: 'desligados' }, 30: { estado: 'desligados' } } as unknown as ComentariosContagem['marcos'],
}
const pr = (provas: ProvasDeQuemVe | null, permissaoFalhou = false): Promise<ProvasResolvidas> => Promise.resolve({ provas, permissaoFalhou })
const props = (extra: Record<string, unknown> = {}) => ({
  sb: {} as SupabaseClient, siteId: 's1', provas: pr(null), videoId: FULL, agoraMs: AGORA, canaisDoSite: new Map([[video.ch, { nome: 'Matt' }]]),
  video: { t0Ms: video.pub, descobertoEmMs: null, canalId: video.ch }, criador: { nome: 'Matt', avatar: null, ini: 'M', color: '#336699' }, ...extra,
})
const paginaCom = (v: typeof view) => {
  mocks.montarVideo.mockResolvedValue({ tipo: 'concorrente', pagina: { obs, meuCanalLembrado: null, siteId: 's1', now: AGORA }, view: v })
  return HistoricoPage({ params: Promise.resolve({ id: v.video?.id ?? 'x' }), searchParams: Promise.resolve({}) })
}

beforeEach(() => {
  vi.mocked(Sentry.captureMessage).mockClear()
  vi.mocked(Sentry.captureException).mockClear()
  for (const m of Object.values(mocks)) m.mockReset()
  mocks.servico.mockImplementation(() => ({ from: vi.fn() }))
  mocks.carregar.mockResolvedValue(canal())
})

describe('a seção, depois do último bloco do Histórico', () => {
  it('vai por último, num Suspense próprio (não atrasa os blocos de cima), com as provas por prop de servidor', async () => {
    const provas = pr({ leitura: null, edicao: null })
    const el = await blocos({ provas })
    const f = filhos(el.props.depoisDoGrafico)
    const ultimo = f[f.length - 1] as El
    expect(ultimo.type).toBe(Suspense)
    const secao = (ultimo.props as { children: El }).children
    expect(secao.type).toBe(ComentariosDeDestaque)
    expect(secao.props.provas).toBe(provas)
    expect(f.indexOf(ultimo)).toBeGreaterThan(0)
  })

  it('a foto do canal (h.chan.avatar), o nome, a inicial e a cor chegam ao fio como `criador`', async () => {
    const el = await blocos({ provas: pr(null) })
    const secao = achar(el.props.depoisDoGrafico as ReactNode, (e) => e.type === ComentariosDeDestaque)!
    const h = view.header!.chan
    expect(secao.props.criador).toEqual({ nome: h.name, avatar: h.avatar, ini: h.ini, color: h.color })
  })

  it('a foto do canal chega ao img da resposta do criador', async () => {
    const c = { nivel: 'texto' as const, marcos: { 1: { estado: 'fecha_em', fechaEmMs: AGORA }, 7: { estado: 'ok', resumo: { tomadoEmMs: AGORA, idadeHoras: 168, amostra: 5, amostraCompleta: true, totalDoDia: 5, escolhidos: 1, autoresConsultados: 1, autoresSemTamanho: 0 } }, 30: { estado: 'fecha_em', fechaEmMs: AGORA } },
      comentarios: [{ ordem: 1, motivo: 'curtidos', curtidas: { 1: 'ainda_nao', 7: 3, 30: 'ainda_nao' }, respostas: 1, criador: 'respondeu', criadorNome: 'Matt', posicao: { 1: null, 7: null, 30: null }, doCriador: false, entrouNoMarco: 7, nosMarcos: [7], saiuDoYouTubeDesde: null, faixas: { tamanho: null, razao: null }, texto: 'oi', cortado: false, publicadoEm: '2026-10-07T12:00:00.000Z', respostasDoCriador: [{ texto: 'valeu', cortado: false, publicadoEm: '2026-10-08T12:00:00.000Z' }], autor: { tipo: 'espectador' }, mencoesTrocadas: 0 }] }
    mocks.leitor.mockResolvedValue({ lido: true, dados: c })
    const criador = { nome: 'Matt', avatar: 'https://yt3.ggpht.com/matt=s88', ini: 'M', color: '#336699' }
    const el = (await ComentariosDeDestaque(props({ criador }))) as El
    const html = renderToStaticMarkup(el as ReactElement)
    expect(html).toMatch(/class="cf-av cri[^"]*"[^>]*>\s*<img[^>]*src="https:\/\/yt3\.ggpht\.com\/matt=s88"/)
  })

  it('N1: lerSecaoDeComentarios continua aceitando { canalNome } sem `criador` (o pacote da IA não muda)', async () => {
    mocks.leitor.mockResolvedValue({ lido: true, dados: contagem })
    const { criador: _c, ...semCriador } = props()
    const r = await lerSecaoDeComentarios({ ...semCriador, canalNome: 'Matt' })
    expect(r.ok).toBe(true)
  })

  it('estreia: o marco de comentário conta do início real (live_actual_start_at), não de published_at (portão Phil I4)', async () => {
    const inicio = video.pub + 4 * 864e5
    const lido = { id: FULL, videoId: video.ytId, publishedAt: new Date(video.pub).toISOString(), liveActualStartAt: new Date(inicio).toISOString(), liveBroadcastContent: 'none', wasLive: true, isShort: false, durationSeconds: null, viewCount: 1, likeCount: null, commentCount: null, likesHidden: null, commentsDisabled: null, viewsHidden: null, discoveredAt: new Date(inicio).toISOString(), missingSince: null, seriesTier: 'diaria' as const, lastCheckedAt: null }
    mocks.carregar.mockResolvedValue({ ...canal(), videos: { lido: true, dados: [lido] } })
    const el = await blocos({ provas: pr(null) })
    const secao = achar(el.props.depoisDoGrafico as ReactNode, (e) => e.type === ComentariosDeDestaque)!
    expect((secao.props.video as { t0Ms: number }).t0Ms).toBe(inicio)
  })

  it('sem o pedido da página (provas ausente) a seção não existe; com provas nulas ela existe no nível contagem', async () => {
    const sem = await blocos({})
    expect(achar(sem.props.depoisDoGrafico as ReactNode, (e) => e.type === ComentariosDeDestaque)).toBeNull()
    const com = await blocos({ provas: pr(null) })
    expect(achar(com.props.depoisDoGrafico as ReactNode, (e) => e.type === ComentariosDeDestaque)).not.toBeNull()
  })

  it('os tokens não aparecem nas props da tela (cliente): nem na reserva, nem no conteúdo; só o elemento de servidor os carrega', async () => {
    const token = { sentinela: 'TOKEN-QUE-NAO-PODE-SAIR' } as unknown as ProvasDeQuemVe['leitura']
    const provas = pr({ leitura: token, edicao: null })
    const el = await blocos({ provas })
    const { antesDoGrafico: _a, depoisDoGrafico: _d, ...resto } = el.props
    expect(el.type).toBe(HistoricoScreen)
    expect(JSON.stringify(resto, (_k, v) => (typeof v === 'function' ? undefined : v))).not.toContain('TOKEN-QUE-NAO-PODE-SAIR')
    expect('provas' in el.props).toBe(false)
    const arvore = await paginaCom(view)
    const reserva = (achar(arvore, (e) => e.type === Suspense)!.props as { fallback: El }).fallback
    expect('provas' in reserva.props).toBe(false)
  })
})

describe('a seção, estados', () => {
  it('a leitura falhou: "Não deu para abrir os comentários agora." e "Tentar de novo", sem a frase do desvio 18', async () => {
    mocks.leitor.mockResolvedValue({ lido: false, causa: 'erro_do_banco', codigo: 'x' })
    const el = (await ComentariosDeDestaque(props())) as El
    const painel = achar(el, (e) => e.type === EstadoDoPainel)!
    const v = painel.props.v as { titulo: string; tentar: boolean }
    expect(v.titulo).toBe(FRASES.erroDeLeitura)
    expect(v.tentar).toBe(true)
    expect(JSON.stringify(el.props)).not.toContain('Nada foi apagado')
  })

  it('o leitor que lança vira a mesma faixa de erro, nunca uma exceção, e vai ao Sentry', async () => {
    mocks.leitor.mockRejectedValue(new Error('x'))
    const el = (await ComentariosDeDestaque(props())) as El
    expect(achar(el, (e) => e.type === EstadoDoPainel)).not.toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect((vi.mocked(Sentry.captureException).mock.calls[0]![1] as { tags: Record<string, string> }).tags).toMatchObject({ component: 'observatorio', step: 'comentarios-destaque' })
  })

  it('leitura não lida: um aviso ao Sentry com causa e código, sem id de vídeo nem texto (portão Yannis I-5)', async () => {
    mocks.leitor.mockResolvedValue({ lido: false, causa: 'erro_do_banco', codigo: '57014' })
    await ComentariosDeDestaque(props())
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [msg, ctx] = vi.mocked(Sentry.captureMessage).mock.calls[0]! as [string, { level: string; tags: Record<string, string>; extra: Record<string, string> }]
    expect(msg).toContain('comentários de destaque')
    expect(ctx.tags).toMatchObject({ step: 'comentarios-destaque' })
    expect(ctx.extra).toEqual({ causa: 'erro_do_banco', codigo: '57014' })
    expect(JSON.stringify(ctx)).not.toContain(FULL)
  })

  it('leitura lida: nada vai ao Sentry', async () => {
    mocks.leitor.mockResolvedValue({ lido: true, dados: contagem })
    await ComentariosDeDestaque(props())
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('o leitor decide o nível: a seção chama o leitor com as provas, o site da guarda e o vídeo, e não passa nível nenhum', async () => {
    mocks.leitor.mockResolvedValue({ lido: true, dados: contagem })
    const provas: ProvasDeQuemVe = { leitura: null, edicao: null }
    await ComentariosDeDestaque(props({ provas: pr(provas) }))
    const [, pedido] = mocks.leitor.mock.calls[0]!
    expect(pedido).toMatchObject({ siteDaGuarda: 's1', provas, videoId: FULL })
    expect('nivel' in pedido).toBe(false)
  })

  it('permissão não conferida: nível contagem com a faixa de permissão, nunca texto', async () => {
    mocks.leitor.mockResolvedValue({ lido: true, dados: contagem })
    const el = (await ComentariosDeDestaque(props({ provas: pr(null, true) }))) as El
    expect(el.type).toBe(SecaoDeComentarios)
    expect((el.props.v as { faixa: string }).faixa).toBe(FAIXA_PERMISSAO_NAO_CONFERIDA)
    expect(mocks.leitor.mock.calls[0]![1].provas).toBeNull()
  })
})

describe('a página: acesso e provas', () => {
  it('acessoPrivado que lança: provas nulas (contagem) e a faixa de permissão, nunca texto', async () => {
    mocks.acesso.mockRejectedValue(new Error('guarda fora do ar'))
    const arvore = await paginaCom(view)
    const filho = (achar(arvore, (e) => e.type === Suspense)!.props as { children: El }).children
    expect(filho.type).toBe(BlocosDoVideo)
    // provas nulas: o leitor decide contagem; a faixa de permissão vem junto
    expect(await (filho.props.provas as Promise<ProvasResolvidas>)).toEqual({ provas: null, permissaoFalhou: true })
  })

  it('acesso sem o campo edicao: no máximo texto (edicao nula, mesmo com edita verdadeiro)', async () => {
    const leitura = { forjado: true }
    mocks.acesso.mockResolvedValue({ leitura, edita: true, negativa: null })
    const arvore = await paginaCom(view)
    const filho = (achar(arvore, (e) => e.type === Suspense)!.props as { children: El }).children
    expect(await (filho.props.provas as Promise<ProvasResolvidas>)).toEqual({ provas: { leitura, edicao: null }, permissaoFalhou: false })
  })

  it('a página devolve a árvore sem esperar acessoPrivado (a prova lenta não segura o cabeçalho; a seção espera dentro do Suspense dela)', async () => {
    mocks.acesso.mockReturnValue(new Promise(() => { /* nunca resolve */ }))
    const arvore = await paginaCom(view)
    const filho = (achar(arvore, (e) => e.type === Suspense)!.props as { children: El }).children
    expect(filho.type).toBe(BlocosDoVideo)
    expect(filho.props.provas).toBeInstanceOf(Promise)
  })

  it('vídeo de outro site na URL: nenhuma consulta de comentário, nenhum acesso privado e nenhum cliente de serviço', async () => {
    const naoAchou = buildHistoricoView(obs, 'id-que-nao-existe-neste-site', {})
    expect(naoAchou.notFound).not.toBeNull()
    const arvore = await paginaCom(naoAchou)
    expect(achar(arvore, (e) => e.type === Suspense)).toBeNull()
    expect(mocks.leitor).not.toHaveBeenCalled()
    expect(mocks.acesso).not.toHaveBeenCalled()
    expect(mocks.servico).not.toHaveBeenCalled()
  })

  it('nenhuma página chama provarEdicao nem nivelDeQuemVe, e a seção só existe no ramo do concorrente', () => {
    const fonte = fs.readFileSync(path.join(COMP, 'video/[id]/page.tsx'), 'utf8')
    expect(fonte).not.toMatch(/provarEdicao\s*\(/)
    expect(fonte).not.toContain('nivelDeQuemVe')
    const proprio = fonte.slice(fonte.indexOf("m.tipo === 'proprio'"), fonte.indexOf('const { view } = m'))
    expect(proprio).not.toMatch(/provas|ComentariosDeDestaque|acessoPrivado/)
  })

  it('HistoricoView não tem campo de comentário (a seção é dado do componente de servidor)', () => {
    const fonte = fs.readFileSync(path.join(COMP, '_historico/view-model.ts'), 'utf8')
    const ini = fonte.indexOf('export interface HistoricoView')
    const bloco = fonte.slice(ini, fonte.indexOf('\n}\n', ini))
    expect(bloco).not.toMatch(/coment|SecaoView|provas/i)
  })
})
