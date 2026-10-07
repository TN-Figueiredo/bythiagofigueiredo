export type NoticeTone = 'success' | 'warning' | 'error'

export interface NoticeView {
  message: string
  tone: NoticeTone
}

/**
 * Avisos de /admin/users (?notice=...). Regra: só é "sucesso" o que de fato
 * aconteceu. Convite gravado com e-mail que não saiu é AVISO, e aponta o plano
 * B (copiar o link) — nunca "criado e enviado".
 */
const NOTICES: Record<string, NoticeView> = {
  invite_created: { tone: 'success', message: 'Convite criado e enviado.' },
  invite_created_email_failed: {
    tone: 'warning',
    message:
      'Convite criado, mas o e-mail não saiu. Use "Copiar link do convite" na lista de pendentes e envie o link por outro canal — ou tente "Reenviar" em 30 segundos.',
  },
  invite_failed: { tone: 'error', message: 'Falha ao criar convite. Tente novamente.' },
  invite_rate_limited: { tone: 'error', message: 'Limite de 20 convites/hora excedido.' },
  invite_duplicate: { tone: 'error', message: 'Já existe um convite pendente para esse email.' },
  invitation_revoked: { tone: 'success', message: 'Convite revogado.' },
  resend_sent: { tone: 'success', message: 'Convite reenviado.' },
  resend_too_soon: { tone: 'warning', message: 'Aguarde 30 segundos antes de reenviar.' },
  resend_email_failed: {
    tone: 'warning',
    message:
      'O e-mail do convite não saiu. O convite continua válido: use "Copiar link do convite" e envie o link por outro canal.',
  },
  resend_expired: {
    tone: 'error',
    message: 'Este convite expirou ou já foi usado. Revogue e crie outro.',
  },
  resend_failed: { tone: 'error', message: 'Não foi possível reenviar o convite. Tente novamente.' },
}

export function noticeFor(notice: string | undefined): NoticeView | null {
  if (notice == null) return null
  return NOTICES[notice] ?? null
}
