// @vitest-environment node
// A4 Tarefa 9 (revisão da T8, I2): `carregarExtrasProprio`, a função que monta o dado privado da lista de Canais, da comparação e (com `previo`) das posições da
// página do canal. Antes, só havia testes com o módulo trocado por um mock. Aqui ele roda de verdade, com a guarda de edição, o cliente de serviço e o Sentry
// trocados na ponta (como em proprio-dados.test.ts): o que se prova é QUEM é consultado, QUANTAS vezes a guarda roda e o que sai quando o dado não existe.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, type FakeDb, type Row } from '../../helpers/fake-supabase'
import { mundoSemProprio, proprioWorld } from './proprio-fixture'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'

const requireSiteScope = vi.fn()
const getSupabaseServiceClient = vi.fn()
const captureMessage = vi.fn()
const captureException = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))

import { podeVerPrivado, longosAcompanhadosDe } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { carregarExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras'

const SITE = 'site-1'
// o leitor só aceita canal com id de uuid (T3: id que não é uuid vira "negado"): os dois canais próprios do preset 2 ganham ids de uuid
const UUID_A = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a01', UUID_B = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a02'
const W = proprioWorld({
  mut: ds => {
    const novos = new Map(ds.channels.filter(c => c.own).map((c, i) => [c.id, i === 0 ? UUID_A : UUID_B]))
    for (const c of ds.channels) { const n = novos.get(c.id); if (n) c.id = n }
    for (const v of ds.videos) { const n = novos.get(v.ch); if (n) v.ch = n }
  },
}) // dois canais próprios (preset 2); a base do oráculo é lida uma vez por arquivo
const AGORA = W.obs.NOW, HOJE = dayPt(new Date(AGORA))
const [A, B] = W.obs.ownChannels().map(c => c.id) as [string, string] // A = o canal da página; B = o outro
const LONGOS = { [A]: longosAcompanhadosDe(W.obs, A), [B]: longosAcompanhadosDe(W.obs, B) }

/** Diário de 30 dias que termina em hoje-2, com `views` iguais para todos os longos do canal. */
function linhasDiario(canal: string, views: number): Row[] {
  const out: Row[] = []
  for (const yt of LONGOS[canal]!) for (let n = 0; n < 30; n++) out.push({ youtube_video_id: yt, day_pt: addDays(HOJE, -2 - n), site_id: SITE, channel_id: canal, views })
  return out
}
function diarioPrevio(canal: string, views: number): Privado<DiarioCanal> {
  return { acesso: 'ok', dado: { canalId: canal, ultimoDia: addDays(HOJE, -2), descartados: 0, linhas: LONGOS[canal]!.flatMap(yt => Array.from({ length: 30 }, (_, n) => ({ ytId: yt, dia: addDays(HOJE, -2 - n), views }))) } }
}

/** O banco do teste; `lidos` guarda o canal de cada leitura do diário. `falha` = canais cuja leitura do diário falha. */
function banco(falha: string[] = []): { db: FakeDb; lidos: string[] } {
  const lidos: string[] = []
  const db = fakeSupabase(
    { yt_own_video_daily: [...linhasDiario(A, 2), ...linhasDiario(B, 4)] },
    { failIf: (t, eqs) => { if (t !== 'yt_own_video_daily') return false; const c = String(eqs['channel_id']); lidos.push(c); return falha.includes(c) } },
  )
  getSupabaseServiceClient.mockReturnValue(db.client)
  return { db, lidos }
}
const comPermissao = () => requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
const semPermissao = () => requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
const unico = <T>(xs: T[]): T[] => [...new Set(xs)]

beforeEach(() => { requireSiteScope.mockReset(); getSupabaseServiceClient.mockReset(); captureMessage.mockReset(); captureException.mockReset() })

describe('sem canal próprio no site', () => {
  it('devolve undefined e não consulta nada: nem a guarda de edição, nem o cliente de serviço', async () => {
    const r = await carregarExtrasProprio(mundoSemProprio(), SITE, AGORA)
    expect(r).toBeUndefined()
    expect(requireSiteScope).not.toHaveBeenCalled()
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
})

describe('sem `previo` (lista de Canais e comparação)', () => {
  it('sem permissão de edição: cada canal chega "sem-acesso" (valor null), a guarda roda uma vez e NENHUMA tabela privada é consultada', async () => {
    semPermissao()
    const { db } = banco()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA)
    expect(r).toBeDefined()
    for (const id of [A, B]) expect(r!.vpd.get(id)).toMatchObject({ valor: null, motivo: 'sem-acesso' })
    expect(requireSiteScope).toHaveBeenCalledTimes(1)
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'edit' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(db.trips).toEqual([])
  })

  it('com permissão: a guarda roda UMA vez, os dois canais próprios são lidos e cada um tem o seu número (2 e 4: nunca o do vizinho)', async () => {
    comPermissao()
    const { lidos } = banco()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA)
    expect(requireSiteScope).toHaveBeenCalledTimes(1)
    expect(unico(lidos).sort()).toEqual([A, B].sort())
    expect(r!.vpd.get(A)).toMatchObject({ valor: 2, motivo: null })
    expect(r!.vpd.get(B)).toMatchObject({ valor: 4, motivo: null })
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('a leitura de um canal falha: ele vira "leitura-falhou" (valor null), o outro segue medido, e UM aviso sai com a contagem', async () => {
    comPermissao()
    banco([B])
    const avisar = vi.fn()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA, avisar)
    expect(r!.vpd.get(B)).toMatchObject({ valor: null, motivo: 'leitura-falhou' })
    expect(r!.vpd.get(A)).toMatchObject({ valor: 2, motivo: null })
    expect(avisar).toHaveBeenCalledTimes(1)
    expect(avisar.mock.calls[0]![1]).toBe(1)
  })

  it('sem `avisar`, o aviso padrão vai ao Sentry UMA vez (nunca um por canal) e a tela não cai', async () => {
    comPermissao()
    banco([A, B])
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA)
    for (const id of [A, B]) expect(r!.vpd.get(id)).toMatchObject({ valor: null, motivo: 'leitura-falhou' })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: SITE, falhas: 2 } })
  })

  it('canal sem nenhuma linha no diário: "sem-diario" (valor null), nunca 0', async () => {
    comPermissao()
    const db = fakeSupabase({ yt_own_video_daily: [] })
    getSupabaseServiceClient.mockReturnValue(db.client)
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA)
    for (const id of [A, B]) expect(r!.vpd.get(id)).toMatchObject({ valor: null, motivo: 'sem-diario' })
  })
})

