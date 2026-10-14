import type { ReactNode } from 'react'
import type { Faixa, Tom, LinhaFaixa } from './faixa-restauracao-texto'
import './faixa-restauracao.css'

const ICONE: Record<Tom, ReactNode> = {
  ok: (<><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M7.5 12.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></>),
  warn: (<><path d="M12 3L22 20H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 10v4.5M12 17.3v.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>),
  err: (<><path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>),
  busy: (<><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity=".3" /><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>),
  none: (<><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" /><path d="M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>),
}

function Icone({ tom }: { tom: Tom }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={tom === 'busy' ? 'fr-spin' : undefined}>{ICONE[tom]}</svg>
}

// A hora vai em negrito; o resto é texto (React escapa qualquer rótulo).
function TextoComHora({ linha }: { linha: LinhaFaixa }) {
  const { texto, hora } = linha
  const i = hora ? texto.indexOf(hora) : -1
  if (!hora || i < 0) return <>{texto}</>
  return <>{texto.slice(0, i)}<b>{hora}</b>{texto.slice(i + hora.length)}</>
}

export function FaixaRestauracao({ faixa }: { faixa: Faixa }) {
  if (faixa.tom === 'ok') {
    return (
      <div className="faixa-rest">
        <p className="fr-tz">Horários de São Paulo</p>
        <p className="fr-okline"><svg viewBox="0 0 24 24" aria-hidden="true">{ICONE.ok}</svg><span>{faixa.okline}</span></p>
      </div>
    )
  }
  return (
    <div className="faixa-rest">
      <p className="fr-tz">Horários de São Paulo</p>
      <div className={`fr-band ${faixa.tom}`} role={faixa.papel} aria-live={faixa.tom === 'busy' ? 'polite' : undefined} aria-label="Restauração do vídeo">
        <div className="fr-sum">
          <Icone tom={faixa.icone ?? faixa.tom} />
          <div><span className="fr-lbl">{faixa.lbl}</span> <span className="fr-rest">{faixa.resumo}</span></div>
        </div>
        <ul className="fr-rows">
          {faixa.linhas.map(l => (
            <li key={l.campo} className={`fr-row ${l.tom}`}>
              <Icone tom={l.icone ?? l.tom} />
              <span className="fr-f">{l.rotulo}</span>
              <span className="fr-d"><TextoComHora linha={l} /></span>
            </li>
          ))}
        </ul>
        {faixa.ajuda ? <p className="fr-fine">{faixa.ajuda}</p> : null}
        {faixa.linkStudio ? (
          <div><a className="fr-lnk" href={faixa.linkStudio} target="_blank" rel="noopener noreferrer">{faixa.linkRotulo ?? 'Abrir no YouTube Studio'}</a></div>
        ) : null}
        {faixa.fine ? <p className="fr-fine">{faixa.fine}</p> : null}
      </div>
    </div>
  )
}
