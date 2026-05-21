import { Section, Text } from '@react-email/components'
import { EmailShell } from './components/email-shell'
import { EmailMonogram } from './components/email-monogram'
import { EmailDivider } from './components/email-divider'
import { EmailEndMark } from './components/email-end-mark'
import { EmailFooter } from './components/email-footer'
import { EMAIL_COLORS, EMAIL_FONTS } from './components/email-tokens'

interface NewsletterProps {
  subject: string
  preheader?: string
  contentHtml: string
  typeName: string
  typeColor: string
  unsubscribeUrl: string
  archiveUrl: string
  locale?: string
}

export function Newsletter({
  subject,
  preheader,
  contentHtml,
  typeName,
  typeColor,
  unsubscribeUrl,
  archiveUrl,
  locale,
}: NewsletterProps) {
  return (
    <EmailShell preheader={preheader} lang={locale} title={subject} accentColor={typeColor}>
      <EmailMonogram />

      {/* Type indicator */}
      <Section style={{
        borderLeft: `3px solid ${typeColor}`,
        padding: '0 0 0 16px',
        margin: '0 32px 24px',
      }}>
        <Text className="email-faint" style={{
          fontFamily: EMAIL_FONTS.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: EMAIL_COLORS.faint,
          margin: 0,
          fontWeight: 500,
        }}>
          {typeName}
        </Text>
      </Section>

      {/* Content */}
      <Section style={{ padding: '0 32px' }}>
        <div
          className="email-ink"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </Section>

      <EmailDivider />
      <EmailEndMark />
      <EmailFooter unsubscribeUrl={unsubscribeUrl} archiveUrl={archiveUrl} locale={locale} />
    </EmailShell>
  )
}
