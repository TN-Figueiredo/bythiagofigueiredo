// apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
const admin = { ok: true as boolean, scopeOk: null as boolean | null }
const guardas = { deny: 0, scope: 0 }
vi.mock('@/lib/cms/auth-guards', () => ({
  denyUnlessSiteAdmin: async (_s: string, acao: string) => { guardas.deny++; return admin.ok ? null : { ok: false, error: `Só quem administra o site pode ${acao}.` } },
  requireSiteAdminScope: async () => { guardas.scope++; return (admin.scopeOk ?? admin.ok) ? { ok: true, user: { id: 'u-admin' } } : { ok: false, reason: 'insufficient_access' } },
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
}))
type R = { data: unknown; error: { code?: string; message?: string } | null } | { lanca: string }
let respostas: Record<string, R | R[]> = {}
let aoChamar: Record<string, () => void> = {}
const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = []
let emVoo = 0, maxEmVoo = 0
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      aoChamar[fn]?.()
      const r = respostas[fn]; const um = Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]!) : r
      return {
        abortSignal: () => {
          emVoo++; maxEmVoo = Math.max(maxEmVoo, emVoo)
          return new Promise<R>((res, rej) => setTimeout(() => {
            emVoo--
            if (um && 'lanca' in um) rej(new Error(um.lanca)); else res(um ?? { data: null, error: { code: '42883', message: 'x' } })
          }, 2))
        },
      }
    },
  }),
}))
const ok = (data: unknown): R => ({ data, error: null })
const EST_ONLINE = { estado: 'online', faltam: [], descartes: 0, dois_passos: true, particao_ausente: false }

beforeEach(() => { respostas = {}; aoChamar = {}; guardas.deny = 0; guardas.scope = 0; vi.useRealTimers(); chamadas.length = 0; emVoo = 0; maxEmVoo = 0; admin.ok = true; admin.scopeOk = null; delete process.env.OBS_ARQUIVO_AUTO_DROP })

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
    expect(saida.indexOf('await conferirCanais(')).toBeLessThan(saida.indexOf("const fn = a.doisPassos"))
  })
  it('93b / M-2: a guarda roda UMA vez por ação (nada de denyUnlessSiteAdmin + requireSiteAdminScope) e negada não chama o banco', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    admin.ok = true; admin.scopeOk = false
    for (const f of [a.tirarMes, a.simularSaida, a.liberarEspaco, a.trazerDeVolta]) {
      guardas.deny = 0; guardas.scope = 0
      expect(await f('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: false, error: expect.stringMatching(/^Só quem administra o site pode /) })
      expect(guardas, f.name).toEqual({ deny: 0, scope: 1 })
    }
    admin.ok = true; admin.scopeOk = null; guardas.deny = 0; guardas.scope = 0
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]), obs_archive_detach_month: ok({ status: 'ok', linhas: 1 }) }
    await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(guardas).toEqual({ deny: 0, scope: 1 })
    admin.ok = false; admin.scopeOk = null; chamadas.length = 0
    expect((await a.tirarMes('competitor_video_daily', '2026-10-01')).ok).toBe(false)
    expect(chamadas).toEqual([])
  })
})

// ───────── T11 consertos r1 (Phil 62, Yannis 72) ─────────
const SEM_RESPOSTA_TIRAR = 'Não foi possível confirmar se o mês saiu. Recarregue a página antes de tentar de novo.'
const NAO_LEU = 'Não foi possível ler o estado deste mês. Nada foi tirado.'
const PREP = (extra: Record<string, R | R[]> = {}): void => { respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]), ...extra } }
const ONLINE_DESTACADO = { ...EST_ONLINE, estado: 'destacado' }

