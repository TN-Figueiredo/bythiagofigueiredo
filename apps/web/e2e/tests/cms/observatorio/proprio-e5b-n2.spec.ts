// apps/web/e2e/tests/cms/observatorio/proprio-e5b-n2.spec.ts
// E5b · lote N2 (T9 a T12, T16 a/b/d, T17): a validação em navegador que os testes de jsdom não fazem.
//  1. clicar em "Origem" na aba Vídeos, sem recarregar, resolve o Suspense (Next 16);
//  2. a faixa de duas células no topo da Origem do canal, nos quatro estados da segunda célula;
//  3. a marca do "normal do canal" na barra do % assistido (dentro dos cartões) segue o período escolhido;
//  4. "a coleta parou em dd/mm" com a coleta de alcance parada;
//  5. 1440 e 390, claro e escuro, console e rede limpos.
// Semente SINTÉTICA: o canal e os vídeos são renomeados depois da semente do oráculo (repo público: nenhum nome real nas capturas).
// O banco local é compartilhado com outras trilhas: antes de cada cenário o teste confere a marca da semente e semeia de novo se faltar.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'
import { localServiceClient, RET, MAPA_RETENCAO, somaDias } from '../../../fixtures/observatorio-seed'

test.use({ storageState: process.env.N2_STATE ?? ADMIN_STATE })

const SHOTS = process.env.N2_SHOTS_DIR ?? path.resolve(__dirname, '../../../../test-results/n2-shots')
const MARCA_SEED = path.resolve(__dirname, '../../../../test-results/.observatorio-seed.json')
const DESDE = '2026-10-07' // DIMENSOES_DESDE
const ROTA = '/cms/youtube/competitors'
const TABELA_DIM = 'public.yt_own_video_dim_daily'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const VP = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const
type Tema = 'dark' | 'light'
type ModoDims = 'tipico' | 'magro' | 'nenhum' | 'revisao'
type Base = 'retencao' | 'velho'

fs.mkdirSync(SHOTS, { recursive: true })

