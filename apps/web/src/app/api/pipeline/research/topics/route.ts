import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { authenticateRead, authenticateWrite, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { authToServiceContext, serviceErrorToResponse } from '@/lib/pipeline/services/http-adapter'
import { listTopics, createTopic } from '@/lib/pipeline/services/research'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  try {
    const ctx = authToServiceContext(auth)
    const data = await listTopics(ctx)
    return pipelineSuccess(data, 200, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  try {
    const ctx = authToServiceContext(auth)
    const data = await createTopic(ctx, body)
    revalidateTag('layout-counts')
    return pipelineSuccess(data, 201, auth)
  } catch (err) {
    return serviceErrorToResponse(err, auth)
  }
}
