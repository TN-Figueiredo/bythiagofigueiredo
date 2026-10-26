'use client'

import { useEffect, useState } from 'react'
import type { AvisoDeVolume } from '@/lib/youtube/ab-gravacao/aviso-volume'
import { TEMPO_LIMITE_LEITURA_MS } from './use-aviso-original'

export type LerAvisoDeVolume = (
  testId: string,
  pedido?: { V: number },
) => Promise<{ ok: true; aviso: AvisoDeVolume } | { ok: false; error: string }>

/** 'pendente' = lendo; 'indisponivel' = não foi possível ler; null = não se aplica ou estado `ok`; objeto = texto a mostrar. */
export type EstadoAvisoVolume = 'pendente' | 'indisponivel' | null | { estado: AvisoDeVolume['estado']; texto: string }

/**
 * Aviso de volume do rascunho (uma leitura por rascunho e V, nunca por tecla). Só informa: nunca bloqueia.
 * A leitura é guardada pela chave `${draftTestId}|${V}`: mudar V volta a 'pendente' e nunca mostra o texto de outro V.
 * Falha, rejeição ou 8 s sem resposta ⇒ 'indisponivel' (nunca null, que leria como "tudo certo"); uma resposta tardia substitui.
 */
export function useAvisoVolume(ler: LerAvisoDeVolume | undefined, draftTestId: string | null, ativo: boolean, V?: number): EstadoAvisoVolume {
  const [lido, setLido] = useState<{ chave: string; valor: EstadoAvisoVolume } | null>(null)
  useEffect(() => {
    if (!ler || !ativo || !draftTestId) return
    const id = draftTestId
    const chave = `${id}|${V ?? ''}`
    let cancelado = false
    const grava = (valor: EstadoAvisoVolume) => { if (!cancelado) setLido({ chave, valor }) }
    const timer = setTimeout(() => {
      if (!cancelado) setLido(atual => (atual?.chave === chave && atual.valor !== 'pendente' ? atual : { chave, valor: 'indisponivel' }))
    }, TEMPO_LIMITE_LEITURA_MS)
    try {
      Promise.resolve(V === undefined ? ler(id) : ler(id, { V })).then(
        (r) => {
          clearTimeout(timer)
          if (!r.ok) { console.warn('aviso de volume indisponível', r.error); grava('indisponivel'); return }
          grava(r.aviso.estado === 'ok' || r.aviso.texto === null ? null : { estado: r.aviso.estado, texto: r.aviso.texto })
        },
        (e) => { clearTimeout(timer); console.warn('aviso de volume indisponível', e); grava('indisponivel') },
      )
    } catch (e) { clearTimeout(timer); console.warn('aviso de volume indisponível', e); grava('indisponivel') }
    return () => { cancelado = true; clearTimeout(timer) }
  }, [ler, ativo, draftTestId, V])
  if (!ler || !ativo) return null
  if (!draftTestId) return 'indisponivel'
  const chave = `${draftTestId}|${V ?? ''}`
  return lido?.chave === chave ? lido.valor : 'pendente'
}
