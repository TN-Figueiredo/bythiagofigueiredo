// A5 · E5a, Tarefa 5: a frase-resumo da lista de Canais, escrita a partir das contagens (nunca do que "parece" 0). Puro.
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { FRASES } from '@/lib/youtube/observatorio/medidas-telas/frases'
import type { ResumoDeDirecao } from './direcao-model'
import type { ContagemDosFiltros } from './estado-model'

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const pl = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

// TEXTO-A-REVISAR (Logan/Naksu): as frases abaixo seguem o mockup 16 (tabela de frases, seção 2); as que o mockup não escreve são marcadas.
export function fraseDoResumo(dir: ResumoDeDirecao, c: ContagemDosFiltros): string {
  const out: string[] = []
  const parados = c.parados !== null && c.parados > 0 ? pl(c.parados, 'canal parado', 'canais parados') : ''
  const dirTxt = dir.frase.replace(/\.$/, '')
  if (dir.medidos > 0 && dir.frase) out.push([parados, dirTxt].filter(Boolean).join(', ') + '.')
  else {
    if (parados) out.push(parados + '.')
    if (dir.frase) out.push(dir.frase)
  }
  const q = c.queda
  if (q.tipo === 'ainda_nao_existe') {
    out.push(`Em queda sustentada (${MEASURE_RULES.decline.windows} períodos de ${MEASURE_RULES.direction.windowDays} dias seguidos) só dá para medir a partir de ${dm(q.existeEm)}.`)
  } else if (q.tipo === 'nao_medido') {
    out.push(`Em queda sustentada: não medido (${FRASES[q.motivo]({}, 'canais').curta}).`)
  } else if (q.emQueda > 0) {
    out.push(`${q.emQueda} em queda sustentada${q.quedaMedidaEm < q.canais ? ` (medido em ${q.quedaMedidaEm} de ${q.canais} canais)` : ''}.`)
  } else {
    out.push(q.quedaMedidaEm < q.canais
      ? `Nenhum canal em queda sustentada entre os ${q.quedaMedidaEm} medidos de ${q.canais}.`
      : `Nenhum dos ${q.canais} canais está em queda sustentada.`)
  }
  if (c.saiu !== null && c.saiu > 0) out.push(`${pl(c.saiu, 'canal saiu', 'canais saíram')} do YouTube.`)
  if (c.emErro > 0) out.push(`${pl(c.emErro, 'canal', 'canais')} em erro.`)
  return out.join(' ')
}
