// @vitest-environment node
/**
 * A4 R5 T9: o ramo `consultar` do `responder`. `montarConsulta` é dobrado (a T8 prova o montador): o que se prova aqui é o que o `responder`
 * faz com o resultado: texto, Cobertura, divisão do teto entre os blocos, próximas chamadas, recusas e registro.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ montar: vi.fn(), empacotar: {} as Record<string, unknown>, captureMessage: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: m.captureMessage, captureException: () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/dados', () => ({ lugaresParaDefinicoes: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_consultar/montar', () => ({ montarConsulta: m.montar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { registrarAcessoDaChave } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { RODAPE_MAX } from '@/lib/youtube/observatorio/acesso-ia/cobertura'
import { comContextoDoObservatorio, type ContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import { executarChamada } from '@/lib/pipeline/mcp/observatorio/executar'
import type { ResultadoDaConsulta } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta'
import type { CelulaDaConsulta, LinhaDaConsulta, MetricaDaConsulta, PedidoDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'

const AGORA = Date.UTC(2026, 10, 11, 15)
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const PEDIDO: PedidoDaConsulta = {
  formato: 'todos', janelaIdade: ['0-30', '31-90'], metricas: ['views', 'likes', 'comentarios', 'multiplicador'],
  ordenarPor: 'multiplicador', direcao: 'desc', limite: 20, incluirBaseFraca: false,
}
const med = (x: number): CelulaDaConsulta => ({ x, estado: 'medido' })
const nao = (causa: string): CelulaDaConsulta => ({ x: null, estado: 'nao_medido', causa })

function linha(i: number, formato: 'longos' | 'shorts', o: { titulo?: string; canal?: string; nao?: boolean; lugares?: string[] } = {}): LinhaDaConsulta {
  const sigla = formato === 'shorts' ? 'SH' : 'LG'
  const c = (x: number, causa: string): CelulaDaConsulta => (o.nao ? nao(causa) : med(x))
  return {
    id: uuid(i + (formato === 'shorts' ? 5000 : 0)), ytId: sigla + String(i).padStart(9, '0'), titulo: o.titulo ?? `Vídeo ${formato} ${i}`, canal: o.canal ?? `Canal ${i % 3}`, canalId: uuid(9000 + (i % 3)),
    publicadoEm: '2026-10-20', idadeDias: 22, formato, formatoConfirmado: true, estado: 'ativo', medidoEm: '2026-11-11T11:00:00.000Z', lugares: o.lugares ?? ['local:vn-hanoi'],
    celulas: { views: c(1000 + i, 'views não lidas'), likes: c(50 + i, 'curtidas ocultas pelo canal'), comentarios: c(5 + i, 'comentários desligados'), multiplicador: c(9 - i / 100, 'sem base de comparação') },
    multN: 20, multMetodo: 'mesmo dia de vida', baseFraca: false, motivos: [],
  }
}
function bloco(formato: 'longos' | 'shorts', mostradas: number, elegiveis: number, o: Parameters<typeof linha>[2] = {}): ResultadoDaConsulta['blocos'][number] {
  return {
    formato, linhas: Array.from({ length: mostradas }, (_, i) => linha(i + 1, formato, o)), cortadasPorLimite: Math.max(0, elegiveis - mostradas),
    agregado: {
      n: elegiveis, elegiveis, baseFraca: 0, sincAtrasado: 0,
      porMetrica: { multiplicador: { mediana: 3.2, q1: 2.1, q3: 4.8, n: elegiveis, semOsVideos: [], semOsCanais: [] } },
    },
  }
}
const resultado = (blocos: ResultadoDaConsulta['blocos'], pedido: Partial<PedidoDaConsulta> = {}, over: Partial<ResultadoDaConsulta> = {}): ResultadoDaConsulta => ({
  pedido: { ...PEDIDO, ...pedido }, blocos, dadosDe: { motor: '2026-11-11T11:00:00.000Z', medidas: '2026-11-11T09:00:00.000Z', lugares: null },
  canaisSemMedida: [], canaisNaoEncontrados: [], leituraMaisAntiga: '2026-11-11T09:00:00.000Z', ...over,
})
const pedir = (e: Record<string, unknown> = {}) => responder({ acao: 'consultar', ...e }, ABRIDOR_DE_SESSAO, AGORA)
const linhasNoTexto = (t: string, sigla: 'LG' | 'SH'): number => (t.split('## Cobertura')[0]!.match(new RegExp(`${sigla}\\d{9}`, 'g')) ?? []).length

beforeEach(() => { m.montar.mockReset(); m.captureMessage.mockReset() })

describe('consultar: a resposta e a Cobertura', () => {
  it('(c) 30 elegíveis com 20 mostrados e Shorts 13 de 13: "linhas 1–20 de 30" na lista, Shorts inteiros, "na ordem do pedido"', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 20, 30), bloco('shorts', 13, 13)]))
    const r = await pedir()
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('## Cobertura')
    expect(r.texto).toMatch(/linhas 1–20 de 30/)
    expect(r.texto).toContain('na ordem do pedido')
    expect(r.texto).not.toContain('na ordem da tela')
    expect(r.texto).toContain('Shorts: 13 de 13')
    expect(r.texto).toMatch(/Tabelas de apoio: 1 de 1 inteiras/)
    expect(linhasNoTexto(r.texto, 'LG')).toBe(20)
    expect(linhasNoTexto(r.texto, 'SH')).toBe(13)
  })
  it('(c) 30/20 e Shorts 40/20: o apoio diz "Shorts" 20 de 40, e a Cobertura diz que a lista não tem janela', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 20, 30), bloco('shorts', 20, 40)]))
    const r = await pedir()
    expect(r.texto).toMatch(/cortadas: "Shorts" \(20 de 40 linhas\)/)
    expect(r.texto).toContain('Shorts: 20 de 40')
    expect(r.texto).toMatch(/Você viu só uma parte/)
    expect(r.texto).toContain('Esta lista não tem janela: estreite o filtro (lugar, canal_ids, janela_idade) ou peça limite 50')
    expect(r.params).toMatchObject({ completa: false, elegiveis: 70, linhas: 40, cortadas: 30 })
  })
  it('limite já 50: a frase da janela não manda pedir limite 50; sem corte, a frase não aparece e a resposta é completa', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 50, 80), bloco('shorts', 3, 3)], { limite: 50 }))
    const cortada = await pedir({ limite: 50 })
    expect(cortada.texto).toContain('Esta lista não tem janela: estreite o filtro (lugar, canal_ids, janela_idade)')
    expect(cortada.texto).not.toContain('peça limite 50')
    m.montar.mockResolvedValue(resultado([bloco('longos', 5, 5), bloco('shorts', 3, 3)]))
    const inteira = await pedir()
    expect(inteira.texto).not.toContain('não tem janela')
    expect(inteira.params).toMatchObject({ completa: true })
  })
  it('conjunto vazio: "0 de 0 linhas" e a frase do vazio da Cobertura; nunca "viu tudo"', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 0, 0), bloco('shorts', 0, 0)], { lugar: 'pais:VN' }, { lugar: { estado: 'marcado', calculadoEm: '2026-11-10T10:00:00Z', atrasado: false, emRecalculo: false, semLugarCalculado: 0, maisDeUmLugar: 0, maisDeUmLugarSobre: 'marcados' } }))
    const r = await pedir({ lugar: 'pais:VN' })
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('0 de 0 linhas')
    expect(r.texto).toContain('A lista está vazia neste recorte; vazio não é zero.')
    expect(r.texto).toMatch(/Nenhum vídeo marcado com pais:VN/)
    expect(r.texto).not.toContain('desconhecido')
    expect(r.params).toMatchObject({ completa: false, elegiveis: 0, linhas: 0 })
  })
  it('m-2: conjunto vazio com motor e medidas nulos não diz "motor não lido"', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 0, 0), bloco('shorts', 0, 0)], {}, { dadosDe: { motor: null, medidas: null, lugares: null }, leituraMaisAntiga: null }))
    const r = await pedir()
    expect(r.texto).not.toContain('motor não lido')
    expect(r.texto).not.toContain('medidas não lido')
    expect(r.texto).toContain('A lista está vazia neste recorte; vazio não é zero.')
  })
  it('m-1: canais sem medidas entram em params.canais_sem_medida (e só então)', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 3, 3)], {}, { canaisSemMedida: [{ nome: 'A', causa: 'erro_do_banco' }, { nome: 'B', causa: 'erro_do_banco' }] }))
    expect((await pedir()).params).toMatchObject({ canais_sem_medida: 2 })
    m.montar.mockResolvedValue(resultado([bloco('longos', 3, 3)]))
    expect((await pedir()).params).not.toHaveProperty('canais_sem_medida')
  })
  it('m-limite: bloco cortado por tamanho não oferece limite 50; cortado só pelo limite oferece', async () => {
    const o = { titulo: 'T'.repeat(100), canal: 'C'.repeat(60), nao: true, lugares: ['local:vn-hanoi', 'local:vn-saigon', 'pais:VN'] }
    const metricas: MetricaDaConsulta[] = ['views', 'likes', 'comentarios', 'vpd7', 'multiplicador', 'engajamento', 'inscritos']
    m.montar.mockResolvedValue(resultado([bloco('longos', 49, 90, o), bloco('shorts', 49, 70, o)], { limite: 49, metricas }))
    const cortado = await pedir({ limite: 49, metricas })
    expect(cortado.texto).toMatch(/Cortado por tamanho: /)
    expect(cortado.texto.slice(cortado.texto.indexOf('Próximas chamadas'))).not.toContain('"limite":50')
    m.montar.mockResolvedValue(resultado([bloco('longos', 20, 30)], { formato: 'longos' }))
    const so = await pedir({ formato: 'longos' })
    expect(so.texto.slice(so.texto.indexOf('Próximas chamadas'))).toContain('"limite":50')
  })
  it('(g) "Ordenado por: multiplicador" no padrão; com vpd7, "crescimento de views: views por dia nos últimos 7 dias"', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 2, 2)], { formato: 'longos' }))
    expect((await pedir()).texto).toMatch(/Ordenado por \| multiplicador/)
    m.montar.mockResolvedValue(resultado([bloco('longos', 2, 2)], { formato: 'longos', ordenarPor: 'vpd7', metricas: ['views', 'vpd7'] }))
    expect((await pedir({ ordenar_por: 'vpd7' })).texto).toContain('crescimento de views: views por dia nos últimos 7 dias')
  })
  it('(g2) a resposta padrão traz engajamento entre as próximas chamadas, nunca mais de 3; limite:50 não sai com limite 50', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 20, 30), bloco('shorts', 20, 40)]))
    const r = await pedir()
    const proximas = r.texto.slice(r.texto.indexOf('Próximas chamadas'))
    const chamadas = proximas.split('\n').filter((l) => l.startsWith('- {'))
    expect(chamadas.length).toBeLessThanOrEqual(3)
    expect(proximas).toContain('"ordenar_por":"engajamento"')
    expect(chamadas[0]).toContain('"limite":50')
    expect(chamadas[0]).toContain('"formato":"longos"')
    for (const c of chamadas) expect(c).not.toContain('"entidade"')
    m.montar.mockResolvedValue(resultado([bloco('longos', 50, 80)], { formato: 'longos', limite: 50 }))
    const cheia = await pedir({ formato: 'longos', limite: 50 })
    expect(cheia.texto.slice(cheia.texto.indexOf('Próximas chamadas'))).not.toContain('ver até 50 linhas')
  })
  it('(g2) ordenou por engajamento: a sugestão é views; ordenou por views sem engajamento medido: engajamento ainda é oferecido só se há reação medida', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 3, 3)], { formato: 'longos', ordenarPor: 'engajamento', metricas: ['views', 'engajamento'] }))
    const a = await pedir({ ordenar_por: 'engajamento' })
    const ap = a.texto.slice(a.texto.indexOf('Próximas chamadas'))
    expect(ap).toContain('"ordenar_por":"views"')
    expect(ap).not.toContain('"ordenar_por":"engajamento"')
    m.montar.mockResolvedValue(resultado([bloco('longos', 3, 3, { nao: true })], { formato: 'longos' }))
    const b = await pedir({ formato: 'longos' })
    const bp = b.texto.slice(b.texto.indexOf('Próximas chamadas'))
    expect(bp).toContain('"ordenar_por":"views"')
  })
  it('as próximas chamadas incluem o canal e o vídeo da 1ª linha quando sobra vaga (ids de uuid)', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 3, 3)], { formato: 'longos', ordenarPor: 'views' }))
    const r = await pedir({ formato: 'longos', ordenar_por: 'views' })
    expect(r.texto).toContain('"acao":"canal"')
    expect(r.texto).toContain(uuid(9001))
  })
  it('nenhuma frase da resposta contém "gravado em"', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 3, 3)], {}, { lugar: { estado: 'marcado', calculadoEm: '2026-11-10T10:00:00Z', atrasado: true, emRecalculo: true, semLugarCalculado: 2, maisDeUmLugar: 1, maisDeUmLugarSobre: 'marcados', desligado: true } }))
    expect((await pedir({ lugar: 'pais:VN' })).texto).not.toMatch(/gravado em/i)
  })
})

describe('consultar: o corte por tamanho (D9)', () => {
  const GRANDE = 'T'.repeat(100)
  it('(j) pior caso: 2 × 50 linhas de títulos de 100 e canais de 60, 3 lugares, tudo não medido: ≤ 60.000, cabeçalho e agregados presentes, ≥ 1 linha por bloco, e a Cobertura conta as linhas que estão no texto', async () => {
    const o = { titulo: GRANDE, canal: 'C'.repeat(60), nao: true, lugares: ['local:vn-hanoi', 'local:vn-saigon', 'pais:VN'] }
    const metricas: MetricaDaConsulta[] = ['views', 'likes', 'comentarios', 'vpd7', 'multiplicador', 'engajamento', 'inscritos']
    m.montar.mockResolvedValue(resultado([bloco('longos', 50, 90, o), bloco('shorts', 50, 70, o)], { limite: 50, metricas }))
    const r = await pedir({ limite: 50, metricas })
    expect(r.desfecho).toBe('ok')
    expect(r.texto.length).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoPorAcao)
    expect(r.texto).toContain('Como esta consulta foi lida')
    expect(r.texto).toContain('Mediana e quartis de todas as elegíveis (longos)')
    expect(r.texto).toContain('Mediana e quartis de todas as elegíveis (Shorts)')
    const lg = linhasNoTexto(r.texto, 'LG'), sh = linhasNoTexto(r.texto, 'SH')
    expect(lg).toBeGreaterThanOrEqual(1); expect(sh).toBeGreaterThanOrEqual(1)
    expect(lg + sh).toBeLessThan(100)
    expect(r.texto).toContain(`linhas 1–${lg} de 90`)
    expect(r.texto).toContain(`"Shorts" (${sh} de 70 linhas)`)
    expect(r.texto).toContain(`Shorts: ${sh} de 70`)
    expect(r.texto).toMatch(/Cortado por tamanho: /)
    expect(r.texto).toContain('cortados por tamanho:')
    expect(r.params).toMatchObject({ linhas: lg + sh, elegiveis: 160, completa: false })
    expect(r.texto.indexOf('## Cobertura')).toBeGreaterThan(0)
    expect(r.texto.length - r.texto.indexOf('## Cobertura')).toBeLessThanOrEqual(RODAPE_MAX + 2)
  })
  it('o teto que um bloco não usa passa ao outro: longos pequenos (5) e Shorts grandes ficam com mais linhas do que a metade do teto daria', async () => {
    const o = { titulo: GRANDE, canal: 'C'.repeat(60), nao: true, lugares: ['local:vn-hanoi', 'local:vn-saigon', 'pais:VN'] }
    m.montar.mockResolvedValue(resultado([bloco('longos', 5, 5, o), bloco('shorts', 50, 90, o)], { limite: 50 }))
    const r = await pedir({ limite: 50 })
    expect(linhasNoTexto(r.texto, 'LG')).toBe(5)
    expect(linhasNoTexto(r.texto, 'SH')).toBeGreaterThan(25)
    expect(r.texto.length).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoPorAcao)
  })
  it('a tela da consultar nunca passa por limitarLinhas nem pelas classes da IA: o bloco principal não é cortado em 25/10/5/3', async () => {
    m.montar.mockResolvedValue(resultado([bloco('longos', 50, 50)], { formato: 'longos', limite: 50 }))
    const r = await pedir({ formato: 'longos', limite: 50 })
    expect(linhasNoTexto(r.texto, 'LG')).toBe(50)
    expect(r.texto).not.toMatch(/linhas não couberam/)
  })
})

describe('consultar: recusas (I5)', () => {
  const CASOS = [
    ['lugar_desconhecido', 'nao_encontrado', { lugar: 'local:vn-ha-noi' }, /lugar desconhecido/, '{"acao":"definicoes"}'],
    ['lugar_sem_calculo', 'nao_encontrado', { lugar: 'local:vn-hanoi', formato: 'longos' }, /nunca calculados/, '{"acao":"consultar","formato":"longos"}'],
    ['lugar_falhou', 'falhou', { lugar: 'local:vn-hanoi' }, /leitura de lugares falhou/, '{"acao":"consultar"}'],
    ['nicho_desconhecido', 'nao_encontrado', { nicho: 'culinaria', lugar: 'pais:VN' }, /nicho desconhecido/, '{"acao":"consultar","lugar":"pais:VN"}'],
    ['canais_nao_encontrados', 'nao_encontrado', { canal_ids: [uuid(77)], limite: 5 }, /canais não encontrados: /, '{"acao":"consultar","limite":5}'],
  ] as const
  it.each(CASOS)('%s: desfecho %s gravado pelo registro real, isError, e a próxima chamada sem o filtro culpado (validada)', async (recusa, desfecho, entrada, frase, proxima) => {
    const frases: Record<string, string> = {
      lugar_desconhecido: 'lugar desconhecido; a lista de lugares com dados está em definicoes', lugar_sem_calculo: 'lugares nunca calculados neste site',
      lugar_falhou: 'não medido: leitura de lugares falhou; tente de novo', nicho_desconhecido: 'nicho desconhecido', canais_nao_encontrados: `canais não encontrados: ${uuid(77)}`,
    }
    m.montar.mockResolvedValue({ recusa, frase: frases[recusa], ...(recusa === 'canais_nao_encontrados' ? { ids: [uuid(77)] } : {}) })
    const ctx: ContextoDoObservatorio = { prova: fabricarProva('s', 'u', 'k', '2999-01-01T00:00:00Z'), acesso: { leitura: null, edita: false, negativa: 'sem_direito' }, t0: AGORA }
    const linhas: Array<Record<string, unknown>> = []
    const sb = {
      rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1 }], error: null }) }),
      from: () => ({ insert: (l: Record<string, unknown>) => ({ abortSignal: async () => { linhas.push(l); return { error: null } } }) }),
    }
    const out = await comContextoDoObservatorio(ctx, () => executarChamada({ acao: 'consultar', ...entrada }, { sb: sb as never, responder: (e, _c, agora) => responder(e, ABRIDOR_DE_SESSAO, agora), agora: () => AGORA }))
    expect(out.erro).toBe(true)
    expect(out.texto).toMatch(frase)
    expect(out.texto).toContain(proxima)
    expect(linhas).toHaveLength(1)
    expect((linhas[0]!.params as Record<string, unknown>).desfecho).toBe(desfecho)
    expect(linhas[0]!.output_chars).toBeNull()
    expect(out.texto).not.toMatch(/gravado em/i)
    void recusa
  })
  it('lugar_desconhecido traz {acao:definicoes} e nunca uma lista vazia nem "0 vídeos"', async () => {
    m.montar.mockResolvedValue({ recusa: 'lugar_desconhecido', frase: 'lugar desconhecido; a lista de lugares com dados está em definicoes' })
    const r = await pedir({ lugar: 'local:vn-ha-noi' })
    expect(r.texto).toContain('{"acao":"definicoes"}')
    expect(r.texto).not.toMatch(/0 vídeos|Nenhum vídeo/)
  })
})

describe('consultar: prazo e registro', () => {
  it('(c) montarConsulta que nunca resolve: executarChamada devolve "demorou" e grava desfecho tempo', async () => {
    vi.useFakeTimers()
    try {
      m.montar.mockImplementation(() => new Promise(() => undefined))
      const ctx: ContextoDoObservatorio = { prova: fabricarProva('s', 'u', 'k', '2999-01-01T00:00:00Z'), acesso: { leitura: null, edita: false, negativa: 'sem_direito' }, t0: AGORA }
      const linhas: Array<Record<string, unknown>> = []
      const sb = {
        rpc: () => ({ abortSignal: async () => ({ data: [{ no_minuto: 1, no_dia: 1 }], error: null }) }),
        from: () => ({ insert: (l: Record<string, unknown>) => ({ abortSignal: async () => { linhas.push(l); return { error: null } } }) }),
      }
      const p = comContextoDoObservatorio(ctx, () => executarChamada({ acao: 'consultar' }, { sb: sb as never, responder: (e, _c, agora) => responder(e, ABRIDOR_DE_SESSAO, agora), agora: () => AGORA }))
      await vi.advanceTimersByTimeAsync(50_000)
      const out = await p
      expect(out).toEqual({ texto: 'a consulta demorou demais: nada foi entregue', erro: true })
      expect((linhas[0]!.params as Record<string, unknown>).desfecho).toBe('tempo')
    } finally { vi.useRealTimers() }
  })
  it('montarConsulta que lança: desfecho falhou (frase fechada), sem a mensagem da exceção', async () => {
    m.montar.mockRejectedValue(new Error('SEGREDO-DO-BANCO'))
    const r = await pedir()
    expect(r.desfecho).toBe('falhou')
    expect(r.texto).not.toContain('SEGREDO')
  })
  it('os params do registro: contadores e a mais velha das leituras (hora cheia); campos do pedido só com forma', async () => {
    const naoMedidos = bloco('longos', 4, 4, { nao: true })
    m.montar.mockResolvedValue(resultado([naoMedidos], { formato: 'longos' }, { lugar: { estado: 'marcado', calculadoEm: '2026-11-10T10:00:00Z', atrasado: false, emRecalculo: false, semLugarCalculado: 7, maisDeUmLugar: 0, maisDeUmLugarSobre: 'marcados' }, leituraMaisAntiga: '2026-11-11T09:41:12.000Z' }))
    const r = await pedir({ formato: 'longos', lugar: 'pais:VN', limite: '4', metricas: ['views', 'likes'] })
    expect(r.params).toMatchObject({
      entidade: 'video', formato: 'longos', lugar: 'pais:VN', limite: 4, elegiveis: 4, linhas: 4, total: 4, cortadas: 0,
      sem_lugar_calculado: 7, dados_de: '2026-11-11T09', privado: false, comentarios: false,
    })
    expect(r.params.nao_medidos).toMatchObject({ views: 4, likes: 4, comentarios: 4, multiplicador: 4 })
    const gravada = await (async () => {
      const linhas: Array<Record<string, unknown>> = []
      const sb = { from: () => ({ insert: (l: Record<string, unknown>) => { linhas.push(l); return { abortSignal: async () => ({ error: null }) } } }) }
      const g = await registrarAcessoDaChave(sb as never, { prova: fabricarProva('s', 'u', 'k', new Date(Date.now() + 86_400_000).toISOString()), acao: 'consultar', params: { ...r.params, desfecho: r.desfecho } as never, incluiuPrivado: false, caracteres: r.texto.length, resultado: 'ok' })
      expect(g.ok).toBe(true)
      return linhas[0]!.params as Record<string, unknown>
    })()
    expect(gravada).toMatchObject({ elegiveis: 4, linhas: 4, sem_lugar_calculado: 7, dados_de: '2026-11-11T09', limite: 4 })
    expect(JSON.stringify(gravada).length).toBeLessThanOrEqual(1_024)
  })
  it('pacote_da_tela com tela "consultar": recusa "use a ação consultar"', async () => {
    const r = await responder({ acao: 'pacote_da_tela', tela: 'consultar' }, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toContain('use a ação consultar')
  })
})
