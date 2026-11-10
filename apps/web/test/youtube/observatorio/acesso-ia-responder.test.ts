// @vitest-environment node
/**
 * A5 · E17 degrau 2, Tarefa 10: `responder`, da ação ao texto. `EMPACOTAR` é simulado com `PacoteModelo` de fixture: o que se prova aqui é o que o
 * `responder` faz com o modelo (limite próprio, corte por tamanho, grão semana, "não encontrado", falha sem sentinela), não o dado das telas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  empacotar: {} as Record<string, ReturnType<typeof import('vitest')['vi']['fn']>>,
  captured: [] as unknown[],
}))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => m.captured.push(a), captureException: (...a: unknown[]) => m.captured.push(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({ EMPACOTAR: m.empacotar }))

import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { Celula, PacoteModelo, Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { FRASES_DA_FERRAMENTA } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { AGORA, SENTINELA, medido, modeloCheio, modeloComComentarios, modeloPrivadoExcluido, modeloPrivadoIncluido, modeloVazio, naoMedido, rotulo, terceiros, base } from './contexto-ia-fixture'

const abrir = ABRIDOR_DE_SESSAO
const RECENTE = '13/10/2026 09:10'
const C1 = '11111111-1111-4111-8111-111111111111'
const C2 = '22222222-2222-4222-8222-222222222222'
const C3 = '33333333-3333-4333-8333-333333333333'
const C4 = '44444444-4444-4444-8444-444444444444'
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const TELAS: TelaId[] = ['canais', 'canal', 'video', 'comparar', 'outliers', 'insights', 'mudancas', 'fila', 'canal-proprio', 'video-proprio', 'ritmo', 'sugestoes']
const pacote = (modelo: PacoteModelo) => ({ modelo, recente: RECENTE, estado: {} as Record<string, string> })
const esperado = (modelo: PacoteModelo, teto = ACESSO_IA_RULES.tetoPorAcao): string => montarTexto(segmentar(modelo, { geradoEm: AGORA, recente: RECENTE }), '', teto, 'todos', undefined, { ia: true }).texto
const dobra = (tela: TelaId, modelo: PacoteModelo | null) => (m.empacotar[tela] as ReturnType<typeof vi.fn>).mockImplementation(async () => (modelo === null ? null : pacote(modelo)))

beforeEach(() => {
  m.captured.length = 0
  for (const t of TELAS) m.empacotar[t] = vi.fn(async () => null)
})

/* ------------------------------------------------------------------ fixtures */

const comTela = (modelo: PacoteModelo, tela: TelaId): PacoteModelo => ({ ...modelo, tela })

function lista(id: string, linhas: number, tela: TelaId = 'canais'): PacoteModelo {
  const t: Tabela = {
    id, titulo: `Lista ${id}`, tipo: 'lista', nomeNoCorte: `tabela ${id}`, privada: false, colunas: ['Item', 'Valor'],
    linhas: Array.from({ length: linhas }, (_, i) => [terceiros(`Item ${i + 1}`, `p.l[${i}].n`), medido(`${i + 1}`, i + 1, `p.l[${i}].v`)]),
  }
  return { ...comTela(modeloCheio(), tela), tabelas: [t] }
}

const pad = (n: number): string => String(n).padStart(2, '0')
/** `n` dias seguidos terminando em 13/10/2026, do mais recente ao mais antigo, rótulo `dd/mm/aaaa`. `medidoNo(i)` decide se o dia i (0 = mais recente) tem número. */
function serie(n: number, medidoNo: (i: number) => boolean = () => true, privada = false, semana?: 'soma' | 'ultima'): Tabela {
  const fim = Date.UTC(2026, 9, 13)
  return {
    id: 'serie', titulo: 'Views por dia', tipo: 'dia_a_dia', nomeNoCorte: 'views por dia', privada, colunas: ['Dia', 'Views'], ...(semana ? { semana } : {}),
    linhas: Array.from({ length: n }, (_, i): Celula[] => {
      const d = new Date(fim - i * 86_400_000)
      const rot = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
      return [rotulo(rot, `p.s[${i}].dia`), medidoNo(i) ? medido(`${1000 + i}`, 1000 + i, `p.s[${i}].v`) : naoMedido('SEM_LEITURA', `p.s[${i}].v`)]
    }),
  }
}
const modeloSerie = (t: Tabela, tela: TelaId = 'canal'): PacoteModelo => ({ ...comTela(modeloCheio(), tela), tabelas: [t] })
const linhasDaSerie = (texto: string): string[] => texto.split('\n').filter((l) => /\d{2}\/\d{2}\/\d{4}/.test(l) && l.includes('|'))

const SERIE = { acao: 'serie', canal_id: C1, de: '2000-01-01', ate: '2026-10-13' }

/* ------------------------------------------------------------------ por ação */

