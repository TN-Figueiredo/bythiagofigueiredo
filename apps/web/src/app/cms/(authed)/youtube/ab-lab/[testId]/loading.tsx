import '../_components/caminho-nativo.css'
import '../_components/placar-esqueleto.css'

// Esqueleto do detalhe do teste na geometria final do mockup M4 r3.1 (cabeçalho, resumo, faixa, 2 linhas, dias).
export default function DetalheDoTesteCarregando() {
  return (
    <div className="cn-raiz pm4-sk" data-testid="detalhe-carregando">
      <div className="skhd" aria-hidden="true">
        <div className="sk th" />
        <div className="tt">
          <div className="sk" style={{ height: 14, width: '40%', marginBottom: 10 }} />
          <div className="sk" style={{ height: 22, width: '85%' }} />
        </div>
      </div>
      <div className="sk sksum" role="status"><span>Carregando o placar</span></div>
      <div className="sk skband" aria-hidden="true" />
      <div className="sec" aria-hidden="true">
        <div className="sk" style={{ height: 21, width: 200, marginBottom: 12 }} />
        <div className="sk skrow" />
        <div className="sk skrow" />
        <div className="skdias">{Array.from({ length: 14 }, (_, i) => <div key={i} className="sk" />)}</div>
      </div>
      <div className="sec" aria-hidden="true">
        <div className="sk" style={{ height: 21, width: 160, marginBottom: 12 }} />
        <div className="sk" style={{ height: 14, maxWidth: 760 }} />
      </div>
    </div>
  )
}
