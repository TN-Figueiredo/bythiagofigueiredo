// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn(), candidatos: vi.fn(), createNotification: vi.fn(), getSiteOwners: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@/lib/youtube/watch/alvos', async orig => ({ ...(await orig<typeof import('@/lib/youtube/watch/alvos')>()), lerCandidatosDaWatch: mocks.candidatos }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: (...a: unknown[]) => mocks.createNotification(...a) }))
vi.mock('@/lib/notifications/get-site-owners', () => ({ getSiteOwners: (...a: unknown[]) => mocks.getSiteOwners(...a), logSemDestinatario: vi.fn() }))

import { rodarPodaLeiturasWatch, FRASE_PROVA } from '@/lib/youtube/agenda/tarefas/poda-leituras-watch'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

const T0 = Date.UTC(2026, 9, 18, 9, 0, 0)
const SITE = '00000000-0000-4000-8000-000000000099'
const SITE2 = '00000000-0000-4000-8000-000000000098'
type Motivos = Record<string, boolean | null>
const motivos = (o: Motivos = {}): Motivos => ({ leitura_bloqueada: null, layout_mudou: null, rodadas_faltando: null, sem_alvos: null, capacidade_curta: null, oficial_sumiu: null, ...o })
const prova = (o: Motivos = {}, extra: Record<string, unknown> = {}) => ({
  candidatos_esperados: 100, alvos_ativos: 100, alvos_atrasados: 0, menos_de_3_rodadas_24h: 0, leituras_24h: 900, sem_oficial_sem_bloqueio_24h: 0,
  demanda_rodadas_dia: 700, capacidade_razao: 1.64, capacidade_rodadas_dia: 1152, concorrentes_30d: 120, por_erro: { indisponivel: 4 },
  primeira_leitura: new Date(T0 - 3 * 3_600_000).toISOString(), coleta_desde: new Date(T0 - 48 * 3_600_000).toISOString(),
  motivos: motivos(o), ...extra,
})
const cand = (siteId: string) => ({ siteId, ytId: 'v0000000001', tipo: 'concorrente', motivoAte: 'janela_concorrente', coletaAte: '', rodadasPorDia: 4 })

interface Chamada { nome: string; args: Record<string, unknown> }
function contexto(o: { poda?: Array<{ data: unknown; error?: { code: string } | null }>; prova?: { data: unknown; error?: { code: string } | null } | 'lanca'; existentes?: string[]; linhas?: Array<{ site_id: string }> } = {}) {
  const chamadas: Chamada[] = []
  const podas = [...(o.poda ?? [{ data: { leituras: 10, miniaturas: 2, alvos: 1, sobrou: false } }])]
  const sb = {
    rpc: (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ nome, args })
      return {
        abortSignal: () => {
          if (nome === 'yt_watch_poda') { const p = podas.length > 1 ? podas.shift()! : podas[0]!; return Promise.resolve({ data: p.data, error: p.error ?? null }) }
          if (o.prova === 'lanca') return Promise.reject(new Error('rede'))
          const p = o.prova ?? { data: prova() }
          return Promise.resolve({ data: p.data, error: p.error ?? null })
        },
      }
    },
    from: () => ({ select: () => ({ in: (_c: string, chaves: string[]) => Promise.resolve({ data: (o.existentes ?? []).filter(k => chaves.includes(k)).map(dedup_key => ({ dedup_key })), error: null }) }) }),
  }
  const c = { t0: T0, agora: () => T0 + 5_000, apiKey: '', sb: sb as never, linhas: (o.linhas ?? null) as never } satisfies ContextoTarefa
  return { c, chamadas }
}

beforeEach(() => {
  mocks.schema.mockReset().mockResolvedValue(null)
  mocks.candidatos.mockReset().mockResolvedValue({ valor: { candidatos: [cand(SITE)], testesVivos: new Set<string>() } })
  mocks.createNotification.mockReset().mockResolvedValue({ success: true, notificationId: 'n' })
  mocks.getSiteOwners.mockReset().mockResolvedValue([{ userId: 'u1', email: null }])
  process.env.OBS_WATCH_READ = 'on'
})
afterEach(() => { delete process.env.OBS_WATCH_READ })

const provaDe = (ch: Chamada[]) => ch.find(x => x.nome === 'yt_watch_prova')!

