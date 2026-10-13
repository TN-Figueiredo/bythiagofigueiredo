// @vitest-environment node
// A5 · E14, Tarefa 10: o veredito da prova (puro) e a anulação da identidade dos autores (LGPD, aos 28 dias).
// Cliente falso, dado 100% inventado, datas relativas ao NOW do arquivo.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const captureMessage = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({ captureMessage }))

import { veredito } from '@/lib/youtube/observatorio/comentarios/prova'
import { runAnularIdentidade } from '@/lib/youtube/observatorio/comentarios/anular'
import { CODIGOS_EXECUCAO, COMMENT_RULES, MOTIVOS, MOTIVOS_PASSAGEIROS } from '@/lib/youtube/observatorio/comentarios/regras'
import { fraseDe } from '@/lib/youtube/observatorio/comentarios/frases'
import type { ProvaComentarios } from '@/lib/youtube/observatorio/comentarios/tipos'
import { H, SENT_NOME, SENT_TEXTO_TOPO, T0, iso } from './comentarios-fixtures'

const NOW_MS = T0 + 4 * 24 * H
const agora = (): number => NOW_MS

// ───── a prova: tudo zero, e uma cópia por teste ─────
const ZERO: ProvaComentarios = {
  identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0, retratos_atrasados: 0,
  retratos_em_erro: 0, erros_por_motivo: {}, retratos_na_janela: 0, retratos_perdidos_7d: 0, perdidos_por_motivo: {},
  retratos_total: 0, retratos_ok: 0, primeira_coleta: null, ultima_coleta: null, comentarios_total: 0, identidades_total: 0,
  comentarios_ausentes_sem_decisao: 0,
}
const com = (o: Partial<ProvaComentarios>): ProvaComentarios => ({ ...ZERO, ...o })
const FILA_ZERADA = { filaZerada: true }
const FILA_PENDENTE = { filaZerada: false }
const codigos = (p: ProvaComentarios | null, ctx: { filaZerada: boolean; so?: 'identidade' } = FILA_ZERADA): string[] =>
  veredito(p, ctx).vermelhos.map((v) => v.codigo)

