// Comentários em produção · T7 (Gio): o fio único no vídeo e no canal, em navegador, logado.
// Mede o que o jsdom não mede: rolagem horizontal, alvos de toque, fonte mínima, posição do "N de 12" a 390, nome longo, resposta distinta,
// teclado (Tab chega, Enter alterna, onde o foco fica), leitor de tela (avatares aria-hidden, "Espectador" e "Criador" como texto) e o canal com um grupo só.
// Semente `comentariosC5` (relógio fixo do projeto); esperados saem das constantes de `C5` e do mockup (variante B), nunca lidos da tela.
// Classes REAIS (o plano usava as do mockup): `.cd-aba` (era `.aba`), `.ibtn` (era `.info`), `.cd-mais` (o "Ver as outras 7" do vídeo).
import path from 'node:path'
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { C5 } from '../../../fixtures/observatorio-seed'

const SHOTS = process.env.GIO_SHOTS ?? 'test-results/cq-t7'
let ids: ReturnType<typeof seedIdsOf>
test.use({ storageState: ADMIN_STATE })
test.beforeAll(async () => {
  test.setTimeout(240_000)
  await clearSeeded()
  ids = seedIdsOf(await ensureSeeded({ comentariosC5: true }))
})
test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

const LARGURAS = [390, 600, 1440] as const
const TEMAS = ['dark', 'light'] as const
const COMBOS = LARGURAS.flatMap(w => TEMAS.map(t => ({ w, t })))

async function abrir(page: Page, ctx: BrowserContext, base: string, w: number, theme: string, rota: string, espera: string): Promise<string[]> {
  const problemas: string[] = []
  page.on('pageerror', e => problemas.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') problemas.push('console: ' + m.text() + ' ' + (m.location().url ?? '')) })
  await page.route(/(ytimg|ggpht)\.com/, r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }))
  await ctx.addCookies([{ name: 'btf_theme', value: theme, url: base }])
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto(rota)
  await page.locator(espera).first().waitFor({ timeout: 120_000 })
  await page.waitForLoadState('networkidle')
  return problemas
}
const videoUrl = () => '/cms/youtube/competitors/video/' + ids.video(C5.video.cheio)
const canalUrl = () => '/cms/youtube/competitors/canal/' + ids.channel(C5.canal)

/** Pressiona Tab até o alvo ter o foco (no máximo `max` vezes). Devolve quantas teclas gastou, ou -1. */
async function tabAte(page: Page, alvo: ReturnType<Page['locator']>, max = 60): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab')
    if (await alvo.evaluate(el => el === document.activeElement).catch(() => false)) return i
  }
  return -1
}

