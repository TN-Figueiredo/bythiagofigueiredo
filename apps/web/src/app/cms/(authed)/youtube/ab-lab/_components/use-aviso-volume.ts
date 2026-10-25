'use client'

import { useEffect, useState } from 'react'
import type { AvisoDeVolume } from '@/lib/youtube/ab-gravacao/aviso-volume'

export type LerAvisoDeVolume = (
  testId: string,
) => Promise<{ ok: true; aviso: AvisoDeVolume } | { ok: false; error: string }>

/**
 * S8-F4 T11c: texto do aviso de volume do rascunho (uma leitura por rascunho, nunca por tecla). Só informa: nunca bloqueia.
 * A server action chega por parâmetro. Erro, leitura pendente ou estado `ok` (sem texto) devolvem null.
 */
export function useAvisoVolume(ler: LerAvisoDeVolume | undefined, draftTestId: string | null, ativo: boolean): string | null {
  const [lido, setLido] = useState<{ id: string; texto: string | null } | null>(null)
  useEffect(() => {
    if (!ler || !ativo || !draftTestId) return
    const id = draftTestId
    let cancelado = false
    Promise.resolve(ler(id)).then(
      (r) => { if (!cancelado) setLido({ id, texto: r.ok ? r.aviso.texto : null }) },
      () => { if (!cancelado) setLido({ id, texto: null }) },
    )
    return () => { cancelado = true }
  }, [ler, ativo, draftTestId])
  if (!ler || !ativo || !draftTestId) return null
  return lido?.id === draftTestId ? lido.texto : null
}
