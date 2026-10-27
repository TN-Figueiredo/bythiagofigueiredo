// apps/web/test/youtube/observatorio/arquivo-pagina-leitor.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { lerPagina, lerPaginaBruta } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'
import { paginaVazia } from './fixtures/arquivo-pagina'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))
const sbCom = (error: { code: string } | null, data: unknown = null) => ({ rpc: vi.fn().mockResolvedValue({ data, error }) }) as never
beforeEach(() => vi.mocked(Sentry.captureMessage).mockClear())

describe('leitor da página', () => {
  it('a fixture de página vazia passa no esquema', () => { expect(lerPaginaBruta(paginaVazia({}))).toMatchObject({ ok: true }) })
  it('chave a mais na raiz: fora do esquema', () => { expect(lerPaginaBruta({ ...paginaVazia({}), nova: 1 })).toEqual({ ok: false, porque: 'fora_do_esquema' }) })
  it('classe fora das três (video_antigo): fora do esquema', () => {
    const p = paginaVazia({}) as { classes: unknown[] }
    expect(lerPaginaBruta({ ...p, classes: [...p.classes, { class: 'video_antigo', first_month: null, released: false, window_months: 1, seal_margin_days: 1, wait_days: 1 }] })).toEqual({ ok: false, porque: 'fora_do_esquema' })
  })
  it('fora do esquema vai ao Sentry como erro', async () => {
    await lerPagina(sbCom(null, { nada: true }), 's')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('obs_archive_pagina fora do esquema', 'error')
  })
  it('42883 e PGRST202: funcao_ausente, sem Sentry', async () => {
    for (const code of ['42883', 'PGRST202']) expect(await lerPagina(sbCom({ code }), 's')).toEqual({ ok: false, porque: 'funcao_ausente' })
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })
  it('outro erro: erro_do_banco, com Sentry', async () => {
    expect(await lerPagina(sbCom({ code: '57014' }), 's')).toEqual({ ok: false, porque: 'erro_do_banco' })
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })
})
