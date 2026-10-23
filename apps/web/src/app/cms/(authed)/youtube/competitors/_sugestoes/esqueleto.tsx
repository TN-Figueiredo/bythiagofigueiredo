// Esqueleto da lista (F3 T5): título real, N "…" (nunca 0), linhas com a forma de `.sg-sk-row`. Sem hooks: serve de loading do servidor.
import './sugestoes.css'

export function EsqueletoDaLista(p: { linhas: number }) {
  return (
    <section className="sg" data-obs-screen="sugestoes" data-modo="pagina">
      <div className="sg-phd"><h1>Sugestões <span className="sg-cnt">…</span></h1><div className="sg-fresh"><span>Lendo…</span></div></div>
      <p className="sg-sum" aria-busy="true"><span className="sg-skel" style={{ width: 'min(420px,100%)', height: 24 }} /></p>
      <div aria-busy="true" aria-label="Carregando sugestões">
        <div className="sg-list">
          {Array.from({ length: p.linhas }, (_, i) => (
            <div className="sg-sk-row" key={i} aria-hidden="true">
              <span className="sg-skel sg-skth" style={{ width: 96, aspectRatio: '16/9' }} />
              <div>
                <span className="sg-skel" style={{ width: 132, height: 20 }} />
                <span className="sg-skel" style={{ width: '85%', height: 16, marginTop: 12 }} />
                <span className="sg-skel" style={{ width: '60%', height: 16, marginTop: 8 }} />
                <span className="sg-skel" style={{ width: 160, height: 22, marginTop: 16 }} />
              </div>
              <div className="sg-skra"><span className="sg-skel" style={{ width: '100%', height: 36 }} /><span className="sg-skel" style={{ width: '100%', height: 36 }} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
