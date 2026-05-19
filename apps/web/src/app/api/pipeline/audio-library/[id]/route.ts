import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { AudioAssetUpdateSchema } from '@/lib/pipeline/audio-schemas'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid ID format', 400)

  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: asset, error } = await supabase
    .from('audio_assets')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error) {
    pipelineLog('error', 'audio-library', 'GET by id failed', { error })
    if (error.code === 'PGRST116') return pipelineError('NOT_FOUND', 'Asset not found', 404, auth)
    return pipelineError('DB_ERROR', 'Failed to load asset', 500, auth)
  }
  if (!asset) return pipelineError('NOT_FOUND', 'Asset not found', 404, auth)

  const { data: usage } = await supabase
    .from('audio_asset_usage')
    .select('id, pipeline_item_id, scene_number, usage_type, notes, content_pipeline(code, title_pt, format)')
    .eq('audio_asset_id', id)
    .eq('site_id', auth.siteId)

  return pipelineSuccess({ ...asset, usage: usage ?? [] }, 200, auth)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid ID format', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = AudioAssetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)
  }

  const { version, ...updates } = parsed.data
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('audio_assets')
    .update(updates)
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .eq('version', version)
    .select('*')
    .single()

  if (error || !data) {
    const { data: exists } = await supabase.from('audio_assets').select('id, version').eq('id', id).eq('site_id', auth.siteId).single()
    if (!exists) return pipelineError('NOT_FOUND', 'Asset not found', 404, auth)
    return pipelineError('CONFLICT', `Version mismatch: expected ${version}, current ${exists.version}`, 409, auth)
  }

  return pipelineSuccess(data, 200, auth)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid ID format', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('audio_assets')
    .update({ status: 'retired' })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('id, status')
    .single()

  if (error || !data) return pipelineError('NOT_FOUND', 'Asset not found', 404, auth)

  return pipelineSuccess(data, 200, auth)
}
