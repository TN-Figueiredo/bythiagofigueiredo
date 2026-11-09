import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { EXCECOES } from './helpers/views-excecoes'

const DIR = resolve(__dirname, '../../../supabase/migrations')

function normaliza(t: string): string {
  return t.toLowerCase().replace(/"/g, '').replace(/\s+/g, ' ')
}

/** Views sem security_invoker e mvs sem revoke de anon+authenticated, pelo texto das migrations (última definição vale). */
export function violacoes(dir: string): string[] {
  const texto = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    .map(f => normaliza(readFileSync(join(dir, f), 'utf8'))).join('\n;\n')
  const out: string[] = []

  const views = new Map<string, number>()
  for (const x of texto.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?(\w+)/g)) views.set(x[1]!, x.index!)
  const mvs = new Map<string, number>()
  for (const x of texto.matchAll(/create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/g)) mvs.set(x[1]!, x.index!)

  for (const [nome, pos] of views) {
    const dropado = [...texto.matchAll(/drop\s+view\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)/g)]
      .some(d => d[1] === nome && d.index! > pos)
    if (dropado) continue
    const ate = texto.indexOf(';', pos)
    const proprio = /security_invoker\s*=\s*(on|true)/.test(texto.slice(pos, ate < 0 ? undefined : ate))
    const alter = [...texto.matchAll(/alter\s+view\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)\s+set\s*\(\s*security_invoker\s*=?\s*(on|true)?/g)]
      .some(a => a[1] === nome && a.index! > pos)
    if (!proprio && !alter) out.push(nome)
  }

  for (const [nome, pos] of mvs) {
    const resto = texto.slice(pos)
    let anon = false, auth = false
    for (const r of resto.matchAll(/revoke\s+[^;]*?\s+on\s+(?:table\s+)?([^;]*?)\s+from\s+([^;]*)/g)) {
      if (!new RegExp(`(?:^|[\\s,])public\\.${nome}(?=[\\s,]|$)`).test(r[1]!)) continue
      if (/\banon\b/.test(r[2]!)) anon = true
      if (/\bauthenticated\b/.test(r[2]!)) auth = true
    }
    if (!(anon && auth)) out.push(nome)
  }
  return out.sort()
}

describe('supabase/migrations: views com security_invoker, mvs sem grant a anon/authenticated', () => {
  it('violações = EXCECOES', () => {
    expect(violacoes(DIR)).toEqual(Object.keys(EXCECOES).sort())
  })
  it('negativo: view sem invoker', () => {
    const t = mkdtempSync(join(tmpdir(), 'mig-vw-'))
    try {
      writeFileSync(join(t, '1_a.sql'), 'create view public.v1 as select 1;')
      expect(violacoes(t)).toEqual(['v1'])
    } finally { rmSync(t, { recursive: true, force: true }) }
  })
  it('negativo: nome entre aspas e maiúsculas sem invoker', () => {
    const t = mkdtempSync(join(tmpdir(), 'mig-vw-'))
    try {
      writeFileSync(join(t, '1_a.sql'), 'CREATE OR REPLACE VIEW "public"."V2" AS SELECT 1;')
      expect(violacoes(t)).toEqual(['v2'])
    } finally { rmSync(t, { recursive: true, force: true }) }
  })
  it('negativo: mv com revoke só de anon', () => {
    const t = mkdtempSync(join(tmpdir(), 'mig-vw-'))
    try {
      writeFileSync(join(t, '1_a.sql'), 'create materialized view public.m1 as select 1;\nrevoke all on public.m1 from anon;')
      expect(violacoes(t)).toEqual(['m1'])
    } finally { rmSync(t, { recursive: true, force: true }) }
  })
  it('positivo: invoker próprio, alter posterior e mv revogada', () => {
    const t = mkdtempSync(join(tmpdir(), 'mig-vw-'))
    try {
      writeFileSync(join(t, '1_a.sql'), 'create view public.a with (security_invoker = on) as select 1;\ncreate view public.b as select 1;\nalter view public.b set (security_invoker = on);\ncreate materialized view public.m as select 1;\nrevoke all on public.m from anon, authenticated;')
      expect(violacoes(t)).toEqual([])
    } finally { rmSync(t, { recursive: true, force: true }) }
  })
})
