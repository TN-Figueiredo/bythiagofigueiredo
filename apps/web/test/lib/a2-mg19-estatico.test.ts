// @vitest-environment node
/**
 * A2 · MG19 (roda na CI, sem banco): a ÚLTIMA definição de can_view_site e o WHERE da última de user_accessible_sites
 * nas migrations têm de ser os da MG19. Mata uma migration futura que copie o corpo antigo de schema.sql.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(__dirname, '../../../../supabase/migrations')
const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

function ultimaDefinicao(nome: string): string {
  let ultimo = ''
  const re = new RegExp(`create or replace function\\s+"?public"?\\."?${nome}"?\\s*\\(`, 'i')
  for (const f of arquivos) {
    const t = readFileSync(join(DIR, f), 'utf8')
    let rest = t
    for (;;) {
      const m = re.exec(rest)
      if (!m) break
      const ini = m.index
      const fim = rest.indexOf('$$;', rest.indexOf('$$', ini) + 2)
      ultimo = rest.slice(ini, fim + 3)
      rest = rest.slice(fim + 3)
    }
  }
  return ultimo
}
const norm = (s: string) => s.replace(/"/g, '').replace(/\s+/g, ' ').toLowerCase()

describe('A2 MG19: definições vigentes nas migrations', () => {
  it('can_view_site termina em select public.can_edit_site(p_site_id)', () => {
    const d = norm(ultimaDefinicao('can_view_site'))
    expect(d).toContain('select public.can_edit_site(p_site_id)')
    expect(d).not.toContain('site_memberships')
  })
  it('user_accessible_sites filtra por can_view_observatorio', () => {
    const d = norm(ultimaDefinicao('user_accessible_sites'))
    expect(d).toContain('where public.can_view_observatorio(s.id)')
    expect(d).not.toContain('can_view_site(')
  })
})
