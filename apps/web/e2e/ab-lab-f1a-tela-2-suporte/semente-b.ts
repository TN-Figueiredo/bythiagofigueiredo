// Semente do ENVIO B da F1a-tela-2 (Gio, T9): vídeos NOVOS (não mexe nos do envio A nem nos da tela-1) com a linha respondida em cada forma, os conflitos e os
// vídeos de fluxo ("Mudar minha resposta"). Escreve SÓ no Supabase local padrão (54322), no site `gio-f1a-tela-1`. Toda data é relativa a `m.agora`.
import { createHash } from 'node:crypto'
import { conectar, DIA, executar, prepararRegistro, type Mundo } from '../ab-lab-f1a-tela-1-suporte/semente'
import type { Registro } from './semente'

const HORA = 3_600_000
const dur = (m: Mundo, ms: number): Date => new Date(m.agora.getTime() - ms)
const sha = (s: string): string => createHash('sha256').update(s).digest('hex')
const img = (nome: string): { url: string; sha256: string; largura: number; altura: number } =>
  ({ url: `https://gio.public.blob.vercel-storage.com/ab-native-ficha/${nome}.png`, sha256: sha(nome), largura: 1280, altura: 720 })

export const NO_AR_DESCONHECIDO = 'Um título no ar que não é nenhuma das versões'
export const TB = {
  antes: 'Rota 66 antes do título novo (B): o que eu escrevia',
  l60: 'Rota 66 sem plano B: deserto, pouca gasolina e nenhum sinal de rede',
  l100: 'Rota sem plano B e muito deserto pela frente, quase sem gasolina e sem sinal de celular em lugar nenhum xx'.slice(0, 99) + 'x',
  q90: 'Q'.repeat(90),
  r90: 'R'.repeat(90),
}

/** Chave -> {título do vídeo, título da versão nova}. A ordem define a idade (mais velho depois). */
export const VIDEOS_B: Record<string, { titulo: string; novo: string }> = {
  b_nova: { titulo: 'B nova hoje: Moab em 48 horas', novo: 'Moab em 48 horas: o que cabe de verdade' },
  b_orig: { titulo: 'B original: Page e o cânion da Antelope', novo: 'Antelope Canyon sem tour: dá?' },
  b_igual: { titulo: 'B ficou igual: Zion no outono', novo: 'Zion no outono: o que mudou' },
  b_incon: { titulo: 'B inconclusivo: Bryce ao nascer do sol', novo: 'Bryce Canyon ao nascer do sol' },
  b_navi: { titulo: 'B não vi: Arches sem fila', novo: 'Arches sem fila: o horário certo' },
  b_veredito: { titulo: 'B veredito do Lab: Capitol Reef', novo: 'Capitol Reef: o parque que ninguém visita' },
  b_tres: { titulo: 'B três versões: Lake Powell', novo: 'Lake Powell: a segunda versão' },
  b_tardia: { titulo: 'B tardia: Horseshoe Bend', novo: 'Horseshoe Bend: a versão nova' },
  b_der: { titulo: 'B derivada sem original: Sedona', novo: 'Sedona: o título novo' },
  b_der60: { titulo: 'B derivada título 60: Tucson', novo: TB.l60 },
  b_der100: { titulo: 'B derivada título 100: Phoenix', novo: TB.l100 },
  b_der_orig: { titulo: 'B derivada com original: Albuquerque', novo: 'Albuquerque: o título novo' },
  b_der_sempar: { titulo: 'B derivada sem par: Santa Fe', novo: 'Santa Fe: o título novo' },
  b_mudada: { titulo: 'B mudada: Taos', novo: 'Taos: a versão nova' },
  c_regra: { titulo: 'C conflito regra: Amarillo', novo: 'Amarillo: a versão nova' },
  c_data: { titulo: 'C conflito data_api 3 versões: Tulsa', novo: 'Tulsa: a segunda' },
  c_sempar: { titulo: 'C conflito sem par: Oklahoma City', novo: 'Oklahoma City: a versão nova' },
  c_hostil: { titulo: 'C conflito hostil: Springfield', novo: 'Springfield: a versão nova' },
  c_der: { titulo: 'C conflito derivada: St. Louis', novo: 'St. Louis: o título novo' },
  m2: { titulo: 'M fluxo ficha de 2: Joplin', novo: 'Joplin: a versão nova' },
  m3: { titulo: 'M fluxo ficha de 3: Galena', novo: 'Galena: a segunda' },
  md: { titulo: 'M fluxo derivada: Chicago', novo: 'Chicago: o título novo' },
}
export const CHAVES_B = Object.keys(VIDEOS_B)

