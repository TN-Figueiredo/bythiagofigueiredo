// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ErroOAuth from '../../src/app/oauth/erro/page'

async function render(codigo?: string | string[]): Promise<string> {
  const el = await ErroOAuth({ searchParams: Promise.resolve({ codigo }) })
  return renderToStaticMarkup(el)
}

describe('/oauth/erro', () => {
  it('código desconhecido cai em pedido', async () => {
    const h = await render('<script>alert(1)</script>')
    expect(h).toContain('Este pedido não vale mais.')
    expect(h).toContain('c1-pedido')
    expect(h).not.toContain('<script>')
  })
  it('código válido usa a mesma marcação com lang pt-BR e rodapé', async () => {
    const h = await render('desligado')
    expect(h).toContain('lang="pt-BR"')
    expect(h).toContain('A conexão está desligada por enquanto.')
    expect(h).toContain('Nada foi criado nem liberado.')
    expect(h).toContain('c1-desligado')
  })
  it('state na query não aparece', async () => {
    const el = await ErroOAuth({ searchParams: Promise.resolve({ codigo: 'falha', state: '<img src=x onerror=1>' } as never) })
    const h = renderToStaticMarkup(el)
    expect(h).toContain('c1-falha')
    expect(h).not.toContain('onerror')
    expect(h).not.toContain('<img')
  })
  it('código ausente cai em pedido', async () => {
    expect(await render(undefined)).toContain('c1-pedido')
  })
})