// ───── veredito ─────
describe('veredito', () => {
  it('cada número da tabela sobe sozinho e dá o código da linha (oito casos)', () => {
    const casos: Array<[Partial<ProvaComentarios>, string, number]> = [
      [{ identidade_vencida: 1 }, 'identidade_vencida', 1],
      [{ identidade_prazo_errado: 2 }, 'identidade_invariante', 2],
      [{ identidade_de_criador: 1 }, 'identidade_invariante', 1],
      [{ respostas_de_terceiros: 3 }, 'identidade_invariante', 3],
      [{ retratos_atrasados: 4 }, 'retratos_atrasados', 4],
      [{ retratos_perdidos_7d: 1, perdidos_por_motivo: { sem_retrato: 1 } }, 'retratos_perdidos', 1],
      [{ retratos_em_erro: 3, erros_por_motivo: { http_400: 3 } }, 'erros_presos', 3],
      [{ retratos_em_erro: 3, erros_por_motivo: { proibido: 3 } }, 'erros_presos', 3],
    ]
    for (const [parcial, codigo, n] of casos) {
      const r = veredito(com(parcial), FILA_ZERADA)
      expect(r.vermelhos, JSON.stringify(parcial)).toEqual([{ codigo, n }])
    }
  })

  it('nenhum sobe com tudo zero e mapas vazios', () => {
    const r = veredito(ZERO, FILA_ZERADA)
    expect(r.vermelhos).toEqual([])
    expect(veredito(ZERO, FILA_PENDENTE).vermelhos).toEqual([])
  })

  it('as três invariantes viram uma linha só, com a soma; o código sai na ordem de CODIGOS_EXECUCAO', () => {
    const r = veredito(com({
      identidade_prazo_errado: 1, identidade_de_criador: 2, respostas_de_terceiros: 4, identidade_vencida: 1, retratos_atrasados: 2,
    }), FILA_ZERADA)
    expect(r.vermelhos).toEqual([
      { codigo: 'identidade_vencida', n: 1 },
      { codigo: 'identidade_invariante', n: 7 },
      { codigo: 'retratos_atrasados', n: 2 },
    ])
    const pos = r.vermelhos.map((v) => CODIGOS_EXECUCAO.indexOf(v.codigo))
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  })

  it('prova nula é vermelho (nunca verde por falta)', () => {
    expect(veredito(null, FILA_ZERADA)).toEqual({ vermelhos: [{ codigo: 'prova_ilegivel', n: 1 }], numeros: {} })
    expect(codigos(null, FILA_PENDENTE)).toEqual(['prova_ilegivel'])
    expect(codigos(null, { filaZerada: false, so: 'identidade' })).toEqual(['prova_ilegivel'])
  })

  it('prova fora da forma é vermelho: lista no lugar de objeto, chave faltando, tipo errado, negativo, fração', () => {
    const semChave: Record<string, unknown> = { ...ZERO }
    delete semChave.retratos_atrasados
    const semMapa: Record<string, unknown> = { ...ZERO }
    delete semMapa.perdidos_por_motivo
    const semData: Record<string, unknown> = { ...ZERO }
    delete semData.ultima_coleta
    const ruins: unknown[] = [
      [], [ZERO], 'texto', 7, undefined, true,
      semChave, semMapa, semData,
      { ...ZERO, identidade_vencida: '0' }, { ...ZERO, identidade_vencida: null }, { ...ZERO, identidade_vencida: NaN },
      { ...ZERO, identidade_vencida: -1 }, { ...ZERO, retratos_total: -5 }, { ...ZERO, retratos_atrasados: 1.5 },
      { ...ZERO, erros_por_motivo: [] }, { ...ZERO, erros_por_motivo: { rede: '2' } }, { ...ZERO, perdidos_por_motivo: { sem_retrato: -1 } },
      { ...ZERO, perdidos_por_motivo: null }, { ...ZERO, primeira_coleta: 5 }, { ...ZERO, ultima_coleta: {} },
    ]
    for (const ruim of ruins) {
      for (const ctx of [FILA_ZERADA, FILA_PENDENTE, { filaZerada: false, so: 'identidade' as const }]) {
        const r = veredito(ruim as ProvaComentarios | null, ctx)
        expect(r.vermelhos, JSON.stringify(ruim)).toEqual([{ codigo: 'prova_ilegivel', n: 1 }])
        expect(r.numeros).toEqual({})
      }
    }
  })

  it('retratos_atrasados 31 com filaZerada falsa NÃO é vermelho; com filaZerada verdadeira é (o vermelho esperado tem fim)', () => {
    const p = com({ retratos_atrasados: 31, retratos_na_janela: 40 })
    expect(codigos(p, FILA_PENDENTE)).toEqual([])
    expect(veredito(p, FILA_PENDENTE).numeros.retratos_atrasados).toBe(31)
    expect(veredito(p, FILA_ZERADA).vermelhos).toEqual([{ codigo: 'retratos_atrasados', n: 31 }])
    // nos dois sentidos do limiar
    expect(codigos(com({ retratos_atrasados: 0 }), FILA_ZERADA)).toEqual([])
    expect(codigos(com({ retratos_atrasados: 1 }), FILA_ZERADA)).toEqual(['retratos_atrasados'])
  })

  it('perdidos {sem_retrato: 1} é vermelho; {proibido: 2} não é; {proibido: 2, http_400: 1} é, com n = 1', () => {
    expect(veredito(com({ retratos_perdidos_7d: 1, perdidos_por_motivo: { sem_retrato: 1 } }), FILA_PENDENTE).vermelhos)
      .toEqual([{ codigo: 'retratos_perdidos', n: 1 }])
    expect(codigos(com({ retratos_perdidos_7d: 2, perdidos_por_motivo: { proibido: 2 } }), FILA_PENDENTE)).toEqual([])
    const misto = veredito(com({ retratos_perdidos_7d: 3, perdidos_por_motivo: { proibido: 2, http_400: 1 } }), FILA_PENDENTE)
    expect(misto.vermelhos).toEqual([{ codigo: 'retratos_perdidos', n: 1 }])
    expect(misto.numeros.perdidos_fora_do_aceito).toBe(1)
    // vale com a fila pendente e com a zerada (perda não volta)
    expect(codigos(com({ retratos_perdidos_7d: 1, perdidos_por_motivo: { sem_retrato: 1 } }), FILA_ZERADA)).toEqual(['retratos_perdidos'])
  })

  it('perdidos: o total que o mapa não explica conta como fora do aceito (nunca verde por mapa incompleto)', () => {
    const r = veredito(com({ retratos_perdidos_7d: 3, perdidos_por_motivo: { proibido: 2 } }), FILA_ZERADA)
    expect(r.vermelhos).toEqual([{ codigo: 'retratos_perdidos', n: 1 }])
    expect(codigos(com({ retratos_perdidos_7d: 2, perdidos_por_motivo: { proibido: 2 } }))).toEqual([])
    // total 0 e mapa explicando 1: o mapa manda
    expect(codigos(com({ retratos_perdidos_7d: 0, perdidos_por_motivo: { http_400: 1 } }))).toEqual(['retratos_perdidos'])
  })

  it('erros_por_motivo {http_400: 3} é erros_presos; {http_400: 2} não é; {proibido: 3} é; {rede: 5} não é por esta regra', () => {
    expect(codigos(com({ retratos_em_erro: 3, erros_por_motivo: { http_400: 3 } }))).toEqual(['erros_presos'])
    expect(codigos(com({ retratos_em_erro: 2, erros_por_motivo: { http_400: 2 } }))).toEqual([])
    expect(codigos(com({ retratos_em_erro: 3, erros_por_motivo: { proibido: 3 } }))).toEqual(['erros_presos'])
    expect(codigos(com({ retratos_em_erro: 5, erros_por_motivo: { rede: 5 } }))).toEqual([])
    for (const m of MOTIVOS_PASSAGEIROS) {
      expect(codigos(com({ retratos_em_erro: 9, erros_por_motivo: { [m]: 9 } })), m).toEqual([])
    }
    // o limiar é stuckSameReasonRed, nos dois sentidos
    const lim = COMMENT_RULES.stuckSameReasonRed
    expect(codigos(com({ erros_por_motivo: { http_4xx: lim - 1 } }))).toEqual([])
    expect(codigos(com({ erros_por_motivo: { http_4xx: lim } }))).toEqual(['erros_presos'])
  })

  it('erros presos: n é o maior grupo preso e motivo_preso é o índice dele em MOTIVOS (a frase lê os dois)', () => {
    const r = veredito(com({ retratos_em_erro: 9, erros_por_motivo: { http_400: 3, proibido: 5, rede: 9 } }), FILA_ZERADA)
    expect(r.vermelhos).toEqual([{ codigo: 'erros_presos', n: 5 }])
    expect(r.numeros.erros_presos_max).toBe(5)
    expect(r.numeros.motivo_preso).toBe(MOTIVOS.indexOf('proibido'))
    expect(fraseDe('erros_presos', r.numeros)).toBe('5 retratos presos no mesmo motivo (proibido)')
    // motivo que o catálogo não conhece: a frase diz "outro", nunca o texto recebido
    const estranho = veredito(com({ erros_por_motivo: { motivo_novo_xyz: 4 } }), FILA_ZERADA)
    expect(estranho.vermelhos).toEqual([{ codigo: 'erros_presos', n: 4 }])
    expect(fraseDe('erros_presos', estranho.numeros)).toBe('4 retratos presos no mesmo motivo (outro)')
    // sem preso: as duas chaves existem só como informação (max 0) e motivo_preso não existe
    const limpo = veredito(ZERO, FILA_ZERADA)
    expect(limpo.numeros.erros_presos_max).toBe(0)
    expect('motivo_preso' in limpo.numeros).toBe(false)
  })

  it('retratos_total 0 com tudo zero não é vermelho (primeiro dia sem vídeo); so: identidade ignora atrasados, perdidos e presos', () => {
    expect(codigos(com({ retratos_total: 0, retratos_na_janela: 0 }))).toEqual([])
    const ruidoso = com({
      retratos_atrasados: 31, retratos_perdidos_7d: 5, perdidos_por_motivo: { sem_retrato: 5 },
      retratos_em_erro: 4, erros_por_motivo: { http_400: 4 },
    })
    expect(codigos(ruidoso, FILA_ZERADA)).toEqual(['retratos_atrasados', 'retratos_perdidos', 'erros_presos'])
    expect(codigos(ruidoso, { filaZerada: true, so: 'identidade' })).toEqual([])
    // so: identidade ainda pega as quatro primeiras linhas
    expect(codigos(com({ ...ruidoso, identidade_vencida: 1 }), { filaZerada: true, so: 'identidade' })).toEqual(['identidade_vencida'])
    expect(codigos(com({ identidade_de_criador: 1 }), { filaZerada: true, so: 'identidade' })).toEqual(['identidade_invariante'])
    expect(codigos(com({ respostas_de_terceiros: 1 }), { filaZerada: true, so: 'identidade' })).toEqual(['identidade_invariante'])
    expect(codigos(com({ identidade_prazo_errado: 1 }), { filaZerada: true, so: 'identidade' })).toEqual(['identidade_invariante'])
  })

  it('o que é informação nunca fica vermelho (ausentes sem decisão, totais, datas)', () => {
    const p = com({
      comentarios_ausentes_sem_decisao: 40, retratos_total: 900, retratos_ok: 10, comentarios_total: 99999, identidades_total: 5000,
      retratos_na_janela: 300, primeira_coleta: iso(T0), ultima_coleta: iso(T0 + H),
    })
    expect(codigos(p, FILA_ZERADA)).toEqual([])
    const n = veredito(p, FILA_ZERADA).numeros
    expect(n.comentarios_ausentes_sem_decisao).toBe(40)
    expect(n.retratos_total).toBe(900)
    expect(n.retratos_ok).toBe(10)
    expect(n.comentarios_total).toBe(99999)
    expect(n.identidades_total).toBe(5000)
    expect(n.retratos_na_janela).toBe(300)
    expect(n.primeira_coleta_ms).toBe(T0)
    expect(n.ultima_coleta_ms).toBe(T0 + H)
  })

  it('numeros: só número finito; data nula ou ilegível fica de fora; frase da invariante sai deles', () => {
    const r = veredito(com({ primeira_coleta: null, ultima_coleta: 'nao-e-data', identidade_prazo_errado: 1, identidade_de_criador: 2, respostas_de_terceiros: 3 }), FILA_ZERADA)
    for (const v of Object.values(r.numeros)) expect(Number.isFinite(v)).toBe(true)
    expect('primeira_coleta_ms' in r.numeros).toBe(false)
    expect('ultima_coleta_ms' in r.numeros).toBe(false)
    expect(fraseDe('identidade_invariante', r.numeros)).toContain('prazo diferente de 28 dias: 1; identidade de criador: 2; respostas de terceiros: 3')
    // com so: identidade, só as quatro chaves da identidade
    expect(Object.keys(veredito(ZERO, { filaZerada: true, so: 'identidade' }).numeros).sort())
      .toEqual(['identidade_de_criador', 'identidade_prazo_errado', 'identidade_vencida', 'respostas_de_terceiros'])
  })

  it('veredito não muda a prova que recebeu e não guarda estado entre chamadas', () => {
    const p = com({ retratos_em_erro: 3, erros_por_motivo: { http_400: 3 } })
    const copia = JSON.parse(JSON.stringify(p)) as unknown
    veredito(p, FILA_ZERADA)
    expect(p).toEqual(copia)
    expect(veredito(p, FILA_ZERADA)).toEqual(veredito(p, FILA_ZERADA))
  })
})

