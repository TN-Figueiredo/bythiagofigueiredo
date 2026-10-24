// Envio B (§7): leitura dos concorrentes para o Cowork. Rota e MCP chamam esta mesma função, para dar o mesmo número nos dois.
// Só lê: nunca grava. A conversão banco -> leitura é a de `estado-de-leitura.ts` (`lerLinha`/`lerCursor`); os textos são os de `textos.ts`.
import { modoTrocasConcorrente } from '@/lib/youtube/teste-youtube/observados/flag'
import {
  estadoMiniatura, estadoTitulo, FRESCOR_MS, lerCursor, lerLinha,
  type CursorLido, type EstadoMiniatura, type EstadoTitulo, type LinhaLida, type Motivo,
} from '@/lib/youtube/teste-youtube/observados/estado-de-leitura'
import { NOTA_PASSAGENS, textoMiniatura, textoTitulo } from '@/lib/youtube/teste-youtube/observados/textos'
import { err, ok, type ServiceContext, type ServiceResult } from './types'

type Linha = Record<string, unknown>

export interface ItemLeitura {
  canal: string
  canal_id: string
  video_id: string
  titulo_video: string | null
  campo: 'titulo' | 'miniatura'
  estado: string
  texto: string
  visto_ate: string | null
  /** Só no alvo que já saiu da observação (`estado = 'fora_da_janela'`). */
  fora_da_observacao?: true
  /** Estado base que a sonda viu por último, só no item fora da observação. */
  ultimo?: string
}
export interface ContagemTitulo { em_andamento: number; sumindo: number; provavelmente_terminou: number; troca: number; sem_troca_vista: number; nao_medido: number }
export interface ContagemMiniatura { troca: number; indeterminada: number; sem_troca_vista: number; nao_medido: number }
export type RespostaLeitura =
  | { ligada: false; motivo: 'flag_off'; resumo: 'Leitura de concorrentes desligada' }
  | {
      ligada: true
      resumo: string
      resumo_miniatura: string
      nota: string
      contagem: { titulo: ContagemTitulo; nao_medido_por_motivo: Record<string, number>; miniatura: ContagemMiniatura }
      fora_da_janela: number
      itens: ItemLeitura[]
      janela_dias: 14
    }

const JANELA_DIAS = 14
const DIA_MS = 86_400_000
const PAGINA = 1000
const MAX_PAGINAS = 60
const LOTE = 100
const MOTIVOS: readonly Motivo[] = ['flag_off', 'aprendendo', 'sem_leitura', 'sem_publicacao', 'saiu', 'regra']
const ROTULO_MOTIVO: Record<Motivo, string> = {
  flag_off: 'desligada', aprendendo: 'aprendendo', sem_leitura: 'sem leitura', sem_publicacao: 'sem publicação', saiu: 'saiu', regra: 'inconclusiva',
}

const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const inteiro = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

interface Resp { data: unknown; error: unknown; count: number | null }
type Montar = () => { range: (a: number, b: number) => PromiseLike<Resp> }

function falhou(onde: string): never {
  return err('DB_ERROR', `Falha ao ler ${onde}`, 500)
}

/** Páginas de 1000 com ordem estável (quem monta ordena). Erro de página lança; nunca devolve lista parcial. */
async function paginado(onde: string, montar: Montar): Promise<Linha[]> {
  const out: Linha[] = []
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const r = await montar().range(p * PAGINA, p * PAGINA + PAGINA - 1)
    if (r.error || !Array.isArray(r.data)) return falhou(onde)
    out.push(...(r.data as Linha[]))
    if (r.data.length < PAGINA) return out
  }
  return falhou(onde)
}

function lotes<T>(xs: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += LOTE) out.push(xs.slice(i, i + LOTE))
  return out
}

// ───────────────────────── Texto do resumo (concordância; D-P5) ─────────────────────────

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