describe('responder: o texto do pacote da tela certa', () => {
  const casos: Array<[string, Record<string, unknown>, TelaId[]]> = [
    ['listar_canais', { acao: 'listar_canais' }, ['canais']],
    ['canal', { acao: 'canal', canal_id: C1 }, ['canal']],
    ['video', { acao: 'video', video_id: V1 }, ['video']],
    ['destaques', { acao: 'destaques' }, ['outliers']],
    ['mudancas', { acao: 'mudancas' }, ['mudancas']],
    ['sugestoes', { acao: 'sugestoes' }, ['sugestoes']],
    ['pacote_da_tela', { acao: 'pacote_da_tela', tela: 'insights' }, ['insights']],
  ]
  it.each(casos)('%s devolve o texto de montarTexto e chama só a tela %j', async (_n, entrada, telas) => {
    const modelo = comTela(modeloCheio(), telas[0]!)
    for (const t of telas) dobra(t, modelo)
    const r = await responder(entrada, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    const teto = entrada.acao === 'pacote_da_tela' ? ACESSO_IA_RULES.tetoPacoteDaTela : ACESSO_IA_RULES.tetoPorAcao
    const ve = r.texto.includes('Não aplicado') || r.texto.includes('Janela usada')
    if (!ve) expect(r.texto.startsWith(esperado(modelo, teto - 1_802))).toBe(true) // o resto é a Cobertura (teste (1) da T4)
    for (const t of TELAS) if (!telas.includes(t)) expect(m.empacotar[t]).not.toHaveBeenCalled()
    expect(m.empacotar[telas[0]!]).toHaveBeenCalledTimes(1)
  })

  it('o abridor recebido chega ao empacotador', async () => {
    dobra('canais', comTela(modeloCheio(), 'canais'))
    await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(m.empacotar.canais).toHaveBeenCalledWith(expect.anything(), abrir)
  })

  it('definicoes junta as cinco telas e não repete a medida', async () => {
    for (const t of ['canais', 'comparar', 'outliers', 'insights', 'mudancas'] as const) {
      dobra(t, { ...comTela(modeloCheio(), t), definicoes: [{ medida: 'Mediana de views', frase: 'o valor do meio', limiares: [] }, { medida: `Só de ${t}`, frase: 'x', limiares: [] }], naoMede: ['frequência de publicação'] })
    }
    const r = await responder({ acao: 'definicoes' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto.split('Mediana de views').length - 1).toBe(1)
    for (const t of ['canais', 'comparar', 'outliers', 'insights', 'mudancas']) expect(r.texto).toContain(`Só de ${t}`)
    expect(r.texto.split('frequência de publicação').length - 1).toBe(1)
    expect(r.incluiuPrivado).toBe(false)
  })

  it('semEquivalente e janelaUsada vão no topo e não somem', async () => {
    dobra('outliers', comTela(modeloCheio(), 'outliers'))
    const r = await responder({ acao: 'destaques', formato: 'todos' }, abrir, AGORA)
    expect(r.texto).toMatch(/Não aplicado: formato todos/)
    expect(r.texto).toMatch(/Janela usada: recorte padrão da tela/)
    expect(r.texto.indexOf('Não aplicado')).toBeLessThan(r.texto.indexOf('Janela usada'))
  })

  it('params só levam campos validados (e nunca texto livre)', async () => {
    dobra('canal', comTela(modeloCheio(), 'canal'))
    const r = await responder({ acao: 'canal', canal_id: C1, janela: '30', formato: 'longos' }, abrir, AGORA)
    expect(r.params).toMatchObject({ canal_id: C1, janela: '30', formato: 'longos', privado: false, comentarios: false })
    const p = await responder({ acao: 'pacote_da_tela', tela: 'canais', parametros: { sort: 'views', fmt: 'long' } }, abrir, AGORA)
    expect(p.params.parametros).toEqual(['fmt=long', 'sort=views'])
  })
})

describe('responder: entrada inválida', () => {
  it.each([[null], ['texto'], [{}], [{ acao: 'apagar' }], [{ acao: 'canal', canal_id: 'com espaço' }], [{ acao: 'canal', canal_id: C1, extra: 1 }]])('%j: pedido_invalido, sem chamar tela', async (e) => {
    const r = await responder(e, abrir, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.incluiuPrivado).toBe(false)
    for (const t of TELAS) expect(m.empacotar[t]).not.toHaveBeenCalled()
  })
  it('a frase não ecoa o que a pessoa escreveu', async () => {
    const r1 = await responder({ acao: 'canal', canal_id: C1, ZZ_CAMPO_ESTRANHO: 1 }, abrir, AGORA)
    expect(r1.texto).not.toContain('ZZ_CAMPO_ESTRANHO')
    const r2 = await responder({ acao: 'canal', canal_id: 'ZZ texto livre ZZ' }, abrir, AGORA)
    expect(r2.texto).not.toContain('ZZ texto livre')
    const r3 = await responder({ acao: 'pacote_da_tela', tela: 'canais', parametros: { 'ZZ ruim': 'x' } }, abrir, AGORA)
    expect(r3.desfecho).toBe('pedido_invalido')
    expect(r3.texto).not.toContain('ZZ ruim')
  })
  it('a frase do tradutor passa: comparar com 1 canal', async () => {
    const r = await responder({ acao: 'comparar', canal_ids: [C1] }, abrir, AGORA)
    expect(r.desfecho).toBe('pedido_invalido')
    expect(r.texto).toMatch(/^pedido recusado: comparar aceita de 2 a 6 canais; vieram 1\. Formato de comparar: /)
  })
})

/* ------------------------------------------------------------------ limites */

describe('responder: o limite próprio de cada ação', () => {
  const linhasDe = (texto: string, prefixo: string): number => texto.split('\n').filter((l) => new RegExp(`${prefixo} \\d+`).test(l) && l.includes('|')).length

  it.each([[201, 200, true], [200, 200, false]])('listar_canais com %i canais: saem %i (frase: %s)', async (n, saem, frase) => {
    dobra('canais', lista('canais', n))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(linhasDe(r.texto, 'Item')).toBe(saem)
    // A7b: 200 é o máximo POR JANELA; o 201º vem pela próxima janela, não é cortado
    if (frase) {
      expect(r.texto).toContain('linhas 1–200 de 201')
      expect(r.texto).toContain('"a_partir_da_linha":201')
    } else expect(r.texto).toContain('linhas 1–200 de 200')
    expect(r.texto).not.toMatch(/há \d+ canais; saíram/)
    expect(r.params.cortes).toBe(0)
    expect(r.params.total).toBe(n)
  })
  it.each([[51, 50, true], [50, 50, false]])('destaques com %i vídeos: saem %i', async (n, saem, frase) => {
    dobra('outliers', lista('outliers', n, 'outliers'))
    const r = await responder({ acao: 'destaques' }, abrir, AGORA)
    expect(linhasDe(r.texto, 'Item')).toBe(saem)
    if (frase) expect(r.texto).toContain('linhas 1–50 de 51')
    expect(r.texto).not.toMatch(/saíram/)
    expect(r.params.total).toBe(n)
  })
  it.each([[101, 100, true], [100, 100, false]])('mudancas com %i: saem %i', async (n, saem, frase) => {
    dobra('mudancas', lista('trocas', n, 'mudancas'))
    const r = await responder({ acao: 'mudancas' }, abrir, AGORA)
    expect(linhasDe(r.texto, 'Item')).toBe(saem)
    if (frase) expect(r.texto).toContain('linhas 1–100 de 101')
    expect(r.texto).not.toMatch(/saíram/)
    expect(r.params.total).toBe(n)
  })
  it('o corte por tamanho cai abaixo do limite da ação: o aviso diz quantas linhas o texto levou, e o texto leva essas (I-1)', async () => {
    const t: Tabela = {
      id: 'canais', titulo: 'Lista canais', tipo: 'lista', nomeNoCorte: 'tabela canais', privada: false, colunas: ['Item', 'Valor'],
      linhas: Array.from({ length: 300 }, (_, i) => [terceiros(`Item ${i + 1} ${'x'.repeat(300)}`, `p.l[${i}].n`), medido(`${i + 1}`, i + 1, `p.l[${i}].v`)]),
    }
    dobra('canais', { ...comTela(modeloCheio(), 'canais'), tabelas: [t] })
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    // A7b: `k` exato (o maior que cabe); o resto vem pela próxima janela, a partir da linha k + 1
    const k = Number(/linhas 1–(\d+) de 300/.exec(r.texto)?.[1])
    expect(k).toBeGreaterThan(25)
    expect(k).toBeLessThan(200)
    expect(r.texto).toContain(`"a_partir_da_linha":${k + 1}`)
    expect(r.params.linhas).toBe(k)
    expect(linhasDe(r.texto, 'Item')).toBe(k)
    expect(r.texto.length).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoPorAcao)
  })
  it('bloco citado ligado a uma linha da principal é texto: fora da janela, com o aviso (o pacote continua válido)', async () => {
    const modelo = lista('trocas', 105, 'mudancas')
    modelo.citados = [1, 100, 101, 105].map((p) => ({ rotulo: `bloco ${p}`, texto: `texto ${p}`, origem: `p.c[${p}]`, linha: { tabela: 'trocas', posicao: p } }))
    dobra('mudancas', modelo)
    const r = await responder({ acao: 'mudancas' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).not.toContain('texto 100')
    expect(r.texto).not.toContain('texto 101')
    expect(r.texto).toContain('descrições de 2 mudanças não couberam')
  })
})

describe('responder: serie', () => {
  it('401 pontos no grão dia: passa ao grão semana e diz; 400: fica no dia', async () => {
    dobra('canal', modeloSerie(serie(401, () => true, false, 'ultima')))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).toMatch(/401 pontos no grão dia passam de 400; mostrada no grão semana/)
    expect(r.texto).toContain('grão semana')
    expect(linhasDaSerie(r.texto).length).toBeLessThan(80)
    dobra('canal', modeloSerie(serie(400)))
    const r2 = await responder(SERIE, abrir, AGORA)
    expect(r2.texto).not.toMatch(/grão semana/)
    expect(linhasDaSerie(r2.texto).length).toBe(400)
  })
  it('acumulado: o grão semana é a última leitura (seleção), com o valor dela', async () => {
    dobra('canal', modeloSerie(serie(401, () => true, false, 'ultima')))
    const r = await responder(SERIE, abrir, AGORA)
    // 13/10/2026 é terça: a semana corrente fica com o dia mais recente (valor 1000)
    expect(r.texto).toMatch(/13\/10\/2026.*1000/)
    expect(r.texto).not.toMatch(/12\/10\/2026/)
    expect(r.texto).toMatch(/acumulad.*última leitura/)
  })
  it('acumulado: semana com dia vazio no fim fica com a última linha MEDIDA', async () => {
    dobra('canal', modeloSerie(serie(401, (i) => i !== 0, false, 'ultima')))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).toMatch(/12\/10\/2026.*1001/)
    expect(r.texto).not.toContain('SEM_LEITURA')
  })
  it('ganho diário: semana completa (7 de 7 medidos) soma os 7 dias; a regra vem no cabeçalho', async () => {
    dobra('canal', modeloSerie(serie(401, () => true, false, 'soma')))
    const r = await responder({ ...SERIE, grao: 'semana', de: '2026-10-05', ate: '2026-10-11' }, abrir, AGORA)
    // 05/10 a 11/10 = dias 8..2 antes de 13/10: valores 1002..1008, soma 7035
    expect(linhasDaSerie(r.texto).length).toBe(1)
    expect(r.texto).toContain('7035')
    expect(r.texto).toMatch(/soma dos 7 dias.*só quando os 7 estão medidos/)
  })
  it('ganho diário: semana com 1 dia sem medida sai "não medido" com 6 de 7, nunca zero nem soma parcial', async () => {
    dobra('canal', modeloSerie(serie(401, (i) => i !== 5, false, 'soma')))
    const r = await responder({ ...SERIE, grao: 'semana', de: '2026-10-05', ate: '2026-10-11' }, abrir, AGORA)
    expect(r.texto).toMatch(/6 de 7 dias medidos/)
    expect(r.texto).not.toContain('7035')
    expect(r.texto).not.toMatch(/\|\s*0\s*\|/)
  })
  it('ganho diário: semana parcial na borda (2 dias) é "não medido" com 2 de 7', async () => {
    dobra('canal', modeloSerie(serie(401, () => true, false, 'soma')))
    const r = await responder({ ...SERIE, grao: 'semana', de: '2026-10-12', ate: '2026-10-13' }, abrir, AGORA)
    expect(r.texto).toMatch(/2 de 7 dias medidos/)
    expect(r.texto).not.toMatch(/\b2001\b/)
  })
  it('tipo não declarado: a semana sai "não medido" (opção mínima), com os dias medidos', async () => {
    dobra('canal', modeloSerie(serie(401)))
    const r = await responder({ ...SERIE, grao: 'semana', de: '2026-10-05', ate: '2026-10-11' }, abrir, AGORA)
    expect(r.texto).toMatch(/7 de 7 dias medidos/)
    expect(r.texto).toMatch(/tipo.*não declarado/)
    expect(r.texto).not.toContain('7035')
    expect(r.texto).not.toMatch(/\b100\d\b/)
  })
  it('ainda mais de 400 pontos no grão semana: os 400 mais recentes, e diz', async () => {
    dobra('canal', modeloSerie(serie(3000, () => true, false, 'ultima')))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).toMatch(/ainda são \d+ pontos no grão semana; ficam os 400 mais recentes/)
    expect(linhasDaSerie(r.texto).length).toBe(400)
    expect(r.texto).toMatch(/13\/10\/2026/)
  })
  it('intervalo de..ate: só os dias dentro entram (ignorar `de` ou `ate` derruba)', async () => {
    dobra('canal', modeloSerie(serie(60)))
    const r = await responder({ ...SERIE, de: '2026-10-01', ate: '2026-10-05' }, abrir, AGORA)
    const ls = linhasDaSerie(r.texto)
    expect(ls.length).toBe(5)
    expect(ls.every((l) => /0[1-5]\/10\/2026/.test(l))).toBe(true)
  })
  it('intervalo fora do que a tela traz: diz o período que a tela cobre, sem tabela vazia calada', async () => {
    dobra('canal', modeloSerie(serie(10)))
    const r = await responder({ ...SERIE, de: '2020-01-01', ate: '2020-01-31' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toMatch(/nenhum ponto entre 01\/01\/2020 e 31\/01\/2020; a tela cobre de 04\/10\/2026 a 13\/10\/2026/)
    expect(linhasDaSerie(r.texto)).toHaveLength(0)
  })
  it('tela de vídeo sem série dia a dia: diz que a tela não traz', async () => {
    dobra('video', { ...modeloCheio(), tela: 'video', tabelas: modeloCheio().tabelas.filter((t) => t.tipo !== 'dia_a_dia') })
    const r = await responder({ acao: 'serie', video_id: V1, de: '2000-01-01', ate: '2026-10-13' }, abrir, AGORA)
    expect(r.texto).toContain('esta tela não traz série dia a dia')
  })
  it('canal sem dia_a_dia e com a tabela de raias "não carregou": o motivo fica e a frase não diz "não traz série" (I-2)', async () => {
    const raias: Tabela = {
      id: 'raias', titulo: 'RAIAS_DO_CANAL', tipo: 'fixa', nomeNoCorte: 'raias', privada: false, colunas: ['Raia', 'Views'],
      linhas: [[rotulo('Longos', 'p.r[0].n'), { papel: 'numero', estado: 'falhou', motivo: 'NAO_CARREGOU_MOTIVO', origem: 'p.r[0].v' }]],
    }
    dobra('canal', { ...modeloCheio(), tela: 'canal', tabelas: [raias] })
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain('NAO_CARREGOU_MOTIVO')
    expect(r.texto).not.toContain('não traz série')
    expect(r.texto).toContain('a série dia a dia não veio nesta leitura')
  })
  it('canal próprio com privado excluído: a frase diz que a série é dado privado (I-2)', async () => {
    dobra('canal-proprio', { ...modeloPrivadoExcluido(), tela: 'canal-proprio', tabelas: [] })
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).toContain('é dado privado e não foi incluída')
    expect(r.texto).not.toContain('não traz série')
  })
  it('linha sem data reconhecível fica fora e é dita (não chuta)', async () => {
    const t = serie(5)
    t.linhas.push([rotulo('semana passada', 'p.s[x].dia'), medido('9', 9, 'p.s[x].v')])
    dobra('canal', modeloSerie(t))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).toMatch(/1 linha sem data reconhecível ficaram fora/)
    expect(linhasDaSerie(r.texto)).toHaveLength(5)
  })
  it('só entram as tabelas dia a dia: lista e fixa saem, bloco citado também', async () => {
    const modelo = modeloSerie(serie(5))
    modelo.tabelas.push(...modeloCheio().tabelas.filter((t) => t.tipo !== 'dia_a_dia'))
    modelo.citados = [{ rotulo: 'bloco', texto: 'TEXTO_CITADO', origem: 'p.c' }]
    dobra('canal', modelo)
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.texto).not.toContain('TEXTO_CITADO')
    expect(r.texto).not.toContain('Direção de cada canal')
  })
  it('serie de vídeo usa video?: tenta video e depois video-proprio', async () => {
    dobra('video-proprio', modeloSerie(serie(5), 'video-proprio'))
    const r = await responder({ acao: 'serie', video_id: V1, de: '2026-10-01', ate: '2026-10-13' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(m.empacotar.video).toHaveBeenCalledTimes(1)
    expect(m.empacotar['video-proprio']).toHaveBeenCalledTimes(1)
  })
  it('série privada: com o privado incluído a tabela privada fica e incluiuPrivado é verdadeiro; sem tabela privada, o privado cai para "na"', async () => {
    const privada: PacoteModelo = { ...modeloSerie(serie(5, () => true, true), 'canal-proprio'), privado: { estado: 'incluido', itens: 'views por dia' } }
    dobra('canal-proprio', privada)
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.incluiuPrivado).toBe(true)
    // o modelo cheio do privado, mas a série pedida é só pública: não há como o privado ficar "incluído" sem tabela dele
    const pub = { ...modeloPrivadoIncluido(), tabelas: [serie(5)] }
    pub.tabelas = [...pub.tabelas]
    dobra('canal', { ...pub, privado: { estado: 'incluido', itens: 'x' }, tabelas: [serie(5), { ...serie(1), id: 'p', privada: true }] })
    const r2 = await responder(SERIE, abrir, AGORA)
    expect(r2.desfecho).toBe('ok')
  })
})

