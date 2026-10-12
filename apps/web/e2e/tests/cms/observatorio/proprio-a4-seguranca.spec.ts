// apps/web/e2e/tests/cms/observatorio/proprio-a4-seguranca.spec.ts
// A PROVA DE SEGURANÇA AUTENTICADA da A4 (Tarefa 15b), em navegador, nas duas telas novas: o canal próprio (cartões, painel, "Todos os números", aba Retenção)
// e o vídeo próprio (seis vídeos, o Anterior/Próximo incluído), mais a comparação. O usuário só de leitura (reporter) não recebe NENHUM número privado,
// nem no HTML bruto do servidor, nem no DOM depois de hidratar, nem em nenhuma resposta de rede (fetch, flight RSC, a carga RSC pedida direto e a dos vizinhos
// do paginador). Cada grupo de número privado tem CONTROLE POSITIVO: o administrador o recebe, no mesmo desenho, para a negativa não passar em vazio.
//
// O dado é o perfil `retencao` da semente (observatorio-seed.ts): valores improváveis (51.852 impressões, 19.983 num dia, 1.139 cliques, 113% assistido…), e os
// esperados SAEM DAS LINHAS DO BANCO (somas feitas aqui), nunca da tela. Formas que o HTML público já traz (medidas numa linha de base do administrador SEM dado
// privado) são descartadas: uma forma que coincide com o público não prova nada.
import path from 'node:path'
import { test, expect, type BrowserContext } from '@playwright/test'
import { taxaComIntervalo } from '@/lib/youtube/observatorio/proprio/taxa'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { clearOwnL2, localServiceClient, MAPA_RETENCAO, RET, seedOwnL2 } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors'
const S = '[data-obs-screen="canal"][data-own="1"]'
const V = '[data-obs-screen="video-proprio"]'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const CAPA = (r: { fulfill: (o: { status: number; contentType: string; body: Buffer }) => Promise<void> }) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG })

const PT = (n: number): string => n.toLocaleString('pt-BR')
const abrev = (n: number): string => {
  const dec = (x: number) => { const r = Math.round(x * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',') }
  return n < 1000 ? String(Math.round(n)) : n < 1e6 ? dec(n / 1e3) + ' mil' : dec(n / 1e6) + ' mi'
}
const formasNum = (n: number): string[] => (n >= 1000 ? [String(n), PT(n), abrev(n)] : [String(n)])
const pctUm = (frac: number): string => (frac * 100).toFixed(1).replace('.', ',') + '%'
const mmss = (sec: number): string => { const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; const p2 = (n: number) => (n < 10 ? '0' : '') + n; return h ? `${h}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}` }
const unicos = (a: string[]): string[] => [...new Set(a)]

interface Alcance { ytId: string; dia: string; imp: number; ctr: number }
interface Diario { ytId: string; dia: string; views: number; pct: number | null; durMedia: number | null }
interface Privado { alcance: Alcance[]; diario: Diario[]; videos: Map<string, { id: string; dur: number; pub: string }> }

async function lerPrivado(siteId: string, canal: string): Promise<Privado> {
  const sb = localServiceClient()
  const ler = async (t: string, cols: string) => {
    const r = await sb.from(t).select(cols).eq('site_id', siteId).eq('channel_id', canal).limit(5000)
    if (r.error) throw new Error(t + ': ' + r.error.message)
    return (r.data ?? []) as unknown as Array<Record<string, unknown>>
  }
  const num = (x: unknown): number => Number(x)
  const vids = await ler('youtube_videos', 'id, youtube_video_id, duration_seconds, published_at')
  return {
    alcance: (await ler('yt_own_video_reach_daily', 'youtube_video_id, day_pt, thumbnail_impressions, thumbnail_ctr')).map(r => ({ ytId: String(r.youtube_video_id), dia: String(r.day_pt), imp: num(r.thumbnail_impressions), ctr: num(r.thumbnail_ctr) })),
    diario: (await ler('yt_own_video_daily', 'youtube_video_id, day_pt, views, avg_view_percentage, avg_view_duration_seconds')).map(r => ({
      ytId: String(r.youtube_video_id), dia: String(r.day_pt), views: num(r.views), pct: r.avg_view_percentage == null ? null : num(r.avg_view_percentage), durMedia: r.avg_view_duration_seconds == null ? null : num(r.avg_view_duration_seconds),
    })),
    videos: new Map(vids.map(v => [String(v.youtube_video_id), { id: String(v.id), dur: num(v.duration_seconds), pub: String(v.published_at) }])),
  }
}

