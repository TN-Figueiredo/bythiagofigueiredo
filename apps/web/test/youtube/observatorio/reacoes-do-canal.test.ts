import { describe, it, expect } from 'vitest'
import { reacoesDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/reacoes-do-canal'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'

const vl = (id: string, likesHidden: boolean | null, commentsDisabled: boolean | null) => ({ id, likesHidden, commentsDisabled })
const canal = (dados: unknown[]) => ({ videos: { lido: true, dados } }) as unknown as CanalInteiro
const V = [{ id: 'a', likes: 0, comments: 0 }, { id: 'b', likes: 12, comments: 5 }, { id: 'c', likes: 7, comments: 0 }, { id: 'd', likes: 0, comments: 3 }, { id: 'e', likes: 0, comments: 4 }]

describe('reacoesDoCanal (só as exceções)', () => {
  it('inclui oculto, e 0 com sinalizador false; fora o que não muda a célula', () => {
    const r = reacoesDoCanal(canal([vl('a', false, false), vl('b', true, null), vl('c', false, false), vl('d', null, false), vl('e', false, false)]), V)
    expect(Object.keys(r!).sort()).toEqual(['a', 'b', 'c', 'e'])   // e: só curtidas 0 com false   // c: comentários 0 com false; d: nada (null/false com 3)
    expect(r!['b']).toEqual({ likesHidden: true, commentsDisabled: null })
  })
  it('vídeos não lidos ou lançamento: null', () => {
    expect(reacoesDoCanal({ videos: { lido: false, causa: 'erro_do_banco' } } as unknown as CanalInteiro, V)).toBeNull()
    expect(reacoesDoCanal({ videos: { lido: true, dados: null } } as unknown as CanalInteiro, V)).toBeNull()
  })
  it('id lido que a tela não tem é ignorado', () => {
    expect(reacoesDoCanal(canal([vl('zz', true, true)]), V)).toEqual({})
  })
})
