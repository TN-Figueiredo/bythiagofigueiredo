'use client'
/**
 * One video card with its changes (port of groupHTML/chgHTML/whenHTML): when · before → after · measured effect.
 * Links are plain anchors with hrefs built by the engine (link.historico, video.url).
 */
import Link from 'next/link'
import { SWIPE_ARIA, type Hero } from './view-model'
import { Ic, type IconName } from './icons'
import { TitleDiffView } from './title-diff'
import { ThumbCompare } from './thumb-compare'
import { DescDiff } from './desc-diff'
import { EffectPanel } from './effect-panel'
import { ChannelAvatar } from '../_chrome/channel-avatar'

const KIND_ICON: Record<Hero['type'], IconName> = { title: 'title', thumb: 'image', desc: 'text' }

/** `label` is the visible state (title=); the accessible name stays SWIPE_ARIA and the state is aria-pressed. */
export interface SwipeState { saved: boolean; label: string; busy: boolean; disabled: boolean }

function ChangeRow({ h, swipe, onSwipe }: { h: Hero; swipe: SwipeState; onSwipe: (h: Hero) => void }) {
  return (
    <div className="chg" data-id={h.id} data-hero={h.type}>
      <div className="when">
        <span className="kind"><Ic name={KIND_ICON[h.type]} />{h.typeLabel}</span>
        <span className="wline" data-kind={h.type} data-prec={h.when.prec}>{h.when.text}<span className="rel">{h.when.rel}</span></span>
        {h.when.seq ? <span className="seq">{h.when.seq}</span> : null}
        <button className="ghost save" type="button" aria-pressed={swipe.saved} aria-label={SWIPE_ARIA} title={swipe.label} aria-busy={swipe.busy || undefined}
          disabled={swipe.disabled} data-swipe-disabled={swipe.disabled ? '' : undefined}
          onClick={() => { if (!swipe.busy && !swipe.disabled) onSwipe(h) }}><Ic name="bookmark" /></button>
      </div>
      <div className="diff">
        {h.badges.map((b, i) => (
          <span key={i} className={'badge ' + b.kind}><Ic name={b.kind === 'rev' ? 'revert' : 'alert'} /><span>{b.text}</span></span>
        ))}
        {h.title ? <TitleDiffView t={h.title} /> : null}
        {h.thumbs ? <ThumbCompare thumbs={h.thumbs} /> : null}
        {h.desc ? <DescDiff d={h.desc} /> : null}
      </div>
      <div className="effect"><EffectPanel h={h} /></div>
    </div>
  )
}

export function VideoGroup({ heroes, swipeOf, onSwipe }: { heroes: Hero[]; swipeOf: (h: Hero) => SwipeState; onSwipe: (h: Hero) => void }) {
  const v = heroes[0]!.video
  const revTag = heroes.length === 1 && heroes[0]!.revTag
  return (
    <article className="vid" data-video={v.id}>
      <header className="vid-h">
        <ChannelAvatar src={v.avatar} ini={v.ini} color={v.color} ink={v.ink} />
        <div className="who">
          <div className="ch">
            <b>{v.channel}</b>
            {v.nicheLabel ? <span className={'tag ' + (v.niche ?? '')}>{v.nicheLabel}</span> : null}
            {revTag ? <span className="tag rv">reversão</span> : null}
          </div>
          <h3>{v.title}</h3>
          <div className="meta">{v.meta.map(m => <span key={m}>{m}</span>)}</div>
          {v.syncNote ? <p className="syncnote"><Ic name="alert" />{v.syncNote}</p> : null}
        </div>
        <div className="acts">
          <Link className="ghost" href={v.historyHref}><Ic name="history" />Ver histórico do vídeo</Link>
          <a className="ghost" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir no YouTube: ' + v.title}><Ic name="external" />Abrir no YouTube</a>
        </div>
      </header>
      {heroes.map(h => <ChangeRow key={h.id} h={h} swipe={swipeOf(h)} onSwipe={onSwipe} />)}
    </article>
  )
}
