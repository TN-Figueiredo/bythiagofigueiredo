'use client'
/** Breadcrumb (origin tab, optional channel) + pager that walks the origin list (back=, ids=). */
import Link from 'next/link'
import type { CrumbsView, PagerView } from './view-model'
import { HIcon } from './icons'

export function Crumbs({ crumbs, pager }: { crumbs: CrumbsView; pager: PagerView | null }) {
  return (
    <nav className="crumbs" aria-label="Caminho">
      <ol>
        <li><Link href={crumbs.href} data-crumb="">{crumbs.crumb}</Link></li>
        {crumbs.sub ? <li><Link href={crumbs.sub.href}>{crumbs.sub.text}</Link></li> : null}
        <li aria-current="page">Histórico do vídeo</li>
      </ol>
      {pager ? (
        <div className="pager" data-pager="">
          {pager.prev ? <Link className="btn ghost" href={pager.prev} aria-label={pager.prevLabel} data-pager-prev=""><HIcon name="prev" />Anterior</Link> : null}
          <span data-pager-pos="">{pager.position}</span>
          {pager.next ? <Link className="btn ghost" href={pager.next} aria-label={pager.nextLabel} data-pager-next="">Próximo<HIcon name="next" /></Link> : null}
        </div>
      ) : null}
    </nav>
  )
}
