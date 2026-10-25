// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { InfoDica } from '@/app/cms/(authed)/youtube/_components/info-dica'

const YT = join(process.cwd(), 'src/app/cms/(authed)/youtube')

afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

describe('InfoDica compartilhado (S8-F4 T12 T2)', () => {
  it('fora de qualquer [data-obs-screen]: abre em #flut com data-obs, caixa canal-tip, h3 e aria-expanded', async () => {
    render(<InfoDica titulo="Como ler" paragrafos={['Um.', 'Dois.']} />)
    const btn = screen.getByRole('button', { name: 'Como ler' })
    expect(btn.className).toBe('ibtn dica-i')
    await userEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    const flut = document.getElementById('flut')!
    expect(flut.parentElement).toBe(document.body)
    expect(flut.hasAttribute('data-obs')).toBe(true)
    const caixa = flut.querySelector('.obs-fl-pop.canal-tip')!
    expect(caixa.querySelector('h3')?.textContent).toBe('Como ler')
    expect(caixa.querySelectorAll('p.dica-p')).toHaveLength(2)
  })
  it('Esc fecha e o foco volta ao botão', async () => {
    render(<InfoDica titulo="Dica" paragrafos={['x']} />)
    const btn = screen.getByRole('button', { name: 'Dica' })
    await userEvent.click(btn)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(btn)
  })
  it('um segundo ⓘ aberto fecha o primeiro', async () => {
    render(<><InfoDica titulo="Um" paragrafos={['a']} /><InfoDica titulo="Dois" paragrafos={['b']} /></>)
    const um = screen.getByRole('button', { name: 'Um' }), dois = screen.getByRole('button', { name: 'Dois' })
    await userEvent.click(um)
    await userEvent.click(dois)
    expect(um.getAttribute('aria-expanded')).toBe('false')
    expect(dois.getAttribute('aria-expanded')).toBe('true')
  })
  it('tokens movidos: chrome.css sem --surface:, tokens-obs.css com os dois temas; regras sem cópia nos antigos', () => {
    const chrome = readFileSync(join(YT, 'competitors/_chrome/chrome.css'), 'utf8')
    const tokens = readFileSync(join(YT, 'competitors/_chrome/tokens-obs.css'), 'utf8')
    expect(chrome).not.toContain('--surface:')
    expect(tokens).toContain('[data-obs]{')
    expect(tokens).toContain('[data-theme="light"] [data-obs]{')
    expect(readFileSync(join(YT, 'competitors/layout.tsx'), 'utf8')).toMatch(/tokens-obs\.css'[\s\S]*chrome\.css'/)
    expect(readFileSync(join(YT, 'competitors/_canal/canal.css'), 'utf8')).not.toContain('.canal-tip{width:380px')
    expect(readFileSync(join(YT, 'competitors/_proprio/video-blocos.css'), 'utf8')).not.toContain('vb-info')
    expect(readFileSync(join(YT, '_components/info-dica.css'), 'utf8')).toContain('#flut .canal-tip .dica-p')
  })
})
