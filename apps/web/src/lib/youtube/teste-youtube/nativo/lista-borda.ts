// Borda da lista "Vídeos do A/B Lab" (F1a-tela-1, T3): lê o banco em lote e monta as linhas. Só leitura.
// Consultas (teto de 8): youtube_videos, ab_native_fichas, ab_native_tests, ab_tests, RPC de volume, RPC de formato
// (+ a leitura de duração que `lerFormatos` faz só quando algum `is_short` ficou nulo)
// (+ 1 em lote a yt_own_video_versions pelo título de antes, só quando há linha derivada; F1a-tela-2 T4, D-1). Os vídeos de ficha e de registro
// vêm embutidos nas próprias consultas (FK), sem uma consulta extra por tabela. Nunca uma consulta por vídeo.
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { diaDoTeste, duracaoPrevista } from '@/lib/youtube/ab-dia-do-teste'
import { paraRestoreStatus } from '@/lib/youtube/ab-restore'
import { derivarFicha, type FichaLida, type FichaLinha } from './ficha'
import { lerFormatos, type Formato } from './formato-borda'
import { inicioDoTeste } from './guarda'
import { variantesDaResposta } from './versoes'
import { titulosAntesDoTeste } from '@/lib/youtube/observatorio/proprio-versoes/ler'
import { versoesDoDia14 } from '@/lib/youtube/teste-youtube/nativo/dia-14-estado'
import { estadoDaLinha, retomarAPartirDe, type LinhaDoCaminho, type RegistroDaLista } from './lista'
import type { RespostaDono } from './resposta'
import { caminhoDoTeste } from './roteador'
import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { volumeDoVideo } from './volume'
import { lerVolumes, type VolumeLido } from './volume-leitor'

const DIA_MS = 86_400_000
/** Registro confirmado e fechado entra na lista por 30 dias. */
const JANELA_FECHADOS_DIAS = 30
/** A lista mede o volume com 2 versões (a ficha usa o k real). */
const K_DA_LISTA = 2

interface VideoLido { id: string; youtube_video_id: string; title: string; thumbnail_url: string | null; published_at: string }
const COLUNAS_VIDEO = 'id, youtube_video_id, title, thumbnail_url, published_at'

const obj = (x: unknown): Record<string, unknown> | null =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null
/** Guard da linha de ab_native_fichas (sem o vídeo embutido): confere os campos que derivarFicha lê. */
const ehFichaLinha = (o: Record<string, unknown>): o is Record<string, unknown> & FichaLinha =>
  typeof o.id === 'string' && typeof o.site_id === 'string' && typeof o.video_id === 'string' &&
  Array.isArray(o.campos) && Array.isArray(o.variantes) &&
  typeof o.criada_em === 'string' && typeof o.atualizada_em === 'string' &&
  (o.registro_id === null || typeof o.registro_id === 'string') && (o.descartada_em === null || typeof o.descartada_em === 'string')
const str = (x: unknown): string | null => (typeof x === 'string' ? x : null)

function comoVideo(x: unknown): VideoLido | null {
  const o = obj(x)
  if (!o || typeof o.id !== 'string' || typeof o.youtube_video_id !== 'string' || typeof o.published_at !== 'string') return null
  return { id: o.id, youtube_video_id: o.youtube_video_id, title: str(o.title) ?? '', thumbnail_url: str(o.thumbnail_url), published_at: o.published_at }
}
/** O PostgREST embute uma linha (FK muitos-para-um) como objeto; aceita lista de um por segurança. */
const videoEmbutido = (x: unknown): VideoLido | null => comoVideo(Array.isArray(x) ? x[0] : x)

async function ler<T>(nome: string, p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(`${nome}: ${error.message}`)
  return Array.isArray(data) ? (data as T[]) : []
}

type LinhaTeste = Record<string, unknown> & { id: string; video_id: string }
const ehLinhaTeste = (x: unknown): x is LinhaTeste => { const o = obj(x); return o !== null && typeof o.id === 'string' && typeof o.video_id === 'string' }

