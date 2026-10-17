/** As três pastilhas de ausência (decisão 75). Sem diretiva e sem hook: importável por server e client components. */
import './ausencia.css'
import { CAMINHO_AVISO, CAMINHO_CADEADO } from './glifos'
import { ROTULO_AUSENCIA, type EstadoAusencia } from './estado'

function Icone({ caminho, tamanho }: { caminho: string; tamanho: number }) {
  return <svg viewBox="0 0 14 14" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: caminho }} />
}

export function PastilhaAusencia(p: { estado: EstadoAusencia; motivo?: string; quadradinho?: boolean; texto?: string }) {
  const { estado, motivo, quadradinho, texto } = p
  const rotulo = ROTULO_AUSENCIA[estado]
  if (estado === 'nao_medido') {
    if (quadradinho) return <span className="obs-ch-nm nm-q" role="img" aria-label={rotulo} title={rotulo} />
    return <span className="obs-ch-nm" title={motivo}>{texto ?? rotulo}{motivo ? <span className="obs-md-sr">: {motivo}</span> : null}</span>
  }
  const forma = estado === 'falhou' ? 'obs-au-falhou' : 'obs-au-restrito'
  const caminho = estado === 'falhou' ? CAMINHO_AVISO : CAMINHO_CADEADO
  if (quadradinho) {
    return <span className={`obs-au-q ${forma}`} role="img" aria-label={rotulo} title={rotulo}><Icone caminho={caminho} tamanho={12} /></span>
  }
  return (
    <span className={`obs-au ${forma}`} title={motivo}>
      <Icone caminho={caminho} tamanho={14} />{rotulo}{motivo ? <span className="obs-md-sr">: {motivo}</span> : null}
    </span>
  )
}
