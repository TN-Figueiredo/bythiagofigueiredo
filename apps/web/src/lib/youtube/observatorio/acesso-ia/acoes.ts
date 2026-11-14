// A5 · E17 degrau 2, Tarefa 9: as dez ações da ferramenta `observatorio_leitura`, o esquema de entrada e o mapa de cada ação para uma
// ou mais telas do degrau 1 (plano, 4.6). Puro: sem banco, sem rede; o relógio só entra como argumento (`agora`) de `traduzir`. As nove primeiras NÃO têm leitor próprio: cada ação vira
// `(tela, id, parâmetros de URL)` e quem responde (Tarefa 10) chama `EMPACOTAR[tela]`. `sugestoes` (F2 T8) é a primeira com leitor próprio: lê a tabela dos sinais.
//
// Duas regras que valem para tudo aqui:
//   - texto livre não existe: todo campo é uma lista fechada, um id com forma de uuid ou de id do YouTube, ou uma data; nada passa de 64 caracteres;
//   - entrada SEM parâmetro equivalente na tela não é ignorada em silêncio: sai em `semEquivalente`, e a resposta a escreve no topo.
//     Os parâmetros que cada tela entende foram lidos nos analisadores das páginas (L3), em 13/10/2026.
import { z } from 'zod'
import { ACESSO_IA_RULES } from './regras'
import { FRASES_DA_FERRAMENTA } from './frases'
import { DEFAULT_AGES } from '../rules'
import { TELAS_IA, telaExiste } from '../contexto-ia/telas'
import type { TelaId } from '../contexto-ia/tipos'
import { METRICAS_DA_CONSULTA } from '../consulta/catalogo'
import type { MetricaDaConsulta, PedidoDaConsulta } from '../consulta/tipos'
import { OUT_WINDOWS } from '../rules'
import { spDateOf } from '../time'

export const ACOES = ['definicoes', 'listar_canais', 'canal', 'video', 'comparar', 'destaques', 'serie', 'mudancas', 'pacote_da_tela', 'sugestoes', 'consultar'] as const
export type Acao = (typeof ACOES)[number]

export interface Pedido {
  /** `'canal?'` e `'video?'` dizem a quem responde para resolver entre a versão de concorrente e a própria. */
  telas: Array<{ tela: TelaId | 'canal?' | 'video?'; id?: string; sp: Record<string, string | undefined> }>
  teto: number
  limite: { tipo: 'linhas' | 'pontos' | 'nenhum'; n: number }
  /** Entradas que a tela não entende: a Tarefa 10 as escreve no topo da resposta. */
  semEquivalente: string[]
  grao?: 'dia' | 'semana'
  de?: string
  ate?: string
  /** `destaques`: a janela de idade que o recorte usou, para o cabeçalho escrever (sem ela, "menos vídeos" pareceria "menos dado"). */
  janelaUsada?: string
  /** A7b: a 1ª linha da janela da lista principal (1-based; padrão 1). Só `listar_canais`, `destaques` e `mudancas` a aceitam. */
  inicio: number
  /** A7b: a `marca` que a Cobertura devolveu na janela anterior (8 hex, mais `p` se uma janela anterior perdeu conteúdo); vem só quando a IA a repete. */
  marca?: string
  /** A5 F1b: `tabela` devolve CSV por tabela (listar_canais, destaques, mudancas); padrão `texto`. */
  saida: 'texto' | 'tabela'
  /** A4 R5: só a `consultar`. */
  consulta?: PedidoDaConsulta
}

/* ------------------------------------------------------------------ esquema */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CANAL_YT = /^UC[A-Za-z0-9_-]{22}$/
const VIDEO_YT = /^[A-Za-z0-9_-]{11}$/

const id = z.string().max(64).refine((s) => UUID.test(s) || CANAL_YT.test(s) || VIDEO_YT.test(s), 'id fora de forma: use o uuid ou o id do YouTube')
const nicho = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, 'nicho fora de forma')
// a IA manda `90` como número com frequência (registro de 09/11): vale como "90"; 45 continua recusado
const janela = z.preprocess((v) => (typeof v === 'number' ? String(v) : v), z.enum(['7', '30', '90', 'todas']))
const formato = z.enum(['todos', 'longos', 'shorts'])
// A7b: a janela da lista. A IA às vezes manda "41" (texto); número inteiro de 1 a 100.000
const aPartirDaLinha = z.preprocess((v) => (typeof v === 'string' && /^\d{1,6}$/.test(v) ? Number(v) : v), z.number().int().min(1).max(100_000)).optional()
/** 8 hex da lista; o 9º caractere `p` diz que uma janela anterior perdeu parte do conteúdo (a IA o repete como veio). */
const marca = z.string().regex(/^[0-9a-f]{8}p?$/).optional()
/** A5 F1b/F1c/F2a: as três listas, a `consultar` e a `serie` aceitam `saida`; `comparar` não (D10). */
const saida = z.enum(['texto', 'tabela']).optional()

