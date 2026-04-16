'use client'
import { CmsLogin } from '@tn-figueiredo/cms/login'
import { signInWithPassword, signInWithGoogle } from './actions'

export default function Page() {
  return (
    <CmsLogin
      actions={{ signInWithPassword, signInWithGoogle }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
    />
  )
}
