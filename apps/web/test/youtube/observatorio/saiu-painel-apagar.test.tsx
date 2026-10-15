// @vitest-environment jsdom
/** A5 · E9, Tarefa 10b: o painel de apagar (componente cliente). As ações chegam por prop. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PainelApagar } from '@/app/cms/(authed)/youtube/competitors/_saiu/painel-apagar'
import { buildFilaView, type PainelView } from '@/app/cms/(authed)/youtube/competitors/_saiu/view-model'
import { fraseDoErro } from '@/lib/youtube/observatorio/saiu/modelo'
import { AGORA, fila, video } from './saiu-fixtures'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
afterEach(() => { cleanup(); refresh.mockClear() })

function painel(forja = false): PainelView {
  const it = video(1)
  if (forja) it.previa = { linhas: {}, miniaturas: 0, forjaEmAndamento: true, respostasDoCriador: 0 }
  const v = buildFilaView(fila({ esperando: [it] }), { agoraMs: AGORA, mostrar: 10 })
  if (v.estado !== 'ok') throw new Error('x')
  return v.cartoes[0]!.painel!
}
const montar = (apagar = vi.fn(async () => ({ desfecho: 'apagado', frase: 'Apagado.' })), p = painel(), pode = true) =>
  ({ apagar, ...render(<PainelApagar rotulo="Apagar o vídeo…" painel={p} podeResponder={pode} semPermissao={pode ? null : 'Só quem administra o site pode responder.'} acoes={{ apagar }} />) })
const botaoFinal = () => screen.getByRole('button', { name: 'Apagar para sempre', hidden: true }) as HTMLButtonElement
const campo = () => screen.getByLabelText(/Para confirmar, digite/, { selector: 'input' }) as HTMLInputElement

describe('A5 E9 T10b: painel de apagar', () => {
  it('o botão final nasce disabled de verdade (atributo, não aria)', () => {
    montar()
    expect(botaoFinal().hasAttribute('disabled')).toBe(true)
    expect(botaoFinal().getAttribute('aria-disabled')).toBeNull()
  })

  it('digitar "apagar " habilita; apagar um caractere desabilita', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o vídeo…' }))
    fireEvent.change(campo(), { target: { value: ' apagar ' } })
    expect(botaoFinal().disabled).toBe(false)
    fireEvent.change(campo(), { target: { value: 'apaga' } })
    expect(botaoFinal().disabled).toBe(true)
  })

  it('abrir põe o foco no campo; Esc fecha e devolve o foco ao botão que abriu', async () => {
    montar()
    const abre = screen.getByRole('button', { name: 'Apagar o vídeo…' })
    fireEvent.click(abre)
    await waitFor(() => expect(document.activeElement).toBe(campo()))
    expect(abre.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(campo(), { key: 'Escape' })
    expect(abre.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(abre)
  })

  it('enviar chama a ação uma vez e desabilita durante o envio (duplo clique não manda duas)', async () => {
    let solta: (v: { desfecho: string; frase: string }) => void = () => {}
    const apagar = vi.fn(() => new Promise<{ desfecho: string; frase: string }>(r => { solta = r }))
    montar(apagar)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o vídeo…' }))
    fireEvent.change(campo(), { target: { value: 'APAGAR' } })
    fireEvent.click(botaoFinal())
    fireEvent.click(botaoFinal())
    expect(apagar).toHaveBeenCalledTimes(1)
    expect(apagar).toHaveBeenCalledWith({ tipo: 'video', id: video(1).chave, palavra: 'APAGAR' })
    expect(botaoFinal().disabled).toBe(true)
    solta({ desfecho: 'apagado', frase: 'Apagado.' })
    await waitFor(() => expect(screen.getByRole('status', { hidden: true }).textContent).toBe('Apagado.'))
    expect(refresh).toHaveBeenCalled()
  })

  it('desfecho de recusa mostra a frase em role="alert", mantém o painel e não recarrega', async () => {
    const apagar = vi.fn(async () => ({ desfecho: 'forja_em_andamento', frase: 'A forja está lendo este vídeo agora. Tente de novo em até 30 minutos.' }))
    montar(apagar)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o vídeo…' }))
    fireEvent.change(campo(), { target: { value: 'APAGAR' } })
    fireEvent.click(botaoFinal())
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('até 30 minutos'))
    expect(screen.getByRole('button', { name: 'Apagar o vídeo…' }).getAttribute('aria-expanded')).toBe('true')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('com a forja em andamento na prévia, o campo já nasce desabilitado e a recusa está escrita', () => {
    montar(undefined, painel(true))
    expect(campo().disabled).toBe(true)
    expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('A forja está lendo este vídeo agora')
    expect(botaoFinal().disabled).toBe(true)
  })

  it('quem não administra: campo desabilitado e a frase de permissão, sem chamar a ação', () => {
    const { apagar } = montar(undefined, painel(), false)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o vídeo…' }))
    expect(campo().disabled).toBe(true)
    expect(screen.getByText('Só quem administra o site pode responder.')).toBeTruthy()
    expect(botaoFinal().disabled).toBe(true)
    expect(apagar).not.toHaveBeenCalled()
  })

  const digitaEEnvia = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o vídeo…' }))
    fireEvent.change(campo(), { target: { value: 'APAGAR' } })
    fireEvent.click(botaoFinal())
  }

  it.each(['mudou', 'no_ar', 'not_found'])('I-2 (portão 14/10): "%s" mostra a frase em alert e recarrega a tela uma vez', async desfecho => {
    montar(vi.fn(async () => ({ desfecho, frase: 'A lista mudou.' })))
    digitaEEnvia()
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('A lista mudou.'))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('I-2: palavra_errada não recarrega', async () => {
    montar(vi.fn(async () => ({ desfecho: 'palavra_errada', frase: 'Digite APAGAR.' })))
    digitaEEnvia()
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('Digite APAGAR.'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('m-2: resposta de erro com n > 0 (parcial) recarrega a tela', async () => {
    montar(vi.fn(async () => ({ desfecho: 'erro', frase: 'Parcial.', n: 2 })))
    digitaEEnvia()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('m-7: ação que rejeita mostra a frase de erro e devolve o botão', async () => {
    montar(vi.fn(async () => { throw new Error('rede') }))
    digitaEEnvia()
    await waitFor(() => expect(screen.getByRole('alert', { hidden: true }).textContent).toBe(fraseDoErro('erro_de_banco')))
    expect(botaoFinal().disabled).toBe(false)
  })
})
