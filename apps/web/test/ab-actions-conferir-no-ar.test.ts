// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { conferirNoArCore } from '@/lib/youtube/ab-escolha'
import type { LeituraNoAr, Retrato } from '@/lib/youtube/ab-settle'
import type { DhashDaVariante } from '@/lib/youtube/ab-variant-dhash'

const T = '00000000-0000-4000-8000-0000000000'
const TESTE = `${T}01`, VA = `${T}0a`, VB = `${T}0b`, VC = `${T}0c`
const SITE = 'site-1'
const AGORA = new Date('2026-10-27T12:00:00.000Z')
const FIM = '2026-10-27T08:00:00.000Z'
const HA = '0000000000000000', HB = 'ffffffffffffffff', HC = '0f0f0f0f0f0f0f0f'
const campo = (estado: string, destino: string, em: string, escreveu: boolean | null = true) =>
  ({ estado, destino, em, forcado: false, escreveu, erro: null, attempts: 0 })

type Fila = Record<string, unknown>
function fake(init: { teste?: Fila | null; historico?: Fila[] } = {}) {
  const teste: Fila | null = init.teste === null ? null : {
    id: TESTE, site_id: SITE, test_type: 'title', status: 'completed', restore_seq: 4, completed_at: FIM, completed_reason: 'regra_v2',
    winner_variant_id: null, winner_applied_at: null, escolha_variant_id: null, escolha_em: null, result_metadata: null,
    restore_status: null, ...init.teste,
  }
  const variantes = [{ id: VA, label: 'original', is_original: true }, { id: VB, label: 'B', is_original: false }, { id: VC, label: 'C', is_original: false }]
  let updates = 0
  const supabase = {
    from(tabela: string) {
      const q: Record<string, unknown> = {
        select: () => q, eq: () => q, order: () => q, limit: () => q,
        update: () => { updates++; return q },
        maybeSingle: () => Promise.resolve({ data: teste, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: tabela === 'ab_test_variants' ? variantes : (init.historico ?? []), error: null }).then(ok),
      }
      return q
    },
  } as unknown as SupabaseClient
  return { supabase, updates: () => updates }
}
function lido(o: { titulo?: string; dhash?: string | null; dhashes?: Array<[string, DhashDaVariante]> } = {}): LeituraNoAr {
  const retrato = {
    id: TESTE, original_title: 'Original',
    variantes: [
      { id: VA, is_original: true, blob_url: null, title_text: null, thumbnail_dhash: HA, label: 'original' },
      { id: VB, is_original: false, blob_url: null, title_text: 'Titulo B', thumbnail_dhash: HB, label: 'B' },
      { id: VC, is_original: false, blob_url: null, title_text: 'Titulo C', thumbnail_dhash: HC, label: 'C' },
    ],
  } as unknown as Retrato
  const dhashes = new Map<string, DhashDaVariante>(o.dhashes ?? [[VA, { tipo: 'ok', dhash: HA }], [VB, { tipo: 'ok', dhash: HB }], [VC, { tipo: 'ok', dhash: HC }]])
  return { tipo: 'lido', retrato, dhashes, ...(o.titulo !== undefined ? { titulo: o.titulo } : {}), ...(o.dhash !== undefined ? { dhash: o.dhash } : {}) }
}
const ler = vi.fn()
const conferir = (f: ReturnType<typeof fake>) => conferirNoArCore({ testId: TESTE, siteId: SITE }, { supabase: f.supabase, ler, agora: () => AGORA })
const min = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString()

beforeEach(() => { vi.clearAllMocks() })