const TEXTOS_CAMPO = new Set(['titulo', 'miniatura'])
function camposDe(x: unknown): ('titulo' | 'miniatura')[] | null {
  return Array.isArray(x) ? (x.filter((c) => typeof c === 'string' && TEXTOS_CAMPO.has(c)) as ('titulo' | 'miniatura')[]) : null
}
function variantesDe(x: unknown): { n: number; titulo: string | null; imagem: { url: string } | null }[] | null {
  if (!Array.isArray(x)) return null
  const saida: { n: number; titulo: string | null; imagem: { url: string } | null }[] = []
  for (const v of x) {
    const o = obj(v)
    if (!o || typeof o.n !== 'number') return null
    const img = obj(o.imagem)
    saida.push({ n: o.n, titulo: str(o.titulo), imagem: img && typeof img.url === 'string' ? { url: img.url } : null })
  }
  return saida
}
/** `votos_titulo` = `{ título: leituras }` com números finitos e não negativos; qualquer outra forma é "não medido" (nulo). */
const votosDe = (x: unknown): Record<string, number> | null => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const saida: Record<string, number> = {}
  for (const [k, v] of Object.entries(x)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
    saida[k] = v
  }
  return saida
}
const titulosDe = (x: unknown): string[] | null => (Array.isArray(x) && x.every((t) => typeof t === 'string') ? (x as string[]) : null)

const RESPOSTAS = new Set(['venceu_nova', 'venceu_original', 'ficou_igual', 'inconclusivo', 'nao_vi', 'sem_resposta'])
const ESTADOS = new Set(['em_andamento', 'encerrado', 'sem_desfecho', 'descartado'])

/** Entre vários registros do vídeo: o aberto, senão o mais novo. */
function melhorRegistro(atual: LinhaTeste | undefined, novo: LinhaTeste): LinhaTeste {
  if (!atual) return novo
  const aberto = (r: LinhaTeste): boolean => r.estado === 'em_andamento'
  if (aberto(atual) !== aberto(novo)) return aberto(atual) ? atual : novo
  return Date.parse(String(novo.created_at)) > Date.parse(String(atual.created_at)) ? novo : atual
}

/** Origem derivada = sem ficha vinculada (`variantes` nulo no banco); é a única que precisa do título de antes (D-1). */
const ehDerivada = (r: LinhaTeste): boolean => r.variantes === null || r.variantes === undefined

function registroDaLista(r: LinhaTeste, tituloAntes: string | null): RegistroDaLista {
  const estado = ESTADOS.has(String(r.estado)) ? (r.estado as RegistroDaLista['estado']) : 'descartado'
  const resposta = RESPOSTAS.has(String(r.resposta_dono)) ? (str(r.resposta_dono) as RegistroDaLista['respostaDono']) : null
  const n = typeof r.variante_vencedora === 'number' ? r.variante_vencedora : null
  // O título escolhido sai da MESMA numeração que o servidor usa ao gravar (versoes.ts): ficha pela posição `n`, derivada pelo índice.
  let tituloDaResposta: string | null = null
  if (n !== null) {
    if (ehDerivada(r)) {
      tituloDaResposta = variantesDaResposta({ variantes: null, variantes_titulo: r.variantes_titulo, titulo_antes: tituloAntes })?.itens[n - 1]?.titulo ?? null
    } else {
      tituloDaResposta = variantesDe(r.variantes)?.find((v) => v.n === n)?.titulo ?? null
    }
  }
  const fonte = str(r.vencedor_fonte)
  return {
    estado, confirmadoEm: str(r.confirmado_em), primeiraVista: str(r.primeira_vista), createdAt: String(r.created_at), respostaDono: resposta,
    vencedorFonte: fonte === 'regra' || fonte === 'dono' || fonte === 'data_api' ? fonte : null,
    vencedorTitulo: str(r.vencedor_titulo), tituloDaResposta,
  }
}

