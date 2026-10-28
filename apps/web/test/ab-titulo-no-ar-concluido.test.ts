import { describe, it, expect } from 'vitest'
import { tituloNoArDoConcluido, tituloNoArLido } from '@/lib/youtube/ab-lab-pagina/concluidos'

const variantes = [
  { id: 'a', letra: 'A', is_original: true, title_text: null },
  { id: 'b', letra: 'B', is_original: false, title_text: 'Título de B' },
  { id: 'c', letra: 'C', is_original: false, title_text: 'Título de C' },
]
const base = { test_type: 'title' as const, winner_variant_id: 'b', winner_applied_at: null, completed_at: '2026-10-20T10:00:00Z', original_title: 'Título original', name: 'Teste' }
const ok = (destino: string) => ({ title: { estado: 'ok', destino, forcado: false, escreveu: true, erro: null, em: '2026-10-26T10:00:00Z', attempts: 0 } })

describe('tituloNoArDoConcluido (cabeçalho do concluído)', () => {
  it('B aplicada e confirmada: mostra o título de B', () => {
    expect(tituloNoArDoConcluido({ ...base, restore_status: ok('b') }, variantes)).toBe('Título de B')
  })
  it('sem confirmação: mostra o original, nunca o de uma variante (mesmo com B vencedora)', () => {
    expect(tituloNoArDoConcluido({ ...base, restore_status: {} }, variantes)).toBe('Título original')
    expect(tituloNoArDoConcluido({ ...base, restore_status: { title: { ...ok('b').title, estado: 'falhou' } } }, variantes)).toBe('Título original')
  })
  it('original no ar: título do vídeo; sem original_title cai no nome', () => {
    expect(tituloNoArDoConcluido({ ...base, restore_status: ok('original') }, variantes)).toBe('Título original')
    expect(tituloNoArDoConcluido({ ...base, original_title: null, restore_status: {} }, variantes)).toBe('Teste')
  })
  it('legado v1 (sem restore_status) com vencedora aplicada: título dela', () => {
    expect(tituloNoArDoConcluido({ ...base, restore_status: undefined, winner_applied_at: '2026-10-21T10:00:00Z' }, variantes)).toBe('Título de B')
  })
})

describe('tituloNoArLido (M7b T15b-2: fonte única com o histórico)', () => {
  const h = (seq: number, destino: string, estado: 'ok' | 'falhou' = 'ok', escreveu: boolean | null = true) =>
    ({ seq, campo: 'title' as const, destino, estado, escreveu, em: '2026-10-26T10:00:00Z' })
  const falhou = (destino: string) => ({ title: { estado: 'falhou', destino, forcado: false, escreveu: null, erro: 'x', em: '2026-10-27T10:00:00Z', attempts: 1 } })

  it('confirmado: o título da versão, sem selo', () => {
    expect(tituloNoArLido({ ...base, restore_status: ok('b') }, variantes, [])).toEqual({ titulo: 'Título de B', naUltimaLeitura: false })
  })
  it('B escolhida, depois C falhou sem escrever: mostra o título de B com o selo "na última leitura", nunca o original', () => {
    const t = { ...base, restore_seq: 2, restore_status: falhou('c') }
    expect(tituloNoArLido(t, variantes, [h(1, 'b')])).toEqual({ titulo: 'Título de B', naUltimaLeitura: true })
  })
  it('C em escreveu: null (incerto) sem nada antes: o original, sem selo', () => {
    const t = { ...base, restore_seq: 1, restore_status: falhou('c') }
    expect(tituloNoArLido(t, variantes, [])).toEqual({ titulo: 'Título original', naUltimaLeitura: false })
  })
  it('histórico não lido (null): desconhecido, nunca o título de uma variante só por ser a vencedora', () => {
    const t = { ...base, restore_status: undefined, winner_applied_at: null }
    expect(tituloNoArLido(t, variantes, null)).toEqual({ titulo: 'Título original', naUltimaLeitura: false })
  })
  it('teste só de miniatura: sempre original_title ?? name', () => {
    expect(tituloNoArLido({ ...base, test_type: 'thumbnail', restore_status: ok('b') }, variantes, []).titulo).toBe('Título original')
    expect(tituloNoArLido({ ...base, test_type: 'thumbnail', original_title: null, restore_status: ok('b') }, variantes, []).titulo).toBe('Teste')
  })
  it('B escolhida e depois a original de volta (Reverter): o título é o do vídeo', () => {
    const t = { ...base, restore_seq: 2, restore_status: ok('original') }
    expect(tituloNoArLido(t, variantes, [h(1, 'b')]).titulo).toBe('Título original')
  })
})
