'use client'
/** Thumbnails, Títulos and Descrições: every version in order, with its period and views/day (port of renderVersions). */
import { useState } from 'react'
import type { LaneType, RunNoteView, VersionView, VersionsView } from './view-model'
import type { Hl } from './lanes'
import { HIcon } from './icons'
import { Thumb } from './thumb'

const cap = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : '')

function RunNote({ note, color }: { note: RunNoteView; color: string }) {
  return (
    <div className="note seq">
      <span style={{ color }}><HIcon name="ab" /></span>
      <div>
        <ul>{note.items.map((it, i) => <li key={i}><b>{it.strong}</b>{it.text}</li>)}</ul>
        <span>{note.def}</span>
      </div>
    </div>
  )
}

export function Versions({ versions, hl, onHl, expanded = false, onToggle, target = null, onTargetBlur }: {
  versions: VersionsView; hl: Hl | null; onHl: (h: Hl | null) => void
  /** The thumbnail grid shows every period (state lives in the screen: a lane click on a hidden period opens it). */
  expanded?: boolean; onToggle?: () => void
  /** "type:i" of the card a lane click led to: it keeps its own ring until the focus leaves. */
  target?: string | null; onTargetBlur?: () => void
}) {
  const is = (type: LaneType, i: number, list: VersionView[]) => !!hl && hl.type === type
    && (hl.label != null ? type === 'thumb' && list[i]?.label === hl.label : hl.i === i || (type === 'thumb' && list[i]?.label === list[hl.i]?.label))
  const bind = (type: LaneType, i: number) => ({
    'data-ver': type + ':' + i, tabIndex: -1,
    onMouseEnter: () => onHl({ type, i, ev: i > 0 ? i : null }), onFocus: () => onHl({ type, i, ev: i > 0 ? i : null }),
    onMouseLeave: () => onHl(null), onBlur: () => { onHl(null); if (target === type + ':' + i) onTargetBlur?.() },
  })
  const tcls = (type: LaneType, i: number) => (target === type + ':' + i ? ' target' : '')
  const { thumbs, titles, descs } = versions
  const cards = thumbs.cards.map((t, i) => ({ t, i })).filter(q => q.t.inRange)
  const hiddenN = thumbs.more && !expanded ? Math.max(0, cards.length - thumbs.more.keep) : 0
  // the highlighted image may have cards the collapsed grid hides: say so where the button is
  const hlLabel = hl && hl.type === 'thumb' ? hl.label ?? thumbs.cards[hl.i]?.label ?? null : null
  const hiddenHl = hlLabel ? cards.slice(0, hiddenN).filter(q => q.t.label === hlLabel).length : 0
  return (
    <>
      <section className="card versions" aria-labelledby="hv-thh">
        <div className="sec-h"><h3 id="hv-thh">Thumbnails</h3><span className="src">{thumbs.src}</span></div>
        {thumbs.notes.map((n, i) => (
          <div key={i} className="note">
            <span style={{ color: n.kind === 'ab' ? 'var(--t-thumb)' : 'var(--warning-text)' }}><HIcon name={n.kind === 'ab' ? 'ab' : 'warn'} /></span><span>{n.text}</span>
          </div>
        ))}
        {thumbs.runNote ? <RunNote note={thumbs.runNote} color="var(--t-thumb)" /> : null}
        {thumbs.more ? (
          <div className="more-row">
            <button className="btn" type="button" id="hv-more" aria-expanded={expanded} aria-controls="hv-film" onClick={onToggle}>
              <HIcon name="chev" />{expanded ? thumbs.more.close : thumbs.more.open}
            </button>
            <span className="src">{expanded ? thumbs.more.srcOpen : thumbs.more.srcClosed}</span>
            <span className="src" id="hv-hlnote" role="status">
              {hiddenHl ? hiddenHl + (hiddenHl === 1 ? ' cartão' : ' cartões') + ' da imagem ' + hlLabel + (hiddenHl === 1 ? ' está recolhido.' : ' estão recolhidos.') : ''}
            </span>
          </div>
        ) : null}
        <div className="film" id="hv-film">
          {cards.map(({ t, i }, j) => (
            <div key={t.id} className={'fcard' + (is('thumb', i, thumbs.cards) ? ' is-hl' : '') + tcls('thumb', i)} role="group" aria-label={'Thumbnail ' + t.label + ', ' + t.span}
              data-img={t.label} hidden={j < hiddenN} {...bind('thumb', i)}>
              {t.thumb ? <Thumb t={t.thumb} /> : null}
              <div className="meta">
                <div className="vt"><span>Versão {t.label}</span>{t.tag ? <span className={'tag ' + t.tag.kind}>{t.tag.text}</span> : null}</div>
                <span className="mono">{cap(t.span)}</span>
                <span>no ar por {t.dur}</span>
                <span>média de views/dia: {t.rate}</span>
              </div>
            </div>
          ))}
        </div>
        {thumbs.empty ? <p className="src" style={{ marginTop: 10 }}>{thumbs.empty}</p> : null}
      </section>
      <div className="two">
        <section className="card versions" aria-labelledby="hv-tih">
          <div className="sec-h"><h3 id="hv-tih">Títulos</h3><span className="src">{titles.src}</span></div>
          {titles.same ? <p className="src" style={{ margin: '8px 0 0' }}>{titles.same}</p> : null}
          {titles.runNote ? <RunNote note={titles.runNote} color="var(--t-title)" /> : null}
          <ol className="tlist">
            {titles.items.map((t, i) => !t.inRange ? null : (
              <li key={t.id} className={((is('title', i, titles.items) ? 'is-hl' : '') + tcls('title', i)).trim() || undefined} {...bind('title', i)}>
                <span className="id">{t.label}</span>
                <span className="txt">{t.titleDiff ? <TitleDiff d={t.titleDiff} /> : t.clipText}</span>
                <span className="m"><span>{cap(t.span)}</span><span>no ar por {t.dur}</span><span>média de views/dia: {t.rate}</span>{t.cur && t.tag ? <span style={{ color: 'var(--success)' }}>{t.tag.text}</span> : null}</span>
              </li>
            ))}
          </ol>
        </section>
        <Descs descs={descs} is={i => is('desc', i, descs.rows)} bind={i => bind('desc', i)} tcls={i => tcls('desc', i)} />
      </div>
    </>
  )
}

