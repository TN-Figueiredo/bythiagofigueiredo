// E18 T9: leitor de servidor das versões do vídeo próprio. Só leitura, sem tela. O molde é o de `proprio/ler-dimensoes.ts`:
//   - o acesso é a PROVA de leitura privada do site (`LeituraPrivadaDoSite`): sem prova (ou objeto forjado) = 'negado' SEM consultar nada;
//   - o site vem de dentro da prova; toda consulta filtra site E canal; `ytIds` validados e limitados a 50;
//   - leitura paginada com teto de linhas: passar do teto ou erro de banco LANÇA `ErroLeituraVersoes` (nunca lista vazia);
//   - tabela que não existe (migration não aplicada) NÃO lança: vira o estado `schema_ausente`;
//   - PRIVACIDADE: título de vídeo não listado e a origem da troca nunca vão a log nem a erro. O erro leva só tabela, motivo,
//     código do banco e contagem; a mensagem do banco é descartada.
// Este é o único arquivo, fora de `coleta/`, que consulta `yt_own_video_versions` (uma varredura de teste confere).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import { TAMANHO_PAGINA } from '@/lib/youtube/coleta/paginar'
import { ehSchemaAusente } from '@/lib/youtube/coleta/schema'
import { leituraValida } from '../proprio/leitura-privada'
import type { LeituraPrivadaDoSite } from '../proprio/leitura-privada'
import type { DiaYt } from '../proprio/tipos'
import type { Privado } from '../proprio/tipos'
import type {
  CampoVersao, EstadoRegistro, LinhaEstadoDb, LinhaVersaoDb, RegistroDoCampo, VersaoPropria, VersoesCanal, VersoesDoVideo,
} from './tipos'

export const TETO_LINHAS_VERSOES = 20_000
export const TETO_VIDEOS_VERSOES = 50

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ID_VIDEO = /^[A-Za-z0-9_-]{1,32}$/
const CAMPOS: readonly CampoVersao[] = ['title', 'thumb', 'desc']

export type MotivoLeitura = 'erro_de_banco' | 'passou_do_teto'

/** Falha de leitura. Sem o texto do banco: só tabela, motivo, código e quantas linhas já tinham chegado. */
export class ErroLeituraVersoes extends Error {
  readonly tabela: string
  readonly motivo: MotivoLeitura
  readonly codigo: string | null
  readonly lidas: number
  constructor(tabela: string, motivo: MotivoLeitura, codigo: string | null, lidas: number) {
    super(`leitura de ${tabela} falhou: ${motivo === 'passou_do_teto' ? 'passou do teto de linhas' : 'erro de banco'}${codigo ? ` (código ${codigo})` : ''}, ${lidas} linhas lidas`)
    this.name = 'ErroLeituraVersoes'
    this.tabela = tabela
    this.motivo = motivo
    this.codigo = codigo
    this.lidas = lidas
  }
}

/** Mesmo formato do `Pedido` de `../proprio/ler`, declarado aqui: a varredura do dado privado proíbe importar daquele módulo. */
interface Pedido { leitura: LeituraPrivadaDoSite | null; canalId: string; hoje: DiaYt }

export interface PedidoVersoes extends Pedido {
  ytIds: readonly string[]
  /** teto de linhas por leitura (padrão TETO_LINHAS_VERSOES) */
  tetoLinhas?: number
}

interface ConsultaFaixa { range(de: number, ate: number): PromiseLike<{ data: unknown; error: { code?: string | null } | null }> }
type Leitura<T> = { ausente: true } | { ausente: false; linhas: T[] }

async function lerTudo<T>(tabela: string, build: () => ConsultaFaixa, teto: number): Promise<Leitura<T>> {
  const todas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    let res: { data: unknown; error: { code?: string | null } | null }
    try {
      res = await build().range(de, de + TAMANHO_PAGINA - 1)
    } catch {
      throw new ErroLeituraVersoes(tabela, 'erro_de_banco', null, todas.length)
    }
    if (res.error) {
      if (ehSchemaAusente(res.error)) return { ausente: true }
      throw new ErroLeituraVersoes(tabela, 'erro_de_banco', res.error.code ?? null, todas.length)
    }
    // Resposta sem lista NÃO é lista vazia.
    if (!Array.isArray(res.data)) throw new ErroLeituraVersoes(tabela, 'erro_de_banco', null, todas.length)
    for (const l of res.data as T[]) todas.push(l)
    if (todas.length > teto) throw new ErroLeituraVersoes(tabela, 'passou_do_teto', null, todas.length)
    if (res.data.length < TAMANHO_PAGINA) return { ausente: false, linhas: todas }
  }
}

