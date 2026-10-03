/** Draws the view model's rich text: plain strings, bold numbers (JetBrains Mono) and bold labels. */
import { Fragment } from 'react'
import type { Rich } from './view-model'

export function RichText({ r }: { r: Rich }) {
  return (
    <>
      {r.map((x, i) => typeof x === 'string' ? <Fragment key={i}>{x}</Fragment>
        : 'num' in x ? <strong key={i} className="num">{x.num}</strong>
        : <b key={i}>{x.b}</b>)}
    </>
  )
}
