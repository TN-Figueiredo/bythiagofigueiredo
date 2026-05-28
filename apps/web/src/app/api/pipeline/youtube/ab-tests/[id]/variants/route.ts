import { NextRequest } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { BatchVariantUpsertSchema } from '@/lib/youtube/ab-schemas'
import type { TestType } from '@/lib/youtube/ab-types'

const VALID_LABELS = new Set(['B', 'C', 'D'])

function validateTypeSpecificFields(
  testType: TestType,
  variants: Array<{ label: string; title_text?: string | null; description_text?: string | null }>,
): string[] {
  const errors: string[] = []
  for (const v of variants) {
    if (testType === 'title' && !v.title_text) {
      errors.push(`Variant ${v.label}: title_text required for title tests`)
    }
    if (testType === 'description' && !v.description_text) {
      errors.push(`Variant ${v.label}: description_text required for description tests`)
    }
    if (testType === 'combo' && !v.title_text) {
      errors.push(`Variant ${v.label}: title_text required for combo tests`)
    }
  }
  return errors
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid test ID format', 400, auth)
  }

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = BatchVariantUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status, site_id, test_type')
    .eq('id', id)
    .single()

  if (testError || !test) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }
  if (test.site_id !== auth.siteId) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }
  if (test.status !== 'draft') {
    return pipelineError('INVALID_STATUS', 'Variants can only be added to draft tests', 409, auth)
  }

  const typeErrors = validateTypeSpecificFields(
    test.test_type as TestType,
    parsed.data.variants,
  )
  if (typeErrors.length > 0) {
    return pipelineError('VALIDATION_ERROR', typeErrors.join('; '), 400, auth)
  }

  const upsertRows = parsed.data.variants.map((v, i) => ({
    test_id: id,
    label: v.label,
    is_original: false,
    title_text: v.title_text ?? null,
    description_text: v.description_text ?? null,
    metadata: v.metadata ?? {},
    sort_order: i + 1,
  }))

  const { data: upserted, error: upsertError } = await supabase
    .from('ab_test_variants')
    .upsert(upsertRows, { onConflict: 'test_id,label' })
    .select('id, label')

  if (upsertError) {
    return pipelineError('DB_ERROR', upsertError.message, 500, auth)
  }

  const results = (upserted ?? []).map(r => ({
    label: r.label,
    ok: true,
    id: r.id,
  }))

  return pipelineSuccess(
    {
      results,
      summary: { total: results.length, succeeded: results.length, failed: 0 },
    },
    200,
    auth,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid test ID format', 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id')
    .eq('id', id)
    .single()

  if (!test || test.site_id !== auth.siteId) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }

  const { data: variants, error } = await supabase
    .from('ab_test_variants')
    .select('*')
    .eq('test_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    return pipelineError('DB_ERROR', error.message, 500, auth)
  }

  return pipelineSuccess(variants ?? [], 200, auth)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid test ID format', 400, auth)
  }

  const { searchParams } = new URL(req.url)
  const label = searchParams.get('label')
  if (!label || !VALID_LABELS.has(label)) {
    return pipelineError('VALIDATION_ERROR', 'Query param "label" must be B, C, or D', 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status')
    .eq('id', id)
    .single()

  if (!test || test.site_id !== auth.siteId) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }
  if (test.status !== 'draft') {
    return pipelineError('INVALID_STATUS', 'Variants can only be deleted from draft tests', 409, auth)
  }

  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, is_original')
    .eq('test_id', id)
    .eq('label', label)
    .single()

  if (!variant) {
    return pipelineError('NOT_FOUND', 'Variant not found', 404, auth)
  }
  if (variant.is_original) {
    return pipelineError('VALIDATION_ERROR', 'Cannot delete the original variant', 400, auth)
  }

  const { error: deleteError } = await supabase
    .from('ab_test_variants')
    .delete()
    .eq('id', variant.id)

  if (deleteError) {
    return pipelineError('DB_ERROR', deleteError.message, 500, auth)
  }

  return pipelineSuccess({ deleted: true, label }, 200, auth)
}
