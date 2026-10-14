import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Formato, type Medida, type Nota } from './tipos'
import { m1DoVideo, viewsNaIdade, type FaltaLida, type IdadeDeMarca, type Leitura, type MarcaLida } from './m1'

/** M2: curva por idade do canal. Puro. */
export interface VideoComSerie {
  formato: Formato | null
  publicadoEm: number
  /** `baseDaIdade` do vídeo; nulo sem `published_at`. */
  baseMs: number | null
  wasLive: boolean | null
  agendadoOuNoAr: boolean
  marcas: Partial<Record<IdadeDeMarca, MarcaLida>>
  faltas: Partial<Record<IdadeDeMarca, FaltaLida>>
  /** Ausente = a série não foi pedida; os pontos 1, 7 e 30 seguem pelas marcas. */
  leituras?: Leitura[]
}

export interface PontoDaCurva { idadeDias: number; ponto: Medida<number>; relativoAV30: Medida<number> }

const IDADES_DE_MARCA: readonly number[] = MEASURE_RULES.ages

interface ViewsDoPonto { views: number | null; semanal: boolean; pedida: boolean }

function viewsNoPonto(v: VideoComSerie, idade: number, agoraMs: number): ViewsDoPonto {
  if (v.baseMs === null) return { views: null, semanal: false, pedida: true }
  if (IDADES_DE_MARCA.includes(idade)) {
    const i = idade as IdadeDeMarca
    const m = m1DoVideo({ idadeDias: i, baseMs: v.baseMs, agendadoOuNoAr: false, agoraMs, marca: v.marcas[i] ?? null, falta: v.faltas[i] ?? null, leituras: v.leituras })
    return { views: m.estado === 'medido' ? m.valor.views : null, semanal: false, pedida: true }
  }
  if (!v.leituras) return { views: null, semanal: false, pedida: false }
  const gap = idade >= MEASURE_RULES.curve.weeklyFromAge ? MEASURE_RULES.weeklyGapHours : MEASURE_RULES.maxGapHours
  const r = viewsNaIdade(v.leituras, v.baseMs, idade, { maxGapHoras: gap })
  if (!('medido' in r)) return { views: null, semanal: false, pedida: true }
  return { views: r.medido.views, semanal: r.medido.gapHoras > MEASURE_RULES.maxGapHours, pedida: true }
}

export function curvaDoCanal(videos: readonly VideoComSerie[], o: { formato: Formato; agoraMs: number }): Medida<PontoDaCurva[]> {
  const janelaMs = MEASURE_RULES.curve.windowDays * DAY
  const dentro = videos.filter(v => o.agoraMs - v.publicadoEm <= janelaMs && o.agoraMs - v.publicadoEm >= 0)
  const semFormato = dentro.filter(v => v.formato === null).length
  const doFormato = dentro.filter(v => v.formato === o.formato)
  const agendados = doFormato.filter(v => v.agendadoOuNoAr).length
  const semAgendados = doFormato.filter(v => !v.agendadoOuNoAr)
  const aoVivo = semAgendados.filter(v => v.wasLive === true).length
  const vs = semAgendados.filter(v => v.wasLive !== true)
  const notas: Nota[] = []
  if (aoVivo) notas.push({ tipo: 'ao_vivo_fora', n: aoVivo })
  if (semFormato) notas.push({ tipo: 'formato_nao_confirmado_fora', n: semFormato })
  if (agendados) notas.push({ tipo: 'agendado_fora', n: agendados })

  const minimo = RULES.weakBase
  const v30 = vs.map(v => viewsNoPonto(v, 30, o.agoraMs).views)
  let usouSemanal = false
  const pontos: PontoDaCurva[] = MEASURE_RULES.curve.ages.map(idade => {
    const lidos = vs.map(v => viewsNoPonto(v, idade, o.agoraMs))
    const medidos = lidos.flatMap(l => (l.views === null ? [] : [l.views]))
    const pontoNotas: Nota[] = lidos.some(l => l.views !== null && l.semanal) ? [{ tipo: 'serie_semanal' }] : []
    if (pontoNotas.length) usouSemanal = true
    const janela = { de: null, ate: null, dias: idade }
    let ponto: Medida<number>
    if (medidos.length >= minimo) ponto = medido(median(medidos) ?? 0, medidos.length, janela, pontoNotas)
    else if (vs.length > 0 && lidos.every(l => !l.pedida)) ponto = naoMedido('serie_nao_pedida')
    else ponto = naoMedido('poucos_videos', { n: medidos.length, minimo })
    // Razão contra o V30 do próprio vídeo; V30 zero sai da razão.
    const razoes: number[] = []
    let zeros = 0
    lidos.forEach((l, i) => {
      const base = v30[i]
      if (l.views === null || base === null || base === undefined) return
      if (base === 0) { zeros++; return }
      razoes.push(l.views / base)
    })
    let relativoAV30: Medida<number>
    if (razoes.length >= minimo) relativoAV30 = medido(median(razoes) ?? 0, razoes.length, janela)
    else if (zeros > 0) relativoAV30 = naoMedido('base_zero', { n: razoes.length, minimo })
    else if (vs.length > 0 && lidos.every(l => !l.pedida)) relativoAV30 = naoMedido('serie_nao_pedida')
    else relativoAV30 = naoMedido('poucos_videos', { n: razoes.length, minimo })
    return { idadeDias: idade, ponto, relativoAV30 }
  })
  if (usouSemanal) notas.push({ tipo: 'serie_semanal' })
  if (!pontos.some(p => p.ponto.estado === 'medido')) return naoMedido('poucos_videos', { n: vs.length, minimo, notas })
  const janela = { de: spDateOf(o.agoraMs - janelaMs), ate: spDateOf(o.agoraMs), dias: MEASURE_RULES.curve.windowDays }
  return medido(pontos, vs.length, janela, notas)
}
