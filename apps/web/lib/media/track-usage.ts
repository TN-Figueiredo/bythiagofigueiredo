import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function trackMediaUsage(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<void> {
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('media_asset_usage')
    .insert({
      asset_id: assetId,
      resource_type: resourceType,
      resource_id: resourceId,
      field_name: fieldName,
    })

  if (error && error.code !== '23505') {
    throw new Error(`Failed to track media usage: ${error.message}`)
  }
}

export async function removeMediaUsage(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<void> {
  const supabase = getSupabaseServiceClient()
  await supabase
    .from('media_asset_usage')
    .delete()
    .eq('asset_id', assetId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('field_name', fieldName)
}

export async function getAssetUsages(
  assetId: string,
): Promise<Array<{ resourceType: string; resourceId: string; fieldName: string }>> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('media_asset_usage')
    .select('resource_type, resource_id, field_name')
    .eq('asset_id', assetId)

  if (error) return []
  return ((data ?? []) as Array<{ resource_type: string; resource_id: string; field_name: string }>).map(
    (row) => ({
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      fieldName: row.field_name,
    }),
  )
}
