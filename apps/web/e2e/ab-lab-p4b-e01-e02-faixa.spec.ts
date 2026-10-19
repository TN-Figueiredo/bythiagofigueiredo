// P4b-E1 (faixa com botões, em cada estado, com o texto que está no código depois da T10) e P4b-E2 (as ações: "Tentar agora",
// "Já corrigi no YouTube: dispensar aviso", duplo clique, hora prometida, "tentativa N de 3", aba velha).
// O YouTube é o falso da porta 3098: nenhuma escrita sai da máquina; o contador de escritas do falso prova "uma chamada só".
// As frases esperadas estão escritas aqui à mão, a partir do texto fechado pelo Logan (T10), não importadas do produto.
import { test, expect, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { limpar, horaSpManual, instanteSp, minAtras, lerTeste, estadoFalso, ctl, TITULOS, type RsSemente, type CampoRs } from './ab-lab-p4a-suporte/semente'
import { AUTH, SHOTS, abrir, esperarLimpo, nomeDaFoto, preparar, temaDoProjeto, type Tema } from './ab-lab-p4a-suporte/comum'
import { auditoriaDaDispensa, guardarVigia, msAteAViradaDoVigia, proximaVigiaSp, vigiaAusente, vigiaFresco } from './ab-lab-p4a-suporte/semente-p4b'

test.use({ storageState: AUTH.admin })
let reporVigia: () => Promise<void> = async () => undefined
test.beforeAll(async () => { await limpar(); reporVigia = await guardarVigia() })
test.afterAll(async () => { await reporVigia() })
test.beforeEach(async () => {
  // A previsão "por volta das HH:MM" muda na virada de 10:00/20:00 UTC; não semeia colado nela.
  const ate = msAteAViradaDoVigia()
  if (ate < 90_000) await new Promise((r) => setTimeout(r, ate + 2_000))
  await vigiaFresco()
})

const ERRO_T = { status: 403, reason: 'forbidden', chamada: 'videos.update' }
const ok = (destino: CampoRs['destino'], em: string): CampoRs => ({ estado: 'ok', destino, em })
const BTN_TENTAR = 'Tentar agora'
const BTN_DISPENSAR = 'Já corrigi no YouTube: dispensar aviso'
const STUDIO = 'Abrir no YouTube Studio'
const SEM_PERMISSAO = 'Só quem administra o site pode tentar de novo ou dispensar este aviso.'

interface Esperado {
  tom: 'err' | 'warn' | 'busy'
  papel: 'region' | 'status' | 'alert'
  lbl: string
  resumo: string
  linhas: Array<{ campo: 'Título' | 'Thumbnail'; texto: string | RegExp }>
  link: string | null
  tentar: boolean
  dispensar: boolean
}
interface Ctx { em2: string; hEm2: string; hD: string; emD: string; prox: string }
interface Estado {
  id: string
  /** Campos que o botão "Tentar agora" tenta (os pendentes) e o destino do título no YouTube depois. */
  pendentes: Array<'title' | 'thumbnail'>
  tituloDepois: string | null
  /** Campos que "Dispensar" remove. */
  dispensaveis: Array<'title' | 'thumbnail'>
  rs: (c: Ctx) => RsSemente
  esperado: (c: Ctx) => Esperado
}

const recusou = (h: string, prox: string, n: number) => `O YouTube recusou em ${h}. Nova tentativa automática por volta das ${prox} (horário de São Paulo), tentativa ${n} de 3.`

const ESTADOS: Estado[] = [
  {
    id: 'C', pendentes: ['title'], tituloDepois: TITULOS.A, dispensaveis: ['title'],
    rs: (c) => ({ title: { estado: 'falhou', destino: 'original', em: c.em2, erro: ERRO_T, attempts: 1 }, thumbnail: ok('original', c.em2) }),
    esperado: (c) => ({
      tom: 'err', papel: 'region', lbl: 'Erro:', resumo: 'o título não voltou ao original. O título no ar ainda é o da variante C.',
      linhas: [{ campo: 'Título', texto: recusou(c.hEm2, c.prox, 2) }, { campo: 'Thumbnail', texto: `Voltou ao original em ${c.hEm2}.` }],
      link: STUDIO, tentar: true, dispensar: true,
    }),
  },
  {
    id: 'D', pendentes: ['title'], tituloDepois: TITULOS.B, dispensaveis: ['title'],
    rs: (c) => ({ title: { estado: 'falhou', destino: 'B', em: c.emD, erro: ERRO_T, forcado: true }, thumbnail: ok('B', c.em2) }),
    esperado: (c) => ({
      tom: 'err', papel: 'region', lbl: 'Erro:', resumo: 'o título da variante B não foi aplicado. No ar continua o título editado por fora.',
      linhas: [
        { campo: 'Título', texto: `O YouTube recusou em ${c.hD}. Nova tentativa automática por volta das ${c.prox} (horário de São Paulo), sem perguntar de novo: ela repete a troca que você confirmou.` },
        { campo: 'Thumbnail', texto: `Variante B aplicada em ${c.hEm2}.` },
      ],
      link: STUDIO, tentar: true, dispensar: true,
    }),
  },
  {
    id: 'D2', pendentes: ['title'], tituloDepois: TITULOS.B, dispensaveis: ['title'],
    rs: (c) => ({ title: { estado: 'falhou', destino: 'B', em: c.em2, erro: ERRO_T, forcado: false }, thumbnail: ok('B', c.em2) }),
    esperado: (c) => ({
      tom: 'err', papel: 'region', lbl: 'Erro:', resumo: 'o título da variante B não foi aplicado. No ar continua o da variante C.',
      linhas: [{ campo: 'Título', texto: recusou(c.hEm2, c.prox, 2) }, { campo: 'Thumbnail', texto: `Variante B aplicada em ${c.hEm2}.` }],
      link: STUDIO, tentar: true, dispensar: true,
    }),
  },
  {
    id: 'E', pendentes: [], tituloDepois: null, dispensaveis: ['thumbnail'],
    rs: (c) => ({ title: ok('original', c.em2), thumbnail: { estado: 'pulado_drift', destino: 'original', em: c.em2, escreveu: false } }),
    esperado: (c) => ({
      tom: 'warn', papel: 'status', lbl: 'Atenção:', resumo: 'a thumbnail no ar não é de nenhuma variante deste teste: alguém editou por fora. Nada foi alterado.',
      linhas: [{ campo: 'Título', texto: `Voltou ao original em ${c.hEm2}.` }, { campo: 'Thumbnail', texto: `Mantida como está no YouTube desde ${c.hEm2}.` }],
      link: STUDIO, tentar: false, dispensar: true,
    }),
  },
  {
    id: 'F', pendentes: [], tituloDepois: null, dispensaveis: ['thumbnail'],
    rs: (c) => ({ title: ok('original', c.em2), thumbnail: { estado: 'pulado_drift', destino: 'original', em: c.em2, escreveu: false, motivo: 'sem_base_de_comparacao' } }),
    esperado: (c) => ({
      tom: 'warn', papel: 'status', lbl: 'Atenção:', resumo: 'não foi possível comparar a thumbnail no ar com as variantes. Nada foi alterado.',
      linhas: [{ campo: 'Título', texto: `Voltou ao original em ${c.hEm2}.` }, { campo: 'Thumbnail', texto: 'Não medida: sem imagem de referência para comparar.' }],
      link: STUDIO, tentar: false, dispensar: true,
    }),
  },
  {
    id: 'G', pendentes: [], tituloDepois: null, dispensaveis: ['title'],
    rs: (c) => ({ title: { estado: 'pulado_sem_original', destino: 'original', em: c.em2, escreveu: false }, thumbnail: ok('original', c.em2) }),
    esperado: (c) => ({
      tom: 'warn', papel: 'status', lbl: 'Atenção:', resumo: 'o título original não foi guardado quando o teste começou. Nada foi alterado.',
      linhas: [{ campo: 'Título', texto: /^Continua o da variante C, no ar desde \d\d\/\d\d \d\d:\d\d\.$/ }, { campo: 'Thumbnail', texto: `Voltou ao original em ${c.hEm2}.` }],
      link: 'Abrir no YouTube Studio para conferir', tentar: false, dispensar: true,
    }),
  },
  {
    id: 'H', pendentes: ['title'], tituloDepois: TITULOS.A, dispensaveis: ['title'],
    rs: (c) => ({ title: { estado: 'desistiu', destino: 'original', em: c.em2, motivo: 'tres_falhas', erro: ERRO_T, attempts: 3, escreveu: false }, thumbnail: ok('original', c.em2) }),
    esperado: (c) => ({
      tom: 'err', papel: 'region', lbl: 'Erro:', resumo: 'a restauração falhou 3 vezes e parou. O título no ar ainda é o da variante C.',
      linhas: [{ campo: 'Título', texto: `Última recusa do YouTube em ${c.hEm2}. Não haverá nova tentativa automática.` }, { campo: 'Thumbnail', texto: `Voltou ao original em ${c.hEm2}.` }],
      link: STUDIO, tentar: true, dispensar: true,
    }),
  },
]

const contexto = (): Ctx => {
  const em2 = instanteSp(5, 2).toISOString()
  const emD = minAtras(60)
  return { em2, hEm2: horaSpManual(new Date(em2)), emD, hD: horaSpManual(new Date(emD)), prox: proximaVigiaSp() }
}

interface Lido { existe: boolean; papel: string | null; tom: string | null; lbl: string; resumo: string; linhas: Array<{ campo: string; texto: string }>; link: string | null; linkHref: string | null; fine: string[]; botoes: Array<{ nome: string; desabilitado: boolean; busy: string | null }> }
async function ler(page: Page): Promise<Lido> {
  return page.evaluate(() => {
    const limpo = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
    const raiz = document.querySelector('.faixa-rest')
    const banda = raiz?.querySelector('.fr-band') ?? null
    return {
      existe: !!raiz,
      papel: banda?.getAttribute('role') ?? null,
      tom: banda ? ([...banda.classList].find((c) => ['busy', 'warn', 'err', 'none'].includes(c)) ?? null) : null,
      lbl: limpo(banda?.querySelector('.fr-lbl')?.textContent),
      resumo: limpo(banda?.querySelector('.fr-rest')?.textContent),
      linhas: [...(banda?.querySelectorAll('.fr-row') ?? [])].map((li) => ({ campo: limpo(li.querySelector('.fr-f')?.textContent), texto: limpo(li.querySelector('.fr-d')?.textContent) })),
      link: limpo(banda?.querySelector('.fr-lnk')?.textContent) || null,
      linkHref: banda?.querySelector('.fr-lnk')?.getAttribute('href') ?? null,
      fine: [...(banda?.querySelectorAll('.fr-fine') ?? [])].map((f) => limpo(f.textContent)),
      botoes: [...(raiz?.querySelectorAll('button') ?? [])].map((b) => ({ nome: limpo(b.textContent), desabilitado: (b as HTMLButtonElement).disabled, busy: b.getAttribute('aria-busy') })),
    }
  })
}

async function fotoFaixa(page: Page, estado: string, info: TestInfo, tema: Tema): Promise<string> {
  const dir = process.env.AB_P4B_SHOTS ?? path.join(SHOTS, '..', 'p4b-implementado-shots')
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, nomeDaFoto('P4b', estado, info, tema))
  await page.locator('.faixa-rest').scrollIntoViewIfNeeded()
  await page.locator('.faixa-rest').screenshot({ path: f, animations: 'disabled' })
  return f
}

