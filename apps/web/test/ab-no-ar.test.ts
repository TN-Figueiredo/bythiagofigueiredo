// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { noArConfirmado, type EntradaNoAr, type TentativaNoAr } from '@/lib/youtube/ab-no-ar'

const VS = [
  { id: 'vo', label: 'A' as const, is_original: true },
  { id: 'vb', label: 'B' as const, is_original: false },
  { id: 'vc', label: 'C' as const, is_original: false },
]
const FIM = '2026-10-10T12:00:00.000Z'
const t0 = (min: number) => new Date(Date.parse(FIM) + min * 60_000).toISOString()
const campo = (estado: string, destino: string, min: number, escreveu: boolean | null = true) =>
  ({ estado, destino, em: t0(min), forcado: false, escreveu, erro: null, attempts: 0 })
const base = (o: Partial<EntradaNoAr> = {}): EntradaNoAr => ({
  test_type: 'title', restore_status: null, restore_seq: 1, completed_at: FIM,
  winner_variant_id: null, winner_applied_at: null, variantes: VS, ...o,
})
const h = (seq: number, c: 'title' | 'thumbnail', estado: TentativaNoAr['estado'], destino: string, min: number, escreveu: boolean | null = true): TentativaNoAr =>
  ({ seq, campo: c, destino, estado, escreveu, em: t0(min) })

describe('noArConfirmado', () => {
  it('tudo ok -> confirmado', () => {
    const r = noArConfirmado(base({ restore_status: { title: campo('ok', 'vb', 1) } }), [])
    expect(r).toEqual({ tipo: 'confirmado', varianteId: 'vb', letra: 'B', desde: t0(1) })
  })
  it('falha com escreveu false sobre um B ok -> B', () => {
    const r = noArConfirmado(base({ restore_seq: 2, restore_status: { title: campo('falhou', 'vc', 2, false) } }), [h(1, 'title', 'ok', 'vb', 1)])
    expect(r).toMatchObject({ tipo: 'confirmado', letra: 'B' })
  })
  it('titulo ok e miniatura escreveu null -> desconhecido com ultima B', () => {
    const r = noArConfirmado(base({ test_type: 'combo', restore_seq: 2, restore_status: { title: campo('ok', 'vc', 2), thumbnail: campo('falhou', 'vc', 2, null) } }),
      [h(1, 'thumbnail', 'ok', 'vb', 1)])
    expect(r).toMatchObject({ tipo: 'desconhecido', ultima: { letra: 'B' } })
  })
  it('sem historico e com winner_applied_at -> legado', () => {
    const r = noArConfirmado(base({ winner_variant_id: 'vb', winner_applied_at: t0(3) }), [])
    expect(r).toEqual({ tipo: 'confirmado', varianteId: 'vb', letra: 'B', desde: t0(3) })
  })
  it('sem nada -> desconhecido', () => {
    expect(noArConfirmado(base(), [])).toEqual({ tipo: 'desconhecido', ultima: null })
  })
  it('destino que nao e variante -> desconhecido', () => {
    expect(noArConfirmado(base({ restore_status: { title: campo('ok', 'xx', 1) } }), []).tipo).toBe('desconhecido')
  })
  it('original mapeia para a variante original; sem original ou com duas -> desconhecido', () => {
    const rs = { title: campo('ok', 'original', 1) }
    expect(noArConfirmado(base({ restore_status: rs }), [])).toMatchObject({ tipo: 'confirmado', letra: 'A' })
    expect(noArConfirmado(base({ restore_status: rs, variantes: VS.filter(v => !v.is_original) }), []).tipo).toBe('desconhecido')
    expect(noArConfirmado(base({ restore_status: rs, variantes: [...VS, { id: 'v2', label: 'D', is_original: true }] }), []).tipo).toBe('desconhecido')
  })
  it('pausa A ok antes do fim e fim pulado_sem_original -> desconhecido, nunca A', () => {
    const r = noArConfirmado(base({ restore_seq: 2, restore_status: { title: campo('pulado_sem_original', 'original', 0, false) } }),
      [h(1, 'title', 'ok', 'original', -60)])
    expect(r.tipo).toBe('desconhecido')
  })
  it('pulado_drift sobre escolha B ok -> desconhecido; pulado_teste_youtube idem', () => {
    for (const e of ['pulado_drift', 'pulado_teste_youtube']) {
      const r = noArConfirmado(base({ restore_seq: 2, restore_status: { title: campo(e, 'vc', 2, false) } }), [h(1, 'title', 'ok', 'vb', 1)])
      expect(r.tipo).toBe('desconhecido')
    }
  })
  it('completed_at nulo -> desconhecido', () => {
    expect(noArConfirmado(base({ completed_at: null, restore_status: { title: campo('ok', 'vb', 1) } }), []).tipo).toBe('desconhecido')
  })
  it('combo: titulo C ok e miniatura recusada sobre B -> misto', () => {
    const r = noArConfirmado(base({ test_type: 'combo', restore_seq: 2, restore_status: { title: campo('ok', 'vc', 2), thumbnail: campo('falhou', 'vc', 2, false) } }),
      [h(1, 'thumbnail', 'ok', 'vb', 1), h(1, 'title', 'ok', 'vb', 1)])
    expect(r).toEqual({ tipo: 'misto', porCampo: { title: 'C', thumbnail: 'B' } })
  })
  it('retry so da miniatura ok C sobre seq 5 -> confirmado C', () => {
    const r = noArConfirmado(base({ test_type: 'combo', restore_seq: 6, restore_status: { title: campo('ok', 'vc', 2), thumbnail: campo('ok', 'vc', 4) } }),
      [h(5, 'title', 'ok', 'vc', 2), h(5, 'thumbnail', 'falhou', 'vc', 2, false)])
    expect(r).toMatchObject({ tipo: 'confirmado', letra: 'C', desde: t0(4) })
  })
  it('em_andamento recente sobre B ok -> desconhecido', () => {
    const r = noArConfirmado(base({ restore_seq: 2, restore_status: { title: campo('em_andamento', 'vc', 2, null) } }), [h(1, 'title', 'ok', 'vb', 1)])
    expect(r.tipo).toBe('desconhecido')
  })
  it('restore_status ok com historico vazio -> confirmado', () => {
    expect(noArConfirmado(base({ restore_seq: 7, restore_status: { title: campo('ok', 'vb', 1) } }), []).tipo).toBe('confirmado')
  })
  it('Manter: restore_seq sobe sem mudar o status e a linha atual nao duplica a do historico', () => {
    const entrada = { restore_status: { title: campo('ok', 'vb', 1) } }
    const a = noArConfirmado(base({ ...entrada, restore_seq: 1 }), [h(1, 'title', 'ok', 'vb', 1)])
    const b = noArConfirmado(base({ ...entrada, restore_seq: 2 }), [h(1, 'title', 'ok', 'vb', 1)])
    expect(b).toEqual(a)
  })
})