/* ------------------------------------------------------------------------------------------ banco */
function psql(sql: string): void {
  execFileSync('docker', ['exec', 'supabase_db_bythiagofigueiredo', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' })
}
const restaurarLeitura = () => psql(`grant select on ${TABELA_DIM} to service_role`)

interface Ambiente { siteId: string; canalId: string; ultimo: string; uuid: Record<string, string> }
let amb: (Ambiente & { base: Base }) | null = null

/** A limpeza da semente ainda não apaga as tabelas de dimensões (T18 do plano pede isso): sem esta linha o reseed morre na chave estrangeira. */
async function limparDimensoes(): Promise<void> { /* R2: o conserto 35364a41e faz clearOwnL2 apagar as dimensões; o teste 0 prova */ }

async function semearBase(base: Base): Promise<Ambiente> {
  const opts = { ownPreset: '2', ownL2: base } as const
  await limparDimensoes()
  const siteId = await ensureSeeded(opts)
  const ids = seedIdsOf(siteId), canalId = ids.own('tnfigueiredo')
  const sb = localServiceClient()
  const ch = await sb.from('youtube_channels').select('description').eq('id', canalId).single()
  if (ch.error || ch.data?.description !== `n2-base:v2:${base}`) {
    // a semente do oráculo ainda não é a deste cenário (ou outra trilha apagou/trocou o banco): semeia de novo e marca
    try { fs.rmSync(MARCA_SEED) } catch { /* nenhuma */ }
    await limparDimensoes()
    await ensureSeeded(opts)
    await sanitizar(sb, siteId, canalId, base)
  }
  const vids = await sb.from('youtube_videos').select('id, youtube_video_id').eq('site_id', siteId).eq('channel_id', canalId)
  expect(vids.error).toBeNull()
  const dia = await sb.from('yt_own_video_daily').select('day_pt').eq('site_id', siteId).eq('channel_id', canalId).order('day_pt', { ascending: false }).limit(1)
  expect(dia.error).toBeNull()
  return { siteId, canalId, ultimo: String(dia.data?.[0]?.day_pt), uuid: Object.fromEntries((vids.data ?? []).map(v => [String(v.youtube_video_id), String(v.id)])) }
}

/** Nada de nome real nas capturas: canal e vídeos próprios viram "Canal Sintético" e "Vídeo sintético NN"; no perfil `retencao` o diário vai a 100 dias. */
async function sanitizar(sb: SupabaseClient, siteId: string, canalId: string, base: Base): Promise<void> {
  const c = await sb.from('youtube_channels').update({ name: 'Canal Sintético', handle: '@canal-sintetico', custom_url: '@canal-sintetico', description: `n2-base:v2:${base}`, thumbnail_url: null, banner_url: null }).eq('id', canalId)
  expect(c.error).toBeNull()
  const vs = await sb.from('youtube_videos').select('id, published_at').eq('site_id', siteId).eq('channel_id', canalId).order('published_at', { ascending: false })
  expect(vs.error).toBeNull()
  let i = 0
  for (const v of vs.data ?? []) { i++; const r = await sb.from('youtube_videos').update({ title: `Vídeo sintético ${String(i).padStart(2, '0')}`, title_translation: null, description: 'Descrição sintética.', description_translation: null, thumbnail_url: null, thumbnail_hq_url: null }).eq('id', v.id); expect(r.error).toBeNull() }
  if (base === 'retencao') await diarioMaisLongo(sb, siteId, canalId)
  await coberturaDeTodos(sb, siteId, canalId)
}

/** Coleta de verdade acompanha TODOS os vídeos do canal: quem não tem linha de diário tem cobertura 'base' (zero medido, a dieta). Sem isto a semente deixa 47 dos 57 vídeos "fora da conta". */
async function coberturaDeTodos(sb: SupabaseClient, siteId: string, canalId: string): Promise<void> {
  const dia = await sb.from('yt_own_video_daily').select('day_pt').eq('site_id', siteId).eq('channel_id', canalId).order('day_pt', { ascending: false }).limit(1)
  const ultimo = String(dia.data?.[0]?.day_pt)
  const vs = await sb.from('youtube_videos').select('id, youtube_video_id, published_at').eq('site_id', siteId).eq('channel_id', canalId)
  const tem = await sb.from('yt_own_video_coverage').select('youtube_video_id, metric_set').eq('site_id', siteId).eq('channel_id', canalId).in('metric_set', ['base', 'estendidas'])
  expect(vs.error).toBeNull(); expect(tem.error).toBeNull()
  const ja = new Set((tem.data ?? []).map(r => `${r.youtube_video_id}|${r.metric_set}`))
  const novas: object[] = []
  for (const v of vs.data ?? []) {
    const pub = String(v.published_at).slice(0, 10)
    if (pub > ultimo) continue
    for (const metric_set of ['base', 'estendidas']) if (!ja.has(`${v.youtube_video_id}|${metric_set}`)) novas.push({ youtube_video_id: v.youtube_video_id, metric_set, covered_from: pub, covered_to: ultimo, site_id: siteId, video_id: v.id, channel_id: canalId, source: 'analytics_api' })
  }
  for (let i = 0; i < novas.length; i += 500) { const r = await sb.from('yt_own_video_coverage').insert(novas.slice(i, i + 500)); expect(r.error).toBeNull() }
}

/** Para o cartão de 90 dias e o "Desde" diferirem do de 28: 72 dias mais antigos para os vídeos do mapa, com % assistido 8 pontos abaixo (do dia da publicação em diante). */
async function diarioMaisLongo(sb: SupabaseClient, siteId: string, canalId: string): Promise<void> {
  const dia = await sb.from('yt_own_video_daily').select('day_pt').eq('site_id', siteId).eq('channel_id', canalId).order('day_pt', { ascending: false }).limit(1)
  const ultimo = String(dia.data?.[0]?.day_pt)
  const vs = await sb.from('youtube_videos').select('id, youtube_video_id, published_at, duration_seconds').eq('site_id', siteId).eq('channel_id', canalId).in('youtube_video_id', MAPA_RETENCAO.map(m => m.yt))
  expect(vs.error).toBeNull()
  const linhas: object[] = [], cob: object[] = []
  for (const [mi, m] of MAPA_RETENCAO.entries()) {
    const v = (vs.data ?? []).find(x => x.youtube_video_id === m.yt)
    if (!v) continue
    const pub = String(v.published_at).slice(0, 10), dur = Number(v.duration_seconds ?? 600)
    const primeiro = somaDias(ultimo, -27)
    let de: string | null = null
    for (let k = 1; k <= 72; k++) {
      const d = somaDias(primeiro, -k)
      if (d < pub) break
      de = d
      const views = (k + mi) % 3 === 0 ? 0 : 20 + ((k * 17 + mi * 31) % 60)
      const pct = Math.max(5, m.pct - 8)
      linhas.push({ youtube_video_id: m.yt, day_pt: d, site_id: siteId, video_id: v.id, channel_id: canalId, views, source: 'analytics_api', metric_version: 'views_desde_2026-08-27',
        avg_view_percentage: views > 0 ? pct : null, avg_view_duration_seconds: views > 0 ? Math.round((pct / 100) * dur * 100) / 100 : null })
    }
    if (de) for (const ms of ['base', 'estendidas']) {
      const u = await sb.from('yt_own_video_coverage').update({ covered_from: de }).eq('site_id', siteId).eq('channel_id', canalId).eq('youtube_video_id', m.yt).eq('metric_set', ms)
      expect(u.error).toBeNull()
    }
  }
  void cob
  for (let i = 0; i < linhas.length; i += 500) { const r = await sb.from('yt_own_video_daily').insert(linhas.slice(i, i + 500)); expect(r.error).toBeNull() }
}

/** Dimensões (origem, aparelho, país, inscrito) em cima do diário: `tipico` soma menos que a base; `revisao` soma MAIS que a base num dia; `magro` só três dias; `nenhum` não grava nada. */
async function aplicarDims(a: Ambiente, modo: ModoDims): Promise<void> {
  const sb = localServiceClient()
  const sets = ['trafego', 'dispositivo', 'pais', 'inscrito']
  let r = await sb.from('yt_own_video_dim_daily').delete().eq('site_id', a.siteId).eq('channel_id', a.canalId); expect(r.error).toBeNull()
  r = await sb.from('yt_own_video_coverage').delete().eq('site_id', a.siteId).eq('channel_id', a.canalId).in('metric_set', sets); expect(r.error).toBeNull()
  if (modo === 'nenhum') return
  const di = await sb.from('yt_own_video_daily').select('youtube_video_id, day_pt, views, video_id').eq('site_id', a.siteId).eq('channel_id', a.canalId).gte('day_pt', modo === 'magro' ? somaDias(a.ultimo, -2) : DESDE).gt('views', 0)
  expect(di.error).toBeNull()
  const rows: object[] = []
  const fatias: Array<[string, string, number]> = [
    ['traffic_source', 'YT_SEARCH', 0.4], ['traffic_source', 'RELATED_VIDEO', 0.3], ['traffic_source', 'NO_LINK_OTHER', 0.15],
    ['device_os', 'MOBILE|ANDROID', 0.5], ['device_os', 'DESKTOP|WINDOWS', 0.3],
    ['country', 'BR', 0.6], ['country', 'PT', 0.2],
    ['subscribed_status', 'SUBSCRIBED', 0.3], ['subscribed_status', 'UNSUBSCRIBED', 0.65],
  ]
  let marcouRevisao = false
  const diaRevAlto = (di.data ?? []).filter(d => String(d.youtube_video_id) === RET.volumeAlto && Number(d.views) >= 10).map(d => String(d.day_pt)).sort().pop()
  for (const d of di.data ?? []) {
    const yt = String(d.youtube_video_id), dia = String(d.day_pt), views = Number(d.views)
    // revisão: num dia de um vídeo, a soma da origem passa da base (70% + 50% = 120%)
    const estoura = modo === 'revisao' && views >= 10 && ((yt === RET.volumeAlto && dia === diaRevAlto) || (dia === a.ultimo && !marcouRevisao))
    if (estoura) marcouRevisao = true
    for (const [kind, valor, fr] of fatias) {
      const f = estoura && valor === 'RELATED_VIDEO' ? 0.8 : fr
      const v = Math.floor(views * f)
      if (v <= 0) continue
      rows.push({ youtube_video_id: yt, day_pt: dia, dim_kind: kind, dim_value: valor, site_id: a.siteId, video_id: d.video_id, channel_id: a.canalId, views: v, engaged_views: v, watch_time_minutes: v * 3, source: 'analytics_api', metric_version: 'views_desde_2026-08-27' })
    }
  }
  expect(rows.length).toBeGreaterThan(0)
  if (modo === 'revisao') expect(marcouRevisao, 'nenhum vídeo com view no último dia para estourar').toBe(true)
  for (let i = 0; i < rows.length; i += 500) { const w = await sb.from('yt_own_video_dim_daily').insert(rows.slice(i, i + 500)); expect(w.error).toBeNull() }
  // a coleta das dimensões cobre TODOS os vídeos, de DIMENSOES_DESDE (ou da publicação) até o último dia do diário; `magro` só os três últimos dias
  const vs = await sb.from('youtube_videos').select('id, youtube_video_id, published_at').eq('site_id', a.siteId).eq('channel_id', a.canalId)
  expect(vs.error).toBeNull()
  const cob: object[] = []
  for (const v of vs.data ?? []) {
    const pub = String(v.published_at).slice(0, 10)
    const de = modo === 'magro' ? somaDias(a.ultimo, -2) : pub > DESDE ? pub : DESDE
    if (de > a.ultimo) continue
    for (const metric_set of sets) cob.push({ youtube_video_id: v.youtube_video_id, metric_set, covered_from: de, covered_to: a.ultimo, site_id: a.siteId, video_id: v.id, channel_id: a.canalId, source: 'analytics_api' })
  }
  const w = await sb.from('yt_own_video_coverage').insert(cob); expect(w.error).toBeNull()
}

async function cenario(base: Base, dims: ModoDims): Promise<Ambiente> {
  restaurarLeitura()
  if (!amb || amb.base !== base) amb = { ...(await semearBase(base)), base }
  else {
    // outra trilha pode ter apagado ou trocado a semente entre dois testes: confere a marca
    const ch = await localServiceClient().from('youtube_channels').select('description').eq('id', amb.canalId).maybeSingle()
    if (ch.data?.description !== `n2-base:v2:${base}`) amb = { ...(await semearBase(base)), base }
  }
  await aplicarDims(amb, dims)
  return amb
}

/* ------------------------------------------------------------------------------------------ navegador */
interface Vigia { erros: string[]; falhas: string[]; cincoXX: string[]; acoes: string[]; chaves: number }
let vigia: Vigia = { erros: [], falhas: [], cincoXX: [], acoes: [], chaves: 0 }
function vigiar(page: Page): void {
  vigia = { erros: [], falhas: [], cincoXX: [], acoes: [], chaves: 0 }
  const v = vigia
  page.on('console', m => {
    if (m.type() !== 'error' && m.type() !== 'warning') return
    const loc = m.location().url
    if (/ytimg\.com|ggpht\.com|blob\.vercel|challenges\.cloudflare/.test(loc + m.text())) return
    if (m.type() === 'warning' && !/hydrat|did not match/i.test(m.text())) return
    // achado F1 (aviso de chave de lista em ProprioScreen, abas Retenção e Origem): contado e relatado, não derruba os demais critérios
    if (/unique "key" prop/.test(m.text())) { v.chaves++; v.erros.push('F1: ' + m.text().slice(0, 160)); return }
    v.erros.push(`${m.type()}: ${m.text().slice(0, 240)} @ ${loc}`)
  })
  page.on('pageerror', e => v.erros.push('pageerror: ' + e.message.slice(0, 240)))
  page.on('requestfailed', r => { if (!/ytimg|ggpht|vercel|cloudflare|_rsc=.*\bprefetch/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED') v.falhas.push(`${r.failure()?.errorText} ${r.url().slice(0, 140)}`) })
  page.on('response', r => { if (r.status() >= 400 && !/ytimg|ggpht|vercel|cloudflare/.test(r.url())) v.cincoXX.push(`${r.status()} ${r.url().slice(0, 140)}`) })
}
async function armar(page: Page, tema: Tema, vp: keyof typeof VP): Promise<void> {
  await page.setViewportSize(VP[vp])
  await page.emulateMedia({ colorScheme: tema })
  await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
  await page.context().route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  // nada que escreva: toda server action é abortada
  await page.context().route('**/*', async route => {
    const r = route.request()
    if (r.method() === 'POST' && r.headers()['next-action']) { vigia.acoes.push(r.url()); await route.abort('blockedbyclient'); return }
    await route.fallback()
  })
  vigiar(page)
}
function limpo(rotulo: string): void {
  if (vigia.chaves) console.log(`N2 F1 ${rotulo}: ${vigia.chaves}x aviso 'Each child in a list should have a unique key' (ProprioScreen)`)
  expect(vigia.acoes, `${rotulo}: server action inesperada`).toEqual([])
  expect(vigia.erros, `${rotulo}: console`).toEqual([])
  expect(vigia.falhas, `${rotulo}: requisição que falhou`).toEqual([])
  expect(vigia.cincoXX, `${rotulo}: respostas 4xx/5xx`).toEqual([])
}
const urlCanal = (a: Ambiente, q = '') => `${ROTA}/canal/${a.canalId}?painel=1${q}`
const urlVideo = (a: Ambiente, yt: string) => `${ROTA}/video/${a.uuid[yt]}?from=canais&canal=${a.canalId}`
async function esperarCanal(page: Page): Promise<void> {
  await page.locator('[data-obs-screen="canal"][data-own="1"] .chead h1').first().waitFor({ timeout: 90_000 })
}
async function esperarVideo(page: Page): Promise<void> {
  await page.locator('[data-obs-screen="video-proprio"] h1:visible').first().waitFor({ timeout: 90_000 })
}
/** Sem rolagem horizontal do documento nem do corpo; devolve a largura que sobrou. */
async function semRolagemHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth)
}
/** Captura a tela inteira: se a rolagem é de um contêiner interno, estica a janela até caber tudo (a captura precisa mostrar o estado todo). */
async function foto(page: Page, nome: string, vp: keyof typeof VP): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  const alto = await page.evaluate(() => {
    let max = document.documentElement.scrollHeight
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main, [data-obs-screen], body > div, body > div > div'))) max = Math.max(max, el.scrollHeight + el.getBoundingClientRect().top)
    return Math.min(Math.ceil(max), 6000)
  })
  await page.setViewportSize({ width: VP[vp].width, height: Math.max(VP[vp].height, alto) })
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(SHOTS, `${nome}.png`), fullPage: true })
  await page.setViewportSize(VP[vp])
}
async function texto(page: Page, sel: string): Promise<string> {
  return ((await page.locator(sel).first().innerText()) ?? '').replace(/\s+/g, ' ').trim()
}
async function abrirOrigemDoCanal(page: Page, a: Ambiente): Promise<void> {
  await page.goto(urlCanal(a, '&tab=origem'))
  await esperarCanal(page)
  await page.locator('.ov-grupo, .ov-novo').first().waitFor({ timeout: 90_000 })
  await page.locator('.ov-esq').waitFor({ state: 'detached', timeout: 90_000 })
  await page.waitForLoadState('networkidle')
}