async function semInvasaoHorizontal(page: Page, rotulo: string): Promise<void> {
  const r = await page.evaluate(() => {
    const f = document.querySelector('.faixa-rest')!.getBoundingClientRect()
    const bs = [...document.querySelectorAll('.faixa-rest button')].map((b) => b.getBoundingClientRect())
    return { pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth, faixaDireita: f.right, vw: window.innerWidth, botoes: bs.map((b) => ({ dir: b.right, esq: b.left, alt: b.height })) }
  })
  expect(r.pagina, `${rotulo}: sem rolagem horizontal da página`).toBeLessThanOrEqual(0)
  expect(r.faixaDireita, `${rotulo}: faixa dentro da tela`).toBeLessThanOrEqual(r.vw + 0.5)
  for (const b of r.botoes) { expect(b.dir, `${rotulo}: botão dentro da tela`).toBeLessThanOrEqual(r.vw + 0.5); expect(b.esq).toBeGreaterThanOrEqual(0) }
}

function conferir(l: Lido, e: Esperado, rotulo: string, youtubeId: string): void {
  expect(l.existe, `${rotulo}: faixa presente`).toBe(true)
  expect(l.papel, `${rotulo}: papel`).toBe(e.papel)
  expect(l.tom, `${rotulo}: tom`).toBe(e.tom)
  expect(l.lbl, `${rotulo}: rótulo`).toBe(e.lbl)
  expect(l.resumo, `${rotulo}: resumo`).toBe(e.resumo)
  expect(l.linhas.map((x) => x.campo), `${rotulo}: campos`).toEqual(e.linhas.map((x) => x.campo))
  l.linhas.forEach((x, i) => {
    const t = e.linhas[i]!.texto
    if (typeof t === 'string') expect(x.texto, `${rotulo}: linha ${x.campo}`).toBe(t)
    else expect(x.texto, `${rotulo}: linha ${x.campo}`).toMatch(t)
  })
  expect(l.link, `${rotulo}: link`).toBe(e.link)
  if (e.link) expect(l.linkHref).toBe(`https://studio.youtube.com/video/${youtubeId}/edit`)
  expect(l.botoes.some((b) => b.nome === BTN_TENTAR), `${rotulo}: botão Tentar agora`).toBe(e.tentar)
  expect(l.botoes.some((b) => b.nome === BTN_DISPENSAR), `${rotulo}: botão dispensar`).toBe(e.dispensar)
  expect(l.botoes.length, `${rotulo}: nenhum outro botão`).toBe(Number(e.tentar) + Number(e.dispensar))
  expect(l.fine, `${rotulo}: sem aviso extra`).toEqual([])
  const corpo = [l.lbl, l.resumo, ...l.linhas.map((x) => x.texto)].join(' ')
  expect(corpo).not.toMatch(/undefined|null|NaN|\[object/i)
}

// ───────────── P4b-E1: o texto e os botões de cada estado ─────────────
for (const est of ESTADOS) {
  test(`E1 ${est.id}: faixa com o texto fechado, o link e os botões certos`, async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const c = contexto()
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E1 ${est.id} ${info.project.name}`, status: 'completed', restoreStatus: est.rs(c) })
    await abrir(page, t.url)
    await expect(page.locator('.faixa-rest')).toBeVisible()
    conferir(await ler(page), est.esperado(c), `E1 ${est.id}`, t.youtubeId)
    await semInvasaoHorizontal(page, `E1 ${est.id}`)
    await fotoFaixa(page, est.id.toLowerCase(), info, tema)
    esperarLimpo(coleta, `E1 ${est.id}`)
  })
}

test.describe('E1 I: quem edita sem administrar o site', () => {
  test.use({ storageState: AUTH.editor })
  test('I: destino variante, sem botão e com a frase de permissão', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const c = contexto()
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E1 I ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS.find((e) => e.id === 'D2')!.rs(c) })
    await abrir(page, t.url)
    await expect(page.locator('.faixa-rest')).toBeVisible()
    const l = await ler(page)
    expect(l.botoes, 'nenhum botão para quem não administra').toEqual([])
    expect(l.fine).toEqual([SEM_PERMISSAO])
    expect(l.linhas[0]!.texto).toBe(recusou(c.hEm2, c.prox, 2))
    expect(l.link).toBe(STUDIO)
    await semInvasaoHorizontal(page, 'E1 I')
    await fotoFaixa(page, 'i', info, tema)
    const antes = await lerTeste(t.testId)
    esperarLimpo(coleta, 'E1 I')
    expect((await lerTeste(t.testId)).restore_seq, 'ver não escreve').toBe(antes.restore_seq)
  })

  test('I (original): editor sem administrar PODE tentar e dispensar quando o destino é o original', async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const c = contexto()
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E1 I-orig ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS.find((e) => e.id === 'C')!.rs(c) })
    await abrir(page, t.url)
    const l = await ler(page)
    expect(l.botoes.map((b) => b.nome).sort()).toEqual([BTN_DISPENSAR, BTN_TENTAR].sort())
    expect(l.fine).toEqual([])
    esperarLimpo(coleta, 'E1 I-orig')
  })
})

// ───────────── P4b-E1: a faixa "tentando" ─────────────
test('E1 tentando: ao clicar, a faixa vira "em andamento", os botões ficam desabilitados e ao fim tudo volta ao original', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const c = contexto()
  const { t, coleta, postsDeAcao } = await preparar(page, context, baseURL!, tema, { nome: `E1 tentando ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS[0]!.rs(c) })
  await ctl({ op: 'atrasar', chamada: 'videos.update', ms: 4000 })
  await abrir(page, t.url)
  await page.getByRole('button', { name: BTN_TENTAR }).click()
  const banda = page.locator('.fr-band.busy')
  await expect(banda).toBeVisible({ timeout: 10_000 })
  const l = await ler(page)
  expect(l.tom).toBe('busy')
  expect(l.lbl).toBe('Voltando ao original…')
  expect(l.resumo).toBe('Título e thumbnail estão sendo trocados no YouTube.')
  expect(l.linhas[0]!.campo).toBe('Título')
  expect(l.linhas[0]!.texto).toMatch(/^Trocando desde \d\d\/\d\d \d\d:\d\d\.$/)
  expect(l.botoes.length).toBe(2)
  for (const b of l.botoes) { expect(b.desabilitado, `${b.nome} desabilitado enquanto corre`).toBe(true); expect(b.busy).toBe('true') }
  // Medida (sem afirmar): a aparência dos botões enquanto desabilitados, para a Naksu.
  const estilo = await page.evaluate(() => [...document.querySelectorAll('.faixa-rest button')].map((b) => { const s = getComputedStyle(b); return { nome: b.textContent, opacidade: s.opacity, cursor: s.cursor, cor: s.color, fundo: s.backgroundColor } }))
  info.annotations.push({ type: 'estilo-desabilitado', description: JSON.stringify(estilo) })
  await semInvasaoHorizontal(page, 'E1 tentando')
  await fotoFaixa(page, 'tentando', info, tema)
  // termina: faixa de sucesso, sem botões
  await expect(page.locator('.fr-okline')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.faixa-rest button')).toHaveCount(0)
  const fim = await lerTeste(t.testId)
  expect(fim.restore_status?.title?.estado).toBe('ok')
  const yt = await estadoFalso()
  expect(yt.titulo).toBe(TITULOS.A)
  expect(yt.gravacoes.filter((g) => g.chamada === 'videos.update').length, 'uma escrita só no YouTube falso').toBe(1)
  expect(postsDeAcao(), 'uma chamada de ação só').toBe(1)
  esperarLimpo(coleta, 'E1 tentando')
})

