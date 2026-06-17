/**
 * DB-gated proof-of-consent parity (LGPD M5/M12): the consent sentence the visitor SEES
 * (FORM_STRINGS[locale].consentLabel) must be byte-identical to the consent_texts.text_md
 * the signup route snapshots into the audit log — otherwise a copy edit to one could
 * silently diverge the evidence from what was actually shown. Guards both locales at the
 * live WAITLIST_CONSENT_VERSION.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-consent-parity.test.ts
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'
import { WAITLIST_CONSENT_VERSION as V } from '@/app/api/waitlists/consent'
import { FORM_STRINGS } from '@/components/waitlists/form-strings'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist consent parity (displayed === ledgered snapshot)', () => {
  it.each(['en', 'pt-BR'] as const)(
    'FORM_STRINGS[%s].consentLabel renders byte-identical to the ledgered text_md',
    async (locale) => {
      const { data } = await db
        .from('consent_texts')
        .select('text_md')
        .eq('id', `launch_notification:${locale}:${V}`)
        .maybeSingle()
      expect(data?.text_md).toBeTruthy()

      const NAME = 'Acme Launch'
      const displayed = FORM_STRINGS[locale].consentLabel(NAME)
      const ledgered = (data!.text_md as string).replaceAll('{name}', NAME)
      expect(displayed).toBe(ledgered)
    },
  )
})
