// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConectarIa } from '@/app/cms/(authed)/conectar-ia/conectar-ia'
import { LinhaConectarIa } from '@/app/cms/(authed)/youtube/competitors/_chrome/linha-conectar-ia'
import { RECURSO } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'

vi.mock('@/app/cms/(authed)/_shared/cms-link', () => ({
  default: (p: { href: string; children: React.ReactNode }) => <a href={p.href}>{p.children}</a>,
}))

const setClipboard = (v: unknown) => Object.defineProperty(navigator, 'clipboard', { value: v, configurable: true })

const mem = new Map<string, string>()
const armazenamento = { getItem: vi.fn((k: string) => mem.get(k) ?? null), setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, clear: () => mem.clear() }

beforeEach(() => { vi.useFakeTimers(); mem.clear(); armazenamento.getItem.mockClear(); vi.stubGlobal('localStorage', armazenamento); window.history.replaceState(null, '', '/cms/conectar-ia') })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('ConectarIa', () => {
  it('ia=claude: aba Claude selecionada, painel ChatGPT hidden; 2 abas; sem Gemini', () => {
    const { container } = render(<ConectarIa ia="claude" bloqueadas={[]} />)
    expect(screen.getByRole('tab', { name: 'Claude' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(container.querySelector('#cia-p-chatgpt')?.hasAttribute('hidden')).toBe(true)
    expect(container.textContent).not.toMatch(/gemini/i)
  })

  it('ArrowRight troca e foca', () => {
    render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    const a = screen.getByRole('tab', { name: 'ChatGPT' })
    fireEvent.keyDown(a, { key: 'ArrowRight' })
    const c = screen.getByRole('tab', { name: 'Claude' })
    expect(c.getAttribute('aria-selected')).toBe('true')
    expect(c.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(c)
    expect(window.location.search).toBe('?ia=claude')
    expect(localStorage.getItem('conectar-ia:aba')).toBe('claude')
  })

  it('Copiar com sucesso: texto Copiado, sem aria-label, status; volta em 3 s', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar o endereço' })) })
    expect(writeText).toHaveBeenCalledWith(RECURSO)
    const b = screen.getByRole('button', { name: 'Copiado' })
    expect(b.hasAttribute('aria-label')).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('Endereço copiado. Cole no campo de endereço da IA.')
    act(() => { vi.advanceTimersByTime(3000) })
    const volta = screen.getByRole('button', { name: 'Copiar o endereço' })
    expect(volta.textContent).toContain('Copiar')
    expect(volta.getAttribute('aria-label')).toBe('Copiar o endereço')
  })

  it('falha: writeText rejeitado ou clipboard ausente mostram o alerta', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('x')) })
    const { unmount } = render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar o endereço' })) })
    expect(screen.getByRole('alert').textContent).toContain('Não deu para copiar.')
    unmount()
    setClipboard(undefined)
    render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar o endereço' })) })
    expect(screen.getByRole('alert').textContent).toContain('Não deu para copiar.')
  })

  it('links externos e alerta por IA', () => {
    const { container } = render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    const g = screen.getByRole('link', { name: 'Abrir o ChatGPT (abre em nova aba)' })
    expect(g.getAttribute('href')).toBe('https://chatgpt.com')
    expect(g.getAttribute('target')).toBe('_blank')
    expect(g.getAttribute('rel')).toBe('noopener noreferrer')
    const c = container.querySelector('a[aria-label="Abrir o Claude (abre em nova aba)"]')
    expect(c?.getAttribute('href')).toBe('https://claude.ai/new#customize/connectors/yours')
    const notas = Array.from(container.querySelectorAll('[role="note"]')).map((n) => n.textContent ?? '')
    expect(notas.some((t) => t.includes('no seu ChatGPT.'))).toBe(true)
    expect(notas.some((t) => t.includes('no seu Claude.'))).toBe(true)
  })

  it('IA bloqueada: painel sem passos e com a frase de pausa', () => {
    const { container } = render(<ConectarIa ia="claude" bloqueadas={['chatgpt']} />)
    const p = container.querySelector('#cia-p-chatgpt') as HTMLElement
    expect(p.querySelector('ol')).toBeNull()
    expect(p.textContent).toContain('Acesso pausado pelo Thiago.')
    expect((container.querySelector('#cia-p-claude') as HTMLElement).querySelector('ol')).not.toBeNull()
  })

  it('sem ?ia e localStorage=claude: abre Claude depois do efeito', () => {
    localStorage.setItem('conectar-ia:aba', 'claude')
    render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    expect(screen.getByRole('tab', { name: 'Claude' }).getAttribute('aria-selected')).toBe('true')
  })

  it('com ?ia= na URL o localStorage não vale', () => {
    window.history.replaceState(null, '', '/cms/conectar-ia?ia=chatgpt')
    localStorage.setItem('conectar-ia:aba', 'claude')
    render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    expect(screen.getByRole('tab', { name: 'ChatGPT' }).getAttribute('aria-selected')).toBe('true')
  })

  it('localStorage que lança: fica no ia recebido, sem erro', () => {
    armazenamento.getItem.mockImplementation(() => { throw new Error('x') })
    render(<ConectarIa ia="chatgpt" bloqueadas={[]} />)
    expect(screen.getByRole('tab', { name: 'ChatGPT' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('LinhaConectarIa', () => {
  it('mostrar=false: nada; true: link', () => {
    const { container, rerender } = render(<LinhaConectarIa mostrar={false} />)
    expect(container.innerHTML).toBe('')
    rerender(<LinhaConectarIa mostrar />)
    expect(screen.getByRole('link', { name: 'Conectar sua IA' }).getAttribute('href')).toBe('/cms/conectar-ia')
  })
})
