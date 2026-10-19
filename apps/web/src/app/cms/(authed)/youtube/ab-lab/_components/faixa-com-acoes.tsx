'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import type { Faixa } from './faixa-restauracao-texto'
import { FaixaRestauracao } from './faixa-restauracao'
import { BTN_BASE, definirAviso } from './acoes-de-saida'

export interface FaixaComAcoesProps {
  testId: string
  faixa: Faixa
  /** A faixa enquanto "Tentar agora" corre (P4b-E1). */
  faixaTentando: Faixa | null
  seqVisto: number
  /** `retryRestore` ligada ao id na página (nunca importada aqui). */
  tentar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  /** `dismissRestore` ligada ao id na página. */
  dispensar: (campos: CampoNome[], seqVisto: number) => Promise<ResultadoAcaoSaida>
}

// Texto escuro do produto (--cms-on-accent) sobre o laranja: 7,5:1; o branco dava 2,5:1.
const DESABILITADO = 'disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRI = `${BTN_BASE} bg-cms-accent text-[var(--cms-on-accent,#1A120A)] hover:text-[var(--cms-on-accent,#1A120A)] ${DESABILITADO} [@media(pointer:coarse)]:min-h-[44px]`
// Secundário sobre a faixa colorida: text-cms-text (a dim ficava em 4,1 a 4,4:1 sobre a faixa de erro).
const BTN = `${BTN_BASE} text-cms-text ${DESABILITADO} [@media(pointer:coarse)]:min-h-[44px]`

/** Ilha cliente da faixa: os botões "Tentar agora" e "Já corrigi no YouTube" (P4b). Sem permissão, nenhum botão. */
export function FaixaComAcoes({ testId, faixa, faixaTentando, seqVisto, tentar, dispensar }: FaixaComAcoesProps) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [tentando, setTentando] = useState(false)
  const trava = useRef(false)

  async function rodar(chamada: () => Promise<ResultadoAcaoSaida>, mostrarTentando: boolean) {
    if (trava.current) return
    trava.current = true
    setOcupado(true)
    setTentando(mostrarTentando)
    try {
      const r = await chamada()
      if (!r.ok) definirAviso(testId, r.error)
    } catch {
      definirAviso(testId, 'Sem resposta. Não sabemos se a ação foi feita. Recarregue a página para ver o estado.', { fixo: true })
    } finally {
      trava.current = false
      setOcupado(false)
      setTentando(false)
      router.refresh()
    }
  }

  const acoes = faixa.tom === 'ok' ? null : faixa.acoes
  const mostrada = tentando && faixaTentando ? faixaTentando : faixa
  return (
    <FaixaRestauracao faixa={mostrada}>
      {acoes && acoes.motivoSemBotao ? <p className="fr-fine">{acoes.motivoSemBotao}</p> : null}
      {acoes && (acoes.tentar || acoes.dispensar.length > 0) ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {acoes.tentar ? (
            <button type="button" className={BTN_PRI} disabled={ocupado} aria-busy={ocupado} onClick={() => rodar(() => tentar(seqVisto), true)}>
              Tentar agora
            </button>
          ) : null}
          {acoes.dispensar.length > 0 ? (
            <button type="button" className={BTN} disabled={ocupado} aria-busy={ocupado} onClick={() => rodar(() => dispensar(acoes.dispensar, seqVisto), false)}>
              Já corrigi no YouTube: dispensar aviso
            </button>
          ) : null}
        </div>
      ) : null}
    </FaixaRestauracao>
  )
}
