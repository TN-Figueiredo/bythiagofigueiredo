import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { edicaoValida, type EdicaoDoSite } from '../proprio/edicao'
import { lerVideosDoCanal } from './ler'
import type { InsumoDeComentariosDoVideo, ParteDeComentarios } from './do-canal'
import type { StatusDoRetrato } from './comentarios'

/**
 * New (A5, E4, Tarefa 15): os insumos de M11 e M12 (comentários de destaque). Dado do dono: só com o token de edição do site
 * (`EdicaoDoSite`, que só nasce depois da guarda). O site é o de DENTRO do token, nunca um parâmetro. Nenhuma coluna de texto nem de
 * autor é pedida: só `video_id`, `mark`, `status`, `taken_at`, `parent_id`, `creator_replied` e `likes`.
 * Qualquer das consultas falhar torna a parte inteira não lida: não se monta M11 com metade. Nunca lança.
 */
const PAGINA = 1000
const MAX_PAGINAS = 50
const BLOCO = 150
const SCHEMA_AUSENTE = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])
const STATUS: readonly StatusDoRetrato[] = ['ok', 'sem_comentarios', 'desligados', 'erro']

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
type Falha = { lido: false; causa: 'schema_ausente' | 'erro_do_banco' | 'cortado' }
type Pag = { ok: true; linhas: Obj[] } | { ok: false; falha: Falha }

async function paginar(pedir: (de: number, ate: number) => PromiseLike<{ data: unknown; error: unknown }>, maxPaginas: number): Promise<Pag> {
  const linhas: Obj[] = []
  try {
    for (let p = 0; p < maxPaginas; p++) {
      const r = await pedir(p * PAGINA, p * PAGINA + PAGINA - 1)
      if (r.error !== null && r.error !== undefined) {
        const ausente = ehObj(r.error) && typeof r.error.code === 'string' && SCHEMA_AUSENTE.has(r.error.code)
        return { ok: false, falha: { lido: false, causa: ausente ? 'schema_ausente' : 'erro_do_banco' } }
      }
      if (!Array.isArray(r.data)) return { ok: false, falha: { lido: false, causa: 'erro_do_banco' } }
      for (const x of r.data) if (ehObj(x)) linhas.push(x)
      if (r.data.length < PAGINA) return { ok: true, linhas }
    }
    return { ok: false, falha: { lido: false, causa: 'cortado' } }
  } catch {
    return { ok: false, falha: { lido: false, causa: 'erro_do_banco' } }
  }
}

function blocos<T>(xs: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += BLOCO) out.push(xs.slice(i, i + BLOCO))
  return out
}
const statusDe = (v: unknown): StatusDoRetrato | null => STATUS.find((s) => s === v) ?? null

export async function lerInsumosDeComentarios(
  sb: SupabaseClient,
  edicao: EdicaoDoSite,
  o: { channelId: string; videoIds: readonly string[]; maxPaginas?: number },
): Promise<ParteDeComentarios> {
  // Sem o token não há consulta nenhuma: o objeto forjado não passa no brand check.
  if (!edicaoValida(edicao)) return { lido: false, causa: 'sem_permissao' }
  const siteId = edicao.siteId
  const max = o.maxPaginas ?? MAX_PAGINAS
  try {
    // O canal (com o filtro de site) e os ids dos vídeos dele: o cruzamento impede ler comentário de vídeo alheio.
    const vs = await lerVideosDoCanal(sb, { siteId, channelId: o.channelId, maxPaginas: max })
    if (!vs.lido) return { lido: false, causa: vs.causa }
    const doCanal = new Set(vs.dados.map((v) => v.id))
    const meus = o.videoIds.filter((id) => doCanal.has(id))

    // Desde quando o canal é coletado: o retrato mais antigo dele.
    const primeiro = await paginar((de, ate) => sb.from('competitor_video_comment_snaps').select('taken_at')
      .eq('site_id', siteId).eq('competitor_channel_id', o.channelId).order('taken_at').range(de, Math.min(ate, de)), 1)
    if (!primeiro.ok) return primeiro.falha
    const t0 = primeiro.linhas[0]?.taken_at
    const coletaDesdeMs = typeof t0 === 'string' && !Number.isNaN(Date.parse(t0)) ? Date.parse(t0) : null

    const porVideo = new Map<string, InsumoDeComentariosDoVideo>()
    const entrada = (id: string): InsumoDeComentariosDoVideo => {
      const atual = porVideo.get(id)
      if (atual) return atual
      const novo: InsumoDeComentariosDoVideo = { retrato7: null, retrato30: null, algumComRespostaDoCriador: false, maiorCurtidas7: null, maiorCurtidas30: null }
      porVideo.set(id, novo)
      return novo
    }
    const donoDoComentario = new Map<number, string>()

    for (const bloco of blocos(meus)) {
      const snaps = await paginar((de, ate) => sb.from('competitor_video_comment_snaps').select('video_id, mark, status, taken_at')
        .eq('site_id', siteId).in('video_id', bloco).order('video_id').range(de, ate), max)
      if (!snaps.ok) return snaps.falha
      for (const s of snaps.linhas) {
        if (typeof s.video_id !== 'string') continue
        const e = entrada(s.video_id)
        if (s.mark === 7) e.retrato7 = statusDe(s.status)
        else if (s.mark === 30) e.retrato30 = statusDe(s.status)
      }
      const cs = await paginar((de, ate) => sb.from('competitor_video_comments').select('id, video_id, parent_id, creator_replied')
        .eq('site_id', siteId).in('video_id', bloco).order('id').range(de, ate), max)
      if (!cs.ok) return cs.falha
      const topo: number[] = []
      for (const c of cs.linhas) {
        if (typeof c.id !== 'number' || typeof c.video_id !== 'string' || c.parent_id !== null) continue
        donoDoComentario.set(c.id, c.video_id)
        topo.push(c.id)
        if (c.creator_replied === true) entrada(c.video_id).algumComRespostaDoCriador = true
        else entrada(c.video_id)
      }
      // As curtidas de comentário de topo, por marco. `competitor_video_comment_marks` não tem `video_id`: o filtro é pelo id do comentário.
      for (const ids of blocos(topo)) {
        const ms = await paginar((de, ate) => sb.from('competitor_video_comment_marks').select('comment_id, mark, likes')
          .eq('site_id', siteId).in('comment_id', ids).order('comment_id').range(de, ate), max)
        if (!ms.ok) return ms.falha
        for (const m of ms.linhas) {
          const video = typeof m.comment_id === 'number' ? donoDoComentario.get(m.comment_id) : undefined
          if (video === undefined || typeof m.likes !== 'number' || !Number.isFinite(m.likes)) continue
          const e = entrada(video)
          if (m.mark === 7) e.maiorCurtidas7 = Math.max(e.maiorCurtidas7 ?? 0, m.likes)
          else if (m.mark === 30) e.maiorCurtidas30 = Math.max(e.maiorCurtidas30 ?? 0, m.likes)
        }
      }
    }
    return { lido: true, dados: { coletaDesdeMs, porVideo } }
  } catch {
    return { lido: false, causa: 'erro_do_banco' }
  }
}
