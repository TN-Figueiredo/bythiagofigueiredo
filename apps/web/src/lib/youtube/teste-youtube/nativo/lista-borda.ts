// Borda da lista "Vídeos do A/B Lab" (F1a-tela-1, T3): lê o banco em lote e monta as linhas. Só leitura.
// Consultas (teto de 7): youtube_videos, ab_native_fichas, ab_native_tests, ab_tests, RPC de volume, RPC de formato
// (+ a leitura de duração que `lerFormatos` faz só quando algum `is_short` ficou nulo). Os vídeos de ficha e de registro
// vêm embutidos nas próprias consultas (FK), sem uma consulta extra por tabela. Nunca uma consulta por vídeo.
import type { SupabaseClient } from '@supabase/supabase-js'
import { diaDoTeste } from '@/lib/youtube/ab-dia-do-teste'
import { derivarFicha, type FichaLida, type FichaLinha } from './ficha'
import { lerFormatos, type Formato } from './formato-borda'
import { inicioDoTeste } from './guarda'
import { estadoDaLinha, retomarAPartirDe, type LinhaDoCaminho, type RegistroDaLista } from './lista'
import type { RespostaDono } from './resposta'
import { caminhoDoTeste } from './roteador'
import { lerVolumes, volumeDoVideo, type VolumeLido } from './volume'

export const LIMITE_RECENTES = 20
/** Lê mais que 20 porque os privados saem depois da RPC de volume, que traz `publico`. */
const RECENTES_LIDOS = 60
const DIA_MS = 86_400_000
/** Registro confirmado e fechado entra na lista por 30 dias. */
const JANELA_FECHADOS_DIAS = 30
/** A lista mede o volume com 2 versões (a ficha usa o k real). */
const K_DA_LISTA = 2

interface VideoLido { id: string; youtube_video_id: string; title: string; thumbnail_url: string | null; published_at: string }
const COLUNAS_VIDEO = 'id, youtube_video_id, title, thumbnail_url, published_at'

const obj = (x: unknown): Record<string, unknown> | null =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null
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

function registroDaLista(r: LinhaTeste): RegistroDaLista {
  const estado = ESTADOS.has(String(r.estado)) ? (r.estado as RegistroDaLista['estado']) : 'descartado'
  const resposta = RESPOSTAS.has(String(r.resposta_dono)) ? (str(r.resposta_dono) as RegistroDaLista['respostaDono']) : null
  const variantes = variantesDe(r.variantes)
  const derivados = titulosDe(r.variantes_titulo)
  const n = typeof r.variante_vencedora === 'number' ? r.variante_vencedora : null
  const tituloDaResposta = n === null ? null
    : variantes ? (variantes.find((v) => v.n === n)?.titulo ?? null)
    : (derivados?.[n - 1] ?? null)
  const fonte = str(r.vencedor_fonte)
  return {
    estado, confirmadoEm: str(r.confirmado_em), primeiraVista: str(r.primeira_vista), createdAt: String(r.created_at), respostaDono: resposta,
    vencedorFonte: fonte === 'regra' || fonte === 'dono' || fonte === 'data_api' ? fonte : null,
    vencedorTitulo: str(r.vencedor_titulo), tituloDaResposta,
  }
}

