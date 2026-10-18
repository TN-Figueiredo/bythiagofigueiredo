// Portão do dHash (P4-0 do A/B Lab, spec 3.4 e emenda 30). Números deste arquivo = o que o Yannis revisa.
export const VIDEOS_APROVADOS = ['6jL-jeux_1Y', 'WDRy_uldCI8', 'Uy5_DPzoGi8'] as const // dono, 14/10/2026: Lolzin D5 e reserva; 18/10/2026: Uy5 (menos views, sem maxres) para o devolver-hq e o ensaio

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

export type ComandoDeVideo = 'ensaio' | 'valer' | 'devolver' | 'devolver-hq' | 'conferir'
export type Args =
  | { ok: true; comando: ComandoDeVideo; video: string; aceitarMenor: boolean }
  | { ok: true; comando: 'medir'; video: string; referencias: string[] }
  | { ok: true; comando: 'distancias'; arquivos: string[] }
  | { ok: false; erro: string }

const USO = 'uso: portao-dhash <ensaio|valer|devolver|devolver-hq|conferir> <id> [--aceitar-menor] | medir <id> <url|arquivo>... | distancias <a.jpg> <b.jpg> [...]'

export function lerArgs(argv: string[]): Args {
  const [comando, ...resto] = argv
  if (comando === 'distancias') {
    return resto.length >= 2 ? { ok: true, comando, arquivos: resto } : { ok: false, erro: `distancias pede dois arquivos ou mais. ${USO}` }
  }
  if (comando === 'medir') {
    // cota 0, só lê: aceita qualquer id (a lista aprovada vale para quem ESCREVE)
    const [video, ...referencias] = resto
    if (!video || !/^[A-Za-z0-9_-]{11}$/.test(video)) return { ok: false, erro: `medir pede um id de vídeo de 11 caracteres. ${USO}` }
    return referencias.length >= 1 ? { ok: true, comando, video, referencias } : { ok: false, erro: `medir pede ao menos uma referência (url ou arquivo). ${USO}` }
  }
  if (comando !== 'ensaio' && comando !== 'devolver-hq' && comando !== 'valer' && comando !== 'devolver' && comando !== 'conferir') return { ok: false, erro: USO }
  const [video, ...flags] = resto
  if (!video) return { ok: false, erro: USO }
  if (!(VIDEOS_APROVADOS as readonly string[]).includes(video)) return { ok: false, erro: `o vídeo ${video} não está na lista aprovada pelo dono (${VIDEOS_APROVADOS.join(', ')})` }
  const desconhecida = flags.find((f) => f !== '--aceitar-menor' || comando === 'devolver-hq')
  if (desconhecida) return { ok: false, erro: `flag desconhecida: ${desconhecida}. ${USO}` }
  return { ok: true, comando, video, aceitarMenor: flags.includes('--aceitar-menor') }
}
