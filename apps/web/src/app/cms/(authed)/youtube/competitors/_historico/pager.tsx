'use client'
/**
 * Pager that walks the origin list (back=, ids=). The trail (origin › channel › Histórico do vídeo) is the frame's now (`TrailChrome`, spec
 * A2.6). Anterior/Próximo REPLACE the browser history entry (spec 3): the Voltar leaves for the origin list, not for the previous video.
 * `onPage` tells the screen which button was used, so the one place that decides the focus after a video change can put it back on that button.
 */
import Link from 'next/link'
import type { PagerView } from './view-model'
import { HIcon } from './icons'
import { cliqueSimples } from '../_chrome/clique-simples'

export function Pager({ pager, onPage }: { pager: PagerView | null; onPage?: (which: 'prev' | 'next', href: string) => void }) {
  if (!pager) return null
  return (
    <div className="pager-row">
      <div className="pager" data-pager="" role="group" aria-label="Vídeos da lista de origem">
        {pager.prev ? <Link className="btn ghost" href={pager.prev} replace={pager.replace} onClick={e => { if (cliqueSimples(e)) onPage?.('prev', pager.prev!) }} aria-label={pager.prevLabel} data-pager-prev=""><HIcon name="prev" />Anterior</Link> : null}
        <span data-pager-pos="">{pager.position}</span>
        {pager.next ? <Link className="btn ghost" href={pager.next} replace={pager.replace} onClick={e => { if (cliqueSimples(e)) onPage?.('next', pager.next!) }} aria-label={pager.nextLabel} data-pager-next="">Próximo<HIcon name="next" /></Link> : null}
      </div>
    </div>
  )
}
