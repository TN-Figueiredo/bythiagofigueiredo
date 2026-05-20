import { Section, Text, Link } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

interface EmailFooterProps {
  unsubscribeUrl: string
  archiveUrl: string
}

export function EmailFooter({ unsubscribeUrl, archiveUrl }: EmailFooterProps) {
  return (
    <Section style={{ padding: '0 32px 32px', textAlign: 'center' }}>
      <Text className="email-faint" style={{
        fontFamily: EMAIL_FONTS.sans,
        fontSize: 12,
        color: EMAIL_COLORS.faint,
        margin: '0 0 8px',
        lineHeight: '1.6',
      }}>
        <Link href={archiveUrl} style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
          Ver no navegador
        </Link>
        {' · '}
        <Link href="https://bythiagofigueiredo.com" style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
          bythiagofigueiredo.com
        </Link>
        {' · '}
        <Link href={unsubscribeUrl} style={{ color: EMAIL_COLORS.faint, textDecoration: 'underline' }}>
          Cancelar inscrição
        </Link>
      </Text>
    </Section>
  )
}