async function lerTitulosAntes(sb: SupabaseClient, siteId: string, derivados: LinhaTeste[]): Promise<Map<string, string>> {
  return titulosAntesDoTeste(sb, siteId, derivados.filter((r) => typeof r.youtube_video_id === 'string')
    .map((r) => ({ id: r.id, youtubeVideoId: String(r.youtube_video_id), primeiraVista: str(r.primeira_vista) })))
}

/** `registroId`s já avisados neste processo: a lista relê a cada visita, o aviso sai uma vez (D-7(e)). */
const avisados = new Set<string>()
function avisarSemVersoes(registroId: string): void {
  if (avisados.has(registroId)) return
  avisados.add(registroId)
  Sentry.captureMessage('lista do A/B Lab: versões do dia 14 ilegíveis (sem_versoes)', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { registroId } })
}

/** Último envio ao Studio (o maior entre `studio_aberto_em` e `lembrar_em`), em ISO. */
function enviadaEm(f: FichaLida): string | null {
  const marcas = [f.studio_aberto_em, f.lembrar_em].filter((x): x is string => x !== null).filter((x) => Number.isFinite(Date.parse(x)))
  if (marcas.length === 0) return null
  return marcas.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
}

interface Base {
  recentes: unknown[]
  fichas: Map<string, FichaLida>
  testes: Map<string, LinhaTeste>
  extras: VideoLido[]
  titulosAntes: Map<string, string>
  nossos: Map<string, NonNullable<LinhaDoCaminho['nosso']>>
}