/** R2: forma, glifo, cor e fonte dos blocos de origem. Devolve o que leu (para o log) e afirma as regras. */
async function checarFormas(page: Page, rotulo: string): Promise<void> {
  const r = await page.evaluate(() => {
    const falhas: string[] = [], estados: Record<string, string> = {}, cores: Record<string, string> = {}
    const fam = (el: Element) => getComputedStyle(el).fontFamily
    for (const sec of Array.from(document.querySelectorAll<HTMLElement>('section.ov-sec[data-estado]'))) {
      const id = sec.dataset.bloco ?? '?', est = sec.dataset.estado ?? '?'
      estados[id] = est
      const tem = (q: string) => !!sec.querySelector(q)
      if (est === 'nao_medido' && !tem('.ov-hach')) falhas.push(`${id}: nao_medido sem hachura`)
      if (est === 'zero' && !tem('.ov-zero')) falhas.push(`${id}: zero sem caixa vazada`)
      if (est === 'ainda_nao_existe' && !tem('.ov-vz svg.ov-g')) falhas.push(`${id}: ainda_nao_existe sem relogio/pontilhado`)
      if (est === 'em_revisao' && !tem('.ov-bq svg.ov-g')) falhas.push(`${id}: em_revisao sem icone de aviso`)
      if (est === 'erro' || tem('.ov-er')) { if (!tem('.ov-er .ov-er-i svg.ov-g')) falhas.push(`${id}: erro sem icone`) }
      if (tem('.ov-bq') && !tem('.ov-bq svg.ov-g')) falhas.push(`${id}: bloqueio/revisao sem icone`)
      const h3 = sec.querySelector('.ov-h3'); if (h3 && Number(getComputedStyle(h3).fontWeight) < 600) falhas.push(`${id}: titulo sem negrito (${getComputedStyle(h3).fontWeight})`)
      // origem: cada quadrado tem glifo e cada fatia da barra tambem
      for (const sw of Array.from(sec.querySelectorAll<HTMLElement>('.ov-sw'))) {
        const k = sw.closest<HTMLElement>('li')?.dataset.chave ?? '?'
        if (!sw.querySelector('svg.ov-g')) falhas.push(`${id}/${k}: quadrado sem glifo`)
        const cs = getComputedStyle(sw); cores[k] = cs.backgroundColor + (cs.backgroundImage !== 'none' ? ' +img' : '')
      }
      for (const sg of Array.from(sec.querySelectorAll<HTMLElement>('.ov-sg'))) if (!sg.querySelector('svg.ov-g')) falhas.push(`${id}: fatia sem glifo`)
      // aparelho, pais, inscritos: icone + trilha com largura
      for (const li of Array.from(sec.querySelectorAll<HTMLElement>('li.ov-hb'))) {
        const k = li.dataset.chave ?? '?'
        if (!li.querySelector('.ov-ic svg.ov-g')) falhas.push(`${id}/${k}: linha sem icone`)
        const tr = li.querySelector<HTMLElement>('.ov-tr'), i = tr?.querySelector<HTMLElement>('i')
        if (!tr || !i) falhas.push(`${id}/${k}: sem trilha`)
        else if (li.querySelector('.ov-v .obs-ch-nm') == null && i.getBoundingClientRect().width <= 0 && !/^0/.test(li.querySelector('.ov-p')?.textContent ?? '')) falhas.push(`${id}/${k}: trilha vazia`)
      }
      if (est === 'medido' && sec.querySelector('ul.ov-lg2') == null && ['aparelho', 'pais', 'inscritos'].includes(id) && sec.querySelector('li')) falhas.push(`${id}: medido sem lista com trilha`)
      for (const v of Array.from(sec.querySelectorAll('.ov-v'))) { if (!/jetbrains|mono/i.test(fam(v))) { falhas.push(`${id}: numero .ov-v sem fonte mono (${fam(v).slice(0, 60)})`); break } }
    }
    const nums = Array.from(document.querySelectorAll('dl.ov-fx b.num'))
    for (const n of nums) if (!/jetbrains|mono/i.test(fam(n))) { falhas.push('faixa: numero sem fonte mono ' + fam(n).slice(0, 60)); break }
    // chip: "nao medido" nunca e texto solto na faixa
    for (const dd of Array.from(document.querySelectorAll('dl.ov-fx dd'))) { const b = dd.querySelector('b'); if (b && /^(não medido|—)$/.test(b.textContent ?? '')) falhas.push('faixa: ' + b.textContent + ' como texto solto') }
    return { falhas, estados, cores }
  })
  console.log(`N2R2 formas ${rotulo}:`, JSON.stringify({ estados: r.estados, cores: r.cores }))
  expect(r.falhas, `${rotulo}: forma/fonte`).toEqual([])
  const origens = Object.entries(r.cores).filter(([k]) => k !== 'omitido')
  const distintas = new Set(origens.map(([, v]) => v))
  if (origens.length > 1) expect(distintas.size, `${rotulo}: cores das origens distintas ${JSON.stringify(r.cores)}`).toBe(origens.length)
}

