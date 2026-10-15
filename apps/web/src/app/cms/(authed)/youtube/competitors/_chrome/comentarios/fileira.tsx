'use client'
// A5 · E5a · Tarefa C2: a fileira de casas (uma por comentário, 44 px). Cada casa leva ao cartão; a vazia é só decoração.
import type { CasaView } from './model'
import './comentarios.css'

export function Fileira({ casas }: { casas: CasaView[] }) {
  const ir = (id: string) => (e: { preventDefault: () => void }) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    // Cartão escondido pelo "Mostrar os outros": a lista o revela antes do foco.
    el.closest('[data-cd-lista]')?.dispatchEvent(new CustomEvent('cd-revelar', { detail: id }))
    el.focus()
  }
  return (
    <ol className="cd-fileira">
      {casas.map((c, i) =>
        c.id === null ? (
          <li key={`v${i}`} role="presentation" className="cd-casa cd-casa-vazia" />
        ) : (
          <li key={c.id} className="cd-casa-li">
            <a href={`#${c.id}`} className={`cd-casa cd-g-${c.chave}`} aria-label={c.rotulo} onClick={ir(c.id)}>
              <span aria-hidden="true">{c.curtidas === null ? '–' : c.curtidas.toLocaleString('pt-BR')}</span>
            </a>
          </li>
        ),
      )}
    </ol>
  )
}
