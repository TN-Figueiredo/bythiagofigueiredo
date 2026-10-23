// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sentry: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: mocks.sentry, captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { enviarAvisosDaLeitura } from '@/lib/youtube/teste-youtube/observados/avisos'
import { criarBanco, type Linha, type OpcoesBanco } from '../registro/banco-falso'

const SITE = '00000000-0000-4000-8000-000000000001'
const AGORA = new Date('2026-10-23T12:00:00Z') // D = 2026-10-22 (03:00Z a 03:00Z)
const DIA = 86_400_000
const ON = { OBS_TROCAS_CONCORRENTE: 'on' } as NodeJS.ProcessEnv
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
const fanOk = { total: 1, sent: 1, suppressed: 0, errors: [] as string[] }
const fanZero = { total: 0, sent: 0, suppressed: 0, errors: [] as string[] }
const sempre = (b: boolean) => () => b

interface Cfg {
  alvos?: number
  /** Leituras por alvo no dia (D = 22/10) e no dia anterior (D-1 = 21/10). */
  porAlvoD?: number
  porAlvoD1?: number
  /** Quantas leituras de D ficam sem título. */
  semTituloD?: number
  /** Título comum às leituras de todos os alvos (placeholder) em D. */
  tituloComum?: string
  notificacoes?: Linha[]
}
function mundo(c: Cfg = {}): Record<string, Linha[]> {
  const n = c.alvos ?? 10
  const t: Record<string, Linha[]> = {
    yt_watch_alvos: [], yt_watch_readings: [], competitor_channels: [{ id: 'ch1', site_id: SITE, removal_requested_at: null }], competitor_videos: [], notifications: c.notificacoes ?? [],
  }
  let id = 0, ruins = c.semTituloD ?? 0
  const inicioD = Date.parse('2026-10-22T03:00:00Z')
  for (let i = 1; i <= n; i++) {
    t.yt_watch_alvos!.push({ id: i, site_id: SITE, youtube_video_id: yt(i), tipo: 'concorrente', saiu_em: null })
    t.competitor_videos!.push({ video_id: yt(i), competitor_channel_id: 'ch1', published_at: '2026-10-10T00:00:00.000Z' })
    for (const [base, qtd, dia] of [[inicioD, c.porAlvoD ?? 6, 'D'], [inicioD - DIA, c.porAlvoD1 ?? 6, 'D1']] as const) {
      for (let k = 0; k < qtd; k++) {
        const ruim = dia === 'D' && ruins > 0 ? (ruins--, true) : false
        t.yt_watch_readings!.push({
          id: ++id, site_id: SITE, youtube_video_id: yt(i), rodada_id: `r-${i}-${dia}-${k}`, lida_em: new Date(base + (k + 1) * 60_000).toISOString(), http: 200, erro: null,
          jogador_bloqueado: false, idioma: 'pt', titulo_exibido: ruim ? null : dia === 'D' && c.tituloComum ? c.tituloComum : `Titulo ${i}`,
        })
      }
    }
  }
  return t
}
const aberta = (dedup: string): Linha => ({ id: 'n-' + dedup, site_id: SITE, domain: 'youtube', dedup_key: dedup, expired_at: null })
const rodar = (t: Record<string, Linha[]>, fanOut: ReturnType<typeof vi.fn>, o: { agora?: Date; semTempo?: () => boolean; env?: NodeJS.ProcessEnv; banco?: OpcoesBanco } = {}) => {
  const b = criarBanco(t, o.banco)
  return { b, fim: enviarAvisosDaLeitura(b.sb as never, o.agora ?? AGORA, { semTempo: o.semTempo ?? sempre(false), fanOut: fanOut as never, env: o.env ?? ON }) }
}
const chaves = (f: ReturnType<typeof vi.fn>): string[] => f.mock.calls.map(c => (c[0] as { dedupKey: string }).dedupKey)
const abertas = (t: Record<string, Linha[]>): string[] => t.notifications!.filter(n => n.expired_at === null).map(n => n.dedup_key as string)

beforeEach(() => { mocks.sentry.mockClear() })

