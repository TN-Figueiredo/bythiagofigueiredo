// Nome legível de uma chave de lugar (F3 T3). Fora do React; texto vai sempre como texto React.

/** `pais:vn` -> "Vietnã"; `local:sao-tome` -> "Sao tome"; outro prefixo -> a própria chave. */
export function nomeDoLugar(chave: string): string {
  if (chave.startsWith('pais:')) {
    const cod = chave.slice(5).toUpperCase()
    try {
      return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(cod) ?? cod
    } catch {
      return cod
    }
  }
  if (chave.startsWith('local:')) {
    const t = chave.slice(6).replace(/-/g, ' ').trim()
    return t === '' ? chave : t.charAt(0).toUpperCase() + t.slice(1)
  }
  return chave
}
