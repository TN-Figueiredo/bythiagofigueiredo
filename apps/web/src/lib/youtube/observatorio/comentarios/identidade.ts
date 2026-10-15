/**
 * A tabela de identidade dos autores de comentario (dado pessoal de terceiro) so e NOMEADA dentro de `comentarios/` (varredura 2). Quem precisa
 * saber se uma tabela e essa (o painel 'o que some' da fila de saidos do YouTube) pergunta por esta funcao, sem adivinhar por prefixo.
 */
const TABELA_DE_IDENTIDADE = 'competitor_video_comment_authors'

export function ehTabelaDeIdentidade(nome: string): boolean {
  return nome === TABELA_DE_IDENTIDADE
}
