// Auxiliares da suíte do Gio (F1a-tela-1): tema, coleta, rotas falsas, medidas do Step 2 e capturas.
import fs from 'node:fs'
import path from 'node:path'
import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import { semear, HOST, type Extra, type Mundo } from './semente'
import { coletar, imagensFalsas, definirTema, type Coleta, type Tema } from '../ab-lab-p4a-suporte/comum'

export const SHOTS = '/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/f1a-tela-1/gio-shots'
export const MEDIDAS = '/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/f1a-tela-1/gio-medidas.jsonl'
export const AUTH_F1A = path.resolve(__dirname, '../.auth/f1a-admin.json')
export const PORTA = process.env.F1A_PORTA ?? '3094'
export const BASE = `http://${HOST}:${PORTA}`

export const tema = (i: TestInfo): Tema => (i.project.name.endsWith('light') ? 'light' : 'dark')
export const largura = (i: TestInfo): 390 | 1440 => (i.project.name.startsWith('l390') ? 390 : 1440)
export const soNoProjeto = (i: TestInfo, nome = 'l1440-dark'): boolean => i.project.name === nome

export interface Ambiente { m: Mundo; coleta: Coleta; posts: string[]; janelas: string[] }

/** Semeia, liga rotas falsas, tema, relógio do cliente e coleta de console/rede. `window.open` é interceptado (o Studio nunca abre). */
export async function preparar(
  page: Page, ctx: BrowserContext, info: TestInfo,
  o: { extras?: Extra[]; naoEsperadas?: RegExp[]; semear?: boolean } = {},
): Promise<Ambiente> {
  const m = await semear({ extras: o.extras ?? [] })
  await imagensFalsas(ctx)
  await definirTema(ctx, BASE, tema(info))
  // O aviso de `key` do AbLabDashboard (achado F-1 do Gio) é cobrado num teste só (lista.spec 'console limpo'); aqui não afoga os demais.
  const coleta = coletar(page, { naoEsperadas: [/unique "key" prop/, ...(o.naoEsperadas ?? [])] })
  const posts: string[] = []
  page.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) posts.push(r.url()) })
  const janelas: string[] = []
  await page.exposeFunction('__giojanela', (u: string) => { janelas.push(u) })
  await page.addInitScript(() => {
    window.open = ((u?: string | URL) => { void (window as unknown as { __giojanela: (s: string) => void }).__giojanela(String(u ?? '')); return null }) as typeof window.open
  })
  await page.clock.setFixedTime(m.agora)
  return { m, coleta, posts, janelas }
}

