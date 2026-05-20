import { Section } from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS } from './email-tokens'

interface EmailButtonProps {
  href: string
  color?: string
  children: React.ReactNode
}

export function EmailButton({ href, color = EMAIL_COLORS.accent, children }: EmailButtonProps) {
  const buttonText = typeof children === 'string' ? children : ''
  return (
    <Section style={{ textAlign: 'center', margin: '32px 0' }}>
      <div dangerouslySetInnerHTML={{ __html: `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="13%" strokecolor="${color}" fillcolor="${color}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${buttonText}</center>
</v:roundrect>
<![endif]-->` }} />
      <div dangerouslySetInnerHTML={{ __html: `<!--[if !mso]><!-->` }} />
      <a
        href={href}
        style={{
          display: 'inline-block',
          padding: '14px 32px',
          backgroundColor: color,
          color: '#FFFFFF',
          fontFamily: EMAIL_FONTS.sans,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          borderRadius: 6,
          lineHeight: '1',
        }}
      >
        {children}
      </a>
      <div dangerouslySetInnerHTML={{ __html: `<!--<![endif]-->` }} />
    </Section>
  )
}
