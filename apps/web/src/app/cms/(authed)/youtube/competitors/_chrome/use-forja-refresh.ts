'use client'
/**
 * A atualização automática enquanto um pedido da forja está em andamento (a forja consulta a fila a cada 10 min). Estava dentro da moldura
 * inteira (`observatory-chrome.tsx`); a moldura só com a trilha do Histórico não a tem, então o efeito mora aqui e é chamado pelos dois lugares
 * (spec A2.6, D7). O intervalo é o mesmo de antes.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './toasts'
import type { ForjaView } from './forja-view-model'

/** Intervalo entre atualizações enquanto há pedido em andamento. */
export const FORJA_REFRESH_MS = 60_000

/** Com pedido em andamento, chama `router.refresh()` a cada `FORJA_REFRESH_MS`; `paused` suspende. Devolve o instante do último refresh (ou da montagem). */
export function useForjaRefresh(active: boolean, paused = false): { lastAt: number } {
  const router = useRouter()
  const [lastAt, setLastAt] = useState(() => Date.now())
  useEffect(() => {
    if (!active || paused) return
    const t = setInterval(() => { router.refresh(); setLastAt(Date.now()) }, FORJA_REFRESH_MS)
    return () => clearInterval(t)
  }, [active, paused, router])
  return { lastAt }
}

/** Um pedido que chega a "publicado" avisa uma vez ("Pedido enviado à forja" → "Leitura publicada"). */
export function useAvisoLeituraPublicada(forja: ForjaView | null | undefined): void {
  const toast = useToast()
  const active = !!forja?.status?.active
  const prevActive = useRef(active)
  useEffect(() => {
    if (prevActive.current && forja?.status && !forja.status.active && /publicad/.test(forja.status.text) && !forja.status.warn) toast('ok', 'Leitura publicada', forja.typeLabel)
    prevActive.current = active
  }, [active, forja, toast])
}
