import crypto from 'node:crypto'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { Paper, Tape } from '@/components/pinboard'
import { eraseMyWaitlistData } from './actions'

// Per-email rights page (LGPD Art. 18 access + erasure), reached via the tokenized link
// emailed by /api/waitlists/rights. No oracle: an invalid/expired/unknown token renders
// the same neutral "link inválido" state as any other miss.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ status?: string }>
}

interface SignupRow {
  email: string
  status: string
  source_surface: string | null
  consent_text_version: string | null
  created_at: string
}

export default async function WaitlistManagePage({ params, searchParams }: Props) {
  const { token } = await params
  const { status } = await searchParams
  const { defaultLocale } = await getSiteContext()
  const isPt = defaultLocale === 'pt-BR'

  const t = isPt
    ? { title: 'Seus dados na lista de espera', invalid: 'Link inválido ou expirado.', none: 'Nenhum dado encontrado para este link.', deleted: 'Seus dados foram apagados. Não guardamos mais suas informações pessoais.', deleteBtn: 'Apagar meus dados', deleteWarn: 'Isso remove permanentemente seu e-mail e dados associados. Não pode ser desfeito.', download: 'Baixar meus dados (JSON)', colStatus: 'Situação', colSource: 'Origem', colDate: 'Inscrito em' }
    : { title: 'Your waitlist data', invalid: 'Invalid or expired link.', none: 'No data found for this link.', deleted: 'Your data has been erased. We no longer hold your personal information.', deleteBtn: 'Delete my data', deleteWarn: 'This permanently removes your email and associated data. It cannot be undone.', download: 'Download my data (JSON)', colStatus: 'Status', colSource: 'Source', colDate: 'Signed up' }

  if (status === 'done') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        <Paper><Tape /><h1 style={{ fontSize: 22, marginBottom: 12 }}>{t.title}</h1><p>{t.deleted}</p></Paper>
      </main>
    )
  }

  let rows: SignupRow[] | null = null
  if (token && token.length >= 16 && token.length <= 256) {
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const supabase = getSupabaseServiceClient()
    const { data: tok } = await supabase
      .from('waitlist_dsar_tokens')
      .select('site_id, email')
      .eq('token_hash', hash)
      .maybeSingle()
    if (tok) {
      const { data } = await supabase
        .from('waitlist_signups')
        .select('email, status, source_surface, consent_text_version, created_at')
        .eq('site_id', tok.site_id)
        .eq('email', tok.email)
        .is('anonymized_at', null)
      rows = (data as SignupRow[] | null) ?? []
    }
  }

  if (rows === null) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        <Paper><Tape /><h1 style={{ fontSize: 22, marginBottom: 12 }}>{t.title}</h1><p>{t.invalid}</p></Paper>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <Paper>
        <Tape />
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>{t.title}</h1>
        {rows.length === 0 ? (
          <p>{t.none}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 24 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '6px 8px' }}>{t.colStatus}</th>
                <th style={{ padding: '6px 8px' }}>{t.colSource}</th>
                <th style={{ padding: '6px 8px' }}>{t.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px' }}>{r.status}</td>
                  <td style={{ padding: '6px 8px' }}>{r.source_surface ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{new Date(r.created_at).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginBottom: 16 }}>
          <a href={`/api/waitlists/dsar/${encodeURIComponent(token)}`} style={{ textDecoration: 'underline' }}>{t.download}</a>
        </p>
        <form action={eraseMyWaitlistData}>
          <input type="hidden" name="token" value={token} />
          <p style={{ color: '#a33', fontSize: 13, marginBottom: 8 }}>{t.deleteWarn}</p>
          <button type="submit" style={{ background: '#a33', color: '#fff', border: 0, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' }}>
            {t.deleteBtn}
          </button>
        </form>
      </Paper>
    </main>
  )
}
