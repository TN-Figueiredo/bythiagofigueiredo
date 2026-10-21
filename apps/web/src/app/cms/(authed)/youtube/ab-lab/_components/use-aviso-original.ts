'use client'

import { useEffect, useState } from 'react'
import { AVISO_INDISPONIVEL, textoAvisoOriginalBaixa, type AvisoOriginal } from '@/lib/youtube/ab-original-resolucao'

export type LerDimensoesDaOriginal = (
  testId: string,
) => Promise<{ ok: true; dimensions: string | null; medida: boolean } | { ok: false }>

/**
 * D12: lê a original guardada do rascunho e devolve o aviso (ou null). Só leitura, nunca bloqueia.
 * A server action chega por parâmetro (regra: action em client component só por prop).
 */
export function useAvisoOriginal(
  ler: LerDimensoesDaOriginal,
  draftTestId: string | null,
  type: string,
  ativo: boolean,
): AvisoOriginal | null {
  const [aviso, setAviso] = useState<AvisoOriginal | null>(null)
  const aplica = ativo && !!draftTestId && (type === 'thumbnail' || type === 'combo')

  useEffect(() => {
    setAviso(null)
    if (!aplica || !draftTestId) return
    let vivo = true
    const termina = (a: AvisoOriginal | null) => { if (vivo) setAviso(a) }
    try {
      Promise.resolve(ler(draftTestId)).then(
        (r) => termina(r.ok ? textoAvisoOriginalBaixa(r.dimensions, r.medida) : AVISO_INDISPONIVEL),
        () => termina(AVISO_INDISPONIVEL),
      )
    } catch {
      termina(AVISO_INDISPONIVEL)
    }
    return () => { vivo = false }
  }, [aplica, draftTestId, ler])

  return aplica ? aviso : null
}
