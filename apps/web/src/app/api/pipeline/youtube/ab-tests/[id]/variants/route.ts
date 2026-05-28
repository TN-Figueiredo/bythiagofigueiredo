import { NextRequest } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listVariants, upsertVariants, deleteVariant, type VariantInput } from '@/lib/pipeline/services/youtube'

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

  try {
    const ctx = authToServiceContext(auth)
    const data = await upsertVariants(ctx, id, body as VariantInput[])
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params

  try {
    const ctx = authToServiceContext(auth)
    const data = await listVariants(ctx, id)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const label = searchParams.get('label')
  if (!label) return pipelineError('VALIDATION_ERROR', 'label query param required', 400, auth)

  try {
    const ctx = authToServiceContext(auth)
    const data = await deleteVariant(ctx, id, label)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
