'use client'
import { AdminResetPassword } from '@tn-figueiredo/admin/login'
import { resetPassword } from './actions'
import { AUTH_THEME } from '@/lib/auth/auth-theme'
import { ResetExpired } from '../../_auth/reset-expired'

export function ResetForm({ canReset }: { canReset: boolean }) {
  if (!canReset) return <ResetExpired forgotHref="/admin/forgot" loginHref="/admin/login" />
  return (
    <AdminResetPassword
      actions={{ resetPassword }}
      redirectAfterReset="/admin?senha=alterada"
      theme={AUTH_THEME}
    />
  )
}