const registroVazio = (): Record<CampoVersao, RegistroDoCampo> => ({
  title: { estado: 'sem_versao', conferidoAte: null }, thumb: { estado: 'sem_versao', conferidoAte: null }, desc: { estado: 'sem_versao', conferidoAte: null },
})

/**
 * A URL termina no dHash da própria versão. Retoque com dHash igual ao da âncora repete a URL da véspera (a T5 não arquiva): a imagem
 * não é a do retoque, então não é exata (portão 14/10, Phil m-3).
 */
function imagemExata(l: LinhaVersaoDb): boolean {
  if (l.thumb_blob_url === null || !l.thumb_blob_url.endsWith(`/${l.thumb_dhash}.jpg`)) return false
  return !(l.thumb_similar && l.thumb_dhash === l.thumb_anchor_dhash)
}

function paraVersao(l: LinhaVersaoDb): VersaoPropria {
  return {
    id: l.id, ytId: l.youtube_video_id, campo: l.field, texto: l.value_text, hash: l.value_hash,
    thumb: l.field === 'thumb' && l.thumb_dhash !== null
      ? { dhash: l.thumb_dhash, sha256: l.thumb_sha256, blobUrl: l.thumb_blob_url, imagemExata: imagemExata(l), retoque: l.thumb_similar }
      : null,
    primeiroDia: l.first_day_pt, ultimoDia: l.last_day_pt, vistaDesde: l.first_seen_at, vistaAte: l.last_seen_at,
    janela: l.window_start !== null && l.window_end !== null ? { de: l.window_start, ate: l.window_end } : null,
    precisao: l.window_precision, origem: l.origin, eventoAb: l.ab_event, abTestId: l.ab_test_id, abVariantId: l.ab_variant_id,
    preRegistro: l.pre_registro, corrente: l.is_current,
  }
}

function montarVideo(ytId: string, linhas: readonly LinhaVersaoDb[]): VersoesDoVideo {
  const versoes = linhas.map(paraVersao).sort((a, b) =>
    CAMPOS.indexOf(a.campo) - CAMPOS.indexOf(b.campo) || (a.vistaDesde < b.vistaDesde ? -1 : a.vistaDesde > b.vistaDesde ? 1 : 0))
  const registro = registroVazio()
  for (const campo of CAMPOS) {
    const reais = versoes.filter(v => v.campo === campo && !v.preRegistro) // pré-registro não conta para o estado do campo
    if (reais.length === 0) continue
    const corrente = reais.find(v => v.corrente) ?? null
    registro[campo] = {
      estado: reais.every(v => v.origem === 'linha_de_base') ? 'so_linha_de_base' : 'com_trocas',
      conferidoAte: corrente?.ultimoDia ?? null,
    }
  }
  return { ytId, registro, versoes }
}