const ytIdB = (i: number): string => `giob_${String(i).padStart(2, '0')}`.padEnd(11, '0')

async function criarVideo(m: Mundo, chave: string, i: number): Promise<void> {
  const c = await conectar()
  try {
    const { titulo } = VIDEOS_B[chave]!
    const yt = ytIdB(i)
    const publicadoEm = dur(m, (30 + i) * DIA)
    const id = (await c.query(
      `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds, thumbnail_url)
       values ($1,$2,$3,$4,$5,600,$6) returning id`,
      [m.siteId, m.canalDb, yt, titulo, publicadoEm.toISOString(), `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`])).rows[0].id as string
    await c.query(
      `insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, is_short, privacy_status, captured_at)
       values ($1, (now() at time zone 'America/Sao_Paulo')::date, $2, $3, false, 'public', now())`, [yt, m.siteId, m.canalDb])
    await c.query(
      `insert into public.yt_own_video_state_raw (youtube_video_id, site_id, channel_id, state_sha256, raw, observed_at) values ($1,$2,$3,$4,$5::jsonb, now())`,
      [yt, m.siteId, m.canalDb, sha(`raw-${yt}`), JSON.stringify({ status: { madeForKids: false }, contentDetails: { contentRating: {} }, snippet: { liveBroadcastContent: 'none' } })])
    m.v[chave] = { chave: chave as never, id, yt, titulo, publicadoEm }
  } finally { await c.end() }
}

type V = Mundo['v'][string]
const ficha2 = (v: V, novo: string, tag: string): Registro['variantes'] => [
  { n: 1, tipo: 'combo', titulo: v.titulo, imagem: img(`${tag}-A`) }, { n: 2, tipo: 'combo', titulo: novo, imagem: img(`${tag}-B`) }]
const ficha3 = (v: V, novo: string, tag: string): Registro['variantes'] => [
  ...ficha2(v, novo, tag)!, { n: 3, tipo: 'combo', titulo: `${tag}: a terceira versão`, imagem: img(`${tag}-C`) }]

/** Registro base de uma ficha respondida no prazo (confirmada há 16 d). */
const respondida = (m: Mundo, v: V, o: Partial<Registro> & Pick<Registro, 'variantes' | 'resposta'>): Registro => ({
  video: v, origem: 'confirmado', estado: 'encerrado', confirmadoEm: dur(m, 16 * DIA), encerradoEm: dur(m, 2 * DIA), respondidoEm: dur(m, 2 * DIA), ...o })

const derivada = (m: Mundo, v: V, novo: string, o: Partial<Registro> & Pick<Registro, 'resposta'>): Registro => ({
  video: v, origem: 'detectado', estado: 'encerrado', primeiraVista: dur(m, 16 * DIA), ultimaVista: dur(m, 3 * DIA), confirmadoEm: dur(m, 16 * DIA), encerradoEm: dur(m, 2 * DIA),
  respondidoEm: dur(m, 2 * DIA), campos: ['titulo'], variantesTitulo: [v.titulo, novo], votos: { [v.titulo]: 4, [novo]: 5 }, ...o })

