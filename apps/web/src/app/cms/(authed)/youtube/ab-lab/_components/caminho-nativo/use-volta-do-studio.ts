'use client'
// Volta do Studio (F1a-tela-1, T9a): depois de "Abrir no Studio" (`ativo`), o primeiro `visibilitychange` para visível
// vira `true` e fica `true`. Sem `ativo` não escuta nada (a ficha enviada que veio do servidor não depende disto).
import { useEffect, useState } from 'react'

export function useVoltaDoStudio(ativo: boolean): boolean {
  const [voltou, setVoltou] = useState(false)
  useEffect(() => {
    if (!ativo || voltou || typeof document === 'undefined') return
    const aoMudar = (): void => { if (document.visibilityState === 'visible') setVoltou(true) }
    document.addEventListener('visibilitychange', aoMudar)
    return () => document.removeEventListener('visibilitychange', aoMudar)
  }, [ativo, voltou])
  return voltou
}
