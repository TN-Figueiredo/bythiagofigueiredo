import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailButton } from './components/email-button'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EmailFooter } from './components/email-footer'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

const COPY = {
  'pt-BR': {
    preheader: 'Confirme sua inscrição na newsletter',
    heading: 'Confirme sua inscrição',
    bodyGeneric: 'Clique no botão abaixo para confirmar sua inscrição.',
    bodyWithList: 'Você escolheu receber {n} newsletters:',
    afterList: 'Clique no botão abaixo para confirmar e começar a receber.',
    button: 'Confirmar Inscrição',
    ignore: 'Se não foi você, pode ignorar este email com segurança.',
  },
  en: {
    preheader: 'Confirm your newsletter subscription',
    heading: 'Confirm your subscription',
    bodyGeneric: 'Click the button below to confirm your subscription.',
    bodyWithList: 'You chose to receive {n} newsletters:',
    afterList: 'Click the button below to confirm and start receiving.',
    button: 'Confirm Subscription',
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

  const bodyWithList = c.bodyWithList.replace('{n}', String(newsletterNames?.length ?? 0))

  return (
    <EmailShell preheader={c.preheader} lang={locale}>
      <EmailMonogram />
      <EmailDivider />

      <Section style={{ padding: '40px 48px 44px' }}>
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
          {hasNames ? bodyWithList : c.bodyGeneric}
        </Text>

        {hasNames && (
          <>
            {newsletterNames.map((name, i) => (
              <Section key={i} style={{
                borderLeft: `3px solid ${EMAIL_COLORS.accent}`,
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 16,
                margin: '0 0 10px',
              }}>
                <Text className="email-ink" style={{
                  fontFamily: EMAIL_FONTS.serif,
                  fontSize: 16,
                  fontWeight: 500,
                  color: EMAIL_COLORS.ink,
                  margin: 0,
                  lineHeight: '1.3',
                }}>
                  {name}
                </Text>
              </Section>
            ))}
            <Text className="email-ink" style={{
              fontFamily: EMAIL_FONTS.serif,
              fontSize: 17,
              lineHeight: '1.65',
              color: EMAIL_COLORS.ink,
              margin: '16px 0 0',
            }}>
              {c.afterList}
            </Text>
          </>
        )}

        <EmailButton href={confirmUrl}>{c.button}</EmailButton>

        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 13,
          color: EMAIL_COLORS.faint,
          margin: '28px 0 0',
          lineHeight: '1.5',
        }}>
          {c.ignore}
        </Text>
      </Section>

      <EmailDivider />
      <EmailEndMark />
      <EmailFooter locale={locale} showPrefs={false} />
    </EmailShell>
  )
}
