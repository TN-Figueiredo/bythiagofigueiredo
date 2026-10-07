'use client'
/**
 * Channel drawer (port of canais.html openDrawer/swapCard/effHTML/selectTab). ≥ 1280 px it is a column beside the
 * table; below, a modal (aria-modal, focus trap, backdrop). The forja controls arrive in Task 35: their place in the
 * Trocas panel and in the footer is a slot that renders nothing for now.
 *
 * It opens at the click: until the server sends the channel's DrawerView it shows a DrawerShell — only what the row
 * already shows (name, avatar, niche, subscribers, links) — with aria-busy and empty placeholders, never a number or a
 * sentence the server has not sent. The same element then receives the content (the focus and the picked tab stay).
 */
import Link from 'next/link'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CanaisRow, DrawerTab, DrawerView, EffectView, SwapCard, ViewsText } from './view-model'
import type { Niche } from '@/lib/youtube/observatorio/types'
import { Ic, ThumbView } from './cells'
import { NicheSelect } from './niche-editor'
import { ChannelAvatar } from '../_chrome/channel-avatar'

const TABS: Array<{ k: DrawerTab; label: string; panel: string }> = [
  { k: 'trocas', label: 'Trocas', panel: 'pSwaps' },
  { k: 'outliers', label: 'Outliers', panel: 'pOut' },
  { k: 'videos', label: 'Vídeos', panel: 'pVid' },
]

function Views({ v }: { v: ViewsText }) {
  return v.num ? <><span className="num">{v.num}</span>{v.text}</> : <>{v.text}</>
}

function Effect({ e }: { e: EffectView }) {
  return (
    <div className="effect">
      <span className={`vd ${e.vd}`} aria-hidden={e.label ? undefined : true}><Ic n={e.icon} />{e.label}</span>
      {e.main.map((m, i) => (m.mono ? <span key={i} className="num">{m.t}</span> : <span key={i}>{m.t}</span>))}
      {e.sub ? <span className="sub">{e.sub}</span> : null}
      {e.subWeak ? <span className="sub weak">{e.subWeak}</span> : null}
    </div>
  )
}

function Card({ c }: { c: SwapCard }) {
  return (
    <div className="swapcard">
      <div className="when">
        <span>
          {c.heads.map((h, i) => (
            <span key={i}>{i ? '. ' : ''}<strong>{h.strong}</strong>, <span title={h.whenTitle}>{h.when}</span></span>
          ))}
          {c.multi ? '. Mesma janela de sincronização:' : ','} {c.whenTail}
        </span>
        <span><Views v={c.views} /></span>
      </div>
      <div className="vt">{c.title}</div>
      {c.desc ? (c.desc.hasText
        ? <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="chip num">{c.desc.chip}</span><Link className="btn small link" href={c.desc.href}>Ver comparação</Link></div>
        : <div className="cap" style={{ marginTop: 6, whiteSpace: 'normal' }}>{c.desc.text}</div>) : null}
      {c.ba ? (
        <div className="ba">
          <div className="side old"><div className="lab">Antes</div><ThumbView t={c.ba.before.thumb} lg />{c.ba.before.title != null ? <div className="tt" style={{ marginTop: c.ba.before.thumb ? 6 : 0 }}>{c.ba.before.title}</div> : null}</div>
          <div className="arr" aria-hidden="true">›</div>
          <div className="side"><div className="lab">Depois</div><ThumbView t={c.ba.after.thumb} lg />{c.ba.after.title != null ? <div className="tt" style={{ marginTop: c.ba.after.thumb ? 6 : 0 }}>{c.ba.after.title}</div> : null}</div>
        </div>
      ) : null}
      {c.thumbNote ? <div className="cap" style={{ marginTop: 6, whiteSpace: 'normal' }}>{c.thumbNote}</div> : null}
      {c.precNote ? <div className="cap" style={{ marginTop: 6, whiteSpace: 'normal' }}>{c.precNote}</div> : null}
      {c.effect ? <Effect e={c.effect} /> : null}
      {c.sameNote ? <p className="cap" style={{ whiteSpace: 'normal', margin: '6px 0 0' }}>{c.sameNote}</p> : null}
      <div className="bridge">
        <Link className="btn small ghost" href={c.histHref}>Ver histórico do vídeo</Link>
        <a className="btn small ghost" href={c.ytUrl} target="_blank" rel="noopener noreferrer">Abrir no YouTube</a>
      </div>
    </div>
  )
}

/** What the list already knows of a channel: the drawer's head while its content is on the way. */
export type DrawerShell = Pick<CanaisRow, 'id' | 'name' | 'color' | 'ini' | 'avatar' | 'own' | 'niche' | 'lang' | 'handle' | 'url' | 'subs'>
const isFull = (d: DrawerView | DrawerShell): d is DrawerView => 'stats' in d

