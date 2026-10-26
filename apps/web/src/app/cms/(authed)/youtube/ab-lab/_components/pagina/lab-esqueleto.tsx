// Estado "carregando" da página (M7 T5, mockup estado d): nenhum número inventado; cada seção reserva a altura final
// (Com você 2x64, Em teste 2 cartões de 300, Concluídos 3x68, Vídeos 3x72) para a página não pular quando o dado chega.
import type { ReactElement } from 'react'

const SECOES: ReadonlyArray<{ titulo: string; blocos: number; altura: number; grade?: boolean }> = [
  { titulo: 'Com você', blocos: 2, altura: 64 },
  { titulo: 'Em teste agora', blocos: 2, altura: 300, grade: true },
  { titulo: 'Concluídos', blocos: 3, altura: 68 },
  { titulo: 'Vídeos do canal', blocos: 3, altura: 72 },
]

export function LabEsqueleto(): ReactElement {
  return (
    <div className="p-6 space-y-6" aria-busy="true" data-lab-esqueleto="">
      <p className="text-sm text-cms-text-dim" role="status">Lendo os testes…</p>
      {SECOES.map(({ titulo, blocos, altura, grade }) => (
        <section key={titulo} aria-label={titulo} className="space-y-2">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <div aria-hidden="true" className={grade ? 'grid grid-cols-1 gap-3.5 lg:grid-cols-2' : 'space-y-2'}>
            {Array.from({ length: blocos }, (_, i) => (
              <div key={i} data-esq-bloco="" className="rounded-lg bg-[#272219] motion-safe:animate-pulse" style={{ height: altura }} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