interface Sentinela { grupo: string; formas: string[]; /** o grupo que NENHUMA tela escreve (a negativa só vale porque o dado existe no banco) */ semTela?: string }
/** Todas as formas em que cada grupo de número privado poderia viajar, calculadas das linhas do banco. */
function sentinelas(p: Privado): Sentinela[] {
  const cliquesDe = (l: Alcance[]) => l.reduce((a, r) => a + r.imp * r.ctr, 0)
  const impDe = (l: Alcance[]) => l.reduce((a, r) => a + r.imp, 0)
  const porYt = new Map<string, Alcance[]>(), porDia = new Map<string, Alcance[]>()
  for (const r of p.alcance) { porYt.set(r.ytId, [...(porYt.get(r.ytId) ?? []), r]); porDia.set(r.dia, [...(porDia.get(r.dia) ?? []), r]) }
  const grupos = [p.alcance, ...porYt.values()].filter(l => impDe(l) > 0)
  const extremos = grupos.map(l => taxaComIntervalo(cliquesDe(l), impDe(l))!)
  const pctDe = new Map<string, number>(), view28 = new Map<string, number>(), diasDe = new Map<string, number>()
  for (const yt of new Set(p.diario.map(d => d.ytId))) {
    const l = p.diario.filter(d => d.ytId === yt && d.views > 0 && d.pct != null)
    const v = l.reduce((a, d) => a + d.views, 0)
    if (v > 0) pctDe.set(yt, l.reduce((a, d) => a + d.views * d.pct!, 0) / v)
    view28.set(yt, p.diario.filter(d => d.ytId === yt).reduce((a, d) => a + d.views, 0))
    diasDe.set(yt, p.diario.filter(d => d.ytId === yt).length)
  }
  const diaViews = new Map<string, number>()
  for (const d of p.diario) diaViews.set(d.dia, (diaViews.get(d.dia) ?? 0) + d.views)
  const assistidos = [...pctDe.entries()].map(([yt, pct]) => ({ yt, pct, dur: p.videos.get(yt)?.dur ?? 0 }))
  return [
    { grupo: 'impressões (total do canal, de cada vídeo e de cada dia)', formas: unicos([...grupos.map(impDe), ...[...porDia.values()].map(impDe)].flatMap(formasNum)) },
    { grupo: 'cliques estimados (total do canal, de cada vídeo e de cada dia)', formas: unicos([...grupos.map(cliquesDe), ...[...porDia.values()].map(cliquesDe)].map(Math.round).flatMap(formasNum)) },
    { grupo: 'taxa de clique (valor)', formas: unicos(extremos.flatMap(t => [`${pctUm(t.taxa)} das impressões viraram clique`])) },
    { grupo: 'taxa de clique: o extremo de baixo e o de cima do intervalo (os dois)', formas: unicos(extremos.flatMap(t => [`${pctUm(t.lo)} a ${pctUm(t.hi)}`, `entre ${pctUm(t.lo)} e ${pctUm(t.hi)}`])) },
    { grupo: '% assistido (frase por vídeo)', formas: unicos(assistidos.map(a => `Quem assiste vê em média ${Math.round(a.pct)}%`)) },
    { grupo: 'duração média assistida (m:ss de m:ss, derivada da duração média por dia)', formas: unicos(assistidos.flatMap(a => [`${mmss(a.pct / 100 * a.dur)} de ${mmss(a.dur)}`, `${mmss(a.pct / 100 * a.dur)} assistidos num vídeo de ${mmss(a.dur)}`])) },
    { grupo: 'duração média por dia, em segundos (a coluna crua; nenhuma tela a escreve)', formas: unicos(p.diario.filter(d => d.durMedia != null).flatMap(d => [String(d.durMedia), String(Math.round(d.durMedia!))])), semTela: 'o servidor só usa a duração média para montar a frase m:ss acima; o número cru não tem lugar na tela' },
    { grupo: 'views do diário (28 dias de cada vídeo e a soma de cada dia)', formas: unicos([...view28.values(), ...diaViews.values()].filter(n => n >= 100).flatMap(formasNum)) },
    { grupo: 'views por dia (média de cada vídeo, escrita "N por dia")', formas: unicos([...view28.entries()].filter(([, v]) => v >= 100).flatMap(([yt, v]) => { const n = Math.max(1, Math.min(28, diasDe.get(yt) ?? 28)); return [`${Math.round(v / n)} views por dia`, `(${Math.round(v / n)} por dia)`] })) },
  ]
}

