// @vitest-environment jsdom
// M9b conserto 1: botões, diálogo, status do bloco, CSS da rota e normalização do nome.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { BlocoCanaisRemovidosView } from '@/app/cms/(authed)/youtube/competitors/_arquivo/bloco-canais-removidos'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { montarBloco, type ListaRemovidosV2 } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { lerPendencias, pendenciasParaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import { nomeConfere } from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'

vi.mock('server-only', () => ({}))
const AGORA = Date.parse('2028-05-03T15:00:00Z'), D = 86_400_000
const REF = 'aaaaaaaa-1111-2222-3333-444444444444'
const casa = { estado: 'responde' as const, desde: null, forma: 'visto' as const, frase: '' }
const cap = { comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null, blobsLigados: true }
const iso = (d: number): string => new Date(AGORA - d * D).toISOString()
const linha = (o: Record<string, unknown> = {}): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: REF, estado: 'guardado', decided_at: null,
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: iso(5), removido_via: 'botao',
  primeiro_mes: '2026-10', ultimo_mes: '2027-11', meses: 14, registros: 1, classes: [], ...o }) as ListaRemovidosV2[number]
const pend = { ok: true as const, canais: new Map([[REF, { tempo: 'copiar' as const, falta: null, snapLiberaEm: null, snapBloqueio: null, marcadoRodadoEm: null, b2Nomes: 0 }]]) }
const montar = (ls: ListaRemovidosV2[number][]) => montarBloco(ls, { agora: AGORA, casa, cap, administra: true, pend })
afterEach(cleanup)

const digitaEConfirma = (nome = 'Viagem Lenta') => {
  fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
  fireEvent.change(screen.getByLabelText('Nome do canal'), { target: { value: nome } })
  return screen.getAllByRole('button', { name: 'Apagar do arquivo' }).at(-1)!
}