describe('T11 r1: classificação do erro depois da chamada que muda (I-1)', () => {
  it('57014 (o banco cancelou e desfez) tem frase própria: não é "não foi possível ler" nem "sem resposta"', async () => {
    PREP({ obs_archive_detach_month: { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } } })
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/não terminou a tempo/)
    expect(r.error).toMatch(/Nada foi tirado/)
    expect(r.error).not.toBe(NAO_LEU)
    expect(r.error).not.toBe(SEM_RESPOSTA_TIRAR)
  })
  it('rede caída, 502 sem SQLSTATE, exceção ou abort DEPOIS da chamada que muda = sem resposta, nunca "Nada foi tirado"', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    for (const e of [{ code: '', message: 'TypeError: fetch failed' }, { message: '<html>502 Bad Gateway</html>' }, { code: undefined, message: 'AbortError: The operation was aborted due to timeout' }]) {
      PREP({ obs_archive_detach_month: { data: null, error: e } })
      expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: SEM_RESPOSTA_TIRAR })
    }
    for (const msg of ['fetch failed', 'The operation was aborted due to timeout', 'ECONNRESET']) {
      PREP({ obs_archive_detach_month: { lanca: msg } })
      expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: SEM_RESPOSTA_TIRAR })
    }
  })
  it('resposta fora da forma depois da chamada que muda = sem resposta (o banco pode ter confirmado)', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    for (const data of [{ status: 'ok', linhas: 'x' }, { status: 'qualquer' }, null, { status: 'ok', bytes: 'muito' }]) {
      PREP({ obs_archive_detach_month: ok(data) })
      expect(await a.tirarMes('competitor_video_daily', '2026-10-01'), JSON.stringify(data)).toEqual({ ok: false, error: SEM_RESPOSTA_TIRAR })
    }
  })
  it('erro com SQLSTATE (o banco respondeu e desfez, ex.: P0001) segue "Nada foi tirado"', async () => {
    PREP({ obs_archive_detach_month: { data: null, error: { code: 'P0001', message: 'x' } } })
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: NAO_LEU })
  })
  it('a SIMULAÇÃO (não muda nada) com rede caída diz que não leu: nada foi tirado é verdade', async () => {
    PREP({ obs_archive_detach_month: { data: null, error: { code: '', message: 'TypeError: fetch failed' } } })
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.simularSaida('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: NAO_LEU })
  })
  it('caminho de prazo da LEITURA: precheck_unit aborta = "não leu" e a chamada final nunca sai', async () => {
    PREP({ obs_archive_precheck_channels: ok(['00000000-0000-0000-0000-0000000000c1']), obs_archive_precheck_unit: { lanca: 'The operation was aborted due to timeout' },
           obs_archive_detach_month: ok({ status: 'ok', linhas: 1 }) })
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: NAO_LEU })
    expect(chamadas.some(c => c.fn === 'obs_archive_detach_month')).toBe(false)
  })
})

describe('T11 r1: frase de incerteza certa por ação (Yannis I-2)', () => {
  it('sem resposta: tirar diz "se o mês saiu", liberar "se o espaço foi liberado", trazer "se o mês voltou ao banco online"', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const erro = { data: null, error: { code: '', message: 'TypeError: fetch failed' } }
    PREP({ obs_archive_detach_month: erro, obs_archive_discard_month: erro, obs_archive_reattach_month: erro })
    expect((await a.tirarMes('competitor_video_daily', '2026-10-01')).error).toMatch(/confirmar se o mês saiu/)
    expect((await a.liberarEspaco('competitor_video_daily', '2026-10-01')).error).toMatch(/confirmar se o espaço foi liberado/)
    expect((await a.trazerDeVolta('competitor_video_daily', '2026-10-01')).error).toMatch(/confirmar se o mês voltou ao banco online/)
    for (const f of [a.tirarMes, a.liberarEspaco, a.trazerDeVolta]) expect((await f('competitor_video_daily', '2026-10-01')).error).toMatch(/Recarregue a página antes de tentar de novo/)
  })
  it('57014 e "nada foi chamado" dizem o verbo da ação (tirado, liberado, trazido)', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const t = { data: null, error: { code: '57014', message: 'x' } }
    PREP({ obs_archive_detach_month: t, obs_archive_discard_month: t, obs_archive_reattach_month: t })
    expect((await a.tirarMes('competitor_video_daily', '2026-10-01')).error).toMatch(/Nada foi tirado/)
    expect((await a.liberarEspaco('competitor_video_daily', '2026-10-01')).error).toMatch(/Nada foi liberado/)
    expect((await a.trazerDeVolta('competitor_video_daily', '2026-10-01')).error).toMatch(/Nada foi trazido/)
  })
})

