/**
 * A nota do ritmo na tela (mockup de 19/10): quando a base é menor que as 13 semanas da regra, o número ganha o sufixo
 * "· sobre N d" e um ⓘ com a causa; abaixo do piso de 4 semanas não há número, só "—" e "canal com menos de 4 sem".
 * Uma conta só para a lista, o cabeçalho do canal e o Comparar. O número nunca esmaece: a nota é de quem o lê.
 */
import { PISO_RITMO_DIAS } from './medidas/ritmo'

export interface NotaDoRitmo {
  /** `base`: há número, medido sobre menos que a regra. `piso`: abaixo do piso, o número não existe (estado "não medido"). */
  tipo: 'base' | 'piso'
  /** O texto de relance, ao lado do número: "· sobre 81 d" ou "canal com menos de 4 sem". */
  sufixo: string
  /** O título e a causa do ⓘ. */
  titulo: string
  causa: string
  /** A frase inteira, para a linha de nota sob o cabeçalho do canal. */
  frase: string
  /** Por que a base é essa: a criação do canal ou a cobertura da lista guardada. */
  corte: 'criacao' | 'cobertura'
}

const casa = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/**
 * `dias` é a base real em dias (null quando só se sabe que ficou abaixo do piso); `abaixoDoPiso` é a decisão da própria medida (a que
 * decide o número nulo), não uma comparação refeita aqui. Sem corte (13 semanas cheias) não há nota.
 */
export function notaDoRitmo(o: { corte: 'criacao' | 'cobertura' | null; dias: number | null; abaixoDoPiso: boolean; semanasDaRegra: number }): NotaDoRitmo | null {
  if (o.corte === null) return null
  const regra = o.semanasDaRegra * 7
  const semPiso = PISO_RITMO_DIAS / 7
  // Arredonda para a tela, mas nunca para a borda da própria regra: 27,6 d no piso não vira "28 dias, menos de 28", 90,7 d não vira "91, não 91".
  const teto = o.abaixoDoPiso ? PISO_RITMO_DIAS - 1 : regra - 1
  const d = o.dias == null ? null : Math.min(Math.round(o.dias), teto)
  const sem = d == null ? null : casa(d / 7)
  if (o.abaixoDoPiso) {
    const tem = o.corte === 'criacao'
      ? (d == null ? 'O canal tem menos de' : `O canal tem ${d} dias de vida, menos de`)
      : (d == null ? 'Os vídeos guardados cobrem menos de' : `Os vídeos guardados cobrem só ${d} dias, menos de`)
    return {
      tipo: 'piso', corte: o.corte, sufixo: o.corte === 'criacao' ? `canal com menos de ${semPiso} sem` : `guardados cobrem menos de ${semPiso} sem`, titulo: 'Ainda não dá para medir',
      causa: `${tem} ${PISO_RITMO_DIAS} dias (${semPiso} semanas). Com uma base assim curta o ritmo oscila demais para valer como número, então mostramos "—". Os vídeos já aparecem no gráfico.`,
      frase: `Menos de ${semPiso} semanas de base${d == null ? '' : ` (${d} dias)`}: o ritmo ainda não é medido.`,
    }
  }
  if (d == null) return null
  return {
    tipo: 'base', corte: o.corte, sufixo: `· sobre ${d} d`, titulo: `Ritmo sobre ${d} dias, não ${regra}`,
    causa: o.corte === 'criacao'
      ? `O canal existe há ${d} dias. O ritmo é o número de vídeos publicados dividido por essas ${sem} semanas. As semanas antes da criação não existiam e não entram na conta.`
      : `Só os vídeos mais recentes deste canal estão guardados, e eles cobrem ${d} dias. O ritmo é o número de vídeos publicados dividido por essas ${sem} semanas. Antes disso o canal pode ter publicado, mas não guardamos.`,
    frase: o.corte === 'criacao' ? `Contado sobre ${d} dias, desde a criação do canal.` : `Contado sobre ${d} dias: só os vídeos mais recentes foram guardados.`,
  }
}
