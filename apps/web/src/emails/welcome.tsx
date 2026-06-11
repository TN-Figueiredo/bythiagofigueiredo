import { Section, Text, Link } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailNewsletterList, type NewsletterListItem } from './components/email-newsletter-list'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EmailFooter } from './components/email-footer'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

const COPY = {
  'pt-BR': {
    preheader: 'Sua inscrição foi confirmada — bem-vindo!',
    heading: 'Bem-vindo às newsletters',
    body: 'Sua inscrição foi confirmada para:',
    afterList: 'A partir de agora, cada edição vai direto para o seu email — sem algoritmo.',
    primaryTab: "Para garantir que você sempre receba: se este email caiu em 'Promoções' ou 'Atualizações', arraste pra 'Principal' e confirme.",
    addContactBefore: 'Melhor ainda: adicione ',
    addContactAfter: ' aos contatos.',
    replyInvite: 'Me conta o que te trouxe aqui — é só responder; eu leio tudo.',
    latestLabel: 'ÚLTIMO ARTIGO',
    readMore: 'Ler artigo →',
    thankYou: 'Obrigado por estar aqui.',
    signOff: '— Thiago',
  },
  en: {
    preheader: 'Your subscription is confirmed — welcome!',
    heading: 'Welcome to the newsletters',
    body: 'Your subscription is confirmed for:',
    afterList: 'From now on, every edition goes straight to your inbox — no algorithm.',
    primaryTab: "To make sure you always receive it: if this email landed in 'Promotions' or 'Updates', drag it to 'Primary' and confirm.",
    addContactBefore: 'Even better: add ',
    addContactAfter: ' to your contacts.',
    replyInvite: 'Tell me what brought you here — just hit reply; I read everything.',
    latestLabel: 'LATEST ARTICLE',
    readMore: 'Read article →',
    thankYou: 'Thank you for being here.',
    signOff: '— Thiago',
  },
} as const

interface LatestArticle {
  title: string
  url: string
  excerpt?: string
}

interface WelcomeEmailProps {
  locale: string
  newsletterNames: NewsletterListItem[]
  latestArticle?: LatestArticle
  unsubscribeUrl: string
  archiveUrl?: string
  /** From-address shown in the "add to contacts" nudge. Never hardcoded — the
   *  caller derives it from NEWSLETTER_FROM_DOMAIN. Omitted → the contacts
   *  sentence is dropped (the primary-tab nudge still renders). */
  senderEmail?: string
  /** Whether replies actually reach a human (replyTo set). Omitted/false →
   *  the "just hit reply; I read everything" invite is dropped — the from is
   *  no-reply@ and replies would bounce. The primary-tab nudge always renders. */
  canReply?: boolean
}

export function WelcomeEmail({ locale, newsletterNames, latestArticle, unsubscribeUrl, archiveUrl, senderEmail, canReply }: WelcomeEmailProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en

  return (
    <EmailShell preheader={c.preheader} lang={locale}>
      <EmailMonogram />
      <EmailDivider />

      <Section style={{ padding: '40px 48px 12px' }}>
        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 30,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          margin: '0 0 20px',
          letterSpacing: '-0.02em',
          lineHeight: '1.2',
        }}>
          {c.heading}
        </Text>
        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 17,
          lineHeight: '1.65',
          color: EMAIL_COLORS.ink,
          margin: '0 0 4px',
        }}>
          {c.body}
        </Text>
      </Section>

      <EmailNewsletterList items={newsletterNames} />

      <Section style={{ padding: '0 48px' }}>
        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 17,
          lineHeight: '1.65',
          color: EMAIL_COLORS.ink,
          margin: '16px 0 16px',
        }}>
          {c.afterList}
        </Text>
        {/* Primary-tab nudge — the single biggest deliverability lever: Gmail
            learns from drag-to-Primary + add-to-contacts signals. */}
        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 15,
          lineHeight: '1.65',
          color: EMAIL_COLORS.muted,
          margin: '0 0 28px',
        }}>
          {c.primaryTab}
          {senderEmail && (
            <>
              {' '}
              {c.addContactBefore}
              <span style={{ fontFamily: EMAIL_FONTS.mono, fontSize: 13, color: EMAIL_COLORS.ink, fontWeight: 500 }}>
                {senderEmail}
              </span>
              {c.addContactAfter}
            </>
          )}
        </Text>
      </Section>

      {latestArticle && (
        <>
          <EmailDivider />
          <Section style={{ padding: '0 48px 36px' }}>
            <div className="email-line" style={{
              border: `1px solid ${EMAIL_COLORS.line}`,
              padding: '24px 28px',
              backgroundColor: '#FFFFFF',
            }}>
              <Text className="email-faint" style={{
                fontFamily: EMAIL_FONTS.mono,
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: EMAIL_COLORS.faint,
                fontWeight: 500,
                margin: '0 0 8px',
              }}>
                {c.latestLabel}
              </Text>
              <Text className="email-ink" style={{
                fontFamily: EMAIL_FONTS.serif,
                fontSize: 20,
                fontWeight: 500,
                color: EMAIL_COLORS.ink,
                margin: '0 0 8px',
                lineHeight: '1.3',
                letterSpacing: '-0.01em',
              }}>
                {latestArticle.title}
              </Text>
              {latestArticle.excerpt && (
                <Text className="email-muted" style={{
                  fontFamily: EMAIL_FONTS.serif,
                  fontSize: 14,
                  color: EMAIL_COLORS.muted,
                  margin: '0 0 16px',
                  lineHeight: '1.55',
                }}>
                  {latestArticle.excerpt}
                </Text>
              )}
              <Link href={latestArticle.url} target="_blank" rel="noopener noreferrer" style={{
                fontFamily: EMAIL_FONTS.sans,
                fontSize: 13,
                fontWeight: 600,
                color: EMAIL_COLORS.accent,
                textDecoration: 'none',
              }}>
                {c.readMore}
              </Link>
            </div>
          </Section>
        </>
      )}

      <Section style={{ padding: '0 48px 40px' }}>
        {canReply && (
          <Text className="email-ink" style={{
            fontFamily: EMAIL_FONTS.serif,
            fontSize: 16,
            color: EMAIL_COLORS.ink,
            margin: '0 0 12px',
            lineHeight: '1.6',
          }}>
            {c.replyInvite}
          </Text>
        )}
        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 16,
          color: EMAIL_COLORS.muted,
          margin: '0 0 4px',
          lineHeight: '1.6',
        }}>
          {c.thankYou}
        </Text>
        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 16,
          color: EMAIL_COLORS.muted,
          margin: 0,
          lineHeight: '1.6',
        }}>
          {c.signOff}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
      <EmailFooter
        unsubscribeUrl={unsubscribeUrl}
        archiveUrl={archiveUrl ?? 'https://bythiagofigueiredo.com'}
        locale={locale}
      />
    </EmailShell>
  )
}
