import { DAY } from '../time'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Medida } from './tipos'

/** M5(ii): subidas de um vídeo e o que mudou antes delas. M5(i) é o `effectAt` que já existe e não é reescrito. Puro. */
export type CampoDeMudanca = 'titulo' | 'miniatura' | 'descricao' | 'tags' | 'categoria' | 'duracao' | 'idioma' | 'capitulos'
export interface PontoDaSerie { dia: string; t: number; views: number }
export interface MudancaDoVideo { campo: CampoDeMudanca; em: number }
export interface Subida { dia: string; ganho7: number; ganho7Antes: number; fator: number | null; mudancasAntes: MudancaDoVideo[] }

const somaDias = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)

export function subidasDoVideo(pontos: readonly PontoDaSerie[], mudancas: readonly MudancaDoVideo[]): Medida<Subida[]> {
  const porDia = new Map<string, PontoDaSerie>()
  for (const p of pontos) {
    if (!p || typeof p.dia !== 'string' || !Number.isFinite(p.views) || !Number.isFinite(p.t)) continue
    const atual = porDia.get(p.dia)
    if (!atual || p.t > atual.t) porDia.set(p.dia, p)
  }
  if (porDia.size === 0) return naoMedido('sem_leitura')
  const { days, minGain, factor, lookbackDays } = MEASURE_RULES.rise
  const dias = [...porDia.keys()].sort()
  const subidas: Subida[] = []
  let avaliados = 0
  let anteriorCumpriu: string | null = null
  for (const d of dias) {
    // O trecho de d − 7 a d + 7 tem de estar inteiro (15 dias); faltando um, o dia não é avaliado.
    let completo = true
    for (let k = -days; k <= days && completo; k++) completo = porDia.has(somaDias(d, k))
    if (!completo) { anteriorCumpriu = null; continue }
    avaliados++
    const pd = porDia.get(d)!
    const ganho7 = porDia.get(somaDias(d, days))!.views - pd.views
    const ganho7Antes = pd.views - porDia.get(somaDias(d, -days))!.views
    const cumpre = ganho7 >= minGain && ganho7 >= factor * ganho7Antes
    // Dias seguidos que cumprem a regra são uma subida só: vale o primeiro.
    const seguido = cumpre && anteriorCumpriu !== null && somaDias(anteriorCumpriu, 1) === d
    anteriorCumpriu = cumpre ? d : null
    if (!cumpre || seguido) continue
    const mudancasAntes = mudancas.filter(m => m.em >= pd.t - lookbackDays * DAY && m.em < pd.t)
    subidas.push({ dia: d, ganho7, ganho7Antes, fator: ganho7Antes > 0 ? ganho7 / ganho7Antes : null, mudancasAntes })
  }
  if (avaliados === 0) return naoMedido('serie_diaria_incompleta')
  return medido(subidas, avaliados, { de: dias[0]!, ate: dias[dias.length - 1]!, dias: null })
}

const CAPITULO = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\s|$)/

/** Linhas que começam com `m:ss` ou `h:mm:ss`; `null` sem texto. */
export function capitulosDe(texto: string | null): string[] | null {
  if (texto === null) return null
  return texto.split(/\r?\n/).filter(l => CAPITULO.test(l)).map(l => l.trim())
}

/** Duas descrições com listas de capítulos diferentes são mudança `capitulos`; texto ausente em uma delas não se afirma. */
export function mudouCapitulos(antes: string | null, depois: string | null): boolean {
  const a = capitulosDe(antes), b = capitulosDe(depois)
  if (a === null || b === null) return false
  return a.length !== b.length || a.some((l, i) => l !== b[i])
}
