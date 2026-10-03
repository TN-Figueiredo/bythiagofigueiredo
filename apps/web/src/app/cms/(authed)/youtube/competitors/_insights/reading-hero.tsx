'use client'
/**
 * "Leitura da forja" — the Insights hero (port of insights.html renderForja/readingHTML). Each reading block carries its
 * OWN seal directly above its LITERAL text; site sentences ("Desde então", notes, evidence) live outside the seals in
 * Inter. "Copiar texto da leitura" lives in the menu ⋯ (chrome; forja-view-model readingCopyText). Everything comes
 * from the view model.
 */
import Link from 'next/link'
import type { ForjaReadingView } from '../_chrome/forja-view-model'
import type { HeroPara, InsightsHero } from './view-model'

const RUNBOOK = 'https://github.com/TN-Figueiredo/bythiagofigueiredo/blob/staging/docs/ops/forja-fila-inteligencia-runbook.md'
const STAMP = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M2 6h9l3-2v3l-3 1v1H5L2 6z" /><path d="M6 9v3M9 9v3M4 13h7" /></svg>
)

function Para({ p }: { p: HeroPara }) {
  if (typeof p === 'string') return <p>{p}</p>
  return <p>{p.before}<a href={RUNBOOK} target="_blank" rel="noopener noreferrer">runbook da forja</a>{p.after}</p>
}

function Block({ r, items }: { r: ForjaReadingView; items: string[] }) {
  return (
    <>
      <div className="sealrow"><span className="stamp sm" data-seal-of={r.id}>{STAMP}{r.seal}</span></div>
      <div className="rtext" data-reading-id={r.id}>
        {r.lead ? <p>{r.lead}</p> : null}
        {items.length ? <ul className="ritems">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
      </div>
    </>
  )
}

function Since({ r }: { r: ForjaReadingView }) {
  if (!r.since) return <div className="sl"><b>{r.sinceLabel}:</b> sem comparação com os dados de hoje</div>
  return <div className="sl"><b>{r.sinceLabel}:</b> {r.since.shortText} <details><summary>ver detalhes</summary><p>{r.since.text}</p></details></div>
}

export function ReadingView({ hero, r, themes, mode }: { hero: InsightsHero; r: ForjaReadingView; themes: ForjaReadingView | null; mode?: 'old' }) {
  return (
    <div className={'reading' + (mode ? ' old' : '')} data-reading={mode ? undefined : ''} data-reading-of={r.id}>
      <div className="rmain">
        <div className="prose">
          {themes ? <Block r={themes} items={[]} /> : null}
          <Block r={r} items={r.keyItems} />
        </div>
        <div className="rside">
          {r.siteNotes.map(n => <p key={n} className="caveat">{n}</p>)}
          <div className="since">
            <span className="snote">{hero.noteLabel}</span>
            {themes ? <Since r={themes} /> : null}
            <Since r={r} />
          </div>
        </div>
      </div>
      <details className="more">
        <summary>{hero.moreLabel}</summary>
        <div className="moregrid">
          <div>
            <div className="prose">
              {r.moreItems.length || r.theme ? (
                <>
                  <div className="sealrow"><span className="stamp sm">{STAMP}{r.seal}</span></div>
                  <div className="rtext">
                    {r.moreItems.length ? <ul className="ritems">{r.moreItems.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
                    {r.theme ? <p>{r.theme}</p> : null}
                  </div>
                </>
              ) : null}
            </div>
            <p className="caveat">{hero.caveat}</p>
          </div>
          <aside className="evid" aria-label="Evidências">
            <h3>Evidências</h3>
            {r.evidenceLinks.length ? (
              <ol>{r.evidenceLinks.map((e, i) => (
                <li key={e.href} id={(mode ?? '') + 'ev' + (i + 1)}><span className="k">{i + 1}</span><span>{e.text}<br /><Link href={e.href} data-n={e.n}>{e.label}</Link></span></li>
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
      {hero.reading && !hero.prevLabel && (!hero.box || !hero.box.title) ? <ReadingView hero={hero} r={hero.reading} themes={hero.themes} /> : null}
      {hero.reading && hero.prevLabel ? (
        <details className="prev"><summary>{hero.prevLabel}</summary><ReadingView hero={hero} r={hero.reading} themes={hero.themes} mode="old" /></details>
      ) : null}
    </section>
  )
}
