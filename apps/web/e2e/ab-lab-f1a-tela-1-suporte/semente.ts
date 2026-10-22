// Semente determinística da suíte do Gio para a F1a-tela-1 (T12). Os 11 vídeos espelham `index.html:344-360` do mockup M2
// (docs/superpowers/mockups/2026-10-21-m2-caminho-nativo). Escreve SÓ no Supabase local padrão (54322), num site PRÓPRIO
// (`gio-f1a-tela-1`, host `f1a.localhost`) para a lista não herdar os vídeos que já existem no site do dono.
// Toda data é relativa a "agora" (nunca ano fixo). Cada teste chama `semear()` e recebe um mundo limpo.
import { createHash, randomUUID } from 'node:crypto'
import { Client } from 'pg'

export const SITE_SLUG = 'gio-f1a-tela-1'
export const HOST = 'f1a.localhost'
const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
export const CANAL_YT = 'UCgiof1aCanal0000001'
export const DIA = 86_400_000
const HORA = 3_600_000

export const BLOB = (nome: string): string => `https://gio.public.blob.vercel-storage.com/ab-native-ficha/${nome}.png`
const sha = (s: string): string => createHash('sha256').update(s).digest('hex')

/** Títulos do mockup (V, B1, C1, SMB, SMC). */
export const T = {
  r66: 'Rota 66, dia 4: atravessei o deserto sem plano B e quase fiquei sem gasolina',
  sm: 'Santa Monica: o fim da Rota 66 depois de 4.000 km',
  sh: 'Pôr do sol no Grand Canyon em 30 segundos',
  ut: 'Dirigi 12 horas por Utah: valeu a pena?',
  mv: 'Monument Valley sem guia: o que ninguém conta',
  lv: 'Las Vegas com 50 dólares por dia',
  mu: 'Museu da Rota 66 em Clinton: vale a parada?',
  fl: 'Flagstaff no inverno: neve no meio do deserto',
  sp: 'Seligman, a cidade que inspirou o filme Carros',
  ch: 'Chicago, quilômetro zero da Rota 66',
  gl: 'Galena, Kansas: 21 km de Rota 66 em um estado',
  B1: 'Fiquei sem gasolina no deserto da Rota 66 (e ninguém passou por 3 horas)',
  C1: '🚗 Rota 66 sem plano B: 400 km de deserto, meio tanque e um posto que não existe mais no mapa de 1990',
  SMB: 'A Rota 66 acaba num píer: 4.000 km até Santa Monica',
  SMC: 'Cheguei ao fim da Rota 66 e não era o que eu esperava',
  HOSTIL: 'X'.repeat(90),
} as const

export type Chave = 'r66' | 'sm' | 'sh' | 'ut' | 'mv' | 'lv' | 'mu' | 'fl' | 'sp' | 'ch' | 'gl'
export type Extra = 'hostil' | 'sv_igual' | 'sv_inconcl' | 'sv_navi' | 'tres' | 'derivada' | 'tardia_lv'
export type ChaveAny = Chave | Extra

export interface VideoSemeado { chave: ChaveAny; id: string; yt: string; titulo: string; publicadoEm: Date }
export interface Mundo {
  siteId: string
  canalDb: string
  agora: Date
  v: Record<string, VideoSemeado>
  /** `ab_tests` do nosso teste pausado/ativo por chave de vídeo. */
  testes: Record<string, { testId: string; varA: string; varB: string; varC: string }>
}

