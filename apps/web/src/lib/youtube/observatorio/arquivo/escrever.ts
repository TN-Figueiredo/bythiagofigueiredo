/** Escrita drenada no stdout: `process.exit` logo após `write` corta a saída de um pipe em 64 KB (D-F23). */
export function escreverTudo(texto: string): Promise<void> {
  return new Promise(ok => { process.stdout.write(texto, () => ok()) })
}
