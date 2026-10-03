import type { Rich } from './view-model'

/** Renders the view model's rich text: plain, bold and monospace numbers (no number is computed here). */
export function RichText({ parts }: { parts: Rich }) {
  return (
    <>
      {parts.map((p, i) => typeof p === 'string' ? <span key={i}>{p}</span>
        : 'b' in p ? <b key={i}>{p.b}</b>
        : 'mono' in p ? <span key={i} className="mono">{p.mono}</span>
        : <b key={i} className="mono">{p.bmono}</b>)}
    </>
  )
}
