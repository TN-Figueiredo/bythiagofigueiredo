'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  const [falhouAs] = useState(() => hora.format(new Date()))

  // Falha de leitura do placar (D-F3-5): cópia do mockup M4. A tela só lê; nada no teste mudou.
  if (error.message.startsWith('ab_lab_leitura')) {
    return (
      <div role="alert" className="mx-auto mt-[18px] max-w-[640px] rounded-[10px] border border-cms-border-strong bg-cms-surface p-[18px] text-cms-text">
        <h2 className="text-[16px] font-semibold">Não consegui ler o placar agora.</h2>
        <p className="mt-[4px] text-[14px] text-cms-text-muted">
          A tela só lê; o teste não foi alterado. Tente de novo; se persistir, a leitura falhou às {falhouAs}.
        </p>
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          <button type="button" onClick={reset} className="min-h-[44px] rounded-[6px] bg-cms-accent px-[13px] text-[13px] font-semibold text-cms-on-accent hover:opacity-90">
            Tentar de novo
          </button>
          <Link href="/cms/youtube/ab-lab" className="inline-flex min-h-[44px] items-center rounded-[6px] border border-cms-border-strong px-[13px] text-[13px] font-medium text-cms-text">
            Voltar aos testes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-cms-text">
      <h2 className="text-lg font-semibold mb-2">Algo deu errado</h2>
      <p className="text-cms-text-muted mb-4 text-sm">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-cms-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
        Tentar novamente
      </button>
    </div>
  )
}
