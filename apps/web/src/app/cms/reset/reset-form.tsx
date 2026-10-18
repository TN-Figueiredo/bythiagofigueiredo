'use client'
import { CmsResetPassword } from '@tn-figueiredo/cms/login'
import { resetPassword } from './actions'

export function ResetForm({ canReset }: { canReset: boolean }) {
  return (
    <CmsResetPassword
      actions={{ resetPassword }}
      redirectTo="/cms"
      canReset={canReset}
    />
  )
}