export async function lerLinhasDoCaminho(sb: SupabaseClient, siteId: string, agora: Date): Promise<LinhaDoCaminho[]> {
  const iso30 = new Date(agora.getTime() - JANELA_FECHADOS_DIAS * DIA_MS).toISOString()
  const colunasFicha = `id, site_id, video_id, campos, variantes, criada_em, criada_por, atualizada_em, studio_aberto_em, lembrar_em, descartada_em, registro_id, video:youtube_videos(${COLUNAS_VIDEO})`
  const colunasTeste = `id, video_id, estado, confirmado_em, primeira_vista, created_at, updated_at, resposta_dono, variantes, variantes_titulo, campos, vencedor_fonte, vencedor_titulo, variante_vencedora, video:youtube_videos(${COLUNAS_VIDEO})`

  const [recentes, fichasBrutas, testesBrutos, nossosBrutos] = await Promise.all([
    ler<unknown>('youtube_videos', sb.from('youtube_videos').select(COLUNAS_VIDEO)
      .eq('site_id', siteId).lte('published_at', agora.toISOString()).order('published_at', { ascending: false }).limit(RECENTES_LIDOS)),
    ler<unknown>('ab_native_fichas', sb.from('ab_native_fichas').select(colunasFicha)
      .eq('site_id', siteId).is('registro_id', null).is('descartada_em', null)),
    ler<unknown>('ab_native_tests', sb.from('ab_native_tests').select(colunasTeste)
      .eq('site_id', siteId).or(`estado.eq.em_andamento,and(confirmado_em.not.is.null,encerrado_em.gte.${iso30})`)),
    ler<unknown>('ab_tests', sb.from('ab_tests').select('id, youtube_video_id, status, started_at, restore_seq')
      .eq('site_id', siteId).in('status', ['active', 'paused'])),
  ])

  const videos = new Map<string, VideoLido>()
  const extras: VideoLido[] = []
  const fichas = new Map<string, FichaLida>()
  for (const f of fichasBrutas) {
    const o = obj(f)
    if (!o || typeof o.video_id !== 'string') continue
    const v = videoEmbutido(o.video)
    if (v) extras.push(v)
    const { video: _video, ...linha } = o
    fichas.set(o.video_id, derivarFicha(linha as unknown as FichaLinha, agora))
  }
  const testes = new Map<string, LinhaTeste>()
  for (const t of testesBrutos) {
    if (!ehLinhaTeste(t)) continue
    testes.set(t.video_id, melhorRegistro(testes.get(t.video_id), t))
  }
  for (const t of testes.values()) { const v = videoEmbutido(t.video); if (v) extras.push(v) }

  const recentesLidos = recentes.map(comoVideo).filter((v): v is VideoLido => v !== null)
  const todos = new Map<string, VideoLido>()
  for (const v of [...recentesLidos, ...extras]) todos.set(v.id, v)

  const volumes = await lerVolumes(sb, siteId, [...todos.keys()])
  // Privado fica fora dos recentes (publico === false); desconhecido (nunca capturado) fica.
  const publicos = recentesLidos.filter((v) => volumes.get(v.id)?.publico !== false).slice(0, LIMITE_RECENTES)
  for (const v of [...publicos, ...extras]) videos.set(v.id, v)

  const lista = [...videos.values()]
  const formatos = await lerFormatos(sb, siteId, lista.map((v) => ({ id: v.id, ytId: v.youtube_video_id })))

  const nossos = new Map<string, { testId: string; restoreSeq: number; dia: number; status: 'active' | 'paused' }>()
  for (const n of nossosBrutos) {
    const o = obj(n)
    if (!o || typeof o.youtube_video_id !== 'string' || typeof o.id !== 'string') continue
    nossos.set(o.youtube_video_id, {
      testId: o.id, restoreSeq: typeof o.restore_seq === 'number' ? o.restore_seq : 0,
      dia: diaDoTeste(str(o.started_at), null, agora) ?? 0, status: o.status === 'paused' ? 'paused' : 'active',
    })
  }

  const semFormato: Formato = { isShort: null, kids: null, adulto: null, aoVivo: null }
  return lista.map((v): LinhaDoCaminho => {
    const vol: VolumeLido | undefined = volumes.get(v.id)
    const volume = volumeDoVideo(vol ? { soma: vol.soma, diasCobertos: vol.diasCobertos } : null, K_DA_LISTA)
    const idadeDias = Math.max(0, Math.floor((agora.getTime() - Date.parse(v.published_at)) / DIA_MS))
    const caminho = caminhoDoTeste({ formato: formatos.get(v.id) ?? semFormato, idadeDias, impressoesAcimaDoPiso: volume.acimaDoPiso })
    const ficha = fichas.get(v.id) ?? null
    const nosso = nossos.get(v.id) ?? null
    const bruto = testes.get(v.id)
    const registro = bruto ? registroDaLista(bruto) : null
    const estado = estadoDaLinha({ caminho, ficha, registro, nosso }, agora)

    let linhaRegistro: LinhaDoCaminho['registro'] = null
    let labPausadoAte: string | null = null
    if (bruto && registro) {
      const inicio = inicioDoTeste({ primeira_vista: registro.primeiraVista, confirmado_em: registro.confirmadoEm, created_at: registro.createdAt })
      linhaRegistro = {
        id: bruto.id, updatedAt: String(bruto.updated_at), confirmadoEm: registro.confirmadoEm, primeiraVista: registro.primeiraVista,
        diaDe14: diaDoTeste(inicio.toISOString(), null, agora) ?? 0,
        variantes: variantesDe(bruto.variantes), variantesTitulo: titulosDe(bruto.variantes_titulo), campos: camposDe(bruto.campos),
        respostaDono: registro.respostaDono === 'sem_resposta' ? null : registro.respostaDono as RespostaDono | null,
      }
      if (registro.estado === 'em_andamento' && nosso?.status === 'paused') labPausadoAte = retomarAPartirDe(registro).toISOString()
    }
    return {
      videoId: v.id, ytId: v.youtube_video_id, titulo: v.title, miniaturaUrl: v.thumbnail_url, publicadoEm: v.published_at,
      estado, caminho, fichaId: ficha?.id ?? null, registro: linhaRegistro, labPausadoAte, nosso, impressoesPorDia: volume.porDia,
    }
  })
}
