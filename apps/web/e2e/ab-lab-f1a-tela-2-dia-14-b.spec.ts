// Gio, F1a-tela-2 (T9, envio B): os estados do bloco do dia 14 respondido e do conflito, chegando pela interação ("Ver teste", "Ver as duas", `?video=`),
// com o texto exato de `FRASES` (nativo/frases.ts) calculado a partir do que está no banco. Um projeto (l1440-dark) basta para o texto; as medidas por
// largura e tema estão em `ab-lab-f1a-tela-2-medidas-b.spec.ts`.
import { expect, test, type Locator } from '@playwright/test'
import { FRASES } from '../src/lib/youtube/teste-youtube/nativo/frases'
import { AUTH_F1A, abrirLista, fotoB, lerBanco, lerFoco, linha, prepararB, registrarB, semAnimacao, soNoProjeto } from './ab-lab-f1a-tela-2-suporte/comum-b'
import { NO_AR_DESCONHECIDO, TB, VIDEOS_B } from './ab-lab-f1a-tela-2-suporte/semente-b'

test.use({ storageState: AUTH_F1A })
const D = FRASES.dia14
const DIA = 86_400_000

interface Banco { respondido_em: string | null; resposta_mudada_em: string | null; desfecho_em: string | null; confirmado_em: string | null }
interface Caso {
  nome: string
  chave: string
  estado: 'ficou_no_ar' | 'respondido_sem_vencedor' | 'respostas_diferentes'
  /** O que a linha FECHADA mostra. */
  linha: (b: Banco) => { selo: string; fr: string; apoio?: string }
  /** O que o bloco ABERTO mostra. */
  bloco: (b: Banco) => { selo?: string; q3?: string | null; meta: string; extras?: string[] }
}
const quando = (b: Banco): Date => new Date(b.respondido_em!)
const prazoDe = (b: Banco): Date => new Date(new Date(b.confirmado_em!).getTime() + 14 * DIA)


const CASOS: Caso[] = [
  { nome: 'ficou_no_ar B (nova) hoje', chave: 'b_nova', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloNoAr('B'), fr: D.fraseNoAr('B'), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloNoAr('B'), q3: D.fraseNoAr('B'), meta: FRASES.respondido.meta(quando(b), true) }) },
  { nome: 'ficou_no_ar A (original)', chave: 'b_orig', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloOriginal, fr: D.fraseOriginal(2), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloOriginal, q3: D.fraseOriginal(2), meta: FRASES.respondido.meta(quando(b), false) }) },
  { nome: 'ficou_no_ar C (3 versões)', chave: 'b_tres', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloNoAr('C'), fr: D.fraseNoAr('C'), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloNoAr('C'), q3: D.fraseNoAr('C'), meta: FRASES.respondido.meta(quando(b), false) }) },
  { nome: 'ficou_no_ar tardia (depois do prazo)', chave: 'b_tardia', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloNoAr('B'), fr: D.fraseNoAr('B'), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloNoAr('B'), q3: D.fraseNoAr('B'), meta: FRASES.respondido.metaTardia(quando(b), prazoDe(b)) }) },
  { nome: 'ficou_no_ar mudada (Resposta mudada em …)', chave: 'b_mudada', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloOriginal, fr: D.fraseOriginal(2), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloOriginal, q3: D.fraseOriginal(2), meta: FRASES.respondido.meta(quando(b), false), extras: [FRASES.respondido.mudadaEm(new Date(b.resposta_mudada_em!))] }) },
  { nome: 'derivada sem original: Ficou no ar: <título>', chave: 'b_der', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloNoArTitulo(VIDEOS_B.b_der!.novo), fr: D.fraseNoAr('B'), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloNoArTitulo(VIDEOS_B.b_der!.novo), q3: D.fraseNoAr('B'), meta: FRASES.respondido.meta(quando(b), false) }) },
  { nome: 'derivada com original: A (original)', chave: 'b_der_orig', estado: 'ficou_no_ar',
    linha: () => ({ selo: D.seloOriginal, fr: D.fraseOriginal(2), apoio: D.oficial }),
    bloco: (b) => ({ selo: D.seloOriginal, q3: D.fraseOriginal(2), meta: FRASES.respondido.meta(quando(b), false) }) },
  { nome: 'derivada sem par: selo com o título lido, sem frase inventada', chave: 'b_der_sempar', estado: 'ficou_no_ar',
    linha: (b) => ({ selo: D.seloNoArTitulo(NO_AR_DESCONHECIDO), fr: FRASES.respondido.respondeuEm(quando(b)) }),
    bloco: (b) => ({ selo: D.seloNoArTitulo(NO_AR_DESCONHECIDO), q3: null, meta: FRASES.respondido.meta(quando(b), false) }) },
  { nome: 'sem vencedor: ficou igual', chave: 'b_igual', estado: 'respondido_sem_vencedor',
    linha: () => ({ selo: D.seloSemVencedor.ficou_igual, fr: FRASES.resposta.ficouIgual, apoio: FRASES.resposta.apoioSemVencedor }),
    bloco: (b) => ({ selo: D.seloSemVencedor.ficou_igual, q3: FRASES.resposta.ficouIgual, meta: FRASES.respondido.metaSemVencedor(quando(b), false), extras: [FRASES.resposta.apoioSemVencedor] }) },
  { nome: 'sem vencedor: inconclusivo', chave: 'b_incon', estado: 'respondido_sem_vencedor',
    linha: () => ({ selo: D.seloSemVencedor.inconclusivo, fr: FRASES.resposta.inconclusivo, apoio: FRASES.resposta.apoioSemVencedor }),
    bloco: (b) => ({ selo: D.seloSemVencedor.inconclusivo, q3: FRASES.resposta.inconclusivo, meta: FRASES.respondido.metaSemVencedor(quando(b), false), extras: [FRASES.resposta.apoioSemVencedor] }) },
  { nome: 'sem vencedor: não vi', chave: 'b_navi', estado: 'respondido_sem_vencedor',
    linha: () => ({ selo: D.seloSemVencedor.nao_vi, fr: FRASES.resposta.naoVi, apoio: FRASES.resposta.apoioSemVencedor }),
    bloco: (b) => ({ selo: D.seloSemVencedor.nao_vi, q3: FRASES.resposta.naoVi, meta: FRASES.respondido.metaSemVencedor(quando(b), false), extras: [FRASES.resposta.apoioSemVencedor] }) },
  { nome: 'sem vencedor com veredito do Lab (apoio com a letra no ar)', chave: 'b_veredito', estado: 'respondido_sem_vencedor',
    linha: (b) => ({ selo: D.seloSemVencedor.ficou_igual, fr: FRASES.resposta.ficouIgual, apoio: FRASES.respondido.apoioComVeredito('B', new Date(b.desfecho_em!)) }),
    bloco: (b) => ({ selo: D.seloSemVencedor.ficou_igual, q3: FRASES.resposta.ficouIgual, meta: FRASES.respondido.metaSemVencedor(quando(b), false), extras: [FRASES.respondido.apoioComVeredito('B', new Date(b.desfecho_em!))] }) },
]

