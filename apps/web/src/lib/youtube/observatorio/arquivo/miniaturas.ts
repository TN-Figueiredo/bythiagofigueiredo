/**
 * A5 · E10: o download das miniaturas dos vídeos do canal, para dentro da pasta do export. Só `node:` e importação relativa.
 * O `fetch` real chega por parâmetro (`criarBaixar`); aqui só há a política: 4 downloads ao mesmo tempo, até 3 tentativas por URL,
 * 200 grava, 404 é "ausente" (o dono decide se aceita), qualquer outra coisa (403, 429, 5xx, prazo, rede) para o export.
 */

export type Baixar = (url: string) => Promise<{ status: number; corpo: Uint8Array | null }>
export interface MiniaturaBaixada { url: string; status: number; corpo: Uint8Array | null }

export const PRAZO_DA_MINIATURA_MS = 15_000

/** Status 0 = a rede falhou ou passou do prazo (não houve resposta HTTP). */
export function criarBaixar(buscar: (url: string, init: { signal: AbortSignal }) => Promise<{ status: number; arrayBuffer(): Promise<ArrayBuffer> }>, prazoMs: number = PRAZO_DA_MINIATURA_MS): Baixar {
  return async url => {
    try {
      const r = await buscar(url, { signal: AbortSignal.timeout(prazoMs) })
      if (r.status !== 200) return { status: r.status, corpo: null }
      return { status: 200, corpo: new Uint8Array(await r.arrayBuffer()) }
    } catch {
      return { status: 0, corpo: null }
    }
  }
}

/** 200 e 404 são respostas finais; o resto pode ser passageiro e é tentado de novo, até `tentativas` vezes. O resultado vem na ordem de `urls`. */
export async function baixarMiniaturas(urls: string[], o: { baixar: Baixar; paralelo: number; tentativas: number }): Promise<MiniaturaBaixada[]> {
  const out: MiniaturaBaixada[] = new Array(urls.length)
  let proxima = 0
  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const i = proxima++
      if (i >= urls.length) return
      const url = urls[i]!
      let ultimo: { status: number; corpo: Uint8Array | null } = { status: 0, corpo: null }
      for (let t = 0; t < o.tentativas; t++) {
        try {
          ultimo = await o.baixar(url)
        } catch {
          ultimo = { status: 0, corpo: null }
        }
        if (ultimo.status === 200 || ultimo.status === 404) break
      }
      out[i] = { url, status: ultimo.status, corpo: ultimo.status === 200 ? ultimo.corpo : null }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.paralelo, urls.length)) }, trabalhador))
  return out
}
