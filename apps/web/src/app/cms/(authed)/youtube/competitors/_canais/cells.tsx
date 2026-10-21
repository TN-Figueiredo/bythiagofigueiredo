'use client'
/**
 * Cells shared by the table and the cards (port of canais.html cells/chCell/syncCell/growthCell/strip/thumb).
 * They only lay out what the view model computed.
 */
import { PastilhaAusencia } from '../_chrome/ausencia/pastilhas'
import { useCanAdminSite, siteAdminOnlyText } from '@/lib/cms/site-admin-context'
import { DirecaoCell, EstadoLinha } from './direcao-cell'
import Link from 'next/link'
import { useId, useRef, type ReactNode } from 'react'
import { HoverTip } from '../_chrome/flut/flut'
import { CelulaDica, useDica } from './celula-dica'
import type { CadenceCell, CanaisRow, GrowthCell, OutCell, SwapCell, SyncCell, Thumb, VpdCell } from './view-model'
import { NicheSelect } from './niche-editor'
import type { Niche } from '@/lib/youtube/observatorio/types'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { usePrefetchOnIntent } from './use-prefetch-on-intent'
import { NotaRitmo, NotaRitmoReserva } from '../_chrome/nota-ritmo'
import { TXT, fraseAgendadoIa } from './remover-model'

const P: Record<string, ReactNode> = {
  wait: <path d="M4 1.5h8M4 14.5h8M5 1.5c0 3 6 3.5 6 6.5s-6 3.5-6 6.5M11 1.5c0 3-6 3.5-6 6.5s6 3.5 6 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  up: <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  down: <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  eq: <path d="M3 6h10M3 10h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  q: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.3v.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  warn: <><path d="M8 2 1.5 13.5h13z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  clock: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  spin: <path d="M8 2a6 6 0 1 1-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  ok: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.3 8.2 7.2 10l3.5-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
  nodata: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.5" /></>,
  plus: <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" />,
  search: <><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10.5 10.5 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" /></>,
  close: <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  dots: <><circle cx="3" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="13" cy="8" r="1.4" fill="currentColor" /></>,
}
export type IconName = keyof typeof P
export function Ic({ n, spin }: { n: IconName; spin?: boolean }) {
  return <svg className={'ico' + (spin ? ' spin' : '')} viewBox="0 0 16 16" aria-hidden="true" focusable="false">{P[n]}</svg>
}

/** "?" help. The words open in the floating layer (#flut) on mouse and on focus; Esc hides them and keeps the focus. */
export function Tip({ label, children, left }: { label: string; children: ReactNode; left?: boolean }) {
  const id = useId()
  const el = useRef<HTMLSpanElement>(null)
  // a mesma máquina de hover, foco e Esc da dica por célula (`useDica`): hover e foco são separados, as palavras ficam enquanto um dos dois as segura
  const d = useDica()
  return (
    <span ref={el} className="tip" tabIndex={0} role="button" aria-label={label} aria-describedby={d.shown ? id : undefined} {...d.handlers}>
      <HoverTip show={d.show} anchor={() => el.current} id={id} className="cn-tt" pref="baixo" align={left ? 'fim' : 'meio'} maxW={270}>{children}</HoverTip>
    </span>
  )
}

/** A5 2ª leva T8: envolve só a parte de valor da célula na dica; sem texto, a célula fica como estava. */
function Dica({ texto, children }: { texto?: string | null; children: ReactNode }) {
  return texto ? <CelulaDica texto={texto}>{children}</CelulaDica> : <>{children}</>
}

export function ThumbView({ t, lg }: { t: Thumb | null; lg?: boolean }) {
  if (!t) return null
  if (!t.src) return <span className={'thumb ph' + (lg ? ' lg' : '')} aria-hidden="true" data-thumb-missing="">{t.text}</span>
  return (
    <span className={'thumb img' + (lg ? ' lg' : '')} aria-hidden="true" data-thumb="">
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed 16:9 thumb, already sized by YouTube */}
      <img src={t.src} alt="" loading="lazy" decoding="async" />
    </span>
  )
}