describe('poda_leituras_watch', () => {
  it('prova vermelha com coleta ligada: aviso leitura_watch_vermelha, poda ok e prova_vermelha_rodadas_faltando = 1', async () => {
    const { c } = contexto({ prova: { data: prova({ rodadas_faltando: true }, { menos_de_3_rodadas_24h: 7, alvos_atrasados: 2 }) } })
    const r = await rodarPodaLeiturasWatch(c)
    expect(r).toMatchObject({ estado: 'ok', feitas: 10, detalhe: { prova_vermelha_rodadas_faltando: 1, leituras_podadas: 10 } })
    expect(mocks.createNotification).toHaveBeenCalledTimes(1)
    const n = mocks.createNotification.mock.calls[0]![0]
    expect(n.dedup_key).toContain('leitura_watch_vermelha')
    expect(n.title).toBe('A leitura das páginas do YouTube está com problema')
    expect(n.message).toContain('9 vídeos sem as 3 rodadas do dia ou com rodada atrasada')
  })
  it('segunda execução do mesmo dia não repete o aviso (dedup_key diária)', async () => {
    const p = { data: prova({ layout_mudou: true }) }
    await rodarPodaLeiturasWatch(contexto({ prova: p }).c)
    const chave = mocks.createNotification.mock.calls[0]![0].dedup_key as string
    mocks.createNotification.mockClear()
    await rodarPodaLeiturasWatch(contexto({ prova: p, existentes: [chave] }).c)
    expect(mocks.createNotification).not.toHaveBeenCalled()
  })
  it('OBS_WATCH_READ apagada: p_coleta_ligada false, nenhum aviso, motivo nulo', async () => {
    delete process.env.OBS_WATCH_READ
    const { c, chamadas } = contexto()
    const r = await rodarPodaLeiturasWatch(c)
    expect(provaDe(chamadas).args.p_coleta_ligada).toBe(false)
    expect(r.estado).toBe('ok')
    expect(Object.keys(r.detalhe ?? {}).filter(k => k.startsWith('prova_vermelha_'))).toEqual([])
    expect(mocks.createNotification).not.toHaveBeenCalled()
  })
  it('zero alvos e candidatos > 0: o aviso vai para o site dos candidatos (e dos canais)', async () => {
    mocks.candidatos.mockResolvedValue({ valor: { candidatos: [cand(SITE)], testesVivos: new Set<string>() } })
    const { c } = contexto({ prova: { data: prova({ sem_alvos: true }, { alvos_ativos: 0, candidatos_esperados: 40 }) }, linhas: [{ site_id: SITE2 }] })
    await rodarPodaLeiturasWatch(c)
    const sites = mocks.createNotification.mock.calls.map(x => x[0].site_id).sort()
    expect(sites).toEqual([SITE, SITE2].sort())
    expect(mocks.createNotification.mock.calls[0]![0].message).toContain('há 40 vídeos na janela e só 0 na coleta')
  })
  it('Phil I9: a leitura dos candidatos falha: a prova recebe null (nunca 0), poda ok, candidatos_falhou = 1', async () => {
    mocks.candidatos.mockResolvedValue({ porque: 'x', causa: 'excecao' })
    const { c, chamadas } = contexto()
    const r = await rodarPodaLeiturasWatch(c)
    expect(provaDe(chamadas).args.p_candidatos_esperados).toBeNull()
    expect(r).toMatchObject({ estado: 'ok', detalhe: { candidatos_falhou: 1 } })
  })
  it('candidatos lidos: a prova recebe a contagem', async () => {
    const { c, chamadas } = contexto()
    await rodarPodaLeiturasWatch(c)
    expect(provaDe(chamadas).args.p_candidatos_esperados).toBe(1)
  })
  it('Phil I10 / Yannis M5: capacidade_curta acende o aviso e o detalhe tem folga_capacidade', async () => {
    const { c } = contexto({ prova: { data: prova({ capacidade_curta: true }, { demanda_rodadas_dia: 780, capacidade_razao: 1.48 }) } })
    const r = await rodarPodaLeiturasWatch(c)
    expect(r.detalhe).toMatchObject({ folga_capacidade: 1.48, prova_vermelha_capacidade_curta: 1 })
    expect(mocks.createNotification.mock.calls[0]![0].message).toContain('a demanda é de 780 rodadas por dia, perto do limite de 1.152')
  })
  it('r3: oficial_sumiu acende o aviso com a frase', async () => {
    const { c } = contexto({ prova: { data: prova({ oficial_sumiu: true }, { sem_oficial_sem_bloqueio_24h: 300, leituras_24h: 900 }) } })
    const r = await rodarPodaLeiturasWatch(c)
    expect(r.detalhe).toMatchObject({ prova_vermelha_oficial_sumiu: 1, sem_oficial_sem_bloqueio_24h: 300 })
    expect(mocks.createNotification.mock.calls[0]![0].message).toContain(FRASE_PROVA.oficial_sumiu({}))
  })
  it('r3: 100 % jogador_bloqueado e oficial nulo (o normal do Vercel) não acende aviso', async () => {
    const { c } = contexto({ prova: { data: prova({}, { jogador_bloqueado_24h: 900, sem_oficial_sem_bloqueio_24h: 0 }) } })
    const r = await rodarPodaLeiturasWatch(c)
    expect(r.estado).toBe('ok')
    expect(mocks.createNotification).not.toHaveBeenCalled()
  })
  it('r3: sem a variável o motivo oficial_sumiu vem nulo e não avisa', async () => {
    delete process.env.OBS_WATCH_READ
    const { c } = contexto({ prova: { data: prova({ oficial_sumiu: null }, { sem_oficial_sem_bloqueio_24h: 800 }) } })
    await rodarPodaLeiturasWatch(c)
    expect(mocks.createNotification).not.toHaveBeenCalled()
  })
  it('o motivo vermelho não muda o estado e várias frases se juntam com "; "', async () => {
    const { c } = contexto({ prova: { data: prova({ leitura_bloqueada: true, layout_mudou: true }) } })
    const r = await rodarPodaLeiturasWatch(c)
    expect(r.estado).toBe('ok')
    expect(mocks.createNotification.mock.calls[0]![0].message).toContain('falhou nas últimas 24 horas; mais de 20% das leituras não acharam o título')
  })
  it('detalhe: datas viram horas', async () => {
    const r = await rodarPodaLeiturasWatch(contexto().c)
    expect(r.detalhe).toMatchObject({ coleta_desde_horas: 48, primeira_leitura_horas: 3 })
    expect(r.detalhe).not.toHaveProperty('coleta_desde')
  })
  it('o RPC da prova lança: erro prova_falhou', async () => {
    expect(await rodarPodaLeiturasWatch(contexto({ prova: 'lanca' }).c)).toMatchObject({ estado: 'erro', motivo: 'prova_falhou', feitas: 10 })
  })
  it('o RPC da prova devolve erro: erro prova_falhou', async () => {
    expect(await rodarPodaLeiturasWatch(contexto({ prova: { data: null, error: { code: '57014' } } }).c)).toMatchObject({ estado: 'erro', motivo: 'prova_falhou' })
  })
  it('a poda devolve sobrou 3 vezes: parcial sobrou (e a prova ainda roda)', async () => {
    const { c, chamadas } = contexto({ poda: [{ data: { leituras: 5000, miniaturas: 0, alvos: 0, sobrou: true } }] })
    const r = await rodarPodaLeiturasWatch(c)
    expect(chamadas.filter(x => x.nome === 'yt_watch_poda')).toHaveLength(3)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'sobrou', feitas: 15000 })
    expect(chamadas.some(x => x.nome === 'yt_watch_prova')).toBe(true)
  })
  it('a poda para ao primeiro lote sem sobra', async () => {
    const { c, chamadas } = contexto()
    await rodarPodaLeiturasWatch(c)
    expect(chamadas.filter(x => x.nome === 'yt_watch_poda')).toHaveLength(1)
    expect(chamadas.find(x => x.nome === 'yt_watch_poda')!.args.p_lote).toBe(5000)
  })
  it('42P01 na guarda: parcial schema_ausente, sem RPC', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    const { c, chamadas } = contexto()
    expect(await rodarPodaLeiturasWatch(c)).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
    expect(chamadas).toHaveLength(0)
  })
  it('42P01 no RPC da poda: parcial schema_ausente', async () => {
    const { c } = contexto({ poda: [{ data: null, error: { code: '42P01' } }] })
    expect(await rodarPodaLeiturasWatch(c)).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
  })
  it('erro do banco na poda: erro banco_falhou, sem prova', async () => {
    const { c, chamadas } = contexto({ poda: [{ data: null, error: { code: '57014' } }] })
    expect(await rodarPodaLeiturasWatch(c)).toMatchObject({ estado: 'erro', motivo: 'banco_falhou' })
    expect(chamadas.some(x => x.nome === 'yt_watch_prova')).toBe(false)
  })
})
