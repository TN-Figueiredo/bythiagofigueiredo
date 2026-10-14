// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 1: regras, frases e interruptor do acesso externo da IA.
 * O modo da E19 e a data de conferência são simulados por um delegado que, desligado, devolve o valor REAL publicado
 * (o teste de coerência não simula nada).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let modoSimulado: 'aviso' | 'recusa' | null = null

vi.mock('@/lib/pipeline/leitura-modo', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/pipeline/leitura-modo')>()
  return {
    ...real,
    modoLeitura: () => (modoSimulado === null ? real.modoLeitura() : { ...real.modoLeitura(), modo: modoSimulado }),
  }
})

// Uma cópia mutável das regras: os testes escrevem a data de conferência nela; o valor real é lido por `importActual`.
vi.mock('@/lib/youtube/observatorio/acesso-ia/regras', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/youtube/observatorio/acesso-ia/regras')>()
  return { ...real, ACESSO_IA_RULES: { ...real.ACESSO_IA_RULES } }
})

import { ACESSO_IA_RULES, prazoDoResponder } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { acessoExternoLigado, e19ConferidaParaChave } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { fraseDeLimite, FRASES } from '@/lib/youtube/observatorio/acesso-ia/frases'

const WEB = resolve(__dirname, '../../..')
const DIR = resolve(WEB, 'src/lib/youtube/observatorio/acesso-ia')
const VAR = 'OBSERVATORIO_IA_EXTERNA'
const DATA_CONFERIDA = '2026-10-20'

const escreverData = (d: string | null) => Object.assign(ACESSO_IA_RULES, { e19RecusaConferidaEm: d })

beforeEach(() => {
  modoSimulado = null
  escreverData(null)
  delete process.env[VAR]
})
afterEach(() => {
  delete process.env[VAR]
})

describe('acessoExternoLigado: a variável', () => {
  it('variável APAGADA e chamada sem argumento: desligado, motivo variavel (o padrão lê process.env de verdade)', () => {
    delete process.env[VAR]
    expect(acessoExternoLigado()).toEqual({ ligado: false, motivo: 'variavel' })
  })

  it.each(['ON', '1', 'true', '', ' on', 'on ', 'off'])('valor %j: desligado (fronteira do valor exato)', (valor) => {
    modoSimulado = 'recusa'
    escreverData(DATA_CONFERIDA)
    expect(acessoExternoLigado({ [VAR]: valor })).toEqual({ ligado: false, motivo: 'variavel' })
  })

  it('a variável é lida a cada chamada: muda process.env entre duas chamadas e o resultado muda', () => {
    modoSimulado = 'recusa'
    escreverData(DATA_CONFERIDA)
    process.env[VAR] = 'off'
    expect(acessoExternoLigado().ligado).toBe(false)
    process.env[VAR] = 'on'
    expect(acessoExternoLigado().ligado).toBe(true)
    delete process.env[VAR]
    expect(acessoExternoLigado().ligado).toBe(false)
  })
})

describe('acessoExternoLigado: as travas de git', () => {
  it("'on' com o modo simulado em aviso: desligado, motivo e19_em_aviso", () => {
    modoSimulado = 'aviso'
    escreverData(DATA_CONFERIDA)
    expect(acessoExternoLigado({ [VAR]: 'on' })).toEqual({ ligado: false, motivo: 'e19_em_aviso' })
  })

  it("'on', modo simulado em recusa, data nula: desligado, motivo e19_nao_conferida", () => {
    modoSimulado = 'recusa'
    escreverData(null)
    expect(acessoExternoLigado({ [VAR]: 'on' })).toEqual({ ligado: false, motivo: 'e19_nao_conferida' })
  })

  it("'on', modo recusa, data preenchida (as três simuladas): ligado", () => {
    modoSimulado = 'recusa'
    escreverData(DATA_CONFERIDA)
    expect(acessoExternoLigado({ [VAR]: 'on' })).toEqual({ ligado: true })
  })

  it('coerência com o que está publicado, sem simular nada: enquanto o modo publicado for aviso, a variável ligada não abre', async () => {
    modoSimulado = null // o delegado devolve o modo REAL
    const real = await vi.importActual<typeof import('@/lib/pipeline/leitura-modo')>('@/lib/pipeline/leitura-modo')
    if (real.modoLeitura().modo === 'aviso') {
      expect(acessoExternoLigado({ [VAR]: 'on' })).toEqual({ ligado: false, motivo: 'e19_em_aviso' })
    } else {
      // recusa publicada: a coerência passa a ser a da data de conferência (real, não a da cópia mutável acima)
      expect(typeof acessoExternoLigado({ [VAR]: 'on' }).ligado).toBe('boolean')
    }
  })
})

