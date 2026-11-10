// @vitest-environment node
/**
 * M-1 do Yannis: a data das linhas de série é lida do texto da 1ª célula (`dd/mm`). Se o rótulo de `tabelaDeDiaADia` mudar (ex.: "3 nov"), toda linha sairia
 * "sem data" e a série morreria em silêncio. Este teste roda `diaDaLinha` sobre a saída REAL de `tabelaDeDiaADia` (a da linha do tempo do canal fica em
 * contexto-ia-canal-medidas.test.tsx) e exige 100% das linhas datadas. Dívida registrada: um campo `dia` ISO em `Tabela`.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: {} }))

import { diaDaLinha } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { tabelaDeDiaADia } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-proprio'
import { buildImpressoes } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'

const d = (n: number): DiaYt => `2026-10-${String(n).padStart(2, '0')}`
const dias: DiaAlcance[] = Array.from({ length: 12 }, (_, i) => ({ dia: d(i + 1), situacao: 'com-impressoes', motivo: null, imp: 10 + i, cliques: 1 }))

describe('contrato da data da série (rótulo dd/mm)', () => {
  it('toda linha de tabelaDeDiaADia (views e impressões) tem dia reconhecido pelo responder', () => {
    const g = buildImpressoes(dias, { de: d(1), ate: d(12), dias: 12 }, { escopo: 'canal', alturaArea: 180, dm: dmDia, acesso: 'ok', hoje: d(14) })
    const agora = Date.UTC(2026, 9, 14, 15)
    for (const cliques of [false, true]) {
      const [t] = tabelaDeDiaADia(g, 'modelo.grafico', 'id', 'Titulo', 'nome', cliques, 'soma')
      expect(t?.tipo).toBe('dia_a_dia')
      expect(t!.linhas.length).toBe(12)
      expect(t!.linhas.filter((l) => diaDaLinha(l, agora) === null).map((l) => l[0]!.texto)).toEqual([])
      expect(diaDaLinha(t!.linhas[0]!, agora)).toBe('2026-10-01')
    }
  })
})