const dataReal = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === s
}
const data = z.string().max(10).refine(dataReal, 'a data não existe ou está fora do formato AAAA-MM-DD')

const parametros = z
  .record(z.string().max(32).regex(/^[a-z_]+$/), z.string().max(64).regex(/^[A-Za-z0-9_.,:-]+$/))
  .refine((r) => Object.keys(r).length <= 12, 'parâmetros demais')

// A4 R5: a `consultar`. Tudo lista fechada, forma fixa ou número limitado; a IA manda número e booleano como texto com frequência (como em `janela`).
const CHAVES_DE_METRICA = Object.keys(METRICAS_DA_CONSULTA) as [MetricaDaConsulta, ...MetricaDaConsulta[]]
const metrica = z.enum(CHAVES_DE_METRICA)
const FAIXAS = OUT_WINDOWS.map((w) => w.id) as [string, ...string[]]
const faixa = z.enum(FAIXAS)
const lugarDaConsulta = z.string().max(64).regex(/^(local:[a-z]{2}-[a-z0-9-]{1,40}|pais:[A-Z]{2})$/, 'lugar fora de forma: local:<slug> ou pais:<XX>')
const limiteDaConsulta = z.preprocess((v) => (typeof v === 'string' && /^\d{1,3}$/.test(v) ? Number(v) : v), z.number().int().min(1).max(50)).optional()
const booleano = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional()
const janelaDaConsulta = z.union([z.literal('todas'), faixa, z.array(faixa).min(1).max(FAIXAS.length)]).optional()
const ultimosDiasDaConsulta = z.preprocess((v) => (typeof v === 'string' && /^\d{1,3}$/.test(v) ? Number(v) : v), z.number().int().min(1).max(365)).optional()
const canaisDaConsulta = z.array(z.union([z.literal('proprio'), id])).min(1).max(6).optional()

export const ENTRADA = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('definicoes') }).strict(),
  z.object({ acao: z.literal('listar_canais'), formato: formato.optional(), nicho: nicho.optional(), janela: janela.optional(), a_partir_da_linha: aPartirDaLinha, marca, saida }).strict(),
  z.object({ acao: z.literal('canal'), canal_id: id, janela: janela.optional(), formato: formato.optional() }).strict(),
  z.object({ acao: z.literal('video'), video_id: id }).strict(),
  z.object({ acao: z.literal('comparar'), canal_ids: z.array(z.union([z.literal('proprio'), id])).max(100), janela: janela.optional(), formato: formato.optional() }).strict(),
  z.object({ acao: z.literal('destaques'), janela: janela.optional(), formato: formato.optional(), nicho: nicho.optional(), a_partir_da_linha: aPartirDaLinha, marca, saida }).strict(),
  z.object({ acao: z.literal('serie'), video_id: id.optional(), canal_id: id.optional(), canal_ids: z.array(z.union([z.literal('proprio'), id])).min(1).max(ACESSO_IA_RULES.tetoDeCanaisDaSerie.canais).optional(), de: data, ate: data, grao: z.enum(['dia', 'semana']).optional(), saida }).strict(),
  z.object({ acao: z.literal('mudancas'), canal_id: id.optional(), desde: data.optional(), janela: janela.optional(), formato: formato.optional(), nicho: nicho.optional(), a_partir_da_linha: aPartirDaLinha, marca, saida }).strict(),
  z.object({ acao: z.literal('sugestoes') }).strict(),
  z.object({
    acao: z.literal('consultar'), entidade: z.enum(['video', 'canal']).default('video'), lugar: lugarDaConsulta.optional(), formato: formato.optional(), janela_idade: janelaDaConsulta,
    canal_ids: canaisDaConsulta, nicho: nicho.optional(), publicado_de: data.optional(), publicado_ate: data.optional(), publicado_nos_ultimos_dias: ultimosDiasDaConsulta, metricas: z.array(metrica).min(1).max(CHAVES_DE_METRICA.length).optional(),
    ordenar_por: metrica.optional(), direcao: z.enum(['desc', 'asc']).optional(), limite: limiteDaConsulta, incluir_base_fraca: booleano, saida,
  }).strict(),
  z.object({ acao: z.literal('pacote_da_tela'), tela: z.string().max(32), id: id.optional(), parametros: parametros.optional() }).strict(),
])
export type Entrada = z.infer<typeof ENTRADA>