for (const c of COMBOS) {
  test(`vídeo ${c.w} ${c.t}: sem rolagem horizontal, alvos, fonte, "N de 12", resposta distinta, avatares`, async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    const problemas = await abrir(page, context, baseURL!, c.w, c.t, videoUrl(), '.cd-secao .cf:visible')
    const m = await page.evaluate(() => {
      const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const doc = document.documentElement
      const sec = document.querySelector<HTMLElement>('.cd-secao')!
      const alturas = (sel: string) => [...document.querySelectorAll(sel)].filter(vis).map(e => Math.round((e as HTMLElement).getBoundingClientRect().height))
      const fontes = [...sec.querySelectorAll('.cf *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim()))
        .map(e => ({ t: (e.textContent ?? '').trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) })).filter(x => x.px < 12)
      const cf = [...sec.querySelectorAll<HTMLElement>('.cf')].filter(vis)
      const primeiro = cf[0]!
      const nome = primeiro.querySelector<HTMLElement>('.cf-head > .cf-nome')!, push = primeiro.querySelector<HTMLElement>('.cf-meta.push')
      const resp = [...sec.querySelectorAll<HTMLElement>('.cf-resp')].filter(vis)[0]!
      const bg = (el: Element) => getComputedStyle(el).backgroundColor
      const estoura = cf.filter(el => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > doc.clientWidth + 1).length
      return {
        scrollX: doc.scrollWidth > doc.clientWidth, estoura,
        alturaLink: alturas('.cd-secao .cf-link'), alturaAba: alturas('.cd-secao .cd-aba'), alturaInfo: alturas('.cd-secao .ibtn'), alturaMais: alturas('.cd-secao .cd-mais'),
        fontes,
        nomeTop: Math.round(nome.getBoundingClientRect().top + nome.getBoundingClientRect().height / 2), pushTop: push ? Math.round(push.getBoundingClientRect().top + push.getBoundingClientRect().height / 2) : null, pushTexto: push?.textContent?.trim() ?? null,
        bgResp: bg(resp), bgFio: bg(primeiro), bordaResp: getComputedStyle(resp).borderLeftColor,
        avatares: [...sec.querySelectorAll('.cf-av')].filter(vis).map(a => a.getAttribute('aria-hidden')),
        textoSec: sec.innerText,
      }
    })
    const tq = c.w <= 480 ? 44 : 24
    expect(m.scrollX, 'sem rolagem horizontal da página').toBe(false)
    expect(m.estoura, 'nenhum fio estoura a largura').toBe(0)
    for (const h of m.alturaLink) expect(h, '.cf-link >= 44').toBeGreaterThanOrEqual(44)
    for (const h of m.alturaAba) expect(h, '.cd-aba >= 44').toBeGreaterThanOrEqual(44)
    for (const h of [...m.alturaInfo, ...m.alturaMais]) expect(h, `alvo (ⓘ/Ver as outras) >= ${tq}`).toBeGreaterThanOrEqual(tq)
    expect(m.fontes, 'nenhuma fonte abaixo de 12 px dentro de .cf').toEqual([])
    expect(m.pushTexto, 'posição "N de 12" existe no primeiro fio').toMatch(/^1 de 12$/)
    expect(Math.abs((m.pushTop ?? 9999) - m.nomeTop), '"N de 12" na linha do nome (centros verticais a no máximo 3 px)').toBeLessThanOrEqual(3)
    expect(m.bgResp, 'resposta do criador com fundo próprio').not.toBe(m.bgFio)
    expect(m.bgResp, 'fundo da resposta não é transparente (Opera: sem color-mix)').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(m.avatares.every(a => a === 'true'), `avatares aria-hidden: ${JSON.stringify(m.avatares)}`).toBe(true)
    expect(m.textoSec).toContain('Espectador')
    expect(m.textoSec).toContain('Criador')
    await page.locator('.cd-secao').screenshot({ path: path.join(SHOTS, `video-${c.w}-${c.t}.png`) })
    // o console do vídeo tem teste próprio (abaixo): aqui só o que não é o aviso de `key`
    expect(problemas.filter(p => !/unique "key" prop/.test(p))).toEqual([])
  })

  test(`canal ${c.w} ${c.t}: um grupo, título do vídeo uma vez, sem rolagem horizontal, alvos e fonte`, async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    const problemas = await abrir(page, context, baseURL!, c.w, c.t, canalUrl(), '#criador .cf:visible')
    const m = await page.evaluate((titulo) => {
      const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const doc = document.documentElement
      const sec = document.querySelector<HTMLElement>('#criador')!
      const fontes = [...sec.querySelectorAll('.cf *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim()))
        .map(e => ({ t: (e.textContent ?? '').trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) })).filter(x => x.px < 12)
      return {
        scrollX: doc.scrollWidth > doc.clientWidth,
        grupos: sec.querySelectorAll('.pc-grupo').length, fios: [...sec.querySelectorAll('.cf')].filter(vis).length,
        titulos: (sec.innerText.match(new RegExp(titulo.replace(/[()]/g, '\\$&'), 'g')) ?? []).length,
        links: [...sec.querySelectorAll('a.pc-grupo-tit')].map(a => a.getAttribute('href')),
        alturaLink: [...sec.querySelectorAll('.cf-link')].filter(vis).map(e => Math.round((e as HTMLElement).getBoundingClientRect().height)),
        avatares: [...sec.querySelectorAll('.cf-av')].filter(vis).map(a => a.getAttribute('aria-hidden')),
        fontes, texto: sec.innerText,
      }
    }, 'C5 Vídeo cheio (3 retratos, 13 comentários)')
    expect(m.scrollX, 'sem rolagem horizontal').toBe(false)
    expect(m.grupos, 'um grupo só').toBe(1)
    expect(m.titulos, 'o título do vídeo aparece uma vez só').toBe(1)
    expect(m.links.length).toBe(1)
    expect(m.fios, 'dois fios com resposta do criador').toBe(2)
    for (const h of m.alturaLink) expect(h).toBeGreaterThanOrEqual(44)
    expect(m.fontes).toEqual([])
    expect(m.avatares.every(a => a === 'true')).toBe(true)
    expect(m.texto).toContain('Espectador')
    expect(m.texto).toContain('Criador')
    await page.locator('#criador').screenshot({ path: path.join(SHOTS, `canal-${c.w}-${c.t}.png`) })
    expect(problemas).toEqual([])
  })
}

