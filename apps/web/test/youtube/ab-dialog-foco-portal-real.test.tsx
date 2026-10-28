// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { AbEndTestDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'
import { AbConfirmarTrocaDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-confirmar-troca-dialog'

afterEach(() => cleanup())

const opcoes = [
  { id: 'v1', rotulo: 'A (original)', isOriginal: true, titulo: 'T', miniatura: null },
  { id: 'v2', rotulo: 'B', isOriginal: false, titulo: 'TB', miniatura: null },
]

function Pai() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>Encerrar teste abrir</button>
      <AbEndTestDialog
        aberto={aberto} onFechar={() => setAberto(false)} testeNome="t" noArAgora={{ rotulo: 'B', desde: '' }}
        opcoes={opcoes} originalBaixaResolucao={false} podeDeixarVariante encerrar={vi.fn()} freio={{ tipo: 'faltam', texto: 'Faltam 8 dias dos 14.' }}
      />
    </>
  )
}

describe('foco do diálogo com o YtPortal de verdade (D1)', () => {
  it('foco entra no diálogo, Tab circula, Esc fecha e devolve o foco ao botão que abriu', async () => {
    render(<Pai />)
    const abrir = screen.getByRole('button', { name: 'Encerrar teste abrir' })
    await userEvent.click(abrir)
    const dialogo = await screen.findByRole('dialog')
    await vi.waitFor(() => expect(dialogo.contains(document.activeElement)).toBe(true))
    for (let i = 0; i < 12; i++) {
      await userEvent.tab()
      expect(dialogo.contains(document.activeElement)).toBe(true)
    }
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(abrir))
  })

  it('"Trocar mesmo assim?": o foco inicial é "Cancelar"', async () => {
    render(
      <AbConfirmarTrocaDialog
        campos={[{ campo: 'title', valor_atual: 'x' }]}
        opcao={opcoes[1]!}
        onVoltar={vi.fn()}
        onConfirmar={vi.fn()}
      />,
    )
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(document.activeElement?.textContent).toMatch(/Cancelar/)
  })
})
