import { describe, it, expect, vi } from 'vitest'
import { getSiteOwners, logSemDestinatario, SEM_DESTINATARIO } from '@/lib/notifications/get-site-owners'
import { fakeOwnerClient, rootOrgWithAdmin } from '../helpers/fake-owner-db'

type Client = Parameters<typeof getSiteOwners>[0]

describe('getSiteOwners', () => {
  it('devolve o org_admin da organização do site (raiz) com e-mail via getUserById quando a RPC não existe', async () => {
    const c = fakeOwnerClient(rootOrgWithAdmin('s1', 'u1'), { u1: 'dono@x.com' })
    const out = await getSiteOwners(c as unknown as Client, 's1')
    expect(out).toEqual([{ userId: 'u1', email: 'dono@x.com' }])
    expect(c.getUserById).toHaveBeenCalledWith('u1')
  })

  it('site em organização filha sobe para a raiz (parent_org_id nulo) e ignora admin da filha', async () => {
    const c = fakeOwnerClient(
      {
        sites: [{ id: 's1', org_id: 'org-filha' }],
        organizations: [
          { id: 'org-filha', parent_org_id: 'org-raiz' },
          { id: 'org-raiz', parent_org_id: null },
        ],
        organization_members: [
          { org_id: 'org-filha', user_id: 'filha-admin', role: 'org_admin' },
          { org_id: 'org-raiz', user_id: 'raiz-admin', role: 'org_admin' },
        ],
      },
      { 'raiz-admin': 'raiz@x.com' },
    )
    const out = await getSiteOwners(c as unknown as Client, 's1')
    expect(out).toEqual([{ userId: 'raiz-admin', email: 'raiz@x.com' }])
  })

  it('sem membros, sem site ou sem organização: lista vazia (nunca lança)', async () => {
    const semMembros = fakeOwnerClient({ ...rootOrgWithAdmin('s1'), organization_members: [] })
    expect(await getSiteOwners(semMembros as unknown as Client, 's1')).toEqual([])
    const semSite = fakeOwnerClient(rootOrgWithAdmin('s1'))
    expect(await getSiteOwners(semSite as unknown as Client, 'outro')).toEqual([])
    const quebrado = { from: () => { throw new Error('boom') } }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await getSiteOwners(quebrado as unknown as Client, 's1')).toEqual([])
  })

  it('e-mail indisponível não elimina o dono (aviso in-app ainda tem user_id)', async () => {
    const c = fakeOwnerClient(rootOrgWithAdmin('s1', 'u1'), {})
    expect(await getSiteOwners(c as unknown as Client, 's1')).toEqual([{ userId: 'u1', email: null }])
  })

  it('logSemDestinatario escreve um log estruturado com o evento sem_destinatario', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logSemDestinatario('rotina-x', 's1')
    const logged = JSON.parse(String(warn.mock.calls[0][0]))
    expect(logged).toMatchObject({ event: SEM_DESTINATARIO, routine: 'rotina-x', site_id: 's1' })
    warn.mockRestore()
  })
})
