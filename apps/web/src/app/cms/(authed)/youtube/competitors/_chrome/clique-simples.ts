/** Clique simples, de botão principal, sem tecla de modificação: o único que navega na mesma aba (os outros abrem outra aba ou outra janela). */
export const cliqueSimples = (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }): boolean =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
