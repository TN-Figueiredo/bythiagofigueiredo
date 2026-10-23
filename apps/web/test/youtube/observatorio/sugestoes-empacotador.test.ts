// @vitest-environment node
/**
 * F2 T8: o empacotador da tela `sugestoes` (primeira com leitor próprio). Sem tela para a paridade de componente (a página chega na F3):
 * a prova é o inventário de folhas sobre uma matriz de estados, o que acontece quando o dado não existe, o tamanho com 50 sugestões
 * no máximo, o que NÃO entra, e a guarda (site e cliente vêm da guarda, nunca de parâmetro).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const guarda = vi.hoisted(() => ({ ok: true, siteId: 'site-da-guarda', pedidos: [] as unknown[] }))
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async (a: unknown) => { guarda.pedidos.push(a); return guarda.ok ? { ok: true, user: { id: 'u' } } : { ok: false } }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: guarda.siteId }) }))
const leitura = vi.hoisted(() => ({ lista: null as unknown, chamadas: [] as unknown[][] }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ marca: 'cliente-de-servico' }) }))
vi.mock('@/lib/youtube/observatorio/sinais/leitura', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/sinais/leitura')>()),
  listarSinaisDoNicho: vi.fn(async (...a: unknown[]) => { leitura.chamadas.push(a); return leitura.lista }),
}))

import { empacotarSugestoes, modeloDeSugestoes, INVENTARIO_SUGESTOES, SEM_FOLHA_NA_MATRIZ_SUGESTOES, SUGESTOES_NO_PACOTE, type ModeloSugestoes } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/sugestoes'
import { montarSugestoes } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/montar'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { ignorados, semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import { RODAPE_SUGESTOES } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { CONTEXTO } from './contexto-ia-fixture'

const AGORA = new Date('2026-10-24T15:00:00Z')
const outlier = (i: number) => ({ video_id: `0000000${i % 10}-0000-4000-8000-00000000${String(i).padStart(4, '0')}`, canal_id: `1111111${i % 9}-0000-4000-8000-000000000000`, published_at: '2026-10-20T12:00:00Z', mult_vpd7: 12.34567, mult_tela: 4.5678, vpd7: 123456.78, formato: (i % 2 ? 'short' : 'long') as 'long' | 'short' })
function item(i: number, o: Partial<ItemDeSinal> = {}, nOut = 3): ItemDeSinal {
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'destino', subject_key: `pais:${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
    acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2, acao_gravada: 'video_novo', forca: 12.5 + i, motivo: 'dois canais estouraram no mesmo lugar nos últimos 14 dias',
    rule_version: 'sinais-v1+semente-1', evidence: { outliers: Array.from({ length: nOut }, (_, k) => outlier(k)), outliers_total: nOut + 5, canais: 3, proprios: ['foto'] },
    first_seen_at: '2026-10-20T12:00:00Z', expires_at: '2026-11-19T12:00:00Z',
    proprios_agora: ['bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'], proprios_agora_n: 2, ...o,
  }
}
const lista = (itens: ItemDeSinal[], o: Partial<ListaDeSinais> = {}): ListaDeSinais => ({
  n: itens.length, itens, computado_em: '2026-10-24T10:00:00Z', desatualizado: false, motivoVazio: null, contagens: { canais_total: 5, outliers_total: 8, proprios: 3 }, calculoLigado: true, ...o,
})
const vazia = (motivo: ListaDeSinais['motivoVazio'], contagens: Record<string, number> = {}, o: Partial<ListaDeSinais> = {}): ListaDeSinais => lista([], { n: 0, motivoVazio: motivo, contagens, ...o })

const MATRIZ: Array<[string, () => ListaDeSinais]> = [
  ['duas sugestões, destino e parecido', () => lista([item(1), item(2, { kind: 'parecido', subject_key: 'outlier:abc', acao: 'titulo_descricao' })])],
  ['próprios não medidos (null)', () => lista([item(1, { proprios_agora: null, proprios_agora_n: null, n_proprios: null, rotulo_acao: 'generico' })])],
  ['nenhum próprio hoje', () => lista([item(1, { proprios_agora: [], proprios_agora_n: 0, n_proprios: 0, acao: 'video_novo', rotulo_acao: 'abrir-concorrente' })])],
  ['desatualizado e truncado (n > itens)', () => lista([item(1)], { n: 9, desatualizado: true })],
  ['sem estouros na evidência', () => lista([item(1, {}, 0)])],
  ...(['nunca-calculado', 'tudo-respondido', 'sem-lugar', 'sync-atrasado', 'sem-historico', 'sem-terceiro-outlier', 'abaixo-do-minimo', 'sem-grupo'] as const)
    .map((m): [string, () => ListaDeSinais] => [`vazio ${m}`, () => vazia(m, { canais_total: 5, outliers_total: 3, respondidos_30d: 2 }, m === 'nunca-calculado' ? { computado_em: null, contagens: {} } : {})]),
]
const modeloDe = (l: ListaDeSinais): ModeloSugestoes => modeloDeSugestoes(l, AGORA)
const textoDe = (p: ReturnType<typeof empacotarSugestoes>, limite = 1_000_000): string => montarTexto(segmentar(p, CONTEXTO), '', limite, 'todos').texto

describe('Sugestões: inventário de folhas', () => {
  it('toda folha do modelo tem destino em todos os estados, e o inventário não guarda declaração velha (união da matriz)', () => {
    const usos = new Set<string>()
    for (const [, fazer] of MATRIZ) {
      const m = modeloDe(fazer())
      expect(semDestino(m, INVENTARIO_SUGESTOES)).toEqual([])
      expect(ignorados(m)).toEqual([])
      const sobra = new Set(semUso(m, INVENTARIO_SUGESTOES))
      for (const k of Object.keys(INVENTARIO_SUGESTOES)) if (!sobra.has(k)) usos.add(k)
    }
    expect(Object.keys(INVENTARIO_SUGESTOES).filter((k) => !usos.has(k) && !SEM_FOLHA_NA_MATRIZ_SUGESTOES.includes(k))).toEqual([])
  })

  it('a foto histórica evidence.proprios não entra no modelo (o que vale é proprios_agora)', () => {
    const m = modeloDe(lista([item(1)]))
    expect(JSON.stringify(m)).not.toContain('foto')
    expect(m.itens[0]!.evidence).not.toHaveProperty('proprios')
  })
})

describe('Sugestões: o pacote', () => {
  it('450 vídeos seus (20 ids na lista): a tabela dos seus vídeos diz o total real e leva só os 20 códigos', () => {
    const ids = Array.from({ length: 20 }, (_, k) => `bbbbbbbb-0000-4000-8000-${String(k).padStart(12, '0')}`)
    const p = empacotarSugestoes(modeloDe(lista([item(1, { proprios_agora: ids, proprios_agora_n: 450, n_proprios: 450 })])))
    const texto = montarTexto(segmentar(p, CONTEXTO), '', 1_000_000, 'todos').texto
    expect(texto).toMatch(/450/)
    expect(texto).toContain(ids[19]!)
    expect(texto).toMatch(/Total de vídeos seus/)
  })
  it('dimensões: tela, privado na (alvos são vídeos próprios PÚBLICOS, sem número do Analytics), sem comentários; incluiuPrivado é falso', () => {
    for (const [nome, fazer] of MATRIZ) {
      const p = empacotarSugestoes(modeloDe(fazer()))
      expect(p.tela, nome).toBe('sugestoes')
      expect(p.privado, nome).toEqual({ estado: 'na' })
      expect(p.comentarios, nome).toEqual({ estado: 'na' })
      expect(p.tabelas.every((t) => !t.privada), nome).toBe(true)
      const s = segmentar(p, CONTEXTO)
      expect(s.privado.estado, nome).toBe('na')
      expect(s.privado.estado === 'incluido' || s.comentarios.estado === 'incluido', nome).toBe(false)
    }
  })

  it('o texto traz n, os ids, as subject_keys e o rodapé; "pode ajudar", nunca "vai ajudar"', () => {
    const l = lista([item(1), item(2)])
    const t = textoDe(empacotarSugestoes(modeloDe(l)))
    for (const i of l.itens) { expect(t).toContain(i.id); expect(t).toContain(i.subject_key) }
    expect(t).toContain(RODAPE_SUGESTOES)
    expect(t).toMatch(/pode ajudar/)
    expect(t).not.toMatch(/vai ajudar/i)
    expect(t).toMatch(/associação/)
  })

  it('o que acontece quando o dado não existe: lista vazia traz a frase do motivo em `vazio` e nenhuma tabela de itens', () => {
    for (const m of ['nunca-calculado', 'tudo-respondido', 'sem-lugar', 'sync-atrasado', 'sem-historico', 'sem-terceiro-outlier', 'abaixo-do-minimo', 'sem-grupo'] as const) {
      const p = empacotarSugestoes(modeloDe(vazia(m, { canais_total: 5, respondidos_30d: 2 })))
      expect(p.vazio, m).toEqual(expect.any(String))
      expect(p.vazio!.length, m).toBeGreaterThan(10)
      expect(p.tabelas.some((t) => t.id === 'sugestoes-itens'), m).toBe(false)
      expect(segmentar(p, CONTEXTO).vazio, m).toBe(true)
    }
    expect(empacotarSugestoes(modeloDe(vazia('nunca-calculado', {}, { computado_em: null, calculoLigado: false }))).vazio).toBe('O cálculo das sugestões ainda não foi ligado.')
  })

  it('lista com itens não é vazia; próprios não medidos viram "não medido" com o motivo, nunca zero', () => {
    const p = empacotarSugestoes(modeloDe(lista([item(1, { proprios_agora: null, n_proprios: null })])))
    expect(p.vazio).toBeNull()
    const linha = p.tabelas.find((t) => t.id === 'sugestoes-itens')!.linhas[0]!
    expect(linha.find((c) => c.papel === 'numero' && c.estado === 'nao_medido')).toBeTruthy()
    const zero = empacotarSugestoes(modeloDe(lista([item(1, { proprios_agora: [], n_proprios: 0 })])))
    expect(zero.tabelas.find((t) => t.id === 'sugestoes-itens')!.linhas[0]!.some((c) => c.papel === 'numero' && c.estado === 'zero_medido' && c.origem.endsWith('n_proprios'))).toBe(true)
  })

  it('desatualizado e truncado viram aviso', () => {
    const p = empacotarSugestoes(modeloDe(lista([item(1)], { n: 9, desatualizado: true })))
    expect(p.avisos.join(' ')).toMatch(/1 mais fortes de 9/)
    expect(p.avisos.join(' ')).toMatch(/mais de 36 horas/)
  })

  it('sem endereço, sem título nem miniatura de terceiro, sem coluna de desempenho do vídeo próprio (D20)', () => {
    const t = textoDe(empacotarSugestoes(modeloDe(lista([item(1), item(2)]))))
    expect(t).not.toMatch(/https?:|i\.ytimg|blob\.vercel|\/cms\//i)
    const p = empacotarSugestoes(modeloDe(lista([item(1)])))
    const colunas = p.tabelas.flatMap((x) => x.colunas).join(' | ').toLowerCase()
    expect(colunas).not.toMatch(/título|titulo|miniatura|comentário|ctr|nota/)
    expect(p.naoMede.join(' ')).toMatch(/desempenho dos seus vídeos/)
  })

  it('50 sugestões com a evidência no máximo (20 outliers) cabem em tetoPorAcao e o piso não estoura', () => {
    const l = lista(Array.from({ length: 50 }, (_, i) => item(i, {}, 20)))
    const p = empacotarSugestoes(modeloDe(l))
    const r = montarTexto(segmentar(p, CONTEXTO), '', ACESSO_IA_RULES.tetoPorAcao, 'todos')
    expect(r.caracteres).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoPorAcao)
    expect(r.pisoPassou).toBe(false)
    // mais que o pacote lê: o corte por tamanho cede linha de lista, é anunciado e o resultado ainda cabe
    expect(r.cortes.length).toBeGreaterThan(0)
    expect(r.texto).toContain('50')
  })

  it(`as ${SUGESTOES_NO_PACOTE} que o pacote lê, com a evidência no máximo, cabem SEM o corte por tamanho tirar linha`, () => {
    const l = lista(Array.from({ length: SUGESTOES_NO_PACOTE }, (_, i) => item(i, {}, 20)), { n: 50 })
    const r = montarTexto(segmentar(empacotarSugestoes(modeloDe(l)), CONTEXTO), '', ACESSO_IA_RULES.tetoPorAcao, 'todos')
    expect(r.cortes).toEqual([])
    expect(r.caracteres).toBeLessThanOrEqual(ACESSO_IA_RULES.tetoPorAcao)
    for (const i of l.itens) expect(r.texto).toContain(i.id)
  })
})

describe('Sugestões: a guarda', () => {
  beforeEach(() => { guarda.ok = true; guarda.pedidos = []; leitura.chamadas = []; leitura.lista = lista([item(1)]) })

  it('o site e o cliente vêm da guarda (modo edit); a leitura recebe o site do contexto e o cliente de serviço, nunca parâmetro', async () => {
    const r = await montarSugestoes()
    expect(r).not.toBeNull()
    expect(guarda.pedidos[0]).toMatchObject({ area: 'cms', siteId: 'site-da-guarda', mode: 'edit' })
    expect(leitura.chamadas[0]![0]).toEqual({ marca: 'cliente-de-servico' })
    expect(leitura.chamadas[0]![1]).toBe('site-da-guarda')
    expect(leitura.chamadas[0]![3]).toBe(SUGESTOES_NO_PACOTE)
    expect(r!.modelo.tela).toBe('sugestoes')
    expect(r!.recente).toMatch(/^24\/10\/2026/)
  })

  it('sem acesso ao site: null ("não encontrado") e nada é lido', async () => {
    guarda.ok = false
    expect(await montarSugestoes()).toBeNull()
    expect(leitura.chamadas).toEqual([])
  })

  it('montarSugestoes não aceita parâmetro (assinatura sem argumentos) e o EMPACOTAR tem a entrada sugestoes', async () => {
    expect(montarSugestoes.length).toBe(0)
    const { EMPACOTAR } = await import('@/app/cms/(authed)/youtube/competitors/_contexto-ia')
    expect(typeof EMPACOTAR.sugestoes).toBe('function')
    const fonte = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_sugestoes/dados.ts'), 'utf8')
    expect(fonte).not.toMatch(/sp\.|pedido\.|siteId\s*[:=]\s*(?:sp|id)/)
  })
})
