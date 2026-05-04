// Sprint 5a Track D — D11: /account/settings/privacy page.
// Server component that fetches the signed-in user + any existing
// consents/requests via Supabase RLS (self-access policy from Track A
// migration 014). Falls back gracefully when the DB-side tables don't
// exist yet (pre-Phase 2 integration).
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import { PrivacySettings } from '@/components/lgpd/privacy-settings'
import type { ConsentRecord } from '@/components/lgpd/consent-revocation-panel'
import type { LgpdRequestView } from '@/components/lgpd/lgpd-request-status'

export const metadata = {
  title: 'Privacidade',
  robots: { index: false, follow: false },
}

interface SupabaseConsentRow {
  id: string
  category:
    | 'cookie_functional'
    | 'cookie_analytics'
    | 'cookie_marketing'
    | 'newsletter'
    | 'privacy_policy'
    | 'terms_of_service'
  granted: boolean
  granted_at: string
  withdrawn_at: string | null
  consent_text_id: string | null
  consent_texts: { version: number; locale: string } | { version: number; locale: string }[] | null
}

interface SupabaseLgpdRequestRow {
  id: string
  type: 'account_deletion' | 'data_export' | 'consent_revocation'
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'expired' | 'failed'
  phase: 1 | 2 | 3 | null
  scheduled_purge_at: string | null
  completed_at: string | null
}

export default async function PrivacySettingsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
  const user = await requireUser(supabase)

  // Best-effort reads — Track A migrations may not be deployed yet in the
  // environment running this layout. A missing-table error degrades to
  // empty arrays so the page still renders.
  let consents: ConsentRecord[] = []
  let requests: LgpdRequestView[] = []

  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: SupabaseConsentRow[] | null }>
        }
      }
    })
      .from('consents')
      .select(
        'id,category,granted,granted_at,withdrawn_at,consent_text_id,consent_texts(version,locale)',
      )
      .order('granted_at', { ascending: false })
    if (data) {
      consents = data.map((row) => {
        // supabase-js foreign-table notation returns either a single object
        // (one-to-one) or an array depending on FK cardinality; normalise.
        const ct = Array.isArray(row.consent_texts)
          ? row.consent_texts[0] ?? null
          : row.consent_texts
        return {
          id: row.id,
          category: row.category,
          granted: row.granted,
          grantedAt: row.granted_at,
          withdrawnAt: row.withdrawn_at,
          version: ct?.version ?? 1,
        }
      })
    }
  } catch {
    /* table doesn't exist yet */
  }

  try {
    const { data } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: SupabaseLgpdRequestRow[] | null }>
        }
      }
    })
      .from('lgpd_requests')
      .select('id,type,status,phase,scheduled_purge_at,completed_at')
      .order('requested_at', { ascending: false })
    if (data) {
      requests = data.map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        phase: row.phase ?? undefined,
        scheduledPurgeAt: row.scheduled_purge_at,
        completedAt: row.completed_at,
      }))
    }
  } catch {
    /* table doesn't exist yet */
  }

  return <PrivacySettings userEmail={user.email} consents={consents} requests={requests} />
}