export interface ChannelDrawerProps {
  /** The channel's view, or the shell of the row that was clicked while the server renders it. */
  d: DrawerView | DrawerShell; modal: boolean; upnextHref: string
  onClose: () => void; onRemove: (from: HTMLElement) => void; onNiche: (n: Niche) => void
  trap: (e: KeyboardEvent<HTMLElement>) => void; closeRef: React.RefObject<HTMLButtonElement | null>
  /** Task 35: forja controls (Trocas panel and footer). */
  forjaSlot?: ReactNode; forjaFootSlot?: ReactNode
}

export function ChannelDrawer({ d, modal, upnextHref, onClose, onRemove, onNiche, trap, closeRef, forjaSlot, forjaFootSlot }: ChannelDrawerProps) {
  const full = isFull(d) ? d : null, shell = isFull(d) ? null : d
  const [tab, setTab] = useState<DrawerTab>(full?.tab ?? 'trocas')
  const [forId, setForId] = useState(d.id)
  if (forId !== d.id) { setForId(d.id); setTab(full?.tab ?? 'trocas') }
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pick = (i: number) => { const t = TABS[(i + TABS.length) % TABS.length]!; setTab(t.k); tabRefs.current[(i + TABS.length) % TABS.length]?.focus() }
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); pick(i + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); pick(i - 1) }
    if (e.key === 'Home') { e.preventDefault(); pick(0) }
    if (e.key === 'End') { e.preventDefault(); pick(TABS.length - 1) }
  }
  const nameId = `cn-d-${d.id}`
  return (
    <aside className="cn-drawer" aria-labelledby={nameId} role={modal ? 'dialog' : 'complementary'} aria-modal={modal || undefined} onKeyDown={modal ? trap : undefined} data-drawer={d.id} aria-busy={full ? undefined : true}>
      <div className="dhead">
        <div className="row1">
          <ChannelAvatar as="div" src={d.avatar} ini={d.ini} color={d.color} />
          <div style={{ minWidth: 0 }}>
            <h3 id={nameId}>{d.name}</h3>
            <div className="meta">
              {d.own ? <span className="youtag">seu canal</span> : null}
              {d.own && d.lang ? <abbr className="langtag" title={d.lang.title}>{d.lang.code}</abbr> : null}
              <NicheSelect id={d.id} name={d.name} niche={d.niche} ctx="drawer" onChange={onNiche} />
              {d.handle ? <a className="handle" href={d.url} target="_blank" rel="noopener noreferrer">{d.handle}</a> : null}
              {full ? <><span>{full.subsText}</span><span>{full.cov}</span></> : null}
              {shell ? <span className="num">{shell.subs}</span> : null}
            </div>
          </div>
          <button type="button" className="more close" aria-label="Fechar detalhes do canal" onClick={onClose} ref={closeRef}><Ic n="close" /></button>
        </div>
        {full ? null : <div className="dstats wait" aria-hidden="true"><div /><div /><div /><div /><div /></div>}
        {full ? <div className="dstats">
          {full.stats.map(s => (
            <div key={s.label}>
              <div className="l" title={s.labelTitle ?? undefined}>{s.label}</div>
              <div className="v num" style={s.label === 'Sincronização' ? { fontSize: 14, fontFamily: 'inherit' } : undefined}>{s.value}</div>
              <div className="l" title={s.subTitle ?? undefined}>{s.subWeak ? <span className="weak">{s.sub}</span> : s.sub}</div>
            </div>
          ))}
        </div> : null}
      </div>
      <div className="dtabs" role="tablist" aria-label="Detalhes do canal">
        {TABS.map((t, i) => (
          <button key={t.k} type="button" role="tab" id={`cn-t-${t.k}`} aria-controls={`cn-${t.panel}`} aria-selected={tab === t.k} tabIndex={tab === t.k ? 0 : -1}
            ref={el => { tabRefs.current[i] = el }} onClick={() => setTab(t.k)} onKeyDown={e => onTabKey(e, i)}
            title={full && t.k === 'outliers' ? full.outliers.tabTitle : undefined}>
            {t.label}{!full ? null : t.k === 'trocas' ? <span className="n">{full.swaps.count}</span> : t.k === 'outliers' ? <span className="n">{full.outliers.tabN}</span> : null}
          </button>
        ))}
      </div>
      {full ? null : (
        <div className="dbody">
          {TABS.map(t => <div key={t.k} className="dpanel dwait" id={`cn-${t.panel}`} role="tabpanel" aria-labelledby={`cn-t-${t.k}`} hidden={tab !== t.k}><i /><i /><i /></div>)}
        </div>
      )}
      {full ? <FullBody d={full} tab={tab} upnextHref={upnextHref} forjaSlot={forjaSlot} /> : null}
      <div className="dfoot">
        {d.own ? <span /> : (
          <button type="button" className="btn small ghost icon" aria-label="Remover canal…" title="Remover canal…" onClick={e => onRemove(e.currentTarget)}><Ic n="trash" /></button>
        )}
        <span className="spacer" />
        {full ? forjaFootSlot ?? null : null}
        <a className="btn small" href={d.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube</a>
      </div>
    </aside>
  )
}