describe('conferirNoAr', () => {
  it('em_andamento recente: escrevendo, sem ler o YouTube', async () => {
    const f = fake({ teste: { restore_status: { title: campo('em_andamento', VC, min(1), null) } } })
    expect(await conferir(f)).toEqual({ ok: true, estado: 'escrevendo' }); expect(ler).not.toHaveBeenCalled()
  })
  it('registro confirmado: lido pelo registro, sem ler o YouTube', async () => {
    const f = fake({ teste: { restore_status: { title: campo('ok', VB, min(30)) } } })
    expect(await conferir(f)).toMatchObject({ ok: true, estado: 'lido', fonte: 'registro', restoreSeq: 4, noAr: { letra: 'B' } })
    expect(ler).not.toHaveBeenCalled()
  })
  it('desconhecido e o YouTube casa com C: lido pelo YouTube', async () => {
    ler.mockResolvedValue(lido({ titulo: 'Titulo C' }))
    const f = fake({ teste: { restore_status: { title: campo('falhou', VC, min(30), null) } } })
    expect(await conferir(f)).toMatchObject({ ok: true, estado: 'lido', fonte: 'youtube', noAr: { letra: 'C', varianteId: VC } })
  })
  it('combo com miniatura sem resposta há 2 min e hqdefault igual a B: nao_propagou, nunca recusou', async () => {
    ler.mockResolvedValue(lido({ titulo: 'Titulo C', dhash: HB }))
    const f = fake({
      teste: { test_type: 'combo', restore_status: { title: campo('ok', VC, min(2)), thumbnail: campo('falhou', VC, min(2), null) } },
      historico: [{ seq: 3, campo: 'thumbnail', destino: VB, estado: 'ok', escreveu: true, em: min(60) }],
    })
    const r = await conferir(f)
    expect(r).toMatchObject({ ok: true, estado: 'nao_propagou', titulo: 'conferido', noAr: { letra: 'B' } })
  })
  it('título C e miniatura B fora da janela de 3 h: lido_misto', async () => {
    ler.mockResolvedValue(lido({ titulo: 'Titulo C', dhash: HB }))
    const f = fake({ teste: { test_type: 'combo', restore_status: { title: campo('ok', VC, min(300)), thumbnail: campo('falhou', VC, min(300), null) } } })
    expect(await conferir(f)).toMatchObject({ ok: true, estado: 'lido_misto', porCampo: { title: 'C', thumbnail: 'B' } })
  })
  it('título desconhecido e miniatura B: nenhuma_versao', async () => {
    ler.mockResolvedValue(lido({ titulo: 'Editado no Studio', dhash: HB }))
    const f = fake({ teste: { test_type: 'combo', restore_status: { title: campo('falhou', VC, min(300), null), thumbnail: campo('falhou', VC, min(300), null) } } })
    expect(await conferir(f)).toMatchObject({ ok: true, estado: 'nenhuma_versao', restoreSeq: 4 })
  })
  it('teste de outro site: ja_encerrado, nenhuma leitura do YouTube', async () => {
    const f = fake({ teste: null })
    expect(await conferir(f)).toMatchObject({ ok: false, estado: 'ja_encerrado' }); expect(ler).not.toHaveBeenCalled()
  })
  it('sem_leitura do YouTube (vídeo apagado, token, rede) vira sem_leitura', async () => {
    ler.mockResolvedValue({ tipo: 'sem_leitura', motivo: 'video_inexistente' })
    const f = fake({ teste: { restore_status: { title: campo('falhou', VC, min(30), null) } } })
    expect(await conferir(f)).toMatchObject({ ok: false, estado: 'sem_leitura' })
    ler.mockRejectedValueOnce(new Error('token'))
    expect(await conferir(f)).toMatchObject({ ok: false, estado: 'sem_leitura' })
  })
  it('uma versão sem dHash (Blob indisponível) e nada casa: sem_leitura, nunca nenhuma_versao', async () => {
    ler.mockResolvedValue(lido({ dhash: 'aaaaaaaaaaaaaaaa', dhashes: [[VA, { tipo: 'ok', dhash: HA }], [VB, { tipo: 'sem_base', motivo: 'blob_404' }]] }))
    const f = fake({ teste: { test_type: 'thumbnail', restore_status: { thumbnail: campo('falhou', VC, min(300), null) } } })
    expect(await conferir(f)).toMatchObject({ ok: false, estado: 'sem_leitura' })
  })
  it('nunca escreve em ab_tests', async () => {
    ler.mockResolvedValue(lido({ titulo: 'Titulo C' }))
    const f = fake({ teste: { restore_status: { title: campo('falhou', VC, min(30), null) } } })
    await conferir(f)
    expect(f.updates()).toBe(0)
  })
})
