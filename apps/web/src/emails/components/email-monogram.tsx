import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

export function EmailMonogram() {
  return (
    <Section style={{ textAlign: 'center', padding: '0 0 24px' }}>
      <Text style={{
        fontFamily: EMAIL_FONTS.serif,
        fontSize: 40,
        fontWeight: 500,
        color: EMAIL_COLORS.ink,
        letterSpacing: '-3px',
        lineHeight: '1',
        margin: 0,
      }}>
        T<span style={{
          fontStyle: 'italic',
          color: EMAIL_COLORS.accent,
        }}>F</span><span style={{
          fontSize: 8,
          verticalAlign: 'middle',
          marginLeft: 2,
          color: EMAIL_COLORS.ink,
        }}>●</span>
      </Text>
    </Section>
  )
}
