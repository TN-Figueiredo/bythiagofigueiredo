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

describe('FaixaComAcoes: aparência dos botões (r3)', () => {
  it('desabilitado: secundário em superfície neutra legível; primário sem opacidade, cursor progress; texto do primário não é branco no escuro e é #FFF8F0 no claro', () => {
    montar(C, ctx)
    const pri = screen.getByRole('button', { name: 'Tentar agora' })
    const sec = screen.getByRole('button', { name: /Já corrigi/ })
    expect(sec.className).toContain('disabled:cursor-not-allowed')
    expect(sec.className).toContain('disabled:opacity-100')
    expect(sec.className).toContain('disabled:bg-cms-surface-hover')
    expect(sec.className).toContain('disabled:border-cms-border')
    expect(sec.className).toContain('[[data-theme=dark]_&]:disabled:border-[rgba(146,136,113,.45)]')
    expect(sec.className).not.toMatch(/disabled:opacity-50/)
    expect(pri.className).toContain('disabled:cursor-progress')
    expect(pri.className).toContain('disabled:opacity-100')
    expect(pri.className).not.toMatch(/(^|\s)(hover:)?text-white/)
    expect(pri.className).toContain('text-[#1A120A]')
    expect(pri.className).toContain('[[data-theme=light]_&]:text-[#FFF8F0]')
    expect(pri.className).not.toContain('--cms-on-accent')
  })

  it('botões da faixa: 36 px (py-[7px] leading-5 min-h-[36px] px-4 text-[13px]), borda --btn-ctl, 44 px em toque', () => {
    montar(C, ctx)
    for (const b of screen.getAllByRole('button')) {
      const c = b.className.split(/\s+/)
      for (const k of ['py-[7px]', 'leading-5', 'px-4', 'text-[13px]', 'gap-2', 'min-h-[36px]', '[@media(pointer:coarse)]:min-h-[44px]']) expect(c).toContain(k)
      expect(c).not.toContain('py-[6px]')
      expect(c).not.toContain('border-cms-border')
    }
    const pri = screen.getByRole('button', { name: 'Tentar agora' })
    expect(pri.className).toContain('border-pb-accent')
    expect(pri.className).toContain('bg-pb-accent')
    expect(pri.className).not.toContain('bg-cms-accent')
  })

  it('BTN_SAIDA (Pausar/Encerrar) mantém o tamanho antigo e ganha só a borda --btn-ctl', async () => {
    const { BTN_SAIDA, BTN_BASE } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/acoes-de-saida')
    expect(BTN_BASE).toContain('border-[color:var(--btn-ctl)]')
    expect(BTN_BASE).not.toContain('border-cms-border')
    expect(BTN_SAIDA).toContain('py-[6px]')
    expect(BTN_SAIDA).toContain('text-[12.5px]')
  })

  it('classe final: primário sem text-cms-text-dim; secundário com text-cms-text; transição válida', () => {
    montar(C, ctx)
    const pri = screen.getByRole('button', { name: 'Tentar agora' })
    const sec = screen.getByRole('button', { name: /Já corrigi/ })
    expect(pri.className.split(/\s+/)).not.toContain('text-cms-text-dim')
    expect(pri.className.split(/\s+/)).not.toContain('hover:text-cms-text')
    expect(sec.className.split(/\s+/)).not.toContain('text-cms-text-dim')
    expect(sec.className.split(/\s+/)).toContain('text-cms-text')
    for (const b of [pri, sec]) expect(b.className).not.toContain('transition-[0.15s]')
  })

  it('link, nota e botões no mesmo .fr-acoes, na ordem; botões em .fr-botoes', () => {
    montar(C, ctx)
    const acoes = document.querySelector('.fr-acoes')!
    expect(acoes).toBeTruthy()
    const botoes = acoes.querySelector('.fr-botoes')!
    expect(botoes.querySelectorAll('button')).toHaveLength(2)
    expect(acoes.querySelector('a.fr-lnk')).toBeTruthy()
    expect(botoes.className).not.toContain('mt-2')
    expect(acoes.firstElementChild?.tagName).toBe('A')
  })

  it('sem permissão: a frase fica dentro do .fr-acoes, junto do link', () => {
    const rs: RestoreStatus = { title: campo({ estado: 'falhou', destino: 'vb', erro: recusa }), thumbnail: campo({ destino: 'vb' }) }
    montar(rs, { ...ctx, podeAdministrar: false })
    const frase = screen.getByText('Só quem administra o site pode tentar de novo ou dispensar este aviso.')
    expect(frase.closest('.fr-acoes')).toBeTruthy()
  })

  it('"Tentando…" no primário durante a chamada, com aria-busy e cursor-progress', async () => {
    let solta!: (r: ResultadoAcaoSaida) => void
    const tentar = vi.fn(() => new Promise<ResultadoAcaoSaida>(r => { solta = r }))
    montar(C, ctx, { tentar })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar agora' }))
    const b = await screen.findByRole('button', { name: 'Tentando…' })
    expect(b.getAttribute('aria-busy')).toBe('true')
    expect(b.className).toContain('disabled:cursor-progress')
    expect(screen.queryByRole('button', { name: 'Tentar agora' })).toBeNull()
    await act(async () => { solta(OK) })
  })

  it('dispensar em curso: primário continua "Tentar agora"', async () => {
    let solta!: (r: ResultadoAcaoSaida) => void
    const dispensar = vi.fn(() => new Promise<ResultadoAcaoSaida>(r => { solta = r }))
    montar(C, ctx, { dispensar })
    fireEvent.click(screen.getByRole('button', { name: /Já corrigi/ }))
    expect(await screen.findByRole('button', { name: 'Tentar agora' })).toBeTruthy()
    await act(async () => { solta(OK) })
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
