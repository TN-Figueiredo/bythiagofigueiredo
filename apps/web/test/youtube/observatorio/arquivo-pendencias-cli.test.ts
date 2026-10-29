// @vitest-environment node
/** Emenda da peça 7 (M3b): `pendencias` sem opções, chave só do arquivo pela rota C13 (emenda 14/10 noite: rota com chave), e leitura ruim nunca vira "nada pendente". */
import { describe, it, expect, vi } from 'vitest'
import { interpretar, rodar, USO, type DepsDoComando } from '@/lib/youtube/observatorio/arquivo/cli'
import { createServer } from 'node:http'
import { lerChave, criarPedirRotaDoDono, CAMINHO_DA_CREDENCIAL, URL_DAS_PENDENCIAS, URL_DO_PODE_DESLIGAR } from '@/lib/youtube/observatorio/arquivo/credencial'
import { scriptDasPendencias, scriptDeFalha, saidaSegura } from '@/lib/youtube/observatorio/arquivo/pendencias-script'
import { lerPendencias } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import { SITE, AGORA, discoFalso, baixarFalso } from './arquivo-fakes'

const CHAVE = 'arqdono_' + 'A'.repeat(43)
const leitura = (itens: unknown[]) => ({ versao: 2, lido_em: '2026-12-01T10:00:00Z', total: itens.length, itens })
const item = (o: Record<string, unknown> = {}) => ({ item_id: 'canal:6f1c1b9e-0000-4000-8000-000000000001', kind: 'canal', tempo: 'sem_comando',
  desde: '2026-10-01T12:00:00Z', mes: null, channel_ref: '6f1c1b9e-0000-4000-8000-000000000001', youtube_id: 'UCx', marcado_rodado_em: null,
  apagar: [], b2_nomes: [], falta: 'snapshots', motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...o })

/** Site falso (emenda 14/10 noite: rota com chave): status e corpo como texto; Error = rede, timeout ou redirecionamento. */
function site(status: number, corpo: unknown) {
  let vezes = 0
  const pedirPendencias = async () => {
    vezes++
    if (corpo instanceof Error) throw corpo
    return { status, corpo: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }
  }
  return { pedirPendencias, vezes: () => vezes }
}
const deps = (s: ReturnType<typeof site> | null): DepsDoComando => ({ sql: null, pedirPendencias: s?.pedirPendencias, disco: discoFalso().disco,
  baixar: baixarFalso().baixar, agora: () => AGORA, ehTerminal: false, perguntar: async () => { throw new Error('pendencias não pergunta') }, versaoDoScript: 'teste' })

