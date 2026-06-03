import { Section, Text, Link } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

const COPY = {
  'pt-BR': { unsubscribe: 'Cancelar inscrição', preferences: 'Preferências' },
  en: { unsubscribe: 'Unsubscribe', preferences: 'Preferences' },
} as const

type Locale = keyof typeof COPY

interface EmailFooterProps {
  unsubscribeUrl?: string
  archiveUrl?: string
  locale?: string
  showPrefs?: boolean
}

export function EmailFooter({ unsubscribeUrl, archiveUrl, locale = 'pt-BR', showPrefs = true }: EmailFooterProps) {
  const copy = COPY[(locale as Locale) in COPY ? (locale as Locale) : 'pt-BR']
  return (
    <Section style={{ padding: '20px 48px 40px', textAlign: 'center' }}>
      <Text className="email-muted" style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 14,
        color: EMAIL_COLORS.muted,
        margin: '0 0 2px',
        lineHeight: '1.4',
      }}>
        <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
        {' '}
        <span style={{ color: EMAIL_COLORS.accent }}>❦</span>
        {' '}
        <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
      </Text>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 12,
        color: EMAIL_COLORS.faint,
        margin: '0 0 4px',
        letterSpacing: '0.02em',
      }}>
        bythiagofigueiredo.com
      </Text>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 10,
        color: EMAIL_COLORS.faint,
        margin: '0 0 20px',
        opacity: 0.7,
        lineHeight: '1.4',
      }}>
        Rua Example, 123 — São Paulo, SP — Brasil
      </Text>
      {unsubscribeUrl && (
        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 11,
          color: EMAIL_COLORS.faint,
          margin: 0,
          lineHeight: '1.6',
        }}>
          <Link href={unsubscribeUrl} target="_blank" rel="noopener noreferrer" style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
            {copy.unsubscribe}
          </Link>
          {showPrefs && (
            <>
              <span style={{ padding: '0 6px', opacity: 0.5 }}>·</span>
              <Link href={archiveUrl ?? 'https://bythiagofigueiredo.com'} target="_blank" rel="noopener noreferrer" style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
                {copy.preferences}
              </Link>
            </>
          )}
        </Text>
      )}
    </Section>
  )
}
