/**
 * E5a Tarefa 15: a faixa de estado do canal. Erro (faixa do lote 1, borda de perigo), "Saiu do YouTube" (pastilha tracejada do mockup 16),
 * "Primeira busca" e coleta pausada. O título fica aqui; a frase do topo não o repete (decisão 13). "Ativo", "Parado" e "Em queda" não têm faixa.
 */
import type { EstadoDaPagina } from './estado-model'
import './canal-medidas.css'

const COM_FAIXA: ReadonlySet<EstadoDaPagina['tipo']> = new Set(['saiu', 'erro', 'primeira_busca', 'pausado'])

export function FaixaDeEstado({ estado, texto }: { estado: EstadoDaPagina; texto?: string | null }) {
  if (!COM_FAIXA.has(estado.tipo)) return null
  const cls = estado.tipo === 'erro' ? 'erro' : estado.tipo === 'saiu' ? 'fora' : ''
  return (
    <div className={`pc-ban ${cls}`.trim()} role="status" data-faixa-de-estado={estado.tipo}>
      <p><b>{estado.pastilha}</b>{texto ? <> {texto}</> : null}</p>
    </div>
  )
}
