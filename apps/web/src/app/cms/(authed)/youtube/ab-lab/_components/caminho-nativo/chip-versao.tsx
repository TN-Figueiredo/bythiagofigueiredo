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