test.afterAll(() => { try { restaurarLeitura() } catch { /* nada */ } })

/* ------------------------------------------------------------------------------------------ (1) Suspense */
test('1a · Vídeos -> Origem sem recarregar: o grupo lido aparece (1440 escuro)', async ({ page }) => {
  const a = await cenario('retencao', 'tipico')
  await armar(page, 'dark', '1440')
  await page.goto(urlCanal(a))
  await esperarCanal(page)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => { (window as unknown as { __n2: number }).__n2 = 1 })
  const origemAntes = await page.evaluate(() => performance.timeOrigin)
  await page.getByRole('navigation', { name: 'Seções do canal' }).getByRole('link', { name: /^Origem/ }).click()
  await expect(page.locator('[data-bloco="origem"]').first()).toBeVisible({ timeout: 60_000 })
  expect(await page.evaluate(() => (window as unknown as { __n2?: number }).__n2), 'a página foi recarregada').toBe(1)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(origemAntes)
  expect(page.url()).toContain('tab=origem')
  expect(await page.locator('.ov-esq').count(), 'esqueleto ficou na tela').toBe(0)
  await foto(page, '01-suspense-videos-para-origem-1440-dark', '1440')
  limpo('1a')
})

async function emRedeLenta(page: Page, a: Ambiente, hidratar: boolean): Promise<{ viuEsqueleto: boolean; recarregou: boolean }> {
  await armar(page, 'dark', '1440')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1200, downloadThroughput: 80 * 1024, uploadThroughput: 80 * 1024 })
  await page.goto(urlCanal(a), { waitUntil: 'commit', timeout: 120_000 })
  const aba = page.getByRole('navigation', { name: 'Seções do canal' }).getByRole('link', { name: /^Origem/ })
  await aba.waitFor({ timeout: 120_000 })
  if (hidratar) await page.waitForFunction(() => { const el = Array.from(document.querySelectorAll('nav[aria-label="Seções do canal"] a')).find(x => /^Origem/.test(x.textContent ?? '')); return !!el && Object.keys(el).some(k => k.startsWith('__reactProps')) }, null, { timeout: 120_000 })
  await page.evaluate(() => { (window as unknown as { __n2: number }).__n2 = 1 })
  await aba.click()
  const viuEsqueleto = await page.locator('.ov-esq').first().isVisible().catch(() => false)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await expect(page.locator('[data-bloco="origem"]').first()).toBeVisible({ timeout: 120_000 })
  expect(await page.locator('.ov-esq').count()).toBe(0)
  expect(page.url()).toContain('tab=origem')
  const recarregou = (await page.evaluate(() => (window as unknown as { __n2?: number }).__n2)) !== 1
  return { viuEsqueleto, recarregou }
}

