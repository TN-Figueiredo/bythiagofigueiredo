import { vi } from 'vitest'

type Row = Record<string, unknown>

export interface IFakeOwnerDb {
  sites?: Row[]
  organizations?: Row[]
  organization_members?: Row[]
}

export const OWNER_TABLES = new Set(['sites', 'organizations', 'organization_members'])

/** Org raiz + um org_admin: o cenário em que o aviso tem destinatário. */
export function rootOrgWithAdmin(siteId: string, userId = 'owner-1'): IFakeOwnerDb {
  return {
    sites: [{ id: siteId, org_id: `org-root-${siteId}` }],
    organizations: [{ id: `org-root-${siteId}`, parent_org_id: null }],
    organization_members: [{ org_id: `org-root-${siteId}`, user_id: userId, role: 'org_admin' }],
  }
}

/** Várias raízes de uma vez (testes com mais de um site). */
export function mergeDbs(...dbs: IFakeOwnerDb[]): IFakeOwnerDb {
  return {
    sites: dbs.flatMap((d) => d.sites ?? []),
    organizations: dbs.flatMap((d) => d.organizations ?? []),
    organization_members: dbs.flatMap((d) => d.organization_members ?? []),
  }
}

function builder(rows: Row[]) {
  const filters: Array<[string, unknown]> = []
  const run = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v))
  const b = {
    select: () => b,
    eq: (col: string, val: unknown) => {
      filters.push([col, val])
      return b
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(res),
  }
  return b
}

/**
 * Cliente falso das tabelas que getSiteOwners lê. `emails`: user_id → e-mail devolvido por
 * `auth.admin.getUserById`; a RPC `admin_user_directory` responde "não existe" (migration
 * 20261007000004 ainda fora de produção), como no banco hoje.
 */
export function fakeOwnerClient(db: IFakeOwnerDb, emails: Record<string, string | null> = {}) {
  const tables: Record<string, Row[]> = {
    sites: db.sites ?? [],
    organizations: db.organizations ?? [],
    organization_members: db.organization_members ?? [],
  }
  const getUserById = vi.fn(async (id: string) => ({
    data: { user: id in emails ? { id, email: emails[id], user_metadata: {} } : null },
    error: null,
  }))
  return {
    from: (table: string) => builder(tables[table] ?? []),
    rpc: vi.fn(async () => ({ data: null, error: { code: '42883', message: 'function does not exist' } })),
    auth: { admin: { getUserById } },
    getUserById,
  }
}
