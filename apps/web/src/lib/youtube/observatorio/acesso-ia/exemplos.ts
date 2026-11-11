// A7 T6: o formato e um exemplo válido de cada ação. A recusa de um pedido (`responder`) e a descrição da ferramenta (`servidor`) leem daqui.
// `CAMPOS_DA_ACAO` sai de `ENTRADA.options` (um só lugar): campo novo no esquema aparece aqui sozinho e o teste de inventário cobra o formato.
// Os exemplos levam `<...>` no lugar dos ids (a pessoa lê o que cada um é); `exemploValido` troca pelos valores de teste.
import { ACOES, ENTRADA, type Acao } from './acoes'

const CAMPOS_POR_ACAO = new Map<string, readonly string[]>(
  ENTRADA.options.map((o) => [o.shape.acao.value, Object.keys(o.shape).filter((k) => k !== 'acao').sort()]),
)
const camposDe = (a: Acao): readonly string[] => {
  const campos = CAMPOS_POR_ACAO.get(a)
  if (!campos) throw new Error(`ação sem esquema em ENTRADA: ${a}`)
  return campos
}
export const CAMPOS_DA_ACAO: Readonly<Record<Acao, readonly string[]>> = Object.freeze(
  ACOES.reduce<Partial<Record<Acao, readonly string[]>>>((acc, a) => ({ ...acc, [a]: camposDe(a) }), {}) as Record<Acao, readonly string[]>,
)
/** Todos os campos que algum pedido aceita (mais `acao`), na ordem do esquema. */
export const TODOS_OS_CAMPOS: readonly string[] = Object.freeze(['acao', ...new Set(ENTRADA.options.flatMap((o) => Object.keys(o.shape).filter((k) => k !== 'acao')))])

export const FORMATO_DA_ACAO: Readonly<Record<Acao, string>> = {
  definicoes: 'sem campos além de acao',
  listar_canais: 'formato (todos, longos ou shorts) e nicho opcionais; a_partir_da_linha (1 em diante: a 1ª linha da janela) e marca (a que a Cobertura devolveu) opcionais; saida (texto ou tabela: tabela devolve CSV para gráfico e planilha) opcional; janela é aceita, mas a tela Canais não a aplica',
  canal: 'canal_id (uuid da coluna Id de listar_canais) obrigatório; formato (todos, longos ou shorts) opcional; janela é aceita, mas a tela Canal não a aplica',
  video: 'video_id (uuid ou id de 11 caracteres) obrigatório',
  comparar: 'canal_ids (de 2 a 6; o 1º pode ser proprio) obrigatório; janela e formato são aceitos, mas a tela Comparar não os aplica',
  destaques: 'janela (7, 30, 90 ou todas), formato (todos, longos ou shorts), nicho, a_partir_da_linha (a 1ª linha da janela) e marca (a que a Cobertura devolveu) opcionais; saida (texto ou tabela: tabela devolve CSV para gráfico e planilha) opcional',
  serie: 'canal_id, video_id ou canal_ids (um dos três; canal_ids: de 1 a 6 canais, o 1º pode ser proprio, sempre em tabela), de e ate (AAAA-MM-DD, de ≤ ate) obrigatórios; grao (dia ou semana) e saida (texto ou tabela: tabela devolve CSV para gráfico e planilha; com canal_ids só tabela) opcionais',
  mudancas: 'canal_id, janela (7, 30, 90 ou todas), formato (todos, longos ou shorts) e nicho opcionais; a_partir_da_linha e marca (da Cobertura) opcionais; saida (texto ou tabela: tabela devolve CSV) opcional; desde (AAAA-MM-DD) é aceito, mas não filtra: use janela',
  sugestoes: 'sem campos além de acao',
  pacote_da_tela: 'tela obrigatória; id e parametros (pares chave:valor) opcionais',
  consultar: 'todos opcionais: lugar (local:<slug> ou pais:<XX>, os de definicoes), formato (todos, longos ou shorts), janela_idade (todas, uma faixa ou lista: 0-30, 31-90, 91-180, 181-365, 365+), canal_ids (até 6 uuids), nicho, publicado_de e publicado_ate (AAAA-MM-DD), metricas (views, likes, comentarios, vpd7, multiplicador, engajamento, inscritos), ordenar_por (uma delas; padrão multiplicador), direcao (desc ou asc), limite (1 a 50; padrão 20), incluir_base_fraca (true ou false); entidade só "video"; a lista não tem janela',
}

