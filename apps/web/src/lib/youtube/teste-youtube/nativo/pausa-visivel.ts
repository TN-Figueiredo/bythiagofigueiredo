// Pausa do NOSSO teste por haver teste do YouTube (F1a-tela-1, T10): a frase e o estado do botão "Retomar".
// Puro. O botão depende do DADO (registro aberto), nunca da data; a data é só o texto "a partir de dd/mm[, HH:MM]".
// A recusa do servidor continua sendo a guarda (`guardaDoPonto`); aqui só se evita oferecer o que o servidor recusaria.
import { FRASES } from './frases'
import { rotuloRetomar } from './lista'

/** O registro do teste do YouTube do vídeo: `aberto` = ainda `em_andamento`; `ate` = ISO de `retomarAPartirDe`. */
export interface PausaYoutube { aberto: boolean; ate: string | null }

export interface PausaVisivel {
  /** Frase da linha âmbar; nulo quando o registro já não está aberto (nada a explicar). */
  frase: string | null
  retomarDesabilitado: boolean
}

/**
 * `pausa` nulo = o registro não pôde ser lido: falha fechada (Retomar desabilitado, frase "espera o resultado"),
 * nunca "habilitado por falta de dado".
 */
export function pausaVisivel(pausa: PausaYoutube | null | undefined, agora: Date): PausaVisivel {
  if (!pausa) return { frase: FRASES.s7.retomarEspera, retomarDesabilitado: true }
  if (!pausa.aberto) return { frase: null, retomarDesabilitado: false }
  const t = pausa.ate ? Date.parse(pausa.ate) : NaN
  const futuro = Number.isFinite(t) && t > agora.getTime()
  return { frase: futuro ? FRASES.s7.labPausadoConfirmado(rotuloRetomar(new Date(t))) : FRASES.s7.retomarEspera, retomarDesabilitado: true }
}
