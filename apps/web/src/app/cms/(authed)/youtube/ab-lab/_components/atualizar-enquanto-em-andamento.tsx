'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const INTERVALO_MS = 10_000
const LIMITE_MS = 6 * 60_000

/**
 * Ilha client (Y-D11): refaz a leitura da página a cada 10 s enquanto houver campo
 * em_andamento com menos de 6 min. A tela já diz "Sem resposta" aos 5 min; aos 6 para.
 */
export function AtualizarEnquantoEmAndamento({ emAndamentoDesde }: { emAndamentoDesde: string | null }) {
  const router = useRouter()
  useEffect(() => {
    if (!emAndamentoDesde) return
    const desde = Date.parse(emAndamentoDesde)
    if (!Number.isFinite(desde)) return
    const vivo = () => Date.now() - desde < LIMITE_MS
    if (!vivo()) return
    const id = setInterval(() => {
      if (!vivo()) { clearInterval(id); return }
      router.refresh()
    }, INTERVALO_MS)
    return () => clearInterval(id)
  }, [emAndamentoDesde, router])
  return null
}
