import type { EmailBranding } from '../types/branding'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function formatDatePtBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDate(d: Date, locale: string): string {
  if (locale === 'en') {
    return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return formatDatePtBR(d)
}

const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i

function safeColor(input: string | undefined, fallback: string): string {
  if (!input) return fallback
  return HEX_COLOR_RE.test(input) ? input : fallback
}

export function emailButton(opts: { url: string; label: string; color?: string }): string {
  const c = safeColor(opts.color, '#0070f3')
  return `<a href="${escapeHtml(opts.url)}" style="display:inline-block;padding:12px 24px;background:${c};color:#fff;text-decoration:none;border-radius:4px;font-weight:600;">${escapeHtml(opts.label)}</a>`
}

const UNSUB_LABEL_PT = 'Cancelar inscrição'
const UNSUB_LABEL_EN = 'Unsubscribe'

export function emailLayout(opts: {
  body: string
  branding: EmailBranding
  locale?: string
  unsubscribeLabel?: string
}): string {
  const { branding, body } = opts
  const locale = opts.locale ?? 'pt-BR'
  const unsubLabel = opts.unsubscribeLabel ?? (locale === 'en' ? UNSUB_LABEL_EN : UNSUB_LABEL_PT)
  const logo = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.brandName)}" style="max-height:48px;margin-bottom:16px;" />`
    : ''
  const footer = branding.footerText ?? branding.brandName
  const unsub = branding.unsubscribeUrl
    ? `<p style="font-size:12px;color:#999;margin-top:24px;text-align:center;"><a href="${escapeHtml(branding.unsubscribeUrl)}" style="color:#999;">${escapeHtml(unsubLabel)}</a></p>`
    : ''
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(branding.brandName)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;padding:32px;border-radius:8px;">
        <tr><td>
          ${logo}
          ${body}
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#999;text-align:center;">${escapeHtml(footer)}</p>
          ${unsub}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gs, '')
    .replace(/<script[^>]*>.*?<\/script>/gs, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
