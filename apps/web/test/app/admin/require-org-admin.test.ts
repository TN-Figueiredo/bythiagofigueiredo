// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }))

import { requireOrgAdmin } from '@/app/admin/(authed)/_lib/require-org-admin'

const ORG = '11111111-1111-4111-8111-111111111111'

function clientReturning(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result)
  return { rpc }
}

describe('requireOrgAdmin (guarda das páginas de /admin)', () => {
  beforeEach(() => {
    redirectMock.mockClear()
  })

  it('pergunta por is_org_admin com a organização do contexto e deixa passar quando é true', async () => {
    const client = clientReturning({ data: true, error: null })
    await expect(requireOrgAdmin(client, ORG)).resolves.toBeUndefined()
    expect(client.rpc).toHaveBeenCalledWith('is_org_admin', { p_org_id: ORG })
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it.each([
    ['false', { data: false, error: null }],
    ['null', { data: null, error: null }],
    ["a string 'org_admin' (retorno de org_role, não de is_org_admin)", { data: 'org_admin', error: null }],
    ['erro de RPC (ex.: 54001 stack depth)', { data: null, error: { code: '54001' } }],
    ['erro de RPC mesmo com data true', { data: true, error: { code: 'PGRST301' } }],
  ])('falha fechado e manda para /cms quando a resposta é %s', async (_label, result) => {
    await expect(requireOrgAdmin(clientReturning(result), ORG)).rejects.toThrow('NEXT_REDIRECT:/cms')
    expect(redirectMock).toHaveBeenCalledWith('/cms')
  })
})

// Catraca: `org_role` recursava na policy de organization_members (54001) e as
// páginas que autorizavam por ela redirecionavam o próprio dono. Nenhuma página
// ou ação de /admin volta a chamá-la.
describe('nenhum arquivo de /admin autoriza por org_role', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return walk(full)
      return /\.tsx?$/.test(name) ? [full] : []
    })
  }
  const root = join(__dirname, '../../../src/app/admin')
  const files = walk(root)

  it('encontra os arquivos de /admin', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it("não há rpc('org_role') em src/app/admin", () => {
    const offenders = files.filter((f) => /rpc\(\s*['"]org_role['"]/.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => f.slice(root.length))).toEqual([])
  })

  it.each(['users/[user_id]/edit/page.tsx', 'sites/page.tsx', 'audit/page.tsx'])(
    '(authed)/%s usa o guard requireOrgAdmin',
    (rel) => {
      const src = readFileSync(join(root, '(authed)', rel), 'utf8')
      expect(src).toMatch(/await requireOrgAdmin\(userClient, ctx\.orgId\)/)
    },
  )
})