describe('enviarAvisosDaLeitura: aviso de degradação', () => {
  it('flag off: nenhuma consulta', async () => {
    const t = mundo({ porAlvoD: 0 })
    const f = vi.fn().mockResolvedValue(fanOk)
    const { b, fim } = rodar(t, f, { env: {} as NodeJS.ProcessEnv })
    expect(await fim).toMatchObject({ ativo: false })
    expect(b.pedidos).toHaveLength(0)
    expect(f).not.toHaveBeenCalled()
  })
  it('dia sem leitura: dispara sem_leitura com a chave do dia; 2x no mesmo dia = 1 chave', async () => {
    const t = mundo({ porAlvoD: 0 })
    const f = vi.fn().mockResolvedValue(fanOk)
    await rodar(t, f).fim
    await rodar(t, f).fim
    expect(new Set(chaves(f))).toEqual(new Set(['obs-degradada:2026-10-22']))
    const arg = f.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).toMatchObject({ siteId: SITE, domain: 'youtube', type: 'youtube.obs_degradada', priority: 2, title: 'Leitura dos concorrentes degradada', actionHref: '/cms/youtube/competitors', payload: { condicao: 'sem_leitura' } })
    expect(String(arg.message)).toContain('parada ontem')
    expect(String(arg.message)).not.toContain('2º dia seguido')
  })
  it('dois dias seguidos: 2 chaves, 2º texto com "2º dia seguido" e o aberto de D-1 expira', async () => {
    const t = mundo({ porAlvoD: 0, notificacoes: [aberta('obs-degradada:2026-10-22'), aberta('obs-titulo-suspenso:2026-10-22')] })
    const f = vi.fn().mockResolvedValue(fanOk)
    await rodar(t, f).fim
    const r = await rodar(t, f, { agora: new Date(AGORA.getTime() + DIA) }).fim
    expect(chaves(f)).toEqual(['obs-degradada:2026-10-22', 'obs-degradada:2026-10-23'])
    expect(String((f.mock.calls[0]![0] as { message: string }).message)).not.toContain('2º dia seguido')
    expect(String((f.mock.calls[1]![0] as { message: string }).message)).toContain('2º dia seguido: é o gatilho')
    expect(abertas(t)).not.toContain('obs-degradada:2026-10-22')
    expect(r.expirados).toBeGreaterThan(0)
  })
  it('dia abaixo do limiar: expira os obs-degradada abertos, e nenhum aviso', async () => {
    const t = mundo({ notificacoes: [aberta('obs-degradada:2026-10-21'), aberta('obs-degradada:2026-10-20'), aberta('outra:x')] })
    const f = vi.fn().mockResolvedValue(fanOk)
    const r = await rodar(t, f).fim
    expect(f).not.toHaveBeenCalled()
    expect(abertas(t)).toEqual(['outra:x'])
    expect(r).toMatchObject({ ativo: true, degradada: 0, expirados: 2 })
  })
  it('sem_titulo (acima de 20%) leva o literal do §6.1', async () => {
    const t = mundo({ semTituloD: 15 }) // 15 de 60 = 25%
    const f = vi.fn().mockResolvedValue(fanOk)
    await rodar(t, f).fim
    expect(String((f.mock.calls[0]![0] as { message: string }).message)).toContain('25% das leituras sem título')
    expect(f.mock.calls[0]![0]).toMatchObject({ payload: { condicao: 'sem_titulo' } })
  })
  it('fan.total === 0 vai ao Sentry', async () => {
    const f = vi.fn().mockResolvedValue(fanZero)
    await rodar(mundo({ porAlvoD: 0 }), f).fim
    expect(mocks.sentry).toHaveBeenCalled()
  })
})

