import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { acceptInviteForCurrentUser } from './actions'
import { AcceptInviteForm } from './accept-invite-form'
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
    'Não foi possível completar o convite. Tente novamente ou contate o admin.',
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
      <main className="mx-auto max-w-md py-12 px-4">
        <h1 className="text-xl font-semibold">Convite inválido</h1>
        <p className="mt-4 text-sm text-gray-700">
          Este link de convite não existe ou já foi removido.
        </p>
      </main>
    )
  }

  if (inv.expired) {
    return (
      <main className="mx-auto max-w-md py-12 px-4">
        <h1 className="text-xl font-semibold">Convite expirado</h1>
        <p className="mt-4 text-sm text-gray-700">
          Solicite um novo convite ao administrador da organização.
        </p>
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
        <main className="mx-auto max-w-md py-12 px-4">
          <h1 className="text-xl font-semibold">Email diferente</h1>
          <p className="mt-4 text-sm text-gray-700">
            Este convite é para <strong>{inv.email}</strong> mas você está logado como{' '}
            <strong>{user.email}</strong>.
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Saia da sua conta e tente novamente, ou solicite um convite para o email correto.
          </p>
        </main>
      )
    }

    // User is logged in with the correct email — show one-click accept button
    return (
      <main className="mx-auto max-w-md py-12 px-4">
        <h1 className="text-xl font-semibold">Aceitar convite</h1>
        <p className="mt-4 text-sm text-gray-700">
          Você foi convidado para <strong>{inv.org_name}</strong> como{' '}
          <strong>{inv.role}</strong>.
        </p>
        {errorMessage && (
          <div role="status" aria-live="polite" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        <form
          action={async () => {
            'use server'
            await acceptInviteForCurrentUser(token)
          }}
          className="mt-6"
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

  // New user — show password creation form (client component wires local
  // validation + useTransition around the server action).
  return (
    <main className="mx-auto max-w-md py-12 px-4">
      <h1 className="text-xl font-semibold">Criar conta</h1>
      <p className="mt-4 text-sm text-gray-700">
        Convite para <strong>{inv.email}</strong> em <strong>{inv.org_name}</strong> como{' '}
        <strong>{inv.role}</strong>.
      </p>
      {errorMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}
      <AcceptInviteForm token={token} email={inv.email} />
    </main>
  )
}