/* ------------------------------------------------------------------ ausência */

describe('responder: o que não existe', () => {
  it('EMPACOTAR devolve null: "não encontrado", a mesma resposta para id inexistente e de outro site', async () => {
    dobra('canal', null)
    dobra('canal-proprio', null)
    const a = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    const b = await responder({ acao: 'canal', canal_id: C2 }, abrir, AGORA)
    expect(a.desfecho).toBe('nao_encontrado')
    expect(a.texto).toBe(FRASES_DA_FERRAMENTA.nao_encontrado)
    expect(b.texto).toBe(a.texto)
    expect(b.incluiuPrivado).toBe(false)
  })
  it('"não encontrado" não leva o topo de semEquivalente (idêntico, letra por letra)', async () => {
    dobra('canal', null)
    dobra('canal-proprio', null)
    const a = await responder({ acao: 'canal', canal_id: C1, janela: '30' }, abrir, AGORA)
    expect(a.texto).toBe(FRASES_DA_FERRAMENTA.nao_encontrado)
  })
  it("'canal?' resolve para canal-proprio quando canal devolve null; as duas null: não encontrado", async () => {
    dobra('canal', null)
    dobra('canal-proprio', comTela(modeloCheio(), 'canal-proprio'))
    const r = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(m.empacotar.canal).toHaveBeenCalledTimes(1)
    expect(m.empacotar['canal-proprio']).toHaveBeenCalledTimes(1)
    dobra('canal-proprio', null)
    expect((await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)).desfecho).toBe('nao_encontrado')
  })
  it("'canal?' com pacote em canal não consulta a própria", async () => {
    dobra('canal', comTela(modeloCheio(), 'canal'))
    await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(m.empacotar['canal-proprio']).not.toHaveBeenCalled()
  })
  it('site sem canais: a primeira linha do texto é a frase do vazio', async () => {
    dobra('canais', modeloVazio())
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto.split('\n')[0]).toContain('nenhum canal acompanhado ainda')
  })
  it('vazio com topo: o topo vem depois da frase do vazio', async () => {
    dobra('canais', modeloVazio())
    const r = await responder({ acao: 'listar_canais', janela: '30' }, abrir, AGORA)
    const l = r.texto.split('\n')
    expect(l[0]).toContain('nenhum canal acompanhado ainda')
    expect(r.texto).toContain('Não aplicado: janela 30')
  })
  it('pacote todo "não medido": toda célula sai com o motivo, nenhuma vira 0 nem some', async () => {
    const t: Tabela = {
      id: 'medidas', titulo: 'Medidas', tipo: 'fixa', nomeNoCorte: 'tabela de medidas', privada: false, colunas: ['Medida', 'Valor'],
      linhas: Array.from({ length: 12 }, (_, i) => [rotulo(`Medida ${i + 1}`, `p.m[${i}].n`), naoMedido(`MOTIVO_${i + 1}`, `p.m[${i}].v`)]),
    }
    dobra('canais', { ...comTela(modeloCheio(), 'canais'), tabelas: [t] })
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    for (let i = 1; i <= 12; i++) expect(r.texto).toContain(`MOTIVO_${i}`)
    expect(r.texto.split('\n').filter((l) => l.includes('Medida ') && l.includes('|')).filter((l) => /MOTIVO_/.test(l))).toHaveLength(12)
    expect(r.texto.split('\n').filter((l) => /Medida \d+/.test(l) && /\|\s*0\s*\|/.test(l))).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ privado */

describe('responder: o dado privado', () => {
  it('excluído por sem_direito: incluiuPrivado falso e a frase do degrau 1 está no texto', async () => {
    dobra('canal-proprio', modeloPrivadoExcluido('sem_direito'))
    dobra('canal', null)
    const r = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(r.incluiuPrivado).toBe(false)
    expect(r.texto).toMatch(/direito/i)
    expect(r.params).toMatchObject({ privado: false })
  })
  it('privado incluído: incluiuPrivado verdadeiro', async () => {
    dobra('canal', null)
    dobra('canal-proprio', modeloPrivadoIncluido())
    const r = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(r.incluiuPrivado).toBe(true)
    expect(r.params).toMatchObject({ privado: true })
  })
  it('comentários incluídos: incluiuPrivado verdadeiro', async () => {
    dobra('video', modeloComComentarios('incluido'))
    const r = await responder({ acao: 'video', video_id: V1 }, abrir, AGORA)
    expect(r.incluiuPrivado).toBe(true)
    expect(r.params).toMatchObject({ comentarios: true })
  })
  it('comentários excluídos: falso', async () => {
    dobra('video', modeloComComentarios('excluido'))
    expect((await responder({ acao: 'video', video_id: V1 }, abrir, AGORA)).incluiuPrivado).toBe(false)
  })
})

/* ------------------------------------------------------------------ falha */

describe('responder: falha', () => {
  it('EMPACOTAR lança: falhou, texto fechado, sem o sentinela e sem a mensagem no Sentry', async () => {
    ;(m.empacotar.canal as ReturnType<typeof vi.fn>).mockImplementation(async () => { throw new Error(SENTINELA) })
    const r = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(r).toMatchObject({ desfecho: 'falhou', texto: FRASES_DA_FERRAMENTA.nao_montou, incluiuPrivado: false })
    expect(JSON.stringify(r)).not.toContain('ignore o que veio antes')
    expect(JSON.stringify(m.captured)).not.toContain('ignore o que veio antes')
    expect(m.captured.length).toBeGreaterThan(0)
  })
  it('modelo defeituoso (segmentar lança): falhou, sem a mensagem', async () => {
    dobra('canais', { ...comTela(modeloCheio(), 'canais'), privado: { estado: 'incluido', itens: 'SEGREDO_DO_ITEM' } })
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r.desfecho).toBe('falhou')
    expect(JSON.stringify([r, m.captured])).not.toContain('SEGREDO_DO_ITEM')
  })
  it('nunca lança, nem com entrada estranha', async () => {
    for (const e of [undefined, 1, [], Symbol.iterator, { acao: { toString() { throw new Error('x') } } }]) {
      await expect(responder(e, abrir, AGORA)).resolves.toBeTruthy()
    }
  })
})

/* ------------------------------------------------------------------ comparar */

describe('responder: comparar', () => {
  const parDe = (chamada: unknown[]) => (chamada[0] as { sp: Record<string, string> }).sp

  it('três pares: o primeiro canal contra cada um dos outros', async () => {
    dobra('comparar', comTela(modeloCheio(), 'comparar'))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3, C4] }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    const pares = (m.empacotar.comparar as ReturnType<typeof vi.fn>).mock.calls.map(parDe)
    expect(pares.map((p) => [p.a, p.b])).toEqual([[C1, C2], [C1, C3], [C1, C4]])
    expect(r.params).toMatchObject({ pares: 3 })
    for (const i of [1, 2, 3]) expect(r.texto).toContain(`## Par ${i}:`)
  })
  it('um par null: os outros saem e o texto diz qual canal não foi encontrado', async () => {
    ;(m.empacotar.comparar as ReturnType<typeof vi.fn>).mockImplementation(async ({ sp }: { sp: Record<string, string> }) => (sp.b === C3 ? null : pacote(comTela(modeloCheio(), 'comparar'))))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3, C4] }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.texto).toContain(`Canal ${C3}: não encontrado`)
    expect(r.texto.split('## Par ')).toHaveLength(4)
    expect(r.texto).not.toContain(`Canal ${C2}: não encontrado`)
  })
  it('todos os pares null: não encontrado, a frase fechada', async () => {
    dobra('comparar', null)
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    expect(r.desfecho).toBe('nao_encontrado')
    expect(r.texto).toContain(FRASES_DA_FERRAMENTA.nao_encontrado)
    expect(r.texto).toContain(C2)
    expect(r.texto).toContain(C3)
  })
  it('o teto é dividido entre os pares', async () => {
    dobra('comparar', grande(500_000))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3, C4] }, abrir, AGORA)
    expect(r.texto.length).toBeLessThanOrEqual(60_000)
    const blocos = r.texto.split('## Par ').slice(1)
    expect(blocos).toHaveLength(3)
    for (const b of blocos) expect(b.length).toBeLessThanOrEqual(Math.floor(60_000 / 3))
  })
})