/* ------------------------------------------------------------------ o mapa */

export type CampoDeEntrada = 'a_partir_da_linha' | 'marca' | 'saida' | 'canal_id' | 'video_id' | 'canal_ids' | 'janela' | 'formato' | 'nicho' | 'de' | 'ate' | 'grao' | 'desde' | 'tela' | 'entidade' | 'lugar' | 'janela_idade' | 'publicado_de' | 'publicado_ate' | 'publicado_nos_ultimos_dias' | 'metricas' | 'ordenar_por' | 'direcao' | 'limite' | 'incluir_base_fraca' | 'id' | 'parametros'
type PedidoBase = Omit<Pedido, 'inicio' | 'marca' | 'saida'>
type Resultado = { ok: true; pedido: PedidoBase } | { ok: false; frase: string; campos: readonly CampoDeEntrada[] }
type ResultadoFinal = { ok: true; pedido: Pedido } | { ok: false; frase: string; campos: readonly CampoDeEntrada[] }
type Sp = Record<string, string | undefined>
type Formato = z.infer<typeof formato>
type Janela = z.infer<typeof janela>

const NICHO_PADRAO = 'todos'
const TETO = ACESSO_IA_RULES.tetoPorAcao
const NENHUM = { tipo: 'nenhum', n: 0 } as const
const recusar = (frase: string, ...campos: CampoDeEntrada[]): Resultado => ({ ok: false, frase, campos })
const nomeDe = (tela: TelaId): string => TELAS_IA[tela].nome

/** Janela pedida para uma tela que não tem janela. */
const janelaSemEquivalente = (tela: TelaId, j: Janela | undefined, aviso: string[]): void => {
  if (j !== undefined) aviso.push(`janela ${j}: a tela ${nomeDe(tela)} não tem janela; o pacote traz o período que a tela mostra`)
}

const IDADES_DA_JANELA: Record<Exclude<Janela, '7'>, string> = { '30': '0-30', '90': DEFAULT_AGES.join(','), todas: 'all' }
const TEXTO_DA_JANELA: Record<Exclude<Janela, '7'>, string> = {
  '30': 'vídeos de 0 a 30 dias de idade',
  '90': 'vídeos de 0 a 90 dias de idade',
  todas: 'vídeos de todas as idades',
}

type Tradutor<A extends Acao> = (e: Extract<Entrada, { acao: A }>, agora: number) => Resultado

