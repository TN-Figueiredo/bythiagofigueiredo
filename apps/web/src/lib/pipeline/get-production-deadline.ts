import { subDays, formatISO, parseISO } from 'date-fns'
import type { Stage } from './up-next-constants'

export function getProductionDeadline(pubDate: string, stage: Stage): string | undefined {
  const pub = parseISO(pubDate)
  switch (stage) {
    case 'idea': case 'outline': case 'draft': case 'roteiro':
      return formatISO(subDays(pub, 4), { representation: 'date' })
    case 'gravacao':
      return formatISO(subDays(pub, 3), { representation: 'date' })
    case 'edicao':
      return formatISO(subDays(pub, 2), { representation: 'date' })
    case 'pos_producao': case 'ready':
      return formatISO(subDays(pub, 1), { representation: 'date' })
    case 'scheduled': case 'published':
      return undefined
  }
}
