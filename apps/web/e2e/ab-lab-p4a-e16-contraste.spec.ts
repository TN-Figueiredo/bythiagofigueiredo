// P4a-E16 (T17 R2, Naksu B1/L1): contraste medido no navegador, nos dois temas: frase-resumo da faixa, <b> das datas, botão primário do diálogo
// e título do diálogo. Mínimo WCAG AA 4,5:1. O fundo efetivo é composto subindo pelos ancestrais (alfa incluído).
import { test, expect, type Locator } from '@playwright/test'
import { limpar, instanteSp, semearTeste } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, botaoEncerrar, dialogoEncerrar, esperarLimpo, foto, nomeDaFoto, preparar, TEMAS } from './ab-lab-p4a-suporte/comum'

test.use({ storageState: AUTH.admin })
test.beforeAll(async () => { await limpar() })

async function contraste(alvo: Locator): Promise<{ razao: number; fg: string; bg: string; fonte: string }> {
  return alvo.first().evaluate((el) => {
    const c = document.createElement('canvas'); c.width = c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
    }
    const sobre = (f: [number, number, number, number], b: [number, number, number, number]): [number, number, number, number] => {
      const a = f[3] + b[3] * (1 - f[3])
      if (a === 0) return [0, 0, 0, 0]
      return [0, 1, 2].map((i) => (f[i]! * f[3] + b[i]! * b[3] * (1 - f[3])) / a).concat([a]) as [number, number, number, number]
    }
    let bg: [number, number, number, number] = [0, 0, 0, 0]
    for (let n: Element | null = el; n; n = n.parentElement) {
      bg = sobre(bg, rgba(getComputedStyle(n).backgroundColor))
      if (bg[3] >= 0.999) break
    }
    if (bg[3] < 0.999) bg = sobre(bg, [255, 255, 255, 1])
    const fg = sobre(rgba(getComputedStyle(el).color), bg)
    const lum = (x: number[]) => { const l = x.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]! }
    const [a, b] = [lum(fg), lum(bg)]
    return { razao: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100, fg: fg.map((v, i) => (i < 3 ? Math.round(v) : v)).join(','), bg: bg.map((v, i) => (i < 3 ? Math.round(v) : v)).join(','), fonte: getComputedStyle(el).fontSize }
  })
}

for (const tema of TEMAS) {
  test(`E16 [${tema}]: contraste >= 4,5:1 na frase-resumo da faixa, no <b> das datas e no botão primário do diálogo; fundo do diálogo claro no tema claro`, async ({ page, context, baseURL }, info) => {
    const em2 = instanteSp(5, 2).toISOString()
    const { t, coleta } = await preparar(page, context, baseURL!, tema, {
      nome: `E16 ${tema} ${info.project.name}`, status: 'completed',
      restoreStatus: { title: { estado: 'falhou', destino: 'B', em: em2, erro: { status: 403, reason: 'forbidden', chamada: 'videos.update' }, forcado: true }, thumbnail: { estado: 'ok', destino: 'B', em: em2 } },
    })
    await abrir(page, t.url)
    const faixa = page.locator('.faixa-rest .fr-band')
    await expect(faixa).toBeVisible()
    const medidas: Record<string, { razao: number }> = {}
    medidas.resumo = await contraste(faixa.locator('.fr-rest'))
    medidas.rotulo = await contraste(faixa.locator('.fr-lbl'))
    medidas.dataB = await contraste(faixa.locator('.fr-d b'))
    medidas.linha = await contraste(faixa.locator('.fr-d'))
    const fundoFaixa = await faixa.evaluate((el) => getComputedStyle(el).backgroundColor)
    await foto(page, nomeDaFoto('E16', 'faixa', info, tema).replace('.png', '-r2.png'))

    const ativo = await semearTeste({ nome: `E16d ${tema} ${info.project.name}`, status: 'active' })
    await abrir(page, ativo.url)
    await botaoEncerrar(page).click()
    const dlg = dialogoEncerrar(page)
    await dlg.getByRole('radio', { name: 'Variante B' }).check()
    medidas.botaoPrimario = await contraste(dlg.getByRole('button', { name: 'Encerrar e ficar com B' }))
    medidas.tituloDialogo = await contraste(dlg.getByRole('heading', { name: 'Encerrar teste' }))
    const fundoDlg = await dlg.evaluate((el) => getComputedStyle(el).backgroundColor)
    await foto(page, nomeDaFoto('E16', 'dialogo', info, tema).replace('.png', '-r2.png'))
    info.annotations.push({ type: 'contraste', description: JSON.stringify({ medidas, fundoFaixa, fundoDlg }) })

    const abaixo = Object.entries(medidas).filter(([, m]) => m.razao < 4.5).map(([k, m]) => `${k}=${m.razao}`)
    expect(abaixo, `contraste abaixo de 4,5:1 (${tema})`).toEqual([])
    if (tema === 'light') {
      const m = fundoDlg.match(/[\d.]+/g)!.map(Number)
      expect((0.2126 * m[0]! + 0.7152 * m[1]! + 0.0722 * m[2]!) / 255, `fundo do diálogo claro (${fundoDlg})`).toBeGreaterThan(0.8)
    }
    esperarLimpo(coleta, `E16 ${tema}`)
  })
}
