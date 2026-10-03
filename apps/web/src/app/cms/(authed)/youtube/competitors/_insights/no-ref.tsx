import Link from 'next/link'
import type { NoRefBlock } from './view-model'

/** Ruling R78: a niche with own channels and no competitor — the sentence and the link, in place of the comparison. */
export function NoRef({ b }: { b: NoRefBlock }) {
  return (
    <div className="empty" data-noref="">
      <p>{b.text}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link className="btn" href={b.link.href}>{b.link.text}</Link></div>
    </div>
  )
}