// ───────────── P4b-E2: "Tentar agora" ─────────────
for (const est of ESTADOS.filter((e) => e.pendentes.length > 0)) {
  test(`E2 tentar ${est.id}: uma escrita no YouTube falso, campo vai a ok e a faixa vira sucesso`, async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const c = contexto()
    const { t, coleta, postsDeAcao } = await preparar(page, context, baseURL!, tema, { nome: `E2 tentar ${est.id} ${info.project.name}`, status: 'completed', restoreStatus: est.rs(c) })
    await abrir(page, t.url)
    const antes = await lerTeste(t.testId)
    await page.getByRole('button', { name: BTN_TENTAR }).click()
    await expect(page.locator('.fr-okline')).toBeVisible({ timeout: 30_000 })
    const depois = await lerTeste(t.testId)
    for (const k of est.pendentes) expect(depois.restore_status?.[k]?.estado, `${est.id}: ${k} ok`).toBe('ok')
    expect(depois.restore_seq, 'restore_seq andou').toBeGreaterThan(antes.restore_seq)
    const yt = await estadoFalso()
    expect(yt.titulo, `${est.id}: título no YouTube falso`).toBe(est.tituloDepois)
    expect(yt.gravacoes.length, `${est.id}: gravações no falso`).toBe(1)
    expect(postsDeAcao()).toBe(1)
    await expect(page.locator('.faixa-rest button')).toHaveCount(0)
    esperarLimpo(coleta, `E2 tentar ${est.id}`)
  })
}

