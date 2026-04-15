import type { TocEntry } from '../types/content'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function extractToc(source: string): TocEntry[] {
  const noCode = source.replace(/```[\s\S]*?```/g, '')
  const headings: TocEntry[] = []
  const re = /^(#{1,6})\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(noCode)) !== null) {
    const depth = match[1]!.length
    const text = match[2]!.trim()
    headings.push({ depth, text, slug: slugify(text) })
  }
  return headings
}