describe('duplo clique', () => {
  it('Apagar do arquivo: dois cliques seguidos chamam a action UMA vez', async () => {
    let solta!: (r: { ok: true; status: 'ok' }) => void
    const onApagar = vi.fn(() => new Promise<{ ok: true; status: 'ok' }>(r => { solta = r }))
    render(<BlocoCanaisRemovidosView bloco={montar([linha()])} onApagar={onApagar} />)
    const b = digitaEConfirma()
    fireEvent.click(b); fireEvent.click(b); fireEvent.click(b)
    expect(onApagar).toHaveBeenCalledTimes(1)
    solta({ ok: true, status: 'ok' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  const tela = () => {
    const l = lerPendencias({ versao: 2, lido_em: new Date(AGORA).toISOString(), total: 1, itens: [{ item_id: `canal:${REF}`, kind: 'canal', tempo: 'copiar', desde: iso(5), mes: null, channel_ref: REF, youtube_id: null, marcado_rodado_em: null, apagar: [], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null }] })
    const t = pendenciasParaTela(l, { podeVerComandos: true, agora: new Date(AGORA) })
    if (t.estado !== 'com_itens') throw new Error('fixture')
    return t
  }
  it('Já rodei: três cliques seguidos, uma chamada', async () => {
    let solta!: (r: { ok: true }) => void
    const onMarcar = vi.fn(() => new Promise<{ ok: true }>(r => { solta = r }))
    render(<EsperamComandos t={tela()} onMarcarRodado={onMarcar} onDesfazerRodado={vi.fn()} />)
    const b = screen.getByRole('button', { name: 'Já rodei' })
    fireEvent.click(b); fireEvent.click(b); fireEvent.click(b)
    expect(onMarcar).toHaveBeenCalledTimes(1)
    solta({ ok: true })
    await screen.findByText(/Marcado como rodado em/)
  })
  it('Desfazer que falha: o aviso diz que a marca continua, nunca "Nada foi marcado"', async () => {
    const t = (() => { const x = tela(); return { ...x, itens: x.itens.map(i => ({ ...i, marcadoRodadoEm: new Date(AGORA - 3_600_000) })) } })()
    render(<EsperamComandos t={t} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn().mockResolvedValue({ ok: false, erro: 'interno' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    const a = await screen.findByRole('alert')
    expect(a.textContent).toContain('A marca continua')
    expect(a.textContent).not.toContain('Nada foi marcado')
  })
  it('Desfazer que lança: não afirma "não foi marcado"', async () => {
    const t = (() => { const x = tela(); return { ...x, itens: x.itens.map(i => ({ ...i, marcadoRodadoEm: new Date(AGORA - 3_600_000) })) } })()
    render(<EsperamComandos t={t} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn().mockRejectedValue(new Error('x'))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Não sabemos se a marca foi desfeita. Recarregue a página antes de tentar de novo.')
  })
  it('marca atrasada (forja parada): diz que a verificação não rodou, sem "volte em até 24 horas"', () => {
    const t = (() => { const x = tela(); return { ...x, itens: x.itens.map(i => ({ ...i, marcadoRodadoEm: new Date(AGORA - 2 * D), marcadoAtrasado: true })) } })()
    render(<EsperamComandos t={t} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn()} />)
    expect(document.querySelector('[data-atrasado]')!.textContent).toContain('A verificação não rodou')
    expect(document.body.textContent).not.toContain('Volte em até 24 horas')
  })
})

describe('item 12: o status sobrevive à linha', () => {
  it('depois de apagar por código, a linha some/refaz e o aviso fica na região viva do bloco', async () => {
    const onApagar = vi.fn().mockResolvedValue({ ok: true, status: 'ok' })
    const sd = linha({ estado: 'sem_destino', nome: null, removido_em: null, removido_via: 'sem_registro', meses: 9, ultimo_mes: '2027-06' })
    const { rerender } = render(<BlocoCanaisRemovidosView bloco={montar([sd])} onApagar={onApagar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
    fireEvent.change(screen.getByLabelText('Código do arquivo'), { target: { value: 'aaaaaaaa' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Apagar do arquivo' }).at(-1)!)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // o servidor devolve a lista nova: a linha mudou de estado (pedido) e remonta
    rerender(<BlocoCanaisRemovidosView bloco={montar([linha({ estado: 'pedido', nome: null, decided_at: iso(0), removido_via: 'sem_registro' })])} onApagar={onApagar} />)
    const regioes = screen.getAllByRole('status')
    expect(regioes.some(r => r.textContent === 'Limpeza pedida para AAAAAAAA.')).toBe(true)
  })
})

describe('foco preso no diálogo', () => {
  it('Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último', () => {
    render(<BlocoCanaisRemovidosView bloco={montar([linha()])} onApagar={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
    const dlg = screen.getByRole('dialog')
    const campo = screen.getByLabelText('Nome do canal') as HTMLInputElement
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    cancelar.focus()
    fireEvent.keyDown(dlg, { key: 'Tab' })
    expect(document.activeElement).toBe(campo)
    fireEvent.keyDown(dlg, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cancelar)
  })
})

describe('item 11: a rota /arquivo carrega o CSS do painel e do botão perigo', () => {
  const raiz = 'src/app/cms/(authed)/youtube/competitors/'
  it('page.tsx e painel-comandos importam esperam-comandos.css (p7-cmd, p7-sh)', () => {
    expect(readFileSync(raiz + 'arquivo/page.tsx', 'utf8')).toContain("import '../_canais/esperam-comandos.css'")
    expect(readFileSync(raiz + '_arquivo/painel-comandos.tsx', 'utf8')).toContain("esperam-comandos.css")
    const css = readFileSync(raiz + '_canais/esperam-comandos.css', 'utf8')
    for (const c of ['.p7-cmd{', '.p7-sh{']) expect(css).toContain(c)
  })
  it('arquivo.css estiliza .btn, .btn.danger e o toque (44 px), sem color-mix', () => {
    const css = readFileSync(raiz + '_arquivo/arquivo.css', 'utf8')
    expect(css).toMatch(/\.arq-removidos \.btn\.danger/)
    expect(css).toMatch(/\.arq-removidos \.btn\.small\{min-height:44px\}/)
    expect(css).toMatch(/\.arq-cmd\{[^}]*max-width:100%/)
    expect(css.split('sem color-mix. */')[1]!).not.toContain('color-mix')
  })
  it('o texto do aviso do painel e da peça 7 usam a MESMA CopiarLinha (uma definição só)', () => {
    expect(readFileSync(raiz + '_canais/esperam-comandos.tsx', 'utf8')).not.toMatch(/function CopiarLinha/)
    expect(readFileSync(raiz + '_canais/esperam-comandos.tsx', 'utf8')).toContain("from '../_arquivo/painel-comandos'")
  })
})

describe('nomeConfere e NFC', () => {
  it('o "é" decomposto (colado do macOS) confere com o composto, nos dois sentidos', () => {
    const composto = 'Viagem Lenta é Ção', decomposto = composto.normalize('NFD')
    expect(decomposto).not.toBe(composto)
    expect(nomeConfere(decomposto, composto)).toBe(true)
    expect(nomeConfere(composto, decomposto)).toBe(true)
    expect(nomeConfere('Cao', 'Ção')).toBe(false)
  })
})
