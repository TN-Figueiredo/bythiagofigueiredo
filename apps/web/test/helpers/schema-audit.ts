/**
 * Extrator estático de `.from('tabela')` + colunas (select, filtros, order, insert/update/upsert)
 * e conferência contra `src/types/database.types.ts`.
 *
 * Existe porque uma tabela ou coluna inexistente NÃO derruba o servidor MCP: o supabase-js
 * devolve `{ data: null, error }`, o código descartava o `error` e o recurso saía vazio ou
 * "Unknown". O compilador não pega quando o cliente é tipado frouxo; este extrator pega.
 *
 * É heurístico (regex + balanceamento de parênteses), não um parser de TS: o que ele não
 * consegue resolver (`.from(variavel)`, `.insert(objetoDinamico)`) sai em `unresolved`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface SchemaTable { columns: Set<string> }
export type Schema = Map<string, SchemaTable>

export interface Ref {
  file: string
  line: number
  table: string
  /** null = só a tabela foi conferida. */
  column: string | null
  kind: string
  exists: boolean
}

export function loadSchema(typesPath: string): { schema: Schema; functions: Set<string> } {
  const src = readFileSync(typesPath, 'utf8')
  const schema: Schema = new Map()
  const lines = src.split('\n')
  let section: 'Tables' | 'Views' | 'Functions' | 'Other' = 'Other'
  let table: string | null = null
  let inRow = false
  const functions = new Set<string>()
  let seenPublic = false
  for (const line of lines) {
    if (/^  public: \{/.test(line)) seenPublic = true
    if (!seenPublic) continue
    if (/^    Tables: \{/.test(line)) { section = 'Tables'; continue }
    if (/^    Views: \{/.test(line)) { section = 'Views'; continue }
    if (/^    Functions: \{/.test(line)) { section = 'Functions'; continue }
    if (/^    (Enums|CompositeTypes): \{/.test(line)) { section = 'Other'; continue }
    if (/^  [A-Za-z_]+: \{/.test(line) && !/^  public/.test(line)) break
    if (section === 'Functions') {
      const m = /^      ([a-z0-9_]+): \{/.exec(line)
      if (m) functions.add(m[1])
      continue
    }
    if (section !== 'Tables' && section !== 'Views') continue
    const t = /^      ([a-z0-9_]+): \{$/.exec(line)
    if (t) { table = t[1]; schema.set(table, { columns: new Set() }); inRow = false; continue }
    if (/^        Row: \{$/.test(line)) { inRow = true; continue }
    if (inRow && /^        \}/.test(line)) { inRow = false; continue }
    if (inRow && table) {
      const c = /^          ([a-z0-9_]+)\??:/.exec(line)
      if (c) schema.get(table)!.columns.add(c[1])
    }
  }
  return { schema, functions }
}

export function listTs(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) listTs(p, out)
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/** Índice do `)` que fecha o `(` em `open`, ignorando strings. -1 se não achar. */
function matchParen(s: string, open: number, o = '(', c = ')'): number {
  let depth = 0
  let q: string | null = null
  for (let i = open; i < s.length; i++) {
    const ch = s[i]
    if (q) {
      if (ch === '\\') { i++; continue }
      if (ch === q) q = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue }
    if (ch === '/' && s[i + 1] === '/') { const n = s.indexOf('\n', i); i = n < 0 ? s.length : n; continue }
    if (ch === o) depth++
    else if (ch === c) { depth--; if (depth === 0) return i }
  }
  return -1
}

function splitTop(s: string, sep = ',', quoted = false): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  let q: string | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (q) { cur += ch; if (ch === '\\') { cur += s[++i] ?? '' } else if (ch === q) q = null; continue }
      if (ch === "'" || ch === '"' || ch === '`') { q = ch; cur += ch; continue }
    }
    if ('({['.includes(ch)) depth++
    if (')}]'.includes(ch)) depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

const stripString = (a: string): string | null => {
  const m = /^\s*(['"`])([\s\S]*)\1\s*$/.exec(a)
  if (!m) return null
  // template com interpolação não é resolvível
  if (m[1] === '`' && m[2].includes('${')) return null
  return m[2]
}

interface Item { table: string; column: string | null; kind: string }

/** Itens (tabela, coluna) de um select PostgREST, descendo nos embeds. */
export function parseSelect(sel: string, table: string, schema: Schema, kind = 'select'): Item[] {
  const out: Item[] = []
  for (const raw of splitTop(sel)) {
    const item = raw.replace(/\s+/g, ' ').trim()
    if (!item) continue
    const paren = item.indexOf('(')
    if (paren >= 0) {
      const head = item.slice(0, paren)
      const inner = item.slice(paren + 1, item.lastIndexOf(')'))
      // alias:rel!hint  |  rel!inner  |  rel
      let rel = head.includes(':') ? head.split(':').pop()! : head
      rel = rel.split('!')[0].trim()
      // `rel` pode ser o nome da tabela embutida OU o nome da coluna FK (rel!fk). Só conferimos
      // quando o nome é de tabela conhecida; senão registramos a relação para o relatório.
      out.push({ table, column: null, kind: `embed:${rel}` })
      if (schema.has(rel)) out.push(...parseSelect(inner, rel, schema, `${kind}>${rel}`))
      continue
    }
    let name = item.includes(':') && !item.includes('::') ? item.split(':').pop()! : item
    name = name.split('::')[0].split('->')[0].trim()
    if (name === '*' || name === '') continue
    out.push({ table, column: name, kind })
  }
  return out
}

const FILTERS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'overlaps', 'not', 'match', 'order', 'textSearch', 'filter'])
const WRITES = new Set(['insert', 'update', 'upsert'])

function objectKeys(lit: string): string[] | null {
  const body = lit.trim()
  if (!body.startsWith('{')) return null
  const inner = body.slice(1, body.lastIndexOf('}'))
  const keys: string[] = []
  let depth = 0
  let q: string | null = null
  let start = 0
  const parts: string[] = []
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue }
    if ('({['.includes(ch)) depth++
    else if (')}]'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1 }
  }
  parts.push(inner.slice(start))
  for (const p of parts) {
    const t = p.replace(/\/\/.*$/gm, '').trim()
    if (!t || t.startsWith('...')) continue
    const m = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*(?::|$)/.exec(t)
    if (m) keys.push(m[1] ?? m[2] ?? m[3])
  }
  return keys
}

/**
 * Keys of a payload variable: `const x = { a, b }` (or `let x: T = { ... }`) declared before the
 * call, plus later `x.c = ...` / `x['c'] = ...` assignments. null when the declaration is not an
 * object literal (spread of another object, `.map(...)`, parameter).
 */
function variableKeys(src: string, name: string, before: number): string[] | null {
  const head = src.slice(0, before)
  const decl = new RegExp(`(?:const|let)\\s+${name}\\b(?:\\s*:[^=\\n]+)?=\\s*\\{`, 'g')
  let last = -1
  for (const m of head.matchAll(decl)) last = m.index! + m[0].length - 1
  if (last < 0) return null
  const close = matchParen(src, last, '{', '}')
  if (close < 0) return null
  const keys = objectKeys(src.slice(last, close + 1)) ?? []
  const assign = new RegExp(`\\b${name}(?:\\.([A-Za-z_][A-Za-z0-9_]*)|\\[\\s*['"]([^'"]+)['"]\\s*\\])\\s*=[^=]`, 'g')
  for (const m of head.slice(last).matchAll(assign)) keys.push(m[1] ?? m[2])
  return keys
}

export function auditFile(path: string, root: string, schema: Schema, functions: Set<string>): { refs: Ref[]; unresolved: string[] } {
  const src = readFileSync(path, 'utf8')
  const file = relative(root, path)
  const refs: Ref[] = []
  const unresolved: string[] = []
  const lineOf = (i: number) => src.slice(0, i).split('\n').length
  // `const TASKS = 'youtube_intelligence_tasks'` / `const LINK_SELECT = `...``: resolve the
  // identifier used as a table or select argument.
  const consts = new Map<string, string>()
  for (const c of src.matchAll(/^(?:export )?const ([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*[^=\n]+)?\s*=\s*(['"`])((?:(?!\2)[\s\S])*)\2\s*(?:as const)?\s*$/gm)) {
    if (!(c[2] === '`' && c[3].includes('${'))) consts.set(c[1], c[3])
  }
  const str = (a: string): string | null => {
    const lit = stripString(a)
    if (lit !== null) return lit
    const id = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(a)
    return id && consts.has(id[1]) ? consts.get(id[1])! : null
  }

  const push = (idx: number, it: Item) => {
    const t = schema.get(it.table)
    const exists = it.column === null ? !!t : !!t && t.columns.has(it.column)
    refs.push({ file, line: lineOf(idx), table: it.table, column: it.column, kind: it.kind, exists })
  }

  for (const m of src.matchAll(/\.rpc\(\s*(['"`])([a-z0-9_]+)\1/g)) {
    refs.push({ file, line: lineOf(m.index!), table: `rpc:${m[2]}`, column: null, kind: 'rpc', exists: functions.has(m[2]) })
  }

  for (const m of src.matchAll(/\.from\(\s*([^)]*?)\s*\)/g)) {
    const arg = m[1]
    const idx = m.index!
    const lit = str(arg)
    if (lit === null) {
      // Array.from(x), Buffer.from(x), Object.fromEntries não casam (não são `.from(`+string)
      const before = src.slice(Math.max(0, idx - 12), idx)
      if (/(Array|Buffer|Uint8Array|Set|Map|Object)$/.test(before)) continue
      unresolved.push(`${file}:${lineOf(idx)} .from(${arg})`)
      continue
    }
    if (/^\s*$/.test(lit)) continue
    const table = lit
    push(idx, { table, column: null, kind: 'from' })
    // Percorre a cadeia: .metodo( ... ) encadeados logo depois do .from(...)
    let pos = idx + m[0].length
    for (;;) {
      const rest = src.slice(pos)
      const cm = /^\s*(?:\/\/[^\n]*\n\s*)*\.([A-Za-z]+)\s*(?:<[^>]*>)?\s*\(/.exec(rest)
      if (!cm) break
      const open = pos + cm[0].length - 1
      const close = matchParen(src, open)
      if (close < 0) break
      const method = cm[1]
      const args = src.slice(open + 1, close)
      const first = splitTop(args, ',', true)[0] ?? ''
      if (method === 'select') {
        const s = str(first)
        if (s !== null) for (const it of parseSelect(s, table, schema)) push(open, it)
        else if (first.trim()) unresolved.push(`${file}:${lineOf(open)} .select(${first.trim().slice(0, 40)})`)
      } else if (FILTERS.has(method)) {
        const s = stripString(first)
        if (s !== null) {
          if (method === 'filter' || method === 'not' || method === 'order' || FILTERS.has(method)) {
            // coluna de embed: `tabela.col`
            let col = s.split('->')[0].trim()
            let t = table
            if (col.includes('.') && schema.has(col.split('.')[0])) { t = col.split('.')[0]; col = col.split('.')[1] }
            else if (col.includes('.')) { pos = close + 1; continue }
            push(open, { table: t, column: col, kind: method })
          }
        }
      } else if (method === 'or') {
        const s = stripString(first)
        if (s !== null) {
          for (const cond of splitTop(s)) {
            const col = cond.trim().split('.')[0]
            if (col && !col.startsWith('and(') && !col.startsWith('or(')) push(open, { table, column: col, kind: 'or' })
          }
        }
      } else if (WRITES.has(method)) {
        let keys = objectKeys(first)
        const id = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(first)
        if (!keys && id) keys = variableKeys(src, id[1], open)
        if (keys) for (const k of keys) push(open, { table, column: k, kind: method })
        else if (first.trim().startsWith('[') || /^\s*\w+\s*$/.test(first)) unresolved.push(`${file}:${lineOf(open)} .${method}(${first.trim().slice(0, 40)})`)
        const oc = /onConflict:\s*(['"`])([^'"`]+)\1/.exec(args)
        if (oc) for (const c of oc[2].split(',')) push(open, { table, column: c.trim(), kind: 'onConflict' })
      }
      pos = close + 1
    }
  }
  return { refs, unresolved }
}

export function auditDirs(webRoot: string, dirs: string[]): { refs: Ref[]; unresolved: string[] } {
  const { schema, functions } = loadSchema(join(webRoot, 'src/types/database.types.ts'))
  const refs: Ref[] = []
  const unresolved: string[] = []
  for (const d of dirs) {
    for (const f of listTs(join(webRoot, d))) {
      const r = auditFile(f, webRoot, schema, functions)
      refs.push(...r.refs)
      unresolved.push(...r.unresolved)
    }
  }
  return { refs, unresolved }
}
