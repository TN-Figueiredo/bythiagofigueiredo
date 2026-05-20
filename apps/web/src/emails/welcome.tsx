import { Section, Text, Link } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailNewsletterList, type NewsletterListItem } from './components/email-newsletter-list'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

const COPY = {
  'pt-BR': {
    preheader: 'Sua inscrição foi confirmada — bem-vindo!',
    heading: 'Bem-vindo à newsletter.',
    body: 'Sua inscrição está confirmada. Você receberá as próximas edições diretamente no seu email.',
    subscribedTo: 'Suas newsletters:',
    latestLabel: 'ÚLTIMO ARTIGO',
    readMore: 'Ler artigo →',
    signOff: '— Thiago',
  },
  en: {
    preheader: 'Your subscription is confirmed — welcome!',
    heading: 'Welcome to the newsletter.',
    body: "Your subscription is confirmed. You'll receive upcoming editions directly in your inbox.",
    subscribedTo: 'Your newsletters:',
    latestLabel: 'LATEST ARTICLE',
    readMore: 'Read article →',
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
}

export function WelcomeEmail({ locale, newsletterNames, latestArticle }: WelcomeEmailProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en

  return (
    <EmailShell preheader={c.preheader}>
      <Section style={{ padding: '0 32px' }}>
        <EmailMonogram />
        <Text className="email-ink" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 28,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          margin: '0 0 16px',
          letterSpacing: '-0.02em',
          textAlign: 'center',
          lineHeight: '1.2',
        }}>
          {c.heading}
        </Text>
        <Text className="email-muted" style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 16,
          lineHeight: '1.65',
          color: EMAIL_COLORS.muted,
          margin: '0 0 8px',
          textAlign: 'center',
        }}>
          {c.body}
        </Text>
      </Section>

      <EmailNewsletterList items={newsletterNames} label={c.subscribedTo} />

      {latestArticle && (
        <>
          <EmailDivider />
          <Section style={{ padding: '0 32px' }}>
            <Text className="email-faint" style={{
              fontFamily: EMAIL_FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: EMAIL_COLORS.faint,
              fontWeight: 500,
              margin: '0 0 12px',
              textAlign: 'center',
            }}>
              {c.latestLabel}
            </Text>
            <div style={{
              border: `1px solid ${EMAIL_COLORS.line}`,
              borderRadius: 6,
              padding: '20px 24px',
            }}>
              <Text className="email-ink" style={{
                fontFamily: EMAIL_FONTS.serif,
                fontSize: 18,
                fontWeight: 500,
                color: EMAIL_COLORS.ink,
                margin: '0 0 8px',
                lineHeight: '1.3',
              }}>
                {latestArticle.title}
              </Text>
              {latestArticle.excerpt && (
                <Text className="email-muted" style={{
                  fontFamily: EMAIL_FONTS.serif,
                  fontSize: 14,
                  color: EMAIL_COLORS.muted,
                  margin: '0 0 12px',
                  lineHeight: '1.6',
                }}>
                  {latestArticle.excerpt}
                </Text>
              )}
              <Link href={latestArticle.url} style={{
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

      <Section style={{ padding: '24px 32px 0', textAlign: 'center' }}>
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
    </EmailShell>
  )
}
