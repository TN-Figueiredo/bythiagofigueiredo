import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export function EmailMonogram() {
  return (
    <Section aria-hidden="true" style={{ textAlign: 'center', padding: '40px 40px 28px' }}>
      <Text className="email-ink" style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 44,
        fontWeight: 500,
        color: EMAIL_COLORS.ink,
        letterSpacing: '-4px',
        lineHeight: '1',
        margin: 0,
        whiteSpace: 'nowrap' as const,
      }}>
        T<span style={{
          fontStyle: 'italic',
          color: EMAIL_COLORS.accent,
        }}>F</span><span style={{
          fontSize: 8,
          color: EMAIL_COLORS.ink,
          verticalAlign: 'middle',
          marginLeft: 2,
        }}>&#9679;</span>
      </Text>
    </Section>
  )
}
