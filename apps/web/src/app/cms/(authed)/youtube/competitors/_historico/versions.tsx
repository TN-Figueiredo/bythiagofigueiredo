'use client'
/** Thumbnails, Títulos and Descrições: every version in order, with its period and views/day (port of renderVersions). */
import { useState } from 'react'
import type { LaneType, VersionView, VersionsView } from './view-model'
import type { Hl } from './lanes'
import { HIcon } from './icons'
import { Thumb } from './thumb'

const cap = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : '')

export function Versions({ versions, hl, onHl }: { versions: VersionsView; hl: Hl | null; onHl: (h: Hl | null) => void }) {
  const is = (type: LaneType, i: number, list: VersionView[]) => !!hl && hl.type === type && (hl.i === i || (type === 'thumb' && list[i]?.label === list[hl.i]?.label))
  const bind = (type: LaneType, i: number) => ({
    'data-ver': type + ':' + i, tabIndex: -1,
    onMouseEnter: () => onHl({ type, i, ev: i > 0 ? i : null }), onFocus: () => onHl({ type, i, ev: i > 0 ? i : null }),
    onMouseLeave: () => onHl(null), onBlur: () => onHl(null),
  })
  const { thumbs, titles, descs } = versions
  return (
    <>
      <section className="card versions" aria-labelledby="hv-thh">
        <div className="sec-h"><h3 id="hv-thh">Thumbnails</h3><span className="src">{thumbs.src}</span></div>
        <div className="film">
          {thumbs.cards.map((t, i) => (
            <div key={t.id} className={'fcard' + (is('thumb', i, thumbs.cards) ? ' is-hl' : '')} role="group" aria-label={'Thumbnail ' + t.label + ', ' + t.span} {...bind('thumb', i)}>
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
        {thumbs.notes.map((n, i) => (
          <div key={i} className="note">
            <span style={{ color: n.kind === 'ab' ? 'var(--t-thumb)' : 'var(--warning-text)' }}><HIcon name={n.kind === 'ab' ? 'ab' : 'warn'} /></span><span>{n.text}</span>
          </div>
        ))}
      </section>
      <div className="two">
        <section className="card versions" aria-labelledby="hv-tih">
          <div className="sec-h"><h3 id="hv-tih">Títulos</h3><span className="src">{titles.src}</span></div>
          {titles.same ? <p className="src" style={{ margin: '8px 0 0' }}>{titles.same}</p> : null}
          <ol className="tlist">
            {titles.items.map((t, i) => (
              <li key={t.id} className={is('title', i, titles.items) ? 'is-hl' : undefined} {...bind('title', i)}>
                <span className="id">{t.label}</span>
                <span className="txt">{t.titleDiff ? <TitleDiff d={t.titleDiff} /> : t.clipText}</span>
                <span className="m"><span>{cap(t.span)}</span><span>no ar por {t.dur}</span><span>média de views/dia: {t.rate}</span>{t.cur && t.tag ? <span style={{ color: 'var(--success)' }}>{t.tag.text}</span> : null}</span>
              </li>
            ))}
          </ol>
        </section>
        <Descs descs={descs} is={i => is('desc', i, descs.rows)} bind={i => bind('desc', i)} />
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

function Descs({ descs, is, bind }: { descs: VersionsView['descs']; is: (i: number) => boolean; bind: (i: number) => Record<string, unknown> }) {
  const [shown, setShown] = useState<Record<number, boolean>>({})
  return (
    <section className="card versions" aria-labelledby="hv-deh" id="hv-desc">
      <div className="sec-h"><h3 id="hv-deh" tabIndex={-1}>Descrições</h3><span className="src">{descs.src}</span></div>
      <div className="dver">
        {descs.rows.map((d, i) => (
          <div key={d.id} className={is(i) ? 'is-hl' : undefined} {...bind(i)}>
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
