// @vitest-environment node
/** Decisão 75, Task 1: a derivação do estado de ausência. */
import { describe, it, expect } from 'vitest'
import { ausenciaDoAcesso, ausenciaDoMotivoVpd, ausenciaDoMotivoNaoMedido, ROTULO_AUSENCIA, type NegativaPrivada } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/estado'
import { MOTIVOS_NAO_MEDIDO } from '@/lib/youtube/observatorio/medidas/tipos'
import type { MotivoSemVpd } from '@/lib/youtube/observatorio/proprio/vpd'

describe('ausenciaDoAcesso', () => {
  const negativas: NegativaPrivada[] = ['sem_direito', 'nao_foi_possivel_conferir', null]
  it('ok é sempre null', () => { for (const n of negativas) expect(ausenciaDoAcesso('ok', n)).toBeNull() })
  it('erro é sempre falhou', () => { for (const n of negativas) expect(ausenciaDoAcesso('erro', n)).toBe('falhou') })
  it('negado só vira restrito com sem_direito', () => {
    expect(ausenciaDoAcesso('negado', 'sem_direito')).toBe('restrito')
    expect(ausenciaDoAcesso('negado', 'nao_foi_possivel_conferir')).toBe('falhou')
    expect(ausenciaDoAcesso('negado', null)).toBe('falhou')
  })
})

describe('ausenciaDoMotivoVpd', () => {
  const casos: Array<[MotivoSemVpd, string]> = [
    ['sem-acesso', 'restrito'], ['leitura-falhou', 'falhou'], ['sem-diario', 'nao_medido'], ['diario-parado', 'nao_medido'],
    ['sem-longos', 'nao_medido'], ['poucos-dias', 'nao_medido'], ['fora-da-leitura', 'nao_medido'],
  ]
  it.each(casos)('%s -> %s', (m, e) => expect(ausenciaDoMotivoVpd(m)).toBe(e))
  it('null -> null', () => expect(ausenciaDoMotivoVpd(null)).toBeNull())
})

describe('ausenciaDoMotivoNaoMedido', () => {
  it('só três motivos fogem de nao_medido, e fora do lado próprio nunca há restrito', () => {
    const fogem: string[] = []
    for (const m of MOTIVOS_NAO_MEDIDO) {
      const p = ausenciaDoMotivoNaoMedido(m, { proprio: true })
      const f = ausenciaDoMotivoNaoMedido(m, { proprio: false })
      expect(f).not.toBe('restrito')
      if (p !== 'nao_medido') fogem.push(m)
    }
    expect(fogem.sort()).toEqual(['calculo_falhou', 'leitura_falhou', 'sem_permissao'])
  })
  // Fonte do sem_permissao no lado próprio: a guarda real (sem_direito). `nao_pedido` e ler-comentarios.ts:57 ainda não podem ler M12 do próprio (portão duro do CQ T7).
  it('sem_permissao: restrito no próprio, não medido no canal de fora', () => {
    expect(ausenciaDoMotivoNaoMedido('sem_permissao', { proprio: true })).toBe('restrito')
    expect(ausenciaDoMotivoNaoMedido('sem_permissao', { proprio: false })).toBe('nao_medido')
    expect(ausenciaDoMotivoNaoMedido('leitura_falhou', { proprio: false })).toBe('falhou')
    expect(ausenciaDoMotivoNaoMedido('calculo_falhou', { proprio: true })).toBe('falhou')
  })
})

it('rótulos', () => expect(ROTULO_AUSENCIA).toEqual({ nao_medido: 'não medido', falhou: 'falhou', restrito: 'restrito' }))
