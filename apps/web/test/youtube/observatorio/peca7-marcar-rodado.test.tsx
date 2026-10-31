// @vitest-environment jsdom
// M9b T7b: "Já rodei" e "Desfazer" na peça 7 (peca7.js:61,139-140). As ações vêm por prop; quem só edita não vê botão.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { lerPendencias, pendenciasParaTela, LINHA_DO_DONO } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

vi.mock('server-only', () => ({}))
const AGORA = new Date('2028-05-03T15:00:00Z'), D = 86_400_000
const REF = 'aaaaaaaa-1111-2222-3333-444444444444'
const item = (o: Record<string, unknown> = {}) => ({ item_id: `canal:${REF}`, kind: 'canal', tempo: 'copiar', desde: new Date(AGORA.getTime() - 5 * D).toISOString(), mes: null, channel_ref: REF, youtube_id: null,
  marcado_rodado_em: null, apagar: [], b2_nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...o })
const tela = (itens: Record<string, unknown>[], podeVerComandos = true) => {
  const l = lerPendencias({ versao: 2, lido_em: AGORA.toISOString(), total: itens.length, itens })
  const t = pendenciasParaTela(l, { podeVerComandos, agora: AGORA, nomes: { canais: new Map([[REF, 'Viagem Lenta']]) } })
  if (t.estado !== 'com_itens') throw new Error('fixture')
  return t
}
afterEach(cleanup)

describe('pendenciasParaTela: marcação', () => {
  it('marcado há menos de 24 h: marcado; há mais e o item segue na lista: refutado', () => {
    const rec = tela([item({ marcado_rodado_em: new Date(AGORA.getTime() - 3_600_000).toISOString() })]).itens[0]!
    expect(rec).toMatchObject({ marcadoRodadoEm: new Date(AGORA.getTime() - 3_600_000), marcadoRefutado: false })
    const ant = tela([item({ marcado_rodado_em: new Date(AGORA.getTime() - 2 * D).toISOString() })]).itens[0]!
    expect(ant.marcadoRefutado).toBe(true)
    const nada = tela([item()]).itens[0]!
    expect(nada).toMatchObject({ marcadoRodadoEm: null, marcadoRefutado: false })
  })
})

describe('Já rodei e Desfazer', () => {
  it('Já rodei chama marcarRodado com o item_id, mostra o marcado e o Desfazer', async () => {
    const onMarcar = vi.fn().mockResolvedValue({ ok: true }), onDesfazer = vi.fn().mockResolvedValue({ ok: true })
    render(<EsperamComandos t={tela([item()])} onMarcarRodado={onMarcar} onDesfazerRodado={onDesfazer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Já rodei' }))
    await waitFor(() => expect(onMarcar).toHaveBeenCalledWith(`canal:${REF}`))
    expect(await screen.findByText(/Marcado como rodado em/)).toBeTruthy()
    expect(document.body.textContent).toContain('Volte em até 24 horas')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() => expect(onDesfazer).toHaveBeenCalledWith(`canal:${REF}`))
    expect(await screen.findByRole('button', { name: 'Já rodei' })).toBeTruthy()
  })
  it('refutado: âmbar, diz que voltou para a lista e oferece Já rodei de novo', () => {
    render(<EsperamComandos t={tela([item({ marcado_rodado_em: new Date(AGORA.getTime() - 2 * D).toISOString() })])} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn()} />)
    expect(document.querySelector('[data-refutado]')!.textContent).toContain('O item voltou para a lista.')
    expect(screen.getByRole('button', { name: 'Já rodei' })).toBeTruthy()
  })
  it.each([
    ['sem_permissao', 'Só quem administra o site pode marcar. Nada foi marcado.'],
    ['item_desconhecido', 'Este item não está mais na lista; recarregue a página.'],
    ['forma', 'Não deu para marcar agora.'],
    ['interno', 'Não deu para marcar agora.'],
  ])('erro %s: aviso em alert e o botão continua', async (erro, texto) => {
    render(<EsperamComandos t={tela([item()])} onMarcarRodado={vi.fn().mockResolvedValue({ ok: false, erro })} onDesfazerRodado={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Já rodei' }))
    expect((await screen.findByRole('alert')).textContent).toContain(texto)
    expect(screen.getByRole('button', { name: 'Já rodei' })).toBeTruthy()
  })
  it('a action lançou: não diz que não foi marcado', async () => {
    render(<EsperamComandos t={tela([item()])} onMarcarRodado={vi.fn().mockRejectedValue(new Error('x'))} onDesfazerRodado={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Já rodei' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Não sabemos se foi marcado. Recarregue a página antes de tentar de novo.')
  })
  it('sem a prop, sem linha (quem só edita) ou sem comando a rodar: nenhum botão', () => {
    render(<EsperamComandos t={tela([item()])} />)
    expect(screen.queryByRole('button', { name: 'Já rodei' })).toBeNull()
    cleanup()
    render(<EsperamComandos t={tela([item()], false)} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Já rodei' })).toBeNull()
    cleanup()
    render(<EsperamComandos t={tela([item({ tempo: 'sem_comando', falta: 'lote_e10' })])} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Já rodei' })).toBeNull()
    expect(LINHA_DO_DONO).toContain('obs:arquivo')
  })
  it('versão antiga (antiga:<uuid>) não tem Já rodei: a ação a recusaria', () => {
    const it = item({ item_id: `antiga:${REF}`, kind: 'versao', channel_ref: null, youtube_id: null, tempo: 'apagar_antigas', apagar: [{ filho: 'video', caminho: 'a/b', sha256: 'a'.repeat(64), nova: null }] })
    let t
    try { t = tela([it]) } catch { return }
    render(<EsperamComandos t={t} onMarcarRodado={vi.fn()} onDesfazerRodado={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Já rodei' })).toBeNull()
  })
})
