
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ops/alert-state', () => ({ claimAlert: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))
vi.mock('@/lib/notifications/get-site-owners', () => ({
  SEM_DESTINATARIO: 'sem_destinatario',
  getSiteOwners: vi.fn(),
  logSemDestinatario: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { avisarEntrada, avisarSaida, textoAviso, chaveAviso } from '@/lib/youtube/coleta/alerts'
import { claimAlert } from '@/lib/ops/alert-state'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getSiteOwners } from '@/lib/notifications/get-site-owners'
import type { SupabaseClient } from '@supabase/supabase-js'

const canal = { id: 'ch-1', channel_id: 'UC1', site_id: 'site-1', name: 'Canal Um', sync_enabled: true }
type Erro = { code?: string; message: string } | null
// Banco falso só de ops_alert_state: leitura e delete conferem `error`, como o código de produção.
function novoBanco(carimbos: string[] = [], erros: { ler?: Erro; apagar?: Erro } = {}) {
  const lidas: string[] = []
  const apagadas: string[] = []
  const supabase = {
    from: (tabela: string) => {
      expect(tabela).toBe('ops_alert_state')
      return {
        select: () => ({
          eq: (_c: string, key: string) => ({
            maybeSingle: async () => {
              lidas.push(key)
              if (erros.ler) return { data: null, error: erros.ler }
              return { data: carimbos.includes(key) ? { last_at: new Date().toISOString() } : null, error: null }
            },
          }),
        }),
        delete: () => ({
          eq: async (_c: string, key: string) => {
            if (erros.apagar) return { error: erros.apagar }
            apagadas.push(key)
            return { error: null }
          },
        }),
      }
    },
  } as unknown as SupabaseClient
  return { supabase, lidas, apagadas }
}
const novoCtx = (carimbos: string[] = [], erros: { ler?: Erro; apagar?: Erro } = {}) => {
  const b = novoBanco(carimbos, erros)
  return { supabase: b.supabase, falhas: [] as string[], lidas: b.lidas, apagadas: b.apagadas }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSiteOwners).mockResolvedValue([{ userId: 'u1', email: 'dono@example.test' }])
  vi.mocked(fanOutToSiteAdmins).mockResolvedValue(1)
})

describe('textos e chave', () => {
  it('são exatamente os do spec', () => {
    expect(textoAviso('api_nao_ativada', 'Canal Um')).toBe('A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados.')
    expect(textoAviso('sem_acesso', 'Canal Um')).toBe('O YouTube recusou o acesso aos relatórios do canal Canal Um. Impressões e CTR não estão sendo coletados.')
    expect(textoAviso('tipo_indisponivel', 'Canal Um')).toBe('O YouTube não oferece o relatório de alcance para o canal Canal Um.')
    expect(textoAviso('saida', 'Canal Um')).toBe('A coleta do canal Canal Um voltou ao normal.')
    expect(chaveAviso('ch-1', 'sem_acesso')).toBe('sync-analytics:ch-1:sem_acesso')
  })
})

describe('avisarEntrada', () => {
  it('duas execuções, um só aviso: a segunda cai dentro da janela de 7 dias', async () => {
    vi.mocked(claimAlert).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'api_nao_ativada')
    await avisarEntrada(ctx, canal, 'api_nao_ativada')
    expect(claimAlert).toHaveBeenCalledWith(ctx.supabase, 'sync-analytics:ch-1:api_nao_ativada', '7 days')
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]).toMatchObject({
      siteId: 'site-1', domain: 'youtube', type: 'youtube.coleta_api_nao_ativada',
      message: 'A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados.',
    })
    expect(ctx.falhas).toEqual([])
  })

  it('tipo_indisponivel avisa uma vez só: janela de 3650 dias', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'tipo_indisponivel')
    expect(claimAlert).toHaveBeenCalledWith(ctx.supabase, 'sync-analytics:ch-1:tipo_indisponivel', '3650 days')
  })

  it('sem destinatário: falha crítica, nada é enviado e o carimbo é liberado para tentar de novo', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(getSiteOwners).mockResolvedValue([])
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'sem_acesso')
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): sem_destinatario'])
    expect(ctx.apagadas).toEqual(['sync-analytics:ch-1:sem_acesso'])
  })

  it('zero notificações criadas também é sem destinatário', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(fanOutToSiteAdmins).mockResolvedValue(0)
    const ctx = novoCtx()
    await avisarEntrada(ctx, canal, 'sem_acesso')
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): sem_destinatario'])
    expect(ctx.apagadas).toHaveLength(1)
  })

  it('exceção no envio: falha crítica, sem lançar', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    const ctx = novoCtx()
    await expect(avisarEntrada(ctx, canal, 'sem_acesso')).resolves.toBeUndefined()
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): falha no envio'])
    expect(ctx.apagadas).toHaveLength(1)
  })

  it('exceção no carimbo (ops_alert_claim fora do ar): falha crítica, sem lançar e sem enviar', async () => {
    vi.mocked(claimAlert).mockRejectedValue(new Error('ops_alert_claim failed'))
    const ctx = novoCtx()
    await expect(avisarEntrada(ctx, canal, 'sem_acesso')).resolves.toBeUndefined()
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['aviso sem_acesso (Canal Um): falha no envio'])
  })
})

