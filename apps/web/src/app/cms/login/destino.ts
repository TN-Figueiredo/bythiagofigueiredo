// Só caminho relativo do próprio site: fecha o open redirect do `next` (D15).
export function destinoSeguro(next: string | undefined): string {
  return next && /^\/(?!\/)[^\\\x00-\x1f\x7f]*$/.test(next) ? next : '/cms'
}
