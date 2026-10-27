// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { painelDaUrl, hrefDoPainel } from '@/app/cms/(authed)/youtube/ab-lab/painel-param'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
describe('M7b: ?painel=<testId>', () => {
  it('aceita só uuid; o resto vira nulo', () => {
    expect(painelDaUrl(ID)).toBe(ID)
    expect(painelDaUrl(ID.toUpperCase())).toBe(ID)
    for (const x of [undefined, '', 'abc', `${ID}x`, ['a', 'b'], "' or 1=1 --"]) expect(painelDaUrl(x as string)).toBeNull()
  })
  it('o href leva o id', () => { expect(hrefDoPainel(ID)).toBe(`/cms/youtube/ab-lab?painel=${ID}`) })
})

import { motivoDe } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/ficha-faixas'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'

describe('M7b: motivo da ficha para campo da escolha do dono', () => {
  const campo = (o: Record<string, unknown>) => ({ estado: 'falhou', destino: 'vb', em: '2026-10-12T08:00:00Z', forcado: false, escreveu: false, erro: null, attempts: 1, ...o })
  it('só campo do dono pendente: "escolha" (link do painel); com outro campo pendente: "tentar"; nada pendente: "conferir"', () => {
    expect(motivoDe({ title: campo({ iniciativa: 'dono' }) } as unknown as RestoreStatus)).toBe('escolha')
    expect(motivoDe({ title: campo({ iniciativa: 'dono' }), thumbnail: campo({}) } as unknown as RestoreStatus)).toBe('tentar')
    expect(motivoDe({ title: campo({ estado: 'ok' }) } as unknown as RestoreStatus)).toBe('conferir')
  })
})
