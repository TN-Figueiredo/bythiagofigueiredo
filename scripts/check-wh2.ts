import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
async function main() {
  const { count } = await sb.from('webhook_events').select('id', { count: 'exact', head: true })
  console.log('webhook_events rows:', count)
  const { data, error } = await sb.from('webhook_events').select('provider, event_type, created_at').order('created_at', { ascending: false }).limit(5)
  if (error) console.log('ERR', error.message)
  for (const r of data ?? []) console.log(`  ${r.created_at} | ${r.provider ?? ''} ${r.event_type ?? ''}`)
}
main().then(() => process.exit(0))
