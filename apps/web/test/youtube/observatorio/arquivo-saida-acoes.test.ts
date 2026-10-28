// apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
const admin = { ok: true as boolean, scopeOk: null as boolean | null }
vi.mock('@/lib/cms/auth-guards', () => ({
  denyUnlessSiteAdmin: async (_s: string, acao: string) => (admin.ok ? null : { ok: false, error: `Só quem administra o site pode ${acao}.` }),
  requireSiteAdminScope: async () => ((admin.scopeOk ?? admin.ok) ? { ok: true, user: { id: 'u-admin' } } : { ok: false, reason: 'insufficient_access' }),
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
}))
type R = { data: unknown; error: { code?: string; message?: string } | null }
let respostas: Record<string, R | R[]> = {}
const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = []
let emVoo = 0, maxEmVoo = 0
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      const r = respostas[fn]; const um = Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]!) : r
      return {
        abortSignal: () => {
          emVoo++; maxEmVoo = Math.max(maxEmVoo, emVoo)
          return new Promise<R>(res => setTimeout(() => { emVoo--; res(um ?? { data: null, error: { code: '42883', message: 'x' } }) }, 2))
        },
      }
    },
  }),
}))
const ok = (data: unknown): R => ({ data, error: null })
const EST_ONLINE = { estado: 'online', faltam: [], descartes: 0, dois_passos: true, particao_ausente: false }

beforeEach(() => { respostas = {}; chamadas.length = 0; emVoo = 0; maxEmVoo = 0; admin.ok = true; admin.scopeOk = null; delete process.env.OBS_ARQUIVO_AUTO_DROP })

