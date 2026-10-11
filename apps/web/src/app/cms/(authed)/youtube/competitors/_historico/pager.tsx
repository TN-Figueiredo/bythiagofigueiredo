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
import { marcarPagerUsado, videoDoHref } from './pager-usado'

/**
 * `naTrilha`: o pager mora na linha da trilha (a moldura o recebe por `aside`), sem a linha própria de `.pager-row`. Sem `onPage`, o clique
 * registra o botão usado direto em `pager-usado.ts` (o registro é de módulo, não da tela: a tela pode nem estar montada ainda).
 */
export function Pager({ pager, onPage = (which, href) => marcarPagerUsado(which, videoDoHref(href)), naTrilha = false }: { pager: PagerView | null; onPage?: (which: 'prev' | 'next', href: string) => void; naTrilha?: boolean }) {
  if (!pager) return null
  const corpo = (
      <div className="pager" data-pager="" role="group" aria-label="Vídeos da lista de origem">
        {pager.prev ? <Link className="btn ghost" href={pager.prev} replace={pager.replace} onClick={e => { if (cliqueSimples(e)) onPage?.('prev', pager.prev!) }} aria-label={pager.prevLabel} data-pager-prev=""><HIcon name="prev" />Anterior</Link> : null}
        <span data-pager-pos="">{pager.position}</span>
        {pager.next ? <Link className="btn ghost" href={pager.next} replace={pager.replace} onClick={e => { if (cliqueSimples(e)) onPage?.('next', pager.next!) }} aria-label={pager.nextLabel} data-pager-next="">Próximo<HIcon name="next" /></Link> : null}
      </div>
  )
  return naTrilha ? corpo : <div className="pager-row">{corpo}</div>
}
