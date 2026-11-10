// @vitest-environment node
/**
 * A5 F0.5a (Yannis M2): o portão (8) do JSON para Destaques e Mudanças. Grava, nas fixtures das duas telas, o degrau do corte e quantas linhas de JSON
 * entram na cópia. Mudanças "7 dias" está a poucos caracteres do limite: coluna nova (o `Id` da F1b) muda este instantâneo de propósito, e o diff mostra.
 */
import { describe, it, expect } from 'vitest'
import { casosDeOutliers, casosDeMudancas } from './contexto-ia-x-telas-fixture'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { resumir } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const AGORA = Date.UTC(2026, 10, 10, 15, 0, 0)
const medir = (casos: Array<{ nome: string; pacote: PacoteModelo }>) => casos.map((c) => {
  const r = resumir(segmentar(c.pacote, { geradoEm: AGORA, recente: null }), 'Qual é o destaque?')
  return [c.nome, r.copia.degrau, r.copia.texto.split('\n').filter((l) => l.startsWith('    {"tabela"')).length] as const
})

describe('Destaques e Mudanças: degrau e linhas de JSON na cópia (portão 8)', () => {
  it('Destaques', () => {
    const m = medir(casosDeOutliers())
    expect(m.length).toBe(9)
    expect(m).toMatchInlineSnapshot(`
      [
        [
          "padrão",
          null,
          39,
        ],
        [
          "Viagem, longos",
          null,
          25,
        ],
        [
          "IA, Shorts, 181–365 dias (vazio)",
          null,
          12,
        ],
        [
          "múltiplo mínimo 0",
          10,
          42,
        ],
        [
          "todas as idades, base fraca",
          10,
          43,
        ],
        [
          "IA, por views",
          null,
          24,
        ],
        [
          "Viagem, assunto antigo que ainda rende",
          10,
          38,
        ],
        [
          "IA, assunto antigo com a mediana do canal",
          10,
          45,
        ],
        [
          "leitura da forja de IA",
          null,
          10,
        ],
      ]
    `)
  })
  it('Mudanças', () => {
    const m = medir(casosDeMudancas())
    expect(m.length).toBe(10)
    expect(m).toMatchInlineSnapshot(`
      [
        [
          "um canal",
          10,
          61,
        ],
        [
          "Shorts, 90 dias",
          null,
          32,
        ],
        [
          "um vídeo",
          null,
          22,
        ],
        [
          "padrão",
          5,
          54,
        ],
        [
          "90 dias",
          5,
          54,
        ],
        [
          "7 dias",
          null,
          81,
        ],
        [
          "30 dias, só títulos",
          25,
          67,
        ],
        [
          "90 dias, só descrições",
          null,
          62,
        ],
        [
          "IA, 90 dias",
          5,
          51,
        ],
        [
          "só medidas, 90 dias",
          5,
          51,
        ],
      ]
    `)
  })
})
