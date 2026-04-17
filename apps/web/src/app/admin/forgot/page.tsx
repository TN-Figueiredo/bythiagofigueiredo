'use client'
import { AdminForgotPassword } from '@tn-figueiredo/admin/login'
import { forgotPassword } from './actions'

export default function Page() {
  return (
    <AdminForgotPassword
      actions={{ forgotPassword }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
      loginHref="/admin/login"
    />
  )
}