describe('com `previo` (página do canal: posições)', () => {
  it('reaproveita o token: NÃO chama a guarda de novo, não relê o diário do canal da página e lê só os OUTROS canais próprios', async () => {
    comPermissao()
    const leitura = await podeVerPrivado(SITE)
    expect(leitura).not.toBeNull()
    requireSiteScope.mockClear() // a guarda que vale é a da página; daqui em diante nenhuma chamada nova
    const { lidos } = banco()
    // o diário que a página já leu (100) é diferente do que está na tabela (2): o resultado diz de onde o número veio
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA, undefined, { leitura, canalId: A, diario: diarioPrevio(A, 100) })
    expect(requireSiteScope).not.toHaveBeenCalled()
    expect(unico(lidos)).toEqual([B])
    expect(r!.vpd.get(A)).toMatchObject({ valor: 100, motivo: null })
    expect(r!.vpd.get(B)).toMatchObject({ valor: 4, motivo: null })
  })

  it('o diário "negado" da página vale para o canal dela, e o token nulo impede toda leitura dos outros', async () => {
    const { lidos, db } = banco()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA, undefined, { leitura: null, canalId: A, diario: { acesso: 'negado' } })
    expect(requireSiteScope).not.toHaveBeenCalled()
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(lidos).toEqual([])
    expect(db.trips).toEqual([])
    for (const id of [A, B]) expect(r!.vpd.get(id)).toMatchObject({ valor: null, motivo: 'sem-acesso' })
  })

  it('o diário "erro" da página vira "leitura-falhou" no canal dela; o outro canal é lido normalmente', async () => {
    comPermissao()
    const leitura = await podeVerPrivado(SITE)
    const { lidos } = banco()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA, undefined, { leitura, canalId: A, diario: { acesso: 'erro' } })
    expect(r!.vpd.get(A)).toMatchObject({ valor: null, motivo: 'leitura-falhou' })
    expect(r!.vpd.get(B)).toMatchObject({ valor: 4, motivo: null })
    expect(unico(lidos)).toEqual([B])
  })

  it('erro de leitura no OUTRO canal: ele vira "leitura-falhou", o da página segue com o diário que ela já leu, e UM aviso sai', async () => {
    comPermissao()
    const leitura = await podeVerPrivado(SITE)
    banco([B])
    const avisar = vi.fn()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA, avisar, { leitura, canalId: A, diario: diarioPrevio(A, 100) })
    expect(r!.vpd.get(B)).toMatchObject({ valor: null, motivo: 'leitura-falhou' })
    expect(r!.vpd.get(A)).toMatchObject({ valor: 100, motivo: null })
    expect(avisar).toHaveBeenCalledTimes(1)
  })

  it('um `previo.canalId` que não é um dos canais do site (maiúsculas, outro site) não apaga a leitura de ninguém: os dois canais próprios são lidos e o id estranho não vira número', async () => {
    comPermissao()
    const leitura = await podeVerPrivado(SITE)
    const { lidos } = banco()
    const r = await carregarExtrasProprio(W.obs, SITE, AGORA, undefined, { leitura, canalId: A.toUpperCase() + '-x', diario: diarioPrevio(A, 100) })
    expect(unico(lidos).sort()).toEqual([A, B].sort())
    expect(r!.vpd.get(A)).toMatchObject({ valor: 2, motivo: null })
    expect(r!.vpd.has(A.toUpperCase() + '-x')).toBe(false)
  })
})
