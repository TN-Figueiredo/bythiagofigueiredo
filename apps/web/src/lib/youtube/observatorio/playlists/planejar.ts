// A5, X3: quem é devido hoje. PURO: recebe o estado lido do banco e o relógio, devolve ordem e contagens. Sem `find` em laço (Map por chave).
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'
import { X3_RULES } from './regras'

/** Linha de `competitor_playlist_reads` (uma por canal). Datas em ISO; `last_visit_day` é o dia de São Paulo (AAAA-MM-DD). */
export interface LinhaDeLeitura {
  last_visit_at: string
  last_visit_day: string
  last_status: 'ok' | 'parcial' | 'erro'
  last_reason: string | null
  last_cycle_at: string | null
  first_visit_at: string
  playlists_left: number | null
}
export interface CanalParaPlanejar {
  id: string
  missing_since: string | null
  leitura: LinhaDeLeitura | null
}
export interface PlaylistDoCanal {
  id: string
  playlist_id: string
  items_read_at: string | null
  items_status: 'ok' | 'parcial' | 'erro' | null
  items_reason: string | null
  missing_since: string | null
}

/** Motivos que o dia seguinte conserta: o canal ou a playlist volta a ser devida. */
export const MOTIVOS_RECUPERAVEIS: ReadonlySet<string> = new Set([
  'lista_cortada', 'cota_esgotada', 'sobrou', 'itens_cortados', 'teto_por_canal', 'lista_vazia_a_confirmar', 'secoes_vazias_a_confirmar',
  'saida_em_massa_a_confirmar', 'playlist_sumiu_no_meio', 'resposta_invalida', 'api_falhou', 'gravacao_falhou', 'erro',
])
/** Motivos que não mudam relendo no dia seguinte: a visita fica `parcial` honesta e o retorno é o da semana seguinte. */
export const MOTIVOS_ESTRUTURAIS: ReadonlySet<string> = new Set(['teto_itens', 'contagem_difere', 'itens_incoerentes'])
export const ehRecuperavel = (motivo: string | null | undefined): boolean => motivo != null && MOTIVOS_RECUPERAVEIS.has(motivo)

/** Estimativa em unidades de uma visita (1 de seções + 1 de lista + uma por playlist, no mínimo 10), nunca acima do teto por visita. */
export function estimativaDeUnidades(playlistsConhecidas: number): number {
  return Math.min(X3_RULES.unidadesPorVisita, 2 + Math.max(10, playlistsConhecidas))
}

const ms = (iso: string): number => Date.parse(iso)

/** Canal devido: nunca volta terminada, ou 7 dias ou mais, ou volta que não fechou (`last_cycle_at < last_visit_at`); uma visita por dia. */
export function canalDevido(l: LinhaDeLeitura | null, agoraMs: number): boolean {
  if (l === null) return true
  if (l.last_visit_day >= spDateOf(agoraMs)) return false
  if (l.last_cycle_at === null) return true
  const ciclo = ms(l.last_cycle_at)
  return agoraMs - ciclo >= X3_RULES.diasEntreVoltas * DAY || ciclo < ms(l.last_visit_at)
}

/**
 * Playlist devida: `items_read_at` nulo ou de 6 dias ou mais; também a que ficou `parcial`/`erro` com motivo recuperável gravado em dia
 * anterior (senão a confirmação de uma saída em massa esperaria 6 dias). Playlist com `missing_since` nunca é devida.
 * Ordem: `items_read_at` nulo primeiro, depois o mais antigo, desempate pelo id.
 */
export function playlistsDevidas(playlists: readonly PlaylistDoCanal[], agoraMs: number): PlaylistDoCanal[] {
  const hoje = spDateOf(agoraMs)
  const seisDias = (X3_RULES.diasEntreVoltas - 1) * DAY
  return playlists
    .filter(p => {
      if (p.missing_since !== null) return false
      if (p.items_read_at === null) return true
      const lida = ms(p.items_read_at)
      if (agoraMs - lida >= seisDias) return true
      return (p.items_status === 'parcial' || p.items_status === 'erro') && ehRecuperavel(p.items_reason) && spDateOf(lida) < hoje
    })
    .sort((a, b) => {
      if (a.items_read_at === null && b.items_read_at !== null) return -1
      if (a.items_read_at !== null && b.items_read_at === null) return 1
      const d = (a.items_read_at === null ? 0 : ms(a.items_read_at)) - (b.items_read_at === null ? 0 : ms(b.items_read_at))
      return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

export interface ResultadoDoPlano {
  /** Ids dos canais devidos, na ordem de visita (nunca vistos primeiro, depois `last_visit_at` mais antigo, desempate por id), já cortados pelo teto do dia. */
  devidos: string[]
  /** Quantos devidos o teto do dia deixou de fora. */
  cortadosPeloTeto: number
  /** Canais com `coalesce(last_cycle_at, first_visit_at)` de mais de 14 dias: o alarme `canais_sem_volta_14d`. */
  canaisSemVolta14d: number
}

export function planejarCanais(e: {
  canais: readonly CanalParaPlanejar[]
  agoraMs: number
  /** Lido de `youtube_quota_usage` (dia do Pacífico) pelo `rodar`: nunca derivado de `last_units`. */
  unidadesJaGastasHoje: number
  /** Playlists conhecidas por canal (para a estimativa); ausente = 10. */
  playlistsPorCanal?: ReadonlyMap<string, number>
}): ResultadoDoPlano {
  const ativos = e.canais.filter(c => c.missing_since === null)
  const catorze = 14 * DAY
  let sem = 0
  for (const c of ativos) {
    const ref = c.leitura === null ? null : (c.leitura.last_cycle_at ?? c.leitura.first_visit_at)
    if (ref !== null && e.agoraMs - ms(ref) > catorze) sem++
  }
  const ordenados = ativos
    .filter(c => canalDevido(c.leitura, e.agoraMs))
    .sort((a, b) => {
      if (a.leitura === null && b.leitura !== null) return -1
      if (a.leitura !== null && b.leitura === null) return 1
      const d = (a.leitura === null || b.leitura === null) ? 0 : ms(a.leitura.last_visit_at) - ms(b.leitura.last_visit_at)
      return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  const devidos: string[] = []
  let gasto = e.unidadesJaGastasHoje
  for (const c of ordenados) {
    const est = estimativaDeUnidades(e.playlistsPorCanal?.get(c.id) ?? 0)
    if (gasto + est > X3_RULES.unidadesPorDia) break
    gasto += est
    devidos.push(c.id)
  }
  return { devidos, cortadosPeloTeto: ordenados.length - devidos.length, canaisSemVolta14d: sem }
}

/**
 * `p_ciclo`: a volta terminou. Verdadeiro só se não sobrou playlist devida (`playlistsLeft = 0`), a lista veio completa (ou vazia já
 * confirmada) e NENHUM motivo recuperável apareceu na visita inteira (lista, seções ou qualquer playlist). Motivos estruturais não contam.
 */
export function calcularCiclo(v: { playlistsLeft: number; listaCompleta: boolean; motivos: readonly (string | null | undefined)[] }): boolean {
  return v.playlistsLeft === 0 && v.listaCompleta && !v.motivos.some(ehRecuperavel)
}
