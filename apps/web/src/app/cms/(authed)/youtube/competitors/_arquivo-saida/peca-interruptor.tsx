'use client'

import type { ReactElement } from 'react'
import type { EstadoInterruptor } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import { DESCARTES_PARA_LIGAR, SIMULACOES_PARA_LIGAR, NAO_MEDIDO, NOTA_DESCARTES, SO_ADMIN, faltaParaLigar, tituloDoInterruptor } from '@/lib/youtube/observatorio/arquivo-mensal/interruptor'

/** "N de T" com o trilho sempre visível; cheio = verde com o ✓ (o símbolo carrega o sentido, a cor só reforça). */
function Barra({ rotulo, feitas, total }: { rotulo: string; feitas: number; total: number }): ReactElement {
  const v = Math.min(feitas, total)
  const cheio = feitas >= total
  return (
    <div className="arq-cont">
      <div className="arq-cont-tx">{cheio ? <b className="arq-v" aria-hidden="true">✓</b> : null}<span>{rotulo}</span> <span>{v} de {total}{feitas > total ? ` (você já fez ${feitas})` : ''}</span></div>
      <div className={`arq-trilho${cheio ? ' cheio' : ''}`} role="progressbar" aria-label={rotulo} aria-valuenow={v} aria-valuemin={0} aria-valuemax={total}>
        <i style={{ width: `${Math.round((100 * v) / total)}%` }} />
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
  if (descartes >= DESCARTES_PARA_LIGAR && simulacoes >= SIMULACOES_PARA_LIGAR) return <p>O automático chega na próxima etapa.</p>
  return (
    <>
      <p>{faltaParaLigar(descartes, simulacoes)}</p>
      <Barra rotulo="Saídas feitas por você" feitas={descartes} total={DESCARTES_PARA_LIGAR} />
      <Barra rotulo="Simulações vistas" feitas={simulacoes} total={SIMULACOES_PARA_LIGAR} />
      <p>{NOTA_DESCARTES}</p>
    </>
  )
}
