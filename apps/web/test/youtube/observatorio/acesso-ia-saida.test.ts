// @vitest-environment node
/**
 * A5 F1b T6: `saida` ('texto' | 'tabela') nas três listas (listar_canais, destaques, mudancas). Esquema, tradução, exemplos, forma do MCP e registro.
 * `comparar` não ganha `saida` (D10); as demais ações a recusam com o formato e o exemplo da A7 T6.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>> }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { CAMPOS_DA_ACAO, EXEMPLO_DA_ACAO, FORMATO_DA_ACAO } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import { registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'

const C1 = '11111111-1111-4111-8111-111111111111'
const V1 = 'dQw4w9WgXcQ'
const AGORA = Date.UTC(2026, 10, 9, 15)
const COM_SAIDA = ['listar_canais', 'destaques', 'mudancas'] as const
const SEM_SAIDA: Array<[string, Record<string, unknown>]> = [
  ['definicoes', {}], ['canal', { canal_id: C1 }], ['video', { video_id: V1 }], ['comparar', { canal_ids: [C1, 'aaaaaaaa-1111-4111-8111-111111111111'] }],
  ['sugestoes', {}], ['pacote_da_tela', { tela: 'insights' }],
]
beforeEach(() => { for (const t of ['canais', 'outliers', 'mudancas', 'canal', 'insights']) m.empacotar[t] = vi.fn(async () => null) })

describe('saida no esquema e no tradutor', () => {
  it.each(COM_SAIDA)('%s aceita saida texto e tabela e entrega em Pedido.saida; sem saida o padrão é texto', (acao) => {
    for (const s of ['texto', 'tabela'] as const) {
      const lida = ENTRADA.safeParse({ acao, saida: s })
      expect(lida.success).toBe(true)
      if (!lida.success) continue
      const t = traduzir(lida.data)
      expect(t.ok && t.pedido.saida).toBe(s)
    }
    const t = traduzir(ENTRADA.parse({ acao }))
    expect(t.ok && t.pedido.saida).toBe('texto')
  })
  it.each(SEM_SAIDA)('%s recusa saida pelo responder real, com o formato e o exemplo da ação', async (acao, resto) => {
    const r = await responder({ acao, ...resto, saida: 'tabela' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toContain(`Formato de ${acao}: `)
    expect(r.texto).toContain('Exemplo válido: ')
  })
  it.each(COM_SAIDA)('%s: saida "planilha" é recusada com "saida: valor fora da lista"', async (acao) => {
    const r = await responder({ acao, saida: 'planilha' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toContain('saida: valor fora da lista')
  })
})

describe('exemplos e formato', () => {
  it.each(COM_SAIDA)('%s cita saida no formato e nos campos', (a) => {
    expect(CAMPOS_DA_ACAO[a]).toContain('saida')
    expect(FORMATO_DA_ACAO[a]).toContain('saida')
  })
  it('as outras ações (e comparar) não citam saida', () => {
    for (const a of ['definicoes', 'canal', 'video', 'comparar', 'sugestoes', 'pacote_da_tela'] as const) {
      expect(CAMPOS_DA_ACAO[a]).not.toContain('saida')
      expect(FORMATO_DA_ACAO[a]).not.toContain('saida')
    }
  })
  it('um exemplo mostra saida tabela e é válido', () => {
    const ex = Object.values(EXEMPLO_DA_ACAO).filter((e) => e.includes('"saida":"tabela"'))
    expect(ex.length).toBeGreaterThan(0)
    for (const e of ex) expect(ENTRADA.safeParse(JSON.parse(e.replace(/<[^>]*>/g, C1))).success).toBe(true)
  })
})

describe('registro', () => {
  const inserido = async (params: Record<string, unknown>) => {
    const linhas: Array<Record<string, unknown>> = []
    const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
    const r = await registrarAcessoDaChave(sb as never, { prova: fabricarProva('site-da-prova', 'user-da-prova', 'key-da-prova', new Date(Date.now() + 86_400_000).toISOString()), acao: 'listar_canais', params: { desfecho: 'ok', ...params } as never, incluiuPrivado: false, caracteres: 10, resultado: 'ok' })
    expect(r.ok).toBe(true)
    return linhas[0]!.params as Record<string, unknown>
  }
  it('grava saida tabela e texto; descarta csv', async () => {
    expect((await inserido({ saida: 'tabela' })).saida).toBe('tabela')
    expect((await inserido({ saida: 'texto' })).saida).toBe('texto')
    expect(await inserido({ saida: 'csv' })).not.toHaveProperty('saida')
  })
  it('responder grava a saida efetiva nos params', async () => {
    const r = await responder({ acao: 'listar_canais', saida: 'tabela' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.params.saida).toBe('tabela')
  })
})
