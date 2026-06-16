const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/**
 * RFC-4180 CSV cell escaping + spreadsheet formula-injection hardening.
 * Cells beginning with =,+,-,@,TAB,CR are prefixed with a single quote so
 * Excel/Sheets treat them as text, not formulas. Always quoted when prefixed.
 */
export function escapeCsv(v: unknown): string {
  let s = String(v ?? '')
  const injects = s.length > 0 && FORMULA_PREFIXES.includes(s[0]!)
  if (injects) s = `'${s}`
  if (injects || s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
