'use client'
import { AdminResetPassword } from '@tn-figueiredo/admin/login'
import { resetPassword } from './actions'

export default function Page() {
  return (
    <AdminResetPassword
      actions={{ resetPassword }}
      redirectAfterReset="/admin"
    />
  )
}
