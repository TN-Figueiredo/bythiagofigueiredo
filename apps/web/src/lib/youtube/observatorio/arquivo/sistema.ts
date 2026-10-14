/**
 * Arquivos que o Finder e o Explorer criam sozinhos na pasta que o dono abre para copiar ao NAS. Não são parte da exportação:
 * nem `conferir` nem `exportar` os contam (revisão Yannis 14/10, M-1 e M8). Casa pelo nome base do caminho.
 */
export const ARQUIVOS_DO_SISTEMA: readonly string[] = ['.DS_Store', 'Thumbs.db']

export const ehArquivoDoSistema = (caminho: string): boolean => ARQUIVOS_DO_SISTEMA.includes(caminho.slice(caminho.lastIndexOf('/') + 1))
