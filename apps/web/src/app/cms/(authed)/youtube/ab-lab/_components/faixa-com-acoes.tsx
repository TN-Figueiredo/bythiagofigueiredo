'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CampoNome } from '@/lib/youtube/ab-restore'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import type { Faixa } from './faixa-restauracao-texto'
import { FaixaRestauracao } from './faixa-restauracao'
import { BTN_BASE, definirAviso } from './acoes-de-saida'
import CmsLink from '@/app/cms/(authed)/_shared/cms-link'
import { hrefDoPainel } from '../painel-param'

export interface FaixaComAcoesProps {
  testId: string
  faixa: Faixa
  /** A faixa enquanto "Tentar agora" corre (P4b-E1). */
  faixaTentando: Faixa | null
  seqVisto: number
  /** `retryRestore` ligada ao id na página (nunca importada aqui). */
  tentar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  /** `dismissRestore` ligada ao id na página. */
  dispensar: (campos: CampoNome[], seqVisto: number) => Promise<ResultadoAcaoSaida>
}

// Faixa: 36 px (py-[7px] leading-5), 13 px, px-4 (mockup r3). Pausar/Encerrar (BTN_SAIDA) não mudam de tamanho.
const BTN_FAIXA = BTN_BASE
  .replace('py-[6px] px-[11px] text-[12.5px]', 'min-h-[36px] py-[7px] px-4 text-[13px] leading-5')
  .replace('gap-[7px]', 'gap-2') + ' [@media(pointer:coarse)]:min-h-[44px]'
// Primário: fundo --pb-accent (#FF8240 no escuro, #B94210 no claro, como o mockup); texto escuro (7,5:1 sobre o laranja); no tema claro #FFF8F0 (5,18:1 sobre #B94210). Borda = fundo.
const BTN_PRI = `${BTN_FAIXA.replace('border-[color:var(--btn-ctl)]', 'border-pb-accent')} bg-pb-accent text-[#1A120A] hover:text-[#1A120A] [[data-theme=light]_&]:text-[#FFF8F0] [[data-theme=light]_&]:hover:text-[#FFF8F0] disabled:cursor-progress disabled:opacity-100`
// Secundário sobre a faixa colorida: text-cms-text. Desabilitado: superfície neutra legível (sem 50% de opacidade).
const BTN = `${BTN_FAIXA} text-cms-text disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-cms-surface-hover disabled:text-cms-text-muted disabled:border-cms-border [[data-theme=dark]_&]:disabled:border-[rgba(146,136,113,.45)]`

/** Ilha cliente da faixa: os botões "Tentar agora" e "Já corrigi no YouTube" (P4b). Sem permissão, nenhum botão. */
export function FaixaComAcoes({ testId, faixa, faixaTentando, seqVisto, tentar, dispensar }: FaixaComAcoesProps) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [tentando, setTentando] = useState(false)
  const trava = useRef(false)

  async function rodar(chamada: () => Promise<ResultadoAcaoSaida>, mostrarTentando: boolean) {
    if (trava.current) return
    trava.current = true
    setOcupado(true)
    setTentando(mostrarTentando)
    try {
      const r = await chamada()
      if (!r.ok) definirAviso(testId, r.error)
    } catch {
      definirAviso(testId, 'Sem resposta. Não sabemos se a ação foi feita. Recarregue a página para ver o estado.', { fixo: true })
    } finally {
      trava.current = false
      setOcupado(false)
      setTentando(false)
      router.refresh()
    }
  }

  const acoes = faixa.tom === 'ok' ? null : faixa.acoes
  const mostrada = tentando && faixaTentando ? faixaTentando : faixa
  return (
    <FaixaRestauracao faixa={mostrada}>
      {acoes && (acoes.motivoSemBotao || acoes.tentar || acoes.abrirPainel || acoes.dispensar.length > 0) ? <>
      {acoes.motivoSemBotao ? <p className="fr-fine">{acoes.motivoSemBotao}</p> : null}
      {acoes && (acoes.tentar || acoes.abrirPainel || acoes.dispensar.length > 0) ? (
        <div className="fr-botoes">
          {acoes.abrirPainel ? <CmsLink href={hrefDoPainel(testId)} className={BTN_PRI}>Abrir o painel</CmsLink> : null}
          {acoes.tentar ? (
            <button type="button" className={BTN_PRI} disabled={ocupado} aria-busy={ocupado} onClick={() => rodar(() => tentar(seqVisto), true)}>
              {tentando ? 'Tentando…' : 'Tentar agora'}
            </button>
          ) : null}
          {acoes.dispensar.length > 0 ? (
            <button type="button" className={BTN} disabled={ocupado} aria-busy={ocupado} onClick={() => rodar(() => dispensar(acoes.dispensar, seqVisto), false)}>
              Já corrigi no YouTube: dispensar aviso
            </button>
          ) : null}
        </div>
      ) : null}
      </> : null}
    </FaixaRestauracao>
  )
}