describe('o subcomando pendencias (pela rota C13)', () => {
  it('está no uso, não tem opção e não pede OBS_ARQUIVO_DB_URL', () => {
    expect(USO.join('\n')).toContain('pendencias')
    expect(interpretar(['pendencias'], { HOME: '/h' })).toEqual({ nome: 'pendencias' })
    expect(interpretar(['pendencias', '--site', SITE], { HOME: '/h' })).toEqual({ erro: expect.stringContaining('--site') })
  })
  it('zero medido: uma chamada à rota, nenhuma ao banco, script com NADA PENDENTE', async () => {
    const s = site(200, { data: leitura([]) })
    const r = await rodar({ nome: 'pendencias' }, deps(s))
    expect(s.vezes()).toBe(1)
    expect(r.codigo).toBe(0)
    expect(r.saida[0]).toBe('#!/bin/bash')
    expect(r.saida.join('\n')).toContain('OBS-ARQUIVO: NADA PENDENTE')
  })
  it.each([
    ['503 arquivo_desligado', 503, { error: { code: 'arquivo_desligado', message: 'arquivo desligado' } }, 'arquivo está desligado'],
    ['401 (chave não registrada ou revogada)', 401, { error: { code: 'UNAUTHORIZED', message: 'x' } }, 'recusou a chave'],
    ['403 (sem archive_owner)', 403, { error: { code: 'FORBIDDEN', message: 'x' } }, 'recusou a chave'],
    ['404 (rota ainda não publicada)', 404, '<html>404</html>', 'HTTP 404'],
    ['429', 429, { error: { code: 'UNAUTHORIZED', message: 'x' } }, 'HTTP 429'],
    ['500', 500, { error: { code: 'erro_do_banco', message: 'x' } }, 'HTTP 500'],
    ['503 sem arquivo_desligado', 503, '', 'HTTP 503'],
    ['200 em HTML', 200, '<html>login</html>', 'sem JSON'],
    ['200 vazio', 200, '', 'sem JSON'],
    ['200 com data nulo', 200, { data: null }, 'não consegui ler'],
    ['200 sem o envelope', 200, leitura([]), 'não consegui ler'],
    ['200 com envelope e campo a mais', 200, { data: leitura([]), extra: 1 }, 'não consegui ler'],
    ['200 fora da forma do C12', 200, { data: { itens: [] } }, 'não consegui ler'],
    ['timeout de 15 s', 0, Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), 'em 15 s'],
    ['rede fora ou redirecionamento', 0, new TypeError('fetch failed'), '(rede)'],
  ])('%s: código 1, script de falha, nunca "nada pendente", sem a chave', async (_, status, corpo, frase) => {
    const r = await rodar({ nome: 'pendencias' }, deps(site(status, corpo)))
    const s = r.saida.join('\n')
    expect(r.codigo).toBe(1)
    expect(r.saida[0]).toBe('#!/bin/bash')
    expect(s).toContain('OBS-ARQUIVO: NÃO RODOU')
    expect(s).toContain(frase)
    expect(s).toMatch(/exit 1/)
    expect(s).not.toMatch(/NADA PENDENTE|NADA A RODAR|apaga_conferido '/)
    expect(s + (r.erros ?? []).join('\n')).not.toContain(CHAVE)
  })
  it('item sem comando: espera, não apaga, e não diz "nada pendente"', async () => {
    const r = await rodar({ nome: 'pendencias' }, deps(site(200, { data: leitura([item()]) })))
    expect(r.codigo).toBe(0)
    const s = r.saida.join('\n')
    expect(s).toContain('ESPERA canal:6f1c1b9e-0000-4000-8000-000000000001')
    expect(s).toContain('OBS-ARQUIVO: NADA A RODAR AGORA (1 esperando)')
    expect(s).not.toMatch(/NADA PENDENTE|\brm\b/)
  })
  it('copiar ainda não tem passo: código 1 (M9)', async () => {
    const r = await rodar({ nome: 'pendencias' }, deps(site(200, { data: leitura([item({ tempo: 'copiar' })]) })))
    expect(r.codigo).toBe(1)
    expect(r.saida.join('\n')).toMatch(/exit 1/)
  })
  it('sem pedirPendencias (a chave não foi lida): script de falha, nunca texto cru que o bash da forja executaria (Yannis I1)', async () => {
    const r = await rodar({ nome: 'pendencias' }, deps(null))
    expect(r.codigo).toBe(1)
    expect(r.saida[0]).toBe('#!/bin/bash')
    expect(r.saida.filter(l => l !== '' && !l.startsWith('#') && !/^(echo |exit 1$)/.test(l))).toEqual([])
  })
  it('o script de falha sai 1 na forja, termina em OBS-ARQUIVO: NÃO RODOU e não tem nada além de echo e exit', () => {
    const s = scriptDeFalha("obs:arquivo: não consegui ler as pendências; nada foi feito")
    expect(s[0]).toBe('#!/bin/bash')
    expect(s.filter(l => l !== '' && !l.startsWith('#') && !/^(echo |exit 1$)/.test(l))).toEqual([])
    expect(s.join('\n')).toContain("OBS-ARQUIVO: NÃO RODOU: não consegui ler")   // sem o prefixo "obs:arquivo:" repetido
  })
  it('saidaSegura: código ≠ 0 com saída que não é script vira script de falha, nunca texto cru (defesa na borda)', () => {
    const s = saidaSegura({ codigo: 2, saida: ['nenhum site tem canal'], erros: ['obs:arquivo: sem site'] })
    expect(s[0]).toBe('#!/bin/bash')
    expect(s.join('\n')).not.toContain('nenhum site tem canal')
    expect(saidaSegura({ codigo: 0, saida: ['#!/bin/bash', 'exit 0'] })).toEqual(['#!/bin/bash', 'exit 0'])
  })
})

