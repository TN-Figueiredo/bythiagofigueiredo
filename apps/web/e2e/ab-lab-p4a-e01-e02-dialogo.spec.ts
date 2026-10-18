// P4a-E1 e P4a-E2: o diálogo "O que fica no vídeo?" (nenhuma opção marcada, botão que nomeia o destino).
// E1 está em duas partes: (a) estrutura e acessibilidade estática; (b) teclado (Tab, Esc, foco de volta). A (b) falhando não esconde a (a).
import { test, expect } from '@playwright/test'
import { limpar } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, botaoEncerrar, dialogoEncerrar, esperarLimpo, foto, nomeDaFoto, preparar, TEMAS } from './ab-lab-p4a-suporte/comum'

test.use({ storageState: AUTH.admin })
test.beforeAll(async () => { await limpar() })

for (const tema of TEMAS) {
  test(`E1a [${tema}]: abre sem opção marcada, botão aria-disabled com dica, sem linha de views/dia; E2: marcar B nomeia o botão`, async ({ page, context, baseURL }, info) => {
    const { t, coleta, postsDeAcao } = await preparar(page, context, baseURL!, tema, { nome: `E1a ${tema}`, status: 'active' })
    await abrir(page, t.url)
    await botaoEncerrar(page).click()

    const dlg = dialogoEncerrar(page)
    await expect(dlg).toBeVisible()
    await expect(dlg).toHaveAttribute('aria-labelledby', 'etd-t')
    await expect(dlg.getByRole('heading', { name: 'Encerrar teste' })).toBeVisible()
    const grupo = dlg.getByRole('group', { name: 'O que fica no vídeo?' })
    await expect(grupo).toBeVisible()
    expect(await grupo.evaluate((el) => el.tagName)).toBe('FIELDSET')
    const radios = dlg.getByRole('radio')
    await expect(radios).toHaveCount(3)
    for (let i = 0; i < 3; i++) await expect(radios.nth(i)).not.toBeChecked()
    const enviar = dlg.getByRole('button', { name: 'Encerrar', exact: true })
    await expect(enviar).toHaveAttribute('aria-disabled', 'true')
    await expect(dlg.getByText('Escolha uma opção.')).toBeVisible()
    await expect(enviar).toHaveAttribute('aria-describedby', 'etd-hint')
    await expect(dlg.getByText(/views\s*\/\s*dia/i)).toHaveCount(0)
    await enviar.click({ force: true })
    expect(postsDeAcao(), 'botão desligado não envia').toBe(0)
    await foto(page, nomeDaFoto('E1', 'dialogo-sem-escolha', info, tema))

    // E2
    await dlg.getByRole('radio', { name: 'Variante B' }).check()
    const comB = dlg.getByRole('button', { name: 'Encerrar e ficar com B' })
    await expect(comB).toBeVisible()
    await expect(comB).toHaveAttribute('aria-disabled', 'false')
    await expect(dlg.getByText('Escolha uma opção.')).toHaveCount(0)
    await foto(page, nomeDaFoto('E2', 'dialogo-b-marcada', info, tema))
    await dlg.getByRole('radio', { name: 'A (original)' }).check()
    await expect(dlg.getByRole('button', { name: 'Encerrar e ficar com A (original)' })).toBeVisible()
    expect(postsDeAcao()).toBe(0)
    esperarLimpo(coleta, `E1a/E2 ${tema}`)
  })

  test(`E1b [${tema}]: teclado: foco entra no diálogo, Tab (Encerrar, depois Cancelar) não escapa, Esc fecha, foco volta ao botão que abriu`, async ({ page, context, baseURL }) => {
    const { t } = await preparar(page, context, baseURL!, tema, { nome: `E1b ${tema}`, status: 'active' })
    await abrir(page, t.url)
    const opener = botaoEncerrar(page)
    await opener.click()
    const dlg = dialogoEncerrar(page)
    await expect(dlg).toBeVisible()
    // o foco inicial está dentro do diálogo
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), { message: 'foco inicial dentro do diálogo' }).toBe(true)
    // Tab: percorre o ciclo; nunca sai do diálogo; Encerrar vem antes de Cancelar
    const visitados: string[] = []
    let saiu = false
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const r = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return { nome: a ? (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 30) : '', dentro: !!a?.closest('[role="dialog"]') } })
      visitados.push(r.nome)
      if (!r.dentro) saiu = true
    }
    expect(saiu, `Tab saiu do diálogo: ${visitados.join(' | ')}`).toBe(false)
    expect(visitados.indexOf('Encerrar'), visitados.join(' | ')).toBeGreaterThanOrEqual(0)
    expect(visitados.indexOf('Cancelar'), visitados.join(' | ')).toBeGreaterThan(visitados.indexOf('Encerrar'))
    // Esc fecha e o foco volta
    await page.keyboard.press('Escape')
    await expect(dlg).toHaveCount(0, { timeout: 3000 })
    await expect(opener).toBeFocused()
  })
}
