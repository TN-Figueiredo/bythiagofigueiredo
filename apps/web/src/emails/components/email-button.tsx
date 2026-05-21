import { Section } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

interface EmailButtonProps {
  href: string
  color?: string
  children: React.ReactNode
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function EmailButton({ href, color = EMAIL_COLORS.accent, children }: EmailButtonProps) {
  const buttonText = typeof children === 'string' ? children : ''
  const safeHref = escapeHtmlAttr(href)
  const safeText = escapeHtmlAttr(buttonText)
  return (
    <Section style={{ textAlign: 'left', margin: '32px 0 0' }}>
      <div dangerouslySetInnerHTML={{ __html: `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" target="_blank" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="13%" strokecolor="${color}" fillcolor="${color}">
<w:anchorlock/>
<center style="color:#1F1B17;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeText}</center>
</v:roundrect>
<![endif]-->` }} />
      <div dangerouslySetInnerHTML={{ __html: `<!--[if !mso]><!-->` }} />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          padding: '15px 40px',
          backgroundColor: color,
          color: '#1F1B17',
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          borderRadius: 4,
          lineHeight: '1',
          letterSpacing: '0.01em',
        }}
      >
        {children}
      </a>
      <div dangerouslySetInnerHTML={{ __html: `<!--<![endif]-->` }} />
    </Section>
  )
}
