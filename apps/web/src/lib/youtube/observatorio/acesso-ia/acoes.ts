// A5 · E17 degrau 2, Tarefa 9: as nove ações da ferramenta `observatorio_leitura`, o esquema de entrada e o mapa de cada ação para uma
// ou mais telas do degrau 1 (plano, 4.6). Puro: sem banco, sem relógio, sem rede. A ferramenta NÃO tem leitor próprio: cada ação vira
// `(tela, id, parâmetros de URL)` e quem responde (Tarefa 10) chama `EMPACOTAR[tela]`.
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

export const ACOES = ['definicoes', 'listar_canais', 'canal', 'video', 'comparar', 'destaques', 'serie', 'mudancas', 'pacote_da_tela'] as const
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
}

/* ------------------------------------------------------------------ esquema */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CANAL_YT = /^UC[A-Za-z0-9_-]{22}$/
const VIDEO_YT = /^[A-Za-z0-9_-]{11}$/

const id = z.string().max(64).refine((s) => UUID.test(s) || CANAL_YT.test(s) || VIDEO_YT.test(s), 'id fora de forma: use o uuid ou o id do YouTube')
const nicho = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, 'nicho fora de forma')
const janela = z.enum(['7', '30', '90', 'todas'])
const formato = z.enum(['todos', 'longos', 'shorts'])

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

export const ENTRADA = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('definicoes') }).strict(),
  z.object({ acao: z.literal('listar_canais'), formato: formato.optional(), nicho: nicho.optional(), janela: janela.optional() }).strict(),
  z.object({ acao: z.literal('canal'), canal_id: id, janela: janela.optional(), formato: formato.optional() }).strict(),
  z.object({ acao: z.literal('video'), video_id: id }).strict(),
  z.object({ acao: z.literal('comparar'), canal_ids: z.array(id).max(100), janela: janela.optional(), formato: formato.optional() }).strict(),
  z.object({ acao: z.literal('destaques'), janela: janela.optional(), formato: formato.optional(), nicho: nicho.optional() }).strict(),
  z.object({ acao: z.literal('serie'), video_id: id.optional(), canal_id: id.optional(), de: data, ate: data, grao: z.enum(['dia', 'semana']).optional() }).strict(),
  z.object({ acao: z.literal('mudancas'), canal_id: id.optional(), desde: data.optional(), janela: janela.optional(), formato: formato.optional(), nicho: nicho.optional() }).strict(),
  z.object({ acao: z.literal('pacote_da_tela'), tela: z.string().max(32), id: id.optional(), parametros: parametros.optional() }).strict(),
])
export type Entrada = z.infer<typeof ENTRADA>

/* ------------------------------------------------------------------ o mapa */

type Resultado = { ok: true; pedido: Pedido } | { ok: false; frase: string }
type Sp = Record<string, string | undefined>
type Formato = z.infer<typeof formato>
type Janela = z.infer<typeof janela>

const NICHO_PADRAO = 'todos'
const TETO = ACESSO_IA_RULES.tetoPorAcao
const NENHUM = { tipo: 'nenhum', n: 0 } as const
const recusar = (frase: string): Resultado => ({ ok: false, frase })
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

type Tradutor<A extends Acao> = (e: Extract<Entrada, { acao: A }>) => Resultado

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
    if (n < min || n > max) return recusar(`comparar aceita de ${min} a ${max} canais; vieram ${n}`)
    if (new Set(e.canal_ids.map((c) => c.toLowerCase())).size !== n) return recusar('comparar não aceita o mesmo canal duas vezes')
    const aviso: string[] = []
    janelaSemEquivalente('comparar', e.janela, aviso)
    if (e.formato !== undefined) aviso.push(`formato ${e.formato}: a tela Comparar não escolhe formato; o pacote traz o que a tela mostra`)
    const [a, ...outros] = e.canal_ids as [string, ...string[]]
    return {
      ok: true,
      pedido: {
        telas: outros.map((b) => ({ tela: 'comparar' as const, sp: { a, b, niche: NICHO_PADRAO } })),
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
    if ((e.video_id === undefined) === (e.canal_id === undefined)) return recusar('serie pede video_id ou canal_id, um dos dois e nunca os dois')
    if (e.de > e.ate) return recusar('serie: de não pode ser depois de ate')
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

  pacote_da_tela: (e) => {
    if (!telaExiste(e.tela)) {
      const existem = (Object.keys(TELAS_IA) as TelaId[]).filter((t) => TELAS_IA[t].estado === 'existe')
      return recusar(`tela desconhecida: use uma de ${existem.join(', ')}`)
    }
    const def = TELAS_IA[e.tela]
    if (def.estado !== 'existe') return recusar(FRASES_DA_FERRAMENTA.tela_sem_pacote)
    if (def.pedeId && e.id === undefined) return recusar(`a tela ${e.tela} pede um id`)
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
}

/** A entrada já passou pelo esquema (`ENTRADA`); aqui entram as regras que olham mais de um campo. */
export function traduzir(entrada: Entrada): Resultado {
  const tradutor = TRADUTORES[entrada.acao] as (e: Entrada) => Resultado
  return tradutor(entrada)
}
