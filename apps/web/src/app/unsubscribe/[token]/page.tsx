import { unsubscribeViaToken } from './actions'

interface Props {
  params: Promise<{ token: string }>
}

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    return (
      <main>
        <h1>Link inválido</h1>
        <p>Este link de cancelamento é inválido.</p>
      </main>
    )
  }

  const result = await unsubscribeViaToken(token)

  if (result.status === 'not_found') {
    return (
      <main>
        <h1>Link não encontrado</h1>
        <p>Este link de cancelamento não existe ou já foi removido.</p>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main>
        <h1>Erro ao processar</h1>
        <p>Ocorreu um erro inesperado. Tente novamente mais tarde.</p>
      </main>
    )
  }

  if (result.status === 'already') {
    return (
      <main>
        <h1>Já cancelado</h1>
        <p>Você já estava cancelado da nossa newsletter. Não enviaremos mais emails para você.</p>
      </main>
    )
  }

  // status === 'ok'
  return (
    <main>
      <h1>Cancelamento confirmado</h1>
      <p>
        Você foi removido da nossa newsletter com sucesso. Não enviaremos mais emails para você.
      </p>
    </main>
  )
}
