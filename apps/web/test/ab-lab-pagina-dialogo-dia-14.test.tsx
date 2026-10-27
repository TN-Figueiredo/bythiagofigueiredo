// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { DialogoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/dialogo-dia-14'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const tresV = [{ n: 1, titulo: 'Título original', imagem: null }, { n: 2, titulo: 'Título B', imagem: null }, { n: 3, titulo: 'Título C', imagem: null }]

function linha(): LinhaDoCaminho {
  return {
    videoId: 'uuid-1', ytId: 'vid00000001', titulo: 'Sukhumvit', miniaturaUrl: null, publicadoEm: dia(30), estado: 'resultado_pronto',
    caminho: { tipo: 'nativo', portao: true, motivo: 'x' }, fichaId: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300,
    registro: {
      id: 'reg-1', updatedAt: dia(1), inicio: dia(15), confirmadoEm: dia(15), primeiraVista: dia(15), diaDe14: 14,
      variantes: tresV, variantesTitulo: null, campos: ['titulo'], respostaDono: null,
    },
  } as LinhaDoCaminho
}
const responderTesteDoYouTube = vi.fn(async (_p?: unknown) => ({ ok: true, conflito: null }))
const mudarRespostaDoTesteDoYouTube = vi.fn(async (_p?: unknown) => ({ ok: true, conflito: null }))
const atualizar = vi.fn()
const onFechar = vi.fn()
function montar(): HTMLButtonElement {
  const abre = document.createElement('button'); document.body.appendChild(abre); abre.focus()
  render(<DialogoDia14 linha={linha()} acoes={{ responderTesteDoYouTube, mudarRespostaDoTesteDoYouTube } as never} atualizar={atualizar} onFechar={onFechar} />)
  return abre
}
beforeEach(() => { responderTesteDoYouTube.mockClear(); mudarRespostaDoTesteDoYouTube.mockClear(); atualizar.mockClear(); onFechar.mockClear() })
afterEach(() => { cleanup(); document.body.innerHTML = '' })

describe('DialogoDia14 (M7 T9)', () => {
  it('foco inicial no título do diálogo (tabIndex -1), não na primeira resposta', async () => {
    montar()
    const t = await screen.findByRole('heading', { name: 'O que o Studio mostrou?' })
    expect(t.getAttribute('tabindex')).toBe('-1')
    await waitFor(() => expect(document.activeElement).toBe(t))
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
  })
  it('com 3 versões mostra as respostas do mockup', async () => {
    montar()
    await screen.findByRole('dialog')
    for (const n of [/A \(original\) ficou/, /B venceu/, /C venceu/, /Ficou igual/, /Inconclusivo/, /Não vi ainda/]) expect(screen.getByRole('button', { name: n })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir no Studio' }).getAttribute('href')).toBe('https://studio.youtube.com/video/vid00000001/edit')
  })
  it('"C venceu" chama responderTesteDoYouTube com venceu_nova e n = 3', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /C venceu/ }))
    await waitFor(() => expect(responderTesteDoYouTube).toHaveBeenCalledTimes(1))
    expect(responderTesteDoYouTube).toHaveBeenCalledWith(expect.objectContaining({ resposta: 'venceu_nova', n: 3, registroId: 'reg-1' }))
  })
  it('"Não vi ainda" não chama action nenhuma e mostra "Certo" + "O aviso continua até você responder."', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Não vi ainda/ }))
    expect(await screen.findByRole('heading', { name: 'Certo' })).toBeTruthy()
    expect(screen.getByText('O aviso continua até você responder.')).toBeTruthy()
    expect(responderTesteDoYouTube).not.toHaveBeenCalled()
    expect(mudarRespostaDoTesteDoYouTube).not.toHaveBeenCalled()
    expect(screen.queryByText(/Registrado/)).toBeNull()
  })
  it('depois de registrar: mensagem, "Mudar resposta" e "Fechar"; Fechar chama atualizar e onFechar', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /C venceu/ }))
    expect(await screen.findByText('Registrado: a versão C ficou no ar.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mudar resposta' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(atualizar).toHaveBeenCalled()
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
  it('"Mudar resposta" volta à pergunta em modo troca e grava pela action de troca', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /C venceu/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mudar resposta' }))
    fireEvent.click(await screen.findByRole('button', { name: /B venceu/ }))
    await waitFor(() => expect(mudarRespostaDoTesteDoYouTube).toHaveBeenCalledTimes(1))
    expect(mudarRespostaDoTesteDoYouTube).toHaveBeenCalledWith(expect.objectContaining({ resposta: 'venceu_nova', n: 2, respostaVista: 'venceu_nova', varianteVista: 3 }))
  })
  it('Esc fecha fora do envio e devolve foco ao botão que abriu', async () => {
    const abre = montar()
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalledTimes(1)
    cleanup()
    expect(document.activeElement).toBe(abre)
  })
  it('Esc durante o envio não fecha', async () => {
    let solta: (v: { ok: true; conflito: null }) => void = () => {}
    responderTesteDoYouTube.mockImplementationOnce(() => new Promise<{ ok: true; conflito: null }>(r => { solta = r }) as never)
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /C venceu/ }))
    await waitFor(() => expect(responderTesteDoYouTube).toHaveBeenCalled())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFechar).not.toHaveBeenCalled()
    solta({ ok: true, conflito: null })
    await screen.findByText('Registrado: a versão C ficou no ar.')
  })
  it('nenhum texto do diálogo diz que o Lab leu o Studio', async () => {
    montar()
    await screen.findByRole('dialog')
    expect(screen.queryByText(/o Lab leu|lido do Studio/i)).toBeNull()
  })
})
