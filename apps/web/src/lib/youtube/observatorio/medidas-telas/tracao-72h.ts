// apps/web/src/lib/youtube/observatorio/medidas-telas/tracao-72h.ts
// E5a Tarefa 14 (a regra das 72 horas, M14): puro, sem banco, sem relógio (recebe `agoraMs`), nada de COMP.
// (Contrato do plano, Tarefa 14d.) Os limiares moram num objeto só para a ordem 13 levá-los a `rules.ts`.

import { intervalos, type Leitura } from '../../horaria/regra'
import type { Formato } from '../medidas/tipos'
import type { HorasDoCanal, LeituraPorHora } from './ler-horas'

export const REGRAS_DAS_72_HORAS = {
  /** A janela que se mede depois da publicação. */
  HORAS: 72,
  /** Folga da consulta depois da hora 72, para fechar o intervalo da hora 72. */
  FOLGA_DA_CONSULTA_H: 1,
  /** Um bloco de vídeos da consulta cobre no máximo esta distância entre a menor e a maior publicação. */
  JANELA_DO_BLOCO_H: 72,
  /** Ids por bloco da consulta. */
  IDS_POR_BLOCO: 150,
  /** Blocos lidos ao mesmo tempo. */
  BLOCOS_AO_MESMO_TEMPO: 6,
  /** Vídeos considerados: publicados nos últimos N dias. */
  VIDEOS_DOS_ULTIMOS_DIAS: 90,
  /** Descoberto depois de N horas da publicação fica fora do normal. */
  DESCOBERTO_TARDE_H: 6,
  /** Mais que esta fração das horas sem contagem tira o vídeo do normal. */
  MAX_HORAS_SEM_CONTAGEM: 0.2,
  /** Menos vídeos que isto: não se mede o normal. */
  MIN_VIDEOS: 3,
  /** Duração máxima de um intervalo limpo (`horaria/regra.ts`, DURACAO_MAX_MS), em minutos. */
  FOLGA_DA_ULTIMA_LEITURA_MIN: 70,
} as const


const HORA_MS = 3_600_000
const MIN_MS = 60_000
const R = REGRAS_DAS_72_HORAS

export type MotivoDeHoras =
  | 'leitura_por_hora_nao_comecou'
  | 'publicado_antes_da_leitura_por_hora'
  | 'entrou_tarde'
  | 'ja_tinha_passado'
  | 'poucos_videos'
  | 'muitas_horas_sem_contagem'
  | 'ainda_nao_tem_72_horas'
  | 'ao_vivo_ou_estreia'
  | 'leitura_falhou'
  | 'sem_contagem_no_fim_das_72_horas'
  | 'sem_contagem_nas_72_horas'
  | 'leitura_por_hora_parada'

export type MedidaDeHoras<T> =
  | { estado: 'medido'; valor: T; n: number }
  | { estado: 'nao_medido'; motivo: MotivoDeHoras; n?: number }

export type MotivoDeHora =
  | 'antes_da_primeira_contagem'
  | 'sem_contagem_nesta_hora'
  | 'fora_da_hora_cheia'
  | 'cobre_mais_de_uma_hora'

export type HoraDaCurva = { k: number; deMs: number; ateMs: number; acumulado: number | null } & (
  | { tipo: 'medido'; ganho: number }
  | { tipo: 'diminuiu' }
  | { tipo: 'nao_medido'; motivo: MotivoDeHora }
  | { tipo: 'ainda_nao_existe' }
)

export interface CurvaDe72Horas {
  horas: HoraDaCurva[]
  primeiraContagem: { emMs: number; idadeMin: number; views: number } | null
  ultimaLeitura: { k: number; views: number } | null
  total72: MedidaDeHoras<number>
  horasQueDiminuiram: number
  /** Horas sem barra com leitura depois delas, dentro da janela: o ganho delas está no total. */
  horasSemBarra: number
  /** Horas sem barra depois da última leitura: o ganho delas NÃO está em total nenhum. */
  horasFinaisSemContagem: number
}

/** O acumulado da hora k: o contador da última leitura com `lidaEmMs` até a borda. */
function acumuladoAte(ord: readonly LeituraPorHora[], bordaMs: number): number | null {
  let v: number | null = null
  for (const l of ord) {
    if (l.lidaEmMs <= bordaMs) v = l.views
    else break
  }
  return v
}

