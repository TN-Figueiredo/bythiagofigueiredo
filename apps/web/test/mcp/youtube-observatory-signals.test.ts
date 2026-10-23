// @vitest-environment node
// F2 T8: as ações get_signals e dismiss_signal do youtube_observatory, com o serviço REAL sobre um cliente sintético.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSb, type Consulta, type Resposta } from '../youtube/observatorio/sinais/fake-sb'

const SITE = '11111111-1111-4111-8111-111111111111'
const SINAL = '22222222-2222-4222-8222-222222222222'
const mundo = vi.hoisted(() => ({ permissoes: ['read'] as string[], sb: null as unknown }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: SITE, permissions: mundo.permissoes, keyHash: 'h', keyId: 'chave-9' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mundo.sb }))

import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { youtubeObservatory, cabeNoLimite, LIMITE_DO_TEXTO_DA_FERRAMENTA } from '@/lib/pipeline/mcp/services/youtube-observatory'

const agoraIso = new Date().toISOString()
const outlier = (i: number) => ({ video_id: `0000000${i}-0000-4000-8000-000000000000`, canal_id: `1111111${i % 9}-0000-4000-8000-000000000000`, published_at: agoraIso, mult_vpd7: 12.34567, mult_tela: 4.5678, vpd7: 123456.78, formato: 'long' })
const linha = (i: number) => ({ id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'destino', subject_key: `pais:${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, acao: 'titulo_descricao', forca: 99.99,
  motivo: 'dois canais estouraram no mesmo lugar nos últimos 14 dias', rule_version: 'sinais-v1+semente-1', first_seen_at: agoraIso, expires_at: agoraIso,
  evidence: { outliers: Array.from({ length: 20 }, (_, k) => outlier(k)), outliers_total: 40, canais: 9, proprios: Array.from({ length: 10 }, (_, k) => `bbbbbbbb-0000-4000-8000-00000000000${k}`) } })
let rpcResposta: unknown = { ok: true }
let linhas: unknown[] = []
function montar(permissoes: string[], n = 0) {
  mundo.permissoes = permissoes
  linhas = Array.from({ length: n }, (_, i) => linha(i))
  const w = fakeSb((c: Consulta): Resposta => {
    if (c.tabela === 'rpc:niche_signals_dispensar') return { data: rpcResposta }
    if (c.tabela === 'niche_signals') return { data: linhas, count: linhas.length }
    if (c.tabela === 'niche_signals_estado') return { data: [{ computed_at: agoraIso, motivo_vazio: n === 0 ? 'sem-lugar' : null, contagens: { outliers_sem_lugar: 3, outliers_total: 3 } }] }
    if (c.tabela === 'video_lugares') return { data: c.filtros.some((f) => f.op === 'overlaps') ? linhas.slice(0, 5).map((l, i) => ({ video_id: `bbbbbbbb-0000-4000-8000-00000000000${i}`, chaves: [(l as { subject_key: string }).subject_key] })) : [{ video_id: 'x' }] }
    return { data: [] }
  })
  mundo.sb = w.sb
  return w
}
const texto = (r: { content: Array<{ type: string; text?: string }> }): string => r.content[0]!.text ?? ''

beforeEach(() => { rpcResposta = { ok: true } })

describe('get_signals', () => {
  it('lista vazia traz motivoVazio e a contagem, em JSON', async () => {
    montar(['read'])
    const r = await youtubeObservatory({ action: 'get_signals' })
    expect(r.isError).toBeFalsy()
    const d = JSON.parse(texto(r)) as { n: number; motivoVazio: string; contagens: Record<string, number> }
    expect(d).toMatchObject({ n: 0, motivoVazio: 'sem-lugar' })
    expect(d.contagens.outliers_sem_lugar).toBe(3)
  })

  it('50 itens com a evidência no máximo (20 outliers cada) cabem em LIMITE_DO_TEXTO_DA_FERRAMENTA', async () => {
    montar(['read'], 50)
    const t = texto(await youtubeObservatory({ action: 'get_signals' }))
    const d = JSON.parse(t) as { n: number; itens: Array<{ id: string; evidence: { outliers: unknown[]; outliers_total: number; outliers_omitidos?: number } }> }
    expect(t.length).toBeLessThanOrEqual(LIMITE_DO_TEXTO_DA_FERRAMENTA)
    // o corte é só na lista de outliers: nenhuma sugestão some, e o total verdadeiro continua dito
    expect(d.itens).toHaveLength(50)
    expect(new Set(d.itens.map((i) => i.id)).size).toBe(50)
    expect(d.itens[0]!.evidence.outliers_total).toBe(40)
    expect(d.itens[0]!.evidence.outliers_omitidos).toBe(20 - d.itens[0]!.evidence.outliers.length)
  })

  it('limit acima de 50 é cortado em 50 na consulta', async () => {
    const w = montar(['read'], 3)
    await youtubeObservatory({ action: 'get_signals', limit: 100 })
    expect(w.consultas.find((c) => c.tabela === 'niche_signals')!.limite).toBe(50)
  })
})

describe('dismiss_signal', () => {
  it('chave read: FORBIDDEN e nada é gravado', async () => {
    const w = montar(['read'])
    const r = await youtubeObservatory({ action: 'dismiss_signal', signal_id: SINAL, status: 'dispensado', motivo: 'ja_fiz' })
    expect(r.isError).toBe(true)
    expect(texto(r)).toMatch(/FORBIDDEN/)
    expect(w.rpc).toEqual([])
  })

  it('chave write: dispensa e grava dispensado_por com a chave', async () => {
    const w = montar(['write'])
    const r = await youtubeObservatory({ action: 'dismiss_signal', signal_id: SINAL, status: 'dispensado', motivo: 'nao_interessa' })
    expect(r.isError).toBeFalsy()
    expect(w.rpc[0]).toEqual({ nome: 'niche_signals_dispensar', args: { p_site: SITE, p_id: SINAL, p_status: 'dispensado', p_motivo: 'nao_interessa', p_por: 'key:chave-9' } })
  })

  it("sem signal_id, com status 'feito' (fora do esquema, mas o adaptador também recusa) ou sem motivo: erro de validação, nada gravado", async () => {
    const w = montar(['write'])
    for (const p of [{}, { signal_id: SINAL, status: 'feito', motivo: 'ja_fiz' }, { signal_id: SINAL, status: 'dispensado' }]) {
      const r = await youtubeObservatory({ action: 'dismiss_signal', ...p })
      expect(r.isError, JSON.stringify(p)).toBe(true)
    }
    expect(w.rpc).toEqual([])
  })

  it('id de outro site: NOT_FOUND; a próxima get_signals traz o N que o banco devolver (o dispensado sai da lista)', async () => {
    const w = montar(['write'], 2)
    rpcResposta = { ok: false, motivo: 'nao_encontrado' }
    const r = await youtubeObservatory({ action: 'dismiss_signal', signal_id: SINAL, status: 'dispensado', motivo: 'ja_fiz' })
    expect(r.isError).toBe(true)
    expect(texto(r)).toMatch(/NOT_FOUND|not found/i)
    rpcResposta = { ok: true }
    expect((await youtubeObservatory({ action: 'dismiss_signal', signal_id: SINAL, status: 'dispensado', motivo: 'ja_fiz' })).isError).toBeFalsy()
    linhas = linhas.slice(1) // o banco passa a devolver um aberto a menos
    expect(JSON.parse(texto(await youtubeObservatory({ action: 'get_signals' }))).n).toBe(1)
    expect(w.rpc).toHaveLength(2)
  })
})

describe('cabeNoLimite: nunca devolve texto acima do teto', () => {
  const item = (i: number, nIds: number): ItemDeSinal => ({
    id: `id-${i}`, kind: 'destino', subject_key: `pais:${i}`, acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: nIds, acao_gravada: 'video_novo',
    forca: 10 - i / 100, motivo: 'm', rule_version: 'v', first_seen_at: agoraIso, expires_at: agoraIso, proprios_agora_n: nIds,
    proprios_agora: Array.from({ length: nIds }, (_, k) => `${'x'.repeat(36)}${k}`),
    evidence: { outliers: [], outliers_total: 0, canais: 2, proprios: [] },
  })
  const lista = (itens: ItemDeSinal[]): ListaDeSinais => ({ n: 500, itens, computado_em: agoraIso, desatualizado: false, motivoVazio: null, contagens: {}, calculoLigado: true })

  it('cabe: devolve a lista inteira, sem aviso', () => {
    const r = cabeNoLimite(lista([item(0, 3)]))
    expect(JSON.parse(r.texto).aviso).toBeUndefined()
  })
  it('não cabe nem sem outliers: tira sugestões do fim, diz quantas e mantém n e o prefixo na mesma ordem', () => {
    const itens = Array.from({ length: 50 }, (_, i) => item(i, 20))
    const r = cabeNoLimite(lista(itens), 20_000)
    expect(r.texto.length).toBeLessThanOrEqual(20_000)
    const j = JSON.parse(r.texto) as { n: number; aviso: string; itens: Array<{ id: string }> }
    expect(j.n).toBe(500)
    expect(j.aviso).toMatch(/^resposta cortada: \d+ itens não couberam$/)
    expect(Number(/\d+/.exec(j.aviso)![0]) + j.itens.length).toBe(50)
    expect(j.itens.map((i) => i.id)).toEqual(itens.slice(0, j.itens.length).map((i) => i.id))
  })
  it('teto absurdo de pequeno: lista vazia com aviso, ainda abaixo do teto', () => {
    const r = cabeNoLimite(lista([item(0, 20)]), 400)
    expect(JSON.parse(r.texto).itens).toEqual([])
    expect(JSON.parse(r.texto).aviso).toMatch(/1 itens não couberam/)
  })
})
