// @vitest-environment node
/**
 * A7e T6: toda ação tem formato e exemplo; todo exemplo passa por `ENTRADA` e `traduzir`; a recusa, pelo `responder` real, traz o formato
 * e um exemplo válido da ação (ou a lista das ações, quando a ação não existe), sem ecoar o que a pessoa escreveu.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { ACOES, ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { CAMPOS_DA_ACAO, EXEMPLO_DA_ACAO, FORMATO_DA_ACAO, exemploValido } from '@/lib/youtube/observatorio/acesso-ia/exemplos'

const C1 = '11111111-1111-4111-8111-111111111111'
const AGORA = Date.UTC(2026, 10, 9, 15)
beforeEach(() => { m.empacotar.canais = vi.fn(async () => null); m.empacotar.outliers = vi.fn(async () => null) })

describe('inventário: toda ação tem exemplo, todo exemplo é válido', () => {
  it.each(ACOES)('%s: o exemplo (com fixture no lugar do <...>) passa por ENTRADA e traduzir e é da própria ação', (a) => {
    expect(EXEMPLO_DA_ACAO[a]).toBeTruthy()
    const dado = JSON.parse(exemploValido(a, { uuid: C1, video: 'dQw4w9WgXcQ' })) as unknown
    const lida = ENTRADA.safeParse(dado)
    expect(lida.success).toBe(true)
    if (!lida.success) return
    expect(lida.data.acao).toBe(a)
    const t = traduzir(lida.data)
    expect(t.ok).toBe(true)
    // nenhum exemplo pode ensinar um campo que a tela ignora ("Não aplicado")
    expect((t as { pedido: { semEquivalente: unknown[] } }).pedido.semEquivalente).toEqual([])
  })
  it('o exemplo cru (com <...>) é JSON e é o que a recusa mostra', () => {
    for (const a of ACOES) expect(() => JSON.parse(EXEMPLO_DA_ACAO[a])).not.toThrow()
  })
  it.each(ACOES)('%s: CAMPOS_DA_ACAO = campos do shape, e cada campo aparece no formato', (a) => {
    const opt = ENTRADA.options.find((o) => o.shape.acao.value === a)!
    expect([...CAMPOS_DA_ACAO[a]]).toEqual(Object.keys(opt.shape).filter((k) => k !== 'acao').sort())
    for (const c of CAMPOS_DA_ACAO[a]) expect(FORMATO_DA_ACAO[a]).toContain(c)
  })
})

describe('a recusa, pelo responder real', () => {
  const abrir = ABRIDOR_DE_SESSAO
  it('destaques com formato "longo": pedido_invalido, formato e exemplo da ação, sem ecoar o valor', async () => {
    const r = await responder({ acao: 'destaques', formato: 'longo' }, abrir, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toContain('Exemplo válido: {"acao":"destaques"')
    expect(r.texto).toContain('Formato de destaques: ')
    expect(r.texto).toContain(FORMATO_DA_ACAO.destaques)
    expect(r.texto).not.toContain('longo"')
    expect(m.empacotar.outliers).not.toHaveBeenCalled()
  })
  it('a recusa do tradutor (comparar com 1 canal) leva o mesmo sufixo', async () => {
    const r = await responder({ acao: 'comparar', canal_ids: [C1] }, abrir, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toContain('comparar aceita de 2 a 6 canais; vieram 1')
    expect(r.texto).toContain(`Exemplo válido: ${EXEMPLO_DA_ACAO.comparar}`)
  })
  it.each([[{ acao: 'xpto' }], [{}], [null], [{ acao: 'listar_canais', formato: 'xpto' }]])('%j: ação fora da lista traz as ações; "xpto" não volta', async (e) => {
    const r = await responder(e, abrir, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    if ((e as { acao?: string } | null)?.acao === 'listar_canais') return
    expect(r.texto).toContain(`Ações: ${ACOES.join(', ')}`)
    expect(r.texto).toContain('Exemplo válido: {"acao":"listar_canais"}')
    expect(r.texto).not.toContain('xpto')
  })
  it('ação conhecida com campo estranho: o campo não volta', async () => {
    const r = await responder({ acao: 'canal', canal_id: C1, ZZ_ESTRANHO: 1 }, abrir, AGORA)
    expect(r.texto).toContain('Formato de canal: ')
    expect(r.texto).not.toContain('ZZ_ESTRANHO')
  })
})

describe('A7b T8: o registro recebe a_partir_da_linha do pedido', () => {
  it('{acao:"listar_canais", a_partir_da_linha:"41"} grava params.a_partir_da_linha === 41 (a lista vazia responde ok)', async () => {
    m.empacotar.canais = vi.fn(async () => null)
    const r = await responder({ acao: 'listar_canais', a_partir_da_linha: '41' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.params.a_partir_da_linha).toBe(41)
  })
  it('o exemplo de listar_canais ensina a_partir_da_linha e o formato o cita', () => {
    expect(EXEMPLO_DA_ACAO.listar_canais).toContain('"a_partir_da_linha":41')
    for (const a of ['listar_canais', 'destaques', 'mudancas'] as const) {
      expect(CAMPOS_DA_ACAO[a]).toContain('a_partir_da_linha')
      expect(FORMATO_DA_ACAO[a]).toContain('a_partir_da_linha')
      expect(FORMATO_DA_ACAO[a]).toContain('marca')
    }
  })
})
