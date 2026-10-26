// Estado "carregando" da página (M7 T5, mockup estado d): nenhum número inventado, só rótulos e esqueleto.
import type { ReactElement } from 'react'

const SECOES = ['Em teste agora', 'Concluídos', 'Vídeos do canal'] as const

export function LabEsqueleto(): ReactElement {
  return (
    <div className="p-6 space-y-6" aria-busy="true" data-lab-esqueleto="">
      <p className="text-sm text-cms-text-dim" role="status">Lendo os testes…</p>
      <div aria-hidden="true" className="animate-pulse rounded-lg bg-cms-border" style={{ height: 56 }} />
      {SECOES.map((titulo) => (
        <section key={titulo} aria-label={titulo} className="space-y-2">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <p className="text-sm text-cms-text-dim">Carregando…</p>
        </section>
      ))}
    </div>
  )
}