export const EXEMPLO_DA_ACAO: Readonly<Record<Acao, string>> = {
  definicoes: '{"acao":"definicoes"}',
  listar_canais: '{"acao":"listar_canais","formato":"longos","a_partir_da_linha":41,"saida":"tabela"}',
  canal: '{"acao":"canal","canal_id":"<uuid da coluna Id>","formato":"longos"}',
  video: '{"acao":"video","video_id":"<id de 11 caracteres>"}',
  comparar: '{"acao":"comparar","canal_ids":["proprio","<uuid 1>","<uuid 2>"]}',
  destaques: '{"acao":"destaques","janela":"90","formato":"longos"}',
  serie: '{"acao":"serie","canal_id":"<uuid>","de":"2026-10-05","ate":"2026-11-08","grao":"semana","saida":"tabela"}',
  mudancas: '{"acao":"mudancas","janela":"30","formato":"todos"}',
  sugestoes: '{"acao":"sugestoes"}',
  pacote_da_tela: '{"acao":"pacote_da_tela","tela":"insights","parametros":{"fmt":"long"}}',
  consultar: '{"acao":"consultar","lugar":"local:vn-hanoi","formato":"longos","ordenar_por":"views","limite":20}',
}

/** A5 F2b: o 2º exemplo da `serie` (vários canais, na mesma linha do gráfico); a `DESCRICAO` da ferramenta o lista logo depois do da ação. */
export const EXEMPLO_DA_SERIE_DE_CANAIS = '{"acao":"serie","canal_ids":["proprio","<uuid 1>","<uuid 2>"],"de":"2026-10-05","ate":"2026-11-08","grao":"semana","saida":"tabela"}'

/** O exemplo com os `<...>` trocados por valores de teste. `comparar` leva dois uuids diferentes (o esquema recusa o mesmo canal duas vezes). */
export function exemploValido(a: Acao, fix: { uuid: string; video: string }): string {
  let n = 0
  const outro = (): string => (n++ === 0 ? fix.uuid : fix.uuid.replace(/^./, 'a'))
  return EXEMPLO_DA_ACAO[a].replace(/<uuid[^>]*>/g, outro).replace(/<id de 11 caracteres>/g, fix.video)
}

const EXEMPLO_DA_LISTA = '{"acao":"listar_canais"}'

/**
 * O que a recusa acrescenta: formato e exemplo da ação (ação conhecida) ou a lista das ações. `acao` é a que a pessoa mandou, SÓ se estiver em `ACOES`:
 * nunca se ecoa texto dela.
 */
export function sufixoDeRecusa(acao: unknown): string {
  if (typeof acao === 'string' && (ACOES as readonly string[]).includes(acao)) {
    const a = acao as Acao
    return `Formato de ${a}: ${FORMATO_DA_ACAO[a]}. Exemplo válido: ${EXEMPLO_DA_ACAO[a]}`
  }
  return `Ações: ${ACOES.join(', ')}. Exemplo válido: ${EXEMPLO_DA_LISTA}`
}

/** `pedido recusado: <o que o esquema (ou o tradutor) disse>. <sufixo>`. `doEsquema` já vem sem eco do que a pessoa escreveu. */
export function fraseDeRecusa(acao: Acao | null, doEsquema: string): string {
  return `pedido recusado: ${doEsquema}. ${sufixoDeRecusa(acao)}`
}