describe('avisarSaida', () => {
  it('com carimbo de entrada: um aviso de saída e os carimbos são liberados', async () => {
    const ctx = novoCtx(['sync-analytics:ch-1:sem_acesso'])
    await avisarSaida(ctx, canal)
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]).toMatchObject({ type: 'youtube.coleta_saida', message: 'A coleta do canal Canal Um voltou ao normal.' })
    expect(ctx.apagadas).toEqual(['sync-analytics:ch-1:sem_acesso'])
    expect(ctx.falhas).toEqual([])
  })

  it('sem carimbo: nada é enviado e o carimbo de tipo_indisponivel nem é consultado', async () => {
    const ctx = novoCtx()
    await avisarSaida(ctx, canal)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(ctx.lidas).toEqual(['sync-analytics:ch-1:api_nao_ativada', 'sync-analytics:ch-1:sem_acesso'])
  })

  it('RULING 1: leitura do carimbo com erro não vira "sem carimbo": falha registrada, nada enviado', async () => {
    const ctx = novoCtx(['sync-analytics:ch-1:sem_acesso'], { ler: { code: '57014', message: 'timeout' } })
    await avisarSaida(ctx, canal)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
    expect(ctx.falhas).toEqual(['erro de banco ao ler ops_alert_state'])
  })

  it('RULING 1: delete do carimbo com erro não finge sucesso: falha registrada', async () => {
    const ctx = novoCtx(['sync-analytics:ch-1:sem_acesso'], { apagar: { code: '42501', message: 'rls' } })
    await avisarSaida(ctx, canal)
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(ctx.falhas).toEqual(['erro de banco ao gravar ops_alert_state'])
  })

  it('RULING 1: delete com erro na liberação da entrada também vira falha', async () => {
    vi.mocked(claimAlert).mockResolvedValue(true)
    vi.mocked(getSiteOwners).mockResolvedValue([])
    const ctx = novoCtx([], { apagar: { code: '42501', message: 'rls' } })
    await avisarEntrada(ctx, canal, 'sem_acesso')
    expect(ctx.falhas).toContain('erro de banco ao gravar ops_alert_state')
  })

  it('RULING 2: aviso de saída não entregue (sem destinatário) mantém o carimbo', async () => {
    vi.mocked(getSiteOwners).mockResolvedValue([])
    const ctx = novoCtx(['sync-analytics:ch-1:api_nao_ativada', 'sync-analytics:ch-1:sem_acesso'])
    await avisarSaida(ctx, canal)
    expect(ctx.apagadas).toEqual([])
    expect(ctx.falhas).toEqual(['aviso saida (Canal Um): sem_destinatario'])
  })

  it('RULING 2: aviso de saída com exceção no envio mantém o carimbo', async () => {
    vi.mocked(fanOutToSiteAdmins).mockRejectedValue(new Error('boom'))
    const ctx = novoCtx(['sync-analytics:ch-1:sem_acesso'])
    await avisarSaida(ctx, canal)
    expect(ctx.apagadas).toEqual([])
    expect(ctx.falhas).toEqual(['aviso saida (Canal Um): falha no envio'])
  })
})

describe('aviso reautorizar (L1b)', () => {
  it('texto exato do spec, com o nome do canal', () => {
    expect(textoAviso('reautorizar', 'Canal Um')).toBe(
      'O canal Canal Um perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações.',
    )
    expect(chaveAviso('ch-1', 'reautorizar')).toBe('sync-analytics:ch-1:reautorizar')
  })

  it('entrada: pede o carimbo de 7 dias e avisa uma vez', async () => {
    vi.mocked(claimAlert).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { supabase } = novoBanco()
    const falhas: string[] = []
    await avisarEntrada({ supabase, falhas }, canal, 'reautorizar')
    await avisarEntrada({ supabase, falhas }, canal, 'reautorizar')
    expect(vi.mocked(claimAlert).mock.calls[0]).toEqual([supabase, 'sync-analytics:ch-1:reautorizar', '7 days'])
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fanOutToSiteAdmins).mock.calls[0]![0]).toMatchObject({
      type: 'youtube.coleta_reautorizar', title: 'Canal do YouTube perdeu a autorização',
    })
    expect(falhas).toEqual([])
  })

  it('saída padrão NÃO olha o carimbo reautorizar; saída com a lista olha só ele', async () => {
    const chave = 'sync-analytics:ch-1:reautorizar'
    const a = novoBanco([chave])
    await avisarSaida({ supabase: a.supabase, falhas: [] }, canal)
    expect(a.lidas).not.toContain(chave)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()

    const b = novoBanco([chave])
    await avisarSaida({ supabase: b.supabase, falhas: [] }, canal, ['reautorizar'])
    expect(b.lidas).toEqual([chave])
    expect(fanOutToSiteAdmins).toHaveBeenCalledTimes(1)
    expect(b.apagadas).toEqual([chave])
  })
})
