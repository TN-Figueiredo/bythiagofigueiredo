import { Section, Text } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

interface EmailHeaderProps {
  typeName: string
  typeColor: string
}

export function EmailHeader({ typeName, typeColor }: EmailHeaderProps) {
  return (
    <Section style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
      {/* Monogram */}
      <Text
        style={{
          fontFamily: EMAIL_FONTS.serif,
          fontSize: 32,
          fontWeight: 500,
          color: EMAIL_COLORS.ink,
          letterSpacing: '-2px',
          lineHeight: '1',
          margin: '0 0 20px',
        }}
      >
        {'T'}
        <span style={{ fontStyle: 'italic', color: EMAIL_COLORS.accent }}>{'F'}</span>
      </Text>

      {/* Color accent bar */}
      <div
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          backgroundColor: typeColor || EMAIL_COLORS.accent,
          margin: '0 auto 16px',
        }}
      />

      {/* Newsletter type label */}
      <Text
        style={{
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: EMAIL_COLORS.muted,
          margin: 0,
        }}
      >
        {typeName}
      </Text>
    </Section>
  )
}
