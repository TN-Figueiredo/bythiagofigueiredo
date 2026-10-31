// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { BlocoCanaisRemovidosView } from '@/app/cms/(authed)/youtube/competitors/_arquivo/bloco-canais-removidos'
import { montarBloco, type ListaRemovidosV2 } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import type { RespostaApagar } from '@/app/cms/(authed)/youtube/competitors/_arquivo/actions-canal'

const AGORA = Date.parse('2028-05-03T15:00:00Z'), D = 86_400_000
const REF = 'aaaaaaaa-1111-2222-3333-444444444444'
const casa = { estado: 'responde' as const, desde: null, forma: 'visto' as const, frase: '' }
const cap = { comandoDeLimpeza: true, blocoCanaisRemovidos: true, dataDoComando: null, blobsLigados: true }
const iso = (d: number): string => new Date(AGORA - d * D).toISOString()
const linha = (o: Record<string, unknown>): ListaRemovidosV2[number] => ({ versao: 2, channel_ref: REF, estado: 'guardado', decided_at: null,
  nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, reappeared_at: null, reappeared_count: 0, online_thumbs_known: true, thumbs_unknown_ack_at: null,
  blobs_pendentes: 0, youtube_channel_id: 'UCx', nome: 'Viagem Lenta', removido_em: iso(5), removido_via: 'botao',
  primeiro_mes: '2026-10', ultimo_mes: '2027-11', meses: 14, registros: 1, classes: [], ...o }) as ListaRemovidosV2[number]
const pend = { ok: true as const, canais: new Map([[REF, { tempo: 'copiar' as const, falta: null, snapLiberaEm: null, snapBloqueio: null, marcadoRodadoEm: null, b2Nomes: 0 }]]) }
const montar = (l: ListaRemovidosV2[number], administra = true) => montarBloco([l], { agora: AGORA, casa, cap, administra, pend })
afterEach(cleanup)