// ───────────── P4b-E2: dispensar ─────────────
for (const est of ESTADOS) {
  test(`E2 dispensar ${est.id}: o campo sai do retrato, o rastro é gravado e o YouTube não é tocado`, async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const c = contexto()
    const { t, coleta, postsDeAcao } = await preparar(page, context, baseURL!, tema, { nome: `E2 dispensar ${est.id} ${info.project.name}`, status: 'completed', restoreStatus: est.rs(c) })
    await abrir(page, t.url)
    const antes = await lerTeste(t.testId)
    await page.getByRole('button', { name: BTN_DISPENSAR }).click()
    await expect(page.getByRole('button', { name: BTN_DISPENSAR })).toHaveCount(0, { timeout: 15_000 })
    const depois = await lerTeste(t.testId)
    for (const k of est.dispensaveis) expect(depois.restore_status?.[k], `${est.id}: ${k} removido`).toBeUndefined()
    expect(depois.restore_seq).toBe(antes.restore_seq + 1)
    const aud = await auditoriaDaDispensa(t.testId)
    expect(aud, `${est.id}: uma linha de auditoria`).toHaveLength(1)
    expect(aud[0]!.after_data.campos).toEqual(est.dispensaveis)
    expect(aud[0]!.after_data.restore_seq).toBe(antes.restore_seq)
    expect(aud[0]!.actor_user_id, 'a linha leva quem dispensou').not.toBeNull()
    const yt = await estadoFalso()
    expect(yt.gravacoes, `${est.id}: dispensar não escreve no YouTube`).toEqual([])
    expect(postsDeAcao()).toBe(1)
    // a tela: ou some a faixa, ou sobra só a linha de sucesso do outro campo; nunca o aviso antigo
    await expect(page.locator('.fr-band')).toHaveCount(0)
    esperarLimpo(coleta, `E2 dispensar ${est.id}`)
  })
}

