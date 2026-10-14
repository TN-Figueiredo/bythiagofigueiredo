// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 6: o registro de acesso de IA (`obs_ai_access_log`). "Sem linha, sem dado": a linha `ok` é gravada antes de a ferramenta
 * devolver qualquer coisa; a linha `limite` e a `recusado` (da porta) são de melhor esforço. O cliente de serviço é simulado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  houveRecusaRecente,
  registrarAcessoDaChave,
  registrarRecusaDaPorta,
  type LinhaDeAcesso,
} from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'

const AGORA = Date.parse('2026-10-13T15:00:00.000Z')
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()

type Resp = { data?: unknown; error: { code?: string; message?: string } | null }

interface Sim {
  sb: never
  insercoes: Array<{ tabela: string; linha: Record<string, unknown> }>
  consultas: Array<[string, unknown[]]>
  sinais: AbortSignal[]
  desde: () => number
}

function simular(resposta: Resp | 'lanca' | 'pendente'): Sim {
  const insercoes: Sim['insercoes'] = []
  const consultas: Sim['consultas'] = []
  const sinais: AbortSignal[] = []
  const fim = (s: AbortSignal) => {
    sinais.push(s)
    if (resposta === 'lanca') return Promise.reject(new Error('o banco quebrou'))
    if (resposta === 'pendente') return new Promise(() => {})
    return Promise.resolve(resposta)
  }
  const sb = {
    from: (tabela: string) => {
      const cadeia: Record<string, (...a: unknown[]) => unknown> = {}
      for (const m of ['select', 'eq', 'gte', 'order', 'limit']) {
        cadeia[m] = (...a: unknown[]) => { consultas.push([m, a]); return cadeia }
      }
      cadeia.insert = (linha: unknown) => { insercoes.push({ tabela, linha: linha as Record<string, unknown> }); return cadeia }
      cadeia.abortSignal = (s: unknown) => fim(s as AbortSignal)
      return cadeia
    },
  }
  return { sb: sb as never, insercoes, consultas, sinais, desde: () => insercoes.length }
}

const prova = () => fabricarProva('site-da-prova', 'user-da-prova', 'key-da-prova', iso(AGORA + 86_400_000))

const linha = (o: Partial<LinhaDeAcesso> = {}): LinhaDeAcesso => ({
  prova: prova(),
  acao: 'canal',
  params: { acao: 'canal', canal_id: 'UC123', desfecho: 'ok' },
  incluiuPrivado: false,
  caracteres: 1234,
  resultado: 'ok',
  ...o,
})

beforeEach(() => { delete process.env.VERCEL_ENV })
afterEach(() => { delete process.env.VERCEL_ENV })

