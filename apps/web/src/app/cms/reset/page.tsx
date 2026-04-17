'use client'
import { CmsResetPassword } from '@tn-figueiredo/cms/login'
import { resetPassword } from './actions'

export default function Page() {
  return (
    <CmsResetPassword
      actions={{ resetPassword }}
      redirectTo="/cms"
    />
  )
}
