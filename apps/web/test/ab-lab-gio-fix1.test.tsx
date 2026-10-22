// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { FichaTeste, type AcoesFicha } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/ficha-teste'
import { mesclar } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/use-ficha-gravada'
import { fichaLida, AGORA_FICHA } from './helpers/ficha-fixture'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
afterEach(() => cleanup())

const linha = { titulo: 'Rota 66', miniaturaUrl: null, nosso: null }
const acoes = { salvarFicha: vi.fn(), enviarImagemDaFicha: vi.fn(), recomecarFicha: vi.fn() } as unknown as AcoesFicha
const montar = (f: FichaLida) => render(<FichaTeste linha={linha} inicial={f} acoes={acoes} fechar={vi.fn()} agora={() => AGORA_FICHA} largura="larga" />)
const diasAtras = (d: number, extraH = 0): string => new Date(AGORA_FICHA.getTime() - (d * 24 + extraH) * 3600_000).toISOString()

describe('Gio F-3: ficha nova (campos vazios)', () => {
  it('a ficha da lista com campos [] oferece o campo de título da B (Título marcado)', () => {
    montar(fichaLida({ campos: [], variantes: [] }))
    expect(screen.getByLabelText(/Título da versão B/)).toBeTruthy()
    expect(screen.queryByText(FRASES.ficha.baixarImagem)).toBeNull()
  })
  it('mesclar: campos [] vira ["titulo"] no rascunho (o que a primeira gravação envia)', () => {
    expect(mesclar(fichaLida({ campos: [], variantes: [] }), {}).campos).toEqual(['titulo'])
    expect(mesclar(fichaLida({ campos: ['miniatura'], variantes: [] }), {}).campos).toEqual(['miniatura'])
  })
})

describe('Gio F-7: faixa "Ficha parada desde"', () => {
  it('ficha de 13 d 1 h mostra a faixa com a data de parada e a do descarte', () => {
    const f = fichaLida({ criada_em: diasAtras(13, 1), atualizada_em: diasAtras(13, 1) })
    montar(f)
    const faixa = FRASES.ficha.faixaParada(new Date(diasAtras(13, 1)), new Date(Date.parse(diasAtras(13, 1)) + 14 * 86_400_000))
    expect(screen.getByText(faixa.titulo)).toBeTruthy()
    expect(screen.getByText(faixa.apoio)).toBeTruthy()
  })
  it('ficha de 2 d não mostra a faixa', () => {
    montar(fichaLida({ criada_em: diasAtras(2), atualizada_em: diasAtras(2) }))
    expect(screen.queryByText(/Ficha parada desde/)).toBeNull()
  })
})