describe('T11 r1: o dado que falta (Phil I-2, I-3)', () => {
  it('I-2: particao_ausente com descartado_em nulo (o dado sumiu) é recusa com o código, não "não leu"', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    PREP({ obs_archive_detach_month: ok({ status: 'recusado', codigo: 'particao_ausente', descartado_em: null }) })
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'recusado', codigo: 'particao_ausente' } })
    PREP({ obs_archive_reattach_month: ok({ status: 'recusado', codigo: 'particao_ausente', descartado_em: null, liberar_a_partir: null, faltam: null, protecao_faltam: null }) })
    expect(await a.trazerDeVolta('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'recusado', codigo: 'particao_ausente' } })
  })
  it('I-3: bytes e linhas nulos ficam nulos (não 0; o reattach nem tem linhas); número em texto (bigint) vira número', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    PREP({ obs_archive_detach_month: ok({ status: 'ok', linhas: 5, bytes: null }), obs_archive_discard_month: ok({ status: 'ok', linhas: '123456789012', bytes: '4096' }) })
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ resposta: { tipo: 'ok', linhas: 5, bytes: null } })
    expect(await a.liberarEspaco('competitor_video_daily', '2026-10-01')).toMatchObject({ resposta: { tipo: 'ok', linhas: 123456789012, bytes: 4096 } })
    PREP({ obs_archive_detach_month: ok({ status: 'simulado', linhas: 5, bytes: null, canais: 1, fracao_da_classe: 0.1 }) })
    expect(await a.simularSaida('competitor_video_daily', '2026-10-01')).toMatchObject({ resposta: { tipo: 'simulado', linhas: 5, bytes: null } })
    PREP({ obs_archive_detach_month: ok({ status: 'simulado', linhas: null, canais: 1 }), obs_archive_reattach_month: ok({ status: 'ok', conteudo_mudou: false }) })
    expect(await a.simularSaida('competitor_video_daily', '2026-10-01')).toMatchObject({ resposta: { tipo: 'simulado', linhas: null, bytes: null } })
    expect(await a.trazerDeVolta('competitor_video_daily', '2026-10-01')).toMatchObject({ resposta: { tipo: 'ok', linhas: null, bytes: null } })
  })
  it('exit_check com campos de texto nulos (destacado_em: null) ainda é lido', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    PREP(); respostas.obs_archive_exit_check = ok({ ...ONLINE_DESTACADO, destacado_em: null, liberar_a_partir: null, protecao_faltam: null, descartado_em: null, bytes_freed: null, particao_ausente: null })
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { codigo: 'ja_destacado' } })
  })
})

describe('T11 r1: lista fechada de códigos (Yannis M-1)', () => {
  it('todo código da lista passa como está; um código que a tela não conhece vira "desconhecido" (com a frase genérica exportada)', async () => {
    const saida = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(saida.CODIGOS_DA_SAIDA.length).toBeGreaterThan(15)
    for (const c of saida.CODIGOS_DA_SAIDA) {
      PREP({ obs_archive_detach_month: ok({ status: 'recusado', codigo: c }) })
      expect(await a.tirarMes('competitor_video_daily', '2026-10-01'), c).toMatchObject({ ok: true, resposta: { tipo: 'recusado', codigo: c } })
    }
    PREP({ obs_archive_detach_month: ok({ status: 'recusado', codigo: 'zz_inventado' }) })
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'recusado', codigo: 'desconhecido' } })
    expect(saida.FRASE_CODIGO_DESCONHECIDO).toBe('O banco recusou por um motivo que esta tela não conhece; nada foi tirado.')
  })
  it('todo código de recusa que o m6.sql devolve no topo está na lista', async () => {
    const { readFileSync } = await import('node:fs')
    const saida = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const sql = readFileSync('../../supabase/rascunhos/m6.sql', 'utf8')
    const achados = new Set([...sql.matchAll(/'status', 'recusado', 'codigo', '([a-z_]+)'/g)].map(m => m[1]!))
    for (const c of ['conteudo_mudou', 'canal_sem_unidade', 'mudou_durante_a_leitura', 'registro_diverge']) achados.add(c)
    expect(achados.size).toBeGreaterThan(10)
    expect([...achados].filter(c => !(saida.CODIGOS_DA_SAIDA as readonly string[]).includes(c))).toEqual([])
  })
})

