'use client'
import { CmsResetPassword } from '@tn-figueiredo/cms/login'
import { resetPassword } from './actions'
import { AUTH_THEME } from '@/lib/auth/auth-theme'
import { ResetExpired } from '../../_auth/reset-expired'
import { RESET_STRINGS } from '../../_auth/strings'

export function ResetForm({ canReset }: { canReset: boolean }) {
  if (!canReset) return <ResetExpired forgotHref="/cms/forgot" loginHref="/cms/login" />
  return (
    <CmsResetPassword
      actions={{ resetPassword }}
      redirectTo="/cms?senha=alterada"
      canReset={canReset}
      theme={AUTH_THEME}
      strings={RESET_STRINGS}
    />
  )
}
