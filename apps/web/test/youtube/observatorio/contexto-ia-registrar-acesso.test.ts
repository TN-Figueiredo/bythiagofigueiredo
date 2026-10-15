// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 9: o registro do botão (`obs_ai_access_log`, origem `botao`). O cliente de serviço é simulado.
 * O prazo se corta pelo sinal (`abortSignal`); o código `tempo` é decidido por `sinal.aborted`, nunca pelo formato do erro do cliente.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const criar = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => criar() }))

import { registrarAcesso } from '@/lib/youtube/observatorio/contexto-ia/registrar-acesso'

const LINHA = {
  siteId: '00000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002', tela: 'outliers' as const,
  params: { tela: 'outliers', total: 12 }, incluiuPrivado: false, caracteres: 1234,
}

interface Sim { insercoes: Array<{ tabela: string; linha: Record<string, unknown> }>; sinais: AbortSignal[] }
function cliente(resposta: { error: { code?: string } | null } | 'lanca' | 'ouve-o-sinal'): Sim {
  const sim: Sim = { insercoes: [], sinais: [] }
  criar.mockReturnValue({
    from: (tabela: string) => ({
      insert: (linha: Record<string, unknown>) => ({
        abortSignal: (s: AbortSignal) => {
          sim.insercoes.push({ tabela, linha }); sim.sinais.push(s)
          if (resposta === 'lanca') return Promise.reject(new Error('o banco quebrou'))
          if (resposta === 'ouve-o-sinal') return new Promise((_, rej) => s.addEventListener('abort', () => rej(new Error('abortado')), { once: true }))
          return Promise.resolve(resposta)
        },
      }),
    }),
  })
  return sim
}

afterEach(() => { criar.mockReset(); vi.restoreAllMocks(); delete process.env.VERCEL_ENV })

describe('registrarAcesso', () => {
  it('grava uma linha com cada campo: origin botao, key_id ausente, action pacote:<tela>, result ok', async () => {
    const sim = cliente({ error: null })
    const r = await registrarAcesso(LINHA)
    expect(r).toEqual({ ok: true })
    expect(sim.insercoes).toHaveLength(1)
    expect(sim.insercoes[0]).toEqual({
      tabela: 'obs_ai_access_log',
      linha: {
        site_id: LINHA.siteId, user_id: LINHA.userId, origin: 'botao', action: 'pacote:outliers',
        params: { tela: 'outliers', total: 12, ambiente: 'local' }, included_private: false, output_chars: 1234, result: 'ok',
      },
    })
    expect('key_id' in sim.insercoes[0]!.linha).toBe(false)
  })

  it('o insert devolve sem erro e sem dado: vale como gravado', async () => {
    cliente({ error: null })
    expect((await registrarAcesso(LINHA)).ok).toBe(true)
  })

  it('erro do banco: devolve o code do banco; sem code, "desconhecido"', async () => {
    cliente({ error: { code: '42P01' } })
    expect(await registrarAcesso(LINHA)).toEqual({ ok: false, code: '42P01' })
    cliente({ error: {} })
    expect(await registrarAcesso(LINHA)).toEqual({ ok: false, code: 'desconhecido' })
  })

  it('erro do banco com o sinal NÃO abortado: o code é o do banco, não "tempo"', async () => {
    const sim = cliente({ error: { code: 'PGRST205' } })
    const r = await registrarAcesso(LINHA)
    expect(r).toEqual({ ok: false, code: 'PGRST205' })
    expect(sim.sinais[0]!.aborted).toBe(false)
  })

  it('o cliente lança sem abortar: nunca lança, devolve "excecao"', async () => {
    cliente('lanca')
    expect(await registrarAcesso(LINHA)).toEqual({ ok: false, code: 'excecao' })
  })

  it('a criação do cliente lança: nunca lança, devolve "excecao"', async () => {
    criar.mockImplementation(() => { throw new Error('sem chave de serviço') })
    expect(await registrarAcesso(LINHA)).toEqual({ ok: false, code: 'excecao' })
  })

  it('a gravação não responde: passado o prazo vira "tempo", com o sinal de cancelamento (relógio de verdade)', async () => {
    const sim = cliente('ouve-o-sinal')
    const r = await registrarAcesso(LINHA, { prazoMs: 20 })
    expect(r).toEqual({ ok: false, code: 'tempo' })
    expect(sim.sinais[0]!.aborted).toBe(true)
  })

  it('sem opcoes, o prazo é 5.000', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    cliente({ error: null })
    await registrarAcesso(LINHA)
    expect(espia).toHaveBeenCalledWith(5_000)
  })

  it('params.ambiente: VERCEL_ENV=production grava "production"; variável APAGADA grava "local"', async () => {
    process.env.VERCEL_ENV = 'production'
    let sim = cliente({ error: null })
    await registrarAcesso(LINHA)
    expect((sim.insercoes[0]!.linha.params as Record<string, unknown>).ambiente).toBe('production')
    delete process.env.VERCEL_ENV
    sim = cliente({ error: null })
    await registrarAcesso(LINHA)
    expect((sim.insercoes[0]!.linha.params as Record<string, unknown>).ambiente).toBe('local')
  })

  it('included_private e output_chars seguem o que veio', async () => {
    const sim = cliente({ error: null })
    await registrarAcesso({ ...LINHA, incluiuPrivado: true, caracteres: 0 })
    expect(sim.insercoes[0]!.linha).toMatchObject({ included_private: true, output_chars: 0 })
  })
})
