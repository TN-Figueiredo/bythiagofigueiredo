// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as Sentry from '@sentry/nextjs'
import { lerOnlineDesdeBruto, lerOnlineDesde, _esquecerAvisos, inicioSeguro, minDias, JANELA_MINIMA_DIAS } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const linha = (t: string, d: string | null) => ({ class: t === 'competitor_video_hourly' ? 'horaria' : 'serie', table_name: t, online_since: d, divergencia: false })
const tudo = (d: string | null) => ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'].map(t => linha(t, d))
const sbCom = (error: { code: string } | null, data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) }) as never

beforeEach(() => { vi.mocked(Sentry.captureMessage).mockClear(); vi.mocked(Sentry.captureException).mockClear(); _esquecerAvisos() })

describe('online desde', () => {
  it('nulo é "nada saiu", lido', () => {
    expect(lerOnlineDesdeBruto(tudo(null))).toEqual({ lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } })
  })
  it('data vira meia-noite de São Paulo (UTC-3)', () => {
    const o = lerOnlineDesdeBruto(tudo('2027-05-01'))
    expect(o.lido && o.porTabela.competitor_video_daily).toBe(Date.parse('2027-05-01T03:00:00Z'))
  })
  it('faltando uma tabela: fora do esquema, nunca "nada saiu"', () => {
    expect(lerOnlineDesdeBruto(tudo(null).slice(0, 2))).toEqual({ lido: false, porque: 'fora_do_esquema' })
    expect(lerOnlineDesdeBruto([])).toEqual({ lido: false, porque: 'fora_do_esquema' })
  })
  it('divergência apontada pelo banco: não lido, nunca "nada saiu"', () => {
    const t = tudo(null); t[0] = { ...t[0]!, divergencia: true }
    expect(lerOnlineDesdeBruto(t)).toEqual({ lido: false, porque: 'divergencia' })
  })
  it('função ausente (42883 e PGRST202) com SAIDA_DE_MES_EXISTE=false: lido e nulo, nada saiu', async () => {
    for (const code of ['42883', 'PGRST202']) {
      expect(await lerOnlineDesde(sbCom({ code }), 's', false)).toEqual({ lido: true, porTabela: { competitor_video_daily: null, competitor_video_early: null, competitor_video_hourly: null } })
    }
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_online_since ausente', expect.objectContaining({ level: 'warning' }))
  })
  it('função ausente com SAIDA_DE_MES_EXISTE=true: não lido (falha em verde fechada, D-M5-15), Sentry de erro', async () => {
    for (const code of ['42883', 'PGRST202']) {
      expect(await lerOnlineDesde(sbCom({ code }), 's', true)).toEqual({ lido: false, porque: 'funcao_ausente' })
    }
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_online_since ausente com saída de mês existindo', expect.objectContaining({ level: 'error' }))
  })
  it('a constante vale false hoje e o carregador a passa (sem ela o teste acima nunca roda em produção)', () => {
    const cap = readFileSync(resolve(__dirname, '../../../src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts'), 'utf8')
    expect(cap).toMatch(/export const SAIDA_DE_MES_EXISTE = false/)
    expect(readFileSync(resolve(__dirname, '../../../src/lib/youtube/observatorio/load.ts'), 'utf8')).toMatch(/lerOnlineDesde\([^)]*SAIDA_DE_MES_EXISTE/)
  })
  it('outro erro do banco: não lido', async () => {
    expect(await lerOnlineDesde(sbCom({ code: '57014' }), 's', false)).toEqual({ lido: false, porque: 'erro_do_banco' })
  })
  it('resposta do banco passa pelo parser', async () => {
    const o = await lerOnlineDesde(sbCom(null, tudo('2027-05-01')), 's', false)
    expect(o.lido && o.porTabela.competitor_video_hourly).toBe(Date.parse('2027-05-01T03:00:00Z'))
  })
  it('a janela mínima vem da política: 181 na série (6 meses), 89 na horária (3 meses)', () => {
    expect(minDias(6)).toBe(181); expect(minDias(3)).toBe(89)
    expect(JANELA_MINIMA_DIAS).toEqual({ competitor_video_daily: 181, competitor_video_early: 181, competitor_video_hourly: 89 })
  })
  it('não lido: início seguro é agora menos a janela mínima, nunca 365', () => {
    const now = Date.parse('2027-06-10T15:00:00Z')
    expect(inicioSeguro({ lido: false, porque: 'erro_do_banco' }, 'competitor_video_daily', now)).toBe(now - 181 * 86_400_000)
  })
  it('lido e nulo: sem início seguro (tudo online)', () => {
    expect(inicioSeguro(lerOnlineDesdeBruto(tudo(null)), 'competitor_video_daily', Date.now())).toBeNull()
  })
  it('Phil I1: função ausente (esperado antes da T13) vai ao Sentry 1× por instância, não por leitura', async () => {
    for (let i = 0; i < 25; i++) await lerOnlineDesde(sbCom({ code: 'PGRST202' }), 's', false)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('Phil I2: divergência vai ao Sentry em nível error, com limite por instância', async () => {
    const t = tudo(null); t[0] = { ...t[0]!, divergencia: true }
    for (let i = 0; i < 5; i++) expect(await lerOnlineDesde(sbCom(null, t), 's', false)).toEqual({ lido: false, porque: 'divergencia' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('divergência'), expect.objectContaining({ level: 'error' }))
  })
  it('Phil I2: resposta fora do esquema (Zod .strict recusa coluna a mais) vai ao Sentry em nível error', async () => {
    const t = [...tudo(null), { extra: 1 }]
    expect(await lerOnlineDesde(sbCom(null, t), 's', false)).toEqual({ lido: false, porque: 'fora_do_esquema' })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('fora do esquema'), expect.objectContaining({ level: 'error' }))
  })
  it('Phil I2: erro do banco vai ao Sentry em nível error, 1× por instância', async () => {
    for (let i = 0; i < 4; i++) await lerOnlineDesde(sbCom({ code: '57014' }), 's', false)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_online_since: 57014', expect.objectContaining({ level: 'error' }))
  })
  it('Phil m-A / Yannis M-1: um timeout cedo não esconde outro código depois; teto de 10 chaves', async () => {
    await lerOnlineDesde(sbCom({ code: '57014' }), 's', false)
    await lerOnlineDesde(sbCom({ code: '42501' }), 's', false)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_online_since: 42501', expect.objectContaining({ level: 'error' }))
    for (let i = 0; i < 20; i++) await lerOnlineDesde(sbCom({ code: 'X' + i }), 's', false)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(10)
  })
  it('Phil m-B: a divergência diz qual tabela', async () => {
    const t = tudo(null); t[2] = { ...t[2]!, divergencia: true }
    await lerOnlineDesde(sbCom(null, t), 's', false)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('divergência'), expect.objectContaining({ extra: { tabelas: ['competitor_video_hourly'] } }))
  })
  it('Phil M2: rpc que lança, ou cliente sem rpc: erro_do_banco e captureException', async () => {
    expect(await lerOnlineDesde({ rpc: vi.fn().mockRejectedValue(new Error('rede')) } as never, 's', false)).toEqual({ lido: false, porque: 'erro_do_banco' })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    _esquecerAvisos()
    expect(await lerOnlineDesde({} as never, 's', false)).toEqual({ lido: false, porque: 'erro_do_banco' })
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
  })
})
