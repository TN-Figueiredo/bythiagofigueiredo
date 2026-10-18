/** §4.1: NFC, tira invisíveis (mantém ZWJ), colapsa espaços Unicode, trim. Não mexe em caixa, acento, emoji nem entidade. */
export function normalizarTitulo(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[​﻿⁠︎️]/g, '')
    .replace(/[\s  ]+/g, ' ')
    .trim()
}

/** Ordem por code point (UTF-16 colocaria um par substituto antes de U+FFFF). */
export function compararCodePoint(a: string, b: string): number {
  const ia = a[Symbol.iterator]()
  const ib = b[Symbol.iterator]()
  for (;;) {
    const x = ia.next()
    const y = ib.next()
    if (x.done && y.done) return 0
    if (x.done) return -1
    if (y.done) return 1
    const cx = x.value.codePointAt(0) as number
    const cy = y.value.codePointAt(0) as number
    if (cx !== cy) return cx < cy ? -1 : 1
  }
}