const TRADUTORES: { [A in Acao]: Tradutor<A> } = {
  definicoes: () => ({
    ok: true,
    pedido: {
      telas: (['canais', 'comparar', 'outliers', 'insights', 'mudancas'] as const).map((tela) => ({ tela, sp: { niche: NICHO_PADRAO } })),
      teto: TETO, limite: NENHUM, semEquivalente: [],
    },
  }),

  listar_canais: (e) => {
    const aviso: string[] = []
    janelaSemEquivalente('canais', e.janela, aviso)
    const sp: Sp = { niche: e.nicho ?? NICHO_PADRAO }
    if (e.formato) sp.fmt = e.formato
    return { ok: true, pedido: { telas: [{ tela: 'canais', sp }], teto: TETO, limite: { tipo: 'linhas', n: ACESSO_IA_RULES.canaisNaLista }, semEquivalente: aviso } }
  },

  canal: (e) => {
    const aviso: string[] = []
    janelaSemEquivalente('canal', e.janela, aviso)
    const sp: Sp = { niche: NICHO_PADRAO }
    if (e.formato) sp.fmt = e.formato
    return { ok: true, pedido: { telas: [{ tela: 'canal?', id: e.canal_id, sp }], teto: TETO, limite: NENHUM, semEquivalente: aviso } }
  },

  video: (e) => ({
    ok: true,
    pedido: { telas: [{ tela: 'video?', id: e.video_id, sp: { niche: NICHO_PADRAO } }], teto: TETO, limite: NENHUM, semEquivalente: [] },
  }),

  comparar: (e) => {
    const { min, max } = ACESSO_IA_RULES.canaisNoComparar
    const n = e.canal_ids.length
    if (n < min || n > max) return recusar(`comparar aceita de ${min} a ${max} canais; vieram ${n}`, 'canal_ids')
    if (new Set(e.canal_ids.map((c) => c.toLowerCase())).size !== n) return recusar('comparar não aceita o mesmo canal duas vezes', 'canal_ids')
    const aviso: string[] = []
    janelaSemEquivalente('comparar', e.janela, aviso)
    if (e.formato !== undefined) aviso.push(`formato ${e.formato}: a tela Comparar não escolhe formato; o pacote traz o que a tela mostra`)
    if (e.canal_ids.slice(1).includes('proprio')) return recusar('comparar aceita `proprio` só como primeiro canal', 'canal_ids')
    const [a, ...outros] = e.canal_ids as [string, ...string[]]
    // `proprio`: sem `a` na URL, quem resolve o par escolhe o canal próprio do site pela mesma regra da tela
    return {
      ok: true,
      pedido: {
        telas: outros.map((b) => ({ tela: 'comparar' as const, sp: { ...(a === 'proprio' ? { proprio: '1' } : { a }), b, niche: NICHO_PADRAO, estrito: '1' } })),
        teto: TETO, limite: NENHUM, semEquivalente: aviso,
      },
    }
  },

  destaques: (e) => {
    const aviso: string[] = []
    const sp: Sp = { niche: e.nicho ?? NICHO_PADRAO }
    // sem formato (ou com `todos`, que a tela não tem) a tela fica no padrão dela: longos
    if (e.formato === 'todos') aviso.push('formato todos: a tela Outliers não mostra longos e Shorts juntos; o pacote traz os longos')
    sp.fmt = e.formato === 'shorts' ? 'short' : 'long'
    let janelaUsada: string
    if (e.janela === undefined) {
      sp.age = DEFAULT_AGES.join(',')
      janelaUsada = 'recorte padrão da tela: vídeos de 0 a 90 dias de idade (0–30 d e 31–90 d)'
    } else if (e.janela === '7') {
      aviso.push('janela de 7 dias: a tela Outliers não tem janela de 7 dias; vale o recorte padrão (0 a 90 dias de idade)')
      sp.age = DEFAULT_AGES.join(',')
      janelaUsada = 'recorte padrão da tela: vídeos de 0 a 90 dias de idade (0–30 d e 31–90 d)'
    } else {
      sp.age = IDADES_DA_JANELA[e.janela]
      janelaUsada = TEXTO_DA_JANELA[e.janela]
    }
    return {
      ok: true,
      pedido: { telas: [{ tela: 'outliers', sp }], teto: TETO, limite: { tipo: 'linhas', n: ACESSO_IA_RULES.videosNosDestaques }, semEquivalente: aviso, janelaUsada },
    }
  },

  serie: (e) => {
    if ([e.video_id, e.canal_id, e.canal_ids].filter((x) => x !== undefined).length !== 1) return recusar('serie pede video_id, canal_id ou canal_ids, um dos três', 'canal_id', 'video_id', 'canal_ids')
    if (e.de > e.ate) return recusar('serie: de não pode ser depois de ate', 'ate', 'de')
    if (e.canal_ids !== undefined) {
      // A5 F2b: vários canais; D5: `canal_ids` implica CSV, só `saida: 'texto'` explícito é recusado; as regras do comparar (sem repetir, `proprio` só no 1º)
      if (e.saida === 'texto') return recusar('serie com canal_ids não existe em texto: use saida "tabela" (ou omita saida)', 'saida', 'canal_ids')
      if (new Set(e.canal_ids.map((c) => c.toLowerCase())).size !== e.canal_ids.length) return recusar('serie não aceita o mesmo canal duas vezes', 'canal_ids')
      if (e.canal_ids.slice(1).includes('proprio')) return recusar('serie aceita `proprio` só como primeiro canal', 'canal_ids')
      return {
        ok: true,
        pedido: {
          telas: e.canal_ids.map((c) => ({ tela: 'canal?' as const, id: c, sp: { niche: NICHO_PADRAO } })),
          teto: TETO, limite: { tipo: 'pontos', n: ACESSO_IA_RULES.pontosDaSerie }, semEquivalente: [],
          grao: e.grao ?? 'dia', de: e.de, ate: e.ate,
        },
      }
    }
    const tela = e.video_id !== undefined ? 'video?' : 'canal?'
    return {
      ok: true,
      pedido: {
        telas: [{ tela, id: (e.video_id ?? e.canal_id)!, sp: { niche: NICHO_PADRAO } }],
        teto: TETO, limite: { tipo: 'pontos', n: ACESSO_IA_RULES.pontosDaSerie }, semEquivalente: [],
        grao: e.grao ?? 'dia', de: e.de, ate: e.ate,
      },
    }
  },

  mudancas: (e) => {
    const aviso: string[] = []
    const sp: Sp = { niche: e.nicho ?? NICHO_PADRAO }
    if (e.janela === 'todas') {
      aviso.push('janela todas: a tela Mudanças vai até 90 dias; o pacote traz 90 dias')
      sp.win = '90'
    } else if (e.janela !== undefined) sp.win = e.janela
    if (e.desde !== undefined) aviso.push('desde: a tela Mudanças não filtra por data de início; use janela de 7, 30 ou 90 dias')
    if (e.formato !== undefined) sp.fmt = e.formato === 'todos' ? 'all' : e.formato === 'longos' ? 'long' : 'short'
    if (e.canal_id !== undefined) sp.channel = e.canal_id
    return { ok: true, pedido: { telas: [{ tela: 'mudancas', sp }], teto: TETO, limite: { tipo: 'linhas', n: ACESSO_IA_RULES.mudancas }, semEquivalente: aviso } }
  },

  // F2 T8: a primeira ação com leitor próprio (lê a tabela dos sinais, não uma tela). Só leitura; sem parâmetro: o site vem da guarda.
  sugestoes: () => ({ ok: true, pedido: { telas: [{ tela: 'sugestoes', sp: {} }], teto: TETO, limite: NENHUM, semEquivalente: [] } }),

  consultar: (e, agora) => {
    if (e.entidade !== 'video') return recusar('consultar: entidade "canal" ainda não existe; use "video"', 'entidade')
    if (e.canal_ids !== undefined) {
      if (e.canal_ids.includes('proprio')) return recusar('consultar não aceita proprio em canal_ids: o canal próprio fica fora desta lista', 'canal_ids')
      if (new Set(e.canal_ids.map((c) => c.toLowerCase())).size !== e.canal_ids.length) return recusar('consultar não aceita o mesmo canal duas vezes', 'canal_ids')
    }
    if (e.metricas !== undefined && new Set(e.metricas).size !== e.metricas.length) return recusar('consultar: metricas não aceita a mesma métrica duas vezes', 'metricas')
    if (Array.isArray(e.janela_idade) && new Set(e.janela_idade).size !== e.janela_idade.length) return recusar('consultar: janela_idade não aceita a mesma faixa duas vezes', 'janela_idade')
    if (e.publicado_de !== undefined && e.publicado_ate !== undefined && e.publicado_de > e.publicado_ate) return recusar('consultar: publicado_de não pode ser depois de publicado_ate', 'publicado_de', 'publicado_ate')
    if (e.publicado_nos_ultimos_dias !== undefined && (e.publicado_de !== undefined || e.publicado_ate !== undefined)) {
      return recusar('consultar: publicado_nos_ultimos_dias não vem junto de publicado_de ou publicado_ate; use um ou o outro', 'publicado_nos_ultimos_dias', e.publicado_de !== undefined ? 'publicado_de' : 'publicado_ate')
    }
    // "semana" = 7 dias corridos: hoje e os N-1 anteriores, dia de São Paulo, pelo relógio do servidor (a IA não sabe que dia é em Brasília)
    const ultimosDias = e.publicado_nos_ultimos_dias
    const hojeSp = spDateOf(agora)
    const deDosDias = ultimosDias !== undefined ? new Date(Date.parse(hojeSp + 'T00:00:00Z') - (ultimosDias - 1) * 86_400_000).toISOString().slice(0, 10) : undefined
    const ordenarPor = e.ordenar_por ?? 'multiplicador'
    const base: MetricaDaConsulta[] = e.metricas ?? ['views', 'likes', 'comentarios', 'multiplicador']
    const metricas = base.includes(ordenarPor) ? base : [...base, ordenarPor]
    // período pedido em dias sem faixa de idade: a faixa padrão (até 90 dias) não pode cortar o período
    const janelaIdade: string[] | 'todas' = e.janela_idade === undefined ? (ultimosDias !== undefined ? 'todas' : [...DEFAULT_AGES]) : e.janela_idade === 'todas' ? 'todas' : Array.isArray(e.janela_idade) ? e.janela_idade : [e.janela_idade]
    const limite = e.limite ?? 20
    const consulta: PedidoDaConsulta = {
      formato: e.formato ?? 'todos', janelaIdade, metricas, ordenarPor, direcao: e.direcao ?? 'desc', limite, incluirBaseFraca: e.incluir_base_fraca ?? false,
      ...(e.canal_ids !== undefined ? { canalIds: e.canal_ids } : {}), ...(e.nicho !== undefined ? { nicho: e.nicho } : {}), ...(e.lugar !== undefined ? { lugar: e.lugar } : {}),
      ...(e.publicado_de !== undefined ? { publicadoDe: e.publicado_de } : {}), ...(e.publicado_ate !== undefined ? { publicadoAte: e.publicado_ate } : {}),
      ...(deDosDias !== undefined ? { publicadoDe: deDosDias, publicadoAte: hojeSp, ultimosDias } : {}),
    }
    return { ok: true, pedido: { telas: [{ tela: 'consultar', sp: {} }], teto: TETO, limite: { tipo: 'linhas', n: limite }, semEquivalente: [], consulta } }
  },

  pacote_da_tela: (e) => {
    if (e.tela === 'consultar') return recusar('a consulta não tem pacote de tela: use a ação consultar', 'tela')
    if (!telaExiste(e.tela)) {
      const existem = (Object.keys(TELAS_IA) as TelaId[]).filter((t) => TELAS_IA[t].estado === 'existe')
      return recusar(`tela desconhecida: use uma de ${existem.join(', ')}`, 'tela')
    }
    const def = TELAS_IA[e.tela]
    if (def.estado !== 'existe') return recusar(FRASES_DA_FERRAMENTA.tela_sem_pacote, 'tela')
    if (def.pedeId && e.id === undefined) return recusar(`a tela ${e.tela} pede um id`, 'id')
    const aviso: string[] = []
    if (!def.pedeId && e.id !== undefined) aviso.push(`id: a tela ${def.nome} não usa id; ele foi ignorado`)
    const aceitos = PARAMETROS_DA_TELA[e.tela]
    const sp: Sp = { niche: NICHO_PADRAO }
    for (const [k, v] of Object.entries(e.parametros ?? {})) {
      if (aceitos.includes(k)) sp[k] = v
      else aviso.push(`parâmetro "${k}": a tela ${def.nome} não o entende; foi ignorado`)
    }
    return {
      ok: true,
      pedido: { telas: [{ tela: e.tela, ...(def.pedeId ? { id: e.id } : {}), sp }], teto: ACESSO_IA_RULES.tetoPacoteDaTela, limite: NENHUM, semEquivalente: aviso },
    }
  },
}

