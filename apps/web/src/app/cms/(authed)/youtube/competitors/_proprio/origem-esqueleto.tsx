/** O estado "Carregando" da origem (fallback do Suspense das telas do vídeo e do canal): contorno liso, sem hachura e sem pontilhado. */
export function OrigemEsqueleto() {
  return (
    <div className="ov-novo ov-esq" role="status" aria-busy="true">
      <div className="ov-esq-barra" aria-hidden="true" />
      <div className="ov-esq-linha" aria-hidden="true" />
      <div className="ov-esq-linha" aria-hidden="true" />
      <div className="ov-esq-linha" aria-hidden="true" />
      <p className="ov-lem">Carregando…</p>
    </div>
  )
}
