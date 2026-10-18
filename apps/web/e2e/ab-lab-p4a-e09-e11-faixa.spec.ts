// P4a-E9 (faixa em cada estado, comparada ao mockup aprovado), E10 (estado ausente) e E11 (hora de São Paulo em qualquer fuso).
// O mockup é aberto por file:// e a faixa dele é lida do DOM e comparada, campo a campo, com a faixa do app.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { limpar, horaSpManual, instanteSp, minAtras, type RsSemente, type CampoRs } from './ab-lab-p4a-suporte/semente'
import { AUTH, abrir, esperarLimpo, foto, nomeDaFoto, preparar, temaDoProjeto } from './ab-lab-p4a-suporte/comum'

test.use({ storageState: AUTH.admin })
test.beforeAll(async () => { await limpar() })

const MOCKUP = 'file://' + path.resolve(process.env.HOME ?? '', 'Workspace/bythiagofigueiredo/docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/index.html')
const HORA_RE = /\d\d\/\d\d \d\d:\d\d/g

interface Descritor {
  existe: boolean
  papel: string | null
  tom: string | null
  icone: string | null
  lbl: string
  resto: string
  linhas: Array<{ tom: string; icone: string; campo: string; texto: string }>
  links: string[]
  fine: string[]
  botoes: number
  okLinhas: string[]
}

/** Lê uma faixa (do mockup ou do app) para um descritor comparável. `lado` diz como achar os nós. */
async function descrever(page: Page, lado: 'mockup' | 'app', fig?: string, okIndice?: number): Promise<Descritor> {
  return page.evaluate(({ lado, fig, okIndice }) => {
    const limpo = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
    const iconeApp = (svg: Element | null): string => {
      if (!svg) return ''
      if (svg.querySelector('[stroke-dasharray]')) return 'none'
      const d = svg.querySelector('path')?.getAttribute('d') ?? ''
      if (d.startsWith('M12 3L22')) return 'warn'
      if (d.startsWith('M8.2')) return 'err'
      if (svg.querySelector('circle[r="9"]')) return 'busy'
      return 'ok'
    }
    const iconeMock = (svg: Element | null): string => (svg?.querySelector('use')?.getAttribute('href') ?? '').replace('#i-', '')
    const icone = (svg: Element | null) => (lado === 'app' ? iconeApp(svg) : iconeMock(svg))

    let raiz: ParentNode | null
    if (lado === 'mockup') {
      const figura = [...document.querySelectorAll('figure')].find((f) => (f.querySelector('figcaption b')?.textContent ?? '').startsWith(fig!))
      const pagina = figura ? [...figura.querySelectorAll('.page')].find((p) => !p.classList.contains('p4b-only') && (p.querySelector('.band') || p.querySelector('.okline'))) : null
      raiz = pagina ?? null
    } else {
      raiz = document.querySelector('.faixa-rest')
    }
    if (!raiz) return { existe: false, papel: null, tom: null, icone: null, lbl: '', resto: '', linhas: [], links: [], fine: [], botoes: 0, okLinhas: [] }
    const q = (s: string) => raiz!.querySelector(s)
    const qa = (s: string) => [...raiz!.querySelectorAll(s)]
    const banda = lado === 'app' ? q('.fr-band') : q('.band')
    const okSel = lado === 'app' ? '.fr-okline' : '.okline'
    const todasOk = qa(okSel)
    const ok = okIndice === undefined ? todasOk : todasOk.slice(okIndice, okIndice + 1)
    const sel = lado === 'app'
      ? { lbl: '.fr-lbl', rest: '.fr-rest', row: '.fr-row', f: '.fr-f', d: '.fr-d', lnk: '.fr-lnk', fine: '.fr-fine' }
      : { lbl: '.lbl', rest: '.rest', row: '.row', f: '.f', d: '.d', lnk: '.lnk', fine: '.fine' }
    const tomDe = (el: Element | null) => (el ? [...el.classList].find((c) => ['busy', 'warn', 'err', 'ok', 'none'].includes(c)) ?? '' : '')
    return {
      existe: true,
      papel: banda?.getAttribute('role') ?? null,
      tom: banda ? tomDe(banda) : null,
      icone: banda ? icone(banda.querySelector(lado === 'app' ? '.fr-sum svg' : '.sum svg')) : null,
      lbl: limpo(banda?.querySelector(sel.lbl)?.textContent),
      resto: limpo(banda?.querySelector(sel.rest)?.textContent),
      linhas: [...(banda?.querySelectorAll(sel.row) ?? [])].map((li) => ({ tom: tomDe(li), icone: icone(li.querySelector('svg')), campo: limpo(li.querySelector(sel.f)?.textContent), texto: limpo(li.querySelector(sel.d)?.textContent) })),
      links: [...(banda?.querySelectorAll(sel.lnk) ?? [])].filter((a) => !a.closest('.p4b-only')).map((a) => limpo(a.textContent)),
      fine: [...(banda?.querySelectorAll(sel.fine) ?? [])].filter((a) => !a.closest('.p4b-only')).map((a) => limpo(a.textContent)),
      botoes: (banda?.querySelectorAll('button').length ?? 0) + (lado === 'app' ? qa('.faixa-rest button').length : 0),
      okLinhas: ok.map((o) => limpo(o.textContent)),
    }
  }, { lado, fig, okIndice })
}

