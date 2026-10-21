'use client'

import { useEffect, useState } from 'react'
import { AVISO_INDISPONIVEL, textoAvisoOriginalBaixa, type AvisoOriginal, type EstadoAviso } from '@/lib/youtube/ab-original-resolucao'

export type LerDimensoesDaOriginal = (
  testId: string,
) => Promise<{ ok: true; dimensions: string | null; medida: boolean } | { ok: false }>

export const TEMPO_LIMITE_LEITURA_MS = 8000   // limite do esqueleto, não teto de custo (r6: não decide com perda)
/** Trilho: Tipo 0, Ideias 1, Variantes 2, Config 3, Revisar 4. A linha is_original já existe ao escolher o tipo. */
export const LEITURA_A_PARTIR_DO_PASSO = 2

/**
 * D12: lê a original guardada do rascunho e devolve o aviso. Só leitura, nunca bloqueia.
 * A server action chega por parâmetro (regra: action em client component só por prop).
 * 'pendente' = lendo; null = original em alta ou tipo só título (não se aplica).
 */
export function useAvisoOriginal(
  ler: LerDimensoesDaOriginal,
  draftTestId: string | null,
  type: string,
  ativo: boolean,
): EstadoAviso {
  const tipoLe = type === 'thumbnail' || type === 'combo'
  const aplica = ativo && tipoLe
  const [lido, setLido] = useState<{ id: string | null; valor: EstadoAviso }>({ id: null, valor: 'pendente' })
  useEffect(() => {
    if (!aplica || !draftTestId) return
    const id = draftTestId
    setLido({ id, valor: 'pendente' })   // L7: nunca mostrar o aviso do rascunho anterior
    let cancelado = false
    let resolvido = false   // só uma resposta real (ok ou erro) resolve; o tempo não
    let timer: ReturnType<typeof setTimeout> | undefined
    const resolve = (valor: AvisoOriginal | null) => {
      if (cancelado || resolvido) return
      resolvido = true
      clearTimeout(timer)
      setLido({ id, valor })
    }
    // o tempo-limite só mostra o placeholder; uma resposta ok tardia o substitui (r6, Phil C2)
    timer = setTimeout(() => { if (!cancelado && !resolvido) setLido({ id, valor: AVISO_INDISPONIVEL }) }, TEMPO_LIMITE_LEITURA_MS)
    try {
      Promise.resolve(ler(id)).then(
        (r) => resolve(r.ok ? textoAvisoOriginalBaixa(r.dimensions, r.medida) : AVISO_INDISPONIVEL),
        () => resolve(AVISO_INDISPONIVEL),
      )
    } catch { resolve(AVISO_INDISPONIVEL) }
    return () => { cancelado = true; clearTimeout(timer) }
  }, [aplica, draftTestId, ler])
  if (!aplica) return null                                         // tipo só título ou passo inativo
  if (!draftTestId) return textoAvisoOriginalBaixa(null, false)    // sem rascunho: "não medida", nunca "Tudo pronto." sem ler (r6, Yannis C3)
  return lido.id === draftTestId ? lido.valor : 'pendente'          // sem quadro de cena velha (Phil menor 3)
}
