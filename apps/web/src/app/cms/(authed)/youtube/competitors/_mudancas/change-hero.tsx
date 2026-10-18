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
import { PinButton, PinMessage, PinChips } from '../_chrome/pin-kit'
import { useAbEntradas } from '../_chrome/ab-entradas/contexto'
import { abRefDaTroca, ROTULO_IDEIA_NO_MEU_CANAL, type AbRefTroca } from '../_chrome/ab-entradas/modelo'
import { tipoDaLane } from '@/lib/youtube/ab-referencia'

const KIND_ICON: Record<Hero['type'], IconName> = { title: 'title', thumb: 'image', desc: 'text' }

/** `label` is the visible state (title=); the accessible name stays SWIPE_ARIA and the state is aria-pressed. */
export interface SwipeState { saved: boolean; label: string; busy: boolean; disabled: boolean }

/** `effect` false = a video outside the observed ones: no effect column (the card's header says why, once). */
function ChangeRow({ h, swipe, onSwipe, effect }: { h: Hero; swipe: SwipeState; onSwipe: (h: Hero) => void; effect: boolean }) {
  return (
    <div className={'chg' + (effect ? '' : ' fx-noeff')} data-id={h.id} data-hero={h.type}>
      <div className="when">
        <span className="kind"><Ic name={KIND_ICON[h.type]} />{h.typeLabel}</span>
        <span className="wline" data-kind={h.type} data-prec={h.when.prec}>{h.when.text}<span className="rel">{h.when.rel}</span></span>
        {h.when.seq ? <span className="seq">{h.when.seq}</span> : null}
        {h.when.run ? <span className="seq run" data-run=""><Ic name="revert" /><span>{h.when.run}</span></span> : null}
        <button className="ghost save" type="button" aria-pressed={swipe.saved} aria-label={SWIPE_ARIA} title={swipe.label} aria-busy={swipe.busy || undefined}
          disabled={swipe.disabled} data-swipe-disabled={swipe.disabled ? '' : undefined}
          onClick={() => { if (!swipe.busy && !swipe.disabled) onSwipe(h) }}><Ic name="bookmark" /></button>
      </div>
      <div className="diff">
        {/* without an effect there is nothing "not separable": the note badges are about the effect */}
        {h.badges.filter(b => effect || b.kind !== 'note').map((b, i) => (
          <span key={i} className={'badge ' + b.kind}><Ic name={b.kind === 'rev' ? 'revert' : 'alert'} /><span>{b.text}</span></span>
        ))}
        {h.title ? <TitleDiffView t={h.title} /> : null}
        {h.thumbs ? <ThumbCompare thumbs={h.thumbs} /> : null}
        {h.desc ? <DescDiff d={h.desc} /> : null}
      </div>
      {effect ? <div className="effect"><EffectPanel h={h} /></div> : null}
    </div>
  )
}

/**
 * Entrada do A/B Lab de uma troca de Mudanças. Fonte (Phil R1): o "Depois" (`toId`) do próprio change e o título `after` dele, nunca a última versão
 * restaurada do vídeo. `own` vem do canal (explícito). O `href` nasce aqui, no componente, e não no modelo que o pacote "Perguntar a uma IA" também monta.
 */
function abRefDoHero(h: Hero): AbRefTroca | null {
  // uma troca de thumbnail que DESFAZ outra (o "Depois" é a versão restaurada) não leva ideia nova: a referência é a troca que a antecedeu (Foco 7, A→B→A)
  if (h.thumbs?.some(t => t.role === 'Depois' && t.back)) return null
  return abRefDaTroca({
    tipo: tipoDaLane(h.type), own: h.video.own,
    thumbDepois: h.thumbs?.find(t => t.role === 'Depois')?.src ?? null, tituloDepois: h.title?.afterText ?? null,
    tituloDoVideo: h.video.title, refVideoId: h.video.id, refTroca: h.id,
  })
}

/**
 * `shared` = this video shows in more than one card of the list (sorted by effect): the pin control then names the
 * card's change too, so every control has a unique accessible name. The control's key is the card's first change.
 */
export function VideoGroup({ heroes, swipeOf, onSwipe, shared }: { heroes: Hero[]; swipeOf: (h: Hero) => SwipeState; onSwipe: (h: Hero) => void; shared?: boolean }) {
  const first = heroes[0]!, v = first.video
  const revTag = heroes.length === 1 && first.revTag
  const runNote = heroes.find(h => h.when.run && h.runNote)?.runNote ?? null
  const pin = v.pin ? (shared ? { ...v.pin, title: v.title + ' (' + first.typeLabel + ', ' + first.when.text + ')' } : v.pin) : null
  // a entrada do A/B Lab fica no cabeçalho do cartão e leva a primeira troca do cartão que tem o que levar (título ou thumbnail; descrição não)
  const abOn = useAbEntradas() !== null
  const ab = abOn ? heroes.map(abRefDoHero).find(r => r !== null) ?? null : null
  const rows = heroes.map(h => <ChangeRow key={h.id} h={h} swipe={swipeOf(h)} onSwipe={onSwipe} effect={v.observed} />)
  return (
    <article className="vid" data-video={v.id}>
      <header className="vid-h">
        <ChannelAvatar src={v.avatar} ini={v.ini} color={v.color} ink={v.ink} />
        <div className="who">
          <div className="ch">
            <b>{v.channelHref ? <Link className="chlink" href={v.channelHref} prefetch={false}>{v.channel}</Link> : v.channel}</b>
            {v.nicheLabel ? <span className={'tag ' + (v.niche ?? '')}>{v.nicheLabel}</span> : null}
            {revTag ? <span className="tag rv">reversão</span> : null}
          </div>
          <h3>{v.title}</h3>
          <div className="meta">{v.meta.map(m => <span key={m}>{m}</span>)}</div>
          {v.syncNote ? <p className="syncnote"><Ic name="alert" />{v.syncNote}</p> : null}
          {runNote ? <p className="seqnote" data-run-note=""><Ic name="revert" /><span>{runNote}</span></p> : null}
          {v.outNote ? <p className="fx-out-note">{v.outNote}</p> : null}
          {/* always rendered for a video that can be pinned: its height is reserved, so a new chip never moves the button (V2) */}
          {pin ? <div className="fx-chips"><PinChips chips={pin.chips} small /></div> : null}
        </div>
        <div className="acts">
          {pin ? <PinButton pin={pin} k={first.id} className="ghost" /> : null}
          <Link className="ghost" href={v.historyHref} aria-label={'Ver histórico do vídeo: ' + v.title}><Ic name="history" />Ver histórico do vídeo</Link>
          {ab?.tipo === 'testar' ? <a className="ghost" href={ab.href}>{ROTULO_IDEIA_NO_MEU_CANAL}</a> : null}
          <a className="ghost" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir no YouTube: ' + v.title}><Ic name="external" />Abrir no YouTube</a>
        </div>
      </header>
      {pin ? <div className="fx-row"><PinMessage k={first.id} /></div> : null}
      {ab?.tipo === 'sem-imagem' ? <p className="fx-ab-sem">{ab.frase}</p> : null}
      {v.observed ? rows : <div className="fx-grid">{rows}</div>}
    </article>
  )
}