describe('a chave vem só do arquivo (D-F21, D-F22; emenda 14/10 noite: rota com chave)', () => {
  const ler = (r: { modo: number; modoPasta?: number; texto: string } | null) => async () => r && { modoPasta: 0o700, ...r }
  it('sem HOME: erro que diz o que fazer', async () => {
    const env: NodeJS.ProcessEnv = { HOME: '/h' }
    delete env.HOME
    expect(await lerChave(env, ler({ modo: 0o600, texto: CHAVE }))).toEqual({ ok: false, mensagem: expect.stringContaining('HOME') })
  })
  it('sem o arquivo: diz o caminho e o .sh que o grava, mesmo com PIPELINE_COWORK_KEY e OBS_ARQUIVO_DB_URL na sessão', async () => {
    const r = await lerChave({ HOME: '/h', PIPELINE_COWORK_KEY: 'pk_prod_x', OBS_ARQUIVO_DB_URL: 'postgresql://x' }, ler(null))
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining(CAMINHO_DA_CREDENCIAL) })
    expect(!r.ok && r.mensagem).toContain('m3b-obs-arquivo-credencial.sh')
  })
  it.each([[0o644], [0o640], [0o604]])('modo %o: recusa (legível por outros)', async modo => {
    expect((await lerChave({ HOME: '/h' }, ler({ modo, texto: CHAVE }))).ok).toBe(false)
  })
  it.each([[0o755], [0o750]])('pasta %o aberta: recusa (Yannis M3a)', async modoPasta => {
    expect((await lerChave({ HOME: '/h' }, ler({ modo: 0o600, modoPasta, texto: CHAVE }))).ok).toBe(false)
  })
  it.each([
    ['vazio', ''],
    ['a chave do Cowork (pk_...)', 'pk_prod_' + 'Z'.repeat(40)],
    ['uma chave da forja (forja_...)', 'forja_' + 'Z'.repeat(43)],
    ['curta', 'arqdono_ZZZ'],
    ['duas linhas', `${CHAVE}\n${CHAVE}`],
    ['com espaço', 'arqdono_ ' + 'Z'.repeat(42)],
    ['uma URL de banco (o db-url velho)', 'postgresql://obs_arquivo_leitor.x:SENHA@h:5432/postgres'],
  ])('%s: recusa sem ecoar o conteúdo', async (_, texto) => {
    const r = await lerChave({ HOME: '/h' }, ler({ modo: 0o600, texto }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.mensagem).not.toMatch(/SENHA|ZZZ|AAAA/)
  })
  it('600 numa pasta 700 com uma linha arqdono_: ok, com o fim de linha tirado', async () => {
    expect(await lerChave({ HOME: '/h' }, ler({ modo: 0o600, texto: `${CHAVE}\n` }))).toEqual({ ok: true, chave: CHAVE })
  })
})

