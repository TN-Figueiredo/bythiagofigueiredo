'use client'
/**
 * Pager that walks the origin list (back=, ids=). The trail (origin › channel › Histórico do vídeo) is the frame's now (`TrailChrome`, spec
 * A2.6). Anterior/Próximo REPLACE the browser history entry (spec 3): the Voltar leaves for the origin list, not for the previous video.
 * `onPage` tells the screen which button was used, so the one place that decides the focus after a video change can put it back on that button.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PagerView } from './view-model'
import { HIcon } from './icons'
import { cliqueSimples } from '../_chrome/clique-simples'
import { marcarPagerUsado, videoDoHref } from './pager-usado'

/**
 * O botão da ponta da lista (só a página do vídeo próprio o pede, spec 17.1): fica na tela e na ordem do Tab, apagado (`aria-disabled`), e o
 * motivo é o nome acessível e a dica. Clicar não faz nada. Leva o mesmo `data-pager-*` do link, então o foco depois de chegar na ponta continua nele.
 */
function Apagado({ motivo, lado, children }: { motivo: string; lado: 'prev' | 'next'; children: ReactNode }) {
  const marca = lado === 'prev' ? { 'data-pager-prev': '' } : { 'data-pager-next': '' }
  return <button type="button" className="btn ghost" aria-disabled="true" aria-label={motivo} title={motivo} onClick={e => e.preventDefault()} {...marca}>{children}</button>
}

/**
 * `naTrilha`: o pager mora na linha da trilha (a moldura o recebe por `aside`), sem a linha própria de `.pager-row`. Sem `onPage`, o clique
 * registra o botão usado direto em `pager-usado.ts` (o registro é de módulo, não da tela: a tela pode nem estar montada ainda).
 */
export function Pager({ pager, onPage = (which, href) => marcarPagerUsado(which, videoDoHref(href)), naTrilha = false }: { pager: PagerView | null; onPage?: (which: 'prev' | 'next', href: string) => void; naTrilha?: boolean }) {
  if (!pager) return null
  const corpo = (
      <div className="pager" data-pager="" role="group" aria-label="Vídeos da lista de origem">
        {pager.prev ? <Link className="btn ghost" href={pager.prev} replace={pager.replace} onClick={e => { if (cliqueSimples(e)) onPage?.('prev', pager.prev!) }} aria-label={pager.prevLabel} data-pager-prev=""><HIcon name="prev" />Anterior</Link> : pager.prevOff ? <Apagado motivo={pager.prevOff} lado="prev"><HIcon name="prev" />Anterior</Apagado> : null}
        <span data-pager-pos="">{pager.position}</span>
        {pager.next ? <Link className="btn ghost" href={pager.next} replace={pager.replace} onClick={e => { if (cliqueSimples(e)) onPage?.('next', pager.next!) }} aria-label={pager.nextLabel} data-pager-next="">Próximo<HIcon name="next" /></Link> : pager.nextOff ? <Apagado motivo={pager.nextOff} lado="next">Próximo<HIcon name="next" /></Apagado> : null}
      </div>
  )
  return naTrilha ? corpo : <div className="pager-row">{corpo}</div>
}
