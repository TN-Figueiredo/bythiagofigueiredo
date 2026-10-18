// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const m = vi.hoisted(() => ({ guarda: vi.fn(), canAdmin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: m.guarda }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: m.canAdmin }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: vi.fn() }))

import { AbEntradasProvider, useAbEntradas } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { podeEditarSite } from '../../../src/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/permissao'
import { permissoesDoSite } from '../../../src/app/cms/(authed)/youtube/competitors/_canais/montar'

function Prova() {
  const v = useAbEntradas()
  return v ? <span data-testid="p">entrada</span> : null
}

describe('AbEntradasProvider', () => {
  it('sem provedor: nada', () => {
    const { container } = render(<Prova />)
    expect(container.textContent).toBe('')
  })
  it('valor null: nada', () => {
    const { container } = render(<AbEntradasProvider valor={null}><Prova /></AbEntradasProvider>)
    expect(container.textContent).toBe('')
  })
  it('valor do editor: desenha', () => {
    const { container } = render(<AbEntradasProvider valor={{ podeEditar: true, abertos: null }}><Prova /></AbEntradasProvider>)
    expect(container.textContent).toBe('entrada')
  })
})

describe('permissões', () => {
  beforeEach(() => { m.guarda.mockReset(); m.canAdmin.mockReset(); m.canAdmin.mockResolvedValue(false) })
  it('editor: os dois dizem sim', async () => {
    m.guarda.mockResolvedValue({ ok: true })
    expect(await podeEditarSite('s')).toBe(true)
    expect((await permissoesDoSite('s')).podeEditar).toBe(true)
  })
  it('reporter: os dois dizem não', async () => {
    m.guarda.mockResolvedValue({ ok: false })
    expect(await podeEditarSite('s')).toBe(false)
    expect(await permissoesDoSite('s')).toEqual({ canUnlock: false, podeEditar: false })
  })
  it('guarda que lança: false', async () => {
    m.guarda.mockRejectedValue(new Error('x'))
    expect(await podeEditarSite('s')).toBe(false)
  })
})