test('1b · rede lenta, clique DEPOIS de hidratar: sem recarregar, esqueleto e depois o grupo', async ({ page }) => {
  const a = await cenario('retencao', 'tipico')
  const r = await emRedeLenta(page, a, true)
  console.log('N2 1b (hidratado):', JSON.stringify(r))
  expect(r.recarregou, 'a página foi recarregada').toBe(false)
  limpo('1b')
})

test('1c · rede lenta, clique ANTES de hidratar: o link degrada para navegação de verdade e o grupo aparece', async ({ page }) => {
  const a = await cenario('retencao', 'tipico')
  const r = await emRedeLenta(page, a, false)
  console.log('N2 1c (antes de hidratar):', JSON.stringify(r))
  limpo('1c')
})

/* ------------------------------------------------------------------------------------------ (2) faixa */
const ESTADOS_FAIXA: Array<{ id: string; dims: ModoDims; erro?: boolean; esperaDias: RegExp }> = [
  { id: 'medido', dims: 'tipico', esperaDias: /^\d+\s+de\s+\d+$/ },
  { id: 'magro', dims: 'magro', esperaDias: /^\d+\s+de\s+\d+$/ },
  { id: 'coleta-nao-comecou', dims: 'nenhum', esperaDias: /^0\s+de\s+\d+\s*·\s*a coleta (começa|começou) em \d\d\/\d\d(; nenhum dia deste período chegou)?$/ },
  { id: 'nao-conseguimos-ler', dims: 'tipico', erro: true, esperaDias: /^—\s+de\s+\d+\s*·\s*não conseguimos ler agora$/ },
  { id: 'em-revisao', dims: 'revisao', esperaDias: /^\d+\s+de\s+\d+\s*·\s*origem em revisão$/ },
]
for (const est of ESTADOS_FAIXA) {
  for (const [vp, tema] of [['1440', 'dark'], ['390', 'light'], ['1440', 'light'], ['390', 'dark']] as const) {
    test(`2 · faixa da Origem do canal · ${est.id} · ${vp} ${tema}`, async ({ page }) => {
      const a = await cenario('retencao', est.dims)
      if (est.erro) psql(`revoke select on ${TABELA_DIM} from service_role`)
      try {
        await armar(page, tema, vp)
        await abrirOrigemDoCanal(page, a)
        const faixa = page.locator('dl.ov-fx').first()
        await expect(faixa).toBeVisible()
        const celulas = await faixa.locator('.ov-fx-c').evaluateAll(els => els.map(e => ({
          rotulo: e.querySelector('dt')?.textContent?.trim() ?? '', valor: (e.querySelector('dd b') ?? e.querySelector('dd .obs-ch-nm'))?.textContent?.trim() ?? '', chip: !!e.querySelector('dd .obs-ch-nm'), sub: e.querySelector('dd > span:last-child')?.textContent?.trim() ?? '',
        })))
        expect(celulas.length, 'a faixa tem duas células').toBe(2)
        console.log(`N2 faixa ${est.id} ${vp}/${tema}:`, JSON.stringify(celulas))
        expect(celulas[0]!.rotulo).toBe('views no período')
        expect(celulas[1]!.rotulo).toBe('dias com origem medida')
        const dias = `${celulas[1]!.valor} ${celulas[1]!.sub}`.replace(/\s+/g, ' ').replace(/^(\S+) de/, '$1 de')
        expect(dias, 'texto da segunda célula').toMatch(est.esperaDias)
        // nenhum "NaN", "undefined" nem zero no lugar de ausente
        expect(await texto(page, 'dl.ov-fx')).not.toMatch(/NaN|undefined|null/)
        if (est.erro) await expect(page.locator('.ov-er[role="alert"]').first()).toBeVisible()
        // layout: duas células lado a lado ou empilhadas sem estourar a largura; alvos e texto cortado
        const geo = await page.evaluate(() => {
          const cs = Array.from(document.querySelectorAll('dl.ov-fx .ov-fx-c')).map(e => e.getBoundingClientRect())
          const dl = document.querySelector('dl.ov-fx')!.getBoundingClientRect()
          const corta = Array.from(document.querySelectorAll<HTMLElement>('dl.ov-fx *')).filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.tagName + '.' + e.className)
          const dd = Array.from(document.querySelectorAll('dl.ov-fx .ov-fx-c dd')).map(e => e.getBoundingClientRect().top)
          const dt = Array.from(document.querySelectorAll('dl.ov-fx .ov-fx-c dt')).map(e => e.getBoundingClientRect().top)
          const val = Array.from(document.querySelectorAll('dl.ov-fx .ov-fx-c dd > b, dl.ov-fx .ov-fx-c dd > .obs-ch-nm')).map(e => e.getBoundingClientRect().top)
          return { c0: cs[0]!.toJSON(), c1: cs[1]!.toJSON(), dl: dl.toJSON(), corta, vw: window.innerWidth, dd, dt, val }
        })
        expect(geo.corta, 'texto cortado na faixa').toEqual([])
        expect(geo.c1.right, 'faixa passa da janela').toBeLessThanOrEqual(geo.vw)
        console.log(`N2R2 alinhamento ${est.id} ${vp}/${tema}: lado a lado=${Math.abs(geo.c0.top - geo.c1.top) < 2} dt=${JSON.stringify(geo.dt.map(Math.round))} dd=${JSON.stringify(geo.dd.map(Math.round))} valor=${JSON.stringify(geo.val.map(Math.round))}`)
        if (Math.abs(geo.c0.top - geo.c1.top) < 2) { expect(Math.abs(geo.dd[0]! - geo.dd[1]!), 'dd desalinhados').toBeLessThanOrEqual(1); expect(Math.abs(geo.val[0]! - geo.val[1]!), 'valores desalinhados').toBeLessThanOrEqual(1) }
        await checarFormas(page, `canal ${est.id} ${vp}/${tema}`)
        expect(await semRolagemHorizontal(page), 'rolagem horizontal do documento').toBeLessThanOrEqual(0)
        await foto(page, `02-origem-canal-${est.id}-${vp}-${tema}`, vp)
        if (est.erro) {
          // "Tentar de novo" com o banco de volta: o bloco de erro some e a faixa mostra o número (só no 1440 escuro, uma vez)
          if (vp === '1440' && tema === 'dark') {
            restaurarLeitura()
            await page.getByRole('button', { name: 'Tentar de novo' }).first().click()
            await expect(page.locator('dl.ov-fx .ov-fx-c').nth(1)).toContainText(/\d+\s*de\s*\d+/, { timeout: 60_000 })
            await expect(page.locator('.ov-er[role="alert"]')).toHaveCount(0)
          }
        }
      } finally { if (est.erro) restaurarLeitura() }
      // 4xx/5xx esperado só no estado de erro: ali o banco nega por design e o servidor responde 200 com o bloco; mesmo assim nada pode virar 5xx
      limpo(`2 ${est.id} ${vp} ${tema}`)
    })
  }
}

