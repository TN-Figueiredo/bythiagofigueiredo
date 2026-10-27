'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Play, Square } from 'lucide-react'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { useCanAdminSite } from '@/lib/cms/site-admin-context'
import { AbPauseDialog } from './ab-pause-dialog'
import { AbEndTestDialog, cancelarFocoDaFaixa } from './ab-end-test-dialog'
import { dadosDoDialogoEncerrar } from './encerrar-props'
import type { FreioDoEncerrar } from './cabecalho-do-teste'
import './ab-end-test-dialog.css'

/** Base dos botões de saída, sem cor de texto: quem monta escolhe a cor (duas utilidades de cor na mesma classe: a ordem do CSS decide, e a dim vencia o on-accent). */
export const BTN_BASE = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-[color:var(--btn-ctl)] whitespace-nowrap transition-colors duration-150 tracking-[-0.01em] focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'
export const BTN_SAIDA = `${BTN_BASE} dhl-bt min-h-[44px] px-[16px] text-cms-text`

/**
 * Aviso de página (role="status") depois de uma saída (encerrar/pausar) com recusa ou resultado "mudou": 6 s (ou fixo até o dono fechar, para avisos que pedem ação), com fechar.
 * O estado vive num store de módulo, fora dos detalhes: o router.refresh() pode trocar ActiveDetail por WinnerDetail e o
 * aviso sobrevive. Chaveado pelo id do teste para não vazar para outro. <AvisoDePagina /> é renderizado em page.tsx.
 */
export interface OpcoesAviso { fixo?: boolean }
interface EstadoAviso { testId: string; texto: string; fixo: boolean }
let estadoAviso: EstadoAviso | null = null
const ouvintes = new Set<() => void>()
function emitir() { ouvintes.forEach((l) => l()) }
function assinar(l: () => void) { ouvintes.add(l); return () => { ouvintes.delete(l) } }

export function definirAviso(testId: string, texto: string | null, opcoes?: OpcoesAviso) {
  estadoAviso = texto ? { testId, texto, fixo: opcoes?.fixo === true } : null
  emitir()
}

export function AvisoDePagina({ testId }: { testId: string }) {
  const atual = useSyncExternalStore(assinar, () => estadoAviso, () => null)
  const texto = atual && atual.testId === testId ? atual.texto : null
  const fixo = atual && atual.testId === testId ? atual.fixo : false
  useEffect(() => {
    // outro teste: descarta o aviso do anterior
    if (estadoAviso && estadoAviso.testId !== testId) definirAviso(testId, null)
  }, [testId])
  useEffect(() => {
    if (!texto || fixo) return
    const t = setTimeout(() => definirAviso(testId, null), 6000)
    return () => clearTimeout(t)
  }, [texto, fixo, testId])
  return (
    <div role="status" aria-live="polite">
      {texto ? (
        <p className="etd-aviso">
          <span>{texto}</span>
          <button type="button" onClick={() => definirAviso(testId, null)} aria-label="Fechar aviso">Fechar</button>
        </p>
      ) : null}
    </div>
  )
}

export function useAvisoDePagina(testId: string) {
  useEffect(() => cancelarFocoDaFaixa, [])
  const setAviso = useCallback((texto: string, opcoes?: OpcoesAviso) => definirAviso(testId, texto, opcoes), [testId])
  return { setAviso }
}

/** Retomar do cabeçalho: mesma lógica do botão que vivia na faixa do pausado (alert na recusa, refresh no sucesso). */
export function useRetomarDoCabecalho(
  retomar: (seqVisto: number) => Promise<ResultadoAcaoSaida>,
  seqVisto: number,
  bloqueado: boolean,
): { executar: () => void; ocupado: boolean; bloqueado: boolean } {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const executar = useCallback(async () => {
    setOcupado(true)
    const res = await retomar(seqVisto)
    if (!res.ok) { alert(`Falha ao retomar: ${res.error}`); setOcupado(false); return }
    router.refresh()
  }, [retomar, seqVisto, router])
  return { executar: () => { void executar() }, ocupado, bloqueado }
}

export interface AcoesDeSaidaProps {
  view: AbTestActiveView
  /** `endAbTest` com o id do teste, montada no server component da página (nunca importada aqui). */
  encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
  /** `pauseAbTest` com o id do teste, idem; recebe o `seqVisto`. */
  pausar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  onAviso: (texto: string, opcoes?: OpcoesAviso) => void
  /** Escrevendo no YouTube agora: Pausar/Retomar e Encerrar ficam `aria-disabled` (focáveis); o servidor segue sendo a guarda real. */
  escrevendo?: boolean
  /** Retomar no cabeçalho (teste pausado); ausente = sem o botão (ex.: pausa por deriva, que pede o reconhecimento antes). */
  retomar?: { executar: () => void; ocupado: boolean; bloqueado: boolean }
  /** Freio do Encerrar (T4 liga ao diálogo); aqui só destaca o botão quando o teste está completo. */
  freio: FreioDoEncerrar
}

/** Botões Pausar e Encerrar (Pausar some com o teste já pausado) e seus diálogos: o mesmo bloco nos dois detalhes. */
export function AcoesDeSaida({ view, encerrar, pausar, onAviso, escrevendo, retomar, freio }: AcoesDeSaidaProps) {
  const [showPause, setShowPause] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  const canAdminSite = useCanAdminSite()
  return (
    <>
      {view.status !== 'paused' ? (
        <button
          type="button"
          onClick={() => { if (!escrevendo) setShowPause(true) }}
          className={BTN_SAIDA}
          {...(escrevendo ? { 'aria-disabled': true, 'aria-describedby': 'apoio-acoes' } : {})}
        >
          <Pause size={14} aria-hidden="true" />
          Pausar
        </button>
      ) : retomar ? (
        <button
          type="button"
          onClick={() => { if (!escrevendo && !retomar.bloqueado && !retomar.ocupado) retomar.executar() }}
          className={BTN_SAIDA}
          {...(escrevendo || retomar.bloqueado ? { 'aria-disabled': true } : {})}
          {...(escrevendo ? { 'aria-describedby': 'apoio-acoes' } : {})}
        >
          <Play size={14} aria-hidden="true" />
          {retomar.ocupado ? 'Retomando…' : 'Retomar'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => { if (!escrevendo) setShowEnd(true) }}
        className={`${BTN_SAIDA}${freio.tipo === 'completo' ? ' dhl-bt--dest' : ''}`}
        {...(escrevendo ? { 'aria-disabled': true, 'aria-describedby': 'apoio-acoes' } : {})}
      >
        <Square size={14} aria-hidden="true" />
        Encerrar
      </button>
      {showPause && (
        <AbPauseDialog pausar={pausar} seqVisto={view.restoreSeq} onClose={() => setShowPause(false)} onAviso={onAviso} />
      )}
      {showEnd && (
        <AbEndTestDialog
          aberto
          onFechar={() => setShowEnd(false)}
          testeNome={view.videoTitle}
          {...dadosDoDialogoEncerrar(view)}
          podeDeixarVariante={canAdminSite}
          encerrar={encerrar}
          seqVisto={view.restoreSeq}
          onAviso={onAviso}
          regraV2={view.placar?.regra === 'v2'}
        />
      )}
    </>
  )
}
