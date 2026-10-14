import { describe, it, expect } from 'vitest'
import { lerArgs } from '@/lib/youtube/portao-dhash/regras'

describe('lerArgs', () => {
  it('aceita os quatro comandos com um vídeo aprovado', () => {
    for (const c of ['ensaio', 'valer', 'devolver', 'conferir'])
      expect(lerArgs([c, '6jL-jeux_1Y'])).toEqual({ ok: true, comando: c, video: '6jL-jeux_1Y', aceitarMenor: false })
  })
  it('aceita a reserva e --aceitar-menor', () => {
    expect(lerArgs(['valer', 'WDRy_uldCI8', '--aceitar-menor'])).toMatchObject({ ok: true, aceitarMenor: true })
  })
  it('recusa vídeo fora da lista do dono', () => {
    expect(lerArgs(['valer', 'dQw4w9WgXcQ'])).toMatchObject({ ok: false })
  })
  it('recusa comando desconhecido, flag desconhecida e falta de vídeo', () => {
    expect(lerArgs(['apagar', '6jL-jeux_1Y']).ok).toBe(false)
    expect(lerArgs(['valer', '6jL-jeux_1Y', '--forcar']).ok).toBe(false)
    expect(lerArgs(['valer']).ok).toBe(false)
  })
  it('distancias pede dois arquivos ou mais', () => {
    expect(lerArgs(['distancias', 'a.jpg', 'b.jpg'])).toEqual({ ok: true, comando: 'distancias', arquivos: ['a.jpg', 'b.jpg'] })
    expect(lerArgs(['distancias', 'a.jpg']).ok).toBe(false)
  })
  it('devolver-hq: só vídeo aprovado e sem flags; medir: qualquer id de 11 caracteres com referências', () => {
    expect(lerArgs(['devolver-hq', '6jL-jeux_1Y'])).toMatchObject({ ok: true, comando: 'devolver-hq' })
    expect(lerArgs(['devolver-hq', 'dQw4w9WgXcQ']).ok).toBe(false)
    expect(lerArgs(['devolver-hq', '6jL-jeux_1Y', '--aceitar-menor']).ok).toBe(false)
    expect(lerArgs(['medir', 'dQw4w9WgXcQ', 'a.jpg', 'https://x/b.jpg'])).toEqual({ ok: true, comando: 'medir', video: 'dQw4w9WgXcQ', referencias: ['a.jpg', 'https://x/b.jpg'] })
    expect(lerArgs(['medir', 'dQw4w9WgXcQ']).ok).toBe(false)
  })
})