export async function abrirLista(page: Page, query = ''): Promise<Locator> {
  await page.goto(`/cms/youtube/ab-lab${query}`)
  if (/\/login|\/\?error=/.test(page.url())) throw new Error(`sessão perdida: ${page.url()}`)
  const lista = page.getByRole('region', { name: 'Vídeos do A/B Lab' })
  await expect(lista).toBeVisible({ timeout: 30_000 })
  await expect(lista.locator('li[data-linha]').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle') // hidratou: clique antes disso não faz nada e não é o que se testa
  return lista
}
export const linha = (page: Page, m: Mundo, chave: string): Locator => page.locator(`li[data-linha="${m.v[chave]!.id}"]`)
export const ficha = (page: Page): Locator => page.locator('section.cn-ficha')

/** Apaga o ruído de animação para capturas e medidas comparáveis. */
export async function semAnimacao(page: Page): Promise<void> {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' })
}

export async function foto(page: Page, info: TestInfo, estado: string, alvo?: Locator): Promise<string> {
  fs.mkdirSync(SHOTS, { recursive: true })
  const f = path.join(SHOTS, `${largura(info)}-${tema(info)}-${estado}.png`)
  if (alvo) await alvo.screenshot({ path: f }); else await page.screenshot({ path: f })
  return f
}

export interface Medida {
  estado: string; projeto: string
  semTextoRuim: string[]; scrollWidth: number; innerWidth: number
  contrasteBaixo: string[]; alvosPequenos: string[]; primarios: number
  textosMedidos: number; menorContraste: number; alvosMedidos: number
}

/** Medidas do Step 2 dentro de `raiz` (a página toda por padrão). Não falha: devolve; quem chama afirma e registra. */
export async function medir(page: Page, raiz: Locator, estado: string, info: TestInfo): Promise<Medida> {
  const dados = await raiz.evaluate((el, estreito) => {
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1
    const cx = cvs.getContext('2d', { willReadFrequently: true })!
    const rgba = (c: string): [number, number, number, number] => {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1)
      const d = cx.getImageData(0, 0, 1, 1).data; return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
    }
    const lum = (r: number, g: number, b: number): number => {
      const f = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const fundo = (e: Element): [number, number, number] => {
      const camadas: Array<[number, number, number, number]> = []
      for (let n: Element | null = e; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor)
        if (c[3] > 0) { camadas.push(c); if (c[3] >= 0.999) break }
      }
      let [r, g, b] = [255, 255, 255]
      if (!camadas.length || camadas[camadas.length - 1]![3] < 0.999) { const bg = rgba(getComputedStyle(document.body).backgroundColor); [r, g, b] = [bg[0], bg[1], bg[2]] }
      for (let i = camadas.length - 1; i >= 0; i--) { const [cr, cg, cb, ca] = camadas[i]!; r = cr * ca + r * (1 - ca); g = cg * ca + g * (1 - ca); b = cb * ca + b * (1 - ca) }
      return [r, g, b]
    }
    const visivel = (e: Element): boolean => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01
    }
    const desc = (e: Element): string => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String((e as HTMLElement).className).split(' ')[0] ?? ''} "${(e.textContent ?? '').trim().slice(0, 40)}"`
    const baixo: string[] = []
    let nTextos = 0; let menor = 99
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const vistos = new Set<Element>()
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const e = t.parentElement; if (!e || vistos.has(e) || !(t.textContent ?? '').trim() || !visivel(e)) continue
      if (e.closest('[disabled], [aria-disabled=true]')) continue
      vistos.add(e)
      const s = getComputedStyle(e); const [r, g, b] = fundo(e); const [fr, fg, fb, fa] = rgba(s.color)
      const mr = fr * fa + r * (1 - fa), mg = fg * fa + g * (1 - fa), mb = fb * fa + b * (1 - fa)
      const l1 = lum(mr, mg, mb), l2 = lum(r, g, b); const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const px = parseFloat(s.fontSize); const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700)
      nTextos++; if (cr < menor) menor = cr
      if (cr < (grande ? 3 : 4.5)) baixo.push(`${cr.toFixed(2)}:1 ${desc(e)}`)
    }
    const alvos: string[] = []
    let nAlvos = 0
    if (estreito) {
      el.querySelectorAll('button, a[href], [role=button], input, textarea, select, [role=radio]').forEach((b) => {
        if (!visivel(b)) return
        const r = b.getBoundingClientRect(); const e = b as HTMLElement
        if ((e.hasAttribute('disabled')) ) return
        if (e.classList.contains('cn-sr')) return // input de arquivo só para leitor de tela (1x1); o alvo tocável é o rótulo
        nAlvos++
        if (r.height < 43.5 || r.width < 43.5) alvos.push(`${Math.round(r.width)}x${Math.round(r.height)} ${desc(b)}`)
      })
    }
    const texto = (el as HTMLElement).innerText
    const ruins = ['undefined', 'NaN', 'null', '[object', 'Invalid Date'].filter((p) => new RegExp(`(^|[^A-Za-z])${p.replace('[', '\\[')}([^A-Za-z]|$)`).test(texto))
    const pri = Array.from(el.querySelectorAll('.pri')).filter(visivel).length
    return { nTextos, menor, nAlvos, baixo, alvos, ruins, pri, sw: document.documentElement.scrollWidth, iw: window.innerWidth }
  }, largura(info) === 390)
  return { estado, projeto: info.project.name, semTextoRuim: dados.ruins, scrollWidth: dados.sw, innerWidth: dados.iw, contrasteBaixo: dados.baixo, alvosPequenos: dados.alvos, primarios: dados.pri, textosMedidos: dados.nTextos, menorContraste: Math.round(dados.menor * 100) / 100, alvosMedidos: dados.nAlvos }
}

/** Afirma as medidas do Step 2 e as registra no JSONL do relatório. */
export async function medirEAfirmar(page: Page, raiz: Locator, estado: string, info: TestInfo, c: Coleta, o: { maxPri?: number } = {}): Promise<Medida> {
  const x = await medir(page, raiz, estado, info)
  fs.appendFileSync(MEDIDAS, JSON.stringify({ ...x, erros: c.erros.length, hidratacao: c.hidratacao.length, rede: c.falhasDeRede.length + c.respostas4xx5xx.length }) + '\n')
  expect.soft(x.semTextoRuim, `${estado}: texto "undefined/NaN/null"`).toEqual([])
  expect.soft(x.contrasteBaixo, `${estado}: contraste abaixo de 4,5:1 (3:1 grande)`).toEqual([])
  expect.soft(x.alvosPequenos, `${estado}: alvos < 44 px a 390`).toEqual([])
  expect.soft(x.primarios, `${estado}: no máximo ${o.maxPri ?? 1} .pri visível`).toBeLessThanOrEqual(o.maxPri ?? 1)
  expect.soft(x.scrollWidth, `${estado}: rolagem horizontal (scrollWidth == innerWidth)`).toBeLessThanOrEqual(x.innerWidth)
  expect.soft(c.erros, `${estado}: erros de console`).toEqual([])
  expect.soft(c.hidratacao, `${estado}: hidratação`).toEqual([])
  expect.soft(c.falhasDeRede, `${estado}: falhas de rede`).toEqual([])
  expect.soft(c.respostas4xx5xx.filter((r) => !JSON.stringify(r).includes('/b-img.png')), `${estado}: 4xx/5xx`).toEqual([]) // b-img.png: 404 injetado de propósito no spec de imagem que falha
  return x
}

// ── Ficha ──
export const YT_MOCK = 'http://127.0.0.1:3095'
export async function ytCtl(corpo: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${YT_MOCK}/__ctl`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
  if (!r.ok) throw new Error(`YouTube falso recusou ${JSON.stringify(corpo).slice(0, 80)}: ${r.status}`)
}

