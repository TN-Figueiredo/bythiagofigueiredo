/**
 * F2 T8: o empacotador das sugestões do nicho (`TelaId 'sugestoes'`). A primeira tela com leitor próprio: o MODELO é a `ListaDeSinais`
 * de `listarSinaisDoNicho` (a mesma que a rota e o `get_signals` devolvem), sem a foto histórica `evidence.proprios` (o que vale é
 * `proprios_agora`). Puro: nada de banco nem de relógio (quem lê é `_sugestoes/dados.ts`; o texto do vazio nasce em `modeloDeSugestoes`).
 *
 * O que NÃO entra, e o teste prova: título e miniatura de vídeo de concorrente (só ids), texto de comentário, URL de imagem, qualquer
 * coluna de desempenho do vídeo próprio (D20). `privado` é `na`: os alvos são ids de vídeos PRÓPRIOS PÚBLICOS (privado e oculto já saem na leitura)
 * e nenhum número deles vem do Analytics, então `incluiuPrivado` é falso.
 */
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { RODAPE_SUGESTOES } from '@/lib/youtube/observatorio/acesso-ia/frases'
import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { textoDaAcao, textoDoVazio } from '@/lib/youtube/observatorio/sinais/frases'

export type ItemDoModelo = Omit<ItemDeSinal, 'evidence'> & { evidence: Omit<ItemDeSinal['evidence'], 'proprios'> }
export interface ModeloSugestoes {
  n: number
  motivoVazio: string | null
  textoDoVazio: string | null
  computadoEm: string | null
  desatualizado: boolean
  contagens: Record<string, number>
  itens: ItemDoModelo[]
}

/** A lista lida, mais a frase do vazio (precisa do relógio, que o empacotador não tem). */
export function modeloDeSugestoes(lista: ListaDeSinais, agora: Date): ModeloSugestoes {
  return {
    n: lista.n,
    motivoVazio: lista.motivoVazio,
    textoDoVazio: lista.n === 0 && lista.motivoVazio !== null
      ? [textoDoVazio(lista.motivoVazio, lista.contagens, agora, lista.calculoLigado), ...(lista.motivoDoCalculo ? [textoDoVazio(lista.motivoDoCalculo, lista.contagens, agora, lista.calculoLigado)] : [])].join(' ')
      : null,
    computadoEm: lista.computado_em,
    desatualizado: lista.desatualizado,
    contagens: lista.contagens,
    itens: lista.itens.map((i) => {
      const { proprios: _foto, ...evidence } = i.evidence
      void _foto
      return { ...i, evidence }
    }),
  }
}

// ───────────────────────── o inventário de folhas (item 160)
const ID = { descartado: 'identificador' } as const
const REP = { descartado: 'repetido' } as const

export const INVENTARIO_SUGESTOES: Inventario = {
  n: 'numero', motivoVazio: 'motivo', textoDoVazio: 'base', computadoEm: 'base', desatualizado: 'base',
  'contagens.*': 'numero',
  'itens[].id': ID, 'itens[].kind': 'rotulo', 'itens[].subject_key': 'base', 'itens[].acao': 'base', 'itens[].rotulo_acao': REP,
  'itens[].n_proprios': 'numero', 'itens[].acao_gravada': { descartado: 'repetido' },
  'itens[].forca': 'numero', 'itens[].motivo': 'base', 'itens[].rule_version': 'base',
  'itens[].first_seen_at': 'base', 'itens[].expires_at': 'base', 'itens[].adiada_em': 'base',
  'itens[].proprios_agora': ID, 'itens[].proprios_agora[]': ID, 'itens[].proprios_agora_n': 'numero',
  'itens[].evidence.outliers[].video_id': ID, 'itens[].evidence.outliers[].canal_id': ID, 'itens[].evidence.outliers[].published_at': 'base',
  'itens[].evidence.outliers[].mult_vpd7': 'numero', 'itens[].evidence.outliers[].mult_tela': 'numero', 'itens[].evidence.outliers[].vpd7': 'numero',
  'itens[].evidence.outliers[].formato': 'rotulo',
  'itens[].evidence.outliers_total': 'numero', 'itens[].evidence.canais': 'numero',
  // F4: o vídeo do terceiro que puxa o sinal já nos manda tráfego? Estado/motivo/regra são rótulos; contagens e `views` são números (`views` só com prova).
  'itens[].trafego_do_terceiro.estado': 'rotulo', 'itens[].trafego_do_terceiro.motivo': 'rotulo', 'itens[].trafego_do_terceiro.regra': 'rotulo',
  'itens[].trafego_do_terceiro.terceiro_video_id': ID, 'itens[].trafego_do_terceiro.ate': 'base',
  'itens[].trafego_do_terceiro.videos_com_trafego': 'numero', 'itens[].trafego_do_terceiro.videos_medidos': 'numero', 'itens[].trafego_do_terceiro.videos_total': 'numero',
  'itens[].trafego_do_terceiro.views': 'numero',
}

