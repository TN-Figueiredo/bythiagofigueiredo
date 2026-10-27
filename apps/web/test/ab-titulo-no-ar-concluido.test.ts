import { describe, it, expect } from 'vitest'
import { tituloNoArDoConcluido } from '@/lib/youtube/ab-lab-pagina/concluidos'

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
