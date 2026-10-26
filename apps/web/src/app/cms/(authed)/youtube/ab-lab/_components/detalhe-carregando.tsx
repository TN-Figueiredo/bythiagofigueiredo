'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { lerTesteAbrindo } from './abrindo-teste'
import { ICONE_BUSY } from './etd-icone-busy'
import './caminho-nativo.css'
import './placar-esqueleto.css'
import './ab-end-test-dialog.css'

export const DEMORA_DO_DETALHE_MS = 8000

/** Carregamento da tela do teste (texto 16): cabeçalho conhecido quando a lista ou o assistente o deixaram, esqueleto frio senão; uma só mensagem. */
export function DetalheCarregando() {
  const params = useParams<{ testId?: string }>()
  const testId = typeof params?.testId === 'string' ? params.testId : null
  const [cab, setCab] = useState<{ titulo: string; miniaturaUrl: string | null } | null>(null)
  const [demora, setDemora] = useState(false)
  useEffect(() => {
    setCab(testId ? lerTesteAbrindo(testId) : null)
  }, [testId])
  useEffect(() => {
    const t = setTimeout(() => setDemora(true), DEMORA_DO_DETALHE_MS)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="cn-raiz pm4-sk etd-tok" data-testid="detalhe-carregando" aria-busy="true">
      <div className="skhd">
        {cab ? (
          <>
            {cab.miniaturaUrl ? <img className="th" src={cab.miniaturaUrl} alt="" /> : null}
            <div className="tt">
              <div className="cr">Teste A/B</div>
              <h2>{cab.titulo}</h2>
            </div>
          </>
        ) : (
          <>
            <div className="sk th" aria-hidden="true" />
            <div className="tt" aria-hidden="true">
              <div className="sk" style={{ height: 14, width: '40%', marginBottom: 10 }} />
              <div className="sk" style={{ height: 22, width: '85%' }} />
            </div>
          </>
        )}
      </div>
      {demora ? (
        <div className="etd-msg warn" role="status">
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Está demorando mais que o normal</strong>
            <button type="button" className="acao" onClick={() => window.location.reload()}>Tentar de novo</button>
          </div>
        </div>
      ) : (
        <div className="etd-msg busy" role="status">
          {ICONE_BUSY}
          <div><strong>Carregando o placar do teste</strong>Isso costuma levar poucos segundos.</div>
        </div>
      )}
    </div>
  )
}
