/**
 * Measured effect of one change (port of effectHTML). Canonical engine texts only: waitText while waiting,
 * noBaseText for n = 0, the verdict reason, numbers and method. pp come pre-formatted (fmt.pp, integer, U+2212).
 * An inconclusive verdict demotes the number through colour tokens (.inc → --muted), never opacity.
 */
import type { EffectView, Hero } from './view-model'
import { Ic, type IconName } from './icons'
import { Sparkline } from './sparkline'

const CLS: Record<string, string> = { ganhou: 'win', perdeu: 'loss', neutro: 'flat', inconclusivo: 'inc' }
const ICON: Record<EffectView['icon'], IconName | null> = { up: 'up', down: 'down', flat: 'flat', help: 'help', clock: 'clock', none: null }
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function Caveats({ e }: { e: EffectView }) {
  if (!e.caveats.length) return null
  return <p className="eff-foot"><b style={{ color: 'var(--text)', fontWeight: 600 }}>Ressalva:</b> {e.caveats.join(' ')}</p>
}

export function EffectPanel({ h }: { h: Hero }) {
  const e = h.effect
  if (e.status === 'sem-antes' || e.status === 'sem-serie') {
    return <p className="na" data-status={e.status}>{e.detail}</p>
  }
  const head = e.spark ? <><div className="eff-h"><span>Views/dia</span><span>{e.spark.head}</span></div><Sparkline s={e.spark} /></> : null
  if (e.status === 'aguardando') {
    return (
      <>
        {head}
        <div className="verdict wait" data-status="aguardando"><Ic name="clock" />{e.wait}</div>
        <div className="progress" aria-hidden="true">{Array.from({ length: e.afterNeeded }, (_, i) => <i key={i} className={i < e.collected ? 'f' : undefined} />)}</div>
        <Caveats e={e} />
      </>
    )
  }
  const r = e.rows, icon = ICON[e.icon]
  return (
    <>
      {head}
      {r ? (
        <dl className="eff-dl">
          <dt>Observado</dt>
          <dd><span className="num">{r.observed}</span><small><span className="num">{r.observedFrom}</span> → <span className="num">{r.observedTo}</span>/dia</small></dd>
          <dt>Esperado sem a troca</dt>
          <dd><span className="num">{r.expected}</span><small>
            {r.iqr ? <>faixa <span className="num">{r.iqr[0]}</span> a <span className="num">{r.iqr[1]}</span>, </> : null}
            {e.noBase ? cap(e.noBase) : <>n = <span className="num">{r.n}</span>; {r.band}, {r.methodShort}</>}
          </small></dd>
          <dt>Efeito</dt>
          <dd className={e.demoted ? 'inc' : undefined} data-demoted={e.demoted ? '' : undefined} title={e.demoted ? 'Inconclusivo: o número não sustenta conclusão' : undefined}>
            {e.pp ? <><span className="num">{e.pp.replace(/ pp$/, '')}</span> pp</> : '—'}
          </dd>
        </dl>
      ) : null}
      <div className={'verdict ' + (CLS[e.status] ?? 'inc')} data-status={e.status}>{icon ? <Ic name={icon} /> : null}{e.label}</div>
      <span className="adj">Ajustado pela idade e pelo canal. {e.notCause}.</span>
      {e.fallback ? <p className="eff-foot">{cap(e.fallback)}</p> : null}
      <p className="eff-foot" title={e.footTitle ?? undefined}>{e.detail}</p>
      <Caveats e={e} />
    </>
  )
}
