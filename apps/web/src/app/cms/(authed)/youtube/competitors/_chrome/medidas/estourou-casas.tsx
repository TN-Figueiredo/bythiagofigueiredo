/** A5 · E5a, Tarefa 10a: as três casas da leitura "Estourou e parou" (cheia, vazada com ✕, hachurada, pontilhada). `role="img"`: a forma e o texto dizem o mesmo. */
import './medidas.css'
import type { Casa, Casas } from './estourou-model'

const TEXTO: Record<Casa, string> = { v: 'bate', n: 'não bate', m: 'não medido', p: 'ainda não existe' }
const SINAIS = ['muitas views cedo', 'quase nada depois', 'pouca reação'] as const

export function rotuloDasCasas(casas: Casas): string {
  return 'Três sinais: ' + casas.split('').map((c, i) => `${SINAIS[i]} ${TEXTO[c as Casa]}`).join('; ')
}

export function EstourouCasas({ casas, pequeno = false, rotulo }: { casas: Casas; pequeno?: boolean; rotulo?: string }) {
  return (
    <span className="lm-casas" role="img" aria-label={rotulo ?? rotuloDasCasas(casas)}>
      {casas.split('').map((c, i) => <i key={i} className={`lm-cs ${c}${pequeno ? ' sm' : ''}`} aria-hidden="true" />)}
    </span>
  )
}
