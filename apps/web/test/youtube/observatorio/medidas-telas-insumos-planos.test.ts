// A5 E5a, Tarefa 2: aplanar e remontar (Map vira lista de pares; ida e volta sem perda).
import { describe, expect, it } from 'vitest'
import { aplanar, remontar } from '@/lib/youtube/observatorio/medidas-telas/insumos-planos'
import { insumosCheios } from './medidas-fixture'
import type { Insumos } from '@/lib/youtube/observatorio/medidas/do-canal'

describe('E5a T2: insumos planos', () => {
  it('aplanar e remontar: ida e volta igual, com Map cheio', () => {
    const i = insumosCheios()
    expect(remontar(aplanar(i))).toEqual(i)
  })
  it('o plano cabe em JSON e volta igual', () => {
    const i = insumosCheios()
    expect(remontar(JSON.parse(JSON.stringify(aplanar(i))))).toEqual(i)
  })
  it('aplanar e remontar: ida e volta igual, com Map vazio e partes não lidas', () => {
    const i: Insumos = {
      canal: { lido: true, dados: { id: 'c', siteId: 's', collectionPausedAt: null, missingSince: null } },
      videos: { lido: true, dados: [] },
      marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } },
      retratos: { lido: false, causa: 'erro_do_banco' },
      series: 'nao_pedida', mudancas: { lido: false, causa: 'schema_ausente' },
      multiplos: new Map(), comentarios: { lido: false, causa: 'sem_permissao' },
    }
    expect(remontar(JSON.parse(JSON.stringify(aplanar(i))))).toEqual(i)
    expect(remontar(aplanar({ ...i, multiplos: 'nao_pedido', comentarios: 'nao_pedido' }))).toEqual({ ...i, multiplos: 'nao_pedido', comentarios: 'nao_pedido' })
  })
})
