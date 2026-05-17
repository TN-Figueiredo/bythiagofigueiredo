import { NextRequest } from 'next/server'
import { authenticateRead, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: test, error } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(*),
      cycles:ab_test_cycles!test_id(*),
      tracked_links:ab_test_tracked_links!ab_test_id(*)
    `)
    .eq('id', id)
    .single()

  if (error || !test) return pipelineError('NOT_FOUND', 'Test not found', 404, auth)

  return pipelineSuccess(test, 200, auth)
}
