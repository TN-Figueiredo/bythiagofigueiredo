'use client'

import type { ReactElement } from 'react'
import type { EstadoInterruptor } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import { NAO_MEDIDO, NOTA_DESCARTES, SO_ADMIN, faltaParaLigar, tituloDoInterruptor } from '@/lib/youtube/observatorio/arquivo-mensal/interruptor'

function Barra({ rotulo, feitas, total }: { rotulo: string; feitas: number; total: number }): ReactElement {
  return (
    <div>
      <div><span>{rotulo}</span> <span>{feitas} de {total}</span></div>
      <div role="progressbar" aria-label={rotulo} aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={total}>
        <i style={{ display: 'block', height: 6, width: `${Math.round((100 * Math.min(feitas, total)) / total)}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  )
}

/** Peça 4 mínima (M6a): título, o que falta e nada mais. Não há botão de ligar nesta etapa (a Tarefa 12c [M6b] completa). */
export function PecaInterruptor({ classe, estado, envOn, hojeSP, ehAdmin }: { classe: string; estado: EstadoInterruptor | null; envOn: boolean; hojeSP: string; ehAdmin: boolean }): ReactElement {
  const titulo = tituloDoInterruptor(estado, envOn, hojeSP)
  return (
    <div role="group" aria-label={`Automático de ${classe}`}>
      <p><strong>{titulo}</strong></p>
      {estado === null ? <p>{NAO_MEDIDO}</p> : null}
      {estado !== null && estado.estado === 'nao_pode' ? <NaoPode descartes={estado.descartes ?? 0} simulacoes={estado.simulacoes ?? 0} /> : null}
      {estado !== null && !ehAdmin && estado.estado !== 'nao_existe' ? <p>{SO_ADMIN}</p> : null}
    </div>
  )
}

function NaoPode({ descartes, simulacoes }: { descartes: number; simulacoes: number }): ReactElement {
  if (descartes >= 3 && simulacoes >= 2) return <p>O automático chega na próxima etapa.</p>
  return (
    <>
      <p>{faltaParaLigar(descartes, simulacoes)}</p>
      <Barra rotulo="Saídas feitas por você" feitas={descartes} total={3} />
      <Barra rotulo="Simulações vistas" feitas={simulacoes} total={2} />
      <p>{NOTA_DESCARTES}</p>
    </>
  )
}