/* ------------------------------------------------------------------ tamanho */

describe('responder: A1c, comparar registra os cortes e não repete o lado A', () => {
  const tab = (id: string, linhas = 2): Tabela => ({
    id, titulo: `T ${id}`, tipo: 'fixa', nomeNoCorte: `tabela ${id}`, privada: false, colunas: ['Item', 'Valor'],
    linhas: Array.from({ length: linhas }, (_, i) => [rotulo(`Item ${i}`, `p.${id}[${i}].n`), base(`valor ${id} ${i}`, `p.${id}[${i}].v`)]),
  })
  it('pacote que estoura o teto: params.cortes > 0 (antes gravava 0)', async () => {
    dobra('comparar', grande(500_000))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    expect(r.params.cortes).toBeGreaterThan(0)
  })
  it('pacote que cabe: cortes 0', async () => {
    dobra('comparar', comTela(modeloCheio(), 'comparar'))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    expect(r.params.cortes).toBe(0)
  })
  it('as tabelas só do lado A saem no 2º par em diante', async () => {
    dobra('comparar', { ...comTela(modeloCheio(), 'comparar'), tabelas: [tab('numero-a-numero'), tab('privado-alcance-a'), tab('direcao-notas-a'), tab('direcao-sentido-a'), tab('direcao-notas-b')] })
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    const [p1, p2] = r.texto.split('## Par ').slice(1)
    expect(p1).toContain('valor privado-alcance-a 0')
    expect(p2).not.toContain('valor privado-alcance-a 0')
    expect(p2).not.toContain('valor direcao-notas-a 0')
    expect(p2).not.toContain('valor direcao-sentido-a 0')
    expect(p2).toContain('valor numero-a-numero 0')
    expect(p2).toContain('valor direcao-notas-b 0')
  })
})

