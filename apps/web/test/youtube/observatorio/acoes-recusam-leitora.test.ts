// @vitest-environment node
/**
 * A5 · E17 passo 0 (MG11), Tarefa 7 (item 170, meio): quem só VÊ o desempenho privado (a "leitora") não escreve.
 * Percorre as ações EXPORTADAS dos três arquivos de ações do Observatório e prova que cada uma que escreve recusa a leitora
 * (sessão válida com direito de ver, sem direito de editar) sem tocar o banco nem a rede. Nenhum código de produção muda.
 *
 * Os mocks seguem o contrato da guarda: `requireSiteScope({ mode: 'edit' })` recusa a leitora (`insufficient_access`);
 * `mode: 'view'` a aceita. O degrau "administrar o site" é mocado como APROVADO de propósito (a pior hipótese: a leitora
 * administradora), para que quem recuse seja a guarda de edição e não a de administração.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LEITORA = '33333333-3333-4333-8333-333333333333'
const EDITORA = '44444444-4444-4444-8444-444444444444'
const SITE = 's1'

interface Chamada { tabela: string; metodo: string; args: unknown[] }

const estado = vi.hoisted(() => ({
  sessao: 'leitora' as 'leitora' | 'editora' | 'anonima', // quem está logada: só vê, edita, ou ninguém
  guardas: [] as string[],
  chamadas: [] as Array<{ tabela: string; metodo: string; args: unknown[] }>,
  fila: { ask: 0, cancel: 0 },
}))

const ESCRITA = new Set(['insert', 'update', 'upsert', 'delete', 'rpc'])

/** Qualquer cadeia de chamadas do cliente de serviço resolve para "nada encontrado"; as de escrita ficam registradas. */
function cadeia(tabela: string): unknown {
  return new Proxy(function () {}, {
    get: (_t, k) => {
      if (k === 'then') return (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 0 }).then(ok, ko)
      return (...args: unknown[]) => { estado.chamadas.push({ tabela, metodo: String(k), args }); return cadeia(tabela) }
    },
  })
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/server', () => ({ after: () => {} }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: async (a: { mode?: string }) => {
    estado.guardas.push(String(a.mode))
    if (estado.sessao === 'anonima') return { ok: false, reason: 'unauthenticated' }
    if (a.mode === 'edit') return estado.sessao === 'editora' ? { ok: true, user: { id: EDITORA } } : { ok: false, reason: 'insufficient_access' }
    return { ok: true, user: { id: estado.sessao === 'editora' ? EDITORA : LEITORA } }
  },
}))
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'admin-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 's1' }),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (tabela: string) => cadeia(tabela),
    rpc: (nome: string, ...args: unknown[]) => { estado.chamadas.push({ tabela: '(rpc)', metodo: 'rpc', args: [nome, ...args] }); return cadeia('(rpc)') },
  }),
}))
vi.mock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async () => { throw new Error('syncCompetitorChannel chamado por uma ação recusada') }) }))
vi.mock('@/lib/youtube/competitor-sync-guard', () => ({ syncSchemaBlock: async () => null }))
vi.mock('@/lib/pipeline/services/forja-queue', async () => {
  const real = await vi.importActual<typeof import('@/lib/pipeline/services/forja-queue')>('@/lib/pipeline/services/forja-queue')
  return {
    ...real,
    askReading: async () => { estado.fila.ask++; return { data: { ok: true, reason: null, results: [] } } },
    cancelReading: async () => { estado.fila.cancel++; return { data: { cancelled: true } } },
  }
})

import * as acoes from '@/app/cms/(authed)/youtube/competitors/actions'
import * as nichos from '@/app/cms/(authed)/youtube/competitors/niche-actions'
import * as forja from '@/app/cms/(authed)/youtube/competitors/forja-actions'

/** Cada ação exportada, com argumentos mínimos válidos e o que "recusar" quer dizer para o resultado dela. */
interface Entrada { arquivo: 'actions' | 'niche-actions' | 'forja-actions'; nome: string; chamar: () => Promise<unknown>; recusou: (r: unknown) => boolean }
const objeto = (r: unknown): Record<string, unknown> => (typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {})
const okFalso = (r: unknown): boolean => objeto(r).ok === false
const ocioso = (r: unknown): boolean => objeto(r).status === 'idle' && objeto(r).progress === 0 && objeto(r).error === null
const UUID = '55555555-5555-4555-8555-555555555555'

