'use client'
/**
 * The forja drawer (port of moldura-forja.html drawer(): chooser → confirm → run cards). A column at ≥ 1280 px and a
 * modal below (focus trapped, Esc closes and returns the focus — the chrome owns opener/return). Every text comes
 * from ForjaDrawerView; the actions arrive as props (never imported here).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, Niche } from '@/lib/youtube/observatorio/types'
import type { AskOutcome } from '@/lib/pipeline/services/forja-queue'
import { comboKey, type ForjaDrawerView, type ObsType, type RunCard, type RunClock } from './forja-view-model'
import { useToast } from './toasts'
import { Icon } from './icons'

export type ForjaAsk = (type: ObsType, scope: NicheScope, videoId?: string, fmt?: Fmt) => Promise<AskOutcome>
export type ForjaCancel = (type: ObsType, niche: Niche, videoId?: string) => Promise<{ ok: boolean; reason?: string }>

const NICHES: NicheScope[] = ['todos', 'viagem', 'ia']
const NL: Record<NicheScope, string> = { todos: 'Todos', viagem: 'Viagem', ia: 'IA' }
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const period = (t: string) => { const s = t.trim(); return !s || /[.!?]$/.test(s) ? s : s + '.' }
const SR: Record<string, string> = { feito: 'concluído', agora: 'em andamento', proximo: 'aguardando', pendente: 'pendente', erro: 'com erro', parado: 'parado' }

export type DrawerFlow = 'choose' | 'confirm' | 'run'

export function ForjaDrawer({ d, flow0, modal, onClose, onAsk, onCancel, pre }: {
  d: ForjaDrawerView; flow0: DrawerFlow; modal: boolean
  /** The screen's type and the niche its button asks (Todos with one niche busy → the free one). */
  pre?: { type: ObsType; niche: NicheScope } | null
  onClose: () => void; onAsk?: ForjaAsk; onCancel?: ForjaCancel
}) {
  const router = useRouter(), toast = useToast()
  const [flow, setFlow] = useState<DrawerFlow>(flow0)
  // the screen's own request first, when the drawer offers it (leitura-video is asked in Histórico, not here)
  const usePre = !!pre && !!d.combos[comboKey(pre.type, pre.niche)]
  const [req, setReq] = useState<ObsType>(usePre ? pre!.type : d.defaultType)
  const [niche, setNiche] = useState<NicheScope>(usePre ? pre!.niche : d.defaultNiche)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLElement>(null), head = useRef<HTMLHeadingElement>(null)
  useEffect(() => { setFlow(flow0) }, [flow0])
  useEffect(() => { head.current?.focus() }, [flow])
  // no request in the screen's niche: the panel asks again (moldura drawer())
  const shown: DrawerFlow = flow === 'run' && !d.runs.length ? 'choose' : flow
  const asking = shown !== 'run'
  const fmt: Fmt = req === 'padroes-titulo-shorts' ? 'short' : 'long'
  const combo = d.combos[comboKey(req, niche)]!

  const trap = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (!modal || e.key !== 'Tab' || !box.current) return
    const f = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]')].filter(x => !x.closest('[hidden]'))
    if (!f.length) return
    const first = f[0]!, last = f[f.length - 1]!
    if (!f.includes(document.activeElement as HTMLElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const ask = async (type: ObsType, scope: NicheScope) => {
    if (!onAsk || busy) return
    setBusy(true)
    let res: AskOutcome
    try { res = await onAsk(type, scope, undefined, type === 'padroes-titulo-shorts' ? 'short' : type === 'padroes-titulo' || type === 'temas' ? 'long' : undefined) }
    catch { res = { ok: false, reason: 'A fila da forja não respondeu. Tente de novo em alguns minutos.', results: [] } }
    setBusy(false)
    if (!res.ok) { toast('warn', 'Não deu para pedir', period(cap(res.reason ?? 'a forja recusou o pedido'))); return }
    const ok = res.results.filter(x => x.ok).map(x => NL[x.niche]), skipped = res.results.filter(x => !x.ok).map(x => x.reason ?? '')
    const label = d.options.find(o => o.id === type)?.label ?? (type === 'padroes-titulo-shorts' ? d.options[0]!.shortsLabel : type)
    const when = d.machine.nextPoll ? ' A forja consulta a fila às ' + d.machine.nextPoll + '.' : ' A forja não está consultando a fila; o pedido espera a máquina voltar.'
    toast('forja', 'Pedido enviado à forja', label + ' · ' + ok.join(' e ') + '.' + when + (skipped.length ? ' ' + period(cap(skipped.join('; '))) : ''))
    setFlow('run')
    router.refresh()
  }
  const cancel = async (r: RunCard) => {
    if (!onCancel || !r.cancel || busy) return
    setBusy(true)
    const out = await Promise.all(r.cancel.niches.map(n => onCancel(r.type, n, r.video ?? undefined).catch(() => ({ ok: false, reason: 'A fila da forja não respondeu.' }))))
    setBusy(false)
    const k = out.filter(x => x.ok).length, bad = out.find(x => !x.ok)
    if (k) toast('forja', k > 1 ? 'Pedidos cancelados' : 'Pedido cancelado', k > 1 ? 'Saíram da fila antes de a forja pegar; a cota continua livre.' : 'Saiu da fila antes de a forja pegar; a cota continua livre.')
    if (bad) toast('warn', 'Não deu para cancelar', period(cap(bad.reason ?? '')))
    router.refresh()
  }
  const pick = (type: ObsType, n: NicheScope) => { setReq(type); setNiche(n) }

  const head0 = asking ? 'Pedir nova leitura à forja' : d.anyActive ? 'Pedido em andamento' : 'Leitura pedida à forja'
  return (
    <aside ref={box} className="obs-ch-drawer" id="obs-forja-drawer" role={modal ? 'dialog' : 'complementary'} aria-modal={modal || undefined}
      aria-labelledby="obs-fj-dh" onKeyDown={trap} data-forja-drawer="" data-flow={shown}>
      <div className="obs-fj-in">
        <div className="obs-fj-head">
          <div>
            <h3 id="obs-fj-dh" tabIndex={-1} ref={head}>{head0}</h3>
            <p>A máquina de casa, com o Gemma 12B, lê os dados do Observatório e publica em Insights.</p>
          </div>
          <button className="obs-ch-btn obs-ch-ghost obs-ch-icon" type="button" aria-label="Fechar painel da forja" onClick={onClose}>{Icon.x()}</button>
        </div>
        <div className="obs-fj-machine">
          <span className={'obs-ch-dot ' + (d.machine.alive ? 'obs-ch-forja' : 'obs-ch-warn')} aria-hidden="true" />
          <span>{d.machine.alive
            ? <><b>forja ligada</b>: consultou a fila às <span className="obs-ch-num">{d.machine.time}</span>. Consulta a cada {d.machine.tickMinutes} min.</>
            : <><b>{d.machine.strong}</b>. Pedidos esperam na fila.</>}</span>
        </div>
        {shown === 'choose' ? (
          <>
            <fieldset className="obs-fj-opts">
              <legend>O que você quer que a forja leia?</legend>
              {d.options.map(t => {
                const sel = req === t.id || (t.id === 'padroes-titulo' && req === 'padroes-titulo-shorts')
                const tid: ObsType = t.id === 'padroes-titulo' ? (sel && fmt === 'short' ? 'padroes-titulo-shorts' : 'padroes-titulo') : t.id
                const nn = sel ? niche : d.defaultNiche
                const c = d.combos[comboKey(tid, nn)]!, blocked = c.blocked, capable = d.capable[tid]
                const ti = sel ? undefined : -1
                return (
                  <div key={t.id} className={'obs-fj-opt' + (sel && !blocked ? ' obs-fj-sel' : '') + (blocked ? ' obs-fj-off' : '')} data-type={tid} data-niche-opt={nn}>
                    <input type="radio" name="obs-fj-rq" id={'obs-fj-rq-' + t.id} value={tid} checked={sel} onChange={() => pick(tid, nn)} />
                    <label htmlFor={'obs-fj-rq-' + t.id}>
                      <strong>{t.id === 'padroes-titulo' && sel && fmt === 'short' ? t.shortsLabel : t.label}</strong>
                      <span className="obs-fj-desc">{t.id === 'padroes-titulo' && sel && fmt === 'short' ? t.shortsDesc : t.desc}</span>
                    </label>
                    <div className="obs-fj-param">
                      <span id={'obs-fj-pn-' + t.id}>Nicho</span>
                      <span className="obs-fj-seg" role="group" aria-labelledby={'obs-fj-pn-' + t.id}>
                        {NICHES.map(n => <button key={n} type="button" aria-pressed={nn === n} tabIndex={ti} onClick={() => pick(tid, n)}>{NL[n]}</button>)}
                      </span>
                    </div>
                    {t.id === 'padroes-titulo' ? (
                      <div className="obs-fj-param">
                        <span id="obs-fj-pf">Formato</span>
                        <span className="obs-fj-seg" role="group" aria-labelledby="obs-fj-pf">
                          {([['long', 'Longos'], ['short', 'Shorts']] as const).map(([f, l]) => (
                            <button key={f} type="button" aria-pressed={(sel ? fmt : 'long') === f} tabIndex={ti} onClick={() => pick(f === 'short' ? 'padroes-titulo-shorts' : 'padroes-titulo', nn)}>{l}</button>
                          ))}
                        </span>
                      </div>
                    ) : null}
                    {blocked ? (
                      <p className="obs-fj-meta" data-quota="blocked" id={'obs-fj-quota-' + t.id}>
                        {c.meta}{' '}
                        {blocked.kind === 'quota'
                          ? <Link className="obs-fj-linkbtn" href={d.insightsHref}>Ir até a leitura</Link>
                          : <button className="obs-fj-linkbtn" type="button" onClick={() => setFlow('run')}>Ver andamento</button>}
                      </p>
                    ) : (
                      <>
                        <p className="obs-fj-meta" data-preview={tid + '|' + c.effNiche}>{sel ? c.meta : c.metaUnselected}</p>
                        {c.partial ? <p className="obs-fj-warnline">{Icon.warn()}<span>{c.partial}</span></p> : null}
                        {sel && c.thin ? <p className="obs-fj-warnline" data-thin="">{Icon.warn()}<span>{c.thin}</span></p> : null}
                      </>
                    )}
                    {sel && c.warn ? <div className="obs-fj-warnline">{Icon.warn()}<span>{c.warn}</span></div> : null}
                    {!capable ? <p className="obs-fj-warnline">{Icon.warn()}<span>{d.incapableText}</span></p> : null}
                  </div>
                )
              })}
            </fieldset>
            <p className="obs-fj-note">{d.quotaScope} A forja só lê números e textos: não vê thumbnails e não diz por que um vídeo estourou.</p>
            <div className="obs-fj-foot">
              <button className="obs-ch-btn obs-ch-forja-solid" type="button" disabled={!!combo.blocked || !d.capable[req]}
                aria-describedby={combo.blocked ? 'obs-fj-quota-' + (req === 'padroes-titulo-shorts' ? 'padroes-titulo' : req) : undefined} onClick={() => setFlow('confirm')}>Continuar</button>
              <button className="obs-ch-btn obs-ch-ghost" type="button" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : shown === 'confirm' ? (
          <>
            <div className="obs-fj-confirm" data-type={req}>
              <h4>{combo.confirm.label}</h4>
              <dl>
                <dt>Escopo</dt><dd data-preview={req + '|' + combo.effNiche}>{combo.confirm.escopo}</dd>
                <dt>Entrega</dt><dd>{combo.confirm.entrega}</dd>
                <dt>Não faz</dt><dd>{combo.confirm.naoFaz}</dd>
                <dt>Quando</dt><dd>{combo.confirm.quando}</dd>
                <dt>Limite</dt><dd>{combo.confirm.limite}</dd>
              </dl>
            </div>
            {combo.thin ? <p className="obs-fj-warnline" data-thin="">{Icon.warn()}<span>{combo.thin}</span></p> : null}
            <div className="obs-fj-foot">
              <button className="obs-ch-btn obs-ch-forja-solid" type="button" aria-disabled={busy || undefined} onClick={() => ask(req, combo.effNiche)}>Enviar pedido à forja</button>
              <button className="obs-ch-btn obs-ch-ghost" type="button" onClick={() => setFlow('choose')}>Voltar</button>
            </div>
          </>
        ) : (
          d.runs.map(r => <RunCardView key={r.type + (r.video ?? '')} r={r} busy={busy} onCancel={() => cancel(r)} onAgain={() => r.again && ask(r.type, r.again.niches.length > 1 ? 'todos' : r.again.niches[0]!)} onAnother={() => setFlow('choose')} />)
        )}
        <p className="obs-fj-more">As leituras publicadas e o histórico ficam em Insights. <Link className="obs-fj-linkbtn" href={d.insightsHref}>Abrir Insights</Link></p>
      </div>
    </aside>
  )
}

function ClockView({ c }: { c: RunClock }) {
  return (
    <>
      <div className={'obs-fj-clock' + (c.stacked ? ' obs-fj-stacked' : '')} role="img" aria-label={c.aria}>
        <div className="obs-fj-track">
          {c.fill ? <span className={'obs-fj-fill' + (c.fill.cls ? ' obs-fj-' + c.fill.cls : '')} style={{ left: c.fill.from + '%', width: (c.fill.to - c.fill.from) + '%' }} /> : null}
          {c.ticks.map((t, i) => <span key={'t' + i} className="obs-fj-tk" data-s={t.s} style={{ left: t.left + '%' }}><i /><em>{t.label}</em></span>)}
          {c.evs.map((e, i) => <span key={'e' + i} className={'obs-fj-evt' + (e.cls ? ' obs-fj-' + e.cls : '') + (e.hi ? ' obs-fj-hi' : '')} style={{ left: e.left + '%' }}>{e.label}</span>)}
        </div>
      </div>
      <p className="obs-fj-clock-cap">{c.cap}</p>
    </>
  )
}

function RunCardView({ r, busy, onCancel, onAgain, onAnother }: { r: RunCard; busy: boolean; onCancel: () => void; onAgain: () => void; onAnother: () => void }) {
  return (
    <section className="obs-fj-run" data-st={r.st} data-type={r.type}>
      <p className="obs-fj-run-lbl">{Icon.anvil()}Leitura pedida<span className="obs-fj-state">{r.stateLabel}</span></p>
      <p className="obs-fj-run-what">{r.what}</p>
      {r.lines.length ? <ul className="obs-fj-run-lines">{r.lines.map(l => <li key={l}>{l}</li>)}</ul> : null}
      <div className="obs-fj-run-eta"><b aria-hidden={r.eta.aria || undefined}>{r.eta.big}</b><span>{r.eta.text}</span></div>
      {r.clock ? <ClockView c={r.clock} /> : null}
      <p className="obs-fj-run-tit">{r.tit}</p>
      <p className="obs-fj-run-sub">{r.sub}</p>
      {r.steps.length ? (
        <ol className="obs-fj-run-steps">
          {r.steps.map((s, i) => (
            <li key={i} className="obs-fj-run-step" data-s={s.s}>
              <b>{s.title}<span className="obs-ch-sr"> ({SR[s.s]})</span></b>
              {s.time ? <span className={'obs-fj-tm' + (/^\d/.test(s.time) ? ' obs-ch-num' : '')}>{s.time}</span> : <span />}
              {s.note ? <small>{s.note}</small> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {r.cancel || r.again || r.goInsights || r.note ? (
        <div className="obs-fj-run-acoes">
          {r.cancel ? <button className="obs-ch-btn obs-ch-ghost" type="button" aria-disabled={busy || undefined} onClick={onCancel}>{r.cancel.label}</button> : null}
          {r.again ? <>
            <button className="obs-ch-btn obs-ch-forja-solid" type="button" disabled={!!r.again.disabledNote} aria-describedby={r.again.disabledNote ? 'obs-fj-again-' + r.type : undefined} onClick={onAgain}>Pedir nova leitura à forja</button>
            {r.again.disabledNote ? <span className="obs-fj-note" id={'obs-fj-again-' + r.type}>{r.again.disabledNote}</span> : null}
          </> : null}
          {r.goInsights ? <Link className="obs-ch-btn obs-ch-forja-solid" href={r.goInsights.href}>{r.goInsights.label}</Link> : null}
          {r.another ? <button className="obs-ch-btn obs-ch-ghost" type="button" onClick={onAnother}>Pedir outra leitura</button> : null}
          {r.note ? <span className="obs-fj-note">{r.note}</span> : null}
        </div>
      ) : null}
    </section>
  )
}
