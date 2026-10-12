import '../_comparar/comparar.css'

/**
 * Esqueleto do MIOLO da comparação, na forma final: dois cartões de lado e a tabela. Só aparece depois de 100 ms (animation-delay em
 * comparar.css): carga rápida não pisca. Decorativo para leitor de tela, que recebe só "Carregando…".
 */
export default function CompararLoading() {
  return (
    <div data-obs="" className="obs-ch-root">
      <div className="obs-ch-content">
        <div className="obs-ch-screen">
          <div data-obs-screen="comparar">
            <div className="ld" aria-hidden="true">
              <div className="sk-sides">
                <span className="bone sk-side" />
                <span className="bone sk-side" />
              </div>
              <div className="sk-tab">
                {Array.from({ length: 8 }, (_, i) => <span key={i} className="bone sk-row" />)}
              </div>
            </div>
            <span className="obs-ch-sr" role="status">Carregando…</span>
          </div>
        </div>
      </div>
    </div>
  )
}
