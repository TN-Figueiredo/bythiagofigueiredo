import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { acceptInviteForCurrentUser, acceptInviteWithPassword } from './actions'
import { SubmitButton } from './_components/SubmitButton'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}

interface InvitationRow {
  email: string
  role: string
  org_name: string
  expires_at: string
  expired: boolean
}

const errorMessages: Record<string, string> = {
  rpc_failed:
    'Sua conta foi criada mas a aceitação do convite falhou. Faça login e contate o admin.',
  expired: 'Este convite expirou.',
  email_mismatch: 'O email do convite não corresponde ao seu login.',
  already_accepted: 'Este convite já foi aceito.',
  not_found: 'Convite inválido.',
  unauthenticated: 'Você precisa estar autenticado para aceitar este convite.',
  email_already_registered:
    'Este email já está cadastrado. Faça login para aceitar o convite.',
  signup_failed: 'Falha ao criar conta. Tente novamente.',
}

export default async function InviteAcceptPage({ params, searchParams }: Props) {
  const { token } = await params
  const { error: errorCode } = await searchParams
  const service = getSupabaseServiceClient()

  // Fetch invitation details — anon-safe RPC, returns SETOF (array)
  const { data: rows } = await service.rpc('get_invitation_by_token', { p_token: token })

  const inv: InvitationRow | null =
    rows && Array.isArray(rows) && rows.length > 0 ? (rows[0] as InvitationRow) : null

  if (!inv) {
    return (
      <main>
        <h1>Convite inválido</h1>
        <p>Este link de convite não existe ou já foi removido.</p>
      </main>
    )
  }

  if (inv.expired) {
    return (
      <main>
        <h1>Convite expirado</h1>
        <p>Solicite um novo convite ao administrador da organização.</p>
      </main>
    )
  }

  const errorMessage =
    errorCode != null
      ? (errorMessages[errorCode] ?? 'Ocorreu um erro. Tente novamente.')
      : null

  // Check if visitor already has a session
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await userClient.auth.getUser()

  // ── Authenticated path ──────────────────────────────────────────────────────
  if (user) {
    if (user.email?.toLowerCase() !== inv.email.toLowerCase()) {
      return (
        <main>
          <h1>Email diferente</h1>
          <p>
            Este convite é para <strong>{inv.email}</strong> mas você está logado como{' '}
            <strong>{user.email}</strong>.
          </p>
          <p>Saia da sua conta e tente novamente, ou solicite um convite para o email correto.</p>
        </main>
      )
    }

    // User is logged in with the correct email — show one-click accept button
    return (
      <main>
        <h1>Aceitar convite</h1>
        <p>
          Você foi convidado para <strong>{inv.org_name}</strong> como{' '}
          <strong>{inv.role}</strong>.
        </p>
        {errorMessage && (
          <div role="status" aria-live="polite">
            {errorMessage}
          </div>
        )}
        <form
          action={async () => {
            'use server'
            await acceptInviteForCurrentUser(token)
          }}
        >
          <SubmitButton>Aceitar convite</SubmitButton>
        </form>
      </main>
    )
  }

  // ── Anonymous path ──────────────────────────────────────────────────────────

  // C3: use point-lookup RPC instead of unbounded listUsers() scan
  const { data: emailAlreadyExists } = await service.rpc('user_exists_by_email', {
    p_email: inv.email,
  })

  if (emailAlreadyExists) {
    // Existing user — redirect to sign-in so they can authenticate first
    redirect(
      `/admin/login?redirect=${encodeURIComponent(`/signup/invite/${token}`)}&hint=${encodeURIComponent(inv.email)}`,
    )
  }

  // New user — show password creation form
  return (
    <main>
      <h1>Criar conta</h1>
      <p>
        Convite para <strong>{inv.email}</strong> em <strong>{inv.org_name}</strong> como{' '}
        <strong>{inv.role}</strong>.
      </p>
      {errorMessage && (
        <div role="status" aria-live="polite">
          {errorMessage}
        </div>
      )}
      <form
        action={async (formData: FormData) => {
          'use server'
          const password = formData.get('password') as string
          const confirm = formData.get('confirm') as string
          if (!password || password !== confirm || password.length < 8) return
          await acceptInviteWithPassword(token, password)
        }}
      >
        <input type="password" name="password" required placeholder="Senha (mínimo 8 caracteres)" />
        <input type="password" name="confirm" required placeholder="Confirmar senha" />
        <SubmitButton>Criar conta e aceitar convite</SubmitButton>
      </form>
    </main>
  )
}
