'use client'

import type { OpcoesAviso } from './acoes-de-saida'
import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { focarFaixa, textoDoErro, sessaoExpirou, hrefDoLogin } from './ab-end-test-dialog'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { Pause, X } from 'lucide-react'

interface AbPauseDialogProps {
  /** Server action `pauseAbTest` já com o id do teste, montada no server component chamador. */
  pausar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  /** `restore_seq` que a tela leu ao abrir; a action recusa se o teste mudou desde então (D3). */
  seqVisto: number
  onClose: () => void
  /** Aviso de página para o que acontece depois de o diálogo fechar. */
  onAviso?: (texto: string, opcoes?: OpcoesAviso) => void
}

export function AbPauseDialog({ pausar, seqVisto, onClose, onAviso }: AbPauseDialogProps) {
  const router = useRouter()
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fase, setFase] = useState<'escolha' | 'sessao_expirada' | 'mudou'>('escolha')
  const mudou = fase === 'mudou'
  const sessaoExpirada = fase === 'sessao_expirada'
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  function handleConfirm() {
    startTransition(async () => {
      let result: ResultadoAcaoSaida
      try {
        result = await pausar(seqVisto)
      } catch {
        const expirada = await sessaoExpirou()
        if (!montado.current) { // P4b T9: o diálogo já fechou; a página diz o que aconteceu
          onAviso?.(expirada
            ? 'Sua sessão expirou. Não sabemos se o teste foi pausado: entre de novo e confira.'
            : 'Sem resposta ao pausar. Não sabemos se o teste foi pausado. Recarregue a página para ver o resultado.', { fixo: true })
          router.refresh()
          return
        }
        if (expirada) { setFase('sessao_expirada'); return }
        setError('Sem resposta. Recarregue a página para ver o resultado.')
        return
      }
      if (result.ok && result.resultado === 'feito') {
        const recusado = Object.values(result.campos).some(c => c !== undefined && c.estado !== 'ok')
        router.refresh()
        onClose()
        if (recusado) focarFaixa()
        return
      }
      if (!montado.current && !result.ok && result.resultado === 'mudou') {
        onAviso?.('O teste mudou em outra aba antes de pausar. Nada foi alterado.')
        router.refresh()
        return
      }
      if (!result.ok && result.resultado === 'mudou') { setFase('mudou'); setError(null); return }
      if (!result.ok && result.resultado === 'ja_encerrado') { router.refresh(); onClose(); return }
      if (!montado.current && !result.ok && result.resultado === 'sem_permissao' && result.error === 'unauthenticated') {
        onAviso?.('Sua sessão expirou e o teste não foi pausado. Entre de novo e pause outra vez.', { fixo: true })
        router.refresh()
        return
      }
      if (!result.ok && result.resultado === 'sem_permissao' && result.error === 'unauthenticated') { setFase('sessao_expirada'); return }
      // Recusa (em andamento, sem permissão, erro) fica escrita; o diálogo não fecha como se tivesse dado certo.
      setError(result.ok ? 'Resposta inesperada. Recarregue a página para ver o resultado.' : textoDoErro(result, 'pausar'))
    })
  }

  return (
    <YtPortal>
      {/* Scrim */}
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div
          className="absolute inset-0"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Pausar teste"
          className="relative w-full max-w-[420px] rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden"
          style={{ boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-[11px] py-[18px] px-[20px] border-b border-cms-border">
            <span
              className="flex items-center justify-center rounded-[9px]"
              style={{ width: 32, height: 32, background: 'rgba(224, 162, 60, 0.12)' }}
            >
              <Pause size={16} className="text-cms-amber" aria-hidden="true" />
            </span>
            <h2 className="text-[15px] font-bold text-cms-text flex-1 m-0">Pausar teste</h2>
            <button
              type="button"
              onClick={onClose}
              className="ic-btn"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="py-[18px] px-[20px] space-y-[10px] text-[13px] text-cms-text-dim leading-[1.55]">
            {sessaoExpirada ? (
              <p role="alert" className="m-0 text-cms-red">Sua sessão expirou. Entre de novo para pausar o teste.</p>
            ) : mudou ? (
              <p role="alert" className="m-0 text-cms-red">O teste mudou em outra aba. Reabra para decidir.</p>
            ) : (
              <>
              <p className="m-0">Pausar vai restaurar a thumbnail original imediatamente.</p>
              <p className="m-0">O ciclo atual será fechado. Todos os dados coletados ficam preservados.</p>
              <p className="m-0">Você pode retomar a qualquer momento — o teste continua de onde parou.</p>
              </>
            )}
            {error && !mudou && !sessaoExpirada && <p role="alert" className="m-0 text-cms-red">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[10px] py-[14px] px-[20px] border-t border-cms-border">
            {sessaoExpirada ? (
              <>
                <a href={hrefDoLogin()} className="btn sm" style={{
                background: 'var(--cms-amber, #d97706)',
                color: '#1A120A',
                borderColor: 'transparent',
              }}>Entrar de novo</a>
                <button type="button" onClick={onClose} className="btn sm">Fechar</button>
              </>
            ) : mudou ? (
              <>
                <button type="button" onClick={() => window.location.reload()} className="btn sm" style={{
                background: 'var(--cms-amber, #d97706)',
                color: '#1A120A',
                borderColor: 'transparent',
              }}>Recarregar</button>
                <button type="button" onClick={onClose} className="btn sm">Fechar</button>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} disabled={isPending} className="btn sm">Cancelar</button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="btn sm"
                  style={{
                background: 'var(--cms-amber, #d97706)',
                color: '#1A120A',
                borderColor: 'transparent',
              }}
                >
                  {isPending ? 'Pausando...' : 'Pausar teste'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