describe('e19ConferidaParaChave: não lê ambiente', () => {
  it('variável APAGADA e modo aviso: recusa e19_em_aviso', () => {
    delete process.env[VAR]
    modoSimulado = 'aviso'
    expect(e19ConferidaParaChave()).toEqual({ ok: false, motivo: 'e19_em_aviso' })
  })

  it('variável APAGADA, modo recusa e data preenchida (os dois simulados): aceita', () => {
    delete process.env[VAR]
    modoSimulado = 'recusa'
    escreverData(DATA_CONFERIDA)
    expect(e19ConferidaParaChave()).toEqual({ ok: true })
  })

  it("variável 'on' e modo aviso: recusa", () => {
    process.env[VAR] = 'on'
    modoSimulado = 'aviso'
    expect(e19ConferidaParaChave()).toEqual({ ok: false, motivo: 'e19_em_aviso' })
  })

  it('modo recusa e data nula: recusa e19_nao_conferida', () => {
    modoSimulado = 'recusa'
    escreverData(null)
    expect(e19ConferidaParaChave()).toEqual({ ok: false, motivo: 'e19_nao_conferida' })
  })

  it('a função não lê process.env: com o objeto trocado por um que lança em qualquer leitura, ela responde', () => {
    modoSimulado = 'recusa'
    escreverData(DATA_CONFERIDA)
    const original = process.env
    const explosivo = new Proxy({}, {
      get() { throw new Error('process.env lido') },
      has() { throw new Error('process.env lido') },
      ownKeys() { throw new Error('process.env lido') },
    })
    Object.defineProperty(process, 'env', { value: explosivo, configurable: true, writable: true })
    try {
      expect(e19ConferidaParaChave()).toEqual({ ok: true })
    } finally {
      Object.defineProperty(process, 'env', { value: original, configurable: true, writable: true })
    }
  })
})

describe('prazoDoResponder', () => {
  it('decorrido 0: 50.000 (o teto da ferramenta manda)', () => {
    expect(prazoDoResponder(0)).toBe(50_000)
  })
  it('decorrido 2.000: 50.000; 2.001: 49.999 (fronteira entre os dois termos do mínimo)', () => {
    expect(prazoDoResponder(2_000)).toBe(50_000)
    expect(prazoDoResponder(2_001)).toBe(49_999)
  })
  it('decorrido 47.000: 5.000; 47.001: null (fronteira do mínimo para responder)', () => {
    expect(prazoDoResponder(47_000)).toBe(5_000)
    expect(prazoDoResponder(47_001)).toBeNull()
  })
  it('decorrido maior que o teto, negativo, NaN, infinito: null (dado ausente não vira prazo)', () => {
    for (const x of [60_001, 1e9, -1, -0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(prazoDoResponder(x)).toBeNull()
    }
  })
  it('para todo decorrido de 0 a 60.000, de 250 em 250: se não é null, decorrido + prazo + reserva + folga <= teto da requisição', () => {
    let achouAlgum = false
    for (let d = 0; d <= 60_000; d += 250) {
      const p = prazoDoResponder(d)
      if (p === null) continue
      achouAlgum = true
      expect(d + p + ACESSO_IA_RULES.reservaDoRegistroMs + ACESSO_IA_RULES.folgaMs).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoDaRequisicaoMs)
      expect(p).toBeGreaterThanOrEqual(ACESSO_IA_RULES.minimoParaResponderMs)
    }
    expect(achouAlgum).toBe(true)
  })
})

