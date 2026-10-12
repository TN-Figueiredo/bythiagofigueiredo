/**
 * A escolha do dono de qual é "o meu canal" quando o site tem mais de um canal próprio (design D-C.2). Fica num cookie do navegador, porque os
 * links "Comparar" são montados no SERVIDOR e só o cookie chega nos dois lados. Sem banco, sem migration, sem server action: quem escreve é o
 * navegador, num gesto do dono (clique no menu "Meu canal", troca de seletor na comparação), nunca ao abrir uma tela.
 *
 * O valor é só o id do canal (um uuid): nenhum dado pessoal. `path=/cms` (o cookie só viaja nas páginas do CMS), `SameSite=Lax`, um ano, e
 * `Secure` quando a página é https (produção). Sem `HttpOnly` de propósito: a escrita é do navegador. Valor que não é uuid, de canal removido
 * ou que não é próprio é ignorado por quem lê (`escolherPrincipal` só considera candidatos), sem erro.
 */
export const COOKIE_MEU_CANAL = 'obs-meu-canal'
const UM_ANO = 31_536_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** O valor bruto do cookie vira o id, ou `null` (ausente, vazio, lixo). */
export function parseMeuCanal(raw: string | null | undefined): string | null {
  return typeof raw === 'string' && UUID.test(raw) ? raw : null
}

/** Grava a escolha. `try/catch`: se o navegador recusar o cookie, a tela já mudou e nada se perde. */
export function lembrarMeuCanal(id: string): void {
  if (parseMeuCanal(id) == null) return
  try {
    const seguro = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${COOKIE_MEU_CANAL}=${id}; path=/cms; max-age=${UM_ANO}; samesite=lax${seguro}`
  } catch { /* conforto: a tela já mudou */ }
}

/** A escolha como o navegador a tem (quando o servidor não a mandou: partes da comparação que rodam só no cliente). */
export function lerMeuCanalNoNavegador(): string | null {
  try {
    for (const par of document.cookie.split(';')) {
      const i = par.indexOf('=')
      if (i > 0 && par.slice(0, i).trim() === COOKIE_MEU_CANAL) return parseMeuCanal(decodeURIComponent(par.slice(i + 1).trim()))
    }
  } catch { /* sem cookie */ }
  return null
}
