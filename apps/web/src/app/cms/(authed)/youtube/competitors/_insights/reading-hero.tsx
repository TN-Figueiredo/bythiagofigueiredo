'use client'
/**
 * "Leitura da forja" — the Insights hero (port of insights.html renderForja/readingHTML). Each reading block carries its
 * OWN seal directly above its LITERAL text; site sentences ("Desde então", notes, evidence) live outside the seals in
 * Inter. "Copiar texto da leitura" lives in the menu ⋯ (chrome; forja-view-model readingCopyText). Everything comes
 * from the view model.
 */
import Link from 'next/link'
import type { HeroBlock, HeroPara, HeroReadingView, InsightsHero } from './view-model'

const RUNBOOK = 'https://github.com/TN-Figueiredo/bythiagofigueiredo/blob/staging/docs/ops/forja-fila-inteligencia-runbook.md'
const STAMP = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 6h9l3-2v3l-3 1v1H5L2 6z" /><path d="M6 9v3M9 9v3M4 13h7" /></svg>
)

function Para({ p }: { p: HeroPara }) {
  if (typeof p === 'string') return <p>{p}</p>
  return <p>{p.before}<a href={RUNBOOK} target="_blank" rel="noopener noreferrer">runbook da forja</a>{p.after}</p>
}

/** The last word stays glued to its evidence number (insights.html blockHTML). */
function Sup({ text, n, pre }: { text: string; n: number | null; pre: string }) {
  if (!n) return <>{text}</>
  const i = text.lastIndexOf(' ')
  return <>{text.slice(0, i + 1)}<span className="nw">{text.slice(i + 1)}<sup><a href={'#' + pre + 'ev' + n} aria-label={'Evidência ' + n}>{n}</a></sup></span></>
}

function Blocks({ blocks, pre }: { blocks: HeroBlock[]; pre: string }) {
  return (
    <>
      {blocks.map(b => (
        <div key={b.src}>
          <div className="sealrow"><span className="stamp sm" data-seal-of={b.src}>{STAMP}{b.seal}</span></div>
          <div className="rtext" data-reading-id={b.src}>
            {b.parts.map((pt, i) => pt.kind === 'ul'
              ? <ul className="ritems" key={i}>{pt.items.map((it, j) => <li key={j}><Sup text={it.text} n={it.ev} pre={pre} /></li>)}</ul>
              : <p key={i}><Sup text={pt.text} n={pt.ev} pre={pre} /></p>)}
          </div>
        </div>
      ))}
    </>
  )
}

export function ReadingView({ hero, v, mode }: { hero: InsightsHero; v: HeroReadingView; mode?: 'old' }) {
  const pre = mode ?? ''
  return (
    <div className={'reading' + (mode ? ' old' : '')} data-reading={mode ? undefined : ''} data-reading-of={v.id}>
      <div className="rmain">
        <div className="prose"><Blocks blocks={v.shown} pre={pre} /></div>
        <div className="rside">
          {v.notes.map(n => <p key={n} className="caveat">{n}</p>)}
          <div className="since">
            <span className="snote">{hero.noteLabel}</span>
            {v.since.map(x => (
              <div className="sl" key={x.label}><b>{x.label}:</b> {x.shortText ?? 'sem comparação com os dados de hoje'}{x.text ? <> <details><summary>ver detalhes</summary><p>{x.text}</p></details></> : null}</div>
            ))}
          </div>
        </div>
      </div>
      <details className="more">
        <summary>{hero.moreLabel}</summary>
        <div className="moregrid">
          <div>
            <div className="prose"><Blocks blocks={v.more} pre={pre} /></div>
            <p className="caveat">{hero.caveat}</p>
          </div>
          <aside className="evid" aria-label="Evidências">
            <h3>Evidências</h3>
            {v.ev.length ? (
              <ol>{v.ev.map(e => (
                <li key={e.n} id={pre + 'ev' + e.n} data-src={e.src}><span className="k">{e.n}</span><span>{e.text}<br /><Link href={e.href} data-n={e.count}>{e.label}</Link></span></li>
              ))}</ol>
            ) : <p>Esta leitura não cita evidência que o Outliers possa abrir.</p>}
            <p style={{ margin: '12px 0 0', color: 'var(--muted)' }}>Os links abrem o Outliers com o mesmo escopo da leitura (canais e janela) e os números de hoje; o que a leitura viu está no texto de cada evidência.</p>
          </aside>
        </div>
      </details>
    </div>
  )
}

export function ReadingHero({ hero }: { hero: InsightsHero }) {
  return (
    <section className="card forja c12" id="forjaCard" aria-labelledby="forjaH" data-forja-anchor="" tabIndex={-1}>
      <div className="forja-top">
        <h2 id="forjaH">Leitura da forja</h2>
        {hero.statusChip ? (
          <span className="status" role="status"><i style={{ background: hero.statusChip.dot }} className={hero.statusChip.pulse ? 'pulse' : undefined} aria-hidden="true" />{hero.statusChip.text}</span>
        ) : null}
      </div>
      {hero.quotaLine ? <p className="scopenote" id="quotaMsg">{hero.quotaLine}</p> : null}
      {hero.scopeNote ? <p className="scopenote">{hero.scopeNote}</p> : null}
      {hero.box ? (
        <div className="statebox">
          <h3>{hero.box.title}</h3>
          {hero.box.paras.map((p, i) => <Para key={i} p={p} />)}
          {hero.box.steps ? (
            <ol className="steps" aria-label="Andamento">
              <li className="done"><i>✓</i>Retrato dos dados</li>
              <li className="now" aria-current="step"><i className="pulse" />Gemma 12B escrevendo</li>
              <li><i />Validador confere os números</li>
              <li><i />Publicado</li>
            </ol>
          ) : null}
          {hero.box.stillNone ? <p>{hero.box.stillNone}</p> : null}
        </div>
      ) : null}
      {hero.publishedNote ? <p className="scopenote">{hero.publishedNote}</p> : null}
      {hero.view && !hero.prevLabel ? <ReadingView hero={hero} v={hero.view} /> : null}
      {hero.view && hero.prevLabel ? (
        <details className="prev"><summary>{hero.prevLabel}</summary><ReadingView hero={hero} v={hero.view} mode="old" /></details>
      ) : null}
    </section>
  )
}
