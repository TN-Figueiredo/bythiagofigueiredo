const DEFAULT_COLOR = '#7c3aed'

export function getEmailStylesheet(typeColor: string = DEFAULT_COLOR): string {
  return `
h1 { font-size:28px; font-weight:700; color:#1a1a1a; margin:0 0 16px; font-family:Arial,sans-serif; }
h2 { font-size:22px; font-weight:700; color:#1a1a1a; margin:0 0 12px; font-family:Arial,sans-serif; }
h3 { font-size:18px; font-weight:600; color:#333; margin:0 0 8px; font-family:Arial,sans-serif; }
p { font-size:16px; line-height:1.7; color:#333; margin:0 0 16px; font-family:Georgia,serif; }
a { color:${typeColor}; text-decoration:underline; }
blockquote { border-left:3px solid ${typeColor}; padding:8px 16px; margin:16px 0; color:#666; font-style:italic; }
img { max-width:600px; height:auto; border-radius:4px; display:block; margin:16px auto; }
ul, ol { padding-left:24px; margin:0 0 16px; }
li { margin-bottom:8px; font-size:16px; color:#333; font-family:Georgia,serif; }
hr { border:none; border-top:1px solid #eee; margin:24px 0; }
.cta-button { display:inline-block; padding:12px 32px; background:${typeColor}; color:#ffffff; border-radius:6px; text-decoration:none; font-weight:600; font-family:Arial,sans-serif; font-size:16px; }
.cta-wrapper { text-align:center; margin:24px 0; }
`.trim()
}