describe('responder: A1c, revisão do Yannis', () => {
  const tab = (id: string, titulo = `T ${id}`): Tabela => ({
    id, titulo, tipo: 'fixa', nomeNoCorte: `tabela ${id}`, privada: false, colunas: ['Item', 'Valor'],
    linhas: [[rotulo('Item', `p.${id}.n`), base(`valor ${id} 0`, `p.${id}.v`)]],
  })
  const cmp = m.empacotar
  it('I-2: o 1º id inválido (lado a): a frase nomeia o a, não os b', async () => {
    ;(cmp.comparar as ReturnType<typeof vi.fn>).mockImplementation(async (p: { faltou?: { lado?: string } }) => { if (p.faltou) p.faltou.lado = 'a'; return null })
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    expect(r.desfecho).toBe('nao_encontrado')
    expect(r.texto).toContain(C1)
    expect(r.texto).not.toContain(C2)
    expect(r.texto).not.toContain(C3)
  })
  it('I-2: proprio sem canal próprio com vídeo: frase específica', async () => {
    ;(cmp.comparar as ReturnType<typeof vi.fn>).mockImplementation(async (p: { faltou?: { lado?: string } }) => { if (p.faltou) p.faltou.lado = 'proprio'; return null })
    const r = await responder({ acao: 'comparar', canal_ids: ['proprio', C2, C3] }, abrir, AGORA)
    expect(r.desfecho).toBe('nao_encontrado')
    expect(r.texto).toContain('não há canal próprio com vídeo neste site')
    expect(r.texto).not.toContain(C2)
  })
  it('I-3: Par 1 nulo: o lado A sai inteiro no 1º par montado', async () => {
    ;(cmp.comparar as ReturnType<typeof vi.fn>).mockImplementation(async ({ sp }: { sp: Record<string, string> }) => (sp.b === C2 ? null : pacote({ ...comTela(modeloCheio(), 'comparar'), tabelas: [tab('numero-a-numero'), tab('privado-alcance-a')] })))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    const [, p2] = r.texto.split('## Par ').slice(1)
    expect(p2).toContain('valor privado-alcance-a 0')
    expect(p2).not.toContain('não se repete aqui')
  })
  it('I-3: o aviso diz de qual par o lado A é', async () => {
    ;(cmp.comparar as ReturnType<typeof vi.fn>).mockImplementation(async ({ sp }: { sp: Record<string, string> }) => (sp.b === C2 ? null : pacote(comTela(modeloCheio(), 'comparar'))))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3, C4] }, abrir, AGORA)
    expect(r.texto).toContain('O lado A é o mesmo do Par 2 e não se repete aqui.')
  })
  it('M-1: com proprio o cabeçalho não fica sem nome do lado A', async () => {
    dobra('comparar', comTela(modeloCheio(), 'comparar'))
    const r = await responder({ acao: 'comparar', canal_ids: ['proprio', C2] }, abrir, AGORA)
    expect(r.texto).not.toContain('canal  contra')
    expect(r.texto).toContain('## Par 1: canal próprio contra canal')
  })
  it('M-2: a nota órfã do alcance sai junto com a tabela de alcance do lado A', async () => {
    dobra('comparar', { ...comTela(modeloCheio(), 'comparar'), tabelas: [tab('numero-a-numero'), tab('privado-alcance-a'), tab('privado-alcance-a-notas'), tab('privado-alcance-b-notas')] })
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    const [, p2] = r.texto.split('## Par ').slice(1)
    expect(p2).not.toContain('valor privado-alcance-a-notas 0')
    expect(p2).toContain('valor privado-alcance-b-notas 0')
  })
  it('M-3: piso estourado junto com tabela cortada: conta o fim cortado também', async () => {
    const g = grande(500_000)
    const modelo = { ...g, tela: 'comparar' as TelaId, avisos: ['y'.repeat(70_000)] }
    dobra('comparar', modelo)
    const cab = `## Par 1: canal ${C1} contra canal ${C2}\n`
    const t = montarTexto(segmentar(modelo, { geradoEm: AGORA, recente: RECENTE }), '', 59_999 - cab.length, 'todos', undefined, { ia: true })
    expect(t.pisoPassou).toBe(true)
    expect(t.cortes.length).toBeGreaterThan(0)
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2] }, abrir, AGORA)
    expect(r.params.cortes).toBe(t.cortes.length + 1)
  })
})