const normalizar = (s: string): string => s.replace(/\s+/g, ' ').trim()

async function textoDe(l: Locator): Promise<string> { return normalizar((await l.textContent()) ?? '') }

for (const caso of CASOS) {
  test(`${caso.nome}: linha fechada, "Ver teste" abre o bloco com o texto exato e o foco no título, "Ver teste" fecha`, async ({ page, context }, info) => {
    test.skip(!soNoProjeto(info), 'texto exato: um projeto basta')
    const a = await prepararB(page, context, info, [caso.chave])
    const banco = await lerBanco(a.m.v[caso.chave]!.id)
    await abrirLista(page); await semAnimacao(page)
    const li = linha(page, a.m, caso.chave)
    await expect(li).toHaveAttribute('data-estado', caso.estado)
    const esp = caso.linha(banco)
    // linha fechada: selo, frase, apoio e o botão (um toque abre; não há bloco)
    await expect(li.locator('.st')).toContainText(esp.selo)
    expect(await textoDe(li.locator('p.fr')), 'frase da linha').toBe(normalizar(esp.fr))
    if (esp.apoio) expect(await textoDe(li.locator('.cn-meta').last()), 'apoio da linha').toBe(normalizar(esp.apoio))
    await expect(li.locator('section.cn-d14')).toHaveCount(0)
    const abrir = li.getByRole('button', { name: caso.estado === 'respostas_diferentes' ? FRASES.conflito.verAsDuas : FRASES.conflito.verTeste, exact: true })
    await expect(abrir).toHaveAttribute('aria-expanded', 'false')
    // abre
    const posts = a.posts.length
    await abrir.click()
    const bloco = li.locator('section.cn-d14')
    await expect(bloco).toBeVisible()
    await expect(abrir).toHaveAttribute('aria-expanded', 'true')
    const be = caso.bloco(banco)
    const textoBloco = await textoDe(bloco)
    if (be.selo) {
      await expect(bloco.locator('.cn-d14-res')).toContainText(be.selo)
      // regra do sujeito: o selo aparece UMA vez na linha (a linha entrega o selo ao bloco)
      expect(await li.getByText(be.selo, { exact: true }).count(), `o selo "${be.selo}" aparece uma vez`).toBe(1)
    }
    if (be.q3) expect(await textoDe(bloco.locator('.cn-d14-q3')), 'frase do bloco').toBe(normalizar(be.q3))
    else expect(await bloco.locator('.cn-d14-q3').count(), 'sem frase inventada').toBe(0)
    expect(textoBloco, 'meta do bloco').toContain(normalizar(be.meta))
    for (const x of be.extras ?? []) expect(textoBloco, `extra "${x}"`).toContain(normalizar(x))
    await expect(bloco.getByRole('button', { name: FRASES.respondido.mudar, exact: true })).toBeVisible()
    expect(await bloco.locator('.pri:visible').count(), 'nenhum primário no bloco').toBe(0)
    expect(await bloco.getByText(/variante|ficha/i).count(), 'nunca "variante" nem "ficha"').toBe(0)
    expect(a.posts.length - posts, 'abrir o bloco não chama action').toBe(0)
    // foco no título do bloco
    const alvo = await page.evaluate(() => { const e = document.activeElement as HTMLElement; return { foco: e.hasAttribute('data-foco-bloco'), tag: e.tagName, texto: e.innerText.slice(0, 70) } })
    expect(alvo.foco, `o foco está no alvo do bloco (${JSON.stringify(alvo)})`).toBe(true)
    await fotoB(page, info, `b-${caso.chave}`, li)
    registrarB(info, `texto:${caso.chave}`, { linha: esp, bloco: be, foco: alvo, textoBloco })
    // fecha
    await abrir.click()
    await expect(li.locator('section.cn-d14')).toHaveCount(0)
    await expect(li.locator('.st')).toContainText(esp.selo)
    expect.soft(a.coleta.erros).toEqual([])
  })
}

