// Vazio da lista (F3 T5): um contêiner na página; uma linha só no bloco do A/B Lab (sem parágrafo, sem min-height).
import type { ReactNode } from 'react'
import CmsLink from '../../../_shared/cms-link'
import { Ic } from './icones'
import type { VistaDaLista } from './view-model'

type Vazio = NonNullable<VistaDaLista['vazio']>
const ICONE: Record<Vazio['familia'], () => ReactNode> = { resolvido: () => Ic.ok(18), calmo: Ic.calm, espera: Ic.wait, problema: () => Ic.warn(18), nm: Ic.q }
const CLASSE: Record<Vazio['familia'], string> = { resolvido: 'sg-ok', calmo: '', espera: '', problema: 'sg-prob', nm: 'sg-nm' }

export function VazioDaLista(p: { vazio: Vazio; modo: 'pagina' | 'bloco'; verTodasHref?: string; alerta?: boolean; acao?: ReactNode }) {
  const { vazio: v } = p
  const classe = CLASSE[v.familia]
  const papel = p.alerta ? 'alert' : v.familia === 'problema' ? 'status' : undefined
  if (p.modo === 'bloco') {
    return (
      <div className={`sg-vz1 ${classe}`.trim()} role={papel}>
        <span className="sg-vic">{ICONE[v.familia]()}</span>
        <span className="sg-vt">{v.titulo}</span>
        {p.acao ?? (p.verTodasHref ? <CmsLink href={p.verTodasHref} className="sg-btn sg-ghost">Ver detalhes</CmsLink> : null)}
      </div>
    )
  }
  return (
    <div className={`sg-vz ${classe}`.trim()} role={papel}>
      <span className="sg-vic">{ICONE[v.familia]()}</span>
      <div>
        <h3>{v.titulo}</h3>
        {v.texto !== '' && <p>{v.texto}</p>}
        {p.acao && <div className="sg-acts">{p.acao}</div>}
      </div>
    </div>
  )
}