/** Chaves do inventário cuja folha não aparece em nenhum estado da matriz do teste. */
export const SEM_FOLHA_NA_MATRIZ_SUGESTOES: readonly string[] = []
/** Folhas de número cru: nenhuma (todo número já vem do modelo como número e a célula leva o texto dele). */
export const SEM_PROVA_POR_IGUALDADE_DIRETA_SUGESTOES = [] as const

// ───────────────────────── textos do pacote que esta tela escreve
const NAO_MEDE_CAUSA = 'se o lugar é a causa de um vídeo ter estourado: a lista mostra uma associação entre estouros de concorrentes e um lugar'
const NAO_MEDE_PROPRIO = 'o desempenho dos seus vídeos: ele não entra na força, na ordem nem na escolha das sugestões (por regra)'
const NAO_MEDE_TEXTO = 'o título e a miniatura dos vídeos dos concorrentes: o pacote leva só os códigos dos vídeos e dos canais'
const SEM_LUGARES_PROPRIOS = 'os lugares dos seus vídeos ainda não foram calculados neste site'

const ROTULO_DA_CONTAGEM: Record<string, string> = {
  canais_total: 'Canais acompanhados', canais_sem_ritmo: 'Canais sem ritmo medido', canais_sem_n_minimo: 'Canais abaixo do mínimo de vídeos',
  canais_com_outlier: 'Canais com vídeo estourando', outliers_total: 'Vídeos estourando', outliers_sem_lugar: 'Estourando sem lugar reconhecido',
  sem_n_minimo: 'Descartados por histórico curto do canal', abaixo_do_piso: 'Descartados por poucas visualizações',
  outliers_ancora: 'Estourando já respondidos antes', proprios: 'Vídeos seus com lugar', respondidos_30d: 'Sugestões respondidas nos últimos 30 dias',
}

// ───────────────────────── células
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
function numero(valor: number, origem: string): Celula {
  const t = String(Math.round(valor * 100) / 100)
  return valor === 0 ? { papel: 'numero', estado: 'zero_medido', texto: '0', x: 0, origem } : { papel: 'numero', estado: 'medido', texto: t, x: valor, origem }
}
const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

export const dataSp = (iso: string): string => {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms)
}

// ───────────────────────── tabelas
function tabelaResumo(m: ModeloSugestoes): Tabela[] {
  const linhas: Celula[][] = [[rotulo('Sugestões abertas', 'modelo.n'), numero(m.n, 'modelo.n')]]
  if (m.computadoEm !== null) linhas.push([rotulo('Último cálculo (Brasília)', 'modelo.computadoEm'), base(dataSp(m.computadoEm), 'modelo.computadoEm')])
  return [tabelaFixa('sugestoes-resumo', 'Sugestões do nicho: resumo', 'tabela de resumo das sugestões', ['Medida', 'Valor'], linhas)]
}

function tabelaContagens(m: ModeloSugestoes): Tabela[] {
  const chaves = Object.keys(m.contagens).sort()
  if (chaves.length === 0) return []
  return [tabelaFixa('sugestoes-contagens', 'O que o último cálculo contou', 'tabela de contagens do cálculo', ['Contagem', 'Valor'],
    chaves.map((k) => [rotulo(ROTULO_DA_CONTAGEM[k] ?? k, `modelo.contagens.${k}`), numero(m.contagens[k]!, `modelo.contagens.${k}`)]))]
}