// ── Conflito ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Conflito { nome: string; chave: string; noAr: string | null; disse: string; tituloNoAr: string; tituloDisse: string }
const CONFLITOS: Conflito[] = [
  { nome: 'regra: No ar estava A; você disse B', chave: 'c_regra', noAr: 'A', disse: 'B', tituloNoAr: VIDEOS_B.c_regra!.titulo, tituloDisse: VIDEOS_B.c_regra!.novo },
  { nome: 'data_api, 3 versões: No ar estava B; você disse C', chave: 'c_data', noAr: 'B', disse: 'C', tituloNoAr: VIDEOS_B.c_data!.novo, tituloDisse: 'c_data: a terceira versão' },
  { nome: 'derivada: No ar estava A; você disse B', chave: 'c_der', noAr: 'A', disse: 'B', tituloNoAr: VIDEOS_B.c_der!.titulo, tituloDisse: VIDEOS_B.c_der!.novo },
  { nome: 'título no ar sem par: "Título sem versão correspondente"', chave: 'c_sempar', noAr: null, disse: 'B', tituloNoAr: NO_AR_DESCONHECIDO, tituloDisse: VIDEOS_B.c_sempar!.novo },
  { nome: 'títulos hostis de 90 letras', chave: 'c_hostil', noAr: 'A', disse: 'B', tituloNoAr: TB.q90, tituloDisse: TB.r90 },
]
for (const c of CONFLITOS) {
  test(`conflito ${c.nome}: linha, "Ver as duas", cartões lado a lado, um só selo "Respostas diferentes", h3 só para leitor de tela e com o foco`, async ({ page, context }, info) => {
    test.skip(!soNoProjeto(info), 'texto exato: um projeto basta')
    const a = await prepararB(page, context, info, [c.chave])
    const banco = await lerBanco(a.m.v[c.chave]!.id)
    await abrirLista(page); await semAnimacao(page)
    const li = linha(page, a.m, c.chave)
    await expect(li).toHaveAttribute('data-estado', 'respostas_diferentes')
    await expect(li.locator('.st')).toContainText(FRASES.conflito.selo)
    expect(await textoDe(li.locator('p.fr')), 'frase da linha').toBe(normalizar(c.noAr ? FRASES.conflito.linha(c.noAr, c.disse) : FRASES.conflito.linhaSemPar(c.disse)))
    const abrir = li.getByRole('button', { name: FRASES.conflito.verAsDuas, exact: true })
    await abrir.click()
    const bloco = li.locator('section.cn-d14-conflito')
    await expect(bloco).toBeVisible()
    // um só selo: o da linha; o do bloco não existe e a frase da linha fica (brief + ruling I3)
    expect(await li.getByText(FRASES.conflito.selo, { exact: true }).count(), 'um só selo "Respostas diferentes" com o bloco aberto').toBe(1)
    expect(await bloco.locator('.cn-d14-res').count(), 'o bloco não desenha o próprio selo').toBe(0)
    // h3: só para leitor de tela (cn-sr), com o texto da frase e o foco
    const h3 = bloco.locator('h3')
    await expect(h3).toHaveClass(/cn-sr/)
    await expect(h3).toHaveText(c.noAr ? FRASES.conflito.titulo(c.noAr, c.disse) : FRASES.conflito.tituloSemPar(c.disse))
    const foco = await page.evaluate(() => { const e = document.activeElement as HTMLElement; return { tag: e.tagName, foco: e.hasAttribute('data-foco-bloco'), texto: e.textContent } })
    expect(foco, 'foco no h3 cn-sr do conflito').toMatchObject({ tag: 'H3', foco: true })
    expect(await textoDe(bloco.locator('p.cn-meta').first())).toBe(normalizar(FRASES.conflito.meta))
    // cartões
    const quemDisse = new Date(banco.resposta_mudada_em ?? banco.respondido_em!)
    const cartoes = bloco.locator('.cn-d14-cf > div')
    await expect(cartoes).toHaveCount(2)
    expect(await textoDe(cartoes.nth(0).locator('.cn-d14-who'))).toBe(normalizar(FRASES.conflito.cartaoNoAr(banco.desfecho_em ? new Date(banco.desfecho_em) : null)))
    expect(await textoDe(cartoes.nth(1).locator('.cn-d14-who'))).toBe(normalizar(FRASES.conflito.cartaoVoce(c.disse, quemDisse)))
    await expect(cartoes.nth(0).locator('q')).toHaveText(c.tituloNoAr)
    await expect(cartoes.nth(1).locator('q')).toHaveText(c.tituloDisse)
    await expect(cartoes.nth(0).locator('q')).toHaveAttribute('title', c.tituloNoAr)
    if (c.noAr) expect(await textoDe(cartoes.nth(0).locator('.cn-d14-top').first())).toContain(c.noAr)
    else await expect(cartoes.nth(0).getByRole('img', { name: FRASES.conflito.seloSemPar })).toHaveCount(1)
    expect(await textoDe(cartoes.nth(1).locator('.cn-d14-top').first())).toContain(c.disse)
    // sem destaque: os dois cartões têm a mesma borda e nenhum botão primário
    const bordas = await cartoes.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}` }))
    expect(new Set(bordas).size, `os dois cartões sem destaque (${bordas.join(' | ')})`).toBe(1)
    expect(await bloco.locator('.pri:visible').count()).toBe(0)
    await expect(bloco.getByRole('button', { name: FRASES.respondido.mudar, exact: true })).toBeVisible()
    await fotoB(page, info, `b-${c.chave}`, li)
    registrarB(info, `conflito:${c.chave}`, { bordas, foco })
    expect.soft(a.coleta.erros).toEqual([])
  })
}

// ── `?video=` de cada estado respondido: abre o bloco certo, foco no título, vizinhas fechadas ─────────────────────────────────────────────────
test('`?video=` de cada estado respondido abre só o bloco certo (foco no título; as vizinhas ficam fechadas)', async ({ page, context }, info) => {
  test.skip(!soNoProjeto(info))
  test.setTimeout(240_000)
  const chaves = ['b_nova', 'b_orig', 'b_igual', 'b_der_sempar', 'c_regra', 'c_sempar']
  const a = await prepararB(page, context, info, chaves)
  const lidos: Record<string, unknown> = {}
  for (const k of chaves) {
    await abrirLista(page, `?video=${a.m.v[k]!.yt}`); await semAnimacao(page)
    const li = linha(page, a.m, k)
    await expect(li.locator('section.cn-d14')).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(600)
    const outros = await page.locator('li[data-linha] section.cn-d14').count()
    const foco = await page.evaluate((id) => { const e = document.activeElement as HTMLElement; return { foco: e.hasAttribute('data-foco-bloco'), dentro: !!e.closest(`li[data-linha="${id}"]`), tag: e.tagName } }, a.m.v[k]!.id)
    const pos = await li.evaluate((el) => ({ topo: Math.round(el.getBoundingClientRect().top), janela: window.innerHeight }))
    lidos[k] = { blocosAbertosNaPagina: outros, foco, pos }
    expect(outros, `${k}: um só bloco aberto`).toBe(1)
    expect(foco, `${k}: foco no alvo do bloco da linha certa`).toMatchObject({ foco: true, dentro: true })
    expect(pos.topo >= 0 && pos.topo < pos.janela, `${k}: a linha está na janela (${JSON.stringify(pos)})`).toBe(true)
  }
  registrarB(info, 'video-param-respondidos', lidos)
})
