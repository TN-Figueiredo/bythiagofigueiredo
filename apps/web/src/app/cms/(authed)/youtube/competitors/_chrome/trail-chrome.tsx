'use client'
/**
 * Frame of the pages that live INSIDE a channel (spec 5, A1.1): only the trail ("Canais › Leo Khev") and the time-zone note.
 * No section tabs and no niche bar: those belong to the Observatório's own pages, not to a channel's. The Link is imported
 * here, in the client module, so no Server Component hands a Link down as a prop (Next 16).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ToastProvider } from './toasts'
import { marcarVoltaPelaTrilha, renovarUltimoVideo } from './ultimo-video'
import { cliqueSimples } from './clique-simples'
import { esperarVoltaAoCanal } from '../_canal/use-rolagem-ao-voltar'
import { MeuCanal } from './meu-canal'
import type { OwnMenu } from './own-menu'
import './trail-chrome.css'

/**
 * `voltaAoCanal` (id do canal) marca o item que leva à página do canal a partir do Histórico do vídeo: o clique simples é um `push`, não um
 * `popstate`, e o spec (3, 6.5) o trata como o Voltar: a página do canal devolve a rolagem e põe o foco no último vídeo visto. É um dado, não
 * uma função, porque a trilha chega de um Server Component (Next 16: nada de função como prop).
 */
export interface Crumb { text: string; href?: string; voltaAoCanal?: string }

/**
 * `aside` é o que a página põe na linha da trilha, entre ela e a nota de fuso (o pager do Histórico do vídeo, como no mockup aprovado: trilha à
 * esquerda, pager à direita, a mesma linha). É um elemento já montado pelo servidor; nenhuma função passa por aqui.
 */
export function TrailChrome({ crumbs, aside, owns, atual, children }: {
  crumbs: Crumb[]; aside?: ReactNode
  /** Os canais próprios do site para o atalho "Meu canal" (spec 15.2), à direita da trilha. Dado simples; sem canal próprio (ou sem o dado) a trilha fica sem o atalho. */
  owns?: OwnMenu | null
  /** O id do canal próprio cuja página está aberta (o item do menu leva aria-current="page"). */
  atual?: string
  children: ReactNode
}) {
  return (
    <div data-obs="" className="obs-ch-root">
      <ToastProvider>
        <div className="obs-ch-content">
          <div className="obs-tr-top">
            <nav className="crumbs" aria-label="Caminho">
              <ol>
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1
                  return (
                    <li key={i} aria-current={last ? 'page' : undefined}>
                      {!last && c.href
                        ? <Link href={c.href} onClick={c.voltaAoCanal ? (e => { if (cliqueSimples(e)) { renovarUltimoVideo(c.voltaAoCanal!); marcarVoltaPelaTrilha(c.voltaAoCanal!); esperarVoltaAoCanal() } }) : undefined}>{c.text}</Link>
                        : c.text}
                    </li>
                  )
                })}
              </ol>
            </nav>
            {owns ? <MeuCanal owns={owns} atual={atual} /> : null}
            {aside ? <div className="obs-tr-aside">{aside}</div> : null}
            <span className="obs-tr-tz">Horários em São Paulo</span>
          </div>
          <div className="obs-ch-screen">{children}</div>
        </div>
      </ToastProvider>
    </div>
  )
}