// ───── cliente falso ─────
type Resp = { data: unknown; error: unknown }
interface Chamada { nome: string; args: Record<string, unknown>; sinal?: AbortSignal }

function criarSb(resolver: (c: Chamada) => Resp | Promise<Resp>): { sb: SupabaseClient; chamadas: Chamada[] } {
  const chamadas: Chamada[] = []
  const sb = {
    rpc: (nome: string, args: Record<string, unknown>) => {
      const c: Chamada = { nome, args }
      const b: Record<string, unknown> = {}
      b.abortSignal = (s: AbortSignal) => { c.sinal = s; return b }
      b.then = (ok: (r: Resp) => unknown, ko: (e: unknown) => unknown) => {
        chamadas.push(c)
        try { return Promise.resolve(resolver(c)).then(ok, ko) } catch (e) { return Promise.reject(e).then(ok, ko) }
      }
      return b
    },
  }
  return { sb: sb as unknown as SupabaseClient, chamadas }
}
const ok = (data: unknown): Resp => ({ data, error: null })
const falha = (code: string, message = 'mensagem do banco'): Resp => ({ data: null, error: { message, details: 'detalhe', hint: null, code } })
const APAGOU = (apagadas: number, extra: Partial<Record<string, number>> = {}): Record<string, number> => ({
  apagadas, comentarios_carimbados: apagadas, vencidas_ha_mais_de_1_dia: 0, restantes: 0, ...extra,
})
const PURGE = 'competitor_comment_identity_purge'
const HEALTH = 'competitor_comment_health'