/** Marcadores estruturais: o desenho que só o administrador recebe (o controle positivo de quem não tem número que o nomeie). */
const MARCADORES: Array<{ grupo: string; tela: string; seletor: string }> = [
  { grupo: 'gráfico de impressões e cliques', tela: 'canal', seletor: `${S} figure.ic svg.ic-svg` },
  { grupo: 'faixa da taxa de clique do canal', tela: 'canal', seletor: `${S} .pn-taxa .tf` },
  { grupo: 'views por dia nos cartões', tela: 'canal', seletor: `${S} li.cv-card .cv-vpd` },
  { grupo: 'tabela de % assistido por vídeo', tela: 'retenção', seletor: `${S} table.tb-v tbody tr` },
  { grupo: 'normal do % assistido por faixa de duração', tela: 'retenção', seletor: `${S} .ret-faixas tbody tr` },
  { grupo: 'gráfico de views por dia do vídeo', tela: 'vídeo alto', seletor: `${V} section[aria-labelledby="vb-views-h"] svg.ic-svg` },
  { grupo: 'gráfico de impressões e cliques do vídeo', tela: 'vídeo alto', seletor: `${V} section[aria-labelledby="vb-imp-h"] svg.ic-svg` },
  { grupo: 'taxa de clique do vídeo com intervalo', tela: 'vídeo alto', seletor: `${V} .vb-ctr .tf` },
  { grupo: 'barra do % assistido do vídeo', tela: 'vídeo alto', seletor: `${V} .vb-as-barra` },
  { grupo: 'régua de views por dia ("Este vídeo no canal")', tela: 'vídeo alto', seletor: `${V} .vb-rg-r[data-numero="vpd"] .vb-rg` },
  { grupo: 'régua de % assistido ("Este vídeo no canal")', tela: 'vídeo alto', seletor: `${V} .vb-rg-r[data-numero="assistido"] .vb-rg` },
  { grupo: 'régua de impressões ("Este vídeo no canal")', tela: 'vídeo alto', seletor: `${V} .vb-rg-r[data-numero="impressoes"] .vb-rg` },
]

interface Fonte { html: string; dom: string; rede: string; contagens: Map<string, number> }
interface TelaAlvo { nome: string; url: string; espera: string; vizinhos?: boolean }
const ondeEsta = (f: Fonte, s: string): Array<'html' | 'dom' | 'rede'> => (['html', 'dom', 'rede'] as const).filter(k => f[k].includes(s))
const trecho = (txt: string, s: string): string => { const i = txt.indexOf(s); return txt.slice(Math.max(0, i - 40), i + s.length + 40).replace(/\s+/g, ' ') }