describe('registrarAcessoDaChave', () => {
  it('caminho feliz: o objeto inteiro do insert, campo por campo (user_id nunca nulo)', async () => {
    const s = simular({ data: null, error: null })
    const r = await registrarAcessoDaChave(s.sb, linha({ incluiuPrivado: true, caracteres: 4321, params: { acao: 'canal', canal_id: 'UC123', janela: '30d', desfecho: 'ok' } }))
    expect(r).toEqual({ ok: true })
    expect(s.insercoes).toEqual([
      {
        tabela: 'obs_ai_access_log',
        linha: {
          site_id: 'site-da-prova',
          user_id: 'user-da-prova',
          key_id: 'key-da-prova',
          origin: 'mcp',
          action: 'canal',
          params: { acao: 'canal', canal_id: 'UC123', janela: '30d', desfecho: 'ok', ambiente: 'local' },
          included_private: true,
          output_chars: 4321,
          result: 'ok',
        },
      },
    ])
    expect(s.insercoes[0]!.linha.user_id).not.toBeNull()
  })

  it('o site, a pessoa e a chave vêm da prova: um site_id (ou user_id) em params é descartado', async () => {
    const s = simular({ data: null, error: null })
    await registrarAcessoDaChave(s.sb, linha({ params: { desfecho: 'ok', site_id: 'site-do-atacante', user_id: 'outro', key_id: 'outra' } as LinhaDeAcesso['params'] }))
    const gravada = s.insercoes[0]!.linha as { site_id: string; user_id: string; key_id: string; params: Record<string, unknown> }
    expect(gravada.site_id).toBe('site-da-prova')
    expect(gravada.user_id).toBe('user-da-prova')
    expect(gravada.key_id).toBe('key-da-prova')
    expect(Object.keys(gravada.params).sort()).toEqual(['ambiente', 'desfecho'])
  })

  it('params com as chaves pergunta, texto e resposta (e qualquer outra fora da lista): descartadas', async () => {
    const s = simular({ data: null, error: null })
    await registrarAcessoDaChave(s.sb, linha({ params: { desfecho: 'ok', pergunta: 'o que ele publica?', texto: 'comentário', resposta: 'x', termo: 'viagem', canal_id: 'UC1' } as LinhaDeAcesso['params'] }))
    expect(s.insercoes[0]!.linha.params).toEqual({ desfecho: 'ok', canal_id: 'UC1', ambiente: 'local' })
  })

  it('a lista fechada de chaves aceita todas as 18 do plano', async () => {
    const todas = ['acao', 'tela', 'canal_id', 'video_id', 'canal_ids', 'janela', 'formato', 'nicho', 'grao', 'de', 'ate', 'desfecho', 'privado', 'comentarios', 'cortes', 'pares', 'ambiente', 'por']
    const params: Record<string, string | number | boolean | string[]> = {}
    for (const k of todas) params[k] = k === 'canal_ids' ? ['a', 'b'] : k === 'cortes' || k === 'pares' ? 2 : k === 'comentarios' ? false : 'x'
    params.desfecho = 'ok'
    const s = simular({ data: null, error: null })
    await registrarAcessoDaChave(s.sb, linha({ params }))
    expect(Object.keys(s.insercoes[0]!.linha.params as object).sort()).toEqual([...todas].sort())
  })

  it('valor de texto de 300 caracteres é cortado em 64; elementos de lista também; __proto__ não passa', async () => {
    const s = simular({ data: null, error: null })
    const longo = 'x'.repeat(300)
    await registrarAcessoDaChave(s.sb, linha({ params: { desfecho: 'ok', canal_id: longo, canal_ids: [longo, 'curto'] } }))
    const p = s.insercoes[0]!.linha.params as { canal_id: string; canal_ids: string[] }
    expect(p.canal_id).toHaveLength(64)
    expect(p.canal_ids[0]).toHaveLength(64)
    expect(p.canal_ids[1]).toBe('curto')
    const s2 = simular({ data: null, error: null })
    await registrarAcessoDaChave(s2.sb, linha({ params: JSON.parse('{"desfecho":"ok","__proto__":{"canal_id":"x"}}') as LinhaDeAcesso['params'] }))
    expect(Object.keys(s2.insercoes[0]!.linha.params as object).sort()).toEqual(['ambiente', 'desfecho'])
  })

  it("ambiente: com VERCEL_ENV APAGADA grava 'local'; com 'production' grava 'production'; o ambiente que vier em params não vale", async () => {
    const a = simular({ data: null, error: null })
    await registrarAcessoDaChave(a.sb, linha({ params: { desfecho: 'ok', ambiente: 'inventado' } }))
    expect((a.insercoes[0]!.linha.params as { ambiente: string }).ambiente).toBe('local')
    process.env.VERCEL_ENV = 'production'
    const b = simular({ data: null, error: null })
    await registrarAcessoDaChave(b.sb, linha())
    expect((b.insercoes[0]!.linha.params as { ambiente: string }).ambiente).toBe('production')
  })

  it('erro do banco: ok false com o code; sem code vira desconhecido', async () => {
    expect(await registrarAcessoDaChave(simular({ error: { code: '23503', message: 'x' } }).sb, linha())).toEqual({ ok: false, code: '23503' })
    expect(await registrarAcessoDaChave(simular({ error: { message: 'x' } }).sb, linha())).toEqual({ ok: false, code: 'desconhecido' })
  })

  it.each(['42P01', 'PGRST205'])('tabela ausente (%s): ok false', async (code) => {
    expect(await registrarAcessoDaChave(simular({ error: { code } }).sb, linha())).toEqual({ ok: false, code })
  })

  it('exceção: nunca lança', async () => {
    expect(await registrarAcessoDaChave(simular('lanca').sb, linha())).toEqual({ ok: false, code: 'excecao' })
  })

  it('não responde: com prazoMs 20 e relógio de verdade vira code tempo, e o insert recebeu sinal de cancelamento', async () => {
    const s = simular('pendente')
    expect(await registrarAcessoDaChave(s.sb, linha(), { prazoMs: 20 })).toEqual({ ok: false, code: 'tempo' })
    expect(s.sinais).toHaveLength(1)
    expect(s.sinais[0]!.aborted).toBe(true)
  })

  it('sem opcoes o prazo é 5.000 (espia AbortSignal.timeout)', async () => {
    const espia = vi.spyOn(AbortSignal, 'timeout')
    await registrarAcessoDaChave(simular({ data: null, error: null }).sb, linha())
    expect(espia.mock.calls.map((c) => c[0])).toEqual([5_000])
    espia.mockRestore()
  })

  it('insert sem erro e sem dado vale como gravado', async () => {
    expect(await registrarAcessoDaChave(simular({ error: null }).sb, linha())).toEqual({ ok: true })
  })

  it('linha sem desfecho: não grava, code sem_desfecho', async () => {
    const s = simular({ data: null, error: null })
    expect(await registrarAcessoDaChave(s.sb, linha({ params: { acao: 'canal' } }))).toEqual({ ok: false, code: 'sem_desfecho' })
    expect(await registrarAcessoDaChave(s.sb, linha({ params: { desfecho: '' } }))).toEqual({ ok: false, code: 'sem_desfecho' })
    expect(s.insercoes).toEqual([])
  })

  it.each(['falhou', 'tempo', 'pedido_invalido', 'nao_encontrado'])("desfecho %s com caracteres 1234: grava output_chars nulo (nada foi entregue)", async (desfecho) => {
    const s = simular({ data: null, error: null })
    await registrarAcessoDaChave(s.sb, linha({ params: { desfecho }, caracteres: 1234 }))
    expect(s.insercoes[0]!.linha.output_chars).toBeNull()
  })

  it('para cada desfecho que não é ok (limite, tempo, falhou, pedido_invalido, nao_encontrado), com incluiuPrivado true na entrada: a linha gravada tem included_private false', async () => {
    for (const desfecho of ['limite', 'tempo', 'falhou', 'pedido_invalido', 'nao_encontrado']) {
      const s = simular({ data: null, error: null })
      await registrarAcessoDaChave(s.sb, linha({ params: { desfecho }, incluiuPrivado: true, resultado: desfecho === 'limite' ? 'limite' : 'ok' }))
      expect(s.insercoes[0]!.linha.included_private, desfecho).toBe(false)
      expect(s.insercoes[0]!.linha.output_chars, desfecho).toBeNull()
    }
  })

  it('desfecho ok com incluiuPrivado true: grava true', async () => {
    const s = simular({ data: null, error: null })
    await registrarAcessoDaChave(s.sb, linha({ incluiuPrivado: true }))
    expect(s.insercoes[0]!.linha.included_private).toBe(true)
  })

  it("a linha 'limite' leva result limite, params.desfecho limite e params.por", async () => {
    const s = simular({ data: null, error: null })
    await registrarAcessoDaChave(s.sb, linha({ resultado: 'limite', params: { acao: 'canal', desfecho: 'limite', por: 'minuto' }, caracteres: null }))
    expect(s.insercoes[0]!.linha).toMatchObject({ result: 'limite', output_chars: null, included_private: false, params: { desfecho: 'limite', por: 'minuto', ambiente: 'local' } })
  })
})

