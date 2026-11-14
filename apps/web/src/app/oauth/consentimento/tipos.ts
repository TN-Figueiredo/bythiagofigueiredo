// Tipos da tela de consentimento (sem 'use server'/'use client': importável dos dois lados).

/** Os estados de 4.4 do spec que a tela mostra no lugar do pedido. `aprovado` e `negado` não existem: viram `redirect()`. */
export type EstadoDaTela =
  | { estado: 'sem_login' }
  | { estado: 'sem_direito' }
  | { estado: 'cortado' }
  | { estado: 'desligado' }
  | { estado: 'invalido' }
  | { estado: 'outro_navegador' }
  | { estado: 'erro'; codigo: string }

export interface DadosDoPedido {
  /** 'ChatGPT' | 'Claude' | 'Gemini': do mapa de redirects (D5), nunca do nome declarado pelo cliente. */
  ia: string
  email: string | null
  /** HH:MM em São Paulo. */
  hora: string
  /** Pedido com mais de 3 minutos: aviso reforçado (limiar de desenho, 1d). */
  tarde: boolean
  privado: boolean
  /** dd/mm/aaaa; `null` = a linha some. */
  valeAte: string | null
  jaConectado: boolean
}

export type AcaoDaTela = (fd: FormData) => Promise<EstadoDaTela>

export const caminhoDoPedido = (id: string): string => `/oauth/consentimento?authorization_id=${id}`
export const caminhoDoLogin = (id: string): string => `/cms/login?next=${encodeURIComponent(caminhoDoPedido(id))}`