test('2z · períodos da Origem do canal (7, 28, 90, Desde) no estado medido, 1440 escuro', async ({ page }) => {
  const a = await cenario('retencao', 'tipico')
  await armar(page, 'dark', '1440')
  await abrirOrigemDoCanal(page, a)
  const botoes = page.locator('.ov-pes button[data-periodo]')
  const n = await botoes.count()
  expect(n).toBeGreaterThanOrEqual(3)
  for (let i = 0; i < n; i++) {
    const b = botoes.nth(i), id = await b.getAttribute('data-periodo')
    await b.click()
    await expect(b).toHaveAttribute('aria-pressed', 'true')
    const cel = await page.locator('dl.ov-fx .ov-fx-c').evaluateAll(els => els.map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()))
    console.log(`N2 período ${id}:`, JSON.stringify(cel))
    expect(cel.join(' ')).not.toMatch(/NaN|undefined/)
    await foto(page, `02z-origem-canal-periodo-${id}-1440-dark`, '1440')
  }
  limpo('2z')
})

/* ------------------------------------------------------------------------------------------ origem na página do vídeo */
const ESTADOS_VIDEO: Array<{ id: string; dims: ModoDims; erro?: boolean }> = [
  { id: 'medido', dims: 'tipico' }, { id: 'coleta-nao-comecou', dims: 'nenhum' }, { id: 'nao-conseguimos-ler', dims: 'tipico', erro: true }, { id: 'em-revisao', dims: 'revisao' },
]
for (const est of ESTADOS_VIDEO) {
  for (const [vp, tema] of [['1440', 'dark'], ['390', 'light'], ['1440', 'light'], ['390', 'dark']] as const) {
    test(`2v · "De onde vêm as views" no vídeo · ${est.id} · ${vp} ${tema}`, async ({ page }) => {
      const a = await cenario('retencao', est.dims)
      if (est.erro) psql(`revoke select on ${TABELA_DIM} from service_role`)
      try {
        await armar(page, tema, vp)
        await page.goto(urlVideo(a, RET.volumeAlto))
        await esperarVideo(page)
        const sec = page.getByRole('heading', { name: /De onde vêm as views/ }).first()
        await sec.waitFor({ timeout: 90_000 })
        await page.locator('.ov-esq').waitFor({ state: 'detached', timeout: 90_000 })
        await page.waitForLoadState('networkidle')
        if (est.erro) await expect(page.locator('.ov-er[role="alert"]').first()).toBeVisible()
        else await expect(page.locator('[data-bloco="origem"]').first()).toBeVisible()
        const faixaV = await page.evaluate(() => ({ celulas: document.querySelectorAll('.ov-grupo > dl.ov-fx .ov-fx-c').length, rotulo: document.querySelector('.ov-grupo > dl.ov-fx dt')?.textContent?.trim(), solto: document.querySelectorAll('.ov-grupo > p.ov-vtot').length, valor: document.querySelector('.ov-grupo > dl.ov-fx dd')?.textContent?.replace(/\s+/g, ' ').trim() }))
        console.log(`N2R2 célula vídeo ${est.id} ${vp}/${tema}:`, JSON.stringify(faixaV))
        expect(faixaV, 'célula views no período no lugar do número solto').toMatchObject({ celulas: 1, rotulo: 'views no período', solto: 0 })
        await checarFormas(page, `vídeo ${est.id} ${vp}/${tema}`)
        console.log(`N2 vídeo ${est.id} ${vp}/${tema}: origem=`, (await texto(page, '[data-bloco="origem"]').catch(() => '(sem bloco)')).slice(0, 220))
        expect(await semRolagemHorizontal(page), 'rolagem horizontal do documento').toBeLessThanOrEqual(0)
        await sec.scrollIntoViewIfNeeded()
        await foto(page, `02v-origem-video-${est.id}-${vp}-${tema}`, vp)
      } finally { if (est.erro) restaurarLeitura() }
      limpo(`2v ${est.id} ${vp} ${tema}`)
    })
  }
}