function tabelaItens(m: ModeloSugestoes): Tabela[] {
  if (m.itens.length === 0) return []
  return [tabelaLista('sugestoes-itens', 'Sugestões abertas, da mais forte para a mais fraca', 'tabela de sugestões',
    ['Código', 'Tipo', 'Lugar', 'Ação sugerida', 'Força', 'Por quê', 'Seus vídeos sobre o lugar hoje', 'Canais', 'Vídeos estourando', 'Aberta desde', 'Vale até'],
    m.itens.map((i, k): Celula[] => {
      const p = `modelo.itens[${k}]`
      const proprios: Celula = i.n_proprios === null
        ? { papel: 'numero', estado: 'nao_medido', motivo: SEM_LUGARES_PROPRIOS, origem: `${p}.n_proprios` }
        : numero(i.n_proprios, `${p}.n_proprios`)
      return [
        base(i.id, `${p}.id`), rotulo(i.kind === 'destino' ? 'destino' : 'parecido', `${p}.kind`), base(i.subject_key, `${p}.subject_key`),
        base(textoDaAcao(i.acao), `${p}.acao`), numero(i.forca, `${p}.forca`), base(i.motivo, `${p}.motivo`), proprios,
        numero(i.evidence.canais, `${p}.evidence.canais`), numero(i.evidence.outliers_total, `${p}.evidence.outliers_total`),
        base(dataSp(i.first_seen_at), `${p}.first_seen_at`), base(dataSp(i.expires_at), `${p}.expires_at`),
      ]
    }))]
}

const ROTULO_DO_ESTADO_F4: Record<string, string> = { sim: 'sim', nao: 'não', nao_medido: 'não medido', nao_se_aplica: 'não se aplica' }

/** F4: uma linha por sugestão. `nao_medido` leva o motivo e nunca vira "não" nem 0; `views` só existe com prova (senão "não medido" com o motivo). */
function tabelaTrafego(m: ModeloSugestoes): Tabela[] {
  if (m.itens.length === 0) return []
  return [tabelaLista('sugestoes-trafego', 'O vídeo do concorrente já manda visitas para algum vídeo seu? (por sugestão)', 'tabela de tráfego do vídeo do concorrente',
    ['Código da sugestão', 'Já recebo tráfego dele', 'Motivo (quando não medido)', 'Vídeos seus com tráfego', 'Vídeos seus medidos', 'Vídeos seus no total', 'Visitas vindas dele', 'Conferido até', 'Código do vídeo do concorrente', 'Regra'],
    m.itens.map((i, k): Celula[] => {
      const t = i.trafego_do_terceiro
      const p = `modelo.itens[${k}].trafego_do_terceiro`
      const motivo = t.motivo ?? 'não informado'
      const views: Celula = t.views === null
        ? { papel: 'numero', estado: 'nao_medido', motivo: t.estado === 'sim' ? 'o YouTube não informou as visitas desses dias' : t.estado === 'nao' ? 'não se aplica: não há visita' : motivo, origem: `${p}.views` }
        : numero(t.views, `${p}.views`)
      return [
        base(i.id, `modelo.itens[${k}].id`), rotulo(ROTULO_DO_ESTADO_F4[t.estado] ?? t.estado, `${p}.estado`),
        t.motivo === null ? rotulo('—', `${p}.motivo`) : rotulo(t.motivo, `${p}.motivo`),
        numero(t.videos_com_trafego, `${p}.videos_com_trafego`), numero(t.videos_medidos, `${p}.videos_medidos`), numero(t.videos_total, `${p}.videos_total`),
        views, base(t.ate ?? '—', `${p}.ate`), base(t.terceiro_video_id ?? '—', `${p}.terceiro_video_id`), rotulo(t.regra, `${p}.regra`),
      ]
    }))]
}

/** Os códigos dos vídeos seus de cada sugestão, UMA linha por sugestão (até 20 códigos numa célula, mais o total real): 50 sugestões não viram 500 linhas. */
function tabelaSeusVideos(m: ModeloSugestoes): Tabela[] {
  const linhas = m.itens.flatMap((i, k): Celula[][] => (i.proprios_agora && i.proprios_agora.length > 0
    ? [[base(i.id, `modelo.itens[${k}].id`), numero(i.proprios_agora_n ?? i.proprios_agora.length, `modelo.itens[${k}].proprios_agora_n`), base(i.proprios_agora.join(', '), `modelo.itens[${k}].proprios_agora`)]] : []))
  if (linhas.length === 0) return []
  return [tabelaLista('sugestoes-seus-videos', 'Seus vídeos públicos que já falam do lugar (códigos)', 'tabela de seus vídeos por sugestão', ['Código da sugestão', 'Total de vídeos seus', 'Códigos dos vídeos seus (até 20)'], linhas)]
}

