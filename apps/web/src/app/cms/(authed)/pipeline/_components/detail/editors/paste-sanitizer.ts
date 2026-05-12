export function transformPastedHTML(html: string): string {
  return html
    .replace(/class="[^"]*"/gi, '')
    .replace(/style="[^"]*mso[^"]*"/gi, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
}