/** Um banco que apaga (PURGE) e depois responde a prova (HEALTH) com o que o teste mandar. */
function bancoCom(purge: Resp | (() => Resp), prova: Resp | (() => Resp)) {
  return criarSb((c) => {
    const r = c.nome === PURGE ? purge : prova
    return typeof r === 'function' ? r() : r
  })
}

beforeEach(() => captureMessage.mockClear())
afterEach(() => { vi.useRealTimers(); delete process.env.OBS_AGENDA; delete process.env.OBS_AGENDA_TASKS_OFF })

const rodar = (sb: SupabaseClient, siteId?: string) => runAnularIdentidade({ sb, now: agora, siteId })
const sentryTudo = (): string => JSON.stringify(captureMessage.mock.calls)

// ───── anular ─────
describe('anular (runAnularIdentidade)', () => {
  it('apaga N e devolve os oito números', async () => {
    const { sb, chamadas } = bancoCom(ok({ apagadas: 5, comentarios_carimbados: 4, vencidas_ha_mais_de_1_dia: 0, restantes: 12 }), ok(com({ identidades_total: 12 })))
    const s = await rodar(sb)
    expect(s.status).toBe('ok')
    expect(s.feitos).toBe(5)
    expect(s.ficaram).toBe(0)
    expect(s.motivo).toBeUndefined()
    expect(s.numeros).toEqual({
      apagadas: 5, comentarios_carimbados: 4, vencidas_ha_mais_de_1_dia: 0, restantes: 12,
      identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0,
    })
    // duas idas, nesta ordem: apaga, depois lê a prova
    expect(chamadas.map((c) => c.nome)).toEqual([PURGE, HEALTH])
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('tabela vazia é ok com apagadas 0, e a prova confirma zero vencidos', async () => {
    const { sb, chamadas } = bancoCom(ok(APAGOU(0)), ok(ZERO))
    const s = await rodar(sb)
    expect(s).toEqual({
      status: 'ok', feitos: 0, ficaram: 0,
      numeros: { apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 0, identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0 },
    })
    // a prova de depois recebe o relógio do contexto, o site e janela de identidade; o corte de início não entra (identidade não depende dele)
    const prova = chamadas[1]
    expect(prova?.args.p_now).toBe(iso(NOW_MS))
    expect(prova?.args.p_since).toBeNull()
    expect(prova?.args.p_identity_days).toBe(COMMENT_RULES.identityDays)
    expect(prova?.args.p_site_id).toBeNull()
    expect(chamadas[0]?.args).toEqual({ p_site_id: null })
  })

  it('o site do contexto vai à anulação e à prova (só os testes passam)', async () => {
    const { sb, chamadas } = bancoCom(ok(APAGOU(0)), ok(ZERO))
    await rodar(sb, 'site-de-teste')
    expect(chamadas[0]?.args).toEqual({ p_site_id: 'site-de-teste' })
    expect(chamadas[1]?.args.p_site_id).toBe('site-de-teste')
  })

  it('função ausente é erro schema_ausente (nunca "anulei zero"), nos quatro códigos', async () => {
    for (const code of ['PGRST202', '42883', '42P01', 'PGRST205']) {
      const { sb, chamadas } = bancoCom(falha(code), ok(ZERO))
      const s = await rodar(sb)
      expect(s.status, code).toBe('erro')
      expect(s.motivo, code).toBe('schema_ausente')
      expect(s.feitos).toBe(0)
      expect(s.numeros).toEqual({})
      // sem apagar, não há o que provar: uma ida só
      expect(chamadas.map((c) => c.nome)).toEqual([PURGE])
    }
  })

  it('erro do banco é erro banco, não vaza a mensagem e vai ao Sentry só como código', async () => {
    const msg = `violação em ${SENT_NOME} / ${SENT_TEXTO_TOPO}`
    const { sb } = bancoCom({ data: null, error: { message: msg, details: SENT_NOME, hint: SENT_TEXTO_TOPO, code: '23514' } }, ok(ZERO))
    const s = await rodar(sb)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('banco')
    expect(JSON.stringify(s)).not.toContain('SENTINELA')
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]?.[0]).toBe('comentarios: anular: banco:23514')
    expect(sentryTudo()).not.toContain('SENTINELA')
  })

  it('rpc abortado pelo prazo (AbortError) é erro banco com o código banco:tempo_esgotado no Sentry', async () => {
    const { sb } = bancoCom({ data: null, error: { message: 'AbortError: This operation was aborted', details: 'pilha', hint: 'Request was aborted', code: '' } }, ok(ZERO))
    const s = await rodar(sb)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('banco')
    expect(captureMessage.mock.calls[0]?.[0]).toBe('comentarios: anular: banco:tempo_esgotado')
  })

  it('ida que não responde: a anulação volta em até dbTimeoutMs (relógio falso) com erro banco', async () => {
    vi.useFakeTimers()
    const { sb } = criarSb(() => new Promise<Resp>(() => { /* nunca responde */ }))
    const p = rodar(sb)
    await vi.advanceTimersByTimeAsync(COMMENT_RULES.dbTimeoutMs - 1)
    let acabou = false
    void p.then(() => { acabou = true })
    await Promise.resolve()
    expect(acabou).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    const s = await p
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('banco')
    expect(captureMessage.mock.calls[0]?.[0]).toBe('comentarios: anular: banco:tempo_esgotado')
  })

  it('exceção do cliente e resposta fora da forma também são erro banco, sem texto', async () => {
    const lanca = criarSb(() => { throw new Error(`falha com ${SENT_NOME}`) })
    const s1 = await rodar(lanca.sb)
    expect(s1.status).toBe('erro')
    expect(s1.motivo).toBe('banco')
    for (const data of [null, [], 'x', { apagadas: '3', comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 0 },
      { apagadas: 1, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0 }, { apagadas: -1, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 0 }]) {
      const { sb, chamadas } = bancoCom(ok(data), ok(ZERO))
      const s = await rodar(sb)
      expect(s.status, JSON.stringify(data)).toBe('erro')
      expect(s.motivo).toBe('banco')
      expect(chamadas.map((c) => c.nome)).toEqual([PURGE])
    }
    expect(sentryTudo()).not.toContain('SENTINELA')
  })

  it('vencidas_ha_mais_de_1_dia 3 relata ao Sentry com o número e segue ok', async () => {
    const { sb } = bancoCom(ok(APAGOU(7, { vencidas_ha_mais_de_1_dia: 3 })), ok(ZERO))
    const s = await rodar(sb)
    expect(s.status).toBe('ok')
    expect(s.numeros.vencidas_ha_mais_de_1_dia).toBe(3)
    expect(s.feitos).toBe(7)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [msg, opts] = captureMessage.mock.calls[0] as [string, { extra: Record<string, number> }]
    expect(msg).toMatch(/^comentarios: anular: [a-z0-9_:]+$/)
    expect(opts.extra.vencidas_ha_mais_de_1_dia).toBe(3)
    // 0 não relata
    captureMessage.mockClear()
    await rodar(bancoCom(ok(APAGOU(7)), ok(ZERO)).sb)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('prova depois com identidade_vencida 1: erro identidade_vencida, com a frase dos números da própria execução', async () => {
    const { sb } = bancoCom(ok(APAGOU(2)), ok(com({ identidade_vencida: 1 })))
    const s = await rodar(sb)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('identidade_vencida')
    expect(s.numeros.identidade_vencida).toBe(1)
    expect(s.numeros.apagadas).toBe(2)
    expect(fraseDe('identidade_vencida', s.numeros)).toContain('1')
    expect(fraseDe('identidade_vencida', s.numeros)).toBe('identidade de autores vencida e não apagada: 1. A coleta parou até a rotina de anulação rodar')
    expect(captureMessage.mock.calls[0]?.[0]).toBe('comentarios: anular: identidade_vencida')
    expect('na_guarda' in s.numeros).toBe(false)
  })

  it('prova depois com prazo errado, identidade de criador ou resposta de terceiro: erro identidade_invariante', async () => {
    for (const parcial of [{ identidade_prazo_errado: 1 }, { identidade_de_criador: 1 }, { respostas_de_terceiros: 1 }]) {
      const { sb } = bancoCom(ok(APAGOU(0)), ok(com(parcial)))
      const s = await rodar(sb)
      expect(s.status, JSON.stringify(parcial)).toBe('erro')
      expect(s.motivo).toBe('identidade_invariante')
      expect(fraseDe('identidade_invariante', s.numeros)).toMatch(/^a guarda da identidade está quebrada \(prazo diferente de 28 dias: \d+; identidade de criador: \d+; respostas de terceiros: \d+\)$/)
    }
  })

  it('identidade vencida e invariante ao mesmo tempo: o primeiro código é o de identidade_vencida', async () => {
    const s = await rodar(bancoCom(ok(APAGOU(0)), ok(com({ identidade_vencida: 2, identidade_de_criador: 1 }))).sb)
    expect(s.motivo).toBe('identidade_vencida')
  })

  it('prova depois ilegível: erro prova_ilegivel (apagou, mas não sabe se sobrou), sem na_guarda', async () => {
    const ilegiveis: Resp[] = [
      ok(null), ok([]), ok({ ...ZERO, retratos_atrasados: undefined }), ok('texto'), falha('57014'), falha('08006', 'fetch failed'),
      { data: null, error: { message: 'AbortError: tempo', code: '' } },
    ]
    for (const prova of ilegiveis) {
      captureMessage.mockClear()
      const { sb, chamadas } = bancoCom(ok(APAGOU(4)), prova)
      const s = await rodar(sb)
      expect(s.status, JSON.stringify(prova)).toBe('erro')
      expect(s.motivo).toBe('prova_ilegivel')
      expect('na_guarda' in s.numeros).toBe(false)
      expect(s.numeros.apagadas).toBe(4)
      expect(s.feitos).toBe(4)
      expect(fraseDe('prova_ilegivel', s.numeros)).toBe('não foi possível ler a prova (banco)')
      expect(captureMessage.mock.calls[0]?.[0]).toBe('comentarios: anular: prova_ilegivel')
      expect(chamadas.map((c) => c.nome)).toEqual([PURGE, HEALTH])
    }
  })

  it('prova depois com a função ausente: erro schema_ausente (nunca verde)', async () => {
    const s = await rodar(bancoCom(ok(APAGOU(1)), falha('PGRST202')).sb)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('schema_ausente')
  })

  it('a prova de depois que não responde: volta em até dbTimeoutMs com prova_ilegivel', async () => {
    vi.useFakeTimers()
    const { sb } = criarSb((c) => (c.nome === PURGE ? ok(APAGOU(2)) : new Promise<Resp>(() => { /* nunca */ })))
    const p = rodar(sb)
    await vi.advanceTimersByTimeAsync(COMMENT_RULES.dbTimeoutMs + 1)
    const s = await p
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('prova_ilegivel')
  })

  it('a prova de depois só vermelha por coisa que NÃO é da identidade não derruba a anulação (atrasados, perdidos, presos)', async () => {
    const ruidosa = com({ retratos_atrasados: 31, retratos_perdidos_7d: 2, perdidos_por_motivo: { sem_retrato: 2 }, retratos_em_erro: 3, erros_por_motivo: { http_400: 3 } })
    const s = await rodar(bancoCom(ok(APAGOU(1)), ok(ruidosa)).sb)
    expect(s.status).toBe('ok')
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('é idempotente: rodar duas vezes no mesmo período não erra nem conta em dobro', async () => {
    let apagou = false
    const { sb } = bancoCom(() => {
      const r = apagou ? ok(APAGOU(0, { restantes: 9 })) : ok(APAGOU(6, { restantes: 9 }))
      apagou = true
      return r
    }, ok(com({ identidades_total: 9 })))
    const a = await rodar(sb)
    const b = await rodar(sb)
    expect(a.status).toBe('ok')
    expect(b.status).toBe('ok')
    expect(a.feitos).toBe(6)
    expect(b.feitos).toBe(0)
    expect(a.numeros.apagadas + b.numeros.apagadas).toBe(6)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('duas execuções ao mesmo tempo: é uma instrução só no banco, a segunda apaga 0; a soma é a de uma', async () => {
    let restam = 5
    const { sb, chamadas } = criarSb(async (c) => {
      await Promise.resolve()
      if (c.nome === PURGE) {
        const n = restam
        restam = 0
        return ok(APAGOU(n))
      }
      return ok(ZERO)
    })
    const [a, b] = await Promise.all([rodar(sb), rodar(sb)])
    expect([a.status, b.status]).toEqual(['ok', 'ok'])
    expect(a.feitos + b.feitos).toBe(5)
    expect(chamadas.filter((c) => c.nome === PURGE)).toHaveLength(2)
  })

  it('nuncaDesliga: roda com a agenda desligada (OBS_AGENDA=off e a tarefa na lista de desligadas)', async () => {
    process.env.OBS_AGENDA = 'off'
    process.env.OBS_AGENDA_TASKS_OFF = 'anular_identidade,retratos_comentarios'
    const { sb, chamadas } = bancoCom(ok(APAGOU(3)), ok(ZERO))
    const s = await rodar(sb)
    expect(s.status).toBe('ok')
    expect(s.feitos).toBe(3)
    expect(chamadas).toHaveLength(2)
    // e o módulo nem lê os interruptores
    for (const arq of ['anular.ts', 'prova.ts']) {
      const fonte = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/comentarios', arq), 'utf8')
      expect(fonte, arq).not.toMatch(/OBS_AGENDA/)
      expect(fonte, arq).not.toMatch(/process\.env/)
    }
  })

  it('nenhum número ou erro devolvido leva nome, id de autor ou texto de comentário', async () => {
    const casos: Array<ReturnType<typeof bancoCom>> = [
      bancoCom(ok(APAGOU(1)), ok(ZERO)),
      bancoCom({ data: null, error: { message: SENT_NOME, details: SENT_TEXTO_TOPO, hint: SENT_NOME, code: 'XX000' } }, ok(ZERO)),
      bancoCom(ok(APAGOU(1)), { data: null, error: { message: SENT_NOME, details: SENT_TEXTO_TOPO, hint: null, code: 'XX000' } }),
      bancoCom(ok(APAGOU(1)), ok(com({ identidade_vencida: 2 }))),
    ]
    for (const c of casos) {
      const s = await rodar(c.sb)
      expect(JSON.stringify(s)).not.toContain('SENTINELA')
      for (const v of Object.values(s.numeros)) expect(typeof v).toBe('number')
    }
    expect(sentryTudo()).not.toContain('SENTINELA')
  })
})
