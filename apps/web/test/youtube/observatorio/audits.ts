/**
 * Pure DOM audits for the Observatório screens (ported from the mockup's `window.auditMockup`,
 * docs/superpowers/mockups/2026-10-02-observatorio/moldura-forja.html). Each returns string[] of
 * failures (empty = pass). Layout is not available under jsdom, so "visible" means: not inside
 * [hidden], .sr-only, [aria-hidden="true"] or an inline display:none / visibility:hidden.
 */
import type { Clock } from '@/lib/youtube/observatorio/time'

const HIDDEN = '[hidden],.sr-only,[aria-hidden="true"]'

function isHidden(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.matches(HIDDEN)) return true
    const s = (n as HTMLElement).style
    if (s && (s.display === 'none' || s.visibility === 'hidden')) return true
  }
  return false
}

/** Visible text of root, one text node per line. `skip` excludes extra subtrees. */
function visibleText(root: Element, skip?: string): string {
  const out: string[] = []
  const w = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement
    if (!el || isHidden(el) || (skip && el.closest(skip))) continue
    const t = n.textContent ?? ''
    if (t.trim()) out.push(t)
  }
  return out.join('\n')
}

const ctx = (text: string, i: number, len: number) =>
  text.slice(Math.max(0, i - 40), i + len + 20).replace(/\s+/g, ' ').trim()

const JUNK: Array<[string, RegExp]> = [
  ['NaN', /(?<![A-Za-z])NaN/], ['undefined', /(?<![A-Za-z])undefined(?![A-Za-z])/], ['null', /(?<![A-Za-z])null(?![A-Za-z])/],
  ['há −', /há\s*−/], ['Infinity', /Infinity/], ['[object Object]', /\[object Object\]/],
  ['−0', /−0(?![\d.,])/], ['há no futuro', /há no futuro/],
]

export function noJunkText(root: Element): string[] {
  const text = visibleText(root), fails: string[] = []
  for (const [label, re] of JUNK) {
    const m = re.exec(text)
    if (m) fails.push(`texto quebrado "${label}" em “${ctx(text, m.index, m[0].length)}”`)
  }
  return fails
}

export function oneFilledButton(root: Element): string[] {
  const filled = [...root.querySelectorAll('.btn-primary,.btn-forja-solid')].filter(b => !isHidden(b))
  return filled.length > 1 ? [`${filled.length} botões preenchidos visíveis (máximo 1)`] : []
}

export function linkCountsMatch(root: Element, counts: Record<string, number>): string[] {
  const fails: string[] = []
  root.querySelectorAll('[data-link-n]').forEach(a => {
    if (isHidden(a)) return
    const key = a.getAttribute('data-link-key') ?? '', n = Number(a.getAttribute('data-link-n'))
    if (!(key in counts)) fails.push(`link "${key}" sem destino conhecido`)
    else if (counts[key] !== n) fails.push(`link "${key}" diz ${n}, destino tem ${counts[key]}`)
  })
  return fails
}

function parseColor(c: string): [number, number, number] {
  const s = c.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.replace(/./g, x => x + x) : hex[1]!
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)]
  }
  const v = s.match(/[\d.]+/g)?.map(Number)
  if (!v || v.length < 3) throw new Error(`cor inválida: ${c}`)
  return [v[0]!, v[1]!, v[2]!]
}
const lum = (c: [number, number, number]) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
export function contrastRatio(fg: string, bg: string): number {
  const x = lum(parseColor(fg)), y = lum(parseColor(bg))
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export function contrastAA(pairs: Array<{ fg: string; bg: string; label: string; large?: boolean }>): string[] {
  const fails: string[] = []
  for (const p of pairs) {
    const min = p.large ? 3 : 4.5, r = contrastRatio(p.fg, p.bg)
    if (r < min) fails.push(`contraste ${p.label}: ${r.toFixed(2)}:1 < ${min}:1`)
  }
  return fails
}

const VOCAB = ['watchdog', 'sync', 'diff', 'snapshot', 'ETag', 'Test & Compare', 'horário de Brasília', 'Competitors']
export function forbiddenVocabulary(root: Element): string[] {
  const text = visibleText(root), fails: string[] = []
  for (const w of VOCAB) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`(?<![\\p{L}\\d])${esc}(?:s|ing)?(?![\\p{L}\\d])`, 'iu').exec(text)
    if (m) fails.push(`vocabulário proibido "${w}" em “${ctx(text, m.index, m[0].length)}”`)
  }
  return fails
}

export function brokenLinks(root: Element): string[] {
  const fails: string[] = []
  root.querySelectorAll('a[href]').forEach(a => {
    const h = a.getAttribute('href') ?? ''
    if (h === '#' || /\?$/.test(h)) fails.push(`href inválido "${h}"`)
  })
  return fails
}

const FUTURE = /(volta às|libera|próxima|consulta|consultar|previsto|esperado|liberad[oa]|tenta|amanhã|limite)/i

/** Past-event times must be <= now unless the context is a forecast; [data-future] subtrees are exempt. */
export function futureTimes(root: Element, nowMs: number, clock: Clock): string[] {
  // Durations like "03:45" count as clock times too; exempt them with [data-future].
  const text = visibleText(root, '[data-future]'), fails: string[] = []
  const nowDay = clock.dm(nowMs), np = clock.parts(nowMs), nowMin = np.h * 60 + np.mi
  const dayKey = (dm: string) => Number(dm.split('/')[1]) * 100 + Number(dm.split('/')[0])
  for (const m of text.matchAll(/(\d{2}\/\d{2})?[ ,]*(?:às |de )?\b(\d{2}):(\d{2})\b/g)) {
    const mins = Number(m[2]) * 60 + Number(m[3]), dm = m[1]
    const today = !dm || dm === nowDay
    const later = !!dm && dayKey(dm) > dayKey(nowDay)
    const c = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 4)
    if ((later || (today && mins > nowMin)) && !FUTURE.test(c)) {
      fails.push(`horário futuro ${m[0].trim()} em “${c.replace(/\s+/g, ' ')}”`)
    }
  }
  return fails
}

/** "sáb 24/10" must name the real weekday (year = the clock's year). */
export function weekdaysMatch(root: Element, clock: Clock): string[] {
  const text = visibleText(root), fails: string[] = [], y = clock.parts(clock.now).y
  for (const m of text.matchAll(/\b(dom|seg|ter|qua|qui|sex|sáb)\p{L}*,? (\d{2})\/(\d{2})/gu)) {
    const real = clock.weekdayShort(clock.sp(y, Number(m[3]), Number(m[2]), 12))
    if (real !== m[1]) fails.push(`${m[0]} é ${real}`)
  }
  return fails
}
