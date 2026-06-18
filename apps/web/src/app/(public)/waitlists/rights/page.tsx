import { getSiteContext } from '@/lib/cms/site-context'
import { Paper, Tape } from '@/components/pinboard'
import { WaitlistRightsForm } from './rights-form'

// Public LGPD rights entry point: a data subject enters their email to receive a tokenized
// link for accessing or deleting their waitlist data. Discoverable from the waitlist landing
// page. The actual access/erasure happens on /waitlists/manage/[token].
export const dynamic = 'force-dynamic'

export default async function WaitlistRightsPage() {
  const { defaultLocale } = await getSiteContext()
  const isPt = defaultLocale === 'pt-BR'
  const locale = isPt ? 'pt-BR' : 'en'

  const copy = isPt
    ? {
        title: 'Seus dados na lista de espera',
        intro: 'Informe o e-mail que você usou para entrar na lista de espera. Enviaremos um link para acessar ou apagar seus dados. Por segurança, a resposta é a mesma esteja o e-mail cadastrado ou não.',
        label: 'Seu e-mail',
        placeholder: 'voce@exemplo.com',
        submit: 'Enviar link',
        sending: 'Enviando…',
        done: 'Se este e-mail estiver cadastrado, você receberá um link em instantes. Verifique sua caixa de entrada.',
        error: 'Algo deu errado. Tente novamente em alguns instantes.',
      }
    : {
        title: 'Your waitlist data',
        intro: 'Enter the email you used to join the waitlist. We’ll send you a link to access or delete your data. For your security, the response is the same whether or not the email is registered.',
        label: 'Your email',
        placeholder: 'you@example.com',
        submit: 'Send link',
        sending: 'Sending…',
        done: 'If this email is registered, you’ll receive a link shortly. Check your inbox.',
        error: 'Something went wrong. Please try again shortly.',
      }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px' }}>
      <Paper>
        <Tape />
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>{copy.title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{copy.intro}</p>
        <WaitlistRightsForm
          locale={locale}
          strings={{ label: copy.label, placeholder: copy.placeholder, submit: copy.submit, sending: copy.sending, done: copy.done, error: copy.error }}
        />
      </Paper>
    </main>
  )
}
