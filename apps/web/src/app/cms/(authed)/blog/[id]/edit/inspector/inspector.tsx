import { InspDetalhes } from './insp-detalhes'
import { InspDistribuicao } from './insp-distribuicao'
import { InspHistorico } from './insp-historico'
import { InspArquivar } from './insp-arquivar'

/* ------------------------------------------------------------------ */
/*  Inspector shell                                                   */
/* ------------------------------------------------------------------ */

export function Inspector() {
  return (
    <div
      className="insp v3"
      data-inspector=""
      data-testid="inspector"
      role="complementary"
      aria-label="Inspector"
    >
      <InspDetalhes />
      <InspDistribuicao />
      <InspHistorico />
      <InspArquivar />
    </div>
  )
}