function TitleDiff({ d }: { d: NonNullable<VersionView['titleDiff']> }) {
  return (
    <>
      {d.after.map((s, i) => s.op === 'add' ? <ins key={i}>{s.text}</ins>
        : s.op === 'move' ? <span key={i} className="mv" title={s.title ?? undefined}>{s.text}</span>
          : s.op === 'case' ? <span key={i} className="cs" title={s.title ?? undefined}>{s.text}</span>
            : <span key={i}>{s.text}</span>)}
      {d.gone.length ? <span className="gone">{d.gone.map((g, i) => g.kind === 'del' ? <del key={i}>{g.text}</del> : g.kind === 'ins' ? <ins key={i}>{g.text}</ins> : <span key={i}>{g.text}</span>)}</span> : null}
    </>
  )
}

function Descs({ descs, is, bind, tcls }: { descs: VersionsView['descs']; is: (i: number) => boolean; bind: (i: number) => Record<string, unknown>; tcls: (i: number) => string }) {
  const [shown, setShown] = useState<Record<number, boolean>>({})
  return (
    <section className="card versions" aria-labelledby="hv-deh" id="hv-desc">
      <div className="sec-h"><h3 id="hv-deh" tabIndex={-1}>Descrições</h3><span className="src">{descs.src}</span></div>
      <div className="dver">
        {descs.rows.map((d, i) => !d.inRange ? null : (
          <div key={d.id} className={((is(i) ? 'is-hl' : '') + tcls(i)).trim() || undefined} {...bind(i)}>
            <span><b>{d.label}</b>{cap(d.span)}{d.noText ? ' (texto não guardado)' : ''}</span>
            <span>no ar por {d.dur}{d.cur && d.tag ? <> <span style={{ color: 'var(--success)' }}>{d.tag.text}</span></> : null}</span>
          </div>
        ))}
      </div>
      {descs.same ? <p className="src" style={{ marginTop: 10 }}>{descs.same}</p> : null}
      {descs.notes.map((n, i) => <div key={i} className="note"><span style={{ color: 'var(--warning-text)' }}><HIcon name="warn" /></span><span>{n}</span></div>)}
      {descs.diffs.map((df, k) => {
        const noise = !!shown[k]
        return (
          <div key={k}>
            <div className="dhead">
              <span className="dsum">{df.sum}</span>
              <label className="toggle"><input type="checkbox" checked={!noise} onChange={e => setShown(s => ({ ...s, [k]: !e.target.checked }))} />Ocultar mudanças só de link/UTM</label>
            </div>
            <details className="expander" open>
              <summary className="src">Ver a comparação linha a linha</summary>
              <div className={'diff' + (noise ? ' shownoise' : '')}>
                {df.rows.map((r, i) => r.kind === 'fold' ? <div key={i} className="fold">{r.text}</div>
                  : r.kind === 'utm' ? [
                    <div key={i + 'r'} className="ln rem noise"><span aria-hidden="true">−</span><span><span className="sr">removida: </span>{r.from}</span></div>,
                    <div key={i + 'a'} className="ln add noise"><span aria-hidden="true">+</span><span><span className="sr">adicionada: </span>{r.from}<span className="utm">{r.extra}</span></span></div>,
                  ]
                    : r.kind === 'ctx' ? <div key={i} className="ln ctx"><span aria-hidden="true" /><span>{r.text || '\u00A0'}</span></div>
                      : <div key={i} className={'ln ' + r.kind}><span aria-hidden="true">{r.kind === 'add' ? '+' : '−'}</span><span><span className="sr">{r.kind === 'add' ? 'adicionada' : 'removida'}: </span>{r.text}</span></div>)}
                {df.utmNote && !noise ? <div className="fold">{df.utmNote}</div> : null}
              </div>
            </details>
          </div>
        )
      })}
    </section>
  )
}