/** As leituras que não dependem de qual vídeo aparece: fichas abertas, registros, testes nossos e o título de antes. */
async function lerBase(
  sb: SupabaseClient, siteId: string, agora: Date,
  recentesP: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Base> {
  const iso30 = new Date(agora.getTime() - JANELA_FECHADOS_DIAS * DIA_MS).toISOString()
  const colunasFicha = `id, site_id, video_id, campos, variantes, criada_em, criada_por, atualizada_em, studio_aberto_em, lembrar_em, descartada_em, registro_id, video:youtube_videos(${COLUNAS_VIDEO})`
  const colunasTeste = `id, video_id, youtube_video_id, estado, confirmado_em, primeira_vista, ultima_vista, votos_titulo, created_at, updated_at, resposta_dono, variantes, variantes_titulo, campos, vencedor_fonte, vencedor_titulo, variante_vencedora, respondido_em, resposta_mudada_em, desfecho_em, video:youtube_videos(${COLUNAS_VIDEO})`

  const [recentes, fichasBrutas, testesBrutos, nossosBrutos] = await Promise.all([
    ler<unknown>('youtube_videos', recentesP),
    ler<unknown>('ab_native_fichas', sb.from('ab_native_fichas').select(colunasFicha)
      .eq('site_id', siteId).is('registro_id', null).is('descartada_em', null)),
    ler<unknown>('ab_native_tests', sb.from('ab_native_tests').select(colunasTeste)
      .eq('site_id', siteId).or(`estado.eq.em_andamento,and(confirmado_em.not.is.null,encerrado_em.gte.${iso30})`)),
    ler<unknown>('ab_tests', sb.from('ab_tests').select('id, youtube_video_id, status, started_at, restore_seq, restore_status, config')
      .eq('site_id', siteId).in('status', ['active', 'paused'])),
  ])

  const extras: VideoLido[] = []
  const fichas = new Map<string, FichaLida>()
  for (const f of fichasBrutas) {
    const o = obj(f)
    if (!o || typeof o.video_id !== 'string') continue
    const v = videoEmbutido(o.video)
    if (v) extras.push(v)
    const { video: _video, ...linha } = o
    if (!ehFichaLinha(linha)) continue
    fichas.set(o.video_id, derivarFicha(linha, agora))
  }
  const testes = new Map<string, LinhaTeste>()
  for (const t of testesBrutos) {
    if (!ehLinhaTeste(t)) continue
    testes.set(t.video_id, melhorRegistro(testes.get(t.video_id), t))
  }
  for (const t of testes.values()) { const v = videoEmbutido(t.video); if (v) extras.push(v) }

  const titulosAntes = await lerTitulosAntes(sb, siteId, [...testes.values()].filter(ehDerivada))

  const nossos = new Map<string, NonNullable<LinhaDoCaminho['nosso']>>()
  for (const n of nossosBrutos) {
    const o = obj(n)
    if (!o || typeof o.youtube_video_id !== 'string' || typeof o.id !== 'string') continue
    const config = obj(o.config)
    nossos.set(o.youtube_video_id, {
      testId: o.id, restoreSeq: typeof o.restore_seq === 'number' ? o.restore_seq : 0, restoreStatus: paraRestoreStatus(o.restore_status),
      dia: diaDoTeste(str(o.started_at), null, agora) ?? 0, status: o.status === 'paused' ? 'paused' : 'active',
      teto: duracaoPrevista(config as { max_duration_days?: number } | null),
    })
  }
  return { recentes, fichas, testes, extras, titulosAntes, nossos }
}

const SEM_FORMATO: Formato = { isShort: null, kids: null, adulto: null, aoVivo: null }

/** Monta uma linha a partir do que já foi lido (mesma saída de sempre). */
function montarLinha(v: VideoLido, b: Base, vol: VolumeLido | undefined, formato: Formato | undefined, agora: Date): LinhaDoCaminho {
  const volume = volumeDoVideo(vol ? { soma: vol.soma, diasCobertos: vol.diasCobertos } : null, K_DA_LISTA)
  const idadeDias = Math.max(0, Math.floor((agora.getTime() - Date.parse(v.published_at)) / DIA_MS))
  const caminho = caminhoDoTeste({ formato: formato ?? SEM_FORMATO, idadeDias, impressoesAcimaDoPiso: volume.acimaDoPiso })
  const ficha = b.fichas.get(v.id) ?? null
  const nosso = b.nossos.get(v.id) ?? null
  const bruto = b.testes.get(v.id)
  const registro = bruto ? registroDaLista(bruto, b.titulosAntes.get(bruto.id) ?? null) : null
  const estado = estadoDaLinha({ caminho, ficha, registro, nosso }, agora)

  let linhaRegistro: LinhaDoCaminho['registro'] = null
  let labPausadoAte: string | null = null
  if (bruto && registro) {
    const inicio = inicioDoTeste({ primeira_vista: registro.primeiraVista, confirmado_em: registro.confirmadoEm, created_at: registro.createdAt })
    const variantes = variantesDe(bruto.variantes)
    // Ficha ilegível (JSON fora da forma): o servidor também não a lê e NÃO cai na derivada; a lista idem (sem_versoes, nunca versões inventadas).
    const fichaIlegivel = !ehDerivada(bruto) && variantes === null
    linhaRegistro = {
      id: bruto.id, updatedAt: String(bruto.updated_at), confirmadoEm: registro.confirmadoEm, primeiraVista: registro.primeiraVista,
      diaDe14: diaDoTeste(inicio.toISOString(), null, agora) ?? 0,
      ultimaVista: str(bruto.ultima_vista), votosTitulo: votosDe(bruto.votos_titulo),
      variantes, variantesTitulo: fichaIlegivel ? null : titulosDe(bruto.variantes_titulo), campos: camposDe(bruto.campos),
      respostaDono: registro.respostaDono === 'sem_resposta' ? null : registro.respostaDono as RespostaDono | null,
      tituloAntes: b.titulosAntes.get(bruto.id) ?? null,
      varianteVencedora: typeof bruto.variante_vencedora === 'number' ? bruto.variante_vencedora : null,
      respondidoEm: str(bruto.respondido_em), respostaMudadaEm: str(bruto.resposta_mudada_em),
      vencedorFonte: registro.vencedorFonte, vencedorTitulo: registro.vencedorTitulo, desfechoEm: str(bruto.desfecho_em),
      inicio: inicio.toISOString(),
    }
    if (versoesDoDia14(linhaRegistro).tipo === 'sem_versoes' && (bruto.variantes != null || bruto.variantes_titulo != null)) avisarSemVersoes(bruto.id)
    if (registro.estado === 'em_andamento' && nosso?.status === 'paused') labPausadoAte = retomarAPartirDe(registro).toISOString()
  }
  return {
    videoId: v.id, ytId: v.youtube_video_id, titulo: v.title, miniaturaUrl: v.thumbnail_url, publicadoEm: v.published_at,
    estado, caminho, fichaId: ficha?.id ?? null, registro: linhaRegistro, labPausadoAte, nosso, impressoesPorDia: volume.porDia,
    fichaEnviadaEm: ficha?.enviada ? enviadaEm(ficha) : null, fichaCompleta: ficha ? ficha.variantes.some((x) => x.n >= 2) : false,
  }
}

const provaValida = (leitura: LeituraPrivadaDoSite | null, siteId: string): leitura is LeituraPrivadaDoSite =>
  leitura !== null && leituraValida(leitura) && leitura.siteId === siteId

// ---------------------------------------------------------------------------------------------------------------------
// M7 T6: o canal inteiro, com busca, filtro "Testáveis" e páginas de 20.
// Dívida declarada: cada página e cada busca refazem a leitura inteira (1 a 2 selects de 1000 + até 4 RPCs de volume + formato).
// Aceitável até o teto de 2000; gatilho para cursor por `published_at`: canal com mais de 1000 vídeos ou action acima de 2 s.
// ---------------------------------------------------------------------------------------------------------------------

export const POR_PAGINA = 20
export const TETO_VIDEOS_DO_CANAL = 2000
export const LOTE_DE_VOLUME = 500
const LOTE_DE_VIDEOS = 1000

export interface RecorteDaLista { busca: string | null; filtro: 'testaveis' | 'todos'; pagina: number; incluirYtId: string | null }
/** `shorts` = acima do piso mas Short (o Studio não testa): testaveis + semVolume + naoLido + shorts = total. */
export interface ContagemDoCanal { testaveis: number; semVolume: number; naoLido: number; shorts: number; total: number; motivoNaoLido: 'sem_leitura' | 'falha' | 'poucos_dias' | 'sem_relatorio' | null }
/** `contagem` é SEMPRE do canal inteiro (nunca muda com a busca); `totalDoFiltro` é o da busca + filtro. */
export interface PaginaDoCanal { linhas: LinhaDoCaminho[]; contagem: ContagemDoCanal; totalDoFiltro: number; temMais: boolean;
  /** Vídeos do filtro que ainda faltam mostrar (já descontadas as extras da página 0). */
  restantes: number;
  /** Na página 0: linhas na tela que o filtro não aceita (extras fixadas); somam ao denominador de "Mostrando N de M". */
  extrasForaDoFiltro: number;
  truncado: boolean; filtroEfetivo: 'testaveis' | 'todos' }

export const PedidoVideosDoCanalSchema = z.object({
  busca: z.string().trim().max(100).nullable(),
  filtro: z.enum(['testaveis', 'todos']),
  pagina: z.number().int().min(0).max(100),
  incluirYtId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
})

/** NFD, sem diacríticos, minúsculas, espaços colapsados. */
export function normalizarBusca(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Mais novo primeiro; empate de `published_at` por `id` crescente (a mesma ordem do `order` do banco). */
const maisNovoPrimeiro = (a: VideoLido, b: VideoLido): number =>
  (Date.parse(b.published_at) - Date.parse(a.published_at)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

async function lerVideosDoSite(sb: SupabaseClient, siteId: string, agora: Date): Promise<{ videos: VideoLido[]; truncado: boolean }> {
  const lidos: VideoLido[] = []
  const bloco = (de: number, ate: number) => ler<unknown>('youtube_videos', sb.from('youtube_videos').select(COLUNAS_VIDEO)
    .eq('site_id', siteId).lte('published_at', agora.toISOString())
    .order('published_at', { ascending: false }).order('id', { ascending: true }).range(de, ate))
  for (let de = 0; de < TETO_VIDEOS_DO_CANAL; de += LOTE_DE_VIDEOS) {
    const linhas = await bloco(de, de + LOTE_DE_VIDEOS - 1)
    for (const x of linhas) { const v = comoVideo(x); if (v) lidos.push(v) }
    if (linhas.length < LOTE_DE_VIDEOS) return { videos: lidos.sort(maisNovoPrimeiro), truncado: false }
  }
  // Os dois blocos vieram cheios: existe mais um vídeo além do teto?
  const alem = await bloco(TETO_VIDEOS_DO_CANAL, TETO_VIDEOS_DO_CANAL)
  const truncado = alem.length > 0
  if (truncado) Sentry.captureMessage('lista do A/B Lab: canal acima do teto de vídeos lidos', { level: 'warning', tags: { area: 'ab-nativo' }, extra: { teto: TETO_VIDEOS_DO_CANAL } })
  return { videos: lidos.sort(maisNovoPrimeiro), truncado }
}

type MotivoNaoLido = ContagemDoCanal['motivoNaoLido']

async function lerVolumesEmLotes(
  sb: SupabaseClient, siteId: string, leitura: LeituraPrivadaDoSite | null, ids: string[],
): Promise<{ volumes: Map<string, VolumeLido>; motivo: Exclude<MotivoNaoLido, 'poucos_dias'> }> {
  if (!provaValida(leitura, siteId)) return { volumes: new Map(), motivo: 'sem_leitura' }
  try {
    const lotes: string[][] = []
    for (let i = 0; i < ids.length; i += LOTE_DE_VOLUME) lotes.push(ids.slice(i, i + LOTE_DE_VOLUME))
    const partes = await Promise.all(lotes.map((l) => lerVolumes(sb, leitura, l)))
    const volumes = new Map<string, VolumeLido>()
    for (const m of partes) for (const [k, v] of m) volumes.set(k, v)
    return { volumes, motivo: null }
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'ab-nativo', acao: 'lerPaginaDoCanal.volume' } })
    return { volumes: new Map(), motivo: 'falha' }
  }
}

