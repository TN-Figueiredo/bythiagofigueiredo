import { NextResponse } from 'next/server'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'

export async function GET() {
  return NextResponse.json({
    ...API_REGISTRY,
    directives: {
      always_check_context: 'Call GET /api/pipeline/context first to understand current references',
      use_x_expected_version: 'All PATCH/PUT must supply X-Expected-Version header',
      prefer_batch: 'Use bulk/batch endpoints when operating on 3+ items',
    },
    context: {
      endpoint: '/api/pipeline/context',
      filters: ['group', 'skill', 'format'],
      description: 'Shared reference content for all pipeline operations',
    },
  })
}
