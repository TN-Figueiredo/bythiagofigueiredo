// Auxiliares comuns das specs do A/B Lab P4a: tema, coleta de console/rede, imagens falsas, capturas.
import path from 'node:path'
import fs from 'node:fs'
import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test'

export const AUTH = {
  admin: path.resolve(__dirname, '../.auth/admin.json'),
  editor: path.resolve(__dirname, '../.auth/editor.json'),
}
export const SHOTS = process.env.AB_P4A_SHOTS
  ?? '/Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/p4a-implementado-shots'

export type Tema = 'dark' | 'light'
export const TEMAS: Tema[] = ['dark', 'light']
/** Tema dos fluxos funcionais por projeto (cada par largura × fuso × tema aparece em pelo menos um projeto). */
export const TEMA_DO_PROJETO: Record<string, Tema> = { 'sp-1440': 'dark', 'sp-390': 'light', 'tokyo-1440': 'light', 'tokyo-390': 'dark' }
export const temaDoProjeto = (info: TestInfo): Tema => TEMA_DO_PROJETO[info.project.name] ?? 'dark'
export const larguraDoProjeto = (info: TestInfo): number => (info.project.name.endsWith('390') ? 390 : 1440)

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export interface Coleta { erros: string[]; avisos: string[]; falhasDeRede: string[]; respostas4xx5xx: string[]; hidratacao: string[] }

/** Coleta console (error e hidratação), requisições com falha e respostas 4xx/5xx de um Page. As imagens do Blob/ytimg são servidas por rota. */
export function coletar(page: Page, opts: { naoEsperadas?: RegExp[] } = {}): Coleta {
  const c: Coleta = { erros: [], avisos: [], falhasDeRede: [], respostas4xx5xx: [], hidratacao: [] }
  const ignorar = (t: string) => (opts.naoEsperadas ?? []).some((r) => r.test(t))
  page.on('console', (m) => {
    const t = m.text()
    // Hidratação vai para a lista própria: o spec E13 a cobra por tela; os demais não ficam vermelhos por um defeito já registrado.
    if (/hydrat/i.test(t) && m.type() === 'error') { c.hidratacao.push(t.slice(0, 200)); return }
    if (m.type() === 'error' && !ignorar(t)) c.erros.push(t.slice(0, 300))
    if (m.type() === 'warning' && /hydrat/i.test(t)) c.avisos.push(t.slice(0, 300))
  })
  page.on('pageerror', (e) => { if (/hydrat/i.test(e.message)) { c.hidratacao.push(e.message.slice(0, 200)); return } if (!ignorar(e.message)) c.erros.push(`pageerror: ${e.message}`.slice(0, 300)) })
  page.on('requestfailed', (r) => {
    const t = `${r.method()} ${r.url()} ${r.failure()?.errorText ?? ''}`
    // RSC prefetch/refresh abortados por navegação não são falha de rede do produto
    if (!ignorar(t) && !/net::ERR_ABORTED/.test(t)) c.falhasDeRede.push(t.slice(0, 300))
  })
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const t = `${r.status()} ${r.request().method()} ${r.url()}`
      if (!ignorar(t)) c.respostas4xx5xx.push(t.slice(0, 300))
    }
  })
  return c
}

export function esperarLimpo(c: Coleta, rotulo: string): void {
  expect.soft(c.erros, `${rotulo}: erros de console`).toEqual([])
  expect.soft(c.avisos, `${rotulo}: avisos de hidratação`).toEqual([])
  expect.soft(c.falhasDeRede, `${rotulo}: requisições com falha`).toEqual([])
  expect.soft(c.respostas4xx5xx, `${rotulo}: respostas 4xx/5xx`).toEqual([])
}

/** As imagens do Blob e do ytimg são do servidor falso, não do navegador: o navegador recebe um PNG de 1x1 (ou 404 em `semImagem`). */
export async function imagensFalsas(ctx: BrowserContext | Page, opts: { semImagem?: RegExp } = {}): Promise<void> {
  await ctx.route(/(blob\.vercel-storage\.com|i\.ytimg\.com|ggpht\.com)/, (r) => {
    if (opts.semImagem?.test(r.request().url())) return r.fulfill({ status: 404, body: '' })
    return r.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })
}

export async function definirTema(ctx: BrowserContext, base: string, tema: Tema): Promise<void> {
  await ctx.addCookies([{ name: 'btf_theme', value: tema, url: base }])
}

export async function foto(page: Page, nome: string): Promise<string> {
  fs.mkdirSync(SHOTS, { recursive: true })
  const f = path.join(SHOTS, nome.endsWith('.png') ? nome : `${nome}.png`)
  await page.screenshot({ path: f, fullPage: false })
  return f
}

export const nomeDaFoto = (e: string, estado: string, info: TestInfo, tema: Tema): string =>
  `${e}-${estado}-${larguraDoProjeto(info)}-${tema}${info.project.name.startsWith('tokyo') ? '-tokyo' : ''}.png`

// ── Fluxo comum: semeia, prepara o navegador e abre o detalhe ──
import { semearTeste, youtubeNoEstadoC, type OpcoesTeste, type TesteSemeado } from './semente'

export interface Preparado { t: TesteSemeado; coleta: Coleta; postsDeAcao: () => number }

export async function preparar(
  page: Page, ctx: BrowserContext, baseURL: string, tema: Tema, o: OpcoesTeste,
  extra: { youtube?: { titulo?: string; thumbDhash?: string }; semImagem?: RegExp; naoEsperadas?: RegExp[]; semYoutubeReset?: boolean } = {},
): Promise<Preparado> {
  if (!extra.semYoutubeReset) await youtubeNoEstadoC(extra.youtube)
  const t = await semearTeste(o)
  await imagensFalsas(ctx, extra.semImagem ? { semImagem: extra.semImagem } : {})
  await definirTema(ctx, baseURL, tema)
  const coleta = coletar(page, { naoEsperadas: extra.naoEsperadas ?? [] })
  let posts = 0
  page.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) posts++ })
  return { t, coleta, postsDeAcao: () => posts }
}

export async function abrir(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  if (/\/cms\/login|\/\?error=/.test(page.url())) throw new Error(`sessão perdida ao abrir ${url}: caiu em ${page.url()}`)
  await expect(page.getByRole('heading', { level: 1 }).or(page.getByTestId('active-detail')).or(page.getByTestId('early-detail')).or(page.getByRole('region', { name: 'Restauração do vídeo' })).first()).toBeVisible()
}

export const botaoEncerrar = (page: Page) => page.getByRole('button', { name: 'Encerrar', exact: true })
export const dialogoEncerrar = (page: Page) => page.getByRole('dialog', { name: 'Encerrar teste' })