describe('houveRecusaRecente', () => {
  it('uma linha de 59 minutos: sim; de 61: nao', async () => {
    expect(await houveRecusaRecente(simular({ data: [{ at: iso(AGORA - 59 * MIN) }], error: null }).sb, 'key-1', AGORA)).toBe('sim')
    expect(await houveRecusaRecente(simular({ data: [{ at: iso(AGORA - 61 * MIN) }], error: null }).sb, 'key-1', AGORA)).toBe('nao')
  })

  it('nenhuma linha lida sem erro: nao', async () => {
    expect(await houveRecusaRecente(simular({ data: [], error: null }).sb, 'key-1', AGORA)).toBe('nao')
  })

  it('erro, prazo, tabela ausente, exceção e dado nulo: nao_conferido (a dúvida NÃO grava)', async () => {
    expect(await houveRecusaRecente(simular({ data: null, error: { code: '57014' } }).sb, 'k', AGORA)).toBe('nao_conferido')
    expect(await houveRecusaRecente(simular({ data: null, error: { code: '42P01' } }).sb, 'k', AGORA)).toBe('nao_conferido')
    expect(await houveRecusaRecente(simular({ data: null, error: null }).sb, 'k', AGORA)).toBe('nao_conferido')
    expect(await houveRecusaRecente(simular('lanca').sb, 'k', AGORA)).toBe('nao_conferido')
    expect(await houveRecusaRecente(simular('pendente').sb, 'k', AGORA, { prazoMs: 20 })).toBe('nao_conferido')
  })

  it('uma linha com at ilegível: nao_conferido', async () => {
    expect(await houveRecusaRecente(simular({ data: [{ at: 'ontem' }], error: null }).sb, 'k', AGORA)).toBe('nao_conferido')
  })

  it("filtra por key_id e por result = 'recusado' e pela última hora (argumentos exatos)", async () => {
    const s = simular({ data: [], error: null })
    await houveRecusaRecente(s.sb, 'key-do-pedido', AGORA)
    expect(s.consultas).toEqual([
      ['select', ['at']],
      ['eq', ['key_id', 'key-do-pedido']],
      ['eq', ['result', 'recusado']],
      ['gte', ['at', iso(AGORA - 3_600_000)]],
      ['order', ['at', { ascending: false }]],
      ['limit', [1]],
    ])
  })
})

