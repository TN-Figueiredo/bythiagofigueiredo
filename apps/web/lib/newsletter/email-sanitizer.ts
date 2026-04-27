import juice from 'juice'
import { getEmailStylesheet } from './email-styles'

/** Compress juice-expanded inline styles: `color: red; margin: 0` → `color:red;margin:0` */
function compressInlineStyles(html: string): string {
  return html.replace(/style="([^"]*)"/gi, (_match, declarations: string) => {
    const compressed = declarations
      .split(';')
      .map((decl) => {
        const colonIdx = decl.indexOf(':')
        if (colonIdx === -1) return decl.trim()
        const prop = decl.slice(0, colonIdx).trim()
        const val = decl.slice(colonIdx + 1).trim()
        return prop && val ? `${prop}:${val}` : ''
      })
      .filter(Boolean)
      .join(';')
    return `style="${compressed}"`
  })
}

/** Restore empty-value alt attributes that HTML parsers collapse to boolean form */
function restoreEmptyAlt(html: string): string {
  return html.replace(/<img([^>]*)\balt(?:="")?(\s|\/?>)/gi, '<img$1alt=""$2')
}

export function sanitizeForEmail(html: string, typeColor: string): string {
  if (!html) return ''

  let sanitized = html

  // 1. XSS prevention
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '')
  sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>"']+/gi, '')
  sanitized = sanitized.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '')

  // 2. Image safety — add alt="" to images missing alt attribute
  sanitized = sanitized.replace(
    /<img(?![^>]*\balt\b)([^>]*)>/gi,
    '<img alt=""$1>',
  )

  // 3. CSS inlining via juice
  const stylesheet = getEmailStylesheet(typeColor)
  sanitized = juice.inlineContent(sanitized, stylesheet, {
    applyStyleTags: false,
    removeStyleTags: false,
    preserveMediaQueries: false,
    preserveFontFaces: false,
  })

  // 3a. Normalize juice output: compress `prop: value` → `prop:value` in style attrs
  sanitized = compressInlineStyles(sanitized)

  // 3b. juice/cheerio collapses alt="" to boolean `alt` — restore quoted form
  sanitized = restoreEmptyAlt(sanitized)

  // 4. CTA button Outlook VML wrap
  sanitized = sanitized.replace(
    /<a([^>]*class="[^"]*cta-button[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi,
    (_match, attrs: string, text: string) => {
      const hrefMatch = attrs.match(/href="([^"]*)"/)
      const href = hrefMatch?.[1] ?? '#'
      const bgMatch = attrs.match(/background:([^;"]+)/)
      const bg = (bgMatch?.[1] ?? typeColor).trim()
      const fallbackLink = `<a${attrs}>${text}</a>`
      return [
        `<!--[if mso]>`,
        `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${bg}" fillcolor="${bg}">`,
        `<w:anchorlock/>`,
        `<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${text}</center>`,
        `</v:roundrect>`,
        `<![endif]-->`,
        `<!--[if !mso]><!-->`,
        fallbackLink,
        `<!--<![endif]-->`,
      ].join('')
    },
  )

  return sanitized
}
