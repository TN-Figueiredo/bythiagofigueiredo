import { MINUS } from './time'

/** Port of dados.js:598-613 and 1293-1320. */
export const stripUtm = (s: string): string =>
  s.replace(/([?&])utm_[a-z]+=[^&\s]*/gi, '$1').replace(/[?&]+(?=\s|$)/g, '').replace(/\?&/g, '?')

export interface DiffLine { op: 'ctx' | 'add' | 'rem' | 'utm'; text: string; from?: string }
export interface LineDiff { lines: DiffLine[]; add: number; rem: number; utm: number; label: string }
export function diffLines(a: string[], b: string[]): LineDiff {
  const A = a.map(stripUtm), Bn = b.map(stripUtm), n = a.length, m = b.length
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = A[i] === Bn[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  const ops: DiffLine[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (A[i] === Bn[j]) { ops.push(a[i] === b[j] ? { op: 'ctx', text: b[j]! } : { op: 'utm', from: a[i]!, text: b[j]! }); i++; j++ }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) ops.push({ op: 'rem', text: a[i++]! })
    else ops.push({ op: 'add', text: b[j++]! })
  }
  while (i < n) ops.push({ op: 'rem', text: a[i++]! })
  while (j < m) ops.push({ op: 'add', text: b[j++]! })
  const add = ops.filter(o => o.op === 'add' && o.text.trim()).length
  const rem = ops.filter(o => o.op === 'rem' && o.text.trim()).length
  const utm = ops.filter(o => o.op === 'utm').length
  return { lines: ops, add, rem, utm, label: '+' + add + ' ' + MINUS + rem + ' linhas' + (utm ? ' + ' + utm + ' UTM' : '') }
}

export type TitleOp = 'keep' | 'rem' | 'add' | 'move' | 'case'
export interface TitleSpan { text: string; op: TitleOp; label?: string | null }
export interface TitleDiff {
  before: TitleSpan[]; after: TitleSpan[]; full: boolean; keptWords: number; caseChanges: string[]; hasCaseChange: boolean
  labels: Record<TitleOp, string | null>; removed: string[]; added: string[]
}
export function titleDiff(a: string, b: string): TitleDiff {
  const tok = (s: string) => s.split(/(\s+)/).filter(x => x.length)
  const A = tok(a), B = tok(b), norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'")
  const n = A.length, m = B.length
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = norm(A[i]!) === norm(B[j]!) ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  const before: TitleSpan[] = [], after: TitleSpan[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (norm(A[i]!) === norm(B[j]!)) {
      const cs = A[i] !== B[j] && A[i]!.trim() !== ''
      before.push({ text: A[i]!, op: cs ? 'case' : 'keep' }); after.push({ text: B[j]!, op: cs ? 'case' : 'keep' }); i++; j++
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) before.push({ text: A[i++]!, op: 'rem' })
    else after.push({ text: B[j++]!, op: 'add' })
  }
  while (i < n) before.push({ text: A[i++]!, op: 'rem' })
  while (j < m) after.push({ text: B[j++]!, op: 'add' })
  // a word present in both titles (ignoring case, accents, punctuation, possessive) neither left nor entered: it moved or changed case
  const w = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]s\b/g, '').replace(/[^a-z0-9$]+/g, '')
  const bag = (arr: TitleSpan[]) => arr.filter(x => /\S/.test(x.text)).map(x => ({ x, k: w(x.text) })).filter(o => o.k)
  const raw = (t: string) => t.replace(/[^\p{L}\p{N}$]+/gu, '')
  // by occurrence count: only min(before, after) occurrences of the same word become move/case; the rest stay rem/add
  const fix = (mine: TitleSpan[], others: TitleSpan[], op: 'rem' | 'add') => {
    const avail: Record<string, { x: TitleSpan; k: string }[]> = {}
    bag(others).forEach(p => { (avail[p.k] = avail[p.k] || []).push(p) })
    bag(mine).filter(o => o.x.op !== op).forEach(o => { const q = avail[o.k]; if (q && q.length) q.shift() })
    bag(mine).forEach(o => {
      if (o.x.op !== op) return
      const q = avail[o.k]; if (!q || !q.length) return
      const hit = q.shift()!
      o.x.op = raw(hit.x.text) !== raw(o.x.text) && raw(hit.x.text).toLowerCase() === raw(o.x.text).toLowerCase() ? 'case' : 'move'
    })
  }
  fix(before, after, 'rem'); fix(after, before, 'add')
  const OPL: Record<TitleOp, string | null> = { keep: null, rem: 'saiu', add: 'entrou', move: 'mudou de lugar', case: 'só maiúsculas/minúsculas' }
  const merge = (arr: TitleSpan[]) => arr.reduce<TitleSpan[]>((o, x) => {
    const last = o[o.length - 1]
    if (last && last.op === x.op) last.text += x.text
    else if (/^\s+$/.test(x.text) && last) last.text += x.text
    else o.push({ text: x.text, op: x.op, label: OPL[x.op] })
    return o
  }, [])
  const kept = before.filter(x => (x.op === 'keep' || x.op === 'case' || x.op === 'move') && /\w/.test(x.text)).length
  const caseOnly = after.filter(x => x.op === 'case').map(x => x.text.trim())
  return {
    before: merge(before), after: merge(after), full: kept === 0, keptWords: kept, caseChanges: caseOnly, hasCaseChange: caseOnly.length > 0, labels: OPL,
    removed: before.filter(x => x.op === 'rem' && /\S/.test(x.text)).map(x => x.text.trim()),
    added: after.filter(x => x.op === 'add' && /\S/.test(x.text)).map(x => x.text.trim()),
  }
}
