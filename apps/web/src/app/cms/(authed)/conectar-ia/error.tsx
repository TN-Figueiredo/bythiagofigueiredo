'use client'

import './conectar-ia.css'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { FRASES_CONECTAR as F } from '@/lib/youtube/observatorio/acesso-ia/frases-conectar'

// q7: falha ao ler a liberação. Não afirma "sem acesso" e não mostra o endereço.
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  return (
    <div className="cia">
      <div className="pg">
        <h1 tabIndex={-1} style={{ marginBottom: 16 }}>{F.titulo}</h1>
        <div className="neutral amb" role="note">
          <TriangleAlert aria-hidden size={20} strokeWidth={1.8} />
          <div><strong>{F.erroTitulo}</strong><span>{F.erroTexto}</span></div>
        </div>
        <div className="btns">
          <button className="btn no" type="button" disabled={pendente} onClick={() => startTransition(() => { router.refresh(); reset() })}>
            <RefreshCw aria-hidden size={20} strokeWidth={1.8} />{F.tentarDeNovo}
          </button>
        </div>
      </div>
    </div>
  )
}
