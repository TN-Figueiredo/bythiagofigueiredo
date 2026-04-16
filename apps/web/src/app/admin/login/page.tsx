'use client'
import { Suspense } from 'react'
import { AdminLogin } from '@tn-figueiredo/admin/login'
import { signInWithPassword, signInWithGoogle } from './actions'

export default function Page() {
  // AdminLogin internally calls useSearchParams (reads `?redirect=`). In Next 15
  // App Router, components that read searchParams during prerender must be
  // wrapped in a Suspense boundary — otherwise the build errors with
  // "missing-suspense-with-csr-bailout". Before the T10a split this page
  // inherited an implicit Suspense from `/admin/layout.tsx` (async server
  // layout); moving the authed layout under `(authed)/` removed that, so we
  // wrap explicitly here.
  return (
    <Suspense fallback={null}>
      <AdminLogin
        actions={{ signInWithPassword, signInWithGoogle }}
        turnstile={
          process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
            : undefined
        }
      />
    </Suspense>
  )
}
