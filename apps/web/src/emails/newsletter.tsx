import { Html, Head, Body, Container, Preview, Section } from '@react-email/components'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'

interface NewsletterProps {
  subject: string
  preheader?: string
  contentHtml: string
  typeName: string
  typeColor: string
  unsubscribeUrl: string
  archiveUrl: string
}

export function Newsletter({
  subject,
  preheader,
  contentHtml,
  typeName,
  typeColor,
  unsubscribeUrl,
  archiveUrl,
}: NewsletterProps) {
  return (
    <Html>
      <Head />
      {preheader && <Preview>{preheader}</Preview>}
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px', backgroundColor: '#fff' }}>
          <EmailHeader typeName={typeName} typeColor={typeColor} />
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          <EmailFooter unsubscribeUrl={unsubscribeUrl} archiveUrl={archiveUrl} />
        </Container>
      </Body>
    </Html>
  )
}
