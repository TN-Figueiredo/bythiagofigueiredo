'use client'
/** Freshness line + "Frescor por canal" popover (port of chrome.js headHtml fresh row + freshPopHtml). */
import Link from 'next/link'
import type { RefObject } from 'react'
import type { ChromeView } from './view-model'
import { Icon } from './icons'

export function Freshness({ fresh, tzLabel, open, btnRef, boxRef, onToggle, onSync, syncing }: {
  fresh: ChromeView['fresh']; tzLabel: string; open: boolean
  btnRef: RefObject<HTMLButtonElement | null>; boxRef: RefObject<HTMLDivElement | null>
  onToggle: () => void; onSync: () => void; syncing: boolean
}) {
  const n = fresh.problems.length
  return (
    <div className="obs-ch-fresh-row">
      <div className="obs-ch-fresh" ref={boxRef}>
        <button ref={btnRef} type="button" aria-expanded={open} aria-controls={open ? 'obs-ch-fresh-pop' : undefined} onClick={onToggle}>
          <span className="obs-ch-sr">Frescor dos dados: </span>
          <span className="obs-ch-seg">
            <span className={'obs-ch-dot' + (n ? ' obs-ch-warn' : '')} aria-hidden="true" />
            <b>{fresh.channelsText}</b>
            {fresh.totalText ? <span className="obs-ch-long">{fresh.totalText}</span> : null}
          </span>
          <span className="obs-ch-sep" aria-hidden="true" /><span className="obs-ch-sr">, </span>
          <span className="obs-ch-seg" title={fresh.syncTitle}>{fresh.syncText}</span>
          <span className="obs-ch-sep" aria-hidden="true" /><span className="obs-ch-sr">, </span>
          {n ? (
            <span className="obs-ch-seg obs-ch-err" data-fresh-probs={n} title={fresh.problemsTitle ?? undefined}>
              {Icon.warn()}
              <span className="obs-ch-long">{fresh.problemsText}</span>
              <span className="obs-ch-short" aria-hidden="true">{fresh.problemsShort}</span>
            </span>
          ) : <span className="obs-ch-seg" data-fresh-probs="0">todos em dia</span>}
          {Icon.chev()}
        </button>
        {open ? <FreshPopover fresh={fresh} onSync={onSync} syncing={syncing} /> : null}
      </div>
      <span className="obs-ch-tz">{tzLabel}</span>
    </div>
  )
}

function FreshPopover({ fresh, onSync, syncing }: { fresh: ChromeView['fresh']; onSync: () => void; syncing: boolean }) {
  const bad = fresh.rows.filter(r => r.bad), ok = fresh.rows.filter(r => !r.bad)
  const row = (r: ChromeView['fresh']['rows'][number]) => (
    <tr key={r.id} className={r.bad ? 'obs-ch-bad' : undefined}>
      <td>{r.name}{r.nicheLabel ? <> <span className={'obs-ch-nic-' + r.niche}>{r.nicheLabel}</span></> : null}</td>
      <td className="obs-ch-m">{r.situation}</td>
      <td className="obs-ch-num">
        {r.last == null ? <><span aria-hidden="true">—</span><span className="obs-ch-sr">{r.bad ? 'data na coluna Situação' : 'sem sincronização'}</span></> : r.last}
      </td>
    </tr>
  )
  return (
    <div className="obs-ch-pop" id="obs-ch-fresh-pop" role="dialog" aria-label="Frescor por canal">
      <h3>Frescor por canal</h3>
      <p className="obs-ch-sub">{fresh.popoverSub}</p>
      <div className="obs-ch-pop-scroll" tabIndex={0} role="region" aria-label="Canais e última sincronização">
        <table>
          <thead><tr><th scope="col">Canal</th><th scope="col">Situação</th><th scope="col">Última sincronização</th></tr></thead>
          <tbody>
            {bad.length ? <tr className="obs-ch-grp"><td colSpan={3}>Com problema ({bad.length})</td></tr> : null}
            {bad.map(row)}
            {bad.length ? <tr className="obs-ch-grp"><td colSpan={3}>Em dia ({ok.length})</td></tr> : null}
            {ok.map(row)}
          </tbody>
        </table>
      </div>
      <div className="obs-ch-pop-acts">
        <button className="obs-ch-btn" type="button" onClick={onSync} aria-disabled={syncing || undefined}>{Icon.sync()}Sincronizar concorrentes</button>
        {bad.length ? <Link className="obs-ch-btn obs-ch-ghost" href={fresh.problemsHref}>Ver os canais com problema</Link> : null}
      </div>
    </div>
  )
}