/**
 * O que cada tela entende na URL, lido nos analisadores das páginas (L3). Fora desta lista o parâmetro vai a `semEquivalente`.
 * Os de texto livre (`q`, termo de busca) ficam de fora de propósito: texto livre não existe nesta ferramenta.
 */
const PARAMETROS_DA_TELA: Record<TelaId, readonly string[]> = {
  canais: ['niche', 'fmt', 'sort', 'dir', 'filter'],
  canal: ['fmt', 'sort', 'dir', 'tab', 'ver'],
  'canal-proprio': ['fmt', 'sort', 'dir', 'tab', 'ver'],
  video: ['niche'],
  'video-proprio': [],
  comparar: ['a', 'b'],
  outliers: ['niche', 'fmt', 'age', 'sort', 'min', 'channel'],
  insights: ['niche', 'fmt'],
  mudancas: ['niche', 'fmt', 'win', 'type', 'sort', 'channel', 'video', 'measured'],
  fila: [],
  ritmo: [],
  sugestoes: [],
  consultar: [],
}

/** A entrada já passou pelo esquema (`ENTRADA`); aqui entram as regras que olham mais de um campo. */
export function traduzir(entrada: Entrada, agora: number = Date.now()): ResultadoFinal {
  const tradutor = TRADUTORES[entrada.acao] as (e: Entrada, agora: number) => Resultado
  const r = tradutor(entrada, agora)
  if (!r.ok) return r
  const e = entrada as { a_partir_da_linha?: number; marca?: string; saida?: 'texto' | 'tabela' }
  return { ok: true, pedido: { ...r.pedido, inicio: e.a_partir_da_linha ?? 1, saida: e.saida ?? (entrada.acao === 'serie' && (entrada as { canal_ids?: unknown }).canal_ids !== undefined ? 'tabela' : 'texto'), ...(e.marca !== undefined ? { marca: e.marca } : {}) } }
}
