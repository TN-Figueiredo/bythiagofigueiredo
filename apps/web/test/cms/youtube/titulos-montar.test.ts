// F4 P2: pedido pronto nunca some da tela quando o vídeo sai de `proprios_agora` (tela = rota = MCP).
import { describe, expect, it } from 'vitest'
import { montarTitulos } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/titulos'
import type { ItemDeSinal } from '@/lib/youtube/observatorio/sinais/leitura'
import type { ParDeTitulos } from '@/lib/youtube/observatorio/sinais/titulos-complementares/ler'

const A = 'bbbbbbbb-0000-4000-8000-00000000000a'
const B = 'bbbbbbbb-0000-4000-8000-00000000000b'
const amostra = new Map([[A, { titulo: 'Vídeo A', miniatura: null, origem: 'proprio' as const, canal: null, chaves: [] }], [B, { titulo: 'Vídeo B', miniatura: null, origem: 'proprio' as const, canal: null, chaves: [] }]])
const pronto = (id: string): ParDeTitulos => ({ own_video_id: id, estado: 'pronto', titulos: ['Um', 'Dois'], gerado_em: '2026-10-29T10:00:00Z' })
const item = (o: Partial<ItemDeSinal>) => ({ id: 's1', ...o }) as ItemDeSinal
const forja = { leitura: 'ok' as const, forja_sabe_pedir: true }

describe('montarTitulos (P2)', () => {
  it('par pronto em vídeo fora de proprios_agora aparece junto com os de proprios_agora', () => {
    const v = montarTitulos(item({ proprios_agora: [A], titulos_complementares: [pronto(B)] }), amostra, 'Japão', forja)!
    expect(v.videos.map((x) => x.id)).toEqual([A, B])
    expect(v.videos[1]!.par).toMatchObject({ estado: 'pronto', titulos: ['Um', 'Dois'] })
  })
  it('proprios_agora vazio ou ausente com par pronto: a seção aparece com os títulos; sem nada, some', () => {
    for (const proprios_agora of [[], undefined]) {
      const v = montarTitulos(item({ ...(proprios_agora ? { proprios_agora } : {}), titulos_complementares: [pronto(B)] }), amostra, 'Japão', forja)!
      expect(v.videos).toHaveLength(1)
      expect(v.videos[0]!.par).toMatchObject({ estado: 'pronto' })
    }
    expect(montarTitulos(item({ proprios_agora: [] }), amostra, 'Japão', forja)).toBeNull()
  })
})
