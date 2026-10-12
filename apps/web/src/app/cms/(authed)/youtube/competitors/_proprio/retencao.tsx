'use client'
/**
 * A aba Retenção = "% assistido" do canal próprio (A4 13.3; mockup 5 de 12/10). Recebe o modelo JÁ montado (`buildRetencao`): texto pronto e frações da barra,
 * nada de banco nem de número privado cru (sem permissão a view traz só a frase). Duas tabelas (o normal por faixa de duração e os vídeos), com legenda e
 * cabeçalhos de escopo; a 700 px a tabela de vídeos vira cartões (`.rcards`), sem rolagem lateral. A barra é o % assistido (recortada em 100% no desenho, com a
 * marca em forma de seta quando passa de 100), a marca vertical é o normal da faixa. Acima/abaixo/na média: sinal E palavra, nunca só cor.
 * O `Link` é importado aqui, no módulo cliente (Next 16: nenhum Link chega por prop).
 */
import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { METODO_ASSISTIDO, type ContraFaixa, type LinhaVideo, type RetencaoView } from './retencao-model'
import './retencao.css'

const CLASSE: Record<ContraFaixa['leitura'], string> = { acima: 'up', abaixo: 'dn', 'na-media': 'eq', sem: '' }

function Contra({ c }: { c: ContraFaixa }) {
  if (c.leitura === 'sem') return <span className="mut">{c.texto}</span>
  // "+4 pontos" / "−4 pontos" / "=" : o sinal e a palavra vão juntos, a cor só reforça
  const pt = c.leitura === 'na-media' ? '=' : `${c.sinal}${c.pontos}`
  return <span className={'cmp ' + CLASSE[c.leitura]}><span className="pt">{pt}</span><span className="w">{c.texto}</span></span>
}

function Barra({ v }: { v: LinhaVideo }) {
  return (
    <>
      <span className={'mini' + (v.acimaDe100 ? ' over' : '')} aria-hidden="true">
        <i style={{ width: `${Math.round(v.barra * 100)}%` }} />
        {v.normalPos != null ? <s style={{ left: `${Math.round(v.normalPos * 100)}%` }} /> : null}
      </span>
      <b className="num">{v.pct}</b>
      {v.acimaDe100 ? <span className="obs-ch-sr"> ({v.alt})</span> : null}
      {v.nViews ? <span className="mut"> ({v.nViews})</span> : null}
    </>
  )
}

const ALVO_SR = 'views acima do normal do canal e % assistido abaixo do normal da faixa'

/** As legendas das duas tabelas; as áreas com rolagem horizontal levam o mesmo texto como nome (entram no Tab para a rolagem por teclado). */
const LEGENDA_FAIXAS = 'Normal de % assistido por faixa de duração'
const LEGENDA_VIDEOS = 'Vídeos com % assistido, contra o normal da faixa de duração'

export function Retencao({ view }: { view: RetencaoView }) {
  const baseId = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const popId = 'ass' + baseId
  const btn = useRef<HTMLButtonElement>(null)
  const [info, setInfo] = useState(false)
  return (
    <section className="ct-sec ret" aria-labelledby="pr-h2">
      <h2 id="pr-h2" className="ct-h2" tabIndex={-1}>
        {view.titulo}
        <button ref={btn} type="button" className="ret-info" aria-label="De onde vem o % assistido" aria-expanded={info} aria-controls={popId} onClick={() => setInfo(o => !o)}>{Icon.info()}</button>
      </h2>
      <Popover open={info} anchor={() => btn.current} onClose={() => setInfo(false)} id={popId} role="dialog" labelledBy={popId + 't'} className="ic-pop" pref="baixo" align="fim" maxW={380}>
        <h3 id={popId + 't'}>De onde vem o % assistido</h3>
        <ul>{METODO_ASSISTIDO.map(p => <li key={p}>{p}</li>)}</ul>
      </Popover>
      <p className="ret-nota">{view.nota}</p>
      {view.vazio ? (
        <div className="ret-vazio"><p>{view.vazio}</p></div>
      ) : (
        <>
          <div className="tbw ret-faixas" tabIndex={0} role="region" aria-label={LEGENDA_FAIXAS}>
            <table className="tb">
              <caption className="obs-ch-sr">{LEGENDA_FAIXAS}</caption>
              <thead><tr><th scope="col">Faixa de duração</th><th scope="col" className="r">Vídeos</th><th scope="col">Normal da faixa (mediana de % assistido)</th></tr></thead>
              <tbody>
                {view.faixas.map(f => (
                  <tr key={f.rotulo}>
                    <th scope="row">{f.rotulo}</th>
                    <td className="r num">{f.videos}</td>
                    <td>
                      {f.normal != null ? <b className="num">{f.normal}</b>
                        : f.estado === 'sem-views' ? <><span className="obs-ch-nm">não medido</span> <span className="mut">{f.texto}</span></>
                          : <span className="mut">{f.texto}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.relance ? <p className="ret-lead">{view.relance.negrito ? <b>{view.relance.negrito}</b> : null}{view.relance.resto}</p> : null}
          {view.semPercentual ? <p className="ret-sempct">{view.semPercentual}</p> : null}
          <div className="tbw rt" tabIndex={0} role="region" aria-label={LEGENDA_VIDEOS}>
            <table className="tb tb-v">
              <caption className="obs-ch-sr">{LEGENDA_VIDEOS}</caption>
              <thead><tr><th scope="col">Vídeo</th><th scope="col">Faixa</th><th scope="col" className="r">Views, 28 dias</th><th scope="col">% assistido</th><th scope="col">Contra a faixa</th></tr></thead>
              <tbody>
                {view.videos.map(v => (
                  <tr key={v.id} className={v.alvo ? 'alvo' : undefined}>
                    <td><Link className="lk" href={v.href} prefetch={false}>{v.titulo}</Link>{v.alvo ? <span className="obs-ch-sr"> ({ALVO_SR})</span> : null}</td>
                    <td>{v.faixa}</td>
                    <td className="r num"><span className="n28">{v.views28}</span>{v.cobertura ? <span className="mut ret-cob">{v.cobertura}</span> : null}</td>
                    <td><Barra v={v} /></td>
                    <td><Contra c={v.contra} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="rcards" aria-label="Vídeos com % assistido">
            {view.videos.map(v => (
              <li key={v.id} className={'rcard' + (v.alvo ? ' alvo' : '')}>
                <Link href={v.href} prefetch={false}>{v.titulo}</Link>
                {v.alvo ? <span className="obs-ch-sr">{ALVO_SR}</span> : null}
                <div className="l2"><span>{v.faixa}</span><span>{v.views28} views em 28 dias</span></div>
                {v.cobertura ? <div className="mut ret-cob">{v.cobertura}</div> : null}
                <div><Barra v={v} /></div>
                <div><Contra c={v.contra} /></div>
              </li>
            ))}
          </ul>
          <p className="rleg">
            <span><span className="mini" aria-hidden="true" style={{ width: 34, margin: 0 }}><i style={{ width: '55%' }} /><s style={{ left: '40%' }} /></span>a barra é o % assistido; a marca é o normal da faixa</span>
            <span className="cmp up"><span className="pt">+</span><span className="w">acima (3 pontos ou mais)</span></span>
            <span className="cmp eq"><span className="pt">=</span><span className="w">na média (até 2 pontos para cima ou para baixo)</span></span>
            <span className="cmp dn"><span className="pt">−</span><span className="w">abaixo (3 pontos ou mais)</span></span>
          </p>
        </>
      )}
    </section>
  )
}
