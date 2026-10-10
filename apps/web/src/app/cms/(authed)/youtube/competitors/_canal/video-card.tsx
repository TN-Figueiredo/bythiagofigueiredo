'use client'
/**
 * Cartão de vídeo da vista Capas (spec 5.4, mockup canal.js card()): thumbnail e título num link só para o Histórico; os três
 * números em colunas fixas (views, views por dia, múltiplo); os selos sobre a thumbnail são texto; a lupa e o ⋯ ficam sempre
 * visíveis. Duas paradas de Tab: o link e o ⋯ (a lupa tem tabindex -1; o teclado amplia pelo menu). A thumbnail não usa o `Thumb`
 * de Outliers: o dele é preso a `.obs-out` e leva só a duração, e aqui os selos são seis.
 */
import type { CanalSort } from '@/lib/youtube/observatorio/links'
import type { ChannelVideoView } from './videos-model'
import { VideoMenu } from './video-menu'

function Cell({ valor, rotulo, on, tier, sr }: { valor: string; rotulo: string; on: boolean; tier?: string | null; sr?: string }) {
  const t = tier ? ' t-' + tier : ''
  return (
    <span className={'cv-c' + (on ? ' on' : '')}>
      <b className={'num' + t}>{valor}</b> <i className={t.trim()}>{rotulo}</i>{sr ? <span className="obs-ch-sr">{sr}</span> : null}
    </span>
  )
}
/** Sem valor: a palavra "não medido" (rosa, hachurada) e o rótulo; para o leitor de tela, o rótulo vem primeiro. */
function Nd({ rotulo }: { rotulo: string }) {
  return <span className="cv-c nd"><span className="obs-ch-sr">{rotulo}: </span><span className="obs-ch-nm">não medido</span> <i aria-hidden="true">{rotulo}</i></span>
}

function Numeros({ v, sort }: { v: ChannelVideoView; sort: CanalSort }) {
  if (v.viewsText == null) {
    return <p className="cv-nums"><span className="cv-c s3 txt"><span className="obs-ch-nm">{v.viewsMissing}</span></span></p>
  }
  const views = <Cell valor={v.viewsText} rotulo="views" on={sort === 'vistos'} />
  if (v.semMedida) {
    return <p className="cv-nums">{views}<span className="cv-c s2 txt"><span className="obs-ch-nm">{v.semMedida}</span></span></p>
  }
  return (
    <p className="cv-nums">
      {views}
      {v.vpdText != null ? <Cell valor={v.vpdText} rotulo="views/dia" on={sort === 'vpd'} /> : <Nd rotulo="views/dia" />}
      {v.multText != null
        ? <Cell valor={v.multText} rotulo={v.multWord ?? 'múltiplo'} on={sort === 'multiplo'} tier={v.multTier} sr={v.multWord ? ' (múltiplo)' : undefined} />
        : <Nd rotulo="múltiplo" />}
    </p>
  )
}

/** Os selos: texto sobre a thumbnail, nunca controle. Fora do link, para o nome do link ser só o título. */
function Selos({ v }: { v: ChannelVideoView }) {
  const topo = [v.pinned ? 'fixado' : null, v.pub == null ? 'sem data' : null].filter((x): x is string => x != null)
  const baixo = v.isShort == null ? 'formato não confirmado' : v.isShort ? 'Short' : v.durText ?? 'sem duração'
  return (
    <span className="cv-badges">
      {topo.length ? <span className="cv-seals-tl">{topo.map(t => <span key={t} className="cv-seal">{t}</span>)}</span> : null}
      {v.swaps ? <span className="cv-seal bl">{v.swaps === 1 ? '1 troca' : `${v.swaps} trocas`}</span> : null}
      <span className={'cv-seal br' + (v.isShort === false && v.durText ? ' num' : '')}>{baixo}</span>
    </span>
  )
}

export function VideoCard({ v, sort, href, onAmpliar, onTrocas }: {
  v: ChannelVideoView; sort: CanalSort; href: string; onAmpliar: (v: ChannelVideoView) => void; onTrocas: (v: ChannelVideoView) => void
}) {
  return (
    <li className="cv-card" data-id={v.id}>
      <a className="cv-lnk" id={'cv-lnk-' + v.id} href={href}>
        <span className="cv-thumb">{v.thumbSrc ? <img src={v.thumbSrc} alt="" width={320} height={180} loading="lazy" decoding="async" /> : null}</span>
        <span className="cv-ttl obs-ch-ttl">{v.title}</span>
      </a>
      <Selos v={v} />
      {v.thumbSrc ? (
        <button type="button" className="cv-amp" tabIndex={-1} aria-label={'Ampliar a thumbnail: ' + v.title} onClick={() => onAmpliar(v)}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14M5 7h4M7 5v4" /></svg>
        </button>
      ) : null}
      <div className="cv-meta">
        {v.pub == null
          ? <span className="cv-nodate">sem data de publicação</span>
          : <time dateTime={v.pubISO ?? undefined}>{v.ageText}<span className="obs-ch-sr"> ({v.pubTitle})</span></time>}
        <VideoMenu v={v} onAmpliar={onAmpliar} onTrocas={onTrocas} />
      </div>
      <Numeros v={v} sort={sort} />
    </li>
  )
}
