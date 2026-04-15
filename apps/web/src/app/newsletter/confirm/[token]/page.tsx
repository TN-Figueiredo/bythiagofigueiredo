import { createHash } from 'node:crypto'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

interface Props {
  params: Promise<{ token: string }>
}

interface ConfirmRpcResult {
  ok: boolean
  already?: boolean
  error?: 'not_found' | 'expired' | 'invalid_state'
}

export default async function NewsletterConfirmPage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    return (
      <main>
        <h1>Link inválido</h1>
        <p>Este link de confirmação é inválido.</p>
      </main>
    )
  }

  const supabase = getSupabaseServiceClient()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { data, error: rpcError } = await supabase.rpc('confirm_newsletter_subscription', {
    p_token_hash: tokenHash,
  })

  // RPC returns a JSON object
  const result = (data ?? null) as ConfirmRpcResult | null

  if (rpcError || !result) {
    return (
      <main>
        <h1>Erro ao confirmar</h1>
        <p>Ocorreu um erro inesperado. Tente novamente mais tarde.</p>
      </main>
    )
  }

  if (!result.ok) {
    if (result.error === 'not_found') {
      return (
        <main>
          <h1>Link não encontrado</h1>
          <p>Este link de confirmação não existe ou já foi utilizado.</p>
        </main>
      )
    }
    if (result.error === 'expired') {
      return (
        <main>
          <h1>Link expirado</h1>
          <p>
            Este link de confirmação expirou. Faça uma nova inscrição para receber um novo link.
          </p>
        </main>
      )
    }
    // invalid_state or unknown
    return (
      <main>
        <h1>Não foi possível confirmar</h1>
        <p>Ocorreu um problema com sua inscrição. Entre em contato caso o problema persista.</p>
      </main>
    )
  }

  if (result.already) {
    return (
      <main>
        <h1>Já confirmado</h1>
        <p>Seu email já estava confirmado. Você continuará recebendo nossa newsletter.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Inscrição confirmada!</h1>
      <p>Obrigado por confirmar seu email. Você está inscrito na nossa newsletter.</p>
    </main>
  )
}