export function curvaDe72Horas(leituras: readonly LeituraPorHora[], publicadoEmMs: number, agoraMs: number): CurvaDe72Horas {
  const ord = [...leituras].sort((a, b) => a.lidaEmMs - b.lidaEmMs)
  const brutas: Leitura[] = ord.map((l) => ({ takenAt: l.lidaEmMs, views: l.views, likes: l.likes, comments: l.comments }))
  const ivs = intervalos(brutas, publicadoEmMs)
  const fimDaJanela = publicadoEmMs + R.HORAS * HORA_MS
  // O intervalo pertence à hora em que cai o seu ponto médio (a leitura vem uns minutos depois da hora cheia).
  const porHora = new Map<number, (typeof ivs)[number]>()
  for (const iv of ivs) {
    const k = Math.floor(((iv.inicio + iv.fim) / 2 - publicadoEmMs) / HORA_MS) + 1
    if (k < 1 || k > R.HORAS) continue
    const atual = porHora.get(k)
    if (!atual || (!atual.limpo && iv.limpo)) porHora.set(k, iv)
  }
  const primeira = ord[0] ?? null
  const ultimaNaJanela = [...ord].reverse().find((l) => l.lidaEmMs <= fimDaJanela) ?? null
  const horas: HoraDaCurva[] = []
  let diminuiram = 0
  let semBarra = 0
  let finais = 0
  for (let k = 1; k <= R.HORAS; k++) {
    const deMs = publicadoEmMs + (k - 1) * HORA_MS
    const ateMs = publicadoEmMs + k * HORA_MS
    const base = { k, deMs, ateMs, acumulado: acumuladoAte(ord, ateMs) }
    if (ateMs > agoraMs) {
      horas.push({ ...base, tipo: 'ainda_nao_existe' })
      continue
    }
    const iv = porHora.get(k)
    if (iv?.limpo && iv.d.views !== null) {
      if (iv.d.views < 0) {
        diminuiram++
        horas.push({ ...base, tipo: 'diminuiu' })
      } else horas.push({ ...base, tipo: 'medido', ganho: iv.d.views })
      continue
    }
    let motivo: MotivoDeHora
    if (iv) motivo = iv.fim - iv.inicio > 70 * MIN_MS ? 'cobre_mais_de_uma_hora' : 'fora_da_hora_cheia'
    else if (!primeira || primeira.lidaEmMs > ateMs) motivo = 'antes_da_primeira_contagem'
    else motivo = 'sem_contagem_nesta_hora'
    if (ultimaNaJanela && ateMs <= ultimaNaJanela.lidaEmMs) semBarra++
    else finais++
    horas.push({ ...base, tipo: 'nao_medido', motivo })
  }
  const ultima = ord.length ? (ord[ord.length - 1] as LeituraPorHora) : null
  const ultimaAteBorda = [...ord].reverse().find((l) => l.lidaEmMs <= fimDaJanela) ?? null
  const kDaUltima = ultima ? Math.min(R.HORAS, Math.max(1, Math.ceil((ultima.lidaEmMs - publicadoEmMs) / HORA_MS))) : 0
  let total72: MedidaDeHoras<number>
  if (!ultima || !ultimaAteBorda) total72 = { estado: 'nao_medido', motivo: 'sem_contagem_nas_72_horas' }
  else if (agoraMs < fimDaJanela) total72 = { estado: 'nao_medido', motivo: 'ainda_nao_tem_72_horas' }
  else if (ultimaAteBorda.lidaEmMs < fimDaJanela - R.FOLGA_DA_ULTIMA_LEITURA_MIN * MIN_MS)
    total72 = { estado: 'nao_medido', motivo: 'sem_contagem_no_fim_das_72_horas' }
  else total72 = { estado: 'medido', valor: ultimaAteBorda.views, n: ord.length }
  const semTotal = total72.estado !== 'medido' && total72.motivo === 'sem_contagem_no_fim_das_72_horas'
  if (semTotal) {
    // Sem total lido, o ganho das horas sem barra não está em lugar nenhum.
    finais += semBarra
    semBarra = 0
  }
  return {
    horas,
    primeiraContagem: primeira
      ? { emMs: primeira.lidaEmMs, idadeMin: Math.round((primeira.lidaEmMs - publicadoEmMs) / MIN_MS), views: primeira.views }
      : null,
    ultimaLeitura: ultimaAteBorda
      ? { k: Math.min(R.HORAS, Math.max(1, Math.ceil((ultimaAteBorda.lidaEmMs - publicadoEmMs) / HORA_MS))), views: ultimaAteBorda.views }
      : ultima
        ? { k: kDaUltima, views: ultima.views }
        : null,
    total72,
    horasQueDiminuiram: diminuiram,
    horasSemBarra: semBarra,
    horasFinaisSemContagem: finais,
  }
}

const FRACOES = { um_quarto: 0.25, metade: 0.5, tres_quartos: 0.75 } as const

