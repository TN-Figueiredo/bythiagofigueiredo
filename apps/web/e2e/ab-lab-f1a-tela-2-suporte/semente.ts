// Semente da suíte do Gio para a F1a-tela-2 (envio A). Parte da semente da tela-1 (`semear`, site próprio `gio-f1a-tela-1`, host f1a.localhost,
// SÓ no Supabase local padrão 54322) e troca/acrescenta os registros do dia 14: ficha de 2 e de 3 versões, derivada com e sem o título de antes,
// "sem resposta" de 3 versões e de derivada, `sem_versoes` e títulos hostis. Toda data é relativa a `m.agora` (nenhum ano fixo).
import { createHash } from 'node:crypto'
import { conectar, DIA, prepararRegistro, T, type Mundo } from '../ab-lab-f1a-tela-1-suporte/semente'

export { consultar, executar, T, DIA, type Mundo } from '../ab-lab-f1a-tela-1-suporte/semente'
export type Registro = Parameters<typeof prepararRegistro>[1]

const HORA = 3_600_000
const dur = (m: Mundo, ms: number): Date => new Date(m.agora.getTime() - ms)
const BLOB = (nome: string): string => `https://gio.public.blob.vercel-storage.com/ab-native-ficha/${nome}.png`
const sha = (s: string): string => createHash('sha256').update(s).digest('hex')
const img = (nome: string): { url: string; sha256: string; largura: number; altura: number } => ({ url: BLOB(nome), sha256: sha(nome), largura: 1280, altura: 720 })

/** Extras que o `preparar` da tela-1 semeia (vídeos que a semente-base conhece). */
export const EXTRAS = ['hostil', 'sv_igual', 'sv_inconcl', 'sv_navi', 'tres', 'derivada', 'tardia_lv'] as const

export const TIT = {
  novoDer: 'Derivada: o título novo',
  antes: 'Rota 66 antes do título novo: o que eu escrevia',
  novoDerOrig: 'Derivada com original: o título novo',
  tardiaDer: ['Tardia derivada: o título novo', 'Tardia derivada: outro título novo'] as const,
  l100: 'Rota sem plano B e muito deserto pela frente, quase sem gasolina e sem sinal de celular em lugar nenhum xx'.slice(0, 99) + 'x',
  l90: 'W'.repeat(90),
  y90: 'Y'.repeat(90),
  z90: 'Z'.repeat(90),
}

/** Chave -> o rótulo do estado que ela representa (para os relatórios). */
export const ESTADO_DA_CHAVE: Record<string, string> = {
  sm: 'ficha de 2 versões (d14-duas)', tres: 'd14-tres', derivada: 'd14-derivada sem original', sv_igual: 'd14-derivada com original',
  sv_navi: 'd14-tardia-ask de 3 versões', sv_inconcl: 'd14-tardia-ask derivada', tardia_lv: 'd14-tardia-ask de 2 versões',
  gl: 'sem_versoes', hostil: 'três títulos de 90 letras', r66: '100 caracteres + miniatura nula',
}

const tresVersoes = (m: Mundo, chave: string, semC = false): Registro['variantes'] => [
  { n: 1, tipo: 'combo', titulo: m.v[chave]!.titulo, imagem: img(`${chave}-A`) },
  { n: 2, tipo: 'combo', titulo: `${chave}: a segunda versão`, imagem: img(`${chave}-B`) },
  semC ? { n: 3, tipo: 'titulo', titulo: TIT.l90 } : { n: 3, tipo: 'combo', titulo: `${chave}: a terceira versão`, imagem: img(`${chave}-C`) },
]