/* ------------------------------------------------------------------------------------------ (3) barra dentro dos cartões */
const LEIAME_PERIODOS = ['inteiro', '90', '28'] as const
for (const [vp, tema] of [['1440', 'dark'], ['390', 'light'], ['1440', 'light'], ['390', 'dark']] as const) {
  test(`3 · a marca da barra do % assistido segue o período escolhido · vídeo · ${vp} ${tema}`, async ({ page }) => {
    const a = await cenario('retencao', 'tipico')
    await armar(page, tema, vp)
    await page.goto(urlVideo(a, 'DvP4RC_VIjz'))
    await esperarVideo(page)
    const ap = page.locator('.ap').first()
    await ap.waitFor({ timeout: 90_000 })
    await page.waitForLoadState('networkidle')
    // a barra mora DENTRO do bloco dos cartões
    expect(await ap.locator('.vb-as-barra').count(), 'barra dentro de .ap').toBe(1)
    expect(await page.locator('.vb-as-barra').count(), 'só uma barra na página (a de fora não existe com cartões)').toBe(1)
    const lidos: Record<string, { marca: string | null; esquerda: string | null; largura: string | null; cartao: string }> = {}
    for (const id of LEIAME_PERIODOS) {
      const c = ap.locator(`[role="radio"][data-periodo="${id}"]`)
      await c.click()
      await expect(c).toHaveAttribute('aria-checked', 'true')
      const marca = await ap.locator('.vb-as-med span').first().textContent().catch(() => null)
      lidos[id] = {
        marca,
        esquerda: await ap.locator('.vb-as-barra s').first().getAttribute('style').catch(() => null),
        largura: await ap.locator('.vb-as-barra i').first().getAttribute('style').catch(() => null),
        cartao: (await c.innerText()).replace(/\s+/g, ' ').trim(),
      }
      await foto(page, `03-barra-nos-cartoes-${id}-${vp}-${tema}`, vp)
    }
    console.log(`N2 barra ${vp}/${tema}:`, JSON.stringify(lidos))
    // a marca é a do período: o texto "normal do canal: X%" tem de ser o normal do cartão escolhido, e os períodos diferentes têm marcas diferentes (a semente deu 8 pontos de diferença antes dos últimos 28 dias)
    const textos = LEIAME_PERIODOS.map(id => lidos[id]!.marca)
    const esperado: Record<string, RegExp> = { inteiro: /normal do canal \(canal inteiro\)/, '90': /normal do canal \(90 dias\)/, '28': /normal do canal \(28 dias\)/ }
    for (const id of LEIAME_PERIODOS) expect(lidos[id]!.marca ?? '', `etiqueta da marca em ${id}`).toMatch(esperado[id]!)
    expect(textos.filter(Boolean).length, 'ao menos dois períodos com marca').toBeGreaterThanOrEqual(2)
    expect(new Set(textos.filter(Boolean)).size, 'a marca muda com o período').toBeGreaterThan(1)
    expect(await semRolagemHorizontal(page)).toBeLessThanOrEqual(0)
    limpo(`3 ${vp} ${tema}`)
  })
}

/* ------------------------------------------------------------------------------------------ (4) coleta parada */
for (const [vp, tema] of [['1440', 'dark'], ['390', 'light']] as const) {
  test(`4 · "a coleta parou em dd/mm" · ${vp} ${tema}`, async ({ page }) => {
    const a = await cenario('velho', 'tipico')
    const sb = localServiceClient()
    const reach = await sb.from('yt_own_video_reach_daily').select('youtube_video_id, day_pt').eq('site_id', a.siteId).eq('channel_id', a.canalId).order('day_pt', { ascending: false }).limit(1)
    expect(reach.error).toBeNull()
    const ultimoAlcance = String(reach.data?.[0]?.day_pt), yt = String(reach.data?.[0]?.youtube_video_id)
    const [, mm, dd] = ultimoAlcance.split('-')
    const dm = `${dd}/${mm}`
    await armar(page, tema, vp)
    await page.goto(urlCanal(a))
    await esperarCanal(page)
    await page.waitForLoadState('networkidle')
    const corpoCanal = await texto(page, '[data-obs-screen="canal"][data-own="1"]')
    console.log(`N2 coleta parada: último alcance ${ultimoAlcance}; canal diz parou=`, /a coleta parou em [^.]*/i.exec(corpoCanal)?.[0] ?? '(NÃO ACHOU)')
    expect(corpoCanal, 'canal: aviso da coleta parada').toMatch(new RegExp(`a coleta parou em ${dm}`, 'i'))
    await foto(page, `04-coleta-parada-canal-${vp}-${tema}`, vp)
    if (a.uuid[yt]) {
      await page.goto(urlVideo(a, yt))
      await esperarVideo(page)
      await page.waitForLoadState('networkidle')
      const corpoVideo = await texto(page, '[data-obs-screen="video-proprio"]:visible')
      console.log('N2 coleta parada (vídeo):', /a coleta parou em [^.]*/i.exec(corpoVideo)?.[0] ?? '(NÃO ACHOU)', '| frases de alcance:', JSON.stringify(Array.from(corpoVideo.matchAll(/[^.]*(coleta|relatório|alcance|impress)[^.]*\./gi)).map(m => m[0].trim().slice(0, 200)).slice(0, 5)))
      expect(corpoVideo, 'vídeo: aviso da coleta parada (a página do vídeo escreve "A coleta de relatórios deste canal parou em dd/mm")').toMatch(new RegExp(`a coleta (de relatórios deste canal )?parou em ${dm}`, 'i'))
      await foto(page, `04-coleta-parada-video-${vp}-${tema}`, vp)
    }
    limpo(`4 ${vp} ${tema}`)
  })
}

