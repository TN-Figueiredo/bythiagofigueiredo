// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { montarFaixa, faixaTentando, type CtxFaixa, type Faixa } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-restauracao-texto'
import { FaixaComAcoes } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-com-acoes'
import type { CampoRestauracao, RestoreStatus, ErroGravado } from '@/lib/youtube/ab-restore'
import { MSG_EM_ANDAMENTO, type ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const definirAviso = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/acoes-de-saida', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  definirAviso: (...a: unknown[]) => definirAviso(...a),
}))

beforeEach(() => { refresh.mockClear(); definirAviso.mockClear() })
afterEach(cleanup)

const AGORA = new Date('2026-10-12T09:00:00Z')
const ctx: CtxFaixa = { agora: AGORA, rotulo: id => id, noArAntes: 'C', noArDesde: null, youtubeId: 'yt123',
  vigiaUltimaExecucao: '2026-10-11T20:00:00Z', podeAdministrar: true, bloqueio: null, inicioDoSim: {} }
const recusa: ErroGravado = { status: 403, reason: 'forbidden', chamada: 'videos.update' }
function campo(p: Partial<CampoRestauracao>): CampoRestauracao {
  return { estado: 'ok', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: true, erro: null, attempts: 1, ...p }
}
const C: RestoreStatus = { title: campo({ estado: 'falhou', erro: recusa }), thumbnail: campo({}) }
const E: RestoreStatus = { title: campo({}), thumbnail: campo({ estado: 'pulado_drift' }) }
const OK: ResultadoAcaoSaida = { ok: true, resultado: 'feito', campos: {} }

function montar(rs: RestoreStatus, c: CtxFaixa, over: Partial<Parameters<typeof FaixaComAcoes>[0]> = {}) {
  const tentar = vi.fn(async () => OK)
  const dispensar = vi.fn(async () => OK)
  const faixa = montarFaixa(rs, c) as Faixa
  render(<FaixaComAcoes testId="t1" faixa={faixa} faixaTentando={faixaTentando(rs, c)} seqVisto={7} tentar={tentar} dispensar={dispensar} {...over} />)
  return { tentar, dispensar }
}

describe('FaixaComAcoes: aparência dos botões', () => {
  it('desabilitado tem opacidade reduzida e cursor not-allowed; texto do primário não é branco', () => {
    montar(C, ctx)
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('disabled:opacity-')
      expect(b.className).toContain('disabled:cursor-not-allowed')
    }
    const pri = screen.getByRole('button', { name: 'Tentar agora' })
    expect(pri.className).not.toMatch(/(^|\s)(hover:)?text-white/)
    expect(pri.className).toContain('--cms-on-accent')
  })

  it('classe final: primário sem text-cms-text-dim; secundário com text-cms-text (sobre a faixa) e sem a dim; transição válida', () => {
    montar(C, ctx)
    const pri = screen.getByRole('button', { name: 'Tentar agora' })
    const sec = screen.getByRole('button', { name: /Já corrigi/ })
    expect(pri.className.split(/\s+/)).not.toContain('text-cms-text-dim')
    expect(pri.className.split(/\s+/)).not.toContain('hover:text-cms-text')
    expect(sec.className.split(/\s+/)).not.toContain('text-cms-text-dim')
    expect(sec.className.split(/\s+/)).toContain('text-cms-text')
    for (const b of [pri, sec]) expect(b.className).not.toContain('transition-[0.15s]')
  })
})

describe('FaixaComAcoes', () => {
  it('C mostra "Tentar agora" e "Já corrigi no YouTube: dispensar aviso"', () => {
    montar(C, ctx)
    expect(screen.getByRole('button', { name: 'Tentar agora' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Já corrigi no YouTube: dispensar aviso' })).toBeTruthy()
  })
  it('E só o dispensar', () => {
    montar(E, ctx)
    expect(screen.queryByRole('button', { name: 'Tentar agora' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Já corrigi no YouTube: dispensar aviso' })).toBeTruthy()
  })
  it('I sem botões e com a frase de permissão', () => {
    const rs: RestoreStatus = { title: campo({ estado: 'falhou', destino: 'vb', erro: recusa }), thumbnail: campo({ destino: 'vb' }) }
    montar(rs, { ...ctx, podeAdministrar: false })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Só quem administra o site pode tentar de novo ou dispensar este aviso.')).toBeTruthy()
  })
  it('duplo clique em Tentar agora → tentar 1 vez; botões disabled; faixa "Voltando ao original…"', async () => {
    let solta!: (r: ResultadoAcaoSaida) => void
    const tentar = vi.fn(() => new Promise<ResultadoAcaoSaida>(r => { solta = r }))
    const faixa = montarFaixa(C, ctx) as Faixa
    render(<FaixaComAcoes testId="t1" faixa={faixa} faixaTentando={faixaTentando(C, ctx)} seqVisto={7} tentar={tentar} dispensar={vi.fn()} />)
    const b = screen.getByRole('button', { name: 'Tentar agora' })
    fireEvent.click(b); fireEvent.click(b)
    expect(tentar).toHaveBeenCalledTimes(1)
    expect(tentar).toHaveBeenCalledWith(7)
    expect(screen.getAllByRole('button').every(x => (x as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByText('Voltando ao original…')).toBeTruthy()
    await act(async () => { solta(OK) })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('erro em_andamento → definirAviso com MSG_EM_ANDAMENTO e refresh', async () => {
    const tentar = vi.fn(async () => ({ ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }) as ResultadoAcaoSaida)
    montar(C, ctx, { tentar })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar agora' })) })
    expect(definirAviso).toHaveBeenCalledWith('t1', MSG_EM_ANDAMENTO)
    expect(refresh).toHaveBeenCalled()
  })
  it('dispensar chama com a lista acoes.dispensar e o seqVisto', async () => {
    const { dispensar } = montar(C, ctx)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Já corrigi no YouTube: dispensar aviso' })) })
    expect(dispensar).toHaveBeenCalledWith(['title'], 7)
    expect(refresh).toHaveBeenCalled()
  })
})

describe('faixaDaPagina com os dados do servidor', () => {
  it('passa podeAdministrar/bloqueio à faixa e devolve faixaTentando', async () => {
    const { faixaDaPagina } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/faixa-da-pagina')
    const view = { status: 'completed', restoreStatus: C, variantDb: [], noArAntes: null, youtubeVideoId: 'yt123' } as unknown as Parameters<typeof faixaDaPagina>[0]
    const r = faixaDaPagina(view, C, AGORA, { vigiaUltimaExecucao: null, podeAdministrar: true, bloqueio: 'outro_teste', inicioDoSim: {} })
    expect(r.faixa && r.faixa.tom !== 'ok' && r.faixa.acoes.tentar).toBe(true)
    expect(r.faixa && r.faixa.tom !== 'ok' && r.faixa.linhas[0]!.texto).toContain('Sem nova tentativa automática')
    expect(r.faixaTentando && r.faixaTentando.tom !== 'ok' && r.faixaTentando.lbl).toBe('Voltando ao original…')
  })
})
