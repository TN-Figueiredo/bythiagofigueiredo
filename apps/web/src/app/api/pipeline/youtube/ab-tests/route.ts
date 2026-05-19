import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(id, label, is_original, blob_url, title_text, description_text, metadata, sort_order)
    `)
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return pipelineError('DB_ERROR', error.message, 500, auth)

  return pipelineSuccess(data, 200, auth)
}
