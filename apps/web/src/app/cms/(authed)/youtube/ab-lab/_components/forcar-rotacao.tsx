'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { BTN_SAIDA } from './acoes-de-saida'
import { AbConfirmarDialog } from './ab-confirmar-dialog'

export interface ForcarRotacaoProps {
  testId: string
  /** Versão no ar agora. */
  atual: DisplayLabel | null
  /** Versão que entra na troca (`view.proximaNaRotacao`, a mesma conta de `forceRotate`). */
  proxima: DisplayLabel | null
  escrevendo: boolean
  forcar: (testId: string) => Promise<ResultadoAcaoSaida>
}

/** Forçar rotação no bloco de rotação: diálogo `.etd` no lugar do `confirm()` nativo. */
export function ForcarRotacao({ testId, atual, proxima, escrevendo, forcar }: ForcarRotacaoProps) {
  const router = useRouter()
  const botao = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const fechar = () => {
    setAberto(false)
    setErro(null)
    queueMicrotask(() => botao.current?.focus())
  }
  const confirmar = async () => {
    setEnviando(true)
    setErro(null)
    const r = await forcar(testId)
    setEnviando(false)
    if (r.ok) { router.refresh(); fechar(); return }
    setErro(r.error)
  }
  const ritmo = 'O ritmo normal da rotação continua depois disso.'
  const nota = atual && proxima && atual !== proxima ? `A versão ${atual} sai do ar e a ${proxima} entra. ${ritmo}` : ritmo

  return (
    <>
      <button
        ref={botao}
        type="button"
        className={`${BTN_SAIDA} dhl-bt--rot`}
        onClick={() => { if (!escrevendo) setAberto(true) }}
        {...(escrevendo ? { 'aria-disabled': true, 'aria-describedby': 'apoio-rot' } : {})}
      >
        <RefreshCw size={14} aria-hidden="true" />
        Forçar rotação
      </button>
      {escrevendo ? <p id="apoio-rot" role="status" className="dhl-apoio">Gravando no YouTube. A rotação volta em instantes.</p> : null}
      {aberto ? (
        <AbConfirmarDialog
          titulo="Forçar rotação agora?"
          lead="A versão atual será trocada no YouTube agora."
          nota={nota}
          rotuloConfirmar="Forçar rotação"
          enviando={enviando}
          erro={erro}
          onVoltar={fechar}
          onConfirmar={() => { void confirmar() }}
        />
      ) : null}
    </>
  )
}
