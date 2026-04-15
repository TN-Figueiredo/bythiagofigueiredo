import { Suspense } from 'react'
import { ContactForm } from '../../components/contact-form'
import { submitContact } from './actions'

export const dynamic = 'force-dynamic'

const noticeMessages: Record<string, string> = {
  contact_received:
    'Mensagem enviada com sucesso! Você receberá uma confirmação por email.',
}

const errorMessages: Record<string, string> = {
  validation_error: 'Dados inválidos. Verifique os campos e tente novamente.',
  bot_check_failed: 'Verificação anti-bot falhou. Recarregue a página e tente novamente.',
  submit_failed: 'Erro ao enviar. Por favor, tente novamente.',
  rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}

interface Props {
  searchParams: Promise<{ notice?: string; error?: string }>
}

export default async function ContactPage({ searchParams }: Props) {
  const { notice, error } = await searchParams
  const noticeMessage = notice != null ? (noticeMessages[notice] ?? null) : null
  const errorMessage = error != null ? (errorMessages[error] ?? null) : null

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">Fale comigo</h1>
      <p className="text-gray-600 mb-8">
        Quer conversar sobre um projeto, parceria ou só trocar uma ideia? Manda mensagem!
      </p>

      {noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700 border border-green-200"
        >
          {noticeMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200"
        >
          {errorMessage}
        </div>
      )}

      {!noticeMessage && (
        <Suspense>
          <ContactForm locale="pt-BR" submitAction={submitContact} />
        </Suspense>
      )}
    </main>
  )
}
