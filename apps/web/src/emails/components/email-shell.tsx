import { Html, Head, Body, Container, Preview } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS, emailDarkStyles } from './email-tokens'

interface EmailShellProps {
  preheader?: string
  children: React.ReactNode
}

export function EmailShell({ preheader, children }: EmailShellProps) {
  return (
    <Html>
      <Head>
        <style dangerouslySetInnerHTML={{ __html: emailDarkStyles() }} />
      </Head>
      {preheader && <Preview>{preheader}</Preview>}
      <Body
        className="email-body"
        style={{
          backgroundColor: EMAIL_COLORS.bg,
          fontFamily: EMAIL_FONTS.serif,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          className="email-card"
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '48px 0',
            backgroundColor: EMAIL_COLORS.card,
          }}
        >
          {children}
        </Container>
      </Body>
    </Html>
  )
}