/** The three panels of a channel whose view arrived. */
function FullBody({ d, tab, upnextHref, forjaSlot }: { d: DrawerView; tab: DrawerTab; upnextHref: string; forjaSlot?: ReactNode }) {
  return (
      <div className="dbody">
        <div className="dpanel" id="cn-pSwaps" role="tabpanel" aria-labelledby="cn-t-trocas" tabIndex={0} hidden={tab !== 'trocas'}>
          {forjaSlot ?? null}
          <p className="sec">Trocas nos últimos 30 dias</p>
          <p className="sech">{d.swaps.intro}</p>
          {d.swaps.note ? <div className="note">{d.swaps.note}</div> : null}
          {d.swaps.cards.map(c => <Card key={c.id} c={c} />)}
          {d.swaps.link ? <Link className="btn small" href={d.swaps.link.href} data-link-n={d.swaps.link.n} data-link-key={d.swaps.link.key}>{d.swaps.link.text}</Link> : null}
        </div>
        <div className="dpanel" id="cn-pOut" role="tabpanel" aria-labelledby="cn-t-outliers" tabIndex={0} hidden={tab !== 'outliers'}>
          <p className="sec">Outliers, até 90 dias</p>
          {/* canais.html:804-805: the intro always, then the note of a channel still fetching its videos */}
          <p className="sech">{d.outliers.intro}</p>
          {d.outliers.note ? <div className="note">{d.outliers.note}</div> : null}
          {d.outliers.sections.map(s => (
            <div key={s.fmt}>
              <p className="sec" style={{ marginTop: 12 }}>{s.title}</p>
              {s.rows.map(x => (
                <div className="vrow" key={x.id}>
                  <ThumbView t={x.thumb} />
                  <div>
                    <div className="t" title={x.title}>{x.title}</div>
                    <div className="m"><b className={`mult num ${x.tier}`}>{x.mult}</b></div>
                    <div className="m">publicado <span title={x.publishedTitle}>{x.published}</span>, fase: <span title={x.phaseTitle}>{x.meta}</span></div>
                  </div>
                  <div className="r">{x.views.num ? <><span className="num">{x.views.num}</span><div className="m">views</div></> : <span className="na">{x.views.text}</span>}</div>
                </div>
              ))}
              {s.link ? <div style={{ marginTop: 8 }}><Link className="btn small" href={s.link.href} data-link-n={s.link.n} data-link-key={s.link.key}>{s.link.text}</Link></div> : null}
              {s.note ? <div className="note">{s.note}</div> : null}
            </div>
          ))}
        </div>
        <div className="dpanel" id="cn-pVid" role="tabpanel" aria-labelledby="cn-t-videos" tabIndex={0} hidden={tab !== 'videos'}>
          {d.videos.preNote ? <><div className="note">{d.videos.preNote}</div>{d.videos.upnext ? <p><a className="btn small" href={upnextHref}>{d.videos.upnext}</a></p> : null}</> : null}
          <p className="sec">{d.videos.title}</p>
          <p className="sech">{d.videos.intro}</p>
          <div className="vlist">
            {d.videos.rows.map(x => (
              <div className="vrow" key={x.id}>
                <ThumbView t={x.thumb} />
                <div>
                  <div className="t" title={x.title}>{x.title}</div>
                  <div className="m">publicado <span title={x.publishedTitle}>{x.published}</span>, <Views v={x.views} />{x.rel ? <>, {x.rel.outlier ? <><b className={`mult num ${x.rel.tier}`}>{x.rel.text.replace(' (outlier)', '')}</b> (outlier)</> : x.rel.text}</> : null}</div>
                  <span style={{ display: 'flex', gap: 2, marginLeft: -10, flexWrap: 'wrap' }}>
                    <Link className="btn small ghost" href={x.histHref}>Ver histórico do vídeo</Link>
                    <a className="btn small ghost" href={x.ytUrl} target="_blank" rel="noopener noreferrer">Abrir no YouTube</a>
                  </span>
                </div>
                <div className="r">{x.vp.num ? <><span className="num">{x.vp.num}</span><div className="m">{x.vp.text}</div></> : <span className="na" style={{ fontSize: 11.5 }}>{x.vp.text}</span>}</div>
              </div>
            ))}
          </div>
          {d.videos.note ? <div className="note">{d.videos.note}</div> : null}
        </div>
      </div>
  )
}