export function textoResumo(c: { n: number; x: number; y: number; z: number; w: number; motivos: Record<string, number>; fora: number }): string {
  const motivos = MOTIVOS.filter(m => (c.motivos[m] ?? 0) > 0).map(m => `${ROTULO_MOTIVO[m]} ${c.motivos[m]}`).join(', ')
  const partes = [
    plural(c.n, 'vídeo de concorrentes observado', 'vídeos de concorrentes observados'),
  ]
  const tail = [
    `${c.x} com possível teste em andamento`,
    plural(c.y, 'provavelmente terminado', 'provavelmente terminados'),
    plural(c.z, 'troca', 'trocas'),
    plural(c.w, 'não medido', 'não medidos') + (c.w > 0 && motivos ? ` (${motivos})` : ''),
  ]
  const fora = c.fora > 0 ? `, mais ${c.fora} que ${c.fora === 1 ? 'já saiu' : 'já saíram'} da observação` : ''
  return `${partes[0]}: ${tail.join(', ')}${fora}`
}
export const textoResumoMiniatura = (z: number, k: number): string =>
  `Miniatura: ${plural(z, 'troca', 'trocas')}, ${k} alternando sem dar para afirmar troca.`

// ───────────────────────── Serviço ─────────────────────────

interface AlvoRow { videoId: string; rodadas: number; ultimaRodadaEm: string | null; saiuEm: string | null; saiuPor: string | null }
interface VideoRow { titulo: string | null; publicadoEm: string | null; canalId: string }

