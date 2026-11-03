// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CmsLogin } from '@tn-figueiredo/cms/login'
import { AdminLogin } from '@tn-figueiredo/admin/login'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Roda contra os componentes REAIS dos pacotes: se um bump mudar a marcação, a regra de CSS
// deixa de achar o botão e este teste falha antes de o botão morto voltar ao login.
const css = readFileSync(resolve(__dirname, '../../lib/auth/login-sem-google.css'), 'utf8')
const seletor = /([^/]*?)\{\s*display: none/.exec(css.replace(/\/\*[\s\S]*?\*\//, ''))?.[1]?.trim() ?? ''
const actions = { signInWithPassword: vi.fn(), signInWithGoogle: vi.fn() }

describe.each([
  ['CmsLogin', <CmsLogin key="c" actions={actions} redirectTo="/cms" />],
  ['AdminLogin', <AdminLogin key="a" actions={actions} redirectTo="/admin" />],
])('%s sem o botão do Google', (_nome, tela) => {
  it('a regra pega só o botão do Google e o divisor', () => {
    const { container, unmount } = render(<div className="login-sem-google">{tela}</div>)
    const alvos = [...container.querySelectorAll(seletor)]
    expect(alvos).toHaveLength(2)
    expect(alvos[0]?.textContent).toMatch(/google/i)
    expect(alvos[1]?.tagName).toBe('DIV')
    expect(alvos[1]?.querySelector('input, button, form')).toBeNull()
    for (const el of container.querySelectorAll('form, form *')) expect(alvos).not.toContain(el)
    expect(container.querySelector('input[type="password"]')).not.toBeNull()
    expect(container.querySelector('button[type="submit"]')).not.toBeNull()
    unmount()
  })
})
