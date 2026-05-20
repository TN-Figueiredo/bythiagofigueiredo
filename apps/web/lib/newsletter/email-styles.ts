const DEFAULT_COLOR = '#FF8240'

export function getEmailStylesheet(typeColor: string = DEFAULT_COLOR): string {
  return `
h1 { font-size:28px; font-weight:500; color:#1F1B17; margin:0 0 16px; font-family:Georgia,'Times New Roman',serif; letter-spacing:-0.02em; line-height:1.2; }
h2 { font-size:22px; font-weight:500; color:#1F1B17; margin:32px 0 12px; font-family:Georgia,'Times New Roman',serif; letter-spacing:-0.01em; line-height:1.3; }
h3 { font-size:18px; font-weight:600; color:#1F1B17; margin:24px 0 8px; font-family:Arial,Helvetica,sans-serif; line-height:1.4; }
p { font-size:16px; line-height:1.7; color:#6A5F48; margin:0 0 16px; font-family:Georgia,'Times New Roman',serif; }
a { color:${typeColor}; text-decoration:underline; }
blockquote { border-left:3px solid ${typeColor}; padding:12px 20px; margin:24px 0; color:#6A5F48; font-style:italic; background:#FBF6EC; }
img { max-width:600px; height:auto; border-radius:4px; display:block; margin:16px auto; }
ul, ol { padding-left:24px; margin:0 0 16px; }
li { margin-bottom:8px; font-size:16px; color:#6A5F48; font-family:Georgia,'Times New Roman',serif; line-height:1.7; }
hr { border:none; border-top:1px solid #E8DCC8; margin:32px 0; }
.cta-button { display:inline-block; padding:14px 32px; background:${typeColor}; color:#ffffff; border-radius:6px; text-decoration:none; font-weight:600; font-family:Arial,Helvetica,sans-serif; font-size:15px; }
.cta-wrapper { text-align:center; margin:28px 0; }
.drop-cap { float:left; font-size:3.2em; line-height:0.8; padding:4px 8px 0 0; color:#1F1B17; font-family:Georgia,'Times New Roman',serif; font-weight:500; }
`.trim()
}
