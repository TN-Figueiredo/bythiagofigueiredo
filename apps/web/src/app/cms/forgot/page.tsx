'use client'
import { CmsForgotPassword } from '@tn-figueiredo/cms/login'
import { forgotPassword } from './actions'

export default function Page() {
  return (
    <CmsForgotPassword
      actions={{ forgotPassword }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
      loginPath="/cms/login"
    />
  )
}
