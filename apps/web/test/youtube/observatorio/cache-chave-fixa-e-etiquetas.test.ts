// @vitest-environment node
// F3-cache T1: chave fixa (`comChaveFixa` + `ENTRADAS`), etiqueta por canal (`tagsDoCanal`), invalidação por lista, e o fake de cache estendido.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createFakeNextCache } from '../../helpers/fake-next-cache'

const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV }; vi.resetModules(); vi.doUnmock('next/cache') })

describe('comChaveFixa e ENTRADAS', () => {
  it('toString é o nome da entrada mais o ambiente; sem VERCEL_ENV vale local (a variável apagada, não sobrescrita)', async () => {
    const { comChaveFixa, ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    process.env.VERCEL_ENV = 'production'
    expect(comChaveFixa(ENTRADAS.medidas, async () => 1).toString()).toBe('medidas-telas:production')
    delete process.env.VERCEL_ENV
    expect(comChaveFixa(ENTRADAS.medidas, async () => 1).toString()).toBe('medidas-telas:local')
  })
  it('preview e produção não dividem a entrada', async () => {
    const { comChaveFixa, ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    process.env.VERCEL_ENV = 'preview'
    const a = comChaveFixa(ENTRADAS.pacote, async () => 1).toString()
    process.env.VERCEL_ENV = 'production'
    expect(comChaveFixa(ENTRADAS.pacote, async () => 1).toString()).not.toBe(a)
  })
  it('o invólucro repassa argumentos e resultado', async () => {
    const { comChaveFixa, ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    const cb = vi.fn(async (a: number, b: string) => a + b)
    expect(await comChaveFixa(ENTRADAS.serie, cb)(2, 'x')).toBe('2x')
    expect(cb).toHaveBeenCalledWith(2, 'x')
  })
  it('ENTRADAS não repete nome', async () => {
    const { ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    const v = Object.values(ENTRADAS)
    expect(new Set(v).size).toBe(v.length)
    expect(v).toHaveLength(8)
  })
  it('dois callbacks de texto diferente (dois pacotes minificados) com o mesmo nome acertam a mesma entrada; sem o helper, erram (controle)', async () => {
    const cache = createFakeNextCache()
    const { comChaveFixa, ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    // textos diferentes de propósito, como `w(e,t)` na rota e `q(a,b)` na página
    const daRota = async (siteId: string) => { return 'rota:' + siteId }
    const daPagina = async (s: string) => { const r = 'pagina:' + s; return r.replace('pagina', 'rota') }
    expect(daRota.toString()).not.toBe(daPagina.toString())
    const lerA = cache.module.unstable_cache(comChaveFixa(ENTRADAS.pacote, daRota), [ENTRADAS.pacote, '4'])
    const lerB = cache.module.unstable_cache(comChaveFixa(ENTRADAS.pacote, daPagina), [ENTRADAS.pacote, '4'])
    await lerA('s'); await lerB('s')
    expect(cache.entries.size).toBe(1)
    expect(cache.misses).toHaveLength(1)
    // controle: sem o helper cada texto grava a sua
    const c2 = createFakeNextCache()
    await c2.module.unstable_cache(daRota, ['k'])('s'); await c2.module.unstable_cache(daPagina, ['k'])('s')
    expect(c2.entries.size).toBe(2)
  })
})

describe('invalidateObservatory: lista de canais, ou o site inteiro', () => {
  async function com() {
    vi.resetModules()
    const revalidateTag = vi.fn()
    vi.doMock('next/cache', () => ({ revalidateTag }))
    return { revalidateTag, ...(await import('@/lib/youtube/observatorio/cache-tag')) }
  }
  it('com lista: uma etiqueta por canal (a linha do canal, nunca o channel_id do YouTube), expire 0, sem repetir', async () => {
    const { revalidateTag, invalidateObservatory } = await com()
    invalidateObservatory('a', ['a-0', 'a-1', 'a-0'])
    expect(revalidateTag.mock.calls).toEqual([['observatorio:a:a-0', { expire: 0 }], ['observatorio:a:a-1', { expire: 0 }]])
  })
  it.each([[undefined], [null], [[]], ['a-0'], [{ 0: 'a-0' }], [[1, null, '']]])('sem lista, vazia ou fora da forma (%j): o site inteiro, nunca nada', async (lista) => {
    const { revalidateTag, invalidateObservatory } = await com()
    invalidateObservatory('a', lista as never)
    expect(revalidateTag.mock.calls).toEqual([['observatorio:a', { expire: 0 }]])
  })
  it('as etiquetas de um canal: a do site e a do canal', async () => {
    const { tagsDoCanal } = await com()
    expect(tagsDoCanal('a', 'a-0')).toEqual(['observatorio:a', 'observatorio:a:a-0'])
  })
})

describe('etiqueta por canal, com o cache fiel', () => {
  it('invalidar a-0 derruba a entrada de a-0 e deixa a de a-1; a etiqueta do site derruba as duas', async () => {
    const cache = createFakeNextCache()
    vi.doMock('next/cache', () => cache.module)
    const { comChaveFixa, ENTRADAS, tagsDoCanal, invalidateObservatory } = await import('@/lib/youtube/observatorio/cache-tag')
    const ler = (canal: string) => cache.module.unstable_cache(comChaveFixa(ENTRADAS.medidas, async (c: string) => c), [ENTRADAS.medidas, '3'], { tags: tagsDoCanal('a', canal) })(canal)
    await ler('a-0'); await ler('a-1')
    expect(cache.entries.size).toBe(2)
    invalidateObservatory('a', ['a-0'])
    expect(cache.entries.size).toBe(1)
    expect([...cache.entries.values()][0]!.tags).toContain('observatorio:a:a-1')
    await ler('a-0')
    invalidateObservatory('a')
    expect(cache.entries.size).toBe(0)
  })
})

describe('estrutural: todo unstable_cache do Observatório tem chave fixa e etiqueta por canal', () => {
  const SRC = path.resolve(__dirname, '../../../src')
  const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
  const ALVOS = [...files(path.join(SRC, 'lib/youtube/observatorio')), ...files(path.join(SRC, 'app/cms/(authed)/youtube/competitors'))]
    .map(p => ({ file: path.relative(SRC, p), text: readFileSync(p, 'utf8') }))
    .filter(f => f.text.includes('unstable_cache('))
  /** Entradas que não dependem de canal e têm etiqueta própria (a coleta expira a do Observatório a cada 20 min e não pode derrubá-las). */
  const SEM_CANAL: Record<string, string> = {
    'lib/youtube/observatorio/arquivo-mensal/aviso-leve.ts': 'aviso do arquivo: por site, etiqueta arquivo:<site>',
    'app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome.ts': 'sinal do tamanho do banco: por site, etiqueta arquivo-banco:<site>',
  }
  it('a varredura enxerga os usos (o padrão não está morto)', () => {
    expect(ALVOS.map(f => f.file).sort()).toEqual([
      'app/cms/(authed)/youtube/competitors/_chrome/arquivo-do-chrome.ts', 'lib/youtube/observatorio/arquivo-mensal/aviso-leve.ts', 'lib/youtube/observatorio/load-page.ts',
      'lib/youtube/observatorio/medidas-telas/carregar-do-canal.ts', 'lib/youtube/observatorio/medidas-telas/carregar-do-site.ts', 'lib/youtube/observatorio/medidas-telas/carregar-do-video.ts',
    ])
  })
  it('toda ocorrência de unstable_cache( recebe comChaveFixa(ENTRADAS. como 1º argumento (ou o `o.nome` tipado do viaCache)', () => {
    for (const f of ALVOS) {
      const usos = f.text.split('unstable_cache(').slice(1).map(t => t.trimStart())
      for (const u of usos) {
        const ok = u.startsWith('comChaveFixa(ENTRADAS.') || u.startsWith('comChaveFixa(o.nome,')
        expect({ file: f.file, ok, inicio: u.slice(0, 50) }).toEqual({ file: f.file, ok: true, inicio: u.slice(0, 50) })
      }
    }
  })
  it('toda ocorrência declara as etiquetas por tagsDoCanal(; nenhuma usa [observatoryTag( direto (exceções nomeadas, com o porquê)', () => {
    for (const f of ALVOS) {
      expect({ file: f.file, direto: /tags:\s*\[observatoryTag\(/.test(f.text) }).toEqual({ file: f.file, direto: false })
      if (SEM_CANAL[f.file]) continue
      expect({ file: f.file, tagsDoCanal: f.text.includes('tags: tagsDoCanal(') }).toEqual({ file: f.file, tagsDoCanal: true })
    }
  })
  it('as exceções existem e usam a etiqueta própria', () => {
    for (const f of Object.keys(SEM_CANAL)) expect(ALVOS.map(a => a.file)).toContain(f)
  })
})

describe('fake-next-cache estendido', () => {
  const montar = () => {
    const cache = createFakeNextCache()
    let n = 0
    const ler = cache.module.unstable_cache(async () => ({ v: ++n }), ['k'], { tags: ['t'], revalidate: 100 })
    return { cache, ler, vezes: () => n }
  }
  it('descartarProximas(n): o callback roda e devolve, mas nada é guardado; depois volta ao normal', async () => {
    const { cache, ler } = montar()
    cache.descartarProximas(1)
    expect(await ler()).toEqual({ v: 1 })
    expect(cache.entries.size).toBe(0)
    expect(await ler()).toEqual({ v: 2 })
    expect(cache.entries.size).toBe(1)
    expect(await ler()).toEqual({ v: 2 })
  })
  it('atrasarGravacoes(): o set só termina quando o teste manda', async () => {
    const { cache, ler } = montar()
    const liberar = cache.atrasarGravacoes()
    let pronto = false
    const p = ler().then(r => { pronto = true; return r })
    await new Promise(r => setTimeout(r, 5))
    expect(pronto).toBe(false)
    expect(cache.entries.size).toBe(0)
    await liberar()
    expect(await p).toEqual({ v: 1 })
    expect(cache.entries.size).toBe(1)
  })
  it('envelhecer(chave, s): vencida serve a velha e recalcula por trás; recálculo que lança deixa a velha', async () => {
    const { cache, ler, vezes } = montar()
    await ler()
    cache.envelhecer('k', 50)
    expect(await ler()).toEqual({ v: 1 })
    expect(vezes()).toBe(1)
    cache.envelhecer('k', 101)
    expect(await ler()).toEqual({ v: 1 })
    await cache.aguardarRecalculos()
    expect(vezes()).toBe(2)
    expect(await ler()).toEqual({ v: 2 })
    // recálculo que falha
    const falha = createFakeNextCache()
    let ok = true
    const f = falha.module.unstable_cache(async () => { if (!ok) throw new Error('x'); return 'velha' }, ['f'], { revalidate: 10 })
    await f()
    ok = false
    falha.envelhecer('f', 11)
    expect(await f()).toBe('velha')
    await falha.aguardarRecalculos()
    expect(await f()).toBe('velha')
  })
  it('envelhecer numa chave que não existe avisa', () => {
    expect(() => createFakeNextCache().envelhecer('nada', 1)).toThrow(/0 entradas/)
  })
})