/** Um pacote de uns 500.000 caracteres: lista de linhas longas. */
function grande(alvo: number): PacoteModelo {
  const linhas = Math.ceil(alvo / 100)
  const t: Tabela = {
    id: 'grande', titulo: 'Lista grande', tipo: 'lista', nomeNoCorte: 'tabela grande', privada: false, colunas: ['Item', 'Valor'],
    linhas: Array.from({ length: linhas }, (_, i) => [terceiros(`Item ${i + 1} ${'x'.repeat(60)}`, `p.g[${i}].n`), medido(`${i + 1}`, i + 1, `p.g[${i}].v`)]),
  }
  return { ...comTela(modeloCheio(), 'canal'), tabelas: [t], definicoes: [{ medida: 'Mediana', frase: 'o valor do meio', limiares: [] }], avisos: [base('x', 'x').texto] }
}

describe('responder: o tamanho', () => {
  it('nenhuma resposta passa de 60.000 caracteres; pacote_da_tela, de 30.000 (fixture de 500.000)', async () => {
    const g = grande(500_000)
    expect(esperado(g, 10_000_000).length).toBeGreaterThan(6 * ACESSO_IA_RULES.tetoPorAcao) // sem o bloco JSON (modo ia) o pacote de 500.000 tem ~409.000
    dobra('canal', g)
    const a = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(a.texto.length).toBeLessThanOrEqual(60_000)
    expect(a.texto.length).toBeGreaterThan(1_000)
    dobra('canais', { ...g, tela: 'canais' })
    const b = await responder({ acao: 'pacote_da_tela', tela: 'canais' }, abrir, AGORA)
    expect(b.texto.length).toBeLessThanOrEqual(30_000)
    expect(b.texto.length).toBeGreaterThan(1_000)
  })
  it('com o topo e a frase do fim, ainda cabe no teto', async () => {
    dobra('canal', { ...grande(500_000), tela: 'canal' })
    const r = await responder({ acao: 'canal', canal_id: C1, janela: '30' }, abrir, AGORA)
    expect(r.texto).toContain('Não aplicado: janela 30')
    expect(r.texto.length).toBeLessThanOrEqual(60_000)
  })
})

