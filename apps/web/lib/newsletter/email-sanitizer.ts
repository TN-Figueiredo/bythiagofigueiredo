import juice from 'juice'
import DOMPurify from 'isomorphic-dompurify'
import { getEmailStylesheet } from './email-styles'

// Tags/attributes the newsletter editor can produce. DOMPurify drops anything
// outside this allowlist (script/style/iframe/object/svg handlers, etc.) and
// strips on* event handlers + javascript: URIs structurally — replacing the
// fragile hand-rolled regex pass that missed HTML-entity / unquoted variants.
const EMAIL_ALLOWED_TAGS = [
  'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'b', 'i', 'u',
  'br', 'hr', 'div', 'span', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'figure', 'figcaption',
]

const EMAIL_ALLOWED_ATTR = [
  'href', 'src', 'alt', 'style', 'class', 'width', 'height', 'align',
  'target', 'rel',
]

function escapeVmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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

  // 1. XSS prevention — DOMPurify on the INPUT (before juice / before the
  //    MSO comment wrap in step 4, since DOMPurify strips comments). Removes
  //    script/style tags, on* handlers and javascript: URIs structurally.
  //    ALLOW_DATA_ATTR keeps `data-merge-tag` spans the templating relies on.
  let sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  })

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
      const safeHref = escapeVmlAttr(href)
      const bgMatch = attrs.match(/background:([^;"]+)/)
      const bg = escapeVmlAttr((bgMatch?.[1] ?? typeColor).trim())
      const fallbackLink = `<a${attrs}>${text}</a>`
      return [
        `<!--[if mso]>`,
        `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${bg}" fillcolor="${bg}">`,
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
