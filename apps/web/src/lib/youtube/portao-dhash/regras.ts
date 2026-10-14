// Portão do dHash (P4-0 do A/B Lab, spec 3.4 e emenda 30). Números deste arquivo = o que o Yannis revisa.
export const VIDEOS_APROVADOS = ['6jL-jeux_1Y', 'WDRy_uldCI8'] as const // dono, 14/10/2026: Lolzin D5 e reserva

export const PORTAO = {
  intervaloMs: 5 * 60_000,          // sonda a cada 5 min (URL pública, cota zero)
  tetoMs: 12 * 3_600_000,           // 12 h para aparecer; 12 h para voltar
  sondasEstaveis: 3,                // "apareceu" = 3 leituras seguidas
  distanciaMinimaTeste: 20,         // a imagem de teste tem de ser bem diferente da original
  tentativasDevolucao: 2,
  esperaEntreDevolucoesMs: 60_000,
  limiteBytes: 2 * 1024 * 1024,     // limite do thumbnails.set
  horasDaRegra: 3,                  // a regra da 3.3 que o portão confirma ou corrige
  cota: { videosList: 1, thumbnailsSet: 50 },
} as const

export class Recusa extends Error {
  constructor(m: string) { super(m); this.name = 'Recusa' }
}

export type ComandoDeVideo = 'ensaio' | 'valer' | 'devolver' | 'conferir'
export type Args =
  | { ok: true; comando: ComandoDeVideo; video: string; aceitarMenor: boolean }
  | { ok: true; comando: 'distancias'; arquivos: string[] }
  | { ok: false; erro: string }

const USO = 'uso: portao-dhash <ensaio|valer|devolver|conferir> <id> [--aceitar-menor] | distancias <a.jpg> <b.jpg> [...]'

export function lerArgs(argv: string[]): Args {
  const [comando, ...resto] = argv
  if (comando === 'distancias') {
    return resto.length >= 2 ? { ok: true, comando, arquivos: resto } : { ok: false, erro: `distancias pede dois arquivos ou mais. ${USO}` }
  }
  if (comando !== 'ensaio' && comando !== 'valer' && comando !== 'devolver' && comando !== 'conferir') return { ok: false, erro: USO }
  const [video, ...flags] = resto
  if (!video) return { ok: false, erro: USO }
  if (!(VIDEOS_APROVADOS as readonly string[]).includes(video)) return { ok: false, erro: `o vídeo ${video} não está na lista aprovada pelo dono (${VIDEOS_APROVADOS.join(', ')})` }
  const desconhecida = flags.find((f) => f !== '--aceitar-menor')
  if (desconhecida) return { ok: false, erro: `flag desconhecida: ${desconhecida}. ${USO}` }
  return { ok: true, comando, video, aceitarMenor: flags.includes('--aceitar-menor') }
}