interface DefB { build: (m: Mundo, v: V, novo: string) => Registro; depois?: (m: Mundo, v: V) => Promise<void>; antes?: boolean }
const DEFS: Record<string, DefB> = {
  // Respondidos com versão no ar
  b_nova: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_nova'), resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n,
    confirmadoEm: dur(m, 14 * DIA + HORA), respondidoEm: dur(m, 30_000), encerradoEm: dur(m, 30_000) }) },
  b_orig: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_orig'), resposta: 'venceu_original', varianteVencedora: 1, vencedorFonte: 'dono', vencedorTitulo: v.titulo }) },
  b_tres: { build: (m, v, n) => respondida(m, v, { variantes: ficha3(v, n, 'b_tres'), resposta: 'venceu_nova', varianteVencedora: 3, vencedorFonte: 'dono', vencedorTitulo: 'b_tres: a terceira versão' }) },
  b_tardia: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_tardia'), resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n,
    confirmadoEm: dur(m, 25 * DIA), encerradoEm: dur(m, 3 * DIA), respondidoEm: dur(m, 3 * DIA) }) },
  b_mudada: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_mudada'), resposta: 'venceu_original', varianteVencedora: 1, vencedorFonte: 'dono', vencedorTitulo: v.titulo, respondidoEm: dur(m, 5 * DIA) }),
    depois: async (m, v) => executar('update ab_native_tests set resposta_mudada_em = $2 where video_id = $1', [v.id, dur(m, HORA).toISOString()]) },
  // Sem vencedor
  b_igual: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_igual'), resposta: 'ficou_igual', respondidoEm: dur(m, 3 * DIA) }) },
  b_incon: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_incon'), resposta: 'inconclusivo', respondidoEm: dur(m, 3 * DIA) }) },
  b_navi: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_navi'), resposta: 'nao_vi', estado: 'sem_desfecho', respondidoEm: dur(m, 3 * DIA) }) },
  // Sem vencedor, mas o Lab leu o título no ar (D-7(a), `apoioComVeredito`)
  b_veredito: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'b_veredito'), resposta: 'ficou_igual', respondidoEm: dur(m, 3 * DIA), vencedorFonte: 'regra', vencedorTitulo: n }),
    depois: async (m, v) => executar('update ab_native_tests set desfecho_em = $2 where video_id = $1', [v.id, dur(m, 4 * DIA).toISOString()]) },
  // Derivadas
  b_der: { build: (m, v, n) => derivada(m, v, n, { resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n }) },
  b_der60: { build: (m, v, n) => derivada(m, v, n, { resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n }) },
  b_der100: { build: (m, v, n) => derivada(m, v, n, { resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n }) },
  b_der_orig: { antes: true, build: (m, v, n) => ({ ...derivada(m, v, n, { resposta: 'venceu_original', varianteVencedora: 1, vencedorFonte: 'dono', vencedorTitulo: TB.antes }),
    variantesTitulo: [n, TB.antes], votos: { [n]: 5, [TB.antes]: 4 } }) },
  b_der_sempar: { build: (m, v, n) => derivada(m, v, n, { resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: NO_AR_DESCONHECIDO }) },
  // Conflitos (o Lab leu um título; o dono disse outro)
  c_regra: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'c_regra'), resposta: 'venceu_nova', varianteVencedora: 2, respondidoEm: dur(m, 4 * DIA), vencedorFonte: 'regra', vencedorTitulo: v.titulo }),
    depois: async (m, v) => executar('update ab_native_tests set desfecho_em = $2 where video_id = $1', [v.id, dur(m, 4 * DIA).toISOString()]) },
  c_data: { build: (m, v, n) => respondida(m, v, { variantes: ficha3(v, n, 'c_data'), resposta: 'venceu_nova', varianteVencedora: 3, respondidoEm: dur(m, 4 * DIA), vencedorFonte: 'data_api', vencedorVistoEm: dur(m, 4 * DIA), vencedorTitulo: n }),
    depois: async (m, v) => executar('update ab_native_tests set desfecho_em = $2 where video_id = $1', [v.id, dur(m, 4 * DIA).toISOString()]) },
  c_sempar: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'c_sempar'), resposta: 'venceu_nova', varianteVencedora: 2, respondidoEm: dur(m, 4 * DIA), vencedorFonte: 'data_api', vencedorVistoEm: dur(m, 4 * DIA), vencedorTitulo: NO_AR_DESCONHECIDO }) },
  c_hostil: { build: (m, v) => respondida(m, v, { variantes: [{ n: 1, tipo: 'combo', titulo: TB.q90, imagem: img('c_hostil-A') }, { n: 2, tipo: 'combo', titulo: TB.r90, imagem: img('c_hostil-B') }],
    resposta: 'venceu_nova', varianteVencedora: 2, respondidoEm: dur(m, 4 * DIA), vencedorFonte: 'regra', vencedorTitulo: TB.q90 }),
    depois: async (m, v) => executar('update ab_native_tests set desfecho_em = $2 where video_id = $1', [v.id, dur(m, 4 * DIA).toISOString()]) },
  c_der: { build: (m, v, n) => derivada(m, v, n, { resposta: 'venceu_nova', varianteVencedora: 2, respondidoEm: dur(m, 4 * DIA), vencedorFonte: 'data_api', vencedorVistoEm: dur(m, 4 * DIA), vencedorTitulo: v.titulo }) },
  // Fluxos de "Mudar minha resposta" (cada teste refaz o registro)
  m2: { build: (m, v, n) => respondida(m, v, { variantes: ficha2(v, n, 'm2'), resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n, respondidoEm: dur(m, 5 * DIA) }) },
  m3: { build: (m, v, n) => respondida(m, v, { variantes: ficha3(v, n, 'm3'), resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n, respondidoEm: dur(m, 5 * DIA) }) },
  md: { build: (m, v, n) => derivada(m, v, n, { resposta: 'venceu_nova', varianteVencedora: 2, vencedorFonte: 'dono', vencedorTitulo: n, respondidoEm: dur(m, 5 * DIA) }) },
}