export async function lerVersoes(sb: SupabaseClient, p: PedidoVersoes): Promise<Privado<VersoesCanal>> {
  // Sem prova de edição: negado ANTES de qualquer consulta.
  if (!leituraValida(p.leitura) || !UUID.test(p.canalId)) return { acesso: 'negado' }
  const siteId = p.leitura.siteId, canalId = p.canalId
  const teto = p.tetoLinhas ?? TETO_LINHAS_VERSOES
  if (!Number.isFinite(teto) || teto <= 0) throw new RangeError('teto de linhas inválido: precisa ser um número finito maior que zero')
  // Fora do formato sai (contrato do teste 12); acima do teto LANÇA em vez de cortar calado (portão 14/10, Phil m-1).
  const ytIds = [...new Set(p.ytIds)].filter(id => ID_VIDEO.test(id))
  if (ytIds.length > TETO_VIDEOS_VERSOES) throw new RangeError(`ytIds acima do teto de ${TETO_VIDEOS_VERSOES} vídeos por leitura`)

  const est = await lerTudo<LinhaEstadoDb>('yt_own_versions_state', () => sb.from('yt_own_versions_state')
    .select('channel_id, tracking_since, derived_through')
    .eq('site_id', siteId).eq('channel_id', canalId).order('channel_id'), teto)
  if (est.ausente) return { acesso: 'ok', dado: { canalId, estado: { estado: 'schema_ausente' }, videos: [] } }

  const semVersoes = (estado: EstadoRegistro): Privado<VersoesCanal> => ({
    acesso: 'ok', dado: { canalId, estado, videos: ytIds.map(ytId => ({ ytId, registro: registroVazio(), versoes: [] })) },
  })
  const linhaEstado = est.linhas[0]
  if (!linhaEstado) return semVersoes({ estado: 'sem_estado' })
  const estado: EstadoRegistro = {
    estado: 'registrando', desde: linhaEstado.tracking_since, conferidoAte: linhaEstado.derived_through,
    atrasoDias: diffDias(linhaEstado.derived_through, addDays(p.hoje, -1)),
  }
  if (ytIds.length === 0) return { acesso: 'ok', dado: { canalId, estado, videos: [] } }

  const ver = await lerTudo<LinhaVersaoDb>('yt_own_video_versions', () => sb.from('yt_own_video_versions')
    .select('id, youtube_video_id, field, value_text, value_hash, thumb_dhash, thumb_anchor_dhash, thumb_sha256, thumb_blob_url, thumb_similar, first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_start, window_end, window_precision, origin, ab_event, ab_test_id, ab_variant_id, pre_registro, is_current')
    .eq('site_id', siteId).eq('channel_id', canalId).in('youtube_video_id', ytIds)
    .order('youtube_video_id').order('field').order('first_seen_at').order('id'), teto)
  if (ver.ausente) return { acesso: 'ok', dado: { canalId, estado: { estado: 'schema_ausente' }, videos: [] } }

  const porVideo = new Map<string, LinhaVersaoDb[]>()
  for (const l of ver.linhas) {
    const lista = porVideo.get(l.youtube_video_id)
    if (lista) lista.push(l); else porVideo.set(l.youtube_video_id, [l])
  }
  return { acesso: 'ok', dado: { canalId, estado, videos: ytIds.map(id => montarVideo(id, porVideo.get(id) ?? [])) } }
}

export interface PedidoTituloAntes { id: string; youtubeVideoId: string; primeiraVista: string | null }

/**
 * F1a-tela-2, D-1: título vigente na Data API em `primeira_vista`, por registro de teste nativo, em UMA consulta em lote.
 * Entram a linha de base, as trocas de fora e do CMS e o que o Lab deixou no ar (`vencedor`, `restauro`); fica de fora só a `rotacao`
 * do Lab (título passageiro). O corte por `primeira_vista` (inclusive: `first_seen_at` igual conta) é em memória.
 * Sem pedido com `primeira_vista` não consulta nada. Erro de leitura LANÇA (nunca vira "sem original" em silêncio).
 * Chave do resultado: `id` do registro. Registro sem versão anterior fica fora do Map.
 */
export async function titulosAntesDoTeste(sb: SupabaseClient, siteId: string, pedidos: readonly PedidoTituloAntes[]): Promise<Map<string, string>> {
  const saida = new Map<string, string>()
  const validos = pedidos.filter((r) => r.primeiraVista !== null && Number.isFinite(Date.parse(r.primeiraVista)))
  if (validos.length === 0) return saida
  const ids = [...new Set(validos.map((r) => r.youtubeVideoId))]
  const teto = Math.max(...validos.map((r) => Date.parse(r.primeiraVista as string)))
  const { data, error } = await sb.from('yt_own_video_versions').select('youtube_video_id, value_text, first_seen_at')
    .eq('site_id', siteId).in('youtube_video_id', ids).eq('field', 'title').eq('pre_registro', false)
    .or('origin.neq.ab_lab,ab_event.in.(vencedor,restauro,escolha)').lte('first_seen_at', new Date(teto).toISOString())
    .order('first_seen_at', { ascending: false })
  if (error) throw new Error(`yt_own_video_versions: ${error.message}`)
  const porVideo = new Map<string, Array<{ em: number; texto: string }>>()
  for (const l of Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []) {
    const texto = typeof l.value_text === 'string' ? l.value_text : null
    const em = Date.parse(String(l.first_seen_at))
    if (typeof l.youtube_video_id !== 'string' || texto === null || texto.trim() === '' || !Number.isFinite(em)) continue
    const lista = porVideo.get(l.youtube_video_id) ?? []
    lista.push({ em, texto })
    porVideo.set(l.youtube_video_id, lista)
  }
  for (const r of validos) {
    const vista = Date.parse(r.primeiraVista as string)
    const achada = (porVideo.get(r.youtubeVideoId) ?? []).find((v) => v.em <= vista) // já em ordem decrescente
    if (achada) saida.set(r.id, achada.texto)
  }
  return saida
}
