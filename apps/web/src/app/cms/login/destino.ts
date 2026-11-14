// Só caminho relativo do próprio site: fecha o open redirect do `next` (D15).
export function destinoSeguro(next: string | undefined): string {
  return next && /^\/(?!\/)[^\\\x00-\x1f\x7f]*$/.test(next) ? next : '/cms'
}

// Ruling T21b: o middleware leva só o pathname em `next` e deixa `ia` solto no
// login. Recompõe `?ia=` somente para `next` EXATO `/cms/conectar-ia` e `ia`
// exata chatgpt|claude; o resultado ainda passa por destinoSeguro.
export function destinoDoLogin(next: string | undefined, ia: string | undefined): string {
  if (next === '/cms/conectar-ia' && (ia === 'chatgpt' || ia === 'claude')) {
    return destinoSeguro(`${next}?ia=${ia}`)
  }
  return destinoSeguro(next)
}
