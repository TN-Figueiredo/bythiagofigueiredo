// apps/web/e2e/tests/cms/observatorio/proprio-a4-comparar-custo.spec.ts
// O CUSTO da comparação para o administrador depois do cartão "Só o seu canal mede" (15c): o tempo de cada carregamento (5 medidas depois de 1 de aquecimento, no `next dev`) e o número de
// leituras do banco por carregamento (as requisições REST que o kong local registra, por tabela). Só mede e escreve em test-results/proprio-a4-comparar-custo.txt; só o banco local.
// Variantes: administrador com canal seu no par, administrador com dois concorrentes (a página lê o dado privado de TODOS os canais seus do site, o par não muda isso), administrador sem
// nenhuma linha privada (a leitura roda e volta vazia) e o reporter (nenhuma leitura privada: a linha de base do custo da moldura).
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { test, type BrowserContext } from '@playwright/test'
import { ADMIN_STATE, clearSeeded, ensureSeeded, seedIdsOf } from './fidelity'
import { clearOwnL2, localServiceClient } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
const ROTA = '/cms/youtube/competitors/comparar'
const SAIDA = path.resolve(__dirname, '../../../../test-results/proprio-a4-comparar-custo.txt')
const KONG = 'supabase_kong_bythiagofigueiredo'

// `--since` trava neste kong (log grande): lê o rabo do log e filtra pelo horário de cada linha
const logKong = (desde: number): string[] => execSync(`docker logs --tail 4000 ${KONG} 2>&1`, { maxBuffer: 1 << 26, timeout: 30_000 }).toString().split('\n').filter(l => { const m = /\[(\d\d)\/(\w{3})\/(\d{4}):(\d\d):(\d\d):(\d\d) \+0000\]/.exec(l); return m ? Date.parse(`${m[1]} ${m[2]} ${m[3]} ${m[4]}:${m[5]}:${m[6]} UTC`) / 1000 >= desde : false })
const mediana = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2 }

async function medir(ctx: BrowserContext, url: string): Promise<{ ms: number[]; leituras: Record<string, number>; total: number }> {
  const get = async (): Promise<number> => { const t0 = Date.now(); const r = await ctx.request.get(url, { timeout: 90_000 }); await r.text(); if (r.status() !== 200) throw new Error('status ' + r.status()); return Date.now() - t0 }
  await get() // aquecimento (compilação do `next dev`)
  const ms: number[] = []
  for (let i = 0; i < 5; i++) ms.push(await get())
  // as leituras de UM carregamento: as linhas novas do kong, por tabela
  await new Promise(r => setTimeout(r, 1500))
  const desde = Math.floor(Date.now() / 1000)
  await get()
  await new Promise(r => setTimeout(r, 1500))
  const novas = logKong(desde)
  const leituras: Record<string, number> = {}
  let total = 0
  for (const l of novas) {
    const m = /"(?:GET|POST|HEAD) \/rest\/v1\/([a-z_0-9]+)/.exec(l)
    if (!m) continue
    total++
    if (/^(yt_|youtube_channels$|youtube_videos$)/.test(m[1]!)) leituras[m[1]!] = (leituras[m[1]!] ?? 0) + 1
  }
  return { ms, leituras, total }
}

test('custo da comparação para o administrador (tempo e leituras do banco), com e sem canal seu no par, com e sem dado privado, e do reporter', async ({ browser, page }) => {
  test.setTimeout(600_000)
  const siteId = await ensureSeeded({ ownPreset: '2', ownL2: 'ativo' })
  const ids = seedIdsOf(siteId)
  const own = ids.own('tnfigueiredo'), matt = ids.channel('matt-wolfe'), leo = ids.channel('leo-khev')
  const linhas: string[] = []
  const rel = (nome: string, r: Awaited<ReturnType<typeof medir>>) => linhas.push(`${nome} | ms: ${r.ms.join(', ')} | mediana ${mediana(r.ms)} ms | leituras do banco em 1 carregamento: ${r.total} REST no total; privadas/canais: ${JSON.stringify(r.leituras)}`)
  try {
    rel('administrador, canal seu × concorrente, COM dado privado', await medir(page.context(), `${ROTA}?a=${own}&b=${matt}`))
    rel('administrador, dois concorrentes, COM dado privado', await medir(page.context(), `${ROTA}?a=${matt}&b=${leo}`))
    const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '../../../.auth/reporter.json') })
    try { rel('reporter (só leitura), canal seu × concorrente', await medir(ctx, `${ROTA}?a=${own}&b=${matt}`)) } finally { await ctx.close() }
    await clearOwnL2(siteId, localServiceClient())
    rel('administrador, canal seu × concorrente, SEM nenhuma linha privada', await medir(page.context(), `${ROTA}?a=${own}&b=${matt}`))
    rel('administrador, dois concorrentes, SEM nenhuma linha privada', await medir(page.context(), `${ROTA}?a=${matt}&b=${leo}`))
  } finally {
    fs.mkdirSync(path.dirname(SAIDA), { recursive: true }); fs.writeFileSync(SAIDA, linhas.join('\n') + '\n')
    test.info().annotations.push(...linhas.map(r => ({ type: 'medida', description: r })))
    await clearSeeded()
  }
})
