/** A5 · E5a, Tarefa 3: a pastilha do estado do canal, com forma própria por estado. "Ativo" não tem pastilha. Sem estado. */
import './medidas.css'

export type EstadoNaPastilha = 'ativo' | 'parado' | 'em_queda' | 'fora_do_ar' | 'pausado' | 'sem_videos'

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const diasTxt = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`

/** Texto da pastilha. Frases do mockup 16 (tabela de frases); `pausado` não está nele (TEXTO-A-REVISAR). */
function texto(estado: Exclude<EstadoNaPastilha, 'ativo'>, dataOuDias: string | number | null): string {
  switch (estado) {
    case 'parado': return typeof dataOuDias === 'number' ? `Parado há ${diasTxt(dataOuDias)} sem publicar` : 'Parado'
    case 'em_queda': return 'Em queda sustentada'
    case 'fora_do_ar': return typeof dataOuDias === 'string' ? `Saiu do YouTube em ${dm(dataOuDias)}` : 'Saiu do YouTube'
    case 'sem_videos': return 'Sem vídeos'
    case 'pausado': return 'Coleta pausada' // TEXTO-A-REVISAR
  }
}

const ICONE: Record<Exclude<EstadoNaPastilha, 'ativo'>, string> = { parado: '⏸', em_queda: '▼', fora_do_ar: '✕', pausado: '⏸', sem_videos: '' }

export function EstadoDoCanal({ estado, dataOuDias, tambemEmQueda = false, apoio }: {
  estado: EstadoNaPastilha; dataOuDias?: string | number | null; tambemEmQueda?: boolean; apoio?: string | null
}) {
  if (estado === 'ativo') return null
  return (
    <span className="obs-md-est">
      <span className={`obs-md-pas ${estado}`}>
        <span className="obs-md-pas-i" aria-hidden="true">{ICONE[estado]}</span>
        {texto(estado, dataOuDias ?? null)}
      </span>
      {apoio ? <span className="obs-md-apoio">{apoio}</span> : null}
      {estado === 'parado' && tambemEmQueda ? <span className="obs-md-apoio">{'▼'} Também em queda.</span> : null}
    </span>
  )
}
