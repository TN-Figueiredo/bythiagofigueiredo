// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CopyInviteLink } from '@/app/admin/(authed)/users/_components/CopyInviteLink'

const URL_ = 'https://bythiagofigueiredo.com/signup/invite/' + 'a'.repeat(64)

describe('CopyInviteLink', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('copia o link do convite e confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<CopyInviteLink url={URL_} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link do convite' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copiado.'))
    expect(writeText).toHaveBeenCalledWith(URL_)
  })

  it('se a área de transferência falha, mostra o link para copiar à mão em vez de "copiado"', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
    })
    render(<CopyInviteLink url={URL_} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link do convite' }))
    const field = (await screen.findByLabelText('Link do convite')) as HTMLInputElement
    expect(field.value).toBe(URL_)
    expect(screen.queryByText('Link copiado.')).toBeNull()
  })

  it('sem navigator.clipboard (http, navegador antigo) também cai no campo manual', async () => {
    vi.stubGlobal('navigator', {})
    render(<CopyInviteLink url={URL_} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link do convite' }))
    expect(((await screen.findByLabelText('Link do convite')) as HTMLInputElement).value).toBe(URL_)
  })
})