describe('ações da saída', () => {
  it('93: quem não administra recebe a frase e nenhuma função do banco é chamada', async () => {
    admin.ok = false
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    for (const r of [await a.tirarMes('competitor_video_daily', '2026-10-01'), await a.liberarEspaco('competitor_video_daily', '2026-10-01'),
                     await a.trazerDeVolta('competitor_video_daily', '2026-10-01')]) {
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/^Só quem administra o site pode /)
    }
    expect(chamadas).toEqual([])
  })
  it('49: tirar com dois passos: confere canal por canal e chama detach com p_by da sessão (nunca do formulário)', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok(['00000000-0000-0000-0000-0000000000c1']),
                  obs_archive_precheck_unit: ok({ ok: true }), obs_archive_detach_month: ok({ status: 'ok', linhas: 120, soma: 9 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r).toMatchObject({ ok: true, resposta: { tipo: 'ok', linhas: 120 } })
    expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_exit_check', 'obs_archive_precheck_channels', 'obs_archive_precheck_unit', 'obs_archive_detach_month'])
    expect(chamadas.at(-1)!.args).toEqual({ p_site: 's1', p_table: 'competitor_video_daily', p_month: '2026-10-01', p_by: 'u-admin', p_mode: 'clique', p_dry_run: false })
    expect(chamadas[1]!.args).toMatchObject({ p_only_stale: true })   // Phil M5: só os canais sem conferência fresca
  })
  it('depois de 3 descartes da tabela: tirar chama drop', async () => {
    respostas = { obs_archive_exit_check: ok({ ...EST_ONLINE, descartes: 3, dois_passos: false }), obs_archive_precheck_channels: ok([]),
                  obs_archive_drop_month: ok({ status: 'ok', linhas: 5, bytes: 4096 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'ok', bytes: 4096 } })
    expect(chamadas.at(-1)!.fn).toBe('obs_archive_drop_month')
  })
  it('simular: chama com p_dry_run e conta a simulação vista; recusa traz a lista (sem códigos na frase de erro)', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]),
                  obs_archive_detach_month: ok({ status: 'recusado', faltam: [{ codigo: 'ainda_na_janela', pode_sair_em: '2027-05-01' }] }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.simularSaida('competitor_video_daily', '2026-10-01')
    expect(r).toMatchObject({ ok: true, resposta: { tipo: 'recusado', faltam: [{ codigo: 'ainda_na_janela' }] } })
    expect(chamadas.find(c => c.fn === 'obs_archive_detach_month')!.args.p_dry_run).toBe(true)
    expect(chamadas.some(c => c.fn === 'obs_archive_switch_sim_seen')).toBe(false)   // só "simulado" conta
  })
  it('simulação que deu certo conta a vista (classe da tabela)', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]),
                  obs_archive_detach_month: ok({ status: 'simulado', linhas: 10, soma: 1, canais: 1, fracao_da_classe: 0.38, codigo: null }),
                  obs_archive_switch_sim_seen: ok({ simulacoes: 1 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    await a.simularSaida('competitor_video_daily', '2026-10-01')
    expect(chamadas.find(c => c.fn === 'obs_archive_switch_sim_seen')!.args).toEqual({ p_site: 's1', p_class: 'serie', p_by: 'u-admin' })
  })
  it('T11: banco em modo somente leitura (25006) vira a frase do passo de emergência; o código não aparece', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]),
                  obs_archive_detach_month: { data: null, error: { code: '25006', message: 'cannot execute in a read-only transaction' } } }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r).toEqual({ ok: false, error: 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.' })
  })
  it('o dado não existe: exit_check nulo ou fora da forma = não tira e diz que não leu', async () => {
    for (const ec of [ok(null), ok({ estado: 'qualquer' }), { data: null, error: { code: '42883', message: 'x' } }]) {
      respostas = { obs_archive_exit_check: ec }; chamadas.length = 0
      const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
      expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: 'Não foi possível ler o estado deste mês. Nada foi tirado.' })
      expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_exit_check'])
    }
  })
  it('entrada fora da forma (tabela que não sai por partição, mês que não é dia 1) recusa sem chamar o banco', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect((await a.tirarMes('competitor_video_comments', '2026-10-01')).ok).toBe(false)
    expect((await a.tirarMes('competitor_video_daily', '2026-10-15')).ok).toBe(false)
    expect(chamadas).toEqual([])
  })
  it('m-8: tirar um mês que já está destacado (segundo clique) responde ja_destacado, não "não foi possível ler"', async () => {
    respostas = { obs_archive_exit_check: ok({ ...EST_ONLINE, estado: 'destacado' }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] } })
    expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_exit_check'])
    respostas = { obs_archive_exit_check: ok({ ...EST_ONLINE, estado: 'descartado' }) }
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'recusado', codigo: 'ja_descartado' } })
  })
  it('conferirCanais roda em paralelo, no máximo 4 por vez, e uma falha de leitura interrompe', async () => {
    const canais = Array.from({ length: 10 }, (_, i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`)
    respostas = { obs_archive_precheck_channels: ok(canais), obs_archive_precheck_unit: ok({ ok: true }) }
    const { conferirCanais } = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    expect(await conferirCanais(getSupabaseServiceClient(), 's1', 'competitor_video_daily', '2026-10-01')).toEqual({ ok: 10, falhou: 0 })
    expect(chamadas.filter(c => c.fn === 'obs_archive_precheck_unit')).toHaveLength(10)
    expect(maxEmVoo).toBeGreaterThan(1)
    expect(maxEmVoo).toBeLessThanOrEqual(4)
    respostas = { obs_archive_precheck_channels: ok(canais), obs_archive_precheck_unit: { data: null, error: { code: '42883', message: 'x' } } }
    expect(await conferirCanais(getSupabaseServiceClient(), 's1', 'competitor_video_daily', '2026-10-01')).toEqual({ causa: 'banco' })
  })
  it('contadores da peça 4 na M6a: lerInterruptor devolve nao_existe para classe sem automático e nao_pode com os contadores; falha de leitura = null', async () => {
    const { lerInterruptor } = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    const sb = getSupabaseServiceClient()
    expect(await lerInterruptor(sb, 's1', 'ensaio' as never)).toEqual({ estado: 'nao_existe' })
    respostas = { obs_archive_switch_counts: ok({ descartes: 2, simulacoes: 1 }) }
    expect(await lerInterruptor(sb, 's1', 'serie')).toEqual({ estado: 'nao_pode', descartes: 2, simulacoes: 1 })
    respostas = { obs_archive_switch_counts: ok({ descartes: 'x' }) }
    expect(await lerInterruptor(sb, 's1', 'serie')).toBeNull()
    respostas = {}
    expect(await lerInterruptor(sb, 's1', 'serie')).toBeNull()
  })
  it('liberar confere os canais e chama discard; trazer chama só reattach, ambos com p_by da sessão e sem simular', async () => {
    respostas = { obs_archive_precheck_channels: ok([]), obs_archive_discard_month: ok({ status: 'ok', linhas: 5, bytes: 10 }), obs_archive_reattach_month: ok({ status: 'ok', linhas: 5 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.liberarEspaco('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'ok' } })
    expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_precheck_channels', 'obs_archive_discard_month'])
    expect(chamadas.at(-1)!.args).toMatchObject({ p_by: 'u-admin', p_dry_run: false })
    chamadas.length = 0
    expect(await a.trazerDeVolta('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'ok' } })
    expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_reattach_month'])
    expect(chamadas[0]!.args).toMatchObject({ p_by: 'u-admin', p_dry_run: false })
  })
  it('portão D-6: só o cliente de serviço (nunca o do usuário/authenticator) e a conferência vem antes da chamada final', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['src/lib/youtube/observatorio/arquivo-mensal/saida.ts', 'src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts']) {
      const t = readFileSync(f, 'utf8')
      expect(t, f).not.toMatch(/supabase\/server|createServerClient|createClient\(/)
    }
    expect(readFileSync('src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts', 'utf8')).toMatch(/getSupabaseServiceClient/)
    const saida = readFileSync('src/lib/youtube/observatorio/arquivo-mensal/saida.ts', 'utf8')
    expect(saida.indexOf('await conferirCanais(sb, a.site, a.tabela, a.mes)')).toBeLessThan(saida.indexOf("const fn = a.doisPassos"))
  })
  it('93b: cada guarda vale sozinha (o primeiro nega com o segundo liberado; o segundo nega com o primeiro liberado)', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    admin.ok = false; admin.scopeOk = true
    expect((await a.tirarMes('competitor_video_daily', '2026-10-01')).ok).toBe(false)
    admin.ok = true; admin.scopeOk = false
    expect((await a.tirarMes('competitor_video_daily', '2026-10-01')).ok).toBe(false)
    expect(chamadas).toEqual([])
  })
})