/** Formato é dado secundário: se a leitura falha, segue com formato desconhecido (nulo conta como testável; a ficha reconfere ao abrir) e avisa o Sentry. */
async function lerFormatosSemDerrubar(sb: SupabaseClient, siteId: string, videos: { id: string; ytId: string }[]): Promise<Map<string, Formato>> {
  try { return await lerFormatos(sb, siteId, videos) } catch (e) {
    Sentry.captureException(e, { tags: { area: 'ab-nativo', acao: 'lerPaginaDoCanal.formato' } })
    return new Map<string, Formato>()
  }
}

export async function lerPaginaDoCanal(
  sb: SupabaseClient, siteId: string, agora: Date, leitura: LeituraPrivadaDoSite | null, r: RecorteDaLista,
): Promise<PaginaDoCanal> {
  const semBase = { data: [] as unknown[], error: null }
  const [{ videos, truncado }, b] = await Promise.all([
    lerVideosDoSite(sb, siteId, agora),
    lerBase(sb, siteId, agora, Promise.resolve(semBase)),
  ])
  const porId = new Map(videos.map((v) => [v.id, v]))
  for (const v of b.extras) if (!porId.has(v.id)) porId.set(v.id, v)

  const { volumes, motivo } = await lerVolumesEmLotes(sb, siteId, leitura, [...porId.keys()])

  // Privado (publico === false) fica fora de tudo; publico nulo (nunca capturado) conta como público.
  const publicos = videos.filter((v) => volumes.get(v.id)?.publico !== false)
  const volumeDe = (v: VideoLido) => volumeDoVideo(volumes.get(v.id) ? { soma: volumes.get(v.id)!.soma, diasCobertos: volumes.get(v.id)!.diasCobertos } : null, K_DA_LISTA)
  const acima = publicos.filter((v) => volumeDe(v).acimaDoPiso === true)

  // Extras de hoje: fichas abertas, registros do Studio e testes nossos (na página 0, fora de busca).
  const idsExtras = new Set<string>([...b.fichas.keys(), ...b.testes.keys()])
  for (const v of porId.values()) if (b.nossos.has(v.id)) idsExtras.add(v.id)
  const extras = [...idsExtras].map((id) => porId.get(id)).filter((v): v is VideoLido => v !== undefined).sort(maisNovoPrimeiro)

  const buscaTxt = r.busca !== null && normalizarBusca(r.busca).length >= 2 ? normalizarBusca(r.busca) : null
  const doFiltro = (lista: VideoLido[], filtro: 'testaveis' | 'todos', testavel: Set<string>) =>
    (filtro === 'testaveis' ? lista.filter((v) => testavel.has(v.id)) : lista)
      .filter((v) => buscaTxt === null || normalizarBusca(v.title).includes(buscaTxt))

  // Página: precisa do formato dos acima do piso (para "testável") e dos vídeos que vão para a tela.
  // O recorte depende do formato, então primeiro os acima do piso; depois as linhas da página.
  const formatosAcima = await lerFormatosSemDerrubar(sb, siteId, acima.map((v) => ({ id: v.id, ytId: v.youtube_video_id })))
  const testavel = new Set(acima.filter((v) => formatosAcima.get(v.id)?.isShort !== true).map((v) => v.id))

  const contagem: ContagemDoCanal = { testaveis: 0, semVolume: 0, naoLido: 0, shorts: 0, total: publicos.length, motivoNaoLido: null }
  let naoLidoComRelatorio = 0
  for (const v of publicos) {
    const a = volumeDe(v).acimaDoPiso
    if (a === null) { contagem.naoLido++; if ((volumes.get(v.id)?.diasCobertos ?? 0) > 0) naoLidoComRelatorio++ }
    else if (a === false) contagem.semVolume++
    else if (testavel.has(v.id)) contagem.testaveis++
    else contagem.shorts++
  }
  if (contagem.naoLido > 0) {
    // nenhum dos não lidos tem um dia de relatório: o canal não tem relatório de alcance (espera eterna), não "poucos dias"
    contagem.motivoNaoLido = motivo ?? (naoLidoComRelatorio === 0 ? 'sem_relatorio' : 'poucos_dias')
  }

  const filtroEfetivo: 'testaveis' | 'todos' = r.filtro === 'testaveis' && contagem.testaveis === 0 && contagem.naoLido > 0 ? 'todos' : r.filtro

  const filtrados = doFiltro(publicos, filtroEfetivo, testavel)
  const semExtras = buscaTxt === null ? filtrados.filter((v) => !idsExtras.has(v.id)) : filtrados
  const inicio = r.pagina * POR_PAGINA
  const daPagina = semExtras.slice(inicio, inicio + POR_PAGINA)
  const temMais = inicio + POR_PAGINA < semExtras.length

  const naTela: VideoLido[] = []
  const vistos = new Set<string>()
  const empurrar = (v: VideoLido | undefined) => { if (v && !vistos.has(v.id)) { vistos.add(v.id); naTela.push(v) } }
  if (r.pagina === 0 && buscaTxt === null) extras.forEach(empurrar)
  if (r.incluirYtId !== null) empurrar([...porId.values()].find((v) => v.youtube_video_id === r.incluirYtId))
  daPagina.forEach(empurrar)

  // Formato das linhas que ainda não foram lidas (fora dos acima do piso).
  const faltam = naTela.filter((v) => !formatosAcima.has(v.id))
  const formatosExtras = faltam.length > 0 ? await lerFormatosSemDerrubar(sb, siteId, faltam.map((v) => ({ id: v.id, ytId: v.youtube_video_id }))) : new Map<string, Formato>()
  const formatoDe = (id: string) => formatosAcima.get(id) ?? formatosExtras.get(id)

  const noFiltro = new Set(filtrados.map((v) => v.id))
  return {
    linhas: naTela.map((v) => montarLinha(v, b, volumes.get(v.id), formatoDe(v.id), agora)),
    contagem, totalDoFiltro: filtrados.length, temMais, truncado, filtroEfetivo,
    restantes: Math.max(0, semExtras.length - (inicio + daPagina.length)),
    extrasForaDoFiltro: r.pagina === 0 ? naTela.filter((v) => !noFiltro.has(v.id)).length : 0,
  }
}