/**
 * 13-week strip: long bars and Short bars per week (geometry only; the counts come from the engine). Semana fora do período (antes da
 * criação ou da cobertura guardada, `long === null`) NÃO é semana sem vídeo: as consecutivas viram UMA faixa tracejada de altura cheia,
 * de forma diferente do traço de 2 px do zero.
 */
export function Strip({ cell }: { cell: CadenceCell }) {
  const W = 130, H = 30
  const hat = 'hat' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  if (cell.kind === 'na') return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <rect key={i} x={i * 10 + 3} y={H - 2} width={3} height={2} fill="var(--strip-empty)" />)}</svg>
  )
  const fora = cell.weeks.filter(w => w.long === null).length
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={fora ? `${cell.label}; ${fora === 1 ? '1 semana fora' : `${fora} semanas fora`} do período` : cell.label}>
      {fora ? <defs><pattern id={hat} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--out-line)" strokeWidth="1" /></pattern></defs> : null}
      {cell.weeks.map((w, i) => {
        const x = i * 10
        if (w.long === null) {
          if (i > 0 && cell.weeks[i - 1]!.long === null) return null // já coberta pela faixa que começou antes
          let j = i
          while (cell.weeks[j + 1]?.long === null) j++
          return <rect key={i} data-fora="" x={x + 0.5} y={1} width={(j - i) * 10 + 9} height={H - 2} rx={1.5} fill={`url(#${hat})`} stroke="var(--out-line)" strokeWidth={1} strokeDasharray="3 2" />
        }
        const long = w.long, short = w.short ?? 0
        if (!long && !short) return <rect key={i} data-zero="" x={x + 3} y={H - 2} width={3} height={2} fill="var(--strip-empty)" />
        const hl = Math.min(long, 5) * 5.2, hs = Math.min(short, 6) * 2.2
        return (
          <g key={i}>
            {long ? <rect x={x} y={H - hl} width={5} height={hl} rx={1} fill="var(--strip-long)" /> : null}
            {short ? <rect x={x + 6} y={H - hs} width={3} height={hs} rx={1} fill="var(--strip-short)" /> : null}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * "Todos": cada medida de uma célula é uma linha (`.fm`). `label` é o rótulo da medida ("longos" / "Shorts"): na tabela só o leitor
 * de tela o ouve (o cabeçalho da coluna o diz a quem vê); nos cartões, que não têm cabeçalho de coluna, `visible` o mostra.
 */
function Fm({ label, visible, children }: { label: string; visible?: boolean; children: ReactNode }) {
  return <span className="fm">{visible ? <span className="fl">{label}</span> : <span className="sr">{label}: </span>}{children}</span>
}

/** Alguma linha à vista tem a nota do ritmo? Só então as outras reservam a coluna do sufixo (calcule sobre as linhas na tela, não sobre o total). */
export const algumaNotaDoRitmo = (rows: ReadonlyArray<{ cells: { cadence: CadenceCell } }>): boolean => rows.some(r => r.cells.cadence.kind === 'ok' && r.cells.cadence.nota !== null)

export function CadenceView({ c, c2, dica, dica2, reservar }: { c: CadenceCell; c2?: CadenceCell; dica?: string | null; dica2?: string | null; reservar?: boolean }) {
  if (c.kind === 'na') return <div className="cad"><Strip cell={c} /><Dica texto={dica}><span className="na" style={{ maxWidth: 150 }}>{c.text}</span></Dica></div>
  return (
    <div className="cad">
      <Strip cell={c} />
      <div className="v">
        {/* a unidade ("longos/sem", "Shorts/sem") já rotula cada medida */}
        <span className={c2 ? 'fm' : undefined}>
          <Dica texto={dica}>
            {c.nota?.tipo === 'piso'
              ? <span className="obs-ch-nm" data-k="pw" role="img" aria-label="não medido">—</span>
              : <><span className="num big" data-k="pw">{c.pw}</span> <span className="u">{c.unit}</span></>}
          </Dica>
          {c.nota ? <> <NotaRitmo nota={c.nota} soIcone={c.nota.tipo === 'piso'} /></> : reservar ? <> <NotaRitmoReserva /></> : null}
        </span>
        {c2 ? (
          <span className="fm"><Dica texto={dica2 ?? dica}>{c2.kind === 'ok'
            ? <><span className="num">{c2.pw}</span> <span className="u">{c2.unit}</span></>
            : <span className="nd">{c2.text}</span>}</Dica></span>
        ) : null}
        {c.nota?.tipo === 'piso' ? <small className="obs-nr-cap" data-nota-cap>{c.nota.sufixo}</small> : null}
        {c.paused ? <span className="paused"><Ic n="pause" /><span>{c.paused}</span></span> : c.sub ? <small>{c.sub}</small> : null}
      </div>
    </div>
  )
}

/** Decisão 75: a pastilha de `restrito` / `falhou` antes da frase de views por dia do canal próprio; o resto segue só a frase. */
function AusenciaDoVpd({ c }: { c: Extract<VpdCell, { kind: 'na' }> }) {
  return c.ausencia === 'falhou' || c.ausencia === 'restrito' ? <><PastilhaAusencia estado={c.ausencia} />{' '}</> : null
}

/** Uma medida de Views/dia em uma linha (a de "Todos"): o número e a base; o resto vai na dica. */
function VpdLinha({ c, dica }: { c: VpdCell; dica?: string | null }) {
  if (c.kind === 'na') return <Dica texto={dica}><AusenciaDoVpd c={c} /><span className="nd">{c.text}</span></Dica>
  const ressalva = c.tail ? c.tail.replace(/^,\s*/, '') : null
  return (
    <span>
      <Dica texto={dica}><span className="big num" data-k="vpd">{c.big}</span>{' '}
      <span className={'cap2' + (c.weak ? ' weak' : '')}>{c.abs ? <><span className="num">{c.abs}</span>/dia, </> : null}n{' '}={' '}<span data-k="n">{c.n}</span>{c.weak ? ', base fraca' : ''}</span></Dica>
      {/* a ressalva de dado velho fica à vista (teclado e toque não leem title): o número não parece atual */}
      {ressalva ? <span className="cap2 ressalva" data-ressalva="">{' '}{ressalva}</span> : null}
    </span>
  )
}

/** A frase da falta de formato ("sem Shorts", "sem vídeos") já diz o que é: nunca leva rótulo visível na frente. */
const semRotulo = (c: VpdCell | OutCell) => c.kind === 'na' && c.falta === true

export function VpdView({ c, c2, visible, dica, dica2 }: { c: VpdCell; c2?: VpdCell; visible?: boolean; dica?: string | null; dica2?: string | null }) {
  if (c2) return <><Fm label="longos" visible={visible}><VpdLinha c={c} dica={dica} /></Fm><Fm label="Shorts" visible={visible && !semRotulo(c2)}><VpdLinha c={c2} dica={dica2} /></Fm></>
  if (c.kind === 'na') return <Dica texto={dica}><AusenciaDoVpd c={c} /><span className="na r">{c.text}</span></Dica>
  return (
    <Dica texto={dica}>
      <span className="big num" data-k="vpd">{c.big}</span>
      <span className="cap" style={{ whiteSpace: 'normal' }}>
        {c.abs ? <><span className="num">{c.abs}</span>/dia, </> : null}
        <span className={c.weak ? 'weak' : ''}>n{' '}={' '}<span data-k="n">{c.n}</span>{c.weak ? ', base fraca' : ''}</span>
        {c.tail}
      </span>
    </Dica>
  )
}

/** Uma medida de Outliers em uma linha (a de "Todos"): a contagem com o maior múltiplo, sem thumbnail. */
function OutLinha({ c, upnextHref, dica }: { c: OutCell; upnextHref: string; dica?: string | null }) {
  // o botão "Planejar em Próximos" fica fora do gatilho da dica
  if (c.kind === 'na') return <span className="nd"><Dica texto={dica}>{c.text}{c.weak ? <> <span className="weak">{c.weak}</span></> : null}</Dica>{c.upnext ? <> <a className="btn small link" href={upnextHref}>{c.upnext}</a></> : null}</span>
  return <Dica texto={dica}><b className={`mult num ${c.tier}`}>{c.mult}</b> <span className="cap2">{c.count}</span></Dica>
}

export function OutView({ c, c2, upnextHref, visible, dica, dica2 }: { c: OutCell; c2?: OutCell; upnextHref: string; visible?: boolean; dica?: string | null; dica2?: string | null }) {
  if (c2) return <><Fm label="longos" visible={visible}><OutLinha c={c} upnextHref={upnextHref} dica={dica} /></Fm><Fm label="Shorts" visible={visible && !semRotulo(c2)}><OutLinha c={c2} upnextHref={upnextHref} dica={dica2} /></Fm></>
  if (c.kind === 'na') return (
    <span className="na">
      <Dica texto={dica}>{c.text}{c.weak ? <> <span className="weak">{c.weak}</span></> : null}</Dica>
      {c.upnext ? <> <a className="btn small link" href={upnextHref}>{c.upnext}</a></> : null}
    </span>
  )
  return (
    <Dica texto={dica}><div className="out">
      <ThumbView t={c.thumb} />
      <div>
        <div className="t">{c.videoTitle}</div>
        <div className="cap"><b className={`mult num ${c.tier}`} data-k="best">{c.mult}</b><span className="det"> vs {c.vs}, n{' '}={' '}<span data-k="bestN">{c.n}</span></span></div>
        <div className="cap"><span className="det">publicado </span><span>{c.published}</span><span className="det">, <span data-k="outs">{c.count}</span></span></div>
      </div>
    </div></Dica>
  )
}

export function SwapView({ c, dica }: { c: SwapCell; dica?: string | null }) {
  if (c.kind === 'na') return <span className="na">{c.text}</span>
  return <Dica texto={dica}><div className="swap"><div className="k num" data-k="sw">{c.n}</div><div className="last">{c.last}</div></div></Dica>
}

export function GrowthView({ c, dica }: { c: GrowthCell; dica?: string | null }) {
  // A5 2ª leva: sem setas; o sinal (+ ou −) e a palavra dizem o sentido; a dica da célula escreve o intervalo real.
  if (c.kind === 'na') return <Dica texto={dica ?? c.title}><span className="na r">{c.text}</span></Dica>
  if (c.kind === 'flat') return <Dica texto={dica}><span className="big num gr-flat">{c.big}</span><span className="cap capr" style={{ whiteSpace: 'normal', maxWidth: 135 }}><span data-k="growth">{c.cap}</span></span></Dica>
  return (
    <Dica texto={dica}>
      <b className="big num gr-n">{c.big}</b>
      <span className="cap num capr" data-k="growth" style={{ whiteSpace: 'normal', maxWidth: 118 }}>{c.cap}</span>
    </Dica>
  )
}

export type LocalSync = 'now' | 'just' | 'queued' | undefined
export function SyncView({ c, local, onRetry, onRemove, somenteLeitura = false, dica }: { c: SyncCell; local: LocalSync; onRetry: () => void; onRemove: () => void; somenteLeitura?: boolean; dica?: string | null }) {
  // "Administrar o site" step: removing a channel is for admins.
  const canAdminSite = useCanAdminSite()
  const cov = c.cov ? <div className="cov">{c.cov}</div> : null
  if (local === 'now') return <><div className="st" style={{ color: 'var(--info)' }}><Ic n="spin" spin />Sincronizando agora</div>{cov}</>
  if (local === 'queued' && c.queued) return <><div className="st" style={{ color: 'var(--muted)' }}><Ic n="clock" />{c.queued.label}</div>{c.queued.cov ? <div className="cov">{c.queued.cov}</div> : null}</>
  if (local === 'just') return <><div className="st"><Ic n="ok" /><span style={{ color: 'var(--success)' }}>Sincronizado agora</span></div>{cov}</>
  if (c.state === 'ok') return <><div className="st"><span className="dot" style={{ background: 'var(--success)' }} /><Dica texto={dica}>{c.label}</Dica></div>{cov}</>
  if (c.state === 'atrasado') return (
    <>
      <div className="st" style={{ color: 'var(--warning-text)' }}><Ic n="clock" /><Dica texto={dica}>{c.label}</Dica></div>
      {c.msg ? <div className="msg late">{c.msg}</div> : null}
      {c.canRetry ? <div className="act"><button type="button" className="btn small" onClick={onRetry} disabled={somenteLeitura} title={somenteLeitura ? 'Você só pode ler esta lista.' : undefined}>Tentar de novo</button></div> : null}
    </>
  )
  if (c.state === 'erro') return (
    <>
      <div className="st" style={{ color: 'var(--danger-text)' }}><Ic n="warn" /><Dica texto={dica}>{c.label}</Dica></div>
      {c.msg ? <div className="msg">{c.msg}</div> : null}
      {c.canRemove && canAdminSite ? <div className="act"><button type="button" className="btn small" onClick={onRemove} disabled={somenteLeitura} title={somenteLeitura ? 'Você só pode ler esta lista.' : undefined}>Remover canal…</button></div> : null}
      {c.canRemove && !canAdminSite ? <div className="msg" role="note" data-testid="admin-only-note">{siteAdminOnlyText('remover um canal')}</div> : null}
    </>
  )
  return (
    <>
      <div className="st" style={{ color: 'var(--info)' }}><Ic n="spin" spin />{c.label}</div>
      {c.progress ? (
        <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={c.progress.total} aria-valuenow={c.progress.done} aria-label="Busca de vídeos">
          <i style={{ width: `${c.progress.total ? (c.progress.done / c.progress.total) * 100 : 0}%` }} />
        </div>
      ) : null}
      {cov}
    </>
  )
}

/**
 * Channel cell (canais.html chCell): avatar, name with the language mark of an own channel, niche select, subscribers with the
 * rounding tip. A competitor's name and avatar are links to its channel page (`r.href`, warmed after 150 ms of hover or focus);
 * an own channel's name is still the button that opens the drawer. An own channel takes two .sub lines: "seu canal" + niche,
 * then subscribers.
 */
/** Ações do canal agendado dentro da célula do canal (lista e cartão); ausente = só o selo e a idade. */
export interface AgendadoAcoes { ocupado: boolean; onDesfazer: () => void; onCopiar: () => void }

/**
 * O canal que o dono mandou guardar no NAS e o agente ainda não guardou. Mostra o selo, há quanto tempo, e (só para quem administra o site) o
 * Desfazer e o pedido ao agente. A forma é própria (borda e fundo na linha, selo com relógio): nunca só cor.
 */
export function LinhaAgendada({ nome, idade, desde, podeAdministrar, ocupado, onDesfazer, onCopiar }: { nome: string; idade: string; /** ISO do pedido: a data absoluta, para o leitor de tela e o pacote de IA. */ desde: string; podeAdministrar: boolean; ocupado: boolean; onDesfazer: () => void; onCopiar: () => void }) {
  return (
    <div className="agd-corpo" data-agendado="">
      <span className="agd-selo">
        <svg className="ico" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>
        {TXT.selo}
      </span>
      <span className="agd-txt">{TXT.aguardando} · {idade}<span className="sr"> ({fraseAgendadoIa(desde)})</span></span>
      {podeAdministrar ? (
        <span className="agd-acoes">
          <button type="button" className="btn small" aria-busy={ocupado || undefined} aria-label={`Desfazer a remoção de ${nome}`} onClick={onDesfazer}>Desfazer</button>
          <button type="button" className="btn small" onClick={onCopiar}>Copiar pedido ao agente</button>
        </span>
      ) : null}
    </div>
  )
}

/** O aviso dos detalhes (gaveta e página do canal) do canal agendado: só informa, sem botão (decisão do dono). O Desfazer fica na lista de Canais. */
export function AvisoAgendado({ idade, desde }: { idade: string; desde?: string }) {
  return (
    <div className="agd-aviso" role="status" data-agendado-aviso="">
      <span className="agd-selo">
        <svg className="ico" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>
        {TXT.selo}
      </span>
      <p>{TXT.avisoDetalhes}</p>
      <span className="agd-idade">{idade}{desde ? <span className="sr"> ({fraseAgendadoIa(desde)})</span> : null}</span>
    </div>
  )
}

/** Sem as ações da tela-mãe o selo aparece sem botões (a prop `podeAdministrar` fica falsa): nada mudo na tela. */
const SEM_ACAO = () => undefined

export function ChCell({ r, ctx, onOpen, onNiche, agendado }: { r: CanaisRow; ctx: string; onOpen: () => void; onNiche: (n: Niche) => void; agendado?: AgendadoAcoes }) {
  // "Administrar o site" step: the niche of an OWN channel is part of its identity (admins only); it shows as text.
  const canAdminSite = useCanAdminSite()
  const intent = usePrefetchOnIntent(r.href)
  const avatar = <ChannelAvatar as="div" src={r.avatar} ini={r.ini} color={r.color} />
  return (
    <div className="ch">
      {r.href ? <Link href={r.href} prefetch={false} className="avlink" data-avatar-link="" aria-hidden="true" tabIndex={-1}>{avatar}</Link> : avatar}
      <div style={{ minWidth: 0 }}>
        <div className="nmrow">
          {r.href
            ? <Link href={r.href} prefetch={false} className="nmbtn" data-open={r.id} title={r.name} aria-label={`Abrir a página de ${r.name}`} {...intent}>{r.name}</Link>
            : r.semPagina
              // canal próprio sem vídeos (16.8): não há para onde ir, então o nome é texto, não um botão morto; a frase abaixo diz por quê
              ? <span className="nmbtn nmtxt" title={r.name} aria-describedby={`sempg-${ctx}-${r.id}`}>{r.name}</span>
              : <button type="button" className="nmbtn" data-open={r.id} title={r.name} aria-label={`Abrir detalhes de ${r.name}`} onClick={onOpen}>{r.name}</button>}
          {r.lang ? <abbr className="langtag" title={r.lang.title}>{r.lang.code}</abbr> : null}
        </div>
        {r.own ? (
          <div className="sub">
            <span className="youtag">seu canal</span>
            <NicheSelect id={r.id} name={r.name} niche={r.niche} ctx={ctx} onChange={onNiche} readOnly={!canAdminSite} />
          </div>
        ) : null}
        <div className="sub">
          {r.own ? null : <NicheSelect id={r.id} name={r.name} niche={r.niche} ctx={ctx} onChange={onNiche} />}
          <Dica texto={r.dicas.subs}>{r.subsOculto ? <span className="obs-ch-nm" data-subs-ocultos="">{r.subs}</span> : <span className="num">{r.subs}</span>}</Dica>
        </div>
        <EstadoLinha r={r} />
        {r.agendado ? <LinhaAgendada nome={r.name} idade={r.agendado.idade} desde={r.agendado.desde} podeAdministrar={canAdminSite && agendado != null} ocupado={agendado?.ocupado ?? false} onDesfazer={agendado?.onDesfazer ?? SEM_ACAO} onCopiar={agendado?.onCopiar ?? SEM_ACAO} /> : null}
        {r.semPagina ? <div className="sub sempg" id={`sempg-${ctx}-${r.id}`}>{r.semPagina}</div> : null}
        {r.semFormato ? (
          <div className="sub semfmt" data-sem-formato="">
            <span>{r.semFormato.label}</span>
            <Tip label="Sobre os vídeos sem formato confirmado">{r.semFormato.tip}</Tip>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** A5 2ª leva T8: o valor da Direção com a dica da célula (substitui o `?` ao lado). Sem `title` nativo: o texto longo do "não medido" vai na dica. */
export function DirecaoValor({ r, cartao = false }: { r: CanaisRow; cartao?: boolean }) {
  const d = r.direcao, dica = r.dicas.direcao
  if (d.tipo === 'nao_medido' || d.tipo === 'canal_proprio') {
    return <Dica texto={dica}><span className="obs-ch-nm">{d.curta}<span className="obs-md-sr">: {d.longa}</span></span></Dica>
  }
  return <Dica texto={dica}><DirecaoCell r={r} cartao={cartao} /></Dica>
}