/** Abre a tela num contexto e devolve tudo o que o navegador recebeu: HTML bruto, DOM hidratado, respostas de rede, a carga RSC pedida direto e a dos vizinhos do paginador. */
async function coletar(ctx: BrowserContext, t: TelaAlvo): Promise<Fonte> {
  const pg = await ctx.newPage()
  try {
    await pg.route(/(ytimg|ggpht)\.com/, CAPA)
    const corpos: Array<Promise<string>> = []
    pg.on('response', r => {
      const tipo = r.request().resourceType(), ct = r.headers()['content-type'] ?? ''
      if (tipo === 'document' || /\/_next\/static\//.test(r.url()) || /^(image|font)\//.test(ct) || /css|javascript/.test(ct)) return
      corpos.push(r.text().catch(() => ''))
    })
    const bruto = await ctx.request.get(t.url, { timeout: 60_000 })
    expect(bruto.status(), `HTML bruto de ${t.url}`).toBe(200)
    const html = await bruto.text()
    await pg.goto(t.url)
    await pg.locator(t.espera).first().waitFor({ timeout: 60_000 })
    await pg.waitForLoadState('networkidle')
    const dom = (await pg.content()) + '\n' + (await pg.evaluate(() => document.body.innerText + '\n' + (document.body.textContent ?? '').replace(/\s+/g, ' ')))
    const rsc = [await (await ctx.request.get(t.url, { headers: { RSC: '1' }, timeout: 60_000 })).text()]
    if (t.vizinhos) {
      // o Anterior/Próximo: a carga RSC que o navegador pede ao trocar de vídeo (router.replace) é a da página vizinha
      for (const lado of ['prev', 'next']) {
        const href = await pg.locator(`[data-pager-${lado}]`).first().getAttribute('href').catch(() => null)
        if (href) rsc.push(await (await ctx.request.get(href, { headers: { RSC: '1' }, timeout: 60_000 })).text())
      }
    }
    expect(rsc[0]!.length, `carga RSC de ${t.url} veio vazia: a prova de rede estaria vazia`).toBeGreaterThan(500)
    const contagens = new Map<string, number>()
    for (const m of MARCADORES) if (m.tela === t.nome || (m.tela === 'canal' && t.nome === 'canal')) contagens.set(m.seletor, await pg.locator(m.seletor).count())
    return { html, dom, rede: [...(await Promise.all(corpos)), ...rsc].join('\n'), contagens }
  } finally { await pg.close() }
}

test.describe('A4 15b: quem só lê o site não recebe número privado nas telas do canal e do vídeo próprios (HTML, DOM e rede), com controle positivo do administrador', () => {
  test.afterAll(async () => { test.setTimeout(120_000); await clearSeeded() })

  test('SENTINELAS do perfil retencao: o administrador recebe cada grupo; o reporter não recebe nenhuma forma de nenhum grupo em nenhuma tela', async ({ browser, page }) => {
    test.setTimeout(600_000)
    const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'retencao' })
    const ids = seedIdsOf(siteId)
    const sb = localServiceClient()
    const own = ids.own('tnfigueiredo')
    const p = await lerPrivado(siteId, own)
    const lista = sentinelas(p)
    for (const g of lista) expect(g.formas.length, `o grupo "${g.grupo}" tem formas`).toBeGreaterThan(0)
    const idDe = (yt: string): string => p.videos.get(yt)!.id
    const ordem = [RET.magro, RET.volumeAlto, 'xsi7iiX5Hvd', 'YSsFxMlqbOA']
    const nomesVideo = ['vídeo magro', 'vídeo alto', 'vídeo 113%', 'vídeo poucas views']
    const lote = ordem.map(idDe).join(',')
    const telas: TelaAlvo[] = [
      { nome: 'canal', url: `${ROTA}/canal/${own}?painel=1&nums=1`, espera: `${S} section.pn` },
      { nome: 'retenção', url: `${ROTA}/canal/${own}?tab=retencao&nums=1`, espera: `${S} .ret` },
      ...ordem.map((yt, i): TelaAlvo => ({ nome: nomesVideo[i] === 'vídeo alto' ? 'vídeo alto' : nomesVideo[i]!, url: `${ROTA}/video/${idDe(yt)}?from=canais&canal=${own}&ids=${lote}&pos=${i + 1}&tot=${ordem.length}`, espera: `${V} h1:visible`, vizinhos: true })),
      { nome: 'comparação', url: `${ROTA}/comparar?a=${own}&b=${ids.channel('matt-wolfe')}`, espera: '[data-obs-screen]:visible tr' },
    ]
    const nomes = telas.map(t => t.nome)

    // 1) a LINHA DE BASE: as mesmas telas como administrador SEM nenhum dado privado. O que aparece aqui é público.
    const base: Record<string, Fonte> = {}
    try {
      await clearOwnL2(siteId, sb)
      for (const t of telas) base[t.nome] = await coletar(page.context(), t)
    } finally { await seedOwnL2(siteId, 'retencao', '2', sb) }
    // 2) o administrador com o dado: o controle positivo
    const admin: Record<string, Fonte> = {}
    for (const t of telas) admin[t.nome] = await coletar(page.context(), t)
    // 3) o reporter
    const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '../../../.auth/reporter.json'), viewport: { width: 1440, height: 900 } })
    const leitor: Record<string, Fonte> = {}
    const intrusos: string[] = []
    try {
      await ctx.route('**/*', async route => {
        const r = route.request()
        if (r.method() === 'POST' && r.headers()['next-action']) { intrusos.push(`${r.headers()['next-action']} ${r.url()}`); await route.abort('blockedbyclient'); return }
        await route.fallback()
      })
      for (const t of telas) leitor[t.nome] = await coletar(ctx, t)
    } finally { await ctx.close() }
    expect(intrusos, 'nenhuma server action no caminho do reporter').toEqual([])

    // 4) a conta
    const ambigua = (f: string): boolean => nomes.some(n => ondeEsta(base[n]!, f).length > 0)
    const relatorio: string[] = []
    const vazou: string[] = []
    const semControle: string[] = []
    for (const g of lista) {
      const validas = g.formas.filter(f => !ambigua(f))
      const comControle = validas.filter(f => nomes.some(n => ondeEsta(admin[n]!, f).length > 0))
      const ondeAdmin = unicos(nomes.flatMap(n => comControle.flatMap(f => ondeEsta(admin[n]!, f).map(o => `${n}/${o}`))))
      const negativas: string[] = []
      for (const f of validas) for (const n of nomes) for (const o of ondeEsta(leitor[n]!, f)) {
        vazou.push(`SEGURANÇA: "${f}" (${g.grupo}) chegou ao reporter na tela ${n} em ${o}: …${trecho(leitor[n]![o], f)}…`)
        negativas.push(`${n}/${o}`)
      }
      if (comControle.length === 0) semControle.push(g.grupo)
      relatorio.push(`${g.grupo} | formas ${g.formas.length}, públicas descartadas ${g.formas.length - validas.length}, com controle positivo ${comControle.length}${g.semTela ? ' (SEM TELA: ' + g.semTela + ')' : ''} | admin recebe em: ${ondeAdmin.slice(0, 6).join(', ') || 'nenhum'}${ondeAdmin.length > 6 ? ' (+' + (ondeAdmin.length - 6) + ')' : ''} | reporter: ${negativas.length ? 'VAZOU ' + negativas.join(', ') : 'limpo em html, dom e rede, em ' + nomes.length + ' telas'}`)
    }
    for (const n of nomes) relatorio.push(`tamanhos (${n}): reporter html ${leitor[n]!.html.length}, dom ${leitor[n]!.dom.length}, rede ${leitor[n]!.rede.length}; admin html ${admin[n]!.html.length}, dom ${admin[n]!.dom.length}, rede ${admin[n]!.rede.length}`)

    // 5) os marcadores estruturais: o desenho existe para o administrador e não existe para o reporter
    for (const m of MARCADORES) {
      const a = admin[m.tela]?.contagens.get(m.seletor) ?? 0, l = leitor[m.tela]?.contagens.get(m.seletor) ?? 0
      relatorio.push(`marcador "${m.grupo}" (${m.tela}) | administrador ${a} | reporter ${l}`)
      expect(a, `controle positivo: o administrador recebe "${m.grupo}" na tela ${m.tela}`).toBeGreaterThan(0)
      expect(l, `SEGURANÇA: o reporter não recebe "${m.grupo}" na tela ${m.tela}`).toBe(0)
    }
    test.info().annotations.push(...relatorio.map(r => ({ type: 'medida', description: r })))
    const fs = await import('node:fs')
    const alvo = path.resolve(__dirname, '../../../../test-results/proprio-a4-seguranca.txt')
    fs.mkdirSync(path.dirname(alvo), { recursive: true }); fs.writeFileSync(alvo, relatorio.join('\n') + '\n')

    expect(vazou, 'DEFEITO DE SEGURANÇA: dado privado chegou ao usuário só de leitura').toEqual([])
    // todo grupo que alguma tela escreve tem controle positivo; só o grupo declarado "sem tela" pode não ter
    expect(semControle.sort(), 'grupos sem controle positivo (só pode ser o declarado sem tela)').toEqual(lista.filter(g => g.semTela).map(g => g.grupo).sort())
    // o reporter recebeu as telas com as frases de "só quem edita o site vê" no lugar dos números
    expect(leitor['canal']!.dom).toContain('Só quem edita o site vê as impressões.')
    expect(leitor['canal']!.dom).not.toContain('ic-svg')
    expect(leitor['vídeo alto']!.dom).not.toContain('Quem assiste vê em média')
    expect(leitor['retenção']!.dom).toContain('Só quem edita o site vê o % assistido.')
    // o controle positivo da carga RSC (a do vídeo e a dos vizinhos do paginador): o administrador recebe nela a duração assistida montada no servidor; o reporter, nada
    const noRsc = lista.find(g => g.grupo.startsWith('duração média assistida'))!.formas.filter(x => !ambigua(x) && admin['vídeo alto']!.rede.includes(x))
    expect(noRsc.length, 'a carga RSC do vídeo (e dos vizinhos) do administrador traz a duração assistida de algum vídeo').toBeGreaterThan(0)
    for (const x of noRsc) expect(leitor['vídeo alto']!.rede.includes(x), `a carga RSC do reporter não traz "${x}"`).toBe(false)
  })
})