/** Os registros do dia 14 do envio A, por chave de vídeo. Cada função devolve um registro NOVO (id novo) para `refazer`. */
export const REGISTROS: Record<string, (m: Mundo) => Registro> = {
  sm: (m) => ({ video: m.v.sm!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(m, 14 * DIA + HORA), updatedAt: dur(m, 14 * DIA + HORA),
    variantes: [{ n: 1, tipo: 'combo', titulo: T.sm, imagem: img('sm-A') }, { n: 2, tipo: 'combo', titulo: T.SMB, imagem: img('sm-B') }] }),
  tres: (m) => ({ video: m.v.tres!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(m, 14 * DIA + HORA), variantes: tresVersoes(m, 'tres') }),
  // Derivada SEM o título de antes: não há linha em yt_own_video_versions -> "A ficou" / "B ficou".
  derivada: (m) => ({ video: m.v.derivada!, origem: 'detectado', estado: 'em_andamento', primeiraVista: dur(m, 14 * DIA + HORA), ultimaVista: dur(m, HORA), confirmadoEm: dur(m, 14 * DIA),
    campos: ['titulo'], variantesTitulo: [m.v.derivada!.titulo, TIT.novoDer], votos: { [m.v.derivada!.titulo]: 4, [TIT.novoDer]: 5 } }),
  // Derivada COM o título de antes (ordem ['B','A']: o de antes é o 2º; a tela o põe em primeiro): "A (original) ficou" / "B venceu".
  sv_igual: (m) => ({ video: m.v.sv_igual!, origem: 'detectado', estado: 'em_andamento', primeiraVista: dur(m, 14 * DIA + HORA), ultimaVista: dur(m, HORA), confirmadoEm: dur(m, 14 * DIA),
    campos: ['titulo'], variantesTitulo: [TIT.novoDerOrig, TIT.antes], votos: { [TIT.novoDerOrig]: 5, [TIT.antes]: 4 } }),
  // "Sem resposta" aos 17 dias, 3 versões de ficha.
  sv_navi: (m) => ({ video: m.v.sv_navi!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(m, 17 * DIA + HORA), variantes: tresVersoes(m, 'sv_navi') }),
  // "Sem resposta" de derivada de 3 títulos, com original.
  sv_inconcl: (m) => ({ video: m.v.sv_inconcl!, origem: 'detectado', estado: 'sem_desfecho', primeiraVista: dur(m, 25 * DIA + HORA), ultimaVista: dur(m, 10 * DIA), confirmadoEm: dur(m, 25 * DIA),
    encerradoEm: dur(m, 9 * DIA), campos: ['titulo'], variantesTitulo: [TIT.tardiaDer[0], TIT.tardiaDer[1], TIT.antes], resposta: 'sem_resposta' }),
  tardia_lv: (m) => ({ video: m.v.tardia_lv!, origem: 'confirmado', estado: 'sem_desfecho', confirmadoEm: dur(m, 25 * DIA), encerradoEm: dur(m, 9 * DIA), resposta: 'sem_resposta',
    variantes: [{ n: 1, tipo: 'combo', titulo: m.v.tardia_lv!.titulo, imagem: img('tardia-A') }, { n: 2, tipo: 'combo', titulo: 'Tardia: a versão nova', imagem: img('tardia-B') }] }),
  // Versões ilegíveis (nem ficha nem títulos): a pergunta cai em `sem_versoes`.
  gl: (m) => ({ video: m.v.gl!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(m, 14 * DIA + HORA), variantes: null, variantesTitulo: null }),
  // Títulos hostis: 90 letras sem espaço nas três versões.
  hostil: (m) => ({ video: m.v.hostil!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(m, 14 * DIA + HORA),
    variantes: [{ n: 1, tipo: 'combo', titulo: m.v.hostil!.titulo, imagem: img('hostil-A') }, { n: 2, tipo: 'combo', titulo: TIT.y90, imagem: img('hostil-B') }, { n: 3, tipo: 'combo', titulo: TIT.z90, imagem: img('hostil-C') }] }),
  // 100 caracteres com espaços em B; 90 letras sem espaço em C; C sem miniatura ("não medido").
  r66: (m) => ({ video: m.v.r66!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(m, 14 * DIA + HORA),
    variantes: [{ n: 1, tipo: 'combo', titulo: m.v.r66!.titulo, imagem: img('r66-A') }, { n: 2, tipo: 'combo', titulo: TIT.l100, imagem: img('r66-B') }, { n: 3, tipo: 'titulo', titulo: TIT.l90 }] }),
}

/** O título de antes (linha de base) para a derivada: é ele que faz a tela saber qual versão é a original. */
async function versaoDeAntes(m: Mundo, chave: string, titulo: string, vistoHa: number): Promise<void> {
  const c = await conectar()
  try {
    const x = m.v[chave]!
    const vista = dur(m, vistoHa)
    const dia = vista.toISOString().slice(0, 10)
    await c.query(
      `insert into public.yt_own_video_versions (youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt,
          first_seen_at, last_seen_at, window_precision, origin, is_current)
       values ($1,$2,$3,$4,'title',$5,$6,$7,$7,$8,$8,'first','linha_de_base',false)`,
      [x.yt, m.siteId, x.id, m.canalDb, titulo, 'abcdef0123456789abcdef0123456789', dia, vista.toISOString()])
  } finally { await c.end() }
}

/** Apaga o registro do vídeo e semeia o registro da chave de novo (id novo, estado de partida). */
export async function refazer(m: Mundo, chave: string): Promise<void> {
  const c = await conectar()
  try {
    await c.query('delete from public.ab_native_tests where video_id = $1', [m.v[chave]!.id])
    await c.query('delete from public.yt_own_video_versions where youtube_video_id = $1', [m.v[chave]!.yt])
  } finally { await c.end() }
  const def = REGISTROS[chave]
  if (!def) throw new Error(`sem definição de registro para ${chave}`)
  await prepararRegistro(m, def(m))
  if (chave === 'sv_igual') await versaoDeAntes(m, chave, TIT.antes, 40 * DIA)
  if (chave === 'sv_inconcl') await versaoDeAntes(m, chave, TIT.antes, 60 * DIA)
}

/** Depois do `semear` da tela-1: refaz os registros que a tela-2 cobra com a forma que o brief pede. */
export async function ajustarT2(m: Mundo): Promise<void> {
  for (const chave of Object.keys(REGISTROS)) await refazer(m, chave)
}