describe('criarPedirRotaDoDono: a borda do Mac contra um servidor de verdade (r2.5, Yannis m1; a asserção "sem a chave" agora morde)', () => {
  type Servidor = { url: string; recebidos: Array<{ chave: string | undefined; caminho: string | undefined }>; fechar: () => Promise<void> }
  async function servir(modo: 'ok' | 'redireciona' | 'mudo' | 'corpo-parado'): Promise<Servidor> {
    const recebidos: Servidor['recebidos'] = []
    const sockets = new Set<import('node:net').Socket>()
    const srv = createServer((req, res) => {
      recebidos.push({ chave: req.headers['x-pipeline-key'] as string | undefined, caminho: req.url })
      if (modo === 'ok') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data: leitura([]) })) }
      else if (modo === 'redireciona') { res.writeHead(308, { Location: 'http://127.0.0.1:1/outro' }); res.end() }
      else if (modo === 'corpo-parado') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"data":') }   // cabeçalho sai, corpo trava
      // 'mudo': não responde nada
    })
    srv.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)) })
    await new Promise<void>(ok => srv.listen(0, '127.0.0.1', ok))
    const porta = (srv.address() as import('node:net').AddressInfo).port
    return { url: `http://127.0.0.1:${porta}/api/pipeline/archive/pending`, recebidos,
      fechar: () => new Promise<void>(ok => { sockets.forEach(s => s.destroy()); srv.close(() => ok()) }) }
  }
  const semChave = (e: unknown) => String(e) + String((e as { cause?: unknown })?.cause) + JSON.stringify(e, Object.getOwnPropertyNames(e as object))

  it('manda a chave no cabeçalho X-Pipeline-Key e devolve status e corpo', async () => {
    const s = await servir('ok')
    try {
      const r = await criarPedirRotaDoDono({ chave: CHAVE, rota: 'pending', url: s.url })()
      expect(r.status).toBe(200)
      expect(JSON.parse(r.corpo)).toEqual({ data: leitura([]) })
      expect(s.recebidos).toEqual([{ chave: CHAVE, caminho: '/api/pipeline/archive/pending' }])
    } finally { await s.fechar() }
  })
  it('redirecionamento (308): lança, e a chave não aparece no erro nem na causa', async () => {
    const s = await servir('redireciona')
    try {
      const e = await criarPedirRotaDoDono({ chave: CHAVE, rota: 'pending', url: s.url })().catch(x => x)
      expect(e).toBeInstanceOf(TypeError)
      expect(semChave(e)).not.toContain(CHAVE)
    } finally { await s.fechar() }
  })
  it.each(['mudo', 'corpo-parado'] as const)('servidor %s com timeoutMs 200: lança TimeoutError (o corpo também está sob o sinal), sem a chave', async modo => {
    const s = await servir(modo)
    try {
      const e = await criarPedirRotaDoDono({ chave: CHAVE, rota: 'pode-desligar', url: s.url, timeoutMs: 200 })().catch(x => x)
      expect((e as Error).name).toBe('TimeoutError')
      expect(semChave(e)).not.toContain(CHAVE)
    } finally { await s.fechar() }
  })
  it('rodar com a fábrica contra o servidor mudo: a frase "em 15 s", código 1, script de falha, e nenhum texto da saída contém a chave', async () => {
    const s = await servir('mudo')
    try {
      const pedir = criarPedirRotaDoDono({ chave: CHAVE, rota: 'pending', url: s.url, timeoutMs: 200 })
      const r = await rodar({ nome: 'pendencias' }, { ...deps(null), pedirPendencias: pedir })
      expect(r.codigo).toBe(1)
      expect(r.saida.join('\n')).toContain('em 15 s')
      expect(r.saida.join('\n') + (r.erros ?? []).join('\n')).not.toContain(CHAVE)
    } finally { await s.fechar() }
  })
  it('o padrão que nenhum teste sobrescreve: sem url nem timeoutMs, a URL é a constante e as opções são as de produção (env apagado)', async () => {
    delete process.env.OBS_ARQUIVO_URL   // não existe variável: apagar não muda nada (D-F21)
    for (const [rota, url] of [['pending', URL_DAS_PENDENCIAS], ['pode-desligar', URL_DO_PODE_DESLIGAR]] as const) {
      const chamadas: Array<{ url: string; init: RequestInit }> = []
      const fetchFn = (async (u: string, init: RequestInit) => { chamadas.push({ url: String(u), init }); return new Response('{}', { status: 200 }) }) as unknown as typeof fetch
      await criarPedirRotaDoDono({ chave: CHAVE, rota, fetchFn })()
      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].url).toBe(url)
      expect(chamadas[0].init).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { 'X-Pipeline-Key': CHAVE } })
      expect(chamadas[0].init.signal).toBeInstanceOf(AbortSignal)
    }
    // Yannis N7: o padrão de 15 s é número de produção que nenhum teste sobrescreve (15_000 -> 150_000 sobrevivia a "é um AbortSignal")
    const espia = vi.spyOn(AbortSignal, 'timeout')
    try {
      await criarPedirRotaDoDono({ chave: CHAVE, rota: 'pending', fetchFn: (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch })()
      expect(espia).toHaveBeenCalledWith(15_000)
    } finally { espia.mockRestore() }
    expect(URL_DAS_PENDENCIAS).toBe('https://bythiagofigueiredo.com/api/pipeline/archive/pending')
    expect(URL_DO_PODE_DESLIGAR).toBe('https://bythiagofigueiredo.com/api/pipeline/archive/pode-desligar')
  })
})

describe('scriptDasPendencias', () => {
  it('gera para os três tempos que só esperam (o bash de verdade está no teste seguinte)', () => {
    for (const tempo of ['sem_comando', 'conferir_b2', 'bloqueado']) {
      const l = lerPendencias(leitura([item({ tempo, falta: tempo === 'sem_comando' ? 'snapshots' : null, motivo: tempo === 'bloqueado' ? 'grande_demais' : null, b2_nomes: tempo === 'conferir_b2' ? ['numerico/x.csv.gz'] : [] })]))
      expect(l.ok && scriptDasPendencias(l, { versao: 't' }).ok).toBe(true)
    }
  })
  it('toda saída termina numa linha OBS-ARQUIVO: zero, só esperando, com apagar e falha (invariante do dono)', () => {
    const nada = lerPendencias(leitura([])), espera = lerPendencias(leitura([item()]))
    for (const l of [nada, espera]) {
      const s = l.ok ? scriptDasPendencias(l, { versao: 't' }) : null
      expect(s && s.ok && s.linhas.join('\n')).toContain('OBS-ARQUIVO:')
    }
    expect(scriptDeFalha('x').join('\n')).toContain('OBS-ARQUIVO:')
  })
})
