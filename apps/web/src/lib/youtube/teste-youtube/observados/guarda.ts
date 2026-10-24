import { normalizarTitulo } from '../normalizar-titulo'
import { inferirObservadoDetalhe, tituloValido, type EntradaObs, type LeituraObs, type ResultadoObs, type VersaoParaConferir } from './inferir'

/** Máximo de rodadas de "regra + conferência" por alvo (§6.2). */
export const TETO_ITERACOES_GUARDA = 3
/** Máximo de linhas lidas por consulta da guarda; bater nele conta como placeholder. */
export const TETO_LINHAS_GUARDA = 1000

export interface Achado { ytId: string }

/**
 * Placeholder (§6.2): a versão vista em >= 2 OUTROS vídeos distintos, ou em >= 1 vídeo de OUTRO canal, ou se a consulta bateu o teto.
 * Canal nulo (D-P8): nulo dos dois lados = desconhecido (a regra de "outro canal" não dispara); nulo de um lado só = canal diferente.
 */
export function ehPlaceholder(
  achados: readonly Achado[],
  o: { canalDoAlvo: string | null; canalDe: (ytId: string) => string | null; bateuTeto: boolean },
): boolean {
  if (o.bateuTeto) return true
  const videos = [...new Set(achados.map(a => a.ytId))]
  if (videos.length >= 2) return true
  return videos.some(v => {
    const c = o.canalDe(v)
    return !(c === null && o.canalDoAlvo === null) && c !== o.canalDoAlvo
  })
}

/** Devolve as chaves (normalizadas) suspensas. Erro LANÇA: nunca vira "sem achado". */
export type ConferirVersoes = (vs: readonly VersaoParaConferir[]) => Promise<ReadonlySet<string>>

export interface ResultadoGuardado { r: ResultadoObs; suspensos: ReadonlySet<string>; estourou: boolean; iteracoes: number }

const temTitulo = (r: ResultadoObs): boolean => r.observados.some(o => o.campo === 'titulo')

/**
 * Roda a regra e confere, a cada emissão de linha de título, as versões ainda não conferidas. Versão suspensa sai do voto e a regra
 * roda de novo, até `teto` conferências. No teto, se a nova saída ainda cita versão não conferida: `estourou`, sem observado de título
 * e com `validasTitulo = 0`.
 */
export async function inferirComGuarda(e: EntradaObs, conferir: ConferirVersoes, teto: number = TETO_ITERACOES_GUARDA): Promise<ResultadoGuardado> {
  const suspensos = new Set<string>(e.titulosSuspensos ?? [])
  const conferidas = new Set<string>()
  const novasDe = (r: ResultadoObs): VersaoParaConferir[] => r.versoesTitulo.filter(v => !conferidas.has(v.chave))
  let iteracoes = 0
  for (;;) {
    const r = inferirObservadoDetalhe({ ...e, titulosSuspensos: suspensos })
    const novas = temTitulo(r) ? novasDe(r) : []
    if (novas.length === 0) return { r, suspensos, estourou: false, iteracoes }
    if (iteracoes >= teto) {
      return { r: { ...r, observados: r.observados.filter(o => o.campo !== 'titulo'), validasTitulo: 0 }, suspensos, estourou: true, iteracoes }
    }
    iteracoes++
    const suspensas = await conferir(novas)
    for (const v of novas) conferidas.add(v.chave)
    let mudou = false
    for (const k of suspensas) if (!suspensos.has(k)) { suspensos.add(k); mudou = true }
    if (!mudou) return { r, suspensos, estourou: false, iteracoes }
  }
}

/**
 * Aviso (§6.2): títulos normalizados em >= 3 vídeos, ou em >= 2 vídeos de canais distintos (canal nulo conta como distinto de qualquer outro,
 * inclusive de outro nulo). Só leituras válidas.
 */
export function titulosSuspensos(leituras: readonly { ytId: string; canal: string | null; leitura: LeituraObs }[]): string[] {
  const porTitulo = new Map<string, Map<string, string | null>>()
  for (const x of leituras) {
    if (!tituloValido(x.leitura)) continue
    const k = normalizarTitulo(x.leitura.tituloExibido!)
    const videos = porTitulo.get(k) ?? new Map<string, string | null>()
    videos.set(x.ytId, x.canal)
    porTitulo.set(k, videos)
  }
  const saida: string[] = []
  for (const [k, videos] of porTitulo) {
    if (videos.size >= 3) { saida.push(k); continue }
    if (videos.size === 2) {
      const [a, b] = [...videos.values()]
      if (a === null || b === null || a !== b) saida.push(k)
    }
  }
  return saida
}
