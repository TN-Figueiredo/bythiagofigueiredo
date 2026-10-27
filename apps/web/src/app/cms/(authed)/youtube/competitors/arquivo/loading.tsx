import type { ReactElement } from 'react'
import '../_arquivo/arquivo.css'

/** O esqueleto da página Arquivo (Naksu N6): título, frase, legenda e três cartões com cabeçalho e quatro linhas, nas medidas de `arquivo.css`.
 *  O de `competitors/loading.tsx` desenha a grade de canais, forma errada para esta página (que leva alguns segundos no dev). */
export default function ArquivoLoading(): ReactElement {
  return (
    <div data-obs-screen="arquivo" className="arq-tela" aria-busy="true">
      <div className="skel rounded" style={{ height: 22, width: 120, marginBottom: 12 }} />
      <div className="skel rounded" style={{ height: 15, width: 420, maxWidth: '100%', marginBottom: 16 }} />
      <div className="skel rounded-lg" style={{ height: 44, marginBottom: 16 }} />
      {[0, 1, 2].map(i => (
        <section key={i} className="arq-card">
          <div className="skel" style={{ height: 64, borderRadius: '8px 8px 0 0' }} />
          {[0, 1, 2, 3].map(j => <div key={j} className="skel" style={{ height: 72, borderTop: '1px solid var(--border-subtle)' }} />)}
        </section>
      ))}
    </div>
  )
}