let png: Buffer | null = null
/** PNG 1280 × 720 de verdade (o servidor mede com sharp). */
export async function imagem1280(): Promise<Buffer> {
  if (png) return png
  const sharp = (await import('sharp')).default
  png = await sharp({ create: { width: 1280, height: 720, channels: 3, background: { r: 30, g: 60, b: 160 } } }).png().toBuffer()
  return png
}

/** Abre a ficha pela linha (clique no botão), sem URL especial. Devolve a seção da ficha. */
export async function abrirFichaDaLinha(page: Page, m: Mundo, chave: string, botao: string): Promise<Locator> {
  const li = linha(page, m, chave)
  await li.getByRole('button', { name: botao }).click()
  const f = ficha(page)
  await expect(f).toBeVisible({ timeout: 20_000 })
  await expect(f.locator('h2#cn-fh')).toBeVisible()
  await expect(f.getByText(/Carregando a ficha/)).toHaveCount(0, { timeout: 20_000 })
  return f
}

/** Alcança "Os dois" quando a ficha nova nasce sem campo para escrever (achado F-3): registra no teste e segue. */
export async function garantirCampoDaB(f: Locator, _info: TestInfo): Promise<boolean> {
  // F-3 consertado (e20d70988): a ficha nova já mostra o campo de título; para enviar imagem, o dono escolhe "Os dois"
  await expect(f.locator('#cn-t2')).toBeVisible()
  await f.getByRole('radio', { name: 'Os dois' }).click()
  await expect(f.locator('input[type=file][aria-label="Enviar imagem da versão B"]')).toHaveCount(1)
  return true
}