// ───────────── P4b-E2: duplo clique ─────────────
test('E2 duplo clique em "Tentar agora": uma chamada de ação, uma escrita no YouTube', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const c = contexto()
  const { t, coleta, postsDeAcao } = await preparar(page, context, baseURL!, tema, { nome: `E2 duplo-tentar ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS[0]!.rs(c) })
  await ctl({ op: 'atrasar', chamada: 'videos.update', ms: 2500 })
  await abrir(page, t.url)
  await page.getByRole('button', { name: BTN_TENTAR }).dblclick()
  await expect(page.locator('.fr-okline')).toBeVisible({ timeout: 30_000 })
  expect(postsDeAcao(), 'chamadas de ação').toBe(1)
  expect((await estadoFalso()).gravacoes.filter((g) => g.chamada === 'videos.update').length, 'escritas no falso').toBe(1)
  esperarLimpo(coleta, 'E2 duplo-tentar')
})

test('E2 duplo clique em "dispensar": uma chamada, uma linha de auditoria, restore_seq +1', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const c = contexto()
  const { t, coleta, postsDeAcao } = await preparar(page, context, baseURL!, tema, { nome: `E2 duplo-dispensar ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS[3]!.rs(c) })
  await abrir(page, t.url)
  const antes = await lerTeste(t.testId)
  await page.getByRole('button', { name: BTN_DISPENSAR }).dblclick()
  await expect(page.getByRole('button', { name: BTN_DISPENSAR })).toHaveCount(0, { timeout: 15_000 })
  expect(postsDeAcao()).toBe(1)
  expect((await auditoriaDaDispensa(t.testId)).length).toBe(1)
  expect((await lerTeste(t.testId)).restore_seq).toBe(antes.restore_seq + 1)
  esperarLimpo(coleta, 'E2 duplo-dispensar')
})

