import { Html, Head, Body, Container, Preview, Section } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS, emailDarkStyles } from './email-tokens'

interface EmailShellProps {
  preheader?: string
  lang?: string
  title?: string
  accentColor?: string
  children: React.ReactNode
}

export function EmailShell({ preheader, lang = 'pt-BR', title, accentColor = EMAIL_COLORS.accent, children }: EmailShellProps) {
  return (
    <Html lang={lang} dir="ltr">
      <Head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
        {title && <title>{title}</title>}
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
            maxWidth: 680,
            margin: '0 auto',
            padding: '48px 0',
            backgroundColor: EMAIL_COLORS.card,
          }}
        >
          <Section
            aria-hidden="true"
            style={{
              height: 4,
              background: accentColor,
              borderRadius: '0',
              margin: 0,
              padding: 0,
            }}
          />
          {children}
        </Container>
      </Body>
    </Html>
  )
}
