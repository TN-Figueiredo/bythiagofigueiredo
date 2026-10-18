/**
 * Extensão da coleta (A5 S4, Tarefa 12): para o alvo perto do corte (ou já estendido), lê TODAS as leituras dele na janela
 * (paginadas por `range` com `count` conferido: o PostgREST corta em 1.000 linhas sem erro), chama a detecção da S3 com
 * `try/catch` por vídeo e estende a coleta. A saída por janela só vale para quem foi avaliado.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRec } from '@/lib/youtube/competitor-capture'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube'
import type { LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import type { AlvoAtivo } from './alvos'
import { leiturasDoBanco, type LinhaLeituraBanco, type LinhaThumbBanco } from './expansor'
import type { AtualizacaoAlvo } from './gravar'
import type { ResultadoLeitor } from './leitor'
import { RODADA, estenderColeta } from './rodada'

const PAGINA = 1000
const MAX_PAGINAS = 20
const DIA_MS = 86_400_000
const HORA_MS = 3_600_000

const COLUNAS_LEITURA = 'site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, erro, idioma, titulo_oficial, titulo_oficial_fonte, titulo_exibido, renderers_presentes, titulos_divergentes, rendicoes_sqp, jogador_bloqueado, miniatura_id'
const COLUNAS_THUMB = 'id, site_id, youtube_video_id, host, variante, http, etag, sha16, dhash, largura, altura'

const textoOuNulo = (x: unknown): x is string | null => x === null || typeof x === 'string'
const numOuNulo = (x: unknown): x is number | null => x === null || typeof x === 'number'

function eLinhaLeitura(x: unknown): x is LinhaLeituraBanco {
  return isRec(x) && typeof x.site_id === 'string' && typeof x.youtube_video_id === 'string' && typeof x.lida_em === 'string'
    && typeof x.rodada_id === 'string' && (x.origem_rede === 'vercel' || x.origem_rede === 'forja' || x.origem_rede === 'mac-casa')
    && typeof x.versao_leitor === 'number' && numOuNulo(x.http) && textoOuNulo(x.erro) && textoOuNulo(x.idioma)
    && textoOuNulo(x.titulo_oficial) && (x.titulo_oficial_fonte === null || x.titulo_oficial_fonte === 'videoDetails' || x.titulo_oficial_fonte === 'og_title')
    && textoOuNulo(x.titulo_exibido) && typeof x.renderers_presentes === 'number'
    && (x.titulos_divergentes === null || (Array.isArray(x.titulos_divergentes) && x.titulos_divergentes.every(t => isRec(t) && typeof t.renderer === 'string' && textoOuNulo(t.texto))))
    && numOuNulo(x.rendicoes_sqp) && typeof x.jogador_bloqueado === 'boolean' && numOuNulo(x.miniatura_id)
}
const eLinhaThumb = (x: unknown): x is LinhaThumbBanco =>
  isRec(x) && typeof x.id === 'number' && typeof x.site_id === 'string' && typeof x.youtube_video_id === 'string' && typeof x.host === 'string'
  && typeof x.variante === 'string' && numOuNulo(x.http) && textoOuNulo(x.etag) && textoOuNulo(x.sha16) && textoOuNulo(x.dhash)
  && numOuNulo(x.largura) && numOuNulo(x.altura)

interface Resposta { data: unknown; error: unknown; count?: number | null }

/** Lê tudo, página a página. `null` = não deu para confiar (erro, forma, ou soma diferente do `count`). */
async function lerTudo<T>(pagina: (de: number, ate: number) => PromiseLike<Resposta>, guarda: (x: unknown) => x is T, conferirCount: boolean): Promise<T[] | null> {
  const out: T[] = []
  let total: number | null = null
  for (let p = 0; p < MAX_PAGINAS; p++) {
    let r: Resposta
    try { r = await pagina(p * PAGINA, p * PAGINA + PAGINA - 1) } catch { return null }
    if (r.error || !Array.isArray(r.data) || !r.data.every(guarda)) return null
    if (conferirCount) {
      if (typeof r.count !== 'number') return null
      total = r.count
    }
    out.push(...r.data)
    if (r.data.length < PAGINA || (total !== null && out.length >= total)) break
    if (p === MAX_PAGINAS - 1) return null
  }
  if (total !== null && out.length !== total) return null
  return out
}

