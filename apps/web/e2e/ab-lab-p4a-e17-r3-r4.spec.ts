// P4a-E5c/E5d ("mudou" com o diálogo já fechado vira aviso na página + refresh), E6b (sessão expirada no Pausar) e E17 (Esc no painel de
// ajustes salva a edição pendente). Textos: ab-end-test-dialog.tsx, ab-pause-dialog.tsx, settings-drawer.tsx (T17 R4 / T18 R1).
import { test, expect, type Page } from '@playwright/test'
import { cliente, estadoFalso, lerTeste, siteId } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, botaoEncerrar, dialogoEncerrar, esperarLimpo, foto, nomeDaFoto, preparar, temaDoProjeto } from './ab-lab-p4a-suporte/comum'
import { limpar } from './ab-lab-p4a-suporte/semente'

test.beforeAll(async () => { await limpar() })
test.use({ storageState: AUTH.admin })

/** Segura 1,5 s cada server action da página: dá tempo de fechar o diálogo (Esc) com a action ainda em voo. */
async function segurarActions(page: Page, ms = 1500) {
  await page.route((u) => u.pathname.startsWith('/cms/youtube/ab-lab'), async (route) => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) await new Promise((r) => setTimeout(r, ms))
    await route.continue()
  })
}

test('E5c: A confirma Encerrar, fecha o diálogo (Esc) com a action em voo, B já tinha pausado: aviso na página, página atualizada, nada escrito', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E5c ${info.project.name}`, status: 'active' }, { naoEsperadas: [/409/] })
  await abrir(page, t.url)
  await botaoEncerrar(page).click()
  const dlg = dialogoEncerrar(page)
  await dlg.getByRole('radio', { name: 'Variante B' }).check()

  const outra = await context.newPage()
  await outra.goto(t.url)
  await outra.waitForLoadState('networkidle')
  await outra.getByRole('button', { name: 'Pausar', exact: true }).click()
  await outra.getByRole('dialog', { name: 'Pausar teste' }).getByRole('button', { name: /^Pausar/ }).last().click()
  await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 15_000 }).toBe('paused')
  const antes = await estadoFalso()
  expect(antes.escritas.length, 'a pausa de B escreveu 2 vezes').toBe(2)
  await outra.close()

  await segurarActions(page)
  await dlg.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  const aviso = page.getByText('O teste mudou em outra aba antes de encerrar. Nada foi alterado.')
  await expect(aviso).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Retomar' }), 'router.refresh mostra o teste pausado').toBeVisible({ timeout: 15_000 })
  await expect(aviso, 'o aviso sobrevive ao refresh').toBeVisible()
  await foto(page, nomeDaFoto('E5c', 'aviso-fechado-r3', info, tema))
  expect((await estadoFalso()).escritas, 'A não escreve nada').toEqual(antes.escritas)
  expect((await lerTeste(t.testId)).status).toBe('paused')
  esperarLimpo(coleta, 'E5c')
})

test('E5d: A confirma Pausar, fecha o diálogo (Esc) com a action em voo, B já tinha encerrado: aviso na página, página atualizada, nada escrito depois', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E5d ${info.project.name}`, status: 'active' }, { naoEsperadas: [/409/] })
  // O aviso é de curta vida neste cenário: o refresh troca o detalhe ativo pelo de teste encerrado e o estado do aviso some junto (achado do R3).
  // Por isso o spec afirma que ele APARECEU (observador de DOM) e que a página foi atualizada, não que ele permanece.
  await page.addInitScript(() => {
    const w = window as unknown as { __avisoVisto: boolean }
    w.__avisoVisto = false
    new MutationObserver(() => { if (document.body && /mudou em outra aba antes de pausar/.test(document.body.innerText)) w.__avisoVisto = true })
      .observe(document, { childList: true, subtree: true, characterData: true })
  })
  await abrir(page, t.url)
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  const pausa = page.getByRole('dialog', { name: 'Pausar teste' })
  await expect(pausa).toBeVisible()

  const outra = await context.newPage()
  await outra.goto(t.url)
  await outra.waitForLoadState('networkidle')
  await botaoEncerrar(outra).click()
  const d2 = dialogoEncerrar(outra)
  await d2.getByRole('radio', { name: 'Variante B' }).check()
  await d2.getByRole('button', { name: 'Encerrar e ficar com B' }).click()
  await expect.poll(async () => (await lerTeste(t.testId)).status, { timeout: 20_000 }).toBe('completed')
  await expect.poll(async () => (await estadoFalso()).escritas.length, { timeout: 20_000 }).toBe(2)
  const antes = await estadoFalso()
  await outra.close()

  await segurarActions(page)
  await pausa.getByRole('button', { name: /^Pausar/ }).last().click()
  await page.keyboard.press('Escape')
  await expect(pausa).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pausar', exact: true }), 'refresh: teste encerrado não tem Pausar').toHaveCount(0, { timeout: 15_000 })
  expect(await page.evaluate(() => (window as unknown as { __avisoVisto: boolean }).__avisoVisto), 'o aviso "mudou ... antes de pausar" chegou a ser exibido').toBe(true)
  await foto(page, nomeDaFoto('E5d', 'aviso-fechado-r3', info, tema))
  expect((await estadoFalso()).escritas).toEqual(antes.escritas)
  expect((await lerTeste(t.testId)).status).toBe('completed')
  esperarLimpo(coleta, 'E5d')
})