describe('as regras', () => {
  it('os números do plano (seção 5 e 4.5)', () => {
    expect(ACESSO_IA_RULES).toMatchObject({
      porMinuto: 30, porDia: 500, tetoPorAcao: 60_000, tetoPacoteDaTela: 30_000,
      canaisNaLista: 200, canaisNoComparar: { min: 2, max: 6 }, videosNosDestaques: 50, pontosDaSerie: 400, mudancas: 100,
      validadeDias: 180, validadeMaxDias: 366, avisoDeVencimentoDias: 14, pessoasComChaveMax: 2,
      prazoPorIdaMs: 5_000, prazoDaFerramentaMs: 50_000, prazoPorIdaDaPodaMs: 2_500,
      tetoDaRequisicaoMs: 60_000, reservaDoRegistroMs: 5_000, folgaMs: 3_000, minimoParaResponderMs: 5_000,
      guardaDoRegistroDias: 400, guardaDoContadorDias: 2, recusadoNoMaximoACadaMs: 3_600_000,
      fatiaDaPodaDoRegistroDias: 30, fatiaDaPodaDoContadorDias: 30,
    })
  })

  it('o valor publicado de e19RecusaConferidaEm e excecaoDaPergunta47Em, quando preenchido, é data real AAAA-MM-DD e não está no futuro', async () => {
    const real = (await vi.importActual<typeof import('@/lib/youtube/observatorio/acesso-ia/regras')>('@/lib/youtube/observatorio/acesso-ia/regras')).ACESSO_IA_RULES
    const hoje = new Date().toISOString().slice(0, 10)
    for (const d of [real.e19RecusaConferidaEm, real.excecaoDaPergunta47Em]) {
      if (d === null) continue
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${d}T00:00:00.000Z`).toISOString().slice(0, 10)).toBe(d)
      expect(d <= hoje).toBe(true)
    }
  })

  it('A/regras.ts não importa rules.ts (o ciclo mora no outro sentido)', () => {
    const texto = readFileSync(resolve(DIR, 'regras.ts'), 'utf8')
    expect(texto).not.toMatch(/from\s+['"][^'"]*\/rules['"]/)
    expect(texto).not.toMatch(/from\s+['"]\.\.\/rules['"]/)
  })
})

describe('frases', () => {
  it('fraseDeLimite escreve a hora de volta no horário de São Paulo (UTC-3)', () => {
    expect(fraseDeLimite('2026-10-14T00:00:00.000Z')).toContain('21:00')
    expect(fraseDeLimite('2026-10-14T12:31:00.000Z')).toContain('09:31')
  })

  it('fraseDeLimite na virada de dia: 00:00 UTC vira 21:00 do dia anterior; 03:00 UTC vira 00:00; 02:59 UTC vira 23:59', () => {
    expect(fraseDeLimite('2026-10-14T02:59:00.000Z')).toContain('23:59')
    expect(fraseDeLimite('2026-10-14T03:00:00.000Z')).toContain('00:00')
    expect(fraseDeLimite('2026-10-14T03:00:00.000Z')).not.toContain('24:00')
  })

  it('fraseDeLimite com instante inválido não inventa hora', () => {
    const f = fraseDeLimite('amanhã')
    expect(f).not.toMatch(/\d{2}:\d{2}/)
    expect(f.length).toBeGreaterThan(0)
  })

  it('as frases da porta têm o status e o texto da seção 6', () => {
    expect(FRASES.desligado).toEqual({ status: 503, frase: 'acesso externo desligado' })
    expect(FRASES.misto).toEqual({ status: 403, frase: 'chave de perfil misto: recusada' })
    expect(FRASES.sem_pessoa).toEqual({ status: 401, frase: 'chave sem pessoa: peça outra ao dono' })
    expect(FRASES.sem_validade).toEqual({ status: 401, frase: 'chave sem validade: peça outra ao dono' })
    expect(FRASES.sem_acesso).toEqual({ status: 403, frase: 'sem acesso ao site' })
    expect(FRASES.nao_conferido).toEqual({ status: 503, frase: 'não foi possível conferir o acesso agora: tente de novo em instantes' })
  })
})