/** Quantos estouros por sugestão o pacote lista (os mais fortes); o número verdadeiro vai na coluna "Vídeos estourando" da tabela principal. */
export const ESTOUROS_POR_SUGESTAO_NO_PACOTE = 1
/** As sugestões que o pacote lê (as mais fortes): 18 (eram 20 até a tabela de tráfego da F4, que sozinha pesa ~150 caracteres por sugestão; com 19 sobravam 17 caracteres) com o estouro máximo cabem nos 60.000 caracteres da ação sem o corte por tamanho tirar linha; o `n` verdadeiro segue dito. */
export const SUGESTOES_NO_PACOTE = 18

function tabelaEstouros(m: ModeloSugestoes): Tabela[] {
  const linhas = m.itens.flatMap((i, k) => i.evidence.outliers.map((o, j) => ({ o, j })).sort((a, b) => b.o.mult_vpd7 - a.o.mult_vpd7 || a.j - b.j).slice(0, ESTOUROS_POR_SUGESTAO_NO_PACOTE).map(({ o, j }): Celula[] => {
    const p = `modelo.itens[${k}].evidence.outliers[${j}]`
    return [
      base(i.id, `modelo.itens[${k}].id`), base(o.video_id, `${p}.video_id`), base(o.canal_id, `${p}.canal_id`), rotulo(o.formato === 'short' ? 'Short' : 'longo', `${p}.formato`),
      numero(o.mult_vpd7, `${p}.mult_vpd7`), numero(o.mult_tela, `${p}.mult_tela`), numero(o.vpd7, `${p}.vpd7`), base(dataSp(o.published_at), `${p}.published_at`),
    ]
  }))
  if (linhas.length === 0) return []
  return [tabelaLista('sugestoes-estouros', 'O vídeo de concorrente que mais estourou em cada sugestão (códigos)', 'tabela de vídeos que estouraram',
    ['Código da sugestão', 'Código do vídeo', 'Código do canal', 'Formato', 'Vezes acima da mediana do canal', 'Multiplicador mostrado na tela', 'Visualizações por dia (7 dias)', 'Publicado em'], linhas)]
}

// ───────────────────────── o empacotador
export function empacotarSugestoes(modelo: ModeloSugestoes): PacoteModelo {
  const avisos = [RODAPE_SUGESTOES]
  const regras = [...new Set(modelo.itens.map((i) => i.rule_version))]
  if (regras.length > 0) avisos.push(`Regra de cálculo: ${regras.join(', ')}.`)
  if (modelo.n > modelo.itens.length) avisos.push(`A lista leva as ${modelo.itens.length} mais fortes de ${modelo.n} sugestões abertas.`)
  if (modelo.desatualizado && modelo.computadoEm !== null) avisos.push('O último cálculo tem mais de 36 horas: o que está aqui pode já ter mudado.')
  return {
    tela: 'sugestoes',
    janela: `Sugestões do nicho, ${modelo.itens.length} de ${modelo.n} abertas`,
    foco: [],
    tabelas: [...tabelaResumo(modelo), ...tabelaContagens(modelo), ...tabelaItens(modelo), ...tabelaTrafego(modelo), ...tabelaSeusVideos(modelo), ...tabelaEstouros(modelo)],
    citados: [],
    definicoes: [
      { medida: 'Já recebo tráfego dele', frase: 'Se o YouTube informou visitas vindas do vídeo do concorrente (origem "vídeos sugeridos") para algum vídeo seu desde que ele foi publicado. "Não medido" não é "não": falta dado, cobertura ou direito de leitura, e o motivo vem na coluna ao lado; o "não" só vale até a data conferida.', limiares: [] },
      { medida: 'Força', frase: 'Combina quanto cada vídeo estourou acima do normal do canal, quantos canais estouraram no mesmo lugar e há quantos dias; serve para ordenar, não é uma nota de resultado.', limiares: [] },
      { medida: 'Vezes acima da mediana do canal', frase: 'Visualizações por dia nos 7 primeiros dias do vídeo dividido pela mediana dos vídeos do canal no mesmo formato; não é o multiplicador mostrado na tela.', limiares: [] },
      { medida: 'Seus vídeos sobre o lugar hoje', frase: 'Quantos vídeos públicos seus citam o lugar agora; "não medido" quando os lugares dos seus vídeos ainda não foram calculados.', limiares: [] },
    ],
    avisos,
    naoMede: [NAO_MEDE_CAUSA, NAO_MEDE_PROPRIO, NAO_MEDE_TEXTO],
    privado: { estado: 'na' },
    comentarios: { estado: 'na' },
    vazio: modelo.textoDoVazio,
    motivoDoMagro: null,
    listasCompletas: false,
  }
}