describe('enviarAvisosDaLeitura: título suspenso', () => {
  it('título repetido em 3 vídeos: aviso com a contagem de vídeos; no 1º dia sem suspensos o aberto expira', async () => {
    const t = mundo({ porAlvoD: 1, tituloComum: 'Mesmo titulo placeholder', notificacoes: [aberta('obs-titulo-suspenso:2026-10-21')] })
    const f = vi.fn().mockResolvedValue(fanOk)
    const r = await rodar(t, f).fim
    const susp = f.mock.calls.map(c => c[0] as { type: string; message: string; dedupKey: string }).find(x => x.type === 'youtube.obs_titulo_suspenso')!
    expect(susp.dedupKey).toBe('obs-titulo-suspenso:2026-10-22')
    expect(susp.message).toContain('suspensa ontem em 10 vídeos')
    expect(r.suspenso).toBe(1)
    expect(abertas(t)).not.toContain('obs-titulo-suspenso:2026-10-21')
    // dia seguinte, sem repetição em D: o de 22/10 aberto expira
    t.notifications!.push(aberta('obs-titulo-suspenso:2026-10-22'))
    const g = vi.fn().mockResolvedValue(fanOk)
    await rodar(t, g, { agora: new Date(AGORA.getTime() + DIA) }).fim
    expect(g.mock.calls.map(c => (c[0] as { type: string }).type)).not.toContain('youtube.obs_titulo_suspenso')
    expect(abertas(t)).not.toContain('obs-titulo-suspenso:2026-10-22')
  })
  it('disparar D expira o aberto de D-1 (idem obs-titulo-suspenso)', async () => {
    const t = mundo({ porAlvoD: 1, tituloComum: 'Mesmo titulo placeholder', notificacoes: [aberta('obs-titulo-suspenso:2026-10-21')] })
    // as leituras de "D" (22/10) viram o dia anterior à 2ª rodada; para D=23/10 duplicamos as leituras no dia 23
    for (const l of [...t.yt_watch_readings!]) t.yt_watch_readings!.push({ ...l, id: (l.id as number) + 1000, rodada_id: 'x' + String(l.rodada_id), lida_em: new Date(Date.parse(l.lida_em as string) + DIA).toISOString() })
    const f = vi.fn().mockResolvedValue(fanOk)
    await rodar(t, f, { agora: new Date(AGORA.getTime() + DIA) }).fim
    expect(chaves(f)).toContain('obs-titulo-suspenso:2026-10-23')
    expect(abertas(t)).not.toContain('obs-titulo-suspenso:2026-10-21')
  })
})

describe('enviarAvisosDaLeitura: nunca avalia com dado parcial (foco 6)', () => {
  it('2ª página com erro: lança, nenhum fanOut, nenhuma expiração', async () => {
    const t = mundo({ porAlvoD: 120, notificacoes: [aberta('obs-degradada:2026-10-21')] }) // 1200 leituras de D = 2 páginas
    const f = vi.fn().mockResolvedValue(fanOk)
    const { b, fim } = rodar(t, f, { banco: { falhar: p => (p.tabela === 'yt_watch_readings' && p.faixa?.[0] === 1000 ? { message: 'x' } : null) } })
    await expect(fim).rejects.toThrow()
    expect(f).not.toHaveBeenCalled()
    expect(b.pedidos.filter(p => p.tabela === 'notifications' && p.op === 'update')).toHaveLength(0)
    expect(abertas(t)).toEqual(['obs-degradada:2026-10-21'])
  })
  it('falha no 2º lote de 100 ids: lança, 0 update em notifications', async () => {
    const t = mundo({ alvos: 150, porAlvoD: 1, notificacoes: [aberta('obs-degradada:2026-10-21')] })
    const f = vi.fn().mockResolvedValue(fanOk)
    let leituras = 0
    const { b, fim } = rodar(t, f, { banco: { falhar: p => (p.tabela === 'yt_watch_readings' && ++leituras === 2 ? { message: 'x' } : null) } })
    await expect(fim).rejects.toThrow()
    expect(f).not.toHaveBeenCalled()
    expect(b.pedidos.filter(p => p.tabela === 'notifications' && p.op === 'update')).toHaveLength(0)
  })
  it('contagem exata divergente das linhas lidas: lança', async () => {
    const t = mundo({ porAlvoD: 2 })
    const b = criarBanco(t)
    const sb = { from: (tab: string) => {
      const q = (b.sb as { from: (x: string) => Record<string, (...a: unknown[]) => unknown> }).from(tab)
      if (tab === 'yt_watch_readings') { const r = q.range!; q.range = (...a: unknown[]) => (r(...a) as PromiseLike<{ count: number }>).then(x => ({ ...x, count: x.count + 1 })) }
      return q
    } }
    const f = vi.fn().mockResolvedValue(fanOk)
    await expect(enviarAvisosDaLeitura(sb as never, AGORA, { semTempo: sempre(false), fanOut: f as never, env: ON })).rejects.toThrow()
    expect(f).not.toHaveBeenCalled()
  })
  it('semTempo verdadeiro: 0 consultas do site, 0 expirados, semTempo = 1', async () => {
    const t = mundo({ porAlvoD: 0, notificacoes: [aberta('obs-degradada:2026-10-21')] })
    const f = vi.fn().mockResolvedValue(fanOk)
    const { b, fim } = rodar(t, f, { semTempo: sempre(true) })
    expect(await fim).toMatchObject({ ativo: true, semTempo: 1, expirados: 0, degradada: 0 })
    expect(b.pedidos.filter(p => p.tabela !== 'yt_watch_alvos')).toHaveLength(0)
    expect(abertas(t)).toEqual(['obs-degradada:2026-10-21'])
  })
})