test('vídeo: console limpo (nenhum aviso de hidratação, nenhum "unique key")', async ({ page, context, baseURL }) => {
  test.setTimeout(180_000)
  const problemas = await abrir(page, context, baseURL!, 1440, 'dark', videoUrl(), '.cd-secao .cf:visible')
  expect(problemas).toEqual([])
})

test.describe('teclado e foco (vídeo, 1440 escuro)', () => {
  test('Tab chega a "Ver as outras 7", "Ver tudo" e "Recolher"; Enter alterna; o foco vai (ou fica) onde o código promete', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    const problemas = await abrir(page, context, baseURL!, 1440, 'dark', videoUrl(), '.cd-secao .cf:visible')
    // começa pelo painel de 30 dias (o aberto): a primeira parada depois do título é o ⓘ, depois as abas
    await page.locator('.cd-secao .ibtn').first().focus()
    const mais = page.locator('.cd-secao .cd-painel:not([hidden]) .cd-mais').first()
    await expect(mais).toHaveText('Ver as outras 7')
    expect(await tabAte(page, mais), 'Tab chega ao "Ver as outras 7"').toBeGreaterThan(0)
    await page.keyboard.press('Enter')
    await expect(mais).toHaveAttribute('aria-expanded', 'true')
    await expect(mais).toHaveText('Recolher')
    // o 6º fio ganha o foco (comportamento escrito em comentarios-e5-pecas.test.tsx)
    const sexto = page.locator('.cd-secao .cd-painel:not([hidden]) .cf').nth(5)
    await expect(sexto).toBeFocused()
    // o filtro por texto muda quando o botão vira "Recolher": fixa o elemento com uma marca antes de alternar
    await page.locator('.cd-secao .cd-painel:not([hidden]) .cf-link', { hasText: 'Ver tudo' }).first().evaluate(e => e.setAttribute('data-gio', 'vt'))
    const verTudo = page.locator('[data-gio=vt]')
    await verTudo.scrollIntoViewIfNeeded()
    await verTudo.focus()
    await page.keyboard.press('Enter')
    await expect(verTudo).toBeFocused()
    await expect(verTudo).toHaveText('Recolher')
    await expect(verTudo).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Space')
    await expect(verTudo).toHaveText('Ver tudo')
    await mais.focus()
    await page.keyboard.press('Enter')
    await expect(mais).toHaveText('Ver as outras 7')
    await expect(mais).toBeFocused()
    expect(problemas.filter(p => !/unique "key" prop/.test(p))).toEqual([])
  })
})