// ───────────── P4b-E2: hora prometida e tentativa N de 3 ─────────────
test('E2 hora: com o vigia em dia a faixa promete a próxima verificação (07:00 ou 17:00 de SP); sem vigia, "na próxima verificação"', async ({ page, context, baseURL }, info) => {
  // O relógio do navegador NÃO decide esta frase (ela sai do servidor); a conta é conferida contra a hora real da máquina.
  // Os três instantes do plano (08:00, 12:00 e 23:00 UTC) ficam para o teste unitário da função pura.
  const tema = temaDoProjeto(info)
  const c = contexto()
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E2 hora ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS[0]!.rs(c) },
    // ACHADO (menor, Yannis): sem linha do vigia, getCronHealth(.single()) registra "[cron-health] Failed to get health ... PGRST116" como erro a cada visita.
    { naoEsperadas: [/cron-health\] Failed to get health for ab-watchdog/] })
  await vigiaFresco()
  await abrir(page, t.url)
  const l1 = await ler(page)
  expect(['07:00', '17:00']).toContain(c.prox)
  expect(l1.linhas[0]!.texto).toContain(`por volta das ${c.prox} (horário de São Paulo)`)
  expect(l1.linhas[0]!.texto).not.toContain('na próxima verificação')
  await vigiaAusente()
  await page.reload()
  await page.waitForLoadState('networkidle')
  const l2 = await ler(page)
  expect(l2.linhas[0]!.texto).toBe(`O YouTube recusou em ${c.hEm2}. Nova tentativa automática na próxima verificação, tentativa 2 de 3.`)
  esperarLimpo(coleta, 'E2 hora')
})

