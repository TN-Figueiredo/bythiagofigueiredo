'use client'
import { AdminForgotPassword } from '@tn-figueiredo/admin/login'
import { AUTH_THEME } from '@/lib/auth/auth-theme'
import { FORGOT_STRINGS } from '../../_auth/strings'
import { forgotPassword } from './actions'

export default function Page() {
  return (
    <AdminForgotPassword
      actions={{ forgotPassword }}
      theme={AUTH_THEME}
      strings={FORGOT_STRINGS}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
      loginHref="/admin/login"
    />
  )
}
