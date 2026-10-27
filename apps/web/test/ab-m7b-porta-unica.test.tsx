// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ResultadoConferir, ResultadoEscolha } from '@/lib/youtube/ab-acao-saida'
import { PainelOQueFica } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/painel-o-que-fica'
import type { AcoesDecisao } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/painel-o-que-fica'
import { montarPainelEscolha, type EntradaPainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import type { NoArConfirmado, NoArLido } from '@/lib/youtube/ab-no-ar'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))

const ID = { A: 'va', B: 'vb', C: 'vc' } as const
const conf = (l: 'A' | 'B' | 'C', desde: string | null = '2026-10-26T15:00:00.000Z'): NoArConfirmado => ({ tipo: 'confirmado', varianteId: ID[l], letra: l, desde })

function entrada(o: { ar: 'A' | 'B' | 'C'; sug: 'A' | 'B' | 'C' | null; escolha?: 'A' | 'B' | 'C'; ctr?: 'norm' | 'inc'; noAr?: NoArLido; podeAdministrar?: boolean; miniatura?: string | null }): EntradaPainelEscolha {
  const ctr = o.ctr === 'inc' ? { A: 0.041, B: 0.043, C: null } : { A: 0.039, B: 0.052, C: 0.044 }
  return {
    testId: 't1', nomeVideo: 'Bangkok', tipo: 'title', restoreSeq: 3, podeAdministrar: o.podeAdministrar ?? true,
    variantes: (['A', 'B', 'C'] as const).map(l => ({ id: ID[l], letra: l, original: l === 'A', titulo: `Título ${l}`, miniatura: o.miniatura === undefined ? `https://img/${l}.jpg` : o.miniatura, ctr: ctr[l] })),
    sugeridaId: o.sug ? ID[o.sug] : null, noAr: o.noAr ?? conf(o.ar), originalGuardada: { titulo: true, miniatura: true },
    escolha: o.escolha ? { varianteId: ID[o.escolha], em: '2026-10-27T15:00:00.000Z' } : null,
  }
}

const noArC: ResultadoEscolha = { ok: true, resultado: 'no_ar', noAr: conf('C', null), restoreSeq: 4 }
function acoes(o: { escolher?: AcoesDecisao['escolher']; conferir?: AcoesDecisao['conferir'] } = {}) {
  return {
    encerrar: vi.fn(),
    escolher: vi.fn(o.escolher ?? (async () => noArC)),
    conferir: vi.fn(o.conferir ?? (async (): Promise<ResultadoConferir> => ({ ok: false, estado: 'sem_leitura', error: 'x' }))),
  } as unknown as AcoesDecisao & { escolher: ReturnType<typeof vi.fn>; conferir: ReturnType<typeof vi.fn> }
}
function monta(e: EntradaPainelEscolha, a = acoes()) {
  const onFechar = vi.fn()
  const r = render(<PainelOQueFica painel={montarPainelEscolha(e)} acoes={a} onFechar={onFechar} />)
  return { a, onFechar, ...r }
}
const clica = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeEach(() => { refresh.mockClear() })
afterEach(cleanup)

describe('M7b T14: porta única da escolha no concluído', () => {
  it('"Aplicar" da sugerida (item do Com você) passa por escolherVersao; encerrar nunca é chamada', async () => {
    const a = acoes()
    render(<PainelOQueFica painel={montarPainelEscolha(entrada({ ar: 'A', sug: 'B' }))} acoes={a} onFechar={vi.fn()} />)
    await clica(screen.getByRole('button', { name: 'Deixar B no ar' }))
    expect(a.escolher).toHaveBeenCalledWith('t1', 'vb', 3)
    expect(a.encerrar).not.toHaveBeenCalled()
  })
})
