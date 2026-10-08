// Leitura do erro das APIs do Google. Puro: sem banco e sem token. O corpo nunca é guardado nem logado.

/** Lê só o `reason` do erro (formato antigo `errors[]` e novo `details[]`). */
export async function motivoDoGoogle(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as {
      error?: { errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> }
    }
    return body.error?.errors?.find(e => e.reason)?.reason ?? body.error?.details?.find(d => d.reason)?.reason ?? null
  } catch {
    return null
  }
}

/**
 * A resposta diz que o canal perdeu a autorização (spec, seção 6): 401, ou 403 por permissão insuficiente.
 * Vale para a Analytics API e a Data API. A Reporting API tem estado próprio (`sem_acesso`) e NÃO passa por aqui.
 */
export function ehPerdaDeAutorizacao(status: number, reason: string | null): boolean {
  if (status === 401) return true
  return status === 403 && (reason === 'insufficientPermissions' || reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')
}
