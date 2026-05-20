import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailButton } from './components/email-button'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

const COPY = {
  'pt-BR': {
    preheader: 'Confirme sua inscrição na newsletter',
    heading: 'Quase lá.',
    bodyGeneric: 'Clique no botão abaixo para confirmar sua inscrição na newsletter.',
    bodyWithList: 'Clique no botão abaixo para confirmar sua inscrição.',
    listLabel: 'Você está se inscrevendo em:',
    button: 'Confirmar inscrição',
    ignore: 'Se você não se inscreveu, pode ignorar este email.',
  },
  en: {
    preheader: 'Confirm your newsletter subscription',
    heading: 'Almost there.',
    bodyGeneric: 'Click the button below to confirm your newsletter subscription.',
    bodyWithList: 'Click the button below to confirm your subscription.',
    listLabel: "You're subscribing to:",
    button: 'Confirm subscription',
    ignore: "If you didn't subscribe, you can safely ignore this email.",
  },
} as const

interface ConfirmEmailProps {
  confirmUrl: string
  locale: string
  newsletterNames?: string[]
}

export function ConfirmEmail({ confirmUrl, locale, newsletterNames }: ConfirmEmailProps) {
  const isPt = locale === 'pt-BR'
  const c = isPt ? COPY['pt-BR'] : COPY.en
  const hasNames = newsletterNames && newsletterNames.length > 0

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
          margin: '0 0 16px',
          textAlign: 'center',
        }}>
          {hasNames ? c.bodyWithList : c.bodyGeneric}
        </Text>
      </Section>

      {hasNames && (
        <Section style={{ margin: '0 32px 16px' }}>
          <Text className="email-muted" style={{
            fontFamily: EMAIL_FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: EMAIL_COLORS.muted,
            margin: '0 0 8px',
          }}>
            {c.listLabel}
          </Text>
          {newsletterNames.map((name, i) => (
            <Text key={i} className="email-muted" style={{
              fontFamily: EMAIL_FONTS.serif,
              fontSize: 15,
              color: EMAIL_COLORS.muted,
              margin: '0 0 4px',
              paddingLeft: 12,
              lineHeight: '1.6',
            }}>
              {'•'} {name}
            </Text>
          ))}
        </Section>
      )}

      <EmailButton href={confirmUrl}>{c.button}</EmailButton>

      <Section style={{ padding: '0 32px' }}>
        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 12,
          color: EMAIL_COLORS.faint,
          margin: '24px 0 0',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          {c.ignore}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
    </EmailShell>
  )
}