describe('registrarRecusaDaPorta', () => {
  it.each(['banida', 'ausente', 'apagamento_pedido', 'sem_vinculo'] as const)('desfecho %s: o objeto INTEIRO do insert, campo por campo', async (desfecho) => {
    const s = simular({ data: null, error: null })
    const r = await registrarRecusaDaPorta(s.sb, { siteId: 'site-1', userId: 'user-1', keyId: 'key-1', desfecho })
    expect(r).toEqual({ ok: true })
    expect(s.insercoes).toEqual([
      {
        tabela: 'obs_ai_access_log',
        linha: {
          site_id: 'site-1',
          user_id: 'user-1',
          key_id: 'key-1',
          origin: 'mcp',
          action: 'porta',
          params: { desfecho, ambiente: 'local' },
          included_private: false,
          output_chars: null,
          result: 'recusado',
        },
      },
    ])
  })

  it('os três ids vêm do argumento, e a função não aceita prova (prova de tipo; e, se passar por cast, sem desfecho nada é gravado)', async () => {
    const s = simular({ data: null, error: null })
    // @ts-expect-error uma ChaveDoPerfilProvada não é o argumento (falta o desfecho)
    const r = await registrarRecusaDaPorta(s.sb, prova())
    expect(r).toEqual({ ok: false, code: 'desfecho_invalido' })
    expect(s.insercoes).toEqual([])
  })

  it('o insert falha por chave estrangeira (23503: a pessoa foi apagada no meio): ok false com o code, sem segunda tentativa', async () => {
    const s = simular({ error: { code: '23503' } })
    expect(await registrarRecusaDaPorta(s.sb, { siteId: 's', userId: 'u', keyId: 'k', desfecho: 'banida' })).toEqual({ ok: false, code: '23503' })
    expect(s.desde()).toBe(1)
  })

  it('exceção e prazo: nunca lança', async () => {
    expect(await registrarRecusaDaPorta(simular('lanca').sb, { siteId: 's', userId: 'u', keyId: 'k', desfecho: 'ausente' })).toEqual({ ok: false, code: 'excecao' })
    expect(await registrarRecusaDaPorta(simular('pendente').sb, { siteId: 's', userId: 'u', keyId: 'k', desfecho: 'ausente' }, { prazoMs: 20 })).toEqual({ ok: false, code: 'tempo' })
  })
})
