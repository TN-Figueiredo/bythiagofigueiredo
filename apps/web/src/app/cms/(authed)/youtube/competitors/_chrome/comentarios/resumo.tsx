// Comentários em produção, T4: a frase-resumo e a barra fina de uma idade. Fica ANTES das abas (a aba aberta decide qual aparece) e é
// componente de servidor puro: sem estado.
import type { ListaView } from './model'
import './comentarios.css'

export function ResumoDaLista({ v }: { v: ListaView }) {
  const pct = Math.min(100, Math.round((v.barra.n / Math.max(1, v.barra.de)) * 100))
  return (
    <div className="cd-resumo-linha">
      <p className="cd-resumo" data-frase-resumo="">
        <b>{v.frase.negrito}</b>{v.frase.resto ? <> <span className="cd-apagado">{v.frase.resto}</span></> : null}
      </p>
      <p className="cd-barra-fina" aria-label={v.barra.texto}>
        <span className="cd-barra-t">{v.barra.texto}</span>
        <span className="cd-barra-f" aria-hidden="true"><span style={{ width: `${Math.max(2, pct)}%` }} /></span>
      </p>
    </div>
  )
}