describe('M9b T7: o diálogo Apagar do arquivo', () => {
  const abre = (onApagar: (r: string, d: string) => Promise<RespostaApagar>, l = linha({})) => {
    render(<BlocoCanaisRemovidosView bloco={montar(l)} onApagar={onApagar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar do arquivo' }))
  }
  it('o botão fica desabilitado até digitar o nome (a caixa e os espaços não importam) e o clique sem nome não chama a action', async () => {
    const onApagar = vi.fn().mockResolvedValue({ ok: true, status: 'ok' })
    abre(onApagar)
    const dlg = screen.getByRole('dialog')
    expect(dlg.textContent).toContain('Apagar do arquivo os 14 meses de Viagem Lenta?')
    const apagar = screen.getAllByRole('button', { name: 'Apagar do arquivo' }).at(-1)!
    expect(apagar.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(apagar)
    expect(onApagar).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Nome do canal'), { target: { value: 'viagem LENTA' } })
    expect(apagar.getAttribute('aria-disabled')).toBe('false')
    fireEvent.click(apagar)
    await waitFor(() => expect(onApagar).toHaveBeenCalledWith(REF, 'viagem LENTA'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status', { hidden: true, name: '' }) ).toBeTruthy()
    expect(document.body.textContent).toContain('Limpeza pedida para Viagem Lenta.')
  })
  it('ja_pedido fecha com frase própria', async () => {
    abre(vi.fn().mockResolvedValue({ ok: true, status: 'ja_pedido' }))
    fireEvent.change(screen.getByLabelText('Nome do canal'), { target: { value: 'Viagem Lenta' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Apagar do arquivo' }).at(-1)!)
    await waitFor(() => expect(document.body.textContent).toContain('Este canal já estava com a limpeza pedida; a linha foi atualizada.'))
  })
  it.each([
    ['sem_permissao', 'Só quem administra o site pode apagar do arquivo. A limpeza não foi pedida.'],
    ['desligado', 'A limpeza de canal está desligada agora. A limpeza não foi pedida.'],
    ['canal_nao_encontrado', 'Este canal não está mais na lista'],
    ['canal_existe', 'Este canal voltou a existir no site; o arquivo dele não foi apagado.'],
    ['interno', 'Não deu para pedir a limpeza agora.'],
  ] as const)('erro %s: o diálogo fica aberto, o nome fica e o aviso é um alert', async (erro, texto) => {
    abre(vi.fn().mockResolvedValue({ ok: false, erro }))
    fireEvent.change(screen.getByLabelText('Nome do canal'), { target: { value: 'Viagem Lenta' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Apagar do arquivo' }).at(-1)!)
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(texto)
    expect((screen.getByLabelText('Nome do canal') as HTMLInputElement).value).toBe('Viagem Lenta')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('a action lançou: não afirma que a limpeza não foi pedida', async () => {
    abre(vi.fn().mockRejectedValue(new Error('rede')))
    fireEvent.change(screen.getByLabelText('Nome do canal'), { target: { value: 'Viagem Lenta' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Apagar do arquivo' }).at(-1)!)
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toBe('Não sabemos se a limpeza foi pedida. Recarregue a página antes de tentar de novo.')
  })
  it('Esc fecha', () => {
    abre(vi.fn())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('Cancelar fecha sem chamar a action', () => {
    const onApagar = vi.fn()
    abre(onApagar)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onApagar).not.toHaveBeenCalled()
  })
  it('lote da E10 e código (sem_destino) mostram os avisos', () => {
    abre(vi.fn(), linha({ estado: 'sem_destino', nome: null, removido_via: 'sem_registro', meses: 9, ultimo_mes: '2027-06' }))
    const dlg = screen.getByRole('dialog')
    expect(dlg.textContent).toContain('Apagar do arquivo os 9 meses do código AAAAAAAA?')
    expect(dlg.querySelector('[data-aviso="blob"]')).not.toBeNull()
    expect(screen.getByLabelText('Código do arquivo')).toBeTruthy()
  })
  it('sem a action por prop não há botão (nunca importada no client)', () => {
    render(<BlocoCanaisRemovidosView bloco={montar(linha({}))} />)
    expect(screen.queryByRole('button', { name: 'Apagar do arquivo' })).toBeNull()
  })
  it('quem só edita não vê o botão', () => {
    render(<BlocoCanaisRemovidosView bloco={montar(linha({}), false)} onApagar={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Apagar do arquivo' })).toBeNull()
    expect(document.body.textContent).toContain('Espera quem administra o site')
  })
})

describe('M9b T7: Ver os comandos', () => {
  const pedido = linha({ estado: 'pedido', decided_at: iso(5) })
  it('abre e fecha o painel, aria-expanded muda, a linha fixa aparece e Copiar vira Copiado', async () => {
    const escreve = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escreve }, configurable: true })
    render(<BlocoCanaisRemovidosView bloco={montar(pedido)} />)
    const b = screen.getByRole('button', { name: 'Ver os comandos' })
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.arq-cmd')).toBeNull()
    fireEvent.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.arq-cmd code')!.textContent).toContain('obs:arquivo')
    expect(document.querySelector('.arq-cmd h4')!.textContent).toBe('Para limpar o arquivo de Viagem Lenta, rode uma linha no Mac.')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar a linha do passo 1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiar a linha do passo 1' }).textContent).toBe('Copiado'))
    expect(escreve).toHaveBeenCalled()
    fireEvent.click(b)
    expect(document.querySelector('.arq-cmd')).toBeNull()
  })
  it('quem só edita não tem botão; leitura falha não tem painel', () => {
    render(<BlocoCanaisRemovidosView bloco={montar(pedido, false)} />)
    expect(screen.queryByRole('button', { name: 'Ver os comandos' })).toBeNull()
    cleanup()
    render(<BlocoCanaisRemovidosView bloco={montarBloco([pedido], { agora: AGORA, casa, cap, administra: true, pend: { ok: false } })} />)
    expect(screen.queryByRole('button', { name: 'Ver os comandos' })).toBeNull()
  })
})

describe('M9b T7: Já limpos lembra da exportação à mão', () => {
  it('só quando algum concluído veio de e10_export', () => {
    const c = (via: string, ref: string) => linha({ estado: 'concluido', channel_ref: ref, removido_via: via, b2_absent_at: iso(3) })
    render(<BlocoCanaisRemovidosView bloco={montarBloco([c('e10_export', 'a1111111-1111-2222-3333-444444444444'), c('botao', 'b1111111-1111-2222-3333-444444444444')], { agora: AGORA, casa, cap, administra: true, pend })} />)
    expect(document.body.textContent).toContain('1 desses canais tinha exportação feita à mão; ela continua no Mac e no NAS; esta tela não a apaga.')
    expect(document.body.textContent).not.toContain('apague-a')
    cleanup()
    render(<BlocoCanaisRemovidosView bloco={montarBloco([c('botao', 'b1111111-1111-2222-3333-444444444444')], { agora: AGORA, casa, cap, administra: true, pend })} />)
    expect(document.body.textContent).not.toContain('exportação feita à mão')
  })
})
