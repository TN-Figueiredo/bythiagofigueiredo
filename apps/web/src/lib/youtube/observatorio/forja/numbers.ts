// THE canonical form of a number the forja may cite (R26/R30/R38). Line-for-line port of the forja worker's
// canonicaliser (~/Workspace/forja/ferramentas/docs/trilha/leituras_obs.py: _norm, _RE_NUM, _milhar, canonico, numeros).
// The site emits sent.numbers with it and the worker extracts the model's numbers with it: one rule on both sides.
//
// FORMA CANÔNICA (the exact form the site sends in sent.numbers):
//   [−]  minus sign U+2212, never the hyphen; "+" is not part of the token ("+12 pp" == "12 pp")
//   int  pt-BR thousands dot from 1.000 on ("1230" and "1.230" → "1.230")
//   ,dec comma decimals, digits as written ("8,2" != "8,20")
//   " mil" | " mi" | " bi"   scale after ONE ordinary space (NBSP becomes a space)
//   "×"  multiplier glued, always U+00D7 ("8,2x", "8,2 ×" → "8,2×")
//   "%"  glued ("−41 %" → "−41%");  " pp" after one space ("12pp" → "12 pp")
//   " h" hours after one space ("3h" and "3 h" → "3 h")
//   "º" / "ª" ordinal glued ("2º", "2o" → "2º"; "2ª", "2a" → "2ª"); "s" of a decade ("60s")
// On purpose: "1,5" alone is not "1,5 mil"; "8,2" is not "8,2×"; "41%" is not "−41%".

const SPECIAL_SPACES = /[\u00a0\u202f\u2009\u2007]/g
/** lower case, no accents, special spaces → space, U+2212 → '-' (the worker's _norm). */
export function normForNumbers(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').replace(SPECIAL_SPACES, ' ').replace(/−/g, '-').toLowerCase()
}

// Python's \w / \d / \s on str patterns are Unicode-aware: \w = letters, digits, marks, underscore.
const NW = '[^\\p{L}\\p{N}\\p{M}_]', D = '\\p{Nd}'
const RE_NUM = new RegExp(
  `(?<![\\p{L}\\p{N}\\p{M}_.,])(?:(?<sinal>-)(?=${D}))?(?<int>${D}{1,3}(?:\\.${D}{3})+|${D}+)(?:,(?<dec>${D}+))?` +
  `(?=${NW}|$|(?:x|pp|h|mil|mi|bi|o|a|s)(?![a-z0-9_]))` +
  `(?:(?<ord>[oas])(?![a-z0-9_])` +
  `|(?:\\s?(?<esc>mil|mi|bi)(?![a-z0-9_]))?` +
  `(?:\\s?(?<suf>×|x(?![a-z0-9_])|%|pp(?![a-z0-9_])|h(?![a-z0-9_])))?)`, 'gu')
const ORDINAL: Record<string, string> = { o: 'º', a: 'ª', s: 's' }
const MENOS = '−'

/** '1230' → '1.230'; '0041' stays as written (a leading zero is not a site number). */
function milhar(digitos: string): string {
  if (digitos.length <= 3 || digitos.startsWith('0')) return digitos
  const cabeca = digitos.length % 3 || 3
  let out = digitos.slice(0, cabeca)
  for (let k = cabeca; k < digitos.length; k += 3) out += '.' + digitos.slice(k, k + 3)
  return out
}
function canonico(g: Record<string, string | undefined>): string {
  let t = (g.sinal ? MENOS : '') + milhar(g.int!.replace(/\./g, ''))
  if (g.ord) return t + (g.dec ? ',' + g.dec : '') + ORDINAL[g.ord]
  if (g.dec !== undefined) t += ',' + g.dec
  if (g.esc) t += ' ' + g.esc
  const suf = g.suf
  if (suf === '×' || suf === 'x') t += '×'
  else if (suf === '%') t += '%'
  else if (suf === 'pp') t += ' pp'
  else if (suf === 'h') t += ' h'
  return t
}

/** Canonical number tokens of a text, in order of appearance (duplicates kept). The worker's numeros() is their set. */
export function canonicalNumberTokens(text: string | null | undefined): string[] {
  if (!text) return []
  return [...normForNumbers(String(text)).matchAll(RE_NUM)].map(m => canonico(m.groups as Record<string, string | undefined>))
}
/** The canonical form of ONE number token ("8,2x" → "8,2×", "1,5 mil" with an NBSP → "1,5 mil", "-41%" → "−41%"); '' when it holds none. */
export function normalizeNumberToken(s: string): string {
  return canonicalNumberTokens(s)[0] ?? ''
}