test('E6b: sessão expirada com o diálogo de Pausar aberto: frase de sessão e link "Entrar de novo" para /cms/login?next=, nada escrito', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E6b ${info.project.name}`, status: 'active' }, { naoEsperadas: [/\/cms\/login/, /401/, /307/] })
  await abrir(page, t.url)
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  const pausa = page.getByRole('dialog', { name: 'Pausar teste' })
  await expect(pausa).toBeVisible()
  const antes = await lerTeste(t.testId)
  expect((await context.cookies()).filter((c) => /^sb-/.test(c.name)).length).toBeGreaterThan(0)
  await context.clearCookies({ name: /^sb-/ })
  await pausa.getByRole('button', { name: /^Pausar/ }).last().click()
  await expect(pausa.getByText('Sua sessão expirou. Entre de novo para pausar o teste.')).toBeVisible({ timeout: 15_000 })
  const entrar = pausa.getByRole('link', { name: 'Entrar de novo' })
  await expect(entrar).toBeVisible()
  expect(await entrar.getAttribute('href')).toMatch(/^\/cms\/login\?next=/)
  await expect(pausa.getByText(/Sem resposta/)).toHaveCount(0)
  await foto(page, nomeDaFoto('E6b', 'pausar-sessao-expirada-r3', info, tema))
  expect((await lerTeste(t.testId)).status, 'estado intocado').toBe(antes.status)
  expect((await estadoFalso()).escritas, 'nada escrito no YouTube').toEqual([])
  void coleta
})

test('E17: Esc no painel de ajustes logo após mudar um campo salva a edição (não descarta)', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { coleta } = await preparar(page, context, baseURL!, tema, { nome: `E17 ${info.project.name}`, status: 'active' }, {})
  const db = cliente()
  const sid = await siteId(db)
  const lerSettings = async () => {
    const { data } = await db.from('sites').select('settings').eq('id', sid).single()
    return (data?.settings ?? {}) as Record<string, unknown>
  }
  const original = await lerSettings()
  try {
    await page.goto('/cms/youtube/ab-lab')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Configurações' }).click()
    const painel = page.getByRole('dialog', { name: 'Configurações do A/B Lab' })
    await expect(painel).toBeVisible()
    const seletor = painel.getByRole('combobox').first()
    const atual = await seletor.inputValue()
    const novo = atual === '21' ? '28' : '21'
    await seletor.selectOption(novo)
    await page.keyboard.press('Escape') // bem antes dos 500 ms do debounce
    await expect(painel).toHaveCount(0)
    await expect.poll(async () => ((await lerSettings()).ab_test as Record<string, unknown> | undefined)?.default_duration_days, { timeout: 10_000 }).toBe(Number(novo))
    await foto(page, nomeDaFoto('E17', 'esc-salvou-r3', info, tema))
    // reabrir mostra o valor salvo
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Configurações' }).click()
    await expect(page.getByRole('dialog', { name: 'Configurações do A/B Lab' }).getByRole('combobox').first()).toHaveValue(novo)
  } finally {
    await db.from('sites').update({ settings: original }).eq('id', sid)
  }
  esperarLimpo(coleta, 'E17')
})
