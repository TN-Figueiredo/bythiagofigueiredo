/** Decisão 75: a célula ausente do pacote escreve as MESMAS palavras da pastilha da tela (não medido, falhou, restrito). Nunca vira zero. */
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import type { Celula } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { EstadoAusencia } from '../_chrome/ausencia/estado'

/** `estado` nulo ou ausente = a célula de sempre (não medido). `restrito` só chega aqui quando o modelo da tela disse `restrito` (negada com certeza). */
export function celulaAusente(estado: EstadoAusencia | null | undefined, motivo: string | null, origem: string): Celula {
  const m = motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO
  switch (estado) {
    case 'falhou': return { papel: 'numero', estado: 'falhou', motivo: m, origem }
    case 'restrito': return { papel: 'numero', estado: 'restrito', motivo: m, origem }
    case 'nao_medido':
    case null:
    case undefined:
      return { papel: 'numero', estado: 'nao_medido', motivo: m, origem }
    default: { const nunca: never = estado; return nunca }
  }
}

/** O marcador que as projeções do canal e do vídeo de fora escrevem quando o TIPO do modelo é `nao_carregou` (nunca deduzido de frase). No pacote vira a célula `falhou`. */
export const NAO_CARREGOU_TELA = 'falhou'
