'use client'
/**
 * Filters that came with the link: applied ones (tema, fórmula, canal, mínimo), the reading reference
 * ("Link da leitura de DD/MM: ela via N; hoje são M") and the unknown ones, which are ignored and shown dashed.
 * Every chip is removable: its ✕ navigates to the same screen without that parameter.
 */
import Link from 'next/link'
import type { OutliersView } from './view-model'

export function ParamChips({ v }: { v: OutliersView }) {
  if (!v.chips.length && !v.chipsLead) return null
  return (
    <div className="obs-out-chips" role="group" aria-label="Filtros vindos do link">
      {v.chipsLead ? <span className="obs-out-from">{v.chipsLead}</span> : null}
      {v.chips.map((c, i) => (
        <span key={c.kind + c.key + i} className={'obs-out-chip' + (c.invalid ? ' obs-out-bad' : '') + (c.kind === 'asof' ? ' obs-out-asof' : '') + (c.kind === 'pick' ? ' obs-out-pick' : '')}
          data-chip={c.key} data-invalid={c.invalid ? '' : undefined} title={c.title}>
          {c.kind === 'link' ? <b>{c.label}</b> : c.label}
          {c.link ? <>{' '}<Link className="obs-out-lk32" href={c.link.href}>{c.link.label}</Link></> : null}
          {c.picks?.map(pk => <Link key={pk.href} className="obs-out-pickbtn" href={pk.href} scroll={false}>{pk.label}</Link>)}
          <Link className="obs-out-x-btn" href={c.removeHref} scroll={false} aria-label={c.removeLabel}>✕</Link>
        </span>
      ))}
    </div>
  )
}
