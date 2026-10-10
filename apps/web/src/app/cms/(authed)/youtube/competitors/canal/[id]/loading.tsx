import '../../_canal/canal.css'

/**
 * Esqueleto do MIOLO da página do canal, na forma final: três linhas de cabeçalho e dez retângulos 16:9 em cinco colunas.
 * Só aparece depois de 100 ms (animation-delay em canal.css): carga rápida não pisca. Decorativo para leitor de tela, que
 * recebe só "Carregando…".
 */
export default function CanalLoading() {
  return (
    <div data-obs="" className="obs-ch-root">
      <div className="obs-ch-content">
        <div className="obs-ch-screen">
          <div data-obs-screen="canal">
            <div className="ld" aria-hidden="true">
              <div className="sk-h">
                <span className="bone" style={{ height: 34, width: '38%' }} />
                <span className="bone" style={{ height: 40, width: '72%' }} />
                <span className="bone" style={{ height: 19, width: '56%' }} />
              </div>
              <div className="sk-g">
                {Array.from({ length: 10 }, (_, i) => <span key={i} className="bone" />)}
              </div>
            </div>
            <span className="sr-only obs-ch-sr" role="status">Carregando…</span>
          </div>
        </div>
      </div>
    </div>
  )
}
