// @vitest-environment node
/**
 * Produção 10/11: `mudancas` com `canal_id` devolvia "não foi possível registrar a consulta". Aqui a resposta do `responder` (fixture com canal)
 * passa pelo `registrarAcessoDaChave` real, e a linha gravada é conferida contra o que o banco aceita (origin/result/not null/integer).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import type { PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { AGORA, medido, modeloCheio, terceiros } from './contexto-ia-fixture'

const C1 = '8f9d55ce-16f0-4f9f-9939-9108eee2319f'

beforeEach(() => { m.empacotar.mudancas = vi.fn() })

function modeloMudancas(): PacoteModelo {
  const t: Tabela = {
    id: 'trocas', titulo: 'Trocas', tipo: 'lista', nomeNoCorte: 'tabela trocas', privada: false, colunas: ['Item', 'Valor'],
    linhas: Array.from({ length: 5 }, (_, i) => [terceiros(`Item ${i + 1}`, `p.l[${i}].n`), medido(`${i + 1}`, i + 1, `p.l[${i}].v`)]),
  }
  return { ...modeloCheio(), tela: 'mudancas', tabelas: [t] }
}

describe('registro de mudancas com canal', () => {
  it('a linha que o registrar monta cabe no que a tabela aceita', async () => {
    m.empacotar.mudancas!.mockImplementation(async () => ({ modelo: modeloMudancas(), recente: '13/10/2026 09:10', estado: {} }))
    const r = await responder({ acao: 'mudancas', canal_id: C1, janela: '30' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('ok')
    const linhas: Array<Record<string, unknown>> = []
    const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
    const prova = fabricarProva('site', 'user', 'key', new Date(Date.now() + 86_400_000).toISOString())
    const reg = await registrarAcessoDaChave(sb as never, { prova, acao: 'mudancas', params: { ...r.params, acao: 'mudancas', desfecho: r.desfecho }, incluiuPrivado: r.incluiuPrivado, caracteres: r.texto.length, resultado: 'ok' })
    expect(reg).toEqual({ ok: true })
    const l = linhas[0]!
    expect(typeof l.included_private).toBe('boolean')
    expect(Number.isInteger(l.output_chars)).toBe(true)
    expect(['ok', 'recusado', 'limite']).toContain(l.result)
    expect(l.params).toMatchObject({ acao: 'mudancas', canal_id: C1, janela: '30', desfecho: 'ok' })
    expect(() => JSON.stringify(l)).not.toThrow()
  })
})