const ESCREVEM: Entrada[] = [
  { arquivo: 'actions', nome: 'addCompetitorChannel', chamar: () => acoes.addCompetitorChannel('@canalinventado'), recusou: okFalso },
  { arquivo: 'actions', nome: 'addChannelFromCanais', chamar: () => acoes.addChannelFromCanais({ channel: '@canalinventado', niche: 'viagem', videoLimit: 50 }), recusou: okFalso },
  { arquivo: 'actions', nome: 'removeCompetitorChannel', chamar: () => acoes.removeCompetitorChannel(UUID), recusou: okFalso },
  { arquivo: 'actions', nome: 'syncCompetitorNow', chamar: () => acoes.syncCompetitorNow(UUID), recusou: okFalso },
  { arquivo: 'actions', nome: 'toggleBookmark', chamar: () => acoes.toggleBookmark('1'), recusou: okFalso },
  { arquivo: 'actions', nome: 'toggleChangeBookmark', chamar: () => acoes.toggleChangeBookmark('chave-inventada'), recusou: okFalso },
  { arquivo: 'actions', nome: 'syncFullHistory', chamar: () => acoes.syncFullHistory(UUID), recusou: okFalso },
  { arquivo: 'actions', nome: 'updateVideoLimit', chamar: () => acoes.updateVideoLimit(UUID, 50), recusou: okFalso },
  { arquivo: 'actions', nome: 'unlockMoreChannels', chamar: () => acoes.unlockMoreChannels(), recusou: okFalso },
  { arquivo: 'actions', nome: 'syncCompetitorsNow', chamar: () => acoes.syncCompetitorsNow(), recusou: okFalso },
  { arquivo: 'actions', nome: 'pinVideo', chamar: () => acoes.pinVideo(UUID), recusou: okFalso },
  { arquivo: 'actions', nome: 'unpinVideo', chamar: () => acoes.unpinVideo(UUID), recusou: okFalso },
  { arquivo: 'niche-actions', nome: 'setChannelNiche', chamar: () => nichos.setChannelNiche(UUID, null), recusou: okFalso },
  { arquivo: 'niche-actions', nome: 'setOwnChannelNiche', chamar: () => nichos.setOwnChannelNiche(UUID, null), recusou: okFalso },
  { arquivo: 'forja-actions', nome: 'askForjaReading', chamar: () => forja.askForjaReading('temas', 'todos'), recusou: okFalso },
  { arquivo: 'forja-actions', nome: 'cancelForjaReading', chamar: () => forja.cancelForjaReading('temas', 'viagem'), recusou: okFalso },
]
/** As duas leituras que pedem edição (não escrevem, mas gastam cota ou mostram estado de sincronização). */
const LEITURAS_QUE_PEDEM_EDICAO: Entrada[] = [
  { arquivo: 'actions', nome: 'getSyncStatus', chamar: () => acoes.getSyncStatus(UUID), recusou: ocioso },
  { arquivo: 'actions', nome: 'getCompetitorRemovalImpactAction', chamar: () => acoes.getCompetitorRemovalImpactAction(UUID), recusou: okFalso },
]
/**
 * As EXCEÇÕES declaradas, com o motivo. As duas pedem só `mode: 'view'` de propósito:
 *  - getUserNiche: lê a preferência de nicho da própria pessoa (competitor_user_prefs, por user_id e site);
 *  - setUserNiche: grava SÓ a linha dela em competitor_user_prefs (a preferência é de quem vê, não do site).
 */
const EXCECOES = ['getUserNiche', 'setUserNiche'] as const

/** Os nomes que o teste conhece, por arquivo. Ação nova que ninguém classificou derruba o teste. */
const CLASSIFICADAS: Record<Entrada['arquivo'], string[]> = {
  actions: [...ESCREVEM, ...LEITURAS_QUE_PEDEM_EDICAO].filter((e) => e.arquivo === 'actions').map((e) => e.nome),
  'niche-actions': [...ESCREVEM.filter((e) => e.arquivo === 'niche-actions').map((e) => e.nome), ...EXCECOES],
  'forja-actions': ESCREVEM.filter((e) => e.arquivo === 'forja-actions').map((e) => e.nome),
}

const fetchEspiao = vi.fn(async () => { throw new Error('fetch chamado por uma ação recusada') })

function escritas(): Chamada[] {
  return estado.chamadas.filter((c) => ESCRITA.has(c.metodo))
}
async function resultadoDe(fn: () => Promise<unknown>): Promise<unknown> {
  try { return await fn() } catch (e) { return { lancou: e instanceof Error ? e.message : String(e) } }
}
const lancouRecusa = (r: unknown): boolean => /forbidden|unauthenticated/.test(String(objeto(r).lancou ?? ''))

beforeEach(() => {
  estado.sessao = 'leitora'
  estado.guardas.length = 0
  estado.chamadas.length = 0
  estado.fila.ask = 0
  estado.fila.cancel = 0
  fetchEspiao.mockClear()
  vi.stubGlobal('fetch', fetchEspiao)
})

