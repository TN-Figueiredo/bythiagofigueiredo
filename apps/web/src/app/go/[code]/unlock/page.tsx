import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

export const runtime = 'nodejs'

interface Props {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function UnlockPage({ params, searchParams }: Props) {
  const { code } = await params
  const { error } = await searchParams

  async function verify(formData: FormData) {
    'use server'
    const password = formData.get('password') as string
    if (!password) redirect(`/go/${code}/unlock?error=required`)

    const h = await headers()
    const siteId = h.get('x-site-id') ?? ''

    const supabase = getSupabaseServiceClient()
    let query = supabase
      .from('tracked_links')
      .select('id, password_hash, destination_url, redirect_type')
      .eq('code', code)

    if (siteId) {
      query = query.eq('site_id', siteId)
    }

    const { data: link } = await query.maybeSingle()

    if (!link?.password_hash) redirect(`/go/${code}`)

    const hash = createHash('sha256').update(password).digest('hex')
    if (hash !== link.password_hash) {
      redirect(`/go/${code}/unlock?error=wrong`)
    }

    redirect(link.destination_url)
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>This link is protected</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Enter the password to continue.</p>
      {error === 'wrong' && (
        <p style={{ color: '#dc2626', marginBottom: 16 }}>Incorrect password. Try again.</p>
      )}
      {error === 'required' && (
        <p style={{ color: '#dc2626', marginBottom: 16 }}>Password is required.</p>
      )}
      <form action={verify}>
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Password"
          data-testid="unlock-password"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: 6,
            fontSize: 16,
            marginBottom: 12,
          }}
        />
        <button
          type="submit"
          data-testid="unlock-submit"
          style={{
            width: '100%',
            padding: '10px',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Unlock
        </button>
      </form>
    </div>
  )
}
