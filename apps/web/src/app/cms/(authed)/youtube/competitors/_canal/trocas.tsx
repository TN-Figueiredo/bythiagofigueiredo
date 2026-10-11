'use client'
/**
 * A aba Trocas (spec 5.7, mockup canal.js trocas()): um cartão por vídeo com as trocas de título e thumbnail dos últimos 30 dias.
 * O título do cartão e o botão "Abrir histórico do vídeo" levam ao mesmo destino; em cartão com duas ou mais trocas cada uma
 * tem o seu link "Abrir nesta troca". A thumbnail fica fora da ordem de Tab (é redundante); a lupa é uma parada de Tab aqui. A
 * linha de cada troca é clicável com o mouse; o teclado usa os links dentro dela. Dado ausente (imagem não arquivada) é frase, nunca
 * imagem inventada. Server actions e navegação chegam por props.
 */
import type { MouseEvent } from 'react'
import Link from 'next/link'
import type { CanalTrocasView, TrocaCard, TrocaView } from './trocas-model'

const Swap = () => (
  <svg className="i" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13" /></svg>
)
const Chev = () => (
  <svg className="i" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
)

/** Só um clique simples, de botão principal, sem tecla de modificação, fora de links e botões, vira navegação da linha. */
const cliqueSimples = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)

function Imagem({ src, alt }: { src: string | null; alt: string }) {
  return src ? <img className="ct-mini" src={src} alt={alt} width={96} height={54} loading="lazy" decoding="async" /> : null
}

function Linha({ t, multi, onAbrir }: { t: TrocaView; multi: boolean; onAbrir: (href: string) => void }) {
  const thumb = t.campo === 'Thumbnail trocada'
  return (
    <li className="ct-sw" data-troca={t.id} onClick={e => {
      if (!cliqueSimples(e) || (e.target as HTMLElement).closest('a,button')) return
      onAbrir(t.href)
    }}>
      <div>
        <p className="ct-what">
          <Swap /><b>{t.campo}</b>
          <span><time dateTime={t.iso} title={t.quandoTitle}>{t.quando}</time></span>
        </p>
        <dl>
          <dt>Antes</dt>
          <dd>{thumb
            ? (t.antes.semArquivo ? <span className="ct-na">imagem anterior não arquivada</span> : <Imagem src={t.antes.thumb} alt="Thumbnail anterior" />)
            : t.antes.texto}</dd>
          <dt>Agora</dt>
          <dd>{thumb
            ? (t.agora.thumb ? <Imagem src={t.agora.thumb} alt="Thumbnail nova" /> : <span className="ct-na">imagem não arquivada</span>)
            : t.agora.texto}</dd>
        </dl>
        <p className="ct-efeito"><b>No histórico, efeito em 7 dias:</b> {t.efeito}</p>
      </div>
      {multi ? <Link prefetch={false} className="ct-rowgo" href={t.href} aria-label={t.hrefLabel}>Abrir nesta troca <Chev /></Link> : null}
    </li>
  )
}

function Cartao({ c, onAmpliar, onAbrir }: { c: TrocaCard; onAmpliar: (c: TrocaCard, trigger: HTMLElement | null) => void; onAbrir: (href: string) => void }) {
  const multi = c.trocas.length > 1
  return (
    <li className={'ct-card' + (multi ? ' multi' : '')} data-id={c.videoId}>
      <span className="ct-twrap">
        <Link prefetch={false} className="ct-thumb" href={c.href} tabIndex={-1} aria-hidden="true">
          {c.thumbSrc ? <img src={c.thumbSrc} alt="" width={320} height={180} loading="lazy" decoding="async" /> : null}
        </Link>
        {c.viewer ? (
          <button type="button" className="cv-amp" aria-label={'Ampliar a thumbnail: ' + c.title} onClick={e => onAmpliar(c, e.currentTarget)}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14M5 7h4M7 5v4" /></svg>
          </button>
        ) : null}
      </span>
      <div className="ct-gh">
        <h3><Link prefetch={false} href={c.href}>{c.title}</Link></h3>
        {multi ? <span className="ct-mesmo"><Swap />{c.contagem}</span> : null}
        <Link prefetch={false} className="obs-ch-btn ct-go" href={c.href} aria-label={c.hrefLabel}>Abrir histórico do vídeo <Chev /></Link>
      </div>
      {multi ? <p className="ct-also">O botão abre o histórico do vídeo todo. Cada troca abaixo tem o seu link e abre o histórico já nela.</p> : null}
      <ul className="ct-rows">{c.trocas.map(t => <Linha key={t.id} t={t} multi={multi} onAbrir={onAbrir} />)}</ul>
    </li>
  )
}

export function Trocas({ view, filtro, hrefTodas, onTodas, onAmpliar, onAbrir }: {
  view: CanalTrocasView
  /** `video=<id>` de um vídeo deste canal; null = todas (inclusive quando o id não é deste canal). */
  filtro: { id: string; title: string } | null
  hrefTodas: string
  onTodas: () => void
  onAmpliar: (c: TrocaCard, trigger: HTMLElement | null) => void
  onAbrir: (href: string) => void
}) {
  const semTroca = view.total === 0
  const cards = filtro && !semTroca ? view.cards.filter(c => c.videoId === filtro.id) : view.cards
  const nDele = cards.reduce((n, c) => n + c.trocas.length, 0)
  return (
    <section aria-labelledby="ct-h2" className="ct-sec">
      <h2 id="ct-h2" className="ct-h2" tabIndex={-1}>{view.titulo}</h2>
      {semTroca ? (
        <div className="cv-empty"><p>{view.vazio}</p></div>
      ) : (
        <>
          <p className="ct-intro">{view.intro}</p>
          {filtro ? (
            <p className="ct-chip">
              <span>Só as trocas de “{filtro.title}”: {nDele} de {view.total}</span>
              <a className="lk" href={hrefTodas} onClick={e => { if (!cliqueSimples(e)) return; e.preventDefault(); onTodas() }}>Ver as {view.total} trocas do canal</a>
            </p>
          ) : null}
          {filtro && !cards.length ? <div className="cv-empty"><p>Este vídeo não teve troca de título nem de thumbnail nos últimos 30 dias.</p></div> : null}
          {cards.length ? (
            <ul className="ct-list" aria-label="Trocas por vídeo, o vídeo com a troca mais recente primeiro">
              {cards.map(c => <Cartao key={c.videoId} c={c} onAmpliar={onAmpliar} onAbrir={onAbrir} />)}
            </ul>
          ) : null}
          {view.mudancasLink ? <p className="ct-mud"><Link prefetch={false} className="lk" href={view.mudancasLink.href}>{view.mudancasLink.text}</Link></p> : null}
        </>
      )}
    </section>
  )
}
