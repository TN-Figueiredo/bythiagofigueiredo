'use client'
/**
 * E5a T8 (mockup 17b): as peças das views aos 7 e aos 30 dias: a célula, a faixa de cobertura com a régua "Quando fecham", a linha do selo, o aviso de
 * erro e o ⓘ. Componentes sem estado; os textos vêm todos do modelo.
 */
import '../_chrome/medidas/medidas.css'
import { NaoMedido, ZeroMedido } from '../_chrome/medidas/marcas'
import { PastilhaAusencia } from '../_chrome/ausencia/pastilhas'
import type { CelulaDeIdadeView, IdadeView } from './view-model'

export function Selo() {
  return (
    <span className="obs-out-selo">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.8" /><path d="M4.7 4.7a4.7 4.7 0 0 0 0 6.6M11.3 4.7a4.7 4.7 0 0 1 0 6.6" /></svg>
      ao vivo ou estreia
    </span>
  )
}

/** A célula de uma idade: medido (número e barra), zero medido (caixa vazada), não medido (hachura e motivo) ou não carregou (forma de erro). */
export function CelulaIdade({ c, idade }: { c: CelulaDeIdadeView; idade: 7 | 30 }) {
  if (c.kind === 'medido') {
    return (
      <div className="obs-out-vv" data-cel={idade} data-estado="medido">
        <span className="obs-out-vn obs-out-mono" title={c.dica ?? undefined}>{c.texto}</span>
        <span className="obs-out-vbar" aria-hidden="true"><i style={{ width: (c.pct ?? 0).toFixed(1) + '%' }} /></span>
        <span className="obs-out-sr">{c.aria}</span>
      </div>
    )
  }
  if (c.kind === 'zero') {
    return (
      <div data-cel={idade} data-estado="zero">
        <ZeroMedido /><span className="obs-out-vt">zero medido</span>
        <span className="obs-out-sr">{c.aria}</span>
      </div>
    )
  }
  if (c.kind === 'nao') {
    return <div data-cel={idade} data-estado="nao"><NaoMedido curta={c.curta ?? 'não medido'} longa={c.aria.replace(/^não medido: /, '')} /></div>
  }
  return (
    <div data-cel={idade} data-estado="erro">
      <PastilhaAusencia estado="falhou" motivo={c.aria.replace(/^falhou: /, '')} />
    </div>
  )
}

export function LinhaDoSelo({ aoVivo }: { aoVivo: NonNullable<IdadeView['aoVivo']> }) {
  return <p className="obs-out-fl" data-ao-vivo=""><Selo /><span>{aoVivo.texto}</span></p>
}

export function AvisoDeErro({ onTentar }: { onTentar: () => void }) {
  return (
    <div className="obs-out-ban" role="status" data-erro-idade="">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 6.5v3.4M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      <p><b>Não deu para carregar as views aos 7 e aos 30 dias.</b> O multiplicador e a ordem por multiplicador seguem valendo; só essas duas colunas ficaram de fora.</p>
      <button type="button" className="obs-out-btn" onClick={onTentar}>Tentar de novo</button>
    </div>
  )
}

export function NotaDeNenhumMedido({ voltar, onVoltar }: { voltar: NonNullable<IdadeView['voltar']>; onVoltar: (href: string) => void }) {
  return (
    <div className="obs-out-nota" data-nenhum-medido="">
      <button type="button" className="obs-out-btn" onClick={() => onVoltar(voltar.href)}>{voltar.texto}</button>
      <span>{voltar.explica}</span>
    </div>
  )
}

/** A faixa "Views na mesma idade": uma casa por outlier, na ordem exata da lista, uma faixa por idade; mais a régua do tempo e o ⓘ. */
export function Faixa({ idade }: { idade: IdadeView }) {
  if (!idade.colunas.length) return null
  return (
    <section className="obs-out-cob" aria-label="Quantos outliers têm as views na mesma idade" data-faixa="">
      <div className="obs-out-cob-h">
        <b>Views na mesma idade</b>
        <details className="obs-out-info">
          <summary aria-label="Como contamos as views aos 7 e aos 30 dias">ⓘ</summary>
          <ul>{idade.info.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </details>
      </div>
      <ul className="obs-out-cb">
        {idade.colunas.map(c => (
          <li key={c.idade} className="obs-out-cr" data-faixa-idade={c.idade}>
            <span className="obs-out-cn">{c.idade} dias{c.ordenada ? <span className="obs-out-ordm" title="a lista está nesta ordem">▼ ordem</span> : null}</span>
            <ol className="obs-out-cs" role="img" aria-label={c.aria}>
              {c.casas.map((k, i) => <li key={i} className={'obs-out-casa-' + k} aria-hidden="true">{k === 'zero' ? '0' : ''}</li>)}
            </ol>
            <span className="obs-out-cc"><b className="obs-out-mono">{c.medidos} de {c.total}</b> medidos{c.zeros ? ' (' + c.zeros + ' com zero medido)' : ''}</span>
            {c.motivos.length ? (
              <ul className="obs-out-cm" aria-label="Por que não foram medidos">
                {c.motivos.map(t => <li key={t}><i className="obs-ch-nm obs-out-nmq" aria-hidden="true" />{t}</li>)}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {idade.quando ? (
        <div className="obs-out-tl">
          <span className="obs-out-tl-t">Quando fecham</span>
          <div className="obs-out-tl-b" role="img" aria-label={idade.quando.aria}>
            <i className="obs-out-tl-hj" />
            {idade.quando.marcas.map((m, i) => <i key={i} className="obs-out-tl-m" style={{ left: m.pct + '%' }} />)}
            <span className="obs-out-tl-l obs-out-tl-i"><b>hoje</b> {idade.quando.hoje}</span>
            {idade.quando.rotulos.map(r => <span key={r.dm} className="obs-out-tl-l" style={{ left: r.pct + '%' }}>{r.dm}</span>)}
          </div>
        </div>
      ) : null}
      <ul className="obs-out-leg" aria-label="Legenda">
        <li><i className="obs-out-sw obs-out-sw-com" aria-hidden="true" />medido</li>
        <li><i className="obs-out-sw obs-out-sw-zero" aria-hidden="true" />zero medido: o vídeo tinha 0 views naquela idade</li>
        <li><i className="obs-out-sw obs-ch-nm obs-out-nmq" aria-hidden="true" />não medido: o motivo vem abaixo da faixa</li>
      </ul>
    </section>
  )
}
