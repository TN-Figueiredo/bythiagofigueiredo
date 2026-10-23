'use client'
import type { ReactElement } from 'react'
import '../caminho-nativo.css'

/** Chip da versão com a letra sempre visível. Não reusa `VChip` (contraste, aria em inglês). */
export function ChipVersao({ letra }: { letra: 'A' | 'B' | 'C' }): ReactElement {
  return (
    <span className={`cn-chip ${letra.toLowerCase()}`} role="img" aria-label={`Versão ${letra}`}>
      <span aria-hidden="true">{letra}</span>
    </span>
  )
}

/** Slot do chip quando o título no ar não casa com nenhuma versão (D-7(d)): o "?" hachurado do selo `unk`, nunca uma letra inventada. */
export function ChipSemVersao({ rotulo }: { rotulo: string }): ReactElement {
  return (
    <span className="cn-chip unk" role="img" aria-label={rotulo}>
      <span aria-hidden="true">?</span>
    </span>
  )
}
