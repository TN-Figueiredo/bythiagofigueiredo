// @vitest-environment node
// A5 · E5a · Tarefa C5 (Gio): o que SAI do servidor. Sentinelas de texto e de nome não podem estar no HTML nem na carga serializada
// dos níveis que não os veem; o Cowork e os montadores não leem a tabela de comentários; a lista de leitores é fechada; a M11 recebe a
// coleta do CANAL (não a do site).
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { isValidElement, cloneElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { falsoComentarios, type Linha } from './comentarios-e5-fake'
import { edicaoDe } from './edicao-teste'
import { leituraDe } from './leitura-teste'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { ContagemDeRespostas, ParteLida } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams('') }))
const espiao = vi.hoisted(() => ({ chamadas: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/youtube/observatorio/medidas/comentarios', async (original) => {
  const m = await original<typeof import('@/lib/youtube/observatorio/medidas/comentarios')>()
  return { ...m, criadorResponde: (...a: Parameters<typeof m.criadorResponde>) => { espiao.chamadas.push(a[1] as unknown as Record<string, unknown>); return m.criadorResponde(...a) } }
})

import { ComentariosDeDestaque } from '@/app/cms/(authed)/youtube/competitors/_historico/comentarios-de-destaque'
import { criadorDoCanal, type EntradaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-model'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'

const S = 'site-1', V = 'video-1', CANAL = 'canal-1'
const H = 3_600_000
const AGORA = Date.UTC(2026, 9, 15, 12)
const iso = (ms: number): string => new Date(ms).toISOString()
const T0 = AGORA - 192 * H
const SENT_TEXTO = 'zzsentc5texto', SENT_NOME = 'zzsentc5nome', SENT_YT = 'zzsentc5ytid'

const comentario = (id: number, over: Linha = {}): Linha => ({
  id, site_id: S, video_id: V, competitor_channel_id: CANAL, youtube_comment_id: SENT_YT + id, parent_id: null, is_creator: false, creator_replied: null,
  featured_reason: null, featured_size_band: null, featured_ratio_band: null, missing_since: null,
  body: SENT_TEXTO + id, body_truncated: false, published_at: iso(T0 + H), first_seen_at: iso(T0 + 2 * H), author_purged_at: null, ...over,
})
const marca = (c: number, slot: string): Linha => ({ comment_id: c, site_id: S, mark: 1, likes: 50 - c, reply_count: 1, slot, creator_replied: null })
const tabelas = (): Record<string, Linha[]> => ({
  competitor_video_comment_snaps: [{
    site_id: S, video_id: V, competitor_channel_id: CANAL, mark: 1, status: 'ok', error_reason: null, taken_at: iso(T0 + 27 * H), video_age_hours: 27,
    pool_size: 100, pool_complete: true, video_comment_count: 500, selected_count: 3, featured_lookup_n: 20, featured_unknown_n: 1,
  }],
  competitor_video_comments: [comentario(1, { is_creator: true }), comentario(2, { featured_reason: 'inscritos', featured_size_band: '1m_10m', featured_ratio_band: '10x_100x' }), comentario(3)],
  competitor_video_comment_marks: [marca(1, 'criador'), marca(2, 'destaque'), marca(3, 'curtidos')],
  competitor_video_comment_authors: [1, 2, 3].map((i) => ({ comment_id: i, site_id: S, display_name: SENT_NOME + i, channel_id: 'x' + i, avatar_url: 'https://foto/' + i, expires_at: iso(AGORA + 100 * H) })),
  competitor_agenda_runs: [{ task: 'retratos_comentarios', status: 'ok', started_at: iso(AGORA - 2 * H), finished_at: iso(AGORA - H) }],
})

let texto: ProvasDeQuemVe
let identidade: ProvasDeQuemVe
beforeAll(async () => {
  texto = { leitura: await leituraDe(S), edicao: null }
  identidade = { leitura: await leituraDe(S), edicao: await edicaoDe(S) }
})

type El = ReactElement<Record<string, unknown>>
/** O que o RSC levaria: a árvore devolvida, sem funções. */
const carga = (n: unknown): string => JSON.stringify(n, (_k, v) => (typeof v === 'function' ? undefined : v instanceof Map ? [...v] : v))
async function saida(provas: ProvasDeQuemVe | null): Promise<{ html: string; json: string }> {
  const db = falsoComentarios(tabelas())
  const el = await ComentariosDeDestaque({
    sb: db.client as SupabaseClient, siteId: S, provas: Promise.resolve({ provas, permissaoFalhou: false }), videoId: V, agoraMs: AGORA,
    canaisDoSite: new Map([[CANAL, { nome: 'Leo' }]]), video: { t0Ms: T0, descobertoEmMs: T0 + 2 * H, canalId: CANAL }, criador: { nome: 'Leo', avatar: null, ini: 'L', color: '#336699' },
  })
  return { html: renderToStaticMarkup(el as ReactNode as ReactElement), json: carga(el) }
}

describe('o que sai do servidor, por nível (sentinelas)', () => {
  it('contagem: nem texto, nem nome, nem id do YouTube, nem foto no HTML nem na carga', async () => {
    const { html, json } = await saida(null)
    for (const s of [SENT_TEXTO, SENT_NOME, SENT_YT, 'https://foto']) { expect(html, s).not.toContain(s); expect(json, s).not.toContain(s) }
  })
  it('texto: o texto aparece (controle positivo), o nome, o id do YouTube e a foto não', async () => {
    const { html, json } = await saida(texto)
    expect(html + json).toContain(SENT_TEXTO)
    for (const s of [SENT_NOME, SENT_YT, 'https://foto']) { expect(html, s).not.toContain(s); expect(json, s).not.toContain(s) }
  })
  it('identidade (controle do detector): o nome aparece quando o token de edição existe; o id do YouTube nunca', async () => {
    const { html, json } = await saida(identidade)
    expect(html + json).toContain(SENT_NOME)
    expect(html + json).not.toContain(SENT_YT)
  })
})

/** O que o RSC serializaria: expande os componentes de servidor e para nos de cliente (as props deles é que cruzam a fronteira). */
const CLIENTES = new Set(['Abas', 'ListaDoPainel', 'InfoDica'])
function expandir(n: ReactNode): ReactNode {
  if (Array.isArray(n)) return n.map(expandir)
  if (!isValidElement(n)) return n
  const e = n as El
  if (typeof e.type === 'function' && !CLIENTES.has((e.type as { name: string }).name)) return expandir((e.type as (p: unknown) => ReactNode)(e.props))
  const props: Record<string, unknown> = {}
  for (const k of ['children', 'cima']) if (k in e.props) props[k] = expandir(e.props[k] as ReactNode)
  return cloneElement(e, props)
}

describe('I3 (Yannis): o texto de terceiro cruza a fronteira servidor→cliente uma vez só', () => {
  it('cada sentinela de texto aparece exatamente 1 vez na carga do cliente, não 2', async () => {
    const db = falsoComentarios(tabelas())
    const el = await ComentariosDeDestaque({
      sb: db.client as SupabaseClient, siteId: S, provas: Promise.resolve({ provas: texto, permissaoFalhou: false }), videoId: V, agoraMs: AGORA,
      canaisDoSite: new Map([[CANAL, { nome: 'Leo' }]]), video: { t0Ms: T0, descobertoEmMs: T0 + 2 * H, canalId: CANAL }, criador: { nome: 'Leo', avatar: null, ini: 'L', color: '#336699' },
    })
    const cliente = carga(expandir(el as ReactNode))
    for (const i of [1, 2, 3]) {
      const ocs = cliente.split(SENT_TEXTO + i).length - 1
      expect(ocs, `comentário ${i}: uma ocorrência, não duas`).toBe(1)
    }
  })
})

// ───────────── varreduras estáticas, lista fechada ─────────────
const WEB = resolve(__dirname, '../../..')
const REPO = resolve(WEB, '../..')
function listar(dir: string): string[] {
  if (!existsSync(dir)) return []
  const r: string[] = []
  for (const n of readdirSync(dir).sort()) {
    if (['node_modules', '.next', 'dist'].includes(n)) continue
    const c = join(dir, n)
    if (statSync(c).isDirectory()) r.push(...listar(c))
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(n)) r.push(c)
  }
  return r
}
const rel = (f: string): string => relative(REPO, f)
const producao = (): string[] => [join(WEB, 'src'), join(REPO, 'apps/api/src'), ...(existsSync(join(REPO, 'packages')) ? readdirSync(join(REPO, 'packages')).map((p) => join(REPO, 'packages', p, 'src')) : [])].flatMap(listar)
const TABELAS = /(from\(\s*|['"`])competitor_video_comment(s|_authors|_marks|_snaps)['"`]/
const LEITORES = /comentarios\/leitor(-contagem|-nivel)?'/
const alvo = (re: RegExp) => (arqs: string[]): string[] => arqs.filter((f) => re.test(readFileSync(f, 'utf8'))).map(rel).sort()

const TABELAS_PERMITIDAS = [
  'apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts',
  // M3b: só a lista de tabelas por classe do arquivo mensal (exporta comentários ao NAS/B2, como o cli.ts)
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/contrato.ts',
  // M3b expurgo: nomes de tabela do filtro e do resumo (mapas de colunas), sem leitura de comentário
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts',
  'apps/web/src/lib/youtube/observatorio/arquivo/cli.ts',
  'apps/web/src/lib/youtube/observatorio/comentarios/gravar.ts',
  'apps/web/src/lib/youtube/observatorio/comentarios/identidade.ts',
  'apps/web/src/lib/youtube/observatorio/comentarios/leitor-contagem.ts',
  'apps/web/src/lib/youtube/observatorio/comentarios/leitor.ts',
  'apps/web/src/lib/youtube/observatorio/medidas/ler-comentarios.ts',
  'apps/web/src/lib/youtube/observatorio/saiu/ler-fila.ts',
  'apps/web/src/lib/youtube/observatorio/saiu/rotulos.ts',
  // M10a: listas de dados (nomes de tabela), sem leitura nem gravação
  'apps/web/src/lib/youtube/video-antigo/leitores-competitor-videos.ts',
  'apps/web/src/lib/youtube/video-antigo/tabelas-fora-da-classe.ts',
].sort()
const LEITORES_PERMITIDOS = [
  'apps/web/src/app/cms/(authed)/youtube/competitors/_canal/medidas/comentarios-do-canal.ts',
  'apps/web/src/app/cms/(authed)/youtube/competitors/_historico/comentarios-de-destaque.tsx',
].sort()

describe('lista fechada de quem toca os comentários', () => {
  it('varre algum arquivo (pasta que sumiu não vira verde)', () => { expect(producao().length).toBeGreaterThan(300) })
  it('só estes arquivos de produção citam as tabelas de comentários; Cowork (contexto-ia, acesso-ia, pipeline, MCP) e montar.ts não estão entre eles', () => {
    const achados = alvo(TABELAS)(producao())
    expect(achados).toEqual(TABELAS_PERMITIDAS)
    for (const a of achados) expect(a).not.toMatch(/contexto-ia|acesso-ia|api\/pipeline|api\/mcp|montar\.ts|montar-texto/)
  })
  it('só estes dois arquivos importam o leitor de comentários', () => { expect(alvo(LEITORES)(producao())).toEqual(LEITORES_PERMITIDOS) })
  it('controle negativo: o detector acha a violação num exemplo ruim', () => {
    expect(TABELAS.test("sb.from('competitor_video_comments').select('body')")).toBe(true)
    expect(LEITORES.test("import { x } from '@/lib/youtube/observatorio/comentarios/leitor'")).toBe(true)
    expect(TABELAS.test("sb.from('competitor_videos')")).toBe(false)
  })
})

// ───────────── M11: a coleta do canal, não a do site ─────────────
describe('criadorDoCanal passa a coleta do CANAL à M11 (ressalva do re-portão do Yannis)', () => {
  const DIA = 86_400_000
  const vid = (i: number): VideoLido => ({
    id: `v${i}`, videoId: `v${i}`, publishedAt: new Date(AGORA - (35 + i) * DIA).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false,
    isShort: false, durationSeconds: 600, viewCount: 1000, likeCount: 10, commentCount: 5, likesHidden: false, commentsDisabled: false, viewsHidden: false,
    discoveredAt: null, missingSince: null, seriesTier: null, lastCheckedAt: null,
  })
  it('coletaDesdeMs recebido é coletaDoCanalDesdeMs, diferente do do site', () => {
    espiao.chamadas.length = 0
    const videos = Array.from({ length: 6 }, (_, i) => vid(i))
    const c: ParteLida<ContagemDeRespostas> = {
      lido: true, dados: {
        porVideo: new Map(videos.map((v) => [v.id, { retrato30: 'ok', algumComRespostaDoCriador: false }])),
        coletaDoSiteDesdeMs: AGORA - 200 * DIA, coletaDoCanalDesdeMs: AGORA - 50 * DIA, ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: AGORA - 200 * DIA,
      },
    } as ParteLida<ContagemDeRespostas>
    const e: EntradaDoCriador = {
      nome: 'Matt', formato: { fmt: 'long', doisFormatos: false, soShorts: false }, videos, contagem: c,
      estado: { tipo: 'ativo', pastilha: 'Ativo', base: '', ate: null } as unknown as EntradaDoCriador['estado'], agoraMs: AGORA, hojeSP: '2026-10-15',
    }
    criadorDoCanal(e)
    expect(espiao.chamadas.length).toBeGreaterThan(0)
    expect(espiao.chamadas[0]?.coletaDesdeMs).toBe(AGORA - 50 * DIA)
    expect(espiao.chamadas[0]?.coletaDesdeMs).not.toBe(AGORA - 200 * DIA)
  })
})
void isValidElement
