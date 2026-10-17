/** E5a Tarefa 16: a barra de progresso de uma medida que ainda não fecha ("50 de 112 dias"). Só existe com data; sem data a tela usa a hachura. */
import './canal-medidas.css'

export function BarraDeProgresso({ feitos, total, rotulo, unidade = 'dias' }: { feitos: number; total: number; rotulo: string; unidade?: string }) {
  const pc = Math.max(2, Math.min(100, (100 * feitos) / total))
  return (
    <div className="pc-pg" role="img" aria-label={`${rotulo}: ${feitos} de ${total}${unidade === '' ? '' : ` ${unidade}`}`}>
      <span className="pc-pg-f" style={{ width: `${pc}%` }} />
      <span className="pc-pg-r" />
    </div>
  )
}