async function versaoDeAntes(m: Mundo, v: V, titulo: string): Promise<void> {
  const c = await conectar()
  try {
    const vista = dur(m, 40 * DIA)
    await c.query(
      `insert into public.yt_own_video_versions (youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt,
          first_seen_at, last_seen_at, window_precision, origin, is_current)
       values ($1,$2,$3,$4,'title',$5,$6,$7,$7,$8,$8,'first','linha_de_base',false)`,
      [v.yt, m.siteId, v.id, m.canalDb, titulo, 'abcdef0123456789abcdef0123456789', vista.toISOString().slice(0, 10), vista.toISOString()])
  } finally { await c.end() }
}

/** Apaga e refaz o registro (id novo, estado de partida) da chave B. */
export async function refazerB(m: Mundo, chave: string): Promise<void> {
  const v = m.v[chave]!
  await executar('delete from public.ab_native_tests where video_id = $1', [v.id])
  await executar('delete from public.yt_own_video_versions where youtube_video_id = $1', [v.yt])
  const def = DEFS[chave]!
  await prepararRegistro(m, def.build(m, v, VIDEOS_B[chave]!.novo))
  if (def.antes) await versaoDeAntes(m, v, TB.antes)
  if (def.depois) await def.depois(m, v)
}

/** Cria os vídeos e os registros das chaves B pedidas (todas por padrão). */
export async function semearB(m: Mundo, chaves: readonly string[] = CHAVES_B): Promise<void> {
  for (const chave of chaves) {
    const i = CHAVES_B.indexOf(chave)
    if (i < 0) throw new Error(`chave B desconhecida: ${chave}`)
    await criarVideo(m, chave, i + 1)
    await refazerB(m, chave)
  }
}
