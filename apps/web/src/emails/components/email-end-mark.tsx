import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export function EmailEndMark() {
  return (
    <Section style={{ textAlign: 'center', padding: '8px 32px 0' }}>
      <Text style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 16,
        color: EMAIL_COLORS.accent,
        margin: '0 0 12px',
        lineHeight: '1',
      }}>
        ― ❦ ―
      </Text>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 13,
        color: EMAIL_COLORS.faint,
        margin: '0 0 2px',
        lineHeight: '1.4',
      }}>
        <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>{' '}
        <span style={{ color: EMAIL_COLORS.accent }}>❦</span>{' '}
        <strong style={{ fontWeight: 500 }}>Thiago Figueiredo</strong>
      </Text>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 11,
        color: EMAIL_COLORS.faint,
        margin: 0,
        letterSpacing: '0.02em',
      }}>
        <a href="https://bythiagofigueiredo.com" style={{ color: EMAIL_COLORS.faint, textDecoration: 'none' }}>
          bythiagofigueiredo.com
        </a>
      </Text>
    </Section>
  )
}
