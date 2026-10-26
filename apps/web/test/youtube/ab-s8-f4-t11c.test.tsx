// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))

import { toCardView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { ActiveTestCard } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-test-card'
import { CompletedRow } from '@/app/cms/(authed)/youtube/ab-lab/_components/completed-row'
import { StepRevisar } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import { useAvisoVolume } from '@/app/cms/(authed)/youtube/ab-lab/_components/use-aviso-volume'
import { rotuloDeConcluido } from '@/lib/youtube/ab-rotulo-v2'
import { estadoV2DoTeste, tetoDoTesteV2 } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { makeTestWithVariants } from '../helpers/ab-fixtures'
import { initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS, AB_TEST_CONFIG_DEFAULTS } from '@/lib/youtube/ab-types'

afterEach(cleanup)

const PENDENTE = 'encerrado pela regra nova; desfecho pendente'
const ILEGIVEL = 'encerrado pela regra nova; desfecho ilegível'
const NO_COWORK = 'encerrado pela regra nova; desfecho no Cowork'

describe('rotuloDeConcluido', () => {
  it('só vale para regra_v2', () => {
    expect(rotuloDeConcluido('manual_winner', null)).toBeNull()
    expect(rotuloDeConcluido(null, null)).toBeNull()
    expect(rotuloDeConcluido('max_duration', { v2: { desfecho: 'vencedor_provavel' } })).toBeNull()
  })
  it('regra_v2 com desfecho gravado: no Cowork', () => {
    expect(rotuloDeConcluido('regra_v2', { v2: { desfecho: 'inconclusivo_por_volume' } })).toBe(NO_COWORK)
  })
  it('regra_v2 sem desfecho (ou sem v2): pendente, nunca "sem vencedor"', () => {
    expect(rotuloDeConcluido('regra_v2', null)).toBe(PENDENTE)
    expect(rotuloDeConcluido('regra_v2', { v2: {} })).toBe(PENDENTE)
    expect(rotuloDeConcluido('regra_v2', {})).toBe(PENDENTE)
  })
  it('regra_v2 com v2 de formato inválido: ilegível', () => {
    expect(rotuloDeConcluido('regra_v2', { v2: { desfecho: 'xyz' } })).toBe(ILEGIVEL)
    expect(rotuloDeConcluido('regra_v2', { v2: 'lixo' })).toBe(ILEGIVEL)
  })
})

function concluido(reason: string | null, meta: unknown) {
  const t = makeTestWithVariants()
  const gravado: Record<string, unknown> = { completed_reason: reason, result_metadata: meta } // formato inválido de propósito
  return { ...t, status: 'completed' as const, completed_at: new Date().toISOString(), ...gravado }
}

describe('lista do concluído', () => {
  it.each([
    ['regra_v2 com desfecho', { v2: { desfecho: 'sem_diferenca_detectavel' } }, NO_COWORK],
    ['regra_v2 sem desfecho', null, PENDENTE],
    ['regra_v2 ilegível', { v2: { desfecho: 'xyz' } }, ILEGIVEL],
  ])('%s', (_n, meta, esperado) => {
    const card = toCardView(concluido('regra_v2', meta))
    render(<CompletedRow test={card} onOpen={() => {}} />)
    expect(screen.getByText(esperado)).toBeTruthy()
    expect(screen.queryByText(/sem vencedor/i)).toBeNull()
  })
  it('outro motivo não ganha rótulo', () => {
    const card = toCardView(concluido('manual_winner', null))
    expect(card.rotuloV2 ?? null).toBeNull()
  })
})

describe('Dia X/Y de v2 vem de estadoV2DoTeste', () => {
  it('cartão ativo v2 usa os dias fechados com ciclo, não os dias corridos', () => {
    const base = makeTestWithVariants({ startedDaysAgo: 5 })
    const ini = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const fim = new Date(Date.now() - 4 * 86_400_000).toISOString()
    const ciclos = [
      { id: 'c1', test_id: base.id, variant_id: 'var-a', cycle_number: 1, started_at: ini, ended_at: fim, backfill_status: 'confirmed', backfill_attempts: 0, applied_metadata: null, created_at: ini },
      { id: 'c2', test_id: base.id, variant_id: 'var-b', cycle_number: 2, started_at: fim, ended_at: null, backfill_status: 'confirmed', backfill_attempts: 0, applied_metadata: null, created_at: fim },
    ]
    const t = { ...base, regra_duracao: 'v2', config: { ...AB_TEST_CONFIG_DEFAULTS, max_duration_days: 15 }, ciclos }
    const card = toCardView(t)
    const est = estadoV2DoTeste(t, ciclos, null, new Date(), tetoDoTesteV2(t.config, t.variants.length))
    expect(card.diaV2).toEqual({ dia: est.dia, teto: 15 })
    render(<ActiveTestCard test={card} onOpen={() => {}} />)
    expect(screen.getByText(`Dia ${est.dia}/15`)).toBeTruthy()
  })
  it('v1 segue com o dia corrido', () => {
    const t = makeTestWithVariants({ startedDaysAgo: 5 })
    const card = toCardView(t)
    expect(card.diaV2 ?? null).toBeNull()
    render(<ActiveTestCard test={card} onOpen={() => {}} />)
    expect(screen.getByText(/^Dia 5\//)).toBeTruthy()
  })
})

const props = { type: 'thumbnail' as const, variants: [{ label: 'A' as const, thumbUrl: null, title: 't', isOriginal: true }, { label: 'B' as const, thumbUrl: null, title: 't', isOriginal: false }], config: initWizardConfig(AB_SITE_SETTINGS_DEFAULTS), meta: { canal: null, publicadoEm: null, duracao: null } }

describe('aviso de volume no passo de início', () => {
  it('mostra o texto como cartão com selo, inicial maiúscula e ponto', () => {
    render(<StepRevisar {...props} avisoVolume={{ estado: 'nao_chega', texto: 'este teste não chega ao volume em 15 dias' }} />)
    expect(screen.getByText('Este teste não chega ao volume em 15 dias.')).toBeTruthy()
    expect(screen.getByText('Volume insuficiente')).toBeTruthy()
  })
  it('sem texto (estado ok) não mostra nada', () => {
    const { container } = render(<StepRevisar {...props} avisoVolume={null} />)
    expect(container.querySelector('[data-aviso-volume]')).toBeNull()
  })
})

const okSemMedicao = { ok: true as const, aviso: { estado: 'sem_medicao' as const, texto: 'sem medição para estimar o volume' as const } }

describe('useAvisoVolume', () => {
  it('D1: passa o V da tela ao leitor e refaz a leitura quando V muda', async () => {
    const ler = vi.fn(async () => okSemMedicao)
    const { rerender } = renderHook(({ v }) => useAvisoVolume(ler, 'd1', true, v), { initialProps: { v: 2 } })
    await waitFor(() => expect(ler).toHaveBeenCalledWith('d1', { V: 2 }))
    rerender({ v: 3 })
    await waitFor(() => expect(ler).toHaveBeenCalledWith('d1', { V: 3 }))
  })
  it('lê pelo rascunho e devolve o estado com o texto; o aviso nunca bloqueia', async () => {
    const ler = vi.fn(async () => okSemMedicao)
    const { result } = renderHook(() => useAvisoVolume(ler, 'd1', true))
    await waitFor(() => expect(result.current).toEqual({ estado: 'sem_medicao', texto: 'sem medição para estimar o volume' }))
    expect(ler).toHaveBeenCalledWith('d1')
  })
  it('estado ok ⇒ null; erro ⇒ indisponivel (nunca null)', async () => {
    const ok = vi.fn(async () => ({ ok: true as const, aviso: { estado: 'ok' as const, texto: null, dias_previstos: 5, impressoes_dia: 1, n: 1, base_estimada: false } }))
    const a = renderHook(() => useAvisoVolume(ok, 'd1', true))
    await waitFor(() => expect(ok).toHaveBeenCalled())
    await waitFor(() => expect(a.result.current).toBeNull())
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ler = vi.fn(async () => ({ ok: false as const, error: 'x' }))
    const b = renderHook(() => useAvisoVolume(ler, 'd1', true))
    await waitFor(() => expect(b.result.current).toBe('indisponivel'))
  })
  it('inativo não lê; ativo sem rascunho ⇒ indisponivel', () => {
    const ler = vi.fn()
    const a = renderHook(() => useAvisoVolume(ler, null, true))
    const b = renderHook(() => useAvisoVolume(ler, 'd1', false))
    expect(ler).not.toHaveBeenCalled()
    expect(a.result.current).toBe('indisponivel')
    expect(b.result.current).toBeNull()
  })
})
