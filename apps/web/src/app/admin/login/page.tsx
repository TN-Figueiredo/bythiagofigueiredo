'use client'
import { AdminLogin } from '@tn-figueiredo/admin/login'
import { signInWithPassword, signInWithGoogle } from './actions'

export default function Page() {
  return (
    <AdminLogin
      actions={{ signInWithPassword, signInWithGoogle }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
    />
  )
}
