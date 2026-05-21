import { EMAIL_COLORS, EMAIL_FONTS } from '../../src/emails/components/email-tokens'

export function getEmailStylesheet(typeColor: string = EMAIL_COLORS.accent): string {
  return `
h1 { font-size:28px; font-weight:500; color:${EMAIL_COLORS.ink}; margin:0 0 16px; font-family:${EMAIL_FONTS.serif}; letter-spacing:-0.02em; line-height:1.2; }
h2 { font-size:22px; font-weight:500; color:${EMAIL_COLORS.ink}; margin:32px 0 12px; font-family:${EMAIL_FONTS.serif}; letter-spacing:-0.01em; line-height:1.3; }
h3 { font-size:18px; font-weight:600; color:${EMAIL_COLORS.ink}; margin:24px 0 8px; font-family:${EMAIL_FONTS.sans}; line-height:1.4; }
p { font-size:16px; line-height:1.7; color:${EMAIL_COLORS.muted}; margin:0 0 16px; font-family:${EMAIL_FONTS.serif}; }
a { color:${typeColor}; text-decoration:underline; }
blockquote { border-left:3px solid ${typeColor}; padding:12px 20px; margin:24px 0; color:${EMAIL_COLORS.muted}; font-style:italic; background:${EMAIL_COLORS.card}; }
img { max-width:600px; height:auto; border-radius:4px; display:block; margin:16px auto; }
ul, ol { padding-left:24px; margin:0 0 16px; }
li { margin-bottom:8px; font-size:16px; color:${EMAIL_COLORS.muted}; font-family:${EMAIL_FONTS.serif}; line-height:1.7; }
hr { border:none; border-top:1px solid ${EMAIL_COLORS.line}; margin:32px 0; }
.cta-button { display:inline-block; padding:14px 32px; background:${typeColor}; color:#ffffff; border-radius:6px; text-decoration:none; font-weight:600; font-family:${EMAIL_FONTS.sans}; font-size:15px; }
.cta-wrapper { text-align:center; margin:28px 0; }
.drop-cap { float:left; font-size:3.2em; line-height:0.8; padding:4px 8px 0 0; color:${EMAIL_COLORS.ink}; font-family:${EMAIL_FONTS.serif}; font-weight:500; }
`.trim()
}