for (const [attempts, n] of [[1, 2], [2, 3]] as const) {
  test(`E2 tentativa: attempts ${attempts} mostra "tentativa ${n} de 3"`, async ({ page, context, baseURL }, info) => {
    const tema = temaDoProjeto(info)
    const c = contexto()
    const rs: RsSemente = { title: { estado: 'falhou', destino: 'original', em: c.em2, erro: ERRO_T, attempts }, thumbnail: ok('original', c.em2) }
    const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `E2 tentativa-${attempts} ${info.project.name}`, status: 'completed', restoreStatus: rs })
    await abrir(page, t.url)
    expect((await ler(page)).linhas[0]!.texto).toBe(recusou(c.hEm2, c.prox, n))
    esperarLimpo(coleta, `E2 tentativa ${attempts}`)
  })
}

// ───────────── Caminho infeliz: aba velha e YouTube recusando ─────────────
test('infeliz: aba velha clica "Tentar agora" depois de a outra aba dispensar → aviso de "mudou" e nada escrito no YouTube', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const c = contexto()
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `infeliz aba-velha ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS[0]!.rs(c) })
  await abrir(page, t.url)
  const outra = await context.newPage()
  await abrir(outra, t.url)
  await outra.getByRole('button', { name: BTN_DISPENSAR }).click()
  await expect(outra.getByRole('button', { name: BTN_DISPENSAR })).toHaveCount(0, { timeout: 15_000 })
  await page.getByRole('button', { name: BTN_TENTAR }).click()
  await expect(page.getByRole('status').getByText('O teste mudou em outra aba. Reabra para decidir.')).toBeVisible({ timeout: 15_000 })
  expect((await estadoFalso()).gravacoes, 'nada escrito').toEqual([])
  await expect(page.locator('.faixa-rest button')).toHaveCount(0) // o refresh trouxe o estado novo
  esperarLimpo(coleta, 'infeliz aba-velha')
})

test('infeliz: YouTube recusa de novo no "Tentar agora" → faixa continua em erro, botões voltam, nada fica preso em "em andamento"', async ({ page, context, baseURL }, info) => {
  const tema = temaDoProjeto(info)
  const c = contexto()
  const { t, coleta } = await preparar(page, context, baseURL!, tema, { nome: `infeliz recusa ${info.project.name}`, status: 'completed', restoreStatus: ESTADOS[0]!.rs(c) }, { naoEsperadas: [/403|forbidden|Failed to load resource/i] })
  await ctl({ op: 'recusar', chamada: 'videos.update', status: 403, reason: 'forbidden' })
  await abrir(page, t.url)
  await page.getByRole('button', { name: BTN_TENTAR }).click()
  await expect(page.getByRole('button', { name: BTN_TENTAR })).toBeEnabled({ timeout: 30_000 })
  await expect(page.locator('.fr-band.busy')).toHaveCount(0)
  const l = await ler(page)
  expect(l.tom).toBe('err')
  expect(l.linhas[0]!.texto).toMatch(/^O YouTube recusou em \d\d\/\d\d \d\d:\d\d\. Nova tentativa automática /)
  const fim = await lerTeste(t.testId)
  expect(fim.restore_status?.title?.estado).toBe('falhou')
  esperarLimpo(coleta, 'infeliz recusa')
})