/* ------------------------------------------------------------------------------------------ outras telas do lote: aba Retenção do canal e vídeo completo */
for (const [vp, tema] of [['1440', 'dark'], ['390', 'light'], ['1440', 'light'], ['390', 'dark']] as const) {
  test(`5 · aba Retenção do canal (cartões de período) · ${vp} ${tema}`, async ({ page }) => {
    const a = await cenario('retencao', 'tipico')
    await armar(page, tema, vp)
    await page.goto(urlCanal(a, '&tab=retencao'))
    await esperarCanal(page)
    await page.locator('.ap').first().waitFor({ timeout: 90_000 })
    await page.waitForLoadState('networkidle')
    const lidos: Record<string, string> = {}
    for (const id of LEIAME_PERIODOS) {
      const c = page.locator(`.ap [role="radio"][data-periodo="${id}"]`)
      await c.click()
      lidos[id] = (await c.innerText()).replace(/\s+/g, ' ').trim()
    }
    console.log(`N2 retenção do canal ${vp}/${tema}:`, JSON.stringify(lidos), '| barras em .ap:', await page.locator('.ap .vb-as-barra').count())
    expect(await semRolagemHorizontal(page)).toBeLessThanOrEqual(0)
    await foto(page, `05-retencao-canal-${vp}-${tema}`, vp)
    limpo(`5 ${vp} ${tema}`)
  })
  test(`5v · página do vídeo inteira (medido) · ${vp} ${tema}`, async ({ page }) => {
    const a = await cenario('retencao', 'tipico')
    await armar(page, tema, vp)
    await page.goto(urlVideo(a, 'DvP4RC_VIjz'))
    await esperarVideo(page)
    await page.locator('.ap').first().waitFor({ timeout: 90_000 })
    await page.getByRole('heading', { name: /De onde vêm as views/ }).first().waitFor({ timeout: 90_000 })
    await page.waitForLoadState('networkidle')
    await foto(page, `05v-video-inteiro-${vp}-${tema}`, vp)
    limpo(`5v ${vp} ${tema}`)
  })
}

/* ------------------------------------------------------------------------------------------ R2 */
test('0 · a semente reexecuta limpa duas vezes seguidas (clearOwnL2 apaga as dimensões)', async () => {
  for (let i = 1; i <= 2; i++) {
    try { fs.rmSync(MARCA_SEED) } catch { /* nenhuma */ }
    await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
    console.log(`N2R2 semente rodada ${i}: ok`)
  }
  amb = null
})

test('F1 · nenhum aviso de chave de lista em ?tab=origem e ?tab=retencao (20 aberturas)', async ({ page }) => {
  test.setTimeout(900_000)
  const a = await cenario('retencao', 'tipico')
  await armar(page, 'dark', '1440')
  let total = 0
  for (let i = 0; i < 20; i++) {
    const tab = i % 2 === 0 ? 'origem' : 'retencao'
    await page.goto(urlCanal(a, `&tab=${tab}`))
    await esperarCanal(page)
    await page.locator(tab === 'origem' ? '.ov-grupo, .ov-novo' : '.ap').first().waitFor({ timeout: 90_000 })
    await page.waitForLoadState('networkidle')
    total += vigia.chaves
    console.log(`N2R2 F1 abertura ${i + 1} (${tab}): avisos de chave acumulados=${vigia.chaves}`)
  }
  expect(total, 'avisos de chave').toBe(0)
  limpo('F1')
})

for (const tab of ['origem', 'retencao', 'videos'] as const) {
  for (const tema of ['light', 'dark'] as const) {
    test(`F5 · a 390 px a aba ativa (${tab}) está inteira na vista · ${tema}`, async ({ page }) => {
      const a = await cenario('retencao', 'tipico')
      await armar(page, tema, '390')
      await page.goto(urlCanal(a, tab === 'videos' ? '' : `&tab=${tab}`))
      await esperarCanal(page)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(600)
      const m = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Seções do canal"]')!
        const ul = nav.querySelector('ul') ?? nav
        const links = Array.from(nav.querySelectorAll('a')).map(l => { const r = l.getBoundingClientRect(); return { t: (l.textContent ?? '').trim().slice(0, 14), l: Math.round(r.left), r: Math.round(r.right), cur: l.getAttribute('aria-current') } })
        const at = nav.querySelector('a[aria-current="page"]')?.getBoundingClientRect()
        return { vw: window.innerWidth, links, at: at ? { l: at.left, r: at.right } : null, navR: nav.getBoundingClientRect().toJSON(), ulScroll: (ul as HTMLElement).scrollLeft, docOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth }
      })
      console.log(`N2R2 F5 ${tab}/${tema}:`, JSON.stringify(m))
      expect(m.at, 'aba ativa existe').not.toBeNull()
      expect(m.at!.l, 'aba ativa corta à esquerda').toBeGreaterThanOrEqual(-0.5)
      expect(m.at!.r, 'aba ativa corta à direita').toBeLessThanOrEqual(m.vw + 0.5)
      expect(m.docOverflow).toBeLessThanOrEqual(0)
      if (tab === 'origem') await foto(page, `f5-abas-${tab}-390-${tema}`, '390')
      limpo(`F5 ${tab} ${tema}`)
    })
  }
}
