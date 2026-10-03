/**
 * Title "comparação linha a linha" (port of titleHTML): what left is struck through, what entered is highlighted,
 * a moved word is dotted and a case-only change is dashed. Every marked segment carries screen-reader text
 * (saiu / entrou / mudou de lugar / só maiúsculas/minúsculas) from the engine's titleDiff labels.
 */
import { Fragment, type ReactNode } from 'react'
import type { TitleSpan } from '@/lib/youtube/observatorio/text-diff'
import type { TitleView } from './view-model'

function Seg({ x, side }: { x: TitleSpan; side: 'b' | 'a' }): ReactNode {
  const sp = / $/.test(x.text), text = x.text.replace(/ $/, ''), lab = x.label ?? undefined
  const inner = <>{text}{lab ? <span className="sr"> ({lab})</span> : null}</>
  let el: ReactNode
  if (x.op === 'rem' && side === 'b') el = <del title={lab}>{inner}</del>
  else if (x.op === 'add' && side === 'a') el = <ins title={lab}>{inner}</ins>
  else if (x.op === 'move') el = <span className="tmv" title={lab}>{inner}</span>
  else if (x.op === 'case') el = <span className="tcase" title={lab}>{inner}</span>
  else return x.text
  return <>{el}{sp ? ' ' : ''}</>
}

export function TitleDiffView({ t }: { t: TitleView }) {
  return (
    <>
      <div className="t-pair" data-title-diff="">
        <span className="lbl">de</span>
        <p className="t-old">{t.full ? t.beforeText : t.before.map((x, i) => <Fragment key={i}><Seg x={x} side="b" /></Fragment>)}</p>
        <span className="lbl">para</span>
        <p className="t-new">{t.full ? t.afterText : t.after.map((x, i) => <Fragment key={i}><Seg x={x} side="a" /></Fragment>)}</p>
      </div>
      <div className="t-stats">
        {t.legend.map(l => <span key={l.cls}><span className={l.cls}>{l.mark}</span>: {l.label}</span>)}
        {t.stats.map(s => <span key={s}>{s}</span>)}
      </div>
    </>
  )
}