describe('A5 E17 passo 0 (item 170): as ações do Observatório que escrevem recusam quem só vê', () => {
  it('a lista de ações exportadas é a escrita no teste (14 de actions.ts, 4 de niche-actions.ts, 2 de forja-actions.ts)', () => {
    expect(Object.keys(acoes).sort()).toEqual([...CLASSIFICADAS.actions].sort())
    expect(Object.keys(nichos).sort()).toEqual([...CLASSIFICADAS['niche-actions']].sort())
    expect(Object.keys(forja).sort()).toEqual([...CLASSIFICADAS['forja-actions']].sort())
    expect(CLASSIFICADAS.actions).toHaveLength(14)
    expect(CLASSIFICADAS['niche-actions']).toHaveLength(4)
    expect(CLASSIFICADAS['forja-actions']).toHaveLength(2)
  })

  it.each(ESCREVEM.map((e) => [e.nome, e] as const))('%s: chamada pela leitora, recusa e não toca o banco nem a rede', async (_nome, e) => {
    estado.sessao = 'leitora'
    const r = await resultadoDe(e.chamar)
    expect(e.recusou(r) || lancouRecusa(r), `${e.nome} devolveu ${JSON.stringify(r)}`).toBe(true)
    expect(estado.guardas, `${e.nome}: a guarda pedida`).toContain('edit')
    expect(escritas(), `${e.nome}: escrita no banco`).toEqual([])
    expect(fetchEspiao, `${e.nome}: chamada de rede`).not.toHaveBeenCalled()
    expect(estado.fila, `${e.nome}: fila da forja`).toEqual({ ask: 0, cancel: 0 })
  })

  it.each(LEITURAS_QUE_PEDEM_EDICAO.map((e) => [e.nome, e] as const))('%s: a leitura que pede edição também recusa a leitora', async (_nome, e) => {
    estado.sessao = 'leitora'
    const r = await resultadoDe(e.chamar)
    expect(e.recusou(r) || lancouRecusa(r), `${e.nome} devolveu ${JSON.stringify(r)}`).toBe(true)
    expect(estado.guardas).toContain('edit')
    expect(escritas()).toEqual([])
    // nenhuma consulta ao banco antes da guarda: a recusa vem antes do cliente de serviço ler qualquer linha do site
    expect(estado.chamadas, `${e.nome}: leu o banco depois de recusada`).toEqual([])
    expect(fetchEspiao).not.toHaveBeenCalled()
  })

  it('exceções declaradas, com o motivo: getUserNiche (leitura da preferência dela) e setUserNiche (grava só a linha dela em competitor_user_prefs); são exatamente duas', async () => {
    expect([...EXCECOES]).toEqual(['getUserNiche', 'setUserNiche'])
    estado.sessao = 'leitora'
    expect(await nichos.getUserNiche()).toBe('todos')
    expect(estado.guardas).toEqual(['view'])
    expect(escritas()).toEqual([])
    estado.guardas.length = 0
    estado.chamadas.length = 0
    expect(await nichos.setUserNiche('todos')).toEqual({ ok: true })
    expect(estado.guardas, 'pede só a guarda de ver').toEqual(['view'])
  })

  it('setUserNiche grava com o user_id da guarda e o site do contexto, e em nenhuma outra tabela', async () => {
    estado.sessao = 'leitora'
    await nichos.setUserNiche('todos')
    const gravadas = escritas()
    expect(gravadas).toHaveLength(1)
    expect(gravadas[0].tabela).toBe('competitor_user_prefs')
    expect(gravadas[0].metodo).toBe('upsert')
    expect(gravadas[0].args[0]).toMatchObject({ user_id: LEITORA, site_id: SITE, niche: 'todos' })
    expect(gravadas[0].args[1]).toEqual({ onConflict: 'user_id,site_id' })
    expect(fetchEspiao).not.toHaveBeenCalled()
  })

  it('sem sessão, todas recusam, as duas exceções incluídas', async () => {
    estado.sessao = 'anonima'
    for (const e of [...ESCREVEM, ...LEITURAS_QUE_PEDEM_EDICAO]) {
      const r = await resultadoDe(e.chamar)
      expect(e.recusou(r) || lancouRecusa(r), `${e.nome} sem sessão devolveu ${JSON.stringify(r)}`).toBe(true)
    }
    expect(await nichos.getUserNiche()).toBe('todos')
    expect(await nichos.setUserNiche('todos')).toEqual({ ok: false })
    expect(escritas()).toEqual([])
    expect(fetchEspiao).not.toHaveBeenCalled()
    expect(estado.fila).toEqual({ ask: 0, cancel: 0 })
  })

  it('controle: quem edita passa da guarda (ao menos uma ação por arquivo), para o teste não passar só por recusar tudo', async () => {
    estado.sessao = 'editora'
    // actions.ts: updateVideoLimit chega ao banco
    expect(await acoes.updateVideoLimit(UUID, 50)).toEqual({ ok: true })
    expect(escritas().map((c) => `${c.tabela}.${c.metodo}`)).toEqual(['competitor_channels.update'])
    // niche-actions.ts: setChannelNiche com nicho nulo chega à escrita (a linha não existe no espião, então devolve ok:false, mas escreveu)
    estado.chamadas.length = 0
    await nichos.setChannelNiche(UUID, null)
    expect(escritas().map((c) => `${c.tabela}.${c.metodo}`)).toEqual(['competitor_channels.update'])
    // forja-actions.ts: askForjaReading chega à fila
    await forja.askForjaReading('temas', 'todos')
    expect(estado.fila.ask).toBe(1)
    await forja.cancelForjaReading('temas', 'viagem')
    expect(estado.fila.cancel).toBe(1)
    expect(estado.guardas.every((m) => m === 'edit')).toBe(true)
  })
})