describe('responder: o rótulo dd/mm da série que os empacotadores emitem é lido (M-1 do Yannis)', () => {
  it('toda linha de uma tabela dia_a_dia com rótulo dd/mm tem data', async () => {
    const { diaDaLinha } = await import('@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder')
    const dm = (d: Date): string => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`
    const fim = Date.UTC(2026, 9, 13)
    const t = serie(90)
    t.linhas = t.linhas.map((l, i) => [rotulo(dm(new Date(fim - i * 86_400_000)), `p.s[${i}].dia`), l[1]!])
    const datas = t.linhas.map((l) => diaDaLinha(l, AGORA))
    expect(datas.filter((d) => d === null)).toHaveLength(0)
    expect(datas[0]).toBe('2026-10-13')
  })
})

/* ------------------------------------------------------------------ A7d T4: a Cobertura em toda resposta ok */

const U1 = 'c0000001-0000-4000-8000-000000000001'
const U2 = 'c0000002-0000-4000-8000-000000000002'
const U3 = 'c0000003-0000-4000-8000-000000000003'
const falhou = (origem: string): Celula => ({ papel: 'numero', estado: 'falhou', motivo: 'leitura falhou', origem })
const secaoDe = (texto: string): string => texto.slice(texto.lastIndexOf('\n## Cobertura') + 1)
const chamadasDe = (texto: string): Array<Record<string, unknown>> =>
  secaoDe(texto).split('\n').filter((l) => l.startsWith('- {')).map((l) => JSON.parse(l.slice(2, l.lastIndexOf('} :') + 1)) as Record<string, unknown>)

/** Canais com a coluna Id; `privado` põe a tabela do canal próprio. */
function canaisComId(linhas = 3, privado = false): PacoteModelo {
  const ids = [U1, U2, U3]
  const tab = (id: string): Tabela => ({
    id, titulo: 'Os canais acompanhados', tipo: 'lista', nomeNoCorte: 'tabela de canais', privada: id.startsWith('privado-'), colunas: ['Canal', 'Id', 'Inscritos'],
    linhas: Array.from({ length: linhas }, (_, i) => [terceiros(`Canal ${i + 1}`, `p.c[${i}].n`), base(ids[i] ?? `c000${i}-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`, `p.c[${i}].id`), medido(`${i + 1}`, i + 1, `p.c[${i}].v`)]),
  })
  return { ...comTela(modeloCheio(), 'canais'), tabelas: privado ? [tab('canais'), tab('privado-canais')] : [tab('canais')], ...(privado ? { privado: { estado: 'incluido' as const, itens: 'views por dia do canal' } } : {}) }
}

describe('A7d T4: toda resposta ok termina na Cobertura', () => {
  const casos: Array<[string, Record<string, unknown>, TelaId[]]> = [
    ['listar_canais', { acao: 'listar_canais' }, ['canais']],
    ['canal', { acao: 'canal', canal_id: C1 }, ['canal']],
    ['video', { acao: 'video', video_id: V1 }, ['video']],
    ['destaques', { acao: 'destaques' }, ['outliers']],
    ['mudancas', { acao: 'mudancas' }, ['mudancas']],
    ['sugestoes', { acao: 'sugestoes' }, ['sugestoes']],
    ['pacote_da_tela', { acao: 'pacote_da_tela', tela: 'insights' }, ['insights']],
    ['serie', SERIE, ['canal']],
    ['comparar', { acao: 'comparar', canal_ids: [C1, C2] }, ['comparar']],
    ['definicoes', { acao: 'definicoes' }, ['canais', 'comparar', 'outliers', 'insights', 'mudancas']],
  ]
  it.each(casos)('(1) %s: a última seção é a Cobertura e fecha o texto', async (_n, entrada, telas) => {
    for (const t of telas) dobra(t, t === 'canal' && entrada.acao === 'serie' ? modeloSerie(serie(10)) : comTela(modeloCheio(), t))
    const r = await responder(entrada, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    const i = r.texto.lastIndexOf('\n## Cobertura')
    expect(i).toBeGreaterThan(0)
    const secao = r.texto.slice(i + 1)
    expect(secao).not.toMatch(/\n## /)
    expect(r.texto.endsWith(secao.split('\n').at(-1)!)).toBe(true)
    expect(typeof r.params.completa).toBe('boolean')
    expect(typeof r.params.ms).toBe('number')
  })
  it('(1) pedido_invalido, nao_encontrado e falhou NÃO têm a seção', async () => {
    expect((await responder({ acao: 'apagar' }, abrir, AGORA)).texto).not.toContain('## Cobertura')
    expect((await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)).texto).not.toContain('## Cobertura')
    m.empacotar.canais = vi.fn(async () => { throw new Error('x') })
    const f = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(f.desfecho).toBe('falhou')
    expect(f.texto).not.toContain('## Cobertura')
  })
  it('(7) pacote_da_tela, sugestoes e definicoes terminam na seção sem linha de lista', async () => {
    dobra('insights', comTela(modeloCheio(), 'insights'))
    dobra('sugestoes', comTela(modeloCheio(), 'sugestoes'))
    for (const e of [{ acao: 'pacote_da_tela', tela: 'insights' }, { acao: 'sugestoes' }]) {
      const r = await responder(e, abrir, AGORA)
      expect(secaoDe(r.texto)).not.toContain('Lista principal')
      expect(secaoDe(r.texto)).toContain('Números nesta resposta:')
    }
  })
})

describe('A7d T4: as próximas chamadas', () => {
  it('(2) listar_canais aponta o Id das linhas 1 e 2, com o valor da fixture; sem canal próprio, comparar leva só os dois', async () => {
    dobra('canais', canaisComId(3))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    const cs = chamadasDe(r.texto)
    expect(cs).toContainEqual({ acao: 'canal', canal_id: U1 })
    expect(cs).toContainEqual({ acao: 'comparar', canal_ids: [U1, U2] })
    for (const id of [U1, U2]) expect(r.texto.split('\n').some((l) => l.startsWith('| ') && l.includes(id))).toBe(true)
  })
  it('(2) com o canal próprio na resposta, comparar começa por proprio; sem ele, `proprio` nunca sai', async () => {
    dobra('canais', canaisComId(3, true))
    expect(chamadasDe((await responder({ acao: 'listar_canais' }, abrir, AGORA)).texto)).toContainEqual({ acao: 'comparar', canal_ids: ['proprio', U1, U2] })
    dobra('canais', canaisComId(3, false))
    expect(JSON.stringify(chamadasDe((await responder({ acao: 'listar_canais' }, abrir, AGORA)).texto))).not.toContain('proprio')
  })
  it('(2) uma por ação: canal, video, destaques, mudancas, serie e comparar', async () => {
    dobra('canal', comTela(modeloCheio(), 'canal'))
    const hoje = '2026-10-13'
    expect(chamadasDe((await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)).texto)).toEqual([{ acao: 'serie', canal_id: C1, de: '2026-07-16', ate: hoje }])
    dobra('video', comTela(modeloCheio(), 'video'))
    expect(chamadasDe((await responder({ acao: 'video', video_id: V1 }, abrir, AGORA)).texto)).toEqual([{ acao: 'serie', video_id: V1, de: '2026-07-16', ate: hoje }])
    dobra('outliers', comTela(modeloCheio(), 'outliers'))
    expect(chamadasDe((await responder({ acao: 'destaques', janela: '30', formato: 'shorts' }, abrir, AGORA)).texto)).toEqual([{ acao: 'destaques', janela: 'todas', formato: 'shorts' }])
    expect(chamadasDe((await responder({ acao: 'destaques', janela: 'todas' }, abrir, AGORA)).texto)).toEqual([])
    dobra('mudancas', comTela(modeloCheio(), 'mudancas'))
    expect(chamadasDe((await responder({ acao: 'mudancas', janela: '7' }, abrir, AGORA)).texto)).toEqual([{ acao: 'mudancas', janela: '90' }])
    expect(chamadasDe((await responder({ acao: 'mudancas', janela: '90' }, abrir, AGORA)).texto)).toEqual([])
    dobra('comparar', { ...grande(300_000), tela: 'comparar' })
    expect(chamadasDe((await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)).texto)[0]).toEqual({ acao: 'comparar', canal_ids: [C1, C2] })
  })
  it('(2) serie que passou ao grão semana por tamanho oferece o grão dia dos últimos 400 dias', async () => {
    dobra('canal', modeloSerie(serie(450)))
    const r = await responder({ ...SERIE, grao: undefined }, abrir, AGORA)
    expect(chamadasDe(r.texto)).toEqual([{ acao: 'serie', canal_id: C1, de: '2025-09-09', ate: '2026-10-13', grao: 'dia' }])
    expect(r.params.completa).toBe(false)
    expect(secaoDe(r.texto)).toContain('Você viu só uma parte')
  })
  it('(3) toda chamada sugerida passa por ENTRADA e traduzir; a que falha cai e avisa proxima_invalida', async () => {
    dobra('canais', canaisComId(3, true))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(chamadasDe(r.texto).length).toBeGreaterThan(0)
    for (const c of chamadasDe(r.texto)) {
      const l = ENTRADA.safeParse(c)
      expect(l.success).toBe(true)
      if (l.success) expect(traduzir(l.data).ok).toBe(true)
    }
    const real = ENTRADA.safeParse.bind(ENTRADA)
    let n = 0
    const espiao = vi.spyOn(ENTRADA, 'safeParse').mockImplementation((v: unknown) => (n++ === 0 ? real(v) : ({ success: false } as never)))
    m.captured.length = 0
    const f = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    espiao.mockRestore()
    expect(chamadasDe(f.texto)).toEqual([])
    expect(f.texto).not.toContain('Próximas chamadas')
    expect(JSON.stringify(m.captured)).toContain('proxima_invalida')
  })
})

describe('A7d T4: números, tamanho e registro', () => {
  afterEach(() => { vi.useRealTimers() })
  it('(4) numerosNoTexto: falhou só nas linhas cortadas não conta; falhou numa tabela de texto cortada não conta', async () => {
    const principal: Tabela = {
      id: 'canais', titulo: 'Os canais acompanhados', tipo: 'lista', nomeNoCorte: 'tabela de canais', privada: false, colunas: ['Canal', 'Valor'],
      linhas: Array.from({ length: 300 }, (_, i) => [terceiros(`C${i}`, `p.c[${i}].n`), i < 200 ? medido(`${i}`, i, `p.c[${i}].v`) : falhou(`p.c[${i}].v`)]),
    }
    dobra('canais', { ...comTela(modeloCheio(), 'canais'), tabelas: [principal] })
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r.params.linhas).toBe(200)
    expect(secaoDe(r.texto)).toContain('0 falharam')
    expect(secaoDe(r.texto)).toContain('Você viu só uma parte')
    const dicas: Tabela = {
      id: 'canais-dicas', titulo: 'A dica de cada medida', tipo: 'lista', nomeNoCorte: 'tabela das dicas', privada: false, colunas: ['Canal', 'Dica'],
      linhas: Array.from({ length: 300 }, (_, i) => [terceiros(`C${i}`, `p.d[${i}].n`), i < 290 ? medido(`${i}`, i, `p.d[${i}].v`) : falhou(`p.d[${i}].v`)]),
    }
    dobra('canais', { ...comTela(modeloCheio(), 'canais'), tabelas: [{ ...principal, linhas: principal.linhas.slice(0, 5) }, dicas] })
    const r2 = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(r2.params.cortes).toBeGreaterThan(0)
    expect(secaoDe(r2.texto)).toContain('0 falharam')
    // as dicas ficam fora de toda janela de lista; a Cobertura diz quantas linhas elas têm (sem dona na principal, todas vêm contadas na janela 1)
    expect(secaoDe(r2.texto)).toContain('Notas e dicas: 0 de 300 linhas')
  })
  it('(5) o pior caso fica no teto; completa, ms e fora_do_pacote gravados; ms vem do relógio', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA)
    ;(m.empacotar.canal as ReturnType<typeof vi.fn>).mockImplementation(async () => { vi.advanceTimersByTime(123); return pacote({ ...grande(500_000), tela: 'canal' }) })
    const a = await responder({ acao: 'canal', canal_id: C1 }, abrir, AGORA)
    expect(a.texto.length).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoPorAcao)
    expect(a.params.completa).toBe(false)
    expect(a.params.ms).toBe(123)
    expect(a.params).not.toHaveProperty('fora_do_pacote')
    ;(m.empacotar.outliers as ReturnType<typeof vi.fn>).mockImplementation(async () => pacote({ ...comTela(modeloCheio(), 'outliers'), paginado: { mostrados: 12, total: 40 } }))
    const b = await responder({ acao: 'destaques' }, abrir, AGORA)
    expect(b.params.fora_do_pacote).toBe(28)
  })
  it('(7) Destaques com grupo paginado: completa falso e a linha vem do número do modelo, não da frase pageNote', async () => {
    const nota = (frase: string): Tabela => ({ id: 'grupos-notas', titulo: 'Notas dos grupos', tipo: 'fixa', nomeNoCorte: 'tabela de notas', privada: false, colunas: ['Grupo', 'Nota'], linhas: [[rotulo('Grupo A', 'p.g.l'), base(frase, 'p.g.pageNote')]] })
    const linhas: string[] = []
    for (const frase of ['Mostrando 12 de 40 deste grupo.', 'Uma frase qualquer que não diz número nenhum.']) {
      dobra('outliers', { ...comTela(modeloCheio(), 'outliers'), tabelas: [nota(frase)], paginado: { mostrados: 12, total: 40 } })
      const r = await responder({ acao: 'destaques' }, abrir, AGORA)
      expect(r.params.completa).toBe(false)
      linhas.push(secaoDe(r.texto).split('\n').find((l) => l.includes('A tela mostra'))!)
    }
    expect(linhas[0]).toContain('A tela mostra 12 de 40 outliers')
    expect(linhas[1]).toBe(linhas[0])
  })
})

/* ------------------------------------------------------------------ A7 Fatia 2, conserto do parecer (I1, I2, M1, M2, M3, M7), sempre pelo responder */

describe('A7d Fatia 2 conserto: I1, comparar com par não encontrado', () => {
  it('I1: comparar [C1, C2, C3] com o 2º par ausente: completa falso, "Pares sem dado: 1 de 2" e a frase de parte', async () => {
    ;(m.empacotar.comparar as ReturnType<typeof vi.fn>).mockImplementation(async ({ sp }: { sp: Record<string, string> }) => (sp.b === C3 ? null : pacote(comTela(modeloCheio(), 'comparar'))))
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2, C3] }, abrir, AGORA)
    expect(r.desfecho).toBe('ok')
    expect(r.params.completa).toBe(false)
    const s = secaoDe(r.texto)
    expect(s).toContain('Pares sem dado: 1 de 2')
    expect(s).toContain('Você viu só uma parte')
    expect(s).not.toContain('Você viu tudo')
  })
})

describe('A7d Fatia 2 conserto: I2, o dado ausente e a linha de apoio', () => {
  it('(a) listar_canais com site sem canais: 0 de 0, frase do vazio, sem próximas, completa falso', async () => {
    dobra('canais', modeloVazio())
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    const s = secaoDe(r.texto)
    expect(s).toContain('0 de 0 linhas')
    expect(s).toContain('A lista está vazia neste recorte')
    expect(s).not.toContain('Próximas chamadas')
    expect(r.params.completa).toBe(false)
  })
  it('(b) serie de um canal sem tabela dia_a_dia: a frase da série que não veio e completa falso', async () => {
    const cheio = comTela(modeloCheio(), 'canal')
    dobra('canal', { ...cheio, tabelas: cheio.tabelas.filter((t) => t.tipo !== 'dia_a_dia') })
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.params.completa).toBe(false)
    expect(secaoDe(r.texto)).toContain('A série não veio neste recorte; ausência não é zero.')
    expect(secaoDe(r.texto)).not.toContain('Você viu tudo')
  })
  it('(c) serie com grão semana pedido e 100 dias: 15 de 15 pontos, grão semana, completa verdadeiro', async () => {
    dobra('canal', modeloSerie(serie(100, () => true, false, 'soma')))
    const r = await responder({ ...SERIE, grao: 'semana' }, abrir, AGORA)
    expect(secaoDe(r.texto)).toContain('Série: 15 de 15 pontos')
    expect(secaoDe(r.texto)).toContain('grão semana')
    expect(r.params.completa).toBe(true)
  })
  it('(e) "Lida às" aparece com lista parcial (200 de 300) e não aparece com a lista inteira', async () => {
    dobra('canais', lista('canais', 300))
    const parcial = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(secaoDe(parcial.texto)).toContain('Lida às 14:32.')
    dobra('canais', lista('canais', 34))
    const inteira = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(secaoDe(inteira.texto)).not.toContain('Lida às')
  })
  it('(f) listar_canais com a tabela privada do canal próprio: a seção cita o dado privado', async () => {
    dobra('canais', canaisComId(3, true))
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(secaoDe(r.texto)).toContain('seu canal está na parte do dado privado')
    dobra('canais', canaisComId(3, false))
    expect(secaoDe((await responder({ acao: 'listar_canais' }, abrir, AGORA)).texto)).not.toContain('dado privado')
  })
})

describe('A7d Fatia 2 conserto: M1, M2, M3', () => {
  it('M1: principal com 0 linhas e vazio nulo: lista 0 de 0, frase do vazio, completa falso', async () => {
    const base0 = canaisComId(0)
    expect(base0.vazio).toBeNull()
    dobra('canais', base0)
    const r = await responder({ acao: 'listar_canais' }, abrir, AGORA)
    expect(secaoDe(r.texto)).toContain('0 de 0 linhas')
    expect(secaoDe(r.texto)).not.toContain('Você viu tudo')
    expect(r.params.completa).toBe(false)
  })
  it('M2: série com 2 de 3 linhas sem data: completa falso e a seção diz quantas ficaram fora', async () => {
    const t = serie(3)
    t.linhas = t.linhas.map((l, i) => (i === 0 ? l : [rotulo('sem data', `p.s[${i}].dia`), l[1]!]))
    dobra('canal', modeloSerie(t))
    const r = await responder(SERIE, abrir, AGORA)
    expect(r.params.completa).toBe(false)
    expect(secaoDe(r.texto)).toContain('Série: 1 de 3 pontos')
    expect(secaoDe(r.texto)).toContain('2 linhas sem data ficaram fora')
    expect(secaoDe(r.texto)).not.toContain('Você viu tudo')
  })
  it('M3: comparar com o fim do texto cortado: "Números" avisa que a contagem é de antes do corte', async () => {
    const modelo = { ...grande(500_000), tela: 'comparar' as TelaId, avisos: ['y'.repeat(70_000)] }
    dobra('comparar', modelo)
    const r = await responder({ acao: 'comparar', canal_ids: [C1, C2] }, abrir, AGORA)
    expect(secaoDe(r.texto)).toContain('(contados antes do corte do fim)')
    dobra('comparar', comTela(modeloCheio(), 'comparar'))
    expect(secaoDe((await responder({ acao: 'comparar', canal_ids: [C1, C2] }, abrir, AGORA)).texto)).not.toContain('contados antes do corte')
  })
})
