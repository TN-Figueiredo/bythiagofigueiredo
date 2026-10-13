// @vitest-environment node
// A5 · E14, Tarefa 2: regras, tipos, erro, ordem e frases dos comentários de destaque.
import { describe, expect, it } from 'vitest'
import {
  COMMENT_RULES, COMMENT_SINCE, WORST_SNAP_MS, WORST_END_FROM_T0_MS, MOTIVOS, MOTIVOS_PASSAGEIROS,
  MOTIVOS_PERDA_ACEITA, CODIGOS_EXECUCAO, SIZE_BANDS, RATIO_BANDS, ruleParams,
} from '@/lib/youtube/observatorio/comentarios/regras'
import { ComentariosErro, codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import { ordenar } from '@/lib/youtube/observatorio/comentarios/ordem'
import { fraseDe, FRASES_FIXAS, motivos } from '@/lib/youtube/observatorio/comentarios/frases'
import type { Conversa } from '@/lib/youtube/observatorio/comentarios/tipos'
import {
  COMPETITORS_MAX_DURATION_S, PROOF_TIMEOUT_MS, RECORD_RESERVE_MS,
} from '@/lib/youtube/competitor-sync-batch'

const SENTINELA = 'SENTINELA-NOME-DE-AUTOR-123'

describe('regras dos comentários', () => {
  it('as janelas dos marcos não se sobrepõem e estão em ordem', () => {
    const m = COMMENT_RULES.marks
    expect(m.map((x) => x.mark)).toEqual([1, 7, 30])
    for (let i = 0; i < m.length; i++) {
      expect(m[i].fromH).toBeLessThan(m[i].untilH)
      if (i > 0) expect(m[i].fromH).toBeGreaterThanOrEqual(m[i - 1].untilH)
    }
  })

  it('todo motivo passageiro e todo motivo de perda aceita está na lista de motivos', () => {
    const todos: readonly string[] = MOTIVOS
    for (const x of MOTIVOS_PASSAGEIROS) expect(todos).toContain(x)
    for (const x of MOTIVOS_PERDA_ACEITA) expect(todos).toContain(x)
  })

  it('todo motivo e todo código de execução casa com ^[a-z0-9_]{1,40}$', () => {
    for (const x of [...MOTIVOS, ...CODIGOS_EXECUCAO]) expect(x).toMatch(/^[a-z0-9_]{1,40}$/)
  })

  it('identityDays é 28', () => {
    expect(COMMENT_RULES.identityDays).toBe(28)
  })

  it('os limites cabem na função', () => {
    const r = COMMENT_RULES
    expect(WORST_SNAP_MS).toBe(r.callsPerSnapMax * r.callTimeoutMs + r.dbPerSnapMax * r.dbTimeoutMs)
    expect(WORST_SNAP_MS).toBe(40_000)
    expect(r.startsByMs + r.startBudgetMs).toBeLessThanOrEqual(r.lastSnapStartsByMs)
    expect(WORST_END_FROM_T0_MS).toBe(r.lastSnapStartsByMs + WORST_SNAP_MS + r.dbAfterLoopMax * r.dbTimeoutMs)
    expect(WORST_END_FROM_T0_MS).toBe(225_000)
    expect(WORST_END_FROM_T0_MS).toBeLessThanOrEqual(COMPETITORS_MAX_DURATION_S * 1000 - PROOF_TIMEOUT_MS - RECORD_RESERVE_MS)
    expect(r.callsPerSnapMax).toBe(2 + r.checkBlocksMax)
  })

  it("COMMENT_SINCE é 'a_decidir', null ou um instante ISO que Date aceita", () => {
    const v: string | null = COMMENT_SINCE
    if (v !== null && v !== 'a_decidir') expect(Number.isNaN(Date.parse(v))).toBe(false)
    else expect(v === null || v === 'a_decidir').toBe(true)
  })

  it('ruleParams devolve tetos, lote, destaque e faixas, sem texto livre', () => {
    const p = ruleParams()
    expect(p).toMatchObject({ target: 12, creator_max: 4, featured_max: 2, pool: 100, featured_lookup: 20, featured_min_subs: 100_000, featured_min_ratio: 10 })
    expect(p.size_bands).toEqual(SIZE_BANDS.map(([k, v]) => [k, v]))
    expect(p.ratio_bands).toEqual(RATIO_BANDS.map(([k, v]) => [k, v]))
    expect(JSON.stringify(p)).not.toContain('countFreshHours')
  })
})

function conv(id: string, curtidas: number, respostasTotal: number, posicao: number): Conversa {
  return {
    id, posicao, texto: 't', cortado: false, publicadoEm: '2026-01-01T00:00:00Z', editadoEm: null, curtidas, respostasTotal,
    autor: { nome: null, canalId: null, foto: null }, doCriador: false, criadorRespondeu: null, respostasDoCriador: [], canaisNasRespostas: [],
  }
}

describe('ordenar', () => {
  it('empate em curtidas decide respostasTotal, depois posição, depois id', () => {
    const lista = [
      conv('b', 5, 1, 3), conv('a', 5, 1, 3), conv('c', 5, 1, 2), conv('d', 5, 9, 8), conv('e', 50, 0, 99), conv('f', 1, 0, 1),
    ]
    expect(ordenar(lista).map((c) => c.id)).toEqual(['e', 'd', 'c', 'a', 'b', 'f'])
  })

  it('a mesma lista embaralhada dá a mesma ordem, e a entrada não é alterada', () => {
    const base = [conv('x', 3, 1, 1), conv('y', 3, 1, 1), conv('z', 3, 2, 1), conv('w', 9, 0, 5), conv('v', 3, 1, 0)]
    const copia = base.map((c) => c.id)
    const esperado = ordenar(base).map((c) => c.id)
    expect(base.map((c) => c.id)).toEqual(copia)
    const emb1 = [base[3], base[0], base[4], base[2], base[1]]
    const emb2 = [base[1], base[2], base[0], base[4], base[3]]
    expect(ordenar(emb1).map((c) => c.id)).toEqual(esperado)
    expect(ordenar(emb2).map((c) => c.id)).toEqual(esperado)
  })
})

/** Chaves de `n` por código, como na tabela do plano (quarta coluna). */
const CHAVES: Record<string, string[]> = {
  identidade_vencida: ['identidade_vencida'],
  identidade_invariante: ['identidade_prazo_errado', 'identidade_de_criador', 'respostas_de_terceiros'],
  cota_esgotada: ['ficaram'],
  cota_nao_registrada: ['unidades_nao_registradas'],
  inesperado: ['inesperados'],
  falhas_passageiras: ['falhas_passageiras', 'motivo_mais_comum'],
  disjuntor: ['motivo_mais_comum', 'ficaram'],
  consulta_de_autores_falhou: ['consultas_de_autor_falhas'],
  conferencia_falhou: ['conferencias_falhas'],
  retratos_atrasados: ['retratos_atrasados'],
  retratos_perdidos: ['perdidos_fora_do_aceito'],
  erros_presos: ['erros_presos_max', 'motivo_preso'],
  banco: ['erros_de_gravacao'],
}

function cheio(codigo: string, valor = 999_999): Record<string, number> {
  const n: Record<string, number> = {}
  for (const k of CHAVES[codigo] ?? []) n[k] = valor
  return n
}

describe('frases', () => {
  it('todo código de CODIGOS_EXECUCAO tem frase própria (nenhum cai na de desconhecido)', () => {
    const desconhecida = fraseDe('nao_existe', {})
    expect(desconhecida).toBe('falha de código desconhecido (ver Sentry)')
    for (const c of CODIGOS_EXECUCAO) {
      const f = fraseDe(c, cheio(c, 3))
      expect(f).not.toBe('')
      expect(f).not.toBe(desconhecida)
    }
    expect(new Set(CODIGOS_EXECUCAO.map((c) => FRASES_FIXAS[c])).size).toBe(CODIGOS_EXECUCAO.length)
  })

  it('código fora da lista, inclusive um texto com a sentinela, devolve a frase de desconhecido sem a sentinela', () => {
    for (const c of [SENTINELA, '', '__proto__', 'constructor', 'toString']) {
      const f = fraseDe(c, { ficaram: 5 })
      expect(f).toBe('falha de código desconhecido (ver Sentry)')
      expect(f).not.toContain(SENTINELA)
    }
  })

  it('FRASES_FIXAS tem exatamente as chaves de CODIGOS_EXECUCAO; nenhuma frase quebra as regras de forma', () => {
    expect(Object.keys(FRASES_FIXAS).sort()).toEqual([...CODIGOS_EXECUCAO].sort())
    expect(Object.keys(motivos).sort()).toEqual([...CODIGOS_EXECUCAO].sort())
    const todas = [
      ...CODIGOS_EXECUCAO.map((c) => FRASES_FIXAS[c]),
      ...CODIGOS_EXECUCAO.map((c) => fraseDe(c, cheio(c))),
      fraseDe('nao_existe', {}),
    ]
    for (const f of todas) {
      expect(f.length).toBeGreaterThan(0)
      expect(f.startsWith('comentários:')).toBe(false)
      expect(f.endsWith('.')).toBe(false)
      expect(f).not.toMatch(/[${}%]/)
      expect(f.length).toBeLessThanOrEqual(160)
      expect(f).not.toMatch(/undefined|NaN/)
    }
  })

  it('para cada código com número: sem a chave, ou com NaN, Infinity ou não número, devolve vazio; com as chaves, a frase traz cada número', () => {
    for (const [codigo, chaves] of Object.entries(CHAVES)) {
      expect(fraseDe(codigo, {})).toBe('')
      for (const k of chaves) {
        const ok = cheio(codigo, 7)
        expect(fraseDe(codigo, { ...ok, [k]: Number.NaN })).toBe('')
        expect(fraseDe(codigo, { ...ok, [k]: Number.POSITIVE_INFINITY })).toBe('')
        const sem = { ...ok }
        delete sem[k]
        expect(fraseDe(codigo, sem)).toBe('')
        expect(fraseDe(codigo, { ...ok, [k]: undefined as unknown as number })).toBe('')
        expect(fraseDe(codigo, { ...ok, [k]: '7' as unknown as number })).toBe('')
      }
    }
    // cada número distinto aparece na frase, na chave certa
    expect(fraseDe('identidade_invariante', { identidade_prazo_errado: 11, identidade_de_criador: 22, respostas_de_terceiros: 33 }))
      .toBe('a guarda da identidade está quebrada (prazo diferente de 28 dias: 11; identidade de criador: 22; respostas de terceiros: 33)')
    expect(fraseDe('identidade_vencida', { identidade_vencida: 4 }))
      .toBe('identidade de autores vencida e não apagada: 4. A coleta parou até a rotina de anulação rodar')
    expect(fraseDe('cota_esgotada', { ficaram: 17 })).toBe('a cota do YouTube acabou; 17 retratos ficaram para o próximo disparo')
    expect(fraseDe('banco', { erros_de_gravacao: 2 })).toBe('o banco não respondeu a tempo ou recusou (2 vezes)')
  })

  it('zero é número válido: N = 0 e motivo_mais_comum = 0 escrevem a frase', () => {
    expect(fraseDe('cota_esgotada', { ficaram: 0 })).toBe('a cota do YouTube acabou; 0 retratos ficaram para o próximo disparo')
    expect(fraseDe('retratos_atrasados', { retratos_atrasados: 0 })).toContain('0 vídeos')
    const f = fraseDe('falhas_passageiras', { falhas_passageiras: 0, motivo_mais_comum: 0 })
    expect(f).toBe(`0 leituras falharam (motivo mais comum: ${MOTIVOS[0]}); nova tentativa no próximo disparo`)
    const d = fraseDe('disjuntor', { motivo_mais_comum: 0, ficaram: 0 })
    expect(d).toBe(`três falhas seguidas (${MOTIVOS[0]}); a execução parou e 0 retratos ficaram`)
  })

  it('motivo_mais_comum é índice em MOTIVOS; fora da faixa ou não inteiro vira "outro"', () => {
    const i = MOTIVOS.indexOf('http_5xx')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(fraseDe('falhas_passageiras', { falhas_passageiras: 3, motivo_mais_comum: i })).toContain('(motivo mais comum: http_5xx)')
    for (const x of [-1, 99, MOTIVOS.length, 1.5, 999_999]) {
      const f = fraseDe('falhas_passageiras', { falhas_passageiras: 3, motivo_mais_comum: x })
      expect(f).toContain('(motivo mais comum: outro)')
    }
    expect(fraseDe('disjuntor', { motivo_mais_comum: -1, ficaram: 2 })).toContain('(outro)')
    expect(fraseDe('erros_presos', { erros_presos_max: 3, motivo_preso: i })).toBe('3 retratos presos no mesmo motivo (http_5xx)')
    expect(fraseDe('erros_presos', { erros_presos_max: 3, motivo_preso: 99 })).toBe('3 retratos presos no mesmo motivo (outro)')
  })

  it('a frase de prova_ilegivel não contém "coletado"', () => {
    expect(fraseDe('prova_ilegivel', {})).not.toContain('coletado')
    expect(FRASES_FIXAS.prova_ilegivel).not.toContain('coletado')
    expect(fraseDe('prova_ilegivel', {})).toBe('não foi possível ler a prova (banco)')
  })
})

describe('codigoDe', () => {
  it('erro do banco com message e details contendo a sentinela devolve só banco:23514', () => {
    const r = codigoDe({ message: SENTINELA, details: SENTINELA, hint: SENTINELA, code: '23514' })
    expect(r).toBe('banco:23514')
    expect(r).not.toContain(SENTINELA)
  })

  it('22P05 devolve banco:22p05 e passa no filtro de relato', () => {
    const r = codigoDe({ message: 'x', details: null, hint: null, code: '22P05' })
    expect(r).toBe('banco:22p05')
    expect(r).toMatch(/^[a-z0-9_:]+$/)
  })

  it('PGRST202 devolve banco:pgrst202', () => {
    expect(codigoDe({ message: SENTINELA, details: null, hint: null, code: 'PGRST202' })).toBe('banco:pgrst202')
  })

  it('erro do banco sem code, ou com code numérico, ou fora das formas, devolve banco:sem_codigo', () => {
    expect(codigoDe({ message: SENTINELA, details: SENTINELA, hint: null })).toBe('banco:sem_codigo')
    expect(codigoDe({ message: SENTINELA, details: null, hint: null, code: 42 })).toBe('banco:sem_codigo')
    expect(codigoDe({ message: SENTINELA, details: null, hint: null, code: 'XYZ' })).toBe('banco:sem_codigo')
    expect(codigoDe({ message: SENTINELA, code: '' })).toBe('banco:sem_codigo')
  })

  it('ComentariosErro devolve o código; TypeError devolve inesperado:typeerror; valor que não é objeto devolve inesperado:desconhecido', () => {
    expect(codigoDe(new ComentariosErro('limite_de_taxa', 429))).toBe('limite_de_taxa')
    expect(codigoDe(new ComentariosErro('proibido', 403))).toBe('proibido')
    expect(codigoDe(new TypeError(SENTINELA))).toBe('inesperado:typeerror')
    for (const v of [SENTINELA, null, undefined, 42, true]) expect(codigoDe(v)).toBe('inesperado:desconhecido')
    expect(codigoDe({ foo: SENTINELA })).toBe('inesperado:desconhecido')
    const e = new Error('x')
    e.name = 'Nome com espaço e 123'
    expect(codigoDe(e)).toBe('inesperado:desconhecido')
  })

  it('a forma real do cliente abortado devolve banco:tempo_esgotado e não banco:sem_codigo', () => {
    const r = codigoDe({
      message: 'AbortError: This operation was aborted', details: `pilha com ${SENTINELA}`,
      hint: 'Request was aborted (timeout or manual cancellation)', code: '',
    })
    expect(r).toBe('banco:tempo_esgotado')
    expect(codigoDe({ message: 'TimeoutError: The operation timed out', code: '' })).toBe('banco:tempo_esgotado')
  })

  it('DOMException AbortError e TimeoutError (code 20 e 23) e Error com name AbortError devolvem banco:tempo_esgotado', () => {
    const a = new DOMException('x', 'AbortError')
    const t = new DOMException('y', 'TimeoutError')
    expect(a.code).toBe(20)
    expect(t.code).toBe(23)
    expect(codigoDe(a)).toBe('banco:tempo_esgotado')
    expect(codigoDe(t)).toBe('banco:tempo_esgotado')
    const e = new Error(SENTINELA)
    e.name = 'AbortError'
    expect(codigoDe(e)).toBe('banco:tempo_esgotado')
  })

  it("Error lançado com code 'EPIPE' devolve inesperado:error, não banco:epipe nem banco:sem_codigo", () => {
    const e = Object.assign(new Error(SENTINELA), { code: 'EPIPE' })
    expect(codigoDe(e)).toBe('inesperado:error')
    expect(codigoDe(Object.assign(new Error('x'), { code: 'EBUSY' }))).toBe('inesperado:error')
  })
})

describe('ComentariosErro', () => {
  it('a mensagem é sempre "comentarios: " + código, sem cause', () => {
    const e = new ComentariosErro('cota_esgotada', null)
    expect(e.message).toBe('comentarios: cota_esgotada')
    expect(e.codigo).toBe('cota_esgotada')
    expect(e.http).toBeNull()
    expect(e).toBeInstanceOf(Error)
    expect('cause' in e).toBe(false)
    expect(new ComentariosErro('http_5xx', 503).http).toBe(503)
  })
})
