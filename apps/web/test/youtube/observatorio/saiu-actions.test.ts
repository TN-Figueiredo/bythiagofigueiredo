// @vitest-environment node
/**
 * A5 · E9, Tarefa 9: as ações da fila (`_saiu/actions.ts`), os dados da página (`_saiu/dados.ts`) e a recusa de `pedirRemocaoCanal` e `apagarCanalSemGuardarAction` (trava E9, migrada da antiga `removeCompetitorChannel`).
 * Quem não administra NUNCA chega ao cliente de serviço (o mock registra a criação); o site vem do contexto, nunca do corpo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const UUID = '11111111-1111-4111-8111-111111111111'
interface Opcoes {
  admin?: boolean
  edit?: boolean
  schema?: string | null
  desfecho?: string
  n?: number
  ip?: string | null
  ua?: string | null
  canal?: { missing_since: string | null } | null
  videosEsperando?: number | null
  comentariosEsperando?: number | null
  falhaNaLeituraDoCanal?: boolean
}
interface Registro { leituras: Array<{ tabela: string; chamadas: unknown[][] }>; ordem: string[]; svc: Array<{ nome: string; args: unknown[] }>; tags: unknown[]; paths: unknown[]; lerFila: unknown[] }

const chain = (result: unknown, log?: unknown[][]): unknown => new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko) : (...a: unknown[]) => { log?.push([k, ...a]); return chain(result, log) }),
})

function montar(o: Opcoes = {}): Registro {
  const r: Registro = { leituras: [], ordem: [], svc: [], tags: [], paths: [], lerFila: [] }
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-ctx' }) }))
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async (siteId: string, acao: string) => { r.ordem.push(`admin:${siteId}`); return o.admin === false ? { ok: false, error: `Só quem administra o site pode ${acao}.` } : null },
    requireSiteAdminScope: async () => ({ ok: o.admin !== false, user: { id: 'u1' } }),
    siteAdminOnlyMessage: (a: string) => a,
    requireSiteAdminForRow: async () => ({ siteId: 'site-ctx' }),
  }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
    requireSiteScope: async (a: unknown) => { r.ordem.push('edit:' + JSON.stringify(a)); return o.edit === false ? { ok: false, reason: 'unauthenticated' } : { ok: true, user: { id: 'u1' } } },
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => { r.paths.push(a) }, revalidateTag: (...a: unknown[]) => { r.tags.push(a) } }))
  vi.doMock('next/server', () => ({ after: () => {} }))
  vi.doMock('next/headers', () => ({
    headers: async () => ({ get: (k: string) => (k === 'x-forwarded-for' ? (o.ip === undefined ? '203.0.113.9, 10.0.0.1' : o.ip) : k === 'user-agent' ? (o.ua === undefined ? 'ua-teste' : o.ua) : null) }),
  }))
  vi.doMock('@/lib/supabase/service', () => ({
    getSupabaseServiceClient: () => {
      r.ordem.push('service')
      return {
        from: (t: string) => {
          const log: unknown[][] = []
          r.leituras.push({ tabela: t, chamadas: log })
          if (t === 'competitor_channels') return chain(o.falhaNaLeituraDoCanal ? { data: null, error: { message: 'x' } } : { data: o.canal === null ? [] : [o.canal ?? { id: 'c1', missing_since: null }], error: null }, log)
          if (t === 'competitor_videos') return chain({ count: o.videosEsperando === undefined ? 0 : o.videosEsperando, error: null }, log)
          return chain({ count: o.comentariosEsperando === undefined ? 0 : o.comentariosEsperando, error: null }, log)
        },
      }
    },
  }))
  vi.doMock('@/lib/youtube/observatorio/saiu/schema', () => ({ schemaE9: async () => { r.ordem.push('schema'); return o.schema === undefined ? null : o.schema } }))
  const servico = (nome: string) => async (...args: unknown[]) => { r.svc.push({ nome, args: args.slice(1) }); return { desfecho: o.desfecho ?? 'apagado', n: o.n ?? 1 } }
  vi.doMock('@/lib/youtube/observatorio/saiu/responder', () => ({
    apagarVideo: servico('apagarVideo'), apagarCanal: servico('apagarCanal'), apagarComentarios: servico('apagarComentarios'), manter: servico('manter'),
    decidirVolta: servico('decidirVolta'), tentarDeNovo: servico('tentarDeNovo'), ignorarVoltaDoGrupo: servico('ignorarVoltaDoGrupo'),
  }))
  vi.doMock('@/lib/youtube/observatorio/saiu/ler-fila', () => ({ lerFila: async (...a: unknown[]) => { r.lerFila.push(a); return { estado: 'ok', fila: {} } } }))
  vi.doMock('@/lib/youtube/observatorio/saiu/contar', () => ({ contarFila: async () => 7 }))
  vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn() }))
  vi.doMock('@/lib/youtube/competitor-sync-guard', () => ({ syncSchemaBlock: async () => null }))
  vi.doMock('@/lib/youtube/observatorio/arquivo/remover', () => ({ pedirRemocao: async () => { r.ordem.push('remover'); return { ok: true, jaPedido: false } }, cancelarRemocao: async () => ({ ok: true, naoPedido: false, despausado: true }), apagarCanalSemGuardar: async () => { r.ordem.push('remover'); return { ok: true, videos: 1, miniaturasPendentes: 0, foraDoPrefixo: 0 } } }))
  return r
}
const acoes = async () => await import('@/app/cms/(authed)/youtube/competitors/_saiu/actions')
const dados = async () => await import('@/app/cms/(authed)/youtube/competitors/_saiu/dados')
const competitors = async () => await import('@/app/cms/(authed)/youtube/competitors/actions')

type Chamada = (a: Awaited<ReturnType<typeof acoes>>) => Promise<{ desfecho: string; codigo?: string; frase: string }>
const CINCO: Array<[string, Chamada]> = [
  ['manterItens', a => a.manterItens({ tipo: 'video', ids: [UUID] })],
  ['apagarItem', a => a.apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })],
  ['responderVolta', a => a.responderVolta({ itemId: 3, decisao: 'voltar' })],
  ['tentarApagarDeNovo', a => a.tentarApagarDeNovo({ itemId: 3 })],
  ['ignorarVoltaDoGrupo', a => a.ignorarVoltaDoGrupo({ itemIds: [1, 2] })],
]

beforeEach(() => { vi.restoreAllMocks() })

describe('A5 E9 T9: ações', () => {
  it.each(CINCO)('sem administrar: %s não cria o cliente de serviço e devolve sem_permissao', async (_n, chamar) => {
    const r = montar({ admin: false })
    const x = await chamar(await acoes())
    expect(x.desfecho).toBe('sem_permissao')
    expect(r.ordem).not.toContain('service')
    expect(r.svc).toEqual([])
  })

  it.each(CINCO)('sem sessão de edição: %s também recusa antes do cliente de serviço', async (_n, chamar) => {
    const r = montar({ edit: false })
    expect((await chamar(await acoes())).desfecho).toBe('sem_permissao')
    expect(r.ordem).not.toContain('service')
    expect(r.ordem[0]).toBe('admin:site-ctx')
  })

  it('a ordem: administra, edição (cms, edit), cliente de serviço, schema, serviço', async () => {
    const r = montar()
    await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    expect(r.ordem).toEqual(['admin:site-ctx', 'edit:' + JSON.stringify({ area: 'cms', siteId: 'site-ctx', mode: 'edit' }), 'service', 'schema'])
    expect(r.svc).toHaveLength(1)
  })

  it('entrada malformada não chega ao serviço (uuid inválido, id de comentário negativo, tipo desconhecido, lista com 501)', async () => {
    const r = montar()
    const a = await acoes()
    const lixo = [
      await a.apagarItem({ tipo: 'video', id: 'nao-e-uuid', palavra: 'APAGAR' }),
      await a.apagarItem({ tipo: 'comentarios', id: UUID, ids: [-1], palavra: 'APAGAR' }),
      await a.apagarItem({ tipo: 'comentarios', id: UUID, ids: [], palavra: 'APAGAR' }),
      await a.apagarItem({ tipo: 'foto' as never, id: UUID, palavra: 'APAGAR' }),
      await a.manterItens({ tipo: 'comentario', ids: [1.5] }),
      await a.manterItens({ tipo: 'video', ids: Array.from({ length: 501 }, () => UUID) }),
      await a.responderVolta({ itemId: 0, decisao: 'voltar' }),
      await a.responderVolta({ itemId: 1, decisao: 'talvez' as never }),
      await a.tentarApagarDeNovo({ itemId: -4 }),
      await a.ignorarVoltaDoGrupo({ itemIds: Array.from({ length: 501 }, (_, i) => i + 1) }),
      await a.ignorarVoltaDoGrupo({ itemIds: ['x' as never] }),
    ]
    for (const x of lixo) expect(x).toMatchObject({ desfecho: 'erro', codigo: 'resposta_inesperada' })
    expect(r.svc).toEqual([])
    expect(r.ordem).not.toContain('service')
  })

  it('schema ausente: erro com o código, sem chamar o serviço', async () => {
    const r = montar({ schema: 'A migration desta etapa ainda não foi aplicada no banco.' })
    const x = await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    expect(x).toMatchObject({ desfecho: 'erro', codigo: 'schema_ausente' })
    expect(x.frase).toContain('migration')
    expect(r.svc).toEqual([])
    expect(r.tags).toEqual([])
  })

  it.each(['apagado', 'apagando', 'mantido', 'respondido'])('desfecho %s muda o banco: invalida e revalida', async (desfecho) => {
    const r = montar({ desfecho })
    await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    expect(r.tags).toEqual([['observatorio:site-ctx', { expire: 0 }]])
    expect(r.paths).toEqual([['/cms/youtube/competitors', 'layout']])
  })

  it('m-2: resposta parcial (erro com n > 0) também invalida; erro com n = 0 não', async () => {
    const r = montar({ desfecho: 'erro', n: 2 })
    await (await acoes()).ignorarVoltaDoGrupo({ itemIds: [1, 2, 3] })
    expect(r.tags).toEqual([['observatorio:site-ctx', { expire: 0 }]])
    const z = montar({ desfecho: 'erro', n: 0 })
    await (await acoes()).ignorarVoltaDoGrupo({ itemIds: [1, 2, 3] })
    expect(z.tags).toEqual([])
  })

  it.each(['no_ar', 'forja_em_andamento', 'not_found', 'mudou', 'palavra_errada', 'erro', 'nada'])('desfecho %s não invalida', async (desfecho) => {
    const r = montar({ desfecho, n: 0 })
    await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    expect(r.tags).toEqual([])
    expect(r.paths).toEqual([])
  })

  it('IP: primeiro valor do cabeçalho; ausente vira nulo; agente cortado em 300', async () => {
    let r = montar()
    await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    expect((r.svc[0].args[0] as { ip: string | null; ua: string | null; siteId: string; actorId: string })).toEqual({ siteId: 'site-ctx', actorId: 'u1', ip: '203.0.113.9', ua: 'ua-teste' })
    r = montar({ ip: null, ua: 'x'.repeat(400) })
    await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    const ctx = r.svc[0].args[0] as { ip: string | null; ua: string | null }
    expect(ctx.ip).toBeNull()
    expect(ctx.ua).toHaveLength(300)
  })

  it('o site vem do contexto: um siteId falso no corpo é ignorado', async () => {
    const r = montar()
    await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR', siteId: 'site-do-vizinho' } as never)
    expect((r.svc[0].args[0] as { siteId: string }).siteId).toBe('site-ctx')
  })

  it('cada ação chama o serviço certo', async () => {
    const r = montar()
    const a = await acoes()
    await a.apagarItem({ tipo: 'canal', id: UUID, palavra: 'APAGAR' })
    await a.apagarItem({ tipo: 'comentarios', id: UUID, ids: [1, 2], palavra: 'APAGAR' })
    await a.manterItens({ tipo: 'comentario', ids: [1] })
    expect(r.svc.map(x => x.nome)).toEqual(['apagarCanal', 'apagarComentarios', 'manter'])
  })

  it('a frase da recusa da forja usa a janela da constante', async () => {
    montar({ desfecho: 'forja_em_andamento' })
    const x = await (await acoes()).apagarItem({ tipo: 'video', id: UUID, palavra: 'APAGAR' })
    expect(x.frase).toContain('30 minutos')
  })
})

describe('A5 E9 T9: dados da página', () => {
  it('abrirFila sem edição devolve sem_acesso sem cliente de serviço', async () => {
    const r = montar({ edit: false })
    expect(await (await dados()).abrirFila(10)).toEqual({ estado: 'sem_acesso' })
    expect(r.ordem).not.toContain('service')
    expect(r.lerFila).toEqual([])
  })

  it('podeResponder é falso para quem edita e não administra', async () => {
    const r = montar({ admin: false })
    await (await dados()).abrirFila(10)
    expect(r.lerFila).toHaveLength(1)
    expect((r.lerFila[0] as unknown[])[1]).toMatchObject({ siteId: 'site-ctx', mostrar: 10, podeResponder: false })
    const r2 = montar()
    await (await dados()).abrirFila(20)
    expect((r2.lerFila[0] as unknown[])[1]).toMatchObject({ mostrar: 20, podeResponder: true })
  })

  it('contarParaAAba: sem edição não é visível e não cria cliente; com edição devolve o número', async () => {
    const r = montar({ edit: false })
    expect(await (await dados()).contarParaAAba()).toEqual({ visivel: false })
    expect(r.ordem).not.toContain('service')
    montar()
    expect(await (await dados()).contarParaAAba()).toEqual({ visivel: true, n: 7 })
  })
})

describe('A5 E9 T9: a trava E9 vale para pedir e apagar sem guardar', () => {
  it('remover canal que está na fila recusa com a frase', async () => {
    const r = montar({ canal: { missing_since: '2026-10-10' } })
    expect(await (await competitors()).pedirRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'saiu_do_youtube', frase: 'Este canal saiu do YouTube: responda na aba Saíram do YouTube.' })
    expect(r.ordem).not.toContain('remover')
    expect(r.tags).toEqual([])
  })

  it('canal no ar segue como antes (chama o pedido da F1)', async () => {
    const r = montar()
    expect(await (await competitors()).pedirRemocaoCanal(UUID)).toEqual({ ok: true, jaPedido: false })
    expect(r.ordem).toContain('remover')
    // m-4 (portão 14/10): as duas contagens só olham os itens SEM decisão; sem o filtro, o mantido bloquearia a remoção
    for (const t of ['competitor_videos', 'competitor_video_comments']) {
      const lei = r.leituras.find(l => l.tabela === t)
      expect(lei?.chamadas, t).toContainEqual(['is', 'removal_decision', null])
    }
  })

  it('leitura que falha não apaga', async () => {
    const r = montar({ falhaNaLeituraDoCanal: true })
    expect(await (await competitors()).pedirRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'leitura', frase: 'Não deu para conferir o canal agora. Nada mudou. Tente de novo.' })
    expect(r.ordem).not.toContain('remover')
  })

  it('remover canal no ar com 2 vídeos e 1 comentário esperando recusa com "3 itens"', async () => {
    const r = montar({ videosEsperando: 2, comentariosEsperando: 1 })
    expect(await (await competitors()).pedirRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'itens_na_fila', frase: 'Este canal tem 3 itens esperando resposta na aba Saíram do YouTube: responda primeiro.' })
    expect(r.ordem).not.toContain('remover')
  })

  it('canal no ar só com item mantido é removido como antes (a contagem só olha os sem decisão)', async () => {
    const r = montar({ videosEsperando: 0, comentariosEsperando: 0 })
    expect(await (await competitors()).pedirRemocaoCanal(UUID)).toEqual({ ok: true, jaPedido: false })
    expect(r.ordem).toContain('remover')
  })

  it('contagem que falha não apaga', async () => {
    for (const o of [{ videosEsperando: null }, { comentariosEsperando: null }] as const) {
      const r = montar(o)
      expect(await (await competitors()).pedirRemocaoCanal(UUID)).toEqual({ ok: false, codigo: 'leitura', frase: 'Não deu para conferir o canal agora. Nada mudou. Tente de novo.' })
      expect(r.ordem).not.toContain('remover')
    }
  })

  it('apagar sem guardar passa pela mesma trava e não chama a F1', async () => {
    const r = montar({ canal: { missing_since: '2026-10-10' } })
    expect(await (await competitors()).apagarCanalSemGuardarAction(UUID, 'X')).toMatchObject({ ok: false, codigo: 'saiu_do_youtube' })
    expect(r.ordem).not.toContain('remover')
  })

  it('sem administrar: nada é lido', async () => {
    const r = montar({ admin: false })
    const x = await (await competitors()).pedirRemocaoCanal(UUID)
    expect(x.ok).toBe(false)
    expect(r.ordem).not.toContain('service')
  })
})
