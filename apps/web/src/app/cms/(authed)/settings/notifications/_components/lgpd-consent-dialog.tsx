'use client'

import { useRef } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useModalFocusTrap } from '@/app/cms/(authed)/_shared/editor/use-modal-focus-trap'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LgpdConsentDialogProps {
  channel: 'email' | 'push'
  onAccept: () => void
  onCancel: () => void
}

/* ------------------------------------------------------------------ */
/*  Channel-specific LGPD copy                                         */
/* ------------------------------------------------------------------ */

const CHANNEL_COPY: Record<
  'email' | 'push',
  { title: string; body: string }
> = {
  email: {
    title: 'Ativar notificacoes por e-mail',
    body: 'Ao ativar, seus dados de notificacao serao processados pela Resend Inc (EUA) para envio de alertas operacionais. Dados coletados: endereco de e-mail e preferencias de notificacao. Retencao: enquanto o canal estiver ativo. Voce pode revogar este consentimento a qualquer momento desativando o canal.',
  },
  push: {
    title: 'Ativar notificacoes push',
    body: 'Ao ativar, dados de assinatura push (endpoint, chaves criptograficas) serao armazenados para envio de alertas em tempo real. Nenhum dado pessoal adicional e coletado. Retencao: enquanto o canal estiver ativo. Voce pode revogar este consentimento a qualquer momento desativando o canal ou removendo a permissao no navegador.',
  },
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LgpdConsentDialog({
  channel,
  onAccept,
  onCancel,
}: LgpdConsentDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(dialogRef, true, onCancel)

  const copy = CHANNEL_COPY[channel]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lgpd-consent-title"
        aria-describedby="lgpd-consent-body"
        className="w-full max-w-[480px] rounded-xl border border-cms-border bg-cms-surface p-6 shadow-2xl"
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-cms-accent-subtle text-cms-accent">
            <ShieldCheck size={18} />
          </div>
          <h3
            id="lgpd-consent-title"
            className="text-base font-semibold text-cms-text"
          >
            {copy.title}
          </h3>
        </div>

        {/* LGPD explanation */}
        <p
          id="lgpd-consent-body"
          className="mt-4 text-sm leading-relaxed text-cms-text-muted"
        >
          {copy.body}
        </p>

        {/* Legal basis */}
        <p className="mt-3 text-xs text-cms-text-dim">
          Base legal: consentimento (LGPD Art. 7, I).
        </p>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-cms-border px-4 py-2 text-sm font-medium text-cms-text-muted transition-colors hover:bg-cms-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cms-accent-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cms-accent"
          >
            Concordo e ativar
          </button>
        </div>
      </div>
    </div>
  )
}
