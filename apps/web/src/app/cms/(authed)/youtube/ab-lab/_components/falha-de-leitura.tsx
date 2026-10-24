'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

/** Falha de leitura do placar (D-F3-5): cópia do mockup M4. A tela só lê; nada no teste mudou. */
/** `reset` vem do error boundary; na página (Server Component) o "Tentar de novo" relê com `router.refresh()`. */
export function FalhaDeLeitura({ reset, falhouAs }: { reset?: () => void; falhouAs: string }) {
  const router = useRouter()
  return (
    <div role="alert" className="mx-auto mt-[18px] max-w-[640px] rounded-[10px] border border-cms-border-strong bg-cms-surface p-[18px] text-cms-text">
      <h2 className="text-[16px] font-semibold">Não consegui ler o placar agora.</h2>
      <p className="mt-[4px] text-[14px] text-cms-text-muted">
        A tela só lê; o teste não foi alterado. Tente de novo; se persistir, a leitura falhou às {falhouAs}.
      </p>
      <div className="mt-[12px] flex flex-wrap gap-[8px]">
        <button type="button" onClick={() => (reset ? reset() : router.refresh())} className="min-h-[44px] rounded-[6px] bg-cms-accent px-[13px] text-[13px] font-semibold text-cms-on-accent hover:opacity-90">
          Tentar de novo
        </button>
        <Link href="/cms/youtube/ab-lab" className="inline-flex min-h-[44px] items-center rounded-[6px] border border-cms-border-strong px-[13px] text-[13px] font-medium text-cms-text">
          Voltar aos testes
        </Link>
      </div>
    </div>
  )
}