const norm = (s: string, mapa: Record<string, string>): string => {
  let x = s
  for (const [de, para] of Object.entries(mapa)) x = x.split(de).join(para)
  return x.replace(HORA_RE, '<hora>')
}
const normDesc = (d: Descritor, mapa: Record<string, string>): Descritor => ({
  ...d, resto: norm(d.resto, mapa), lbl: norm(d.lbl, mapa),
  linhas: d.linhas.map((l) => ({ ...l, texto: norm(l.texto, mapa) })),
  fine: d.fine.map((f) => norm(f, mapa)), okLinhas: d.okLinhas.map((o) => norm(o, mapa)),
})

const ERRO_T = { status: 403, reason: 'forbidden', chamada: 'videos.update' }
const ERRO_M = { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' }

interface Estado { id: string; fig: string; ok?: number; rs: (e: { em2: string; busy: string }) => RsSemente; horas: (e: { em2: string; busy: string }) => Record<string, string> }
const ok = (destino: CampoRs['destino'], em: string): CampoRs => ({ estado: 'ok', destino, em })
const ESTADOS: Estado[] = [
  { id: 'A1', fig: 'A1.', rs: ({ busy }) => ({ title: { estado: 'em_andamento', destino: 'original', em: busy }, thumbnail: { estado: 'em_andamento', destino: 'original', em: busy } }), horas: ({ busy }) => ({ '12/10 05:00': horaSpManual(new Date(busy)) }) },
  { id: 'A2', fig: 'A2.', rs: ({ busy }) => ({ title: { estado: 'em_andamento', destino: 'B', em: busy }, thumbnail: ok('B', busy) }), horas: ({ busy }) => ({ '12/10 05:00': horaSpManual(new Date(busy)) }) },
  { id: 'A3', fig: 'A3.', rs: () => ({ title: { estado: 'em_andamento', destino: 'original', em: minAtras(6) } }), horas: () => ({}) },
  { id: 'B1', fig: 'B.', ok: 0, rs: ({ em2 }) => ({ title: ok('original', em2), thumbnail: ok('original', em2) }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'B2', fig: 'B.', ok: 1, rs: ({ em2 }) => ({ title: ok('B', em2), thumbnail: ok('B', em2) }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'C', fig: 'C.', rs: ({ em2 }) => ({ title: { estado: 'falhou', destino: 'original', em: em2, erro: ERRO_T, attempts: 1 }, thumbnail: ok('original', em2) }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'D', fig: 'D.', rs: ({ em2 }) => ({ title: { estado: 'falhou', destino: 'B', em: em2, erro: ERRO_T, forcado: true }, thumbnail: ok('B', em2) }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'D2', fig: 'D2.', rs: ({ em2 }) => ({ title: { estado: 'falhou', destino: 'B', em: em2, erro: ERRO_T, forcado: false }, thumbnail: ok('B', em2) }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'D3-thumb', fig: 'D2.', rs: ({ em2 }) => ({ title: ok('B', em2), thumbnail: { estado: 'falhou', destino: 'B', em: em2, erro: ERRO_M } }), horas: () => ({}) },
  { id: 'E', fig: 'E.', rs: ({ em2 }) => ({ title: ok('original', em2), thumbnail: { estado: 'pulado_drift', destino: 'original', em: em2, escreveu: false } }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'F', fig: 'F.', rs: ({ em2 }) => ({ title: ok('original', em2), thumbnail: { estado: 'pulado_drift', destino: 'original', em: em2, escreveu: false, motivo: 'sem_base_de_comparacao' } }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
  { id: 'G', fig: 'G.', rs: ({ em2 }) => ({ title: { estado: 'pulado_sem_original', destino: 'original', em: em2, escreveu: false }, thumbnail: ok('original', em2) }), horas: ({ em2 }) => ({ '12/10 05:02': horaSpManual(new Date(em2)) }) },
]
// D3-thumb não tem figura própria no mockup (a regra "mesma regra na thumbnail"); só afirma que sai "O YouTube recusou" e nada de nova tentativa.

for (const est of ESTADOS) {
  test(`E9 ${est.id}: faixa igual ao mockup (papel, cor, ícone, texto, link, aviso) e sem botão nem frase de nova tentativa`, async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const e = { em2: instanteSp(5, 2).toISOString(), busy: minAtras(1) }
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E9 ${est.id} ${info.project.name}`, status: 'completed', restoreStatus: est.rs(e) })
    await abrir(page, t.url)
    await expect(page.locator('.faixa-rest')).toBeVisible()
    const app = await descrever(page, 'app')
    await foto(page, nomeDaFoto('E9', est.id.toLowerCase(), info, tema))

    // sem placeholder estranho, sem botão, sem frase de nova tentativa (P4a)
    const corpo = await page.locator('.faixa-rest').innerText()
    expect(corpo).not.toMatch(/undefined|null|NaN|\[object/i)
    expect(corpo).not.toMatch(/nova tentativa|tentar agora|dispensar aviso/i)
    expect(await page.locator('.faixa-rest button').count(), 'nenhum botão na faixa (P4a)').toBe(0)

    if (est.id === 'D3-thumb') {
      expect(corpo).toMatch(/O YouTube recusou em \d\d\/\d\d \d\d:\d\d\. Corrija no YouTube Studio\./)
      expect(app.tom).toBe('err')
      esperarLimpo(coleta, `E9 ${est.id}`)
      return
    }

    const mock = await page.context().newPage()
    await mock.goto(MOCKUP)
    const ref = await descrever(mock, 'mockup', est.fig, est.ok)
    await mock.close()
    expect(ref.existe, `figura ${est.fig} achada no mockup`).toBe(true)
    const mapa = est.horas(e)
    const a = normDesc(app, {})
    const r = normDesc(ref, mapa)
    if (est.ok !== undefined) {
      expect(a.okLinhas).toEqual(r.okLinhas)
      expect(app.okLinhas[0]).toContain(horaSpManual(new Date(e.em2)))
    } else {
      expect(a.papel).toBe(r.papel)
      expect(a.tom).toBe(r.tom)
      expect(a.icone).toBe(r.icone)
      expect(a.lbl).toBe(r.lbl)
      expect(a.resto).toBe(r.resto)
      expect(a.linhas).toEqual(r.linhas)
      expect(a.links).toEqual(r.links)
      expect(a.fine).toEqual(r.fine)
      // as horas que o teste controla saem exatamente como o fuso de São Paulo manda
      if (est.id !== 'G' && est.id !== 'A3') for (const h of Object.values(mapa)) expect(app.linhas.map((l) => l.texto).join(' ')).toContain(h)
    }
    esperarLimpo(coleta, `E9 ${est.id}`)
  })
}

test('E10a: restore_status nulo (mundo antigo): nenhuma faixa e nenhuma frase inventada', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E10a ${info.project.name}`, status: 'completed', restoreStatus: null })
  await abrir(page, t.url)
  await expect(page.locator('.faixa-rest')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Restauração do vídeo' })).toHaveCount(0)
  const corpo = await page.locator('body').innerText()
  expect(corpo).not.toMatch(/voltaram ao original|voltou ao original|Voltando ao original|Erro:|Atenção:/)
  await foto(page, nomeDaFoto('E10', 'nulo', info, tema))
  esperarLimpo(coleta, 'E10a')
})

test('E10b: restore_status {} : sem faixa ou "tudo certo", nunca erro nem texto inventado', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E10b ${info.project.name}`, status: 'completed', restoreStatusCru: {} })
  await abrir(page, t.url)
  const faixa = page.locator('.faixa-rest')
  if (await faixa.count()) {
    await expect(faixa).not.toContainText(/Erro:|Atenção:|undefined|null|NaN/)
  }
  const corpo = await page.locator('body').innerText()
  expect(corpo).not.toMatch(/undefined|\bnull\b|NaN/)
  await foto(page, nomeDaFoto('E10', 'vazio', info, tema))
  esperarLimpo(coleta, 'E10b')
})

test('E11: a hora da faixa é a de São Paulo em qualquer fuso do navegador, inclusive perto da meia-noite', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  // 23:58 de São Paulo = 02:58 UTC do dia seguinte = 11:58 em Tóquio (dois dias diferentes).
  const quase = instanteSp(23, 58, 4)
  const virada = instanteSp(0, 1, 3)
  const { t, coleta } = await preparar(page, context, baseURL!, tema, {
    nome: `E11 ${info.project.name}`, status: 'completed',
    restoreStatus: { title: ok('original', quase.toISOString()), thumbnail: ok('B', virada.toISOString()) },
  })
  await abrir(page, t.url)
  const fuso = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(fuso).toBe(info.project.name.startsWith('tokyo') ? 'Asia/Tokyo' : 'America/Sao_Paulo')
  const texto = await page.locator('.faixa-rest').innerText()
  expect(texto).toContain(horaSpManual(quase))
  expect(texto).toContain(horaSpManual(virada))
  expect(texto).toContain('Horários de São Paulo')
  expect(horaSpManual(quase).slice(0, 5), 'as duas horas caem em dias diferentes de SP').not.toBe(horaSpManual(virada).slice(0, 5))
  await foto(page, nomeDaFoto('E11', 'meia-noite', info, tema))
  esperarLimpo(coleta, 'E11')
})
