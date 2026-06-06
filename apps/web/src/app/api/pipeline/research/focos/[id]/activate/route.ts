import { type NextRequest } from 'next/server'
import { authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import {
  getResearchFoco,
  getActiveFoco,
  activateResearchFoco,
} from '@/lib/pipeline/services/research-focos'

/**
 * Activate a foco — promote it to the single active foco for the site.
 *
 * High-impact: demotes whichever foco was previously active. Mirrors the MCP
 * `manage_focos` activate action, which is gated behind dry_run + confirmation.
 * The REST equivalent requires an explicit `{ "confirm": true }` body. Without
 * it, the route returns a non-destructive preview (HTTP 200) describing the
 * planned demote + promote so callers can review before re-issuing with confirm.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const body = await parseBody(req)
  if (body instanceof Response) return body
  const confirm = (body as { confirm?: unknown })?.confirm === true

  try {
    const ctx = authToServiceContext(auth)

    if (!confirm) {
      // Preview: surface the planned activation + demotion without mutating.
      const { data: focoDetail } = await getResearchFoco(ctx, id)
      const foco = focoDetail.data
      const planned: Array<Record<string, unknown>> = [
        { entity: 'research_foco', id, field: 'active', from: foco.active, to: true },
        { entity: 'research_foco', id, field: 'state', from: foco.state, to: 'ativo' },
      ]
      const { data: active } = await getActiveFoco(ctx)
      const activeRow = active?.data
      if (activeRow && activeRow.id !== id) {
        planned.push({ entity: 'research_foco', id: activeRow.id, field: 'active', from: true, to: false })
      }
      return pipelineSuccess(
        { requires_confirmation: true, planned, hint: 'Re-issue with body { "confirm": true } to activate.' },
        200,
        auth,
      )
    }

    const { data } = await activateResearchFoco(ctx, id)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
