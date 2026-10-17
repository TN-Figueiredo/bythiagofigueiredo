// E17 d1 (TG): o modelo do criador (célula, bloco e lista) a partir da leitura dos comentários. A página do canal e o pacote "Perguntar a uma IA"
// chamam ESTA função, para os dois nunca divergirem. Puro: a leitura entra pronta.
import type { CanalDerivado, ContextoDoCanal } from './canal-derivado'
import type { ComentariosDoCanal } from './comentarios-do-canal'
import { criadorDoCanal, type ModeloDoCriador } from './criador-model'
import { listaDoCriador, type ModeloDaLista } from './criador-lista-model'

export type ContextoDeComentarios = NonNullable<ContextoDoCanal['comentarios']>

export function criadorComLeitura(
  k: ContextoDeComentarios, contexto: Pick<ContextoDoCanal, 'agoraMs' | 'hojeSP' | 'thumbs'>, d: CanalDerivado, lidos: ComentariosDoCanal,
): { modelo: ModeloDoCriador; lista: ModeloDaLista | null } {
  const modelo = criadorDoCanal({ nome: k.nome, formato: d.formato, videos: d.videos, contagem: lidos.contagem, estado: d.estado, agoraMs: contexto.agoraMs, hojeSP: contexto.hojeSP })
  const lista = modelo.bloco.tipo === 'medido' || modelo.bloco.tipo === 'zero' || modelo.bloco.tipo === 'nao_medido'
    ? listaDoCriador({ nome: k.nome, resposta: lidos.respostas, videos: d.videos, titulos: d.titulos, thumbs: new Map(contexto.thumbs), nBase: modelo.bloco.nBase, permissaoFalhou: k.permissaoFalhou })
    : null
  return { modelo, lista }
}
