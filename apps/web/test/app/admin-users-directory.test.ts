// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveUserIdentities,
  userLabel,
} from '@/app/admin/(authed)/users/user-directory'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function makeService(opts: {
  rpc: { data: unknown; error: { code?: string } | null }
  gotrue?: Record<string, { email?: string; user_metadata?: Record<string, unknown> } | null>
}) {
  const rpc = vi.fn().mockResolvedValue(opts.rpc)
  const getUserById = vi.fn(async (id: string) => ({
    data: { user: opts.gotrue?.[id] ?? null },
    error: null,
  }))
  // O helper só usa rpc e auth.admin.getUserById.
  const service = { rpc, auth: { admin: { getUserById } } } as unknown as Parameters<
    typeof resolveUserIdentities
  >[0]
  return { service, rpc, getUserById }
}

describe('userLabel', () => {
  it('nome e e-mail quando há os dois', () => {
    expect(userLabel(A, { email: 'irma@example.com', name: 'Ana Figueiredo' })).toBe(
      'Ana Figueiredo · irma@example.com',
    )
  })
  it('só o e-mail quando não há nome', () => {
    expect(userLabel(A, { email: 'irma@example.com', name: null })).toBe('irma@example.com')
    expect(userLabel(A, { email: 'irma@example.com', name: '   ' })).toBe('irma@example.com')
  })
  it('UUID só como último recurso', () => {
    expect(userLabel(A, { email: null, name: 'Ana' })).toBe('Ana')
    expect(userLabel(A, { email: null, name: null })).toBe(A)
    expect(userLabel(A, { email: '', name: '' })).toBe(A)
    expect(userLabel(A, undefined)).toBe(A)
  })
})

describe('resolveUserIdentities', () => {
  it('uma leitura só pela RPC, com ids sem repetição, e nenhum getUserById quando ela resolve tudo', async () => {
    const { service, rpc, getUserById } = makeService({
      rpc: {
        data: [
          { user_id: A, email: 'a@example.com', display_name: 'Ana' },
          { user_id: B, email: 'b@example.com', display_name: null },
        ],
        error: null,
      },
    })
    const map = await resolveUserIdentities(service, [A, B, A])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('admin_user_directory', { p_user_ids: [A, B] })
    expect(getUserById).not.toHaveBeenCalled()
    expect(userLabel(A, map.get(A))).toBe('Ana · a@example.com')
    expect(userLabel(B, map.get(B))).toBe('b@example.com')
  })

  it('RPC ainda não aplicada no banco (PGRST202): cai em getUserById e ainda mostra e-mail', async () => {
    const { service, getUserById } = makeService({
      rpc: { data: null, error: { code: 'PGRST202' } },
      gotrue: {
        [A]: { email: 'a@example.com', user_metadata: { full_name: 'Ana F.' } },
        [B]: { email: 'b@example.com' },
      },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const map = await resolveUserIdentities(service, [A, B])
    warn.mockRestore()
    expect(getUserById).toHaveBeenCalledTimes(2)
    expect(userLabel(A, map.get(A))).toBe('Ana F. · a@example.com')
    expect(userLabel(B, map.get(B))).toBe('b@example.com')
  })

  it('só quem a RPC não devolveu vai ao getUserById; quem ninguém conhece fica com o UUID', async () => {
    const { service, getUserById } = makeService({
      rpc: { data: [{ user_id: A, email: 'a@example.com', display_name: null }], error: null },
      gotrue: { [B]: { email: 'b@example.com' }, [C]: null },
    })
    const map = await resolveUserIdentities(service, [A, B, C])
    expect(getUserById.mock.calls.map((c) => c[0]).sort()).toEqual([B, C])
    expect(userLabel(B, map.get(B))).toBe('b@example.com')
    expect(userLabel(C, map.get(C))).toBe(C)
  })

  it('getUserById que lança não derruba a tela', async () => {
    const { service, getUserById } = makeService({ rpc: { data: [], error: null } })
    getUserById.mockRejectedValue(new Error('gotrue down'))
    const map = await resolveUserIdentities(service, [A])
    expect(userLabel(A, map.get(A))).toBe(A)
  })

  it('lista vazia não consulta nada', async () => {
    const { service, rpc } = makeService({ rpc: { data: [], error: null } })
    expect((await resolveUserIdentities(service, [])).size).toBe(0)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('/admin/users usa o diretório nas duas listas e texto legível', () => {
  const src = readFileSync(
    join(__dirname, '../../src/app/admin/(authed)/users/page.tsx'),
    'utf8',
  )
  it('rótulo vem de userLabel para org admins e para membros de sites', () => {
    expect(src.match(/userLabel\(/g)?.length).toBe(2)
    expect(src).not.toMatch(/email:\s*data\.user\?\.email \?\? \(m\.user_id/)
  })
  it('as linhas não fixam cinza-escuro/azul/vermelho de tema claro (fundo do /admin é escuro)', () => {
    expect(src).not.toMatch(/text-gray-[5-9]00|text-blue-600|text-red-600/)
  })
})