export async function lerLeituraDosConcorrentes(
  ctx: ServiceContext,
  o: { agoraMs: number; env?: NodeJS.ProcessEnv },
): Promise<ServiceResult<RespostaLeitura>> {
  if (modoTrocasConcorrente(o.env) !== 'on') return ok({ ligada: false, motivo: 'flag_off', resumo: 'Leitura de concorrentes desligada' })
  const { siteId, supabase: sb } = ctx
  const corteForaMs = o.agoraMs - JANELA_DIAS * DIA_MS

  const alvosBrutos = await paginado('os alvos', () => sb.from('yt_watch_alvos')
    .select('youtube_video_id,rodadas,ultima_rodada_em,saiu_em,saiu_por', { count: 'exact' })
    .eq('site_id', siteId).eq('tipo', 'concorrente').order('id', { ascending: true }))
  const todos: AlvoRow[] = alvosBrutos.flatMap(a => {
    const videoId = texto(a.youtube_video_id), rodadas = inteiro(a.rodadas)
    return videoId && rodadas !== null ? [{ videoId, rodadas, ultimaRodadaEm: texto(a.ultima_rodada_em), saiuEm: texto(a.saiu_em), saiuPor: texto(a.saiu_por) }] : []
  })
  // N = alvos que não saíram; os que saíram pela janela nos últimos 14 dias só informam "fora da observação"
  const ativos = todos.filter(a => a.saiuEm === null)
  const fora = todos.filter(a => a.saiuEm !== null && a.saiuPor === 'janela' && Date.parse(a.saiuEm) >= corteForaMs)
  const lidos = [...ativos, ...fora]
  const ids = [...new Set(lidos.map(a => a.videoId))].sort()

  const canaisBrutos = await paginado('os canais', () => sb.from('competitor_channels')
    .select('id,channel_name,removal_requested_at', { count: 'exact' }).eq('site_id', siteId).order('id', { ascending: true }))
  const canais = new Map<string, { nome: string; removido: boolean }>()
  for (const k of canaisBrutos) {
    const id = texto(k.id)
    if (id) canais.set(id, { nome: texto(k.channel_name) ?? '', removido: k.removal_requested_at != null })
  }

  const videos = new Map<string, VideoRow>()
  for (const lote of lotes(ids)) {
    const rs = await paginado('os vídeos', () => sb.from('competitor_videos')
      .select('video_id,title,published_at,competitor_channel_id', { count: 'exact' }).in('video_id', lote)
      .order('video_id', { ascending: true }).order('competitor_channel_id', { ascending: true }))
    for (const v of rs) {
      const id = texto(v.video_id), canalId = texto(v.competitor_channel_id)
      if (!id || !canalId || !canais.has(canalId)) continue
      const pub = texto(v.published_at)
      const atual = videos.get(id)
      if (!atual) videos.set(id, { titulo: texto(v.title), publicadoEm: pub, canalId })
      else if (pub !== null && (atual.publicadoEm === null || Date.parse(pub) < Date.parse(atual.publicadoEm))) atual.publicadoEm = pub
    }
  }

  const cursores = new Map<string, CursorLido>()
  const porCampo = { titulo: new Map<string, LinhaLida>(), miniatura: new Map<string, LinhaLida>() }
  for (const lote of lotes(ids)) {
    const cs = await paginado('os cursores', () => sb.from('ab_native_obs_cursor')
      .select('youtube_video_id,avaliado_ate_rodada,avaliado_em,avaliado_motivo,validas_titulo,validas_miniatura', { count: 'exact' })
      .eq('site_id', siteId).in('youtube_video_id', lote).order('youtube_video_id', { ascending: true }))
    for (const k of cs) {
      const id = texto(k.youtube_video_id), c = lerCursor(k)
      if (id && c) cursores.set(id, c)
    }
    const ls = await paginado('as linhas', () => sb.from('ab_native_observados')
      .select('youtube_video_id,campo,veredito,ficou_estado,tipo_troca,versao_regra,motivo,ultima_atualizacao_em,ficou,trocas', { count: 'exact' })
      .eq('site_id', siteId).in('youtube_video_id', lote).gte('versao_regra', 2)
      .order('youtube_video_id', { ascending: true }).order('campo', { ascending: true }))
    for (const k of ls) {
      const id = texto(k.youtube_video_id), l = lerLinha(k)
      if (id && l && (k.campo === 'titulo' || k.campo === 'miniatura')) porCampo[k.campo].set(id, l)
    }
  }

  const contTitulo: ContagemTitulo = { em_andamento: 0, sumindo: 0, provavelmente_terminou: 0, troca: 0, sem_troca_vista: 0, nao_medido: 0 }
  const contMini: ContagemMiniatura = { troca: 0, indeterminada: 0, sem_troca_vista: 0, nao_medido: 0 }
  const motivos: Record<string, number> = {}
  const itensN: ItemLeitura[] = []
  const itensFora: ItemLeitura[] = []
  const opcoes = { agoraMs: o.agoraMs, trocaConferida: false }
  let n = 0
  let foraContados = 0

  for (const a of lidos) {
    const v = videos.get(a.videoId)
    const canal = v ? canais.get(v.canalId) : undefined
    if (canal?.removido) continue // canal com remoção pedida: fora da resposta e de N
    const ehFora = a.saiuEm !== null
    const cursor = cursores.get(a.videoId) ?? null
    const semPublicacao = !v || v.publicadoEm === null
    const entrada = (campo: 'titulo' | 'miniatura') => ({
      flagLigada: true,
      alvo: { rodadas: a.rodadas, ultimaRodadaEm: a.ultimaRodadaEm, saiuPor: a.saiuPor, publicadoEm: v?.publicadoEm ?? null },
      cursor,
      linhas: { titulo: campo === 'titulo' ? (porCampo.titulo.get(a.videoId) ?? null) : null, miniatura: campo === 'miniatura' ? (porCampo.miniatura.get(a.videoId) ?? null) : null },
      agoraMs: o.agoraMs,
      frescorMs: FRESCOR_MS,
    })
    const vistoAte = a.ultimaRodadaEm ?? cursor?.avaliadoEm ?? null
    const dentro = (iso: string | null): boolean => iso !== null && Date.parse(iso) >= corteForaMs
    const base = { canal: canal?.nome ?? '', canal_id: v?.canalId ?? '', video_id: a.videoId, titulo_video: v?.titulo ?? null }

    const et: EstadoTitulo = semPublicacao && !ehFora ? { estado: 'nao_medido', motivo: 'sem_publicacao' } : estadoTitulo(entrada('titulo'))
    const em: EstadoMiniatura = semPublicacao && !ehFora ? { estado: 'nao_medido', motivo: 'sem_publicacao' } : estadoMiniatura(entrada('miniatura'))

    if (ehFora) {
      foraContados++
      if (et.estado === 'fora_da_janela' && et.ultimo && dentro(et.vistoAte || null)) {
        const nome = et.ultimo.estado === 'em_andamento' && et.ultimo.sumindo ? 'sumindo' : et.ultimo.estado
        if (nome !== 'sem_troca_vista') itensFora.push({ ...base, campo: 'titulo', estado: 'fora_da_janela', fora_da_observacao: true, ultimo: nome, texto: textoTitulo(et, opcoes), visto_ate: et.vistoAte })
      }
      if (em.estado === 'fora_da_janela' && em.ultimo && dentro(em.vistoAte || null)) {
        if (em.ultimo.estado !== 'sem_troca_vista') itensFora.push({ ...base, campo: 'miniatura', estado: 'fora_da_janela', fora_da_observacao: true, ultimo: em.ultimo.estado, texto: textoMiniatura(em, opcoes), visto_ate: em.vistoAte })
      }
      continue
    }

    n++
    // título
    let tituloNome: keyof ContagemTitulo
    if (et.estado === 'em_andamento') tituloNome = et.sumindo ? 'sumindo' : 'em_andamento'
    else if (et.estado === 'provavelmente_terminou' || et.estado === 'troca' || et.estado === 'sem_troca_vista') tituloNome = et.estado
    else tituloNome = 'nao_medido'
    contTitulo[tituloNome]++
    if (et.estado === 'nao_medido') motivos[et.motivo] = (motivos[et.motivo] ?? 0) + 1
    else if (et.estado === 'fora_da_janela') motivos.saiu = (motivos.saiu ?? 0) + 1
    if (tituloNome !== 'sem_troca_vista' && tituloNome !== 'nao_medido') {
      const visto = et.estado === 'troca' ? et.vistoAte : vistoAte
      if (dentro(visto)) itensN.push({ ...base, campo: 'titulo', estado: tituloNome, texto: textoTitulo(et, opcoes), visto_ate: visto })
    }
    // miniatura
    if (em.estado === 'troca' || em.estado === 'indeterminada' || em.estado === 'sem_troca_vista') contMini[em.estado]++
    else contMini.nao_medido++
    if (em.estado === 'troca' || em.estado === 'indeterminada') {
      const visto = em.estado === 'troca' ? em.vistoAte : vistoAte
      if (dentro(visto)) itensN.push({ ...base, campo: 'miniatura', estado: em.estado, texto: textoMiniatura(em, opcoes), visto_ate: visto })
    }
  }

  const rank = (i: ItemLeitura): number => (i.estado === 'em_andamento' || i.estado === 'sumindo' ? 0 : 1)
  const maisRecente = (a: ItemLeitura, b: ItemLeitura): number => Date.parse(b.visto_ate ?? '') - Date.parse(a.visto_ate ?? '')
  itensN.sort((a, b) => rank(a) - rank(b) || maisRecente(a, b))
  itensFora.sort(maisRecente)

  return ok({
    ligada: true,
    resumo: textoResumo({
      n, x: contTitulo.em_andamento + contTitulo.sumindo, y: contTitulo.provavelmente_terminou, z: contTitulo.troca, w: contTitulo.nao_medido, motivos, fora: foraContados,
    }),
    resumo_miniatura: textoResumoMiniatura(contMini.troca, contMini.indeterminada),
    nota: NOTA_PASSAGENS,
    contagem: { titulo: contTitulo, nao_medido_por_motivo: motivos, miniatura: contMini },
    fora_da_janela: foraContados,
    itens: [...itensN, ...itensFora],
    janela_dias: JANELA_DIAS,
  })
}