describe('T11 r1: relógio único contra o maxDuration da página (Phil I-4, Yannis C-1)', () => {
  it('as constantes cabem: o prazo total fica abaixo do maxDuration real da página, a chamada final passa do statement_timeout de 30 s do banco e cabe depois de uma unidade lenta', async () => {
    const { readFileSync } = await import('node:fs')
    const saida = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const max = Number(/export const maxDuration = (\d+)/.exec(readFileSync('src/app/cms/(authed)/youtube/competitors/arquivo/page.tsx', 'utf8'))![1]) * 1000
    expect(saida.PRAZO_TOTAL_MS).toBeLessThan(max)
    expect(saida.CHAMADA_FINAL_MS).toBeGreaterThan(30_000)
    expect(saida.CHAMADA_FINAL_MS + saida.CHAMADA_MS).toBeLessThan(saida.PRAZO_TOTAL_MS)
    const sql = readFileSync('../../supabase/rascunhos/m6.sql', 'utf8')
    for (const f of ['detach', 'reattach', 'discard', 'drop']) {
      const def = new RegExp(`create or replace function public\\.obs_archive_${f}_month\\([^$]*?\\$\\$`).exec(sql)![0]
      expect(def, f).toMatch(/set statement_timeout = '30s'/)
    }
    // Phil C-1(a): as simulações (dry run) leem o resumo, como as ações: nenhuma chamada ao tally sem o quinto argumento `true`
    expect(sql.match(/obs_archive_tally\(p_site, v_class, p_table, p_month, v_rel\)/g) ?? []).toEqual([])
    expect((sql.match(/obs_archive_tally\(p_site, v_class, p_table, p_month, v_rel, true\)/g) ?? []).length).toBe(6)
  })
  it('conferência que estoura o relógio: resposta parcial, "nada foi chamado" e a chamada final não sai', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const canais = Array.from({ length: 10 }, (_, i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`)
    PREP({ obs_archive_precheck_channels: ok(canais), obs_archive_precheck_unit: ok({ ok: true }), obs_archive_detach_month: ok({ status: 'ok', linhas: 1 }) })
    aoChamar = { obs_archive_precheck_unit: () => { vi.setSystemTime(Date.now() + 10_000) } }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/A conferência dos canais passou do tempo desta página\. Nada foi tirado; clique de novo para continuar de onde parou\./)
    expect(chamadas.filter(c => c.fn === 'obs_archive_precheck_unit').length).toBeLessThan(10)
    expect(chamadas.some(c => c.fn === 'obs_archive_detach_month')).toBe(false)
  })
  it('sem canal a conferir mas sem tempo para a chamada final: "nada foi chamado" (nunca "sem resposta")', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    PREP({ obs_archive_detach_month: ok({ status: 'ok', linhas: 1 }), obs_archive_discard_month: ok({ status: 'ok', linhas: 1 }), obs_archive_reattach_month: ok({ status: 'ok', linhas: 1 }) })
    aoChamar = { obs_archive_exit_check: () => { vi.setSystemTime(Date.now() + 40_000) }, obs_archive_precheck_channels: () => { vi.setSystemTime(Date.now() + 40_000) } }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r).toEqual({ ok: false, error: 'Faltou tempo nesta página para chamar o banco. Nada foi tirado; clique de novo.' })
    chamadas.length = 0
    expect((await a.liberarEspaco('competitor_video_daily', '2026-10-01')).error).toBe('Faltou tempo nesta página para chamar o banco. Nada foi liberado; clique de novo.')
    expect(chamadas.some(c => c.fn === 'obs_archive_discard_month')).toBe(false)
    aoChamar = { obs_archive_reattach_month: () => undefined }
  })
  it('com tempo de sobra o relógio não atrapalha: a chamada final recebe o prazo dela', async () => {
    PREP({ obs_archive_detach_month: ok({ status: 'ok', linhas: 1 }) })
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'ok' } })
  })
})
