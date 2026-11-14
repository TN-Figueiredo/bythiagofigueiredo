import { Plug } from 'lucide-react'
import CmsLink from '../../../_shared/cms-link'
import { FRASES_CONECTAR as F } from '@/lib/youtube/observatorio/acesso-ia/frases-conectar'
import '@/app/cms/(authed)/conectar-ia/conectar-ia.css'

/** q10: atalho sob o título do Observatório. `mostrar` = liberação ativa E travas ligadas (decidido por quem chama; em erro, false). */
export function LinhaConectarIa({ mostrar }: { mostrar: boolean }) {
  if (!mostrar) return null
  return (
    <p className="cia-short">
      <Plug aria-hidden size={16} strokeWidth={1.8} />
      <span>{F.linhaObservatorio}</span>
      <CmsLink href="/cms/conectar-ia">Conectar sua IA</CmsLink>
    </p>
  )
}