const ORDEM: Chave[] = ['r66', 'sm', 'sh', 'ut', 'mv', 'lv', 'mu', 'fl', 'sp', 'ch', 'gl']
// Publicado há (dias): ordem decrescente de recência, como a lista ("mais recentes"). gl há 40 dias (sem volume).
const IDADE: Record<ChaveAny, number> = {
  r66: 3, sm: 4, sh: 5, ut: 6, mv: 8, lv: 9, mu: 10, fl: 11, sp: 12, ch: 13, gl: 40,
  hostil: 2, sv_igual: 14, sv_inconcl: 15, sv_navi: 16, tres: 17, derivada: 18, tardia_lv: 19,
}
const DURACAO: Record<string, number> = { sh: 30, ut: 102 }
const ytId = (chave: string): string => `gio${chave}`.replace(/[^A-Za-z0-9_-]/g, '_').padEnd(11, '0').slice(0, 11)

export async function conectar(): Promise<Client> {
  const c = new Client({ connectionString: PG_URL })
  await c.connect()
  const { rows } = await c.query("select inet_server_port() as p, current_database() as d")
  // 54322 é a porta do Postgres LOCAL padrão (dentro do contêiner é 5432: conferimos pela URL, não pelo servidor).
  if (!PG_URL.includes('127.0.0.1:54322') || rows[0].d !== 'postgres') throw new Error('semente do Gio: recusando banco que não é o local padrão')
  return c
}

/** Apaga TUDO do site do Gio (e só dele): varre as tabelas com `site_id` em passadas, até as chaves estrangeiras deixarem. */
export async function limparSite(c: Client): Promise<void> {
  const id = (await c.query('select id from public.sites where slug = $1', [SITE_SLUG])).rows[0]?.id as string | undefined
  if (!id) return
  // Filhas de ab_tests (sem site_id) primeiro.
  await c.query('delete from public.ab_test_restores where test_id in (select id from public.ab_tests where site_id = $1)', [id]).catch(() => undefined)
  for (const t of ['ab_test_cycles', 'ab_test_polls', 'ab_test_variants']) {
    await c.query(`delete from public.${t} where test_id in (select id from public.ab_tests where site_id = $1)`, [id]).catch(() => undefined)
  }
  const tabelas = (await c.query(
    `select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'site_id' and t.table_type = 'BASE TABLE' and c.table_name <> 'sites'`)).rows.map((r) => String(r.table_name))
  let pendentes = tabelas
  for (let passada = 0; passada < 6 && pendentes.length > 0; passada++) {
    const falhas: string[] = []
    for (const t of pendentes) {
      await c.query('savepoint s')
      try { await c.query(`delete from public."${t}" where site_id = $1`, [id]); await c.query('release savepoint s') }
      catch { await c.query('rollback to savepoint s'); falhas.push(t) }
    }
    pendentes = falhas
  }
  // O site fica: o middleware guarda Host -> site em cache; recriá-lo com outro id deixava a página lendo um site apagado (lista com 0 vídeos).
}

async function garantirSite(c: Client): Promise<string> {
  const org = (await c.query('select id from public.organizations where parent_org_id is null limit 1')).rows[0]?.id as string | undefined
  if (!org) throw new Error('organização mestre não encontrada (rode as migrations)')
  const ja = (await c.query('select id from public.sites where slug = $1', [SITE_SLUG])).rows[0]?.id as string | undefined
  if (ja) return ja
  const r = await c.query(
    `insert into public.sites (org_id, name, slug, domains, primary_domain)
     values ($1, 'Gio F1a tela 1', $2, $3::text[], $4) returning id`, [org, SITE_SLUG, [HOST], HOST])
  return String(r.rows[0].id)
}

const iso = (d: Date): string => d.toISOString()
const atras = (agora: Date, ms: number): Date => new Date(agora.getTime() - ms)

interface OpV { n: number; tipo: 'titulo' | 'miniatura' | 'combo'; titulo?: string; imagem?: { url: string; sha256: string; largura: number; altura: number } }
const img = (nome: string, largura = 1280, altura = 720): NonNullable<OpV['imagem']> => ({ url: BLOB(nome), sha256: sha(nome), largura, altura })
export const variantesDuas = (a: string, b: string, tag: string): OpV[] => [
  { n: 1, tipo: 'combo', titulo: a, imagem: img(`${tag}-A`) },
  { n: 2, tipo: 'combo', titulo: b, imagem: img(`${tag}-B`) },
]