export function marcosDoVideo(curva: CurvaDe72Horas): Record<keyof typeof FRACOES, MedidaDeHoras<number>> {
  const t = curva.total72
  if (t.estado !== 'medido') {
    const nao: MedidaDeHoras<number> = { estado: 'nao_medido', motivo: t.motivo }
    return { um_quarto: nao, metade: nao, tres_quartos: nao }
  }
  const out = {} as Record<keyof typeof FRACOES, MedidaDeHoras<number>>
  for (const nome of Object.keys(FRACOES) as Array<keyof typeof FRACOES>) {
    const alvo = FRACOES[nome] * t.valor
    const h = curva.horas.find((x) => x.acumulado !== null && x.acumulado >= alvo)
    const pc = curva.primeiraContagem
    if (!h) out[nome] = { estado: 'nao_medido', motivo: 'sem_contagem_nas_72_horas' }
    else if (pc && pc.views >= alvo && pc.idadeMin > 60) out[nome] = { estado: 'nao_medido', motivo: 'ja_tinha_passado' }
    else out[nome] = { estado: 'medido', valor: h.k, n: 1 }
  }
  return out
}

export interface VideoDaTracao {
  curva: CurvaDe72Horas
  descobertoComHoras: number | null
  aoVivo: boolean | null
  formato: Formato | null
  publicadoEmMs: number
}
export interface TracaoDoCanal {
  fracaoPorHora: Array<number | null>
  umQuarto: number
  metade: number
  tresQuartos: number
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

export function tracaoDoCanal(
  videos: readonly VideoDaTracao[],
  o: { formato: Formato; agoraMs: number },
): MedidaDeHoras<TracaoDoCanal> & { fora: { descobertoTarde: number; aoVivo: number; incompletos: number } } {
  const fora = { descobertoTarde: 0, aoVivo: 0, incompletos: 0 }
  const entram: VideoDaTracao[] = []
  const desde = o.agoraMs - R.VIDEOS_DOS_ULTIMOS_DIAS * 24 * HORA_MS
  for (const v of videos) {
    if (v.formato !== o.formato || v.publicadoEmMs < desde) continue
    if (v.descobertoComHoras !== null && v.descobertoComHoras > R.DESCOBERTO_TARDE_H) fora.descobertoTarde++
    else if (v.aoVivo === true) fora.aoVivo++
    else if (
      v.curva.total72.estado !== 'medido' ||
      v.curva.horas.filter((h) => h.tipo === 'nao_medido').length > R.HORAS * R.MAX_HORAS_SEM_CONTAGEM
    )
      fora.incompletos++
    else entram.push(v)
  }
  if (entram.length < R.MIN_VIDEOS) return { estado: 'nao_medido', motivo: 'poucos_videos', n: entram.length, fora }
  const fracaoPorHora: Array<number | null> = []
  for (let k = 1; k <= R.HORAS; k++) {
    const vals: number[] = []
    for (const v of entram) {
      const total = v.curva.total72.estado === 'medido' ? v.curva.total72.valor : 0
      const a = v.curva.horas[k - 1]?.acumulado ?? null
      if (a !== null && total > 0) vals.push(a / total)
    }
    fracaoPorHora.push(vals.length >= R.MIN_VIDEOS ? mediana(vals) : null)
  }
  const primeira = (f: number): number | null => {
    const i = fracaoPorHora.findIndex((x) => x !== null && x >= f)
    return i < 0 ? null : i + 1
  }
  const q = primeira(0.25)
  const m = primeira(0.5)
  const t = primeira(0.75)
  if (q === null || m === null || t === null) return { estado: 'nao_medido', motivo: 'muitas_horas_sem_contagem', n: entram.length, fora }
  return { estado: 'medido', valor: { fracaoPorHora, umQuarto: q, metade: m, tresQuartos: t }, n: entram.length, fora }
}

/** O motivo de um vídeo sem nenhuma linha de hora: uma função só, nesta ordem. */
export function motivoSemHoras(
  video: { publicadoEmMs: number; descobertoEmMs: number | null },
  horas: Pick<HorasDoCanal, 'primeiraHoraDoSiteMs'>,
): MotivoDeHoras {
  if (horas.primeiraHoraDoSiteMs === null) return 'leitura_por_hora_nao_comecou'
  if (video.publicadoEmMs < horas.primeiraHoraDoSiteMs) return 'publicado_antes_da_leitura_por_hora'
  if (video.descobertoEmMs !== null && video.descobertoEmMs - video.publicadoEmMs > R.HORAS * HORA_MS) return 'entrou_tarde'
  return 'sem_contagem_nas_72_horas'
}
