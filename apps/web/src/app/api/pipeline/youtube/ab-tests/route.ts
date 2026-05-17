import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const authResult = await authenticateRead(req)
  if (!('ok' in authResult)) return authResult

  const supabase = getSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(id, label, is_original, blob_url, title_text, description_text, metadata, sort_order)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return pipelineError('DB_ERROR', error.message, 500, authResult.auth)

  return pipelineSuccess(data, 200, authResult.auth)
}