export async function semear(opts: { extras?: Extra[] } = {}): Promise<Mundo> {
  const c = await conectar()
  try {
    await c.query('begin')
    await limparSite(c)
    await c.query('commit')
    const agora = new Date()
    const siteId = await garantirSite(c)
    const canal = (await c.query(
      `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
       values ($1, $2, 'pt', '@gio-f1a', 'Canal Gio F1a', 'UUgiof1a00000000001', 'gio-f1a') returning id`, [siteId, CANAL_YT])).rows[0].id as string
    // Conexão OAuth FALSA (só para o "nosso teste" achar um token; nenhum dado sai: o fetch vai ao YouTube falso).
    await c.query(
      `insert into public.social_connections (site_id, provider, account_id, account_name, access_token_enc, refresh_token_enc, token_expires_at, scopes)
       values ($1, 'youtube', $2, 'Canal Gio F1a', $3, $3, $4, array['youtube.force-ssl'])`,
      [siteId, CANAL_YT, cifrar('token-falso'), iso(new Date(agora.getTime() + 30 * DIA))])

    const chaves: ChaveAny[] = [...ORDEM, ...(opts.extras ?? [])]
    const v: Record<string, VideoSemeado> = {}
    for (const chave of chaves) {
      const titulo = chave === 'hostil' ? T.HOSTIL : (T as Record<string, string>)[chave] ?? `Vídeo extra ${chave}`
      const publicadoEm = atras(agora, IDADE[chave] * DIA + 2 * HORA)
      const yt = ytId(chave)
      const id = (await c.query(
        `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds, thumbnail_url)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [siteId, canal, yt, titulo, iso(publicadoEm), DURACAO[chave] ?? 600, `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`])).rows[0].id as string
      v[chave] = { chave, id, yt, titulo, publicadoEm }
    }

    // Formato lido (vídeo longo, não kids, não 18+, não ao vivo) em todos, menos o Short (is_short) e o de formato nulo.
    const hoje = (await c.query("select (now() at time zone 'America/Sao_Paulo')::date as d")).rows[0].d as Date
    for (const x of Object.values(v)) {
      if (x.chave === 'ut') continue
      await c.query(
        `insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, is_short, privacy_status, captured_at)
         values ($1, (now() at time zone 'America/Sao_Paulo')::date, $2, $3, $4, 'public', now())`, [x.yt, siteId, canal, x.chave === 'sh'])
      await c.query(
        `insert into public.yt_own_video_state_raw (youtube_video_id, site_id, channel_id, state_sha256, raw, observed_at) values ($1,$2,$3,$4,$5::jsonb, now())`,
        [x.yt, siteId, canal, sha(`raw-${x.yt}`), JSON.stringify({ status: { madeForKids: false }, contentDetails: { contentRating: {} }, snippet: { liveBroadcastContent: 'none' } })])
    }
    void hoje

    // Volume: o canal tem 30 dias de relatório de alcance; gl rende 12 impressões/dia (piso 220), o resto 400/dia.
    for (let i = 1; i <= 30; i++) {
      await c.query(
        `insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, normalized_at)
         select $1,$2,'job',$3,'channel_reach_basic_a1', d::timestamp at time zone 'UTC', d::timestamp at time zone 'UTC' + interval '1 day', now(), 'u', 'baixado', now()
           from (select (now() at time zone 'America/Sao_Paulo')::date - $4::int as d) x`, ['r' + randomUUID(), siteId, canal, i])
    }
    for (const x of Object.values(v)) {
      if (IDADE[x.chave] < 7 || x.chave === 'ut' || x.chave === 'sh') continue
      const porDia = x.chave === 'gl' ? 12 : 400
      for (let i = 1; i <= 14; i++) {
        await c.query(
          `insert into public.yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
           values ($1, (now() at time zone 'America/Sao_Paulo')::date - $5::int, $2, $3, $4, $6, 'r', now(), 'views_desde_2026-08-27')`, [x.yt, siteId, x.id, canal, i, porDia])
      }
    }

    const mundo: Mundo = { siteId, canalDb: canal, agora, v, testes: {} }
    await semearEstados(c, mundo)
    return mundo
  } finally {
    await c.end()
  }
}

import { createCipheriv, randomBytes } from 'node:crypto'
const MESTRE = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const cf = createCipheriv('aes-256-gcm', Buffer.from(MESTRE, 'hex'), iv)
  const enc = Buffer.concat([cf.update(texto, 'utf8'), cf.final()])
  return Buffer.concat([iv, cf.getAuthTag(), enc]).toString('base64')
}

interface RegistroSemeado {
  video: VideoSemeado
  origem: 'confirmado' | 'detectado'
  estado: 'em_andamento' | 'encerrado' | 'sem_desfecho' | 'descartado'
  confirmadoEm?: Date | null
  primeiraVista?: Date | null
  ultimaVista?: Date | null
  encerradoEm?: Date | null
  campos?: ('titulo' | 'miniatura')[]
  variantes?: OpV[] | null
  variantesTitulo?: string[] | null
  votos?: Record<string, number> | null
  resposta?: string | null
  respondidoEm?: Date | null
  varianteVencedora?: number | null
  vencedorFonte?: 'regra' | 'dono' | 'data_api' | null
  vencedorTitulo?: string | null
  vencedorVistoEm?: Date | null
  updatedAt?: Date | null
}

async function inserirRegistro(c: Client, m: Mundo, r: RegistroSemeado): Promise<string> {
  const q = await c.query(
    `insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes, variantes_titulo, votos_titulo,
        primeira_vista, ultima_vista, versao_regra, confirmado_em, encerrado_em, resposta_dono, respondido_em, variante_vencedora,
        vencedor_fonte, vencedor_titulo, vencedor_visto_em, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id`,
    [m.siteId, r.video.id, r.video.yt, r.origem, r.campos ?? ['titulo', 'miniatura'], r.estado,
      r.variantes ? JSON.stringify(r.variantes) : null, r.variantesTitulo ? JSON.stringify(r.variantesTitulo) : null, r.votos ? JSON.stringify(r.votos) : null,
      r.primeiraVista ? iso(r.primeiraVista) : null, r.ultimaVista ? iso(r.ultimaVista) : null, r.origem === 'detectado' || r.primeiraVista ? 1 : null,
      r.confirmadoEm ? iso(r.confirmadoEm) : null, r.encerradoEm ? iso(r.encerradoEm) : null, r.resposta ?? null, r.respondidoEm ? iso(r.respondidoEm) : null,
      r.varianteVencedora ?? null, r.vencedorFonte ?? null, r.vencedorTitulo ?? null, r.vencedorVistoEm ? iso(r.vencedorVistoEm) : null,
      iso(r.confirmadoEm ?? r.primeiraVista ?? m.agora), iso(r.updatedAt ?? r.respondidoEm ?? r.confirmadoEm ?? r.primeiraVista ?? m.agora)])
  return String(q.rows[0].id)
}

export async function inserirFicha(c: Client, m: Mundo, chave: ChaveAny, f: {
  campos?: ('titulo' | 'miniatura')[]; variantes?: OpV[]; criadaEm?: Date; atualizadaEm?: Date; studioAbertoEm?: Date | null; lembrarEm?: Date | null
}): Promise<string> {
  const criada = f.criadaEm ?? atras(m.agora, 2 * DIA)
  const q = await c.query(
    `insert into public.ab_native_fichas (site_id, video_id, campos, variantes, criada_em, atualizada_em, studio_aberto_em, lembrar_em)
     values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8) returning id`,
    [m.siteId, m.v[chave]!.id, f.campos ?? ['titulo', 'miniatura'], JSON.stringify(f.variantes ?? []), iso(criada), iso(f.atualizadaEm ?? criada),
      f.studioAbertoEm ? iso(f.studioAbertoEm) : null, f.lembrarEm ? iso(f.lembrarEm) : null])
  return String(q.rows[0].id)
}

/** "Nosso teste" (ab_tests + variantes + ciclos) no vídeo, pausado ou ativo, com o restauro pedido. Molde: ab-lab-p4a-suporte/semente.ts. */
export async function inserirNossoTeste(c: Client, m: Mundo, chave: ChaveAny, o: {
  status: 'active' | 'paused'; diasAtras?: number; pausadoHa?: number
  restoreStatus?: 'ok' | 'em_andamento' | 'falhou' | null
}): Promise<void> {
  const x = m.v[chave]!
  const inicio = atras(m.agora, (o.diasAtras ?? 5) * DIA)
  const t = (await c.query(
    `insert into public.ab_tests (site_id, youtube_video_id, name, status, test_type, config, original_thumbnail_url, original_title, started_at, paused_at)
     values ($1,$2,$3,$4,'combo',$5::jsonb,$6,$7,$8,$9) returning id`,
    [m.siteId, x.id, `[gio-f1a] ${x.titulo.slice(0, 40)}`, o.status, JSON.stringify({ max_duration_days: 14, confidence_threshold: 0.95, burn_in_days: 2, rotation_pattern: 'abba' }),
      BLOB('nosso-A'), x.titulo, iso(inicio), o.status === 'paused' ? iso(atras(m.agora, (o.pausadoHa ?? 1) * DIA)) : null])).rows[0].id as string
  const ids: Record<string, string> = {}
  for (const [i, [label, tit]] of ([['A', x.titulo], ['B', T.B1], ['C', T.C1]] as const).entries()) {
    ids[label] = String((await c.query(
      `insert into public.ab_test_variants (test_id, label, is_original, sort_order, blob_url, dimensions, title_text, thumbnail_dhash)
       values ($1,$2,$3,$4,$5,'1280x720',$6,$7) returning id`, [t, label, label === 'A', i, BLOB(`nosso-${label}`), tit, 'f0f0f0f0f0f0f0f0'])).rows[0].id)
  }
  const ini = atras(m.agora, 20 * HORA)
  await c.query(
    `insert into public.ab_test_cycles (test_id, variant_id, cycle_number, started_at, ended_at, end_reason) values ($1,$2,0,$3,$4,$5)`,
    [t, ids.A, iso(atras(m.agora, 2 * DIA)), iso(atras(m.agora, 2 * DIA - 20 * HORA)), 'rotacao'])
  await c.query(
    `insert into public.ab_test_cycles (test_id, variant_id, cycle_number, started_at, ended_at, end_reason) values ($1,$2,1,$3,$4,$5)`,
    [t, ids.B, iso(atras(m.agora, 1 * DIA)), iso(atras(m.agora, 1 * DIA - 20 * HORA)), 'rotacao'])
  await c.query(
    `insert into public.ab_test_cycles (test_id, variant_id, cycle_number, started_at, ended_at, end_reason) values ($1,$2,2,$3,$4,$5)`,
    [t, ids.C, iso(ini), o.status === 'paused' ? iso(atras(m.agora, 1 * HORA)) : null, o.status === 'paused' ? 'pausa' : null])
  const rs = (estado: 'ok' | 'em_andamento' | 'falhou'): unknown => {
    const campo = (): unknown => ({ estado, destino: 'original', em: iso(atras(m.agora, 30 * 60_000)), forcado: false, escreveu: estado === 'ok', motivo: null, erro: estado === 'falhou' ? { codigo: 'token' } : null, attempts: estado === 'falhou' ? 1 : 0 })
    return { title: campo(), thumbnail: campo() }
  }
  await c.query('update public.ab_tests set last_applied_variant_id = $2, restore_status = $3::jsonb where id = $1',
    [t, ids.C, o.restoreStatus ? JSON.stringify(rs(o.restoreStatus)) : null])
  m.testes[chave] = { testId: t, varA: ids.A!, varB: ids.B!, varC: ids.C! }
}

async function semearEstados(c: Client, m: Mundo): Promise<void> {
  const v = m.v
  const dur = (d: number): Date => atras(m.agora, d)
  const B = (a: string, b: string, tag: string): OpV[] => variantesDuas(a, b, tag)

  // sm: resultado pronto hoje (confirmado há 14 d 1 h), duas versões (botão Responder).
  await inserirRegistro(c, m, { video: v.sm!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(14 * DIA + HORA), variantes: B(T.sm, T.SMB, 'sm'), updatedAt: dur(14 * DIA + HORA) })
  // lv: teste visto de fora desde 19/10 (há 3 dias), nosso teste pausado por causa dele.
  await inserirRegistro(c, m, { video: v.lv!, origem: 'detectado', estado: 'em_andamento', primeiraVista: dur(3 * DIA), ultimaVista: dur(6 * HORA), campos: ['titulo'],
    variantesTitulo: [T.lv, 'Las Vegas gastando só 50 dólares por dia: dá?'], votos: { [T.lv]: 3, 'Las Vegas gastando só 50 dólares por dia: dá?': 2 } })
  await inserirNossoTeste(c, m, 'lv', { status: 'paused', diasAtras: 10, pausadoHa: 3, restoreStatus: 'ok' })
  // mu: confirmado há 4 dias, nosso teste pausado.
  await inserirRegistro(c, m, { video: v.mu!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(4 * DIA), variantes: B(T.mu, 'Clinton, Oklahoma: o museu da Rota 66 vale a visita?', 'mu') })
  await inserirNossoTeste(c, m, 'mu', { status: 'paused', diasAtras: 12, pausadoHa: 4, restoreStatus: 'ok' })
  // fl: respondido "B venceu" há 2 dias.
  await inserirRegistro(c, m, { video: v.fl!, origem: 'confirmado', estado: 'encerrado', confirmadoEm: dur(16 * DIA), encerradoEm: dur(2 * DIA), variantes: B(T.fl, 'Neve em Flagstaff: o inverno que ninguém espera na Rota 66', 'fl'),
    resposta: 'venceu_nova', varianteVencedora: 2, respondidoEm: dur(2 * DIA), vencedorFonte: 'dono', vencedorTitulo: 'Neve em Flagstaff: o inverno que ninguém espera na Rota 66' })
  // sp: sem resposta, prazo passado (confirmado há 25 d; fechado por silêncio há 9 d).
  await inserirRegistro(c, m, { video: v.sp!, origem: 'confirmado', estado: 'sem_desfecho', confirmadoEm: dur(25 * DIA), encerradoEm: dur(9 * DIA), variantes: B(T.sp, 'Seligman: a cidadezinha que virou o filme Carros', 'sp'),
    resposta: 'sem_resposta' })
  // ch: respostas diferentes (a leitura do YouTube diz A; o dono disse B).
  await inserirRegistro(c, m, { video: v.ch!, origem: 'confirmado', estado: 'encerrado', confirmadoEm: dur(19 * DIA), encerradoEm: dur(5 * DIA), variantes: B(T.ch, 'Chicago: o quilômetro zero da Rota 66', 'ch'),
    resposta: 'venceu_nova', varianteVencedora: 2, respondidoEm: dur(5 * DIA), vencedorFonte: 'data_api', vencedorTitulo: T.ch, vencedorVistoEm: dur(5 * DIA) })
  // mv: ficha em preparo (duas versões, nunca aberta no Studio).
  await inserirFicha(c, m, 'mv', { variantes: B(T.mv, 'Monument Valley sem guia: o que os guias não contam', 'mv'), criadaEm: dur(2 * DIA), atualizadaEm: dur(1 * DIA) })

  for (const e of Object.keys(v)) {
    if (e === 'hostil') continue
    if (e === 'sv_igual' || e === 'sv_inconcl' || e === 'sv_navi') {
      const resp = e === 'sv_igual' ? 'ficou_igual' : e === 'sv_inconcl' ? 'inconclusivo' : 'nao_vi'
      await inserirRegistro(c, m, { video: v[e]!, origem: 'confirmado', estado: 'encerrado', confirmadoEm: dur(18 * DIA), encerradoEm: dur(3 * DIA), variantes: B(v[e]!.titulo, `${v[e]!.titulo} (versão nova)`, e), resposta: resp, respondidoEm: dur(3 * DIA) })
    }
    if (e === 'tres') {
      const tres = [...B(v.tres!.titulo, 'Três versões: a segunda', 'tres'), { n: 3, tipo: 'combo' as const, titulo: 'Três versões: a terceira', imagem: img('tres-C') }]
      await inserirRegistro(c, m, { video: v.tres!, origem: 'confirmado', estado: 'em_andamento', confirmadoEm: dur(14 * DIA + HORA), variantes: tres })
    }
    if (e === 'derivada') {
      await inserirRegistro(c, m, { video: v.derivada!, origem: 'detectado', estado: 'em_andamento', primeiraVista: dur(14 * DIA + HORA), ultimaVista: dur(HORA), campos: ['titulo'],
        confirmadoEm: dur(14 * DIA), variantesTitulo: [v.derivada!.titulo, 'Derivada: o título novo'], votos: { [v.derivada!.titulo]: 4, 'Derivada: o título novo': 5 } })
    }
    if (e === 'tardia_lv') {
      await inserirRegistro(c, m, { video: v.tardia_lv!, origem: 'confirmado', estado: 'sem_desfecho', confirmadoEm: dur(25 * DIA), encerradoEm: dur(9 * DIA), variantes: B(v.tardia_lv!.titulo, 'Tardia: a versão nova', 'tardia'), resposta: 'sem_resposta' })
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Leituras e escritas pontuais do banco, para as asserções ("o que ficou gravado") e o preparo de um estado de ficha.
// ---------------------------------------------------------------------------------------------------------------------
export async function consultar<R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> {
  const c = await conectar()
  try { return (await c.query(sql, params)).rows as R[] } finally { await c.end() }
}
export async function executar(sql: string, params: unknown[] = []): Promise<void> {
  const c = await conectar()
  try { await c.query(sql, params) } finally { await c.end() }
}
export const contarFichas = async (videoId: string): Promise<number> =>
  Number((await consultar<{ n: string }>('select count(*)::int as n from public.ab_native_fichas where video_id = $1', [videoId]))[0]!.n)

/** Preparo de ficha por estado, antes de o teste abrir a tela. Troca a ficha aberta do vídeo (a aberta é única por vídeo). */
export async function prepararFicha(m: Mundo, chave: ChaveAny, f: Parameters<typeof inserirFicha>[3]): Promise<string> {
  const c = await conectar()
  try {
    await c.query('delete from public.ab_native_fichas where video_id = $1 and registro_id is null', [m.v[chave]!.id])
    return await inserirFicha(c, m, chave, f)
  } finally { await c.end() }
}
export async function prepararNosso(m: Mundo, chave: ChaveAny, o: Parameters<typeof inserirNossoTeste>[3]): Promise<void> {
  const c = await conectar()
  try { await inserirNossoTeste(c, m, chave, o) } finally { await c.end() }
}
export async function prepararRegistro(m: Mundo, r: RegistroSemeado): Promise<string> {
  const c = await conectar()
  try { return await inserirRegistro(c, m, r) } finally { await c.end() }
}
