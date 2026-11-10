// A7 T6: o formato e um exemplo válido de cada ação. A recusa de um pedido (`responder`) e a descrição da ferramenta (`servidor`) leem daqui.
// `CAMPOS_DA_ACAO` sai de `ENTRADA.options` (um só lugar): campo novo no esquema aparece aqui sozinho e o teste de inventário cobra o formato.
// Os exemplos levam `<...>` no lugar dos ids (a pessoa lê o que cada um é); `exemploValido` troca pelos valores de teste.
import { ACOES, ENTRADA, type Acao } from './acoes'

export const CAMPOS_DA_ACAO: Readonly<Record<Acao, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    ENTRADA.options.map((o) => [o.shape.acao.value, Object.keys(o.shape).filter((k) => k !== 'acao').sort()]),
  ) as Record<Acao, readonly string[]>,
)
/** Todos os campos que algum pedido aceita (mais `acao`), na ordem do esquema. */
export const TODOS_OS_CAMPOS: readonly string[] = Object.freeze(['acao', ...new Set(ENTRADA.options.flatMap((o) => Object.keys(o.shape).filter((k) => k !== 'acao')))])

export const FORMATO_DA_ACAO: Readonly<Record<Acao, string>> = {
  definicoes: 'sem campos além de acao',
  listar_canais: 'formato (todos, longos ou shorts), nicho e janela (7, 30, 90 ou todas) opcionais',
  canal: 'canal_id (uuid da coluna Id de listar_canais) obrigatório; janela (7, 30, 90 ou todas) e formato (todos, longos ou shorts) opcionais',
  video: 'video_id (uuid ou id de 11 caracteres) obrigatório',
  comparar: 'canal_ids (de 2 a 6; o 1º pode ser proprio) obrigatório; janela e formato opcionais',
  destaques: 'janela (7, 30, 90 ou todas), formato (todos, longos ou shorts) e nicho opcionais',
  serie: 'canal_id ou video_id (um dos dois), de e ate (AAAA-MM-DD, de ≤ ate) obrigatórios; grao (dia ou semana) opcional',
  mudancas: 'canal_id, desde (AAAA-MM-DD), janela (7, 30, 90 ou todas), formato (todos, longos ou shorts) e nicho opcionais',
  sugestoes: 'sem campos além de acao',
  pacote_da_tela: 'tela obrigatória; id e parametros (pares chave:valor) opcionais',
}

export const EXEMPLO_DA_ACAO: Readonly<Record<Acao, string>> = {
  definicoes: '{"acao":"definicoes"}',
  listar_canais: '{"acao":"listar_canais","formato":"longos"}',
  canal: '{"acao":"canal","canal_id":"<uuid da coluna Id>","janela":"30"}',
  video: '{"acao":"video","video_id":"<id de 11 caracteres>"}',
  comparar: '{"acao":"comparar","canal_ids":["proprio","<uuid>","<uuid>"]}',
  destaques: '{"acao":"destaques","janela":"90","formato":"longos"}',
  serie: '{"acao":"serie","canal_id":"<uuid>","de":"2026-10-05","ate":"2026-11-08","grao":"semana"}',
  mudancas: '{"acao":"mudancas","janela":"30","formato":"todos"}',
  sugestoes: '{"acao":"sugestoes"}',
  pacote_da_tela: '{"acao":"pacote_da_tela","tela":"insights","parametros":{"fmt":"long"}}',
}

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