async function leiturasDoVideo(sb: SupabaseClient, a: AlvoAtivo): Promise<LeituraWatch[] | null> {
  const desde = new Date(Date.parse(a.coletaAte) - 30 * DIA_MS).toISOString()
  const linhas = await lerTudo<LinhaLeituraBanco>(
    (de, ate) => sb.from('yt_watch_readings').select(COLUNAS_LEITURA, { count: 'exact' }).eq('site_id', a.siteId).eq('youtube_video_id', a.ytId)
      .gte('lida_em', desde).order('lida_em').order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
    eLinhaLeitura, true,
  )
  if (linhas === null) return null
  let thumbs: LinhaThumbBanco[] = []
  if (linhas.some(l => l.miniatura_id !== null)) {
    const t = await lerTudo<LinhaThumbBanco>(
      (de, ate) => sb.from('yt_watch_thumbs').select(COLUNAS_THUMB).eq('site_id', a.siteId).eq('youtube_video_id', a.ytId)
        .order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaThumb, false,
    )
    if (t === null) return null
    thumbs = t
  }
  return leiturasDoBanco(linhas, thumbs).validas
}

export interface ResultadoExtensao { atualizacoes: Map<number, Partial<AtualizacaoAlvo>>; avaliados: Set<number>; falharam: number }
export interface DepsExtensao { detectar?: typeof detectarTesteYoutube; relogio?: () => number }

export async function avaliarExtensoes(
  sb: SupabaseClient,
  alvos: readonly AlvoAtivo[],
  novas: ReadonlyMap<number, readonly ResultadoLeitor[]>,
  agoraMs: number,
  ateMs: number,
  deps: DepsExtensao = {},
): Promise<ResultadoExtensao> {
  const detectar = deps.detectar ?? detectarTesteYoutube
  const relogio = deps.relogio ?? Date.now
  const atualizacoes = new Map<number, Partial<AtualizacaoAlvo>>()
  const avaliados = new Set<number>()
  let falharam = 0

  const elegiveis = alvos
    .filter(a => (novas.get(a.id)?.length ?? 0) > 0)
    .filter(a => Date.parse(a.coletaAte) - agoraMs < 48 * HORA_MS || a.motivoAte === 'extensao' || a.motivoAte === 'extensao_curta')
    .sort((x, y) => Date.parse(x.coletaAte) - Date.parse(y.coletaAte))
    .slice(0, RODADA.extensaoMaxVideos)

  await Promise.all(elegiveis.map(async a => {
    if (relogio() >= ateMs) return
    const doBanco = await leiturasDoVideo(sb, a)
    if (doBanco === null) { falharam++; return }
    const juntas = [...doBanco, ...(novas.get(a.id) ?? []).map(r => r.leitura)]
    try {
      const v = detectar(juntas)
      avaliados.add(a.id)
      const provavel = v.estado === 'provavel_teste'
      const e = estenderColeta(
        { coletaAte: a.coletaAte, extensoesCurtas: a.extensoesCurtas },
        { provavel, rodadasMistasTitulo: v.contagem.rodadasMistasTitulo, ultimaVista: v.estado === 'provavel_teste' ? v.ultimaVista : null },
        agoraMs,
      )
      if (e !== null) {
        atualizacoes.set(a.id, {
          coleta_ate: e.coletaAte, motivo_ate: e.motivoAte, extensoes_curtas: e.extensoesCurtas,
          ...(e.reterAte !== null ? { reter_ate: e.reterAte } : {}),
        })
      }
    } catch {
      falharam++
    }
  }))
  return { atualizacoes, avaliados, falharam }
}

/** Sai por janela só quem foi avaliado e cuja coleta (já estendida) venceu. */
export function saidasPorJanela(alvos: readonly AlvoAtivo[], ext: ResultadoExtensao, agoraMs: number): AtualizacaoAlvo[] {
  const out: AtualizacaoAlvo[] = []
  for (const a of alvos) {
    if (!ext.avaliados.has(a.id)) continue
    const coleta = Date.parse(ext.atualizacoes.get(a.id)?.coleta_ate ?? a.coletaAte)
    if (agoraMs > coleta) out.push({ id: a.id, saiu_em: new Date(agoraMs).toISOString(), saiu_por: 'janela' })
  }
  return out
}

/** Junta as atualizações por id (a última vence campo a campo). */
export function juntarAtualizacoes(...listas: ReadonlyArray<ReadonlyArray<Partial<AtualizacaoAlvo> & { id: number }>>): AtualizacaoAlvo[] {
  const por = new Map<number, AtualizacaoAlvo>()
  for (const l of listas) for (const u of l) por.set(u.id, { ...(por.get(u.id) ?? {}), ...u })
  return [...por.values()]
}
