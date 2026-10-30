// @vitest-environment node
/** M9, Tarefa 8: o tempo `copiar` no Mac, com `DepsExpurgo` falso (nada toca produção, forja ou NAS). `expurgar --canal` ficou para a M9b. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { interpretar, rodar, type DepsDoComando } from '@/lib/youtube/observatorio/arquivo/cli'
import { prepararCopias, TETO_TOTAL_BYTES, type DepsExpurgo, type CopiaGuardada } from '@/lib/youtube/observatorio/arquivo/expurgar'
import { lerUnidadeGz, serializarUnidade, hashConteudo, type UnidadeLida } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro'
import type { PendenciaDoDono } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'
import { baixarFalso, discoFalso, AGORA } from './arquivo-fakes'

const CANAL = '6f1c1b9e-0000-4000-8000-000000000001'
const V1 = 'vidAAAAAAA1', V2 = 'vidBBBBBBB2'
const FP = 'a'.repeat(64)
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const COLS = ['video_id', 'snap_date', 'views', 'likes', 'comments']
const DIARIA: UnidadeLida = { colunas: COLS, linhas: [[V1, '2026-09-01', '5', '1', '0'], [V2, '2026-09-01', '7', '2', '1'], [V1, '2026-09-02', '9', '3', '1']] }
const HORARIA: UnidadeLida = { colunas: ['video_id', 'hour_slot', 'views', 'likes', 'comments'], linhas: [[V1, '2026-09-01 03:00:00+00', '5', '1', '0'], [V2, '2026-09-01 03:00:00+00', '6', '1', '0']] }
const caminhoDe = (t: string, v = 1): string => `serie/canais/${CANAL}/${t}/2026-09.v${v}.csv.gz`

function item(o: Partial<PendenciaDoDono> = {}): PendenciaDoDono {
  return { itemId: 'item:7', kind: 'video', tempo: 'copiar', desde: AGORA, mes: '2026-09', channelRef: CANAL, youtubeId: V1, marcadoRodadoEm: null,
    apagar: [], b2Nomes: [], falta: null, motivo: null, prefixos: [], bloqueados: 0, snapshotMaisAntigo: null, snapEsperaDesde: null, snapLiberaEm: null, snapBloqueio: null, ...o }
}

interface Mundo { nas: Map<string, Buffer>; montado: Record<string, boolean>; passos: Array<Record<string, unknown>>; guardado: Map<string, Buffer>; indice: Array<CopiaGuardada & { itemId: string }>; pendentes: Map<string, string>; varridoAntes: Date | null; deps: DepsExpurgo }
function mundo(o: { unidades?: Record<string, UnidadeLida>; alvosExtra?: boolean; responder?: (p: Record<string, unknown>, n: number) => { status: number; corpo: unknown } } = {}): Mundo {
  const nas = new Map<string, Buffer>()
  const mk = (t: string, u: UnidadeLida) => { const s = serializarUnidade(u, null); nas.set(caminhoDe(t), s.gz!); return { sha: s.sha256_bytes!, hash: s.hash_conteudo } }
  const d = mk('competitor_video_daily', DIARIA), h = mk('competitor_video_hourly', HORARIA)
  const aberto = { grupos: [{ classe: 'serie', canal: CANAL, mes: '2026-09', filho: 'numerico',
    alvos: [{ alvo_id: 11, tabela: 'competitor_video_daily', versao: 1, linhas: 3, soma: null, coluna_controle: null, schema_fp: FP, hash_conteudo: d.hash, esperadas: 2, chaves: [V1],
      refs: [], arquivos: [{ caminho: caminhoDe('competitor_video_daily'), sha256: d.sha, parte: 1 }] }],
    outras: [{ tabela: 'competitor_video_hourly', unidade_id: 12, versao: 1, linhas: 2, hash_conteudo: h.hash, arquivos: [{ caminho: caminhoDe('competitor_video_hourly'), sha256: h.sha, parte: 1 }] }],
    vazias: [], resumo: { versao: 1, canal: null, video: null }, mes_online: true, dias_do_mes: 30 }], esperando: 0 }
  const w: Mundo = { nas, montado: { numerico: true, texto: true }, passos: [], guardado: new Map(), indice: [], pendentes: new Map(), varridoAntes: null, deps: null as unknown as DepsExpurgo }
  let n = 0
  w.deps = {
    nasMontado: async f => w.montado[f]!, lerDoNas: async (_f, c) => nas.get(c) ?? null, agora: () => AGORA,
    site: async passo => {
      const p = passo as Record<string, unknown>; w.passos.push(p); n++
      if (o.responder) return o.responder(p, n)
      if (p.passo === 'abrir') return { status: 200, corpo: aberto }
      if (p.passo === 'registrar') return { status: 200, corpo: { status: 'ok', alvos: [{ alvo_id: 11, estado: 'aguardando_nova', arquivo_id: 'u:6f1c1b9e-0000-4000-8000-0000000000aa', versao: 2 }], resumo: { arquivo_id: 's:6f1c1b9e-0000-4000-8000-0000000000bb', versao: 2 } } }
      return { status: 200, corpo: { status: 'ok' } }
    },
    guardar: {
      ler: async s => w.guardado.get(s) ?? null,
      gravar: async (s, b, m) => { w.guardado.set(s, b); w.pendentes.delete(s); w.indice.push({ sha256: s, ...m }) },
      daItem: async id => w.indice.filter(i => i.itemId === id),
      gravarDados: async (sh, b, p) => { w.guardado.set(sh, b); w.pendentes.set(sh, p.itemId) },
      apagarDados: async sh => { w.guardado.delete(sh); w.pendentes.delete(sh) },
      varrer: async antes => { w.varridoAntes = antes },
      itensGuardados: async () => [...new Set(w.indice.map(i => i.itemId))],
      apagarDoItem: async id => { for (const i of w.indice.filter(x => x.itemId === id)) w.guardado.delete(i.sha256); w.indice = w.indice.filter(x => x.itemId !== id) },
    },
  }
  return w
}
const passosDe = (w: Mundo, nome: string) => w.passos.filter(p => p.passo === nome)

describe('prepararCopias: o tempo copiar', () => {
  it('nas fora: para sem bloquear', async () => {
    const w = mundo(); w.montado.numerico = false
    const r = await prepararCopias([item()], w.deps)
    expect(r.nasFora).toBe(true)
    expect(r.avisos.join('\n')).toContain('NAS fora; nada feito')
    expect(passosDe(w, 'bloquear')).toHaveLength(0)
    expect(passosDe(w, 'registrar')).toHaveLength(0)
  })

  it('copiar: lê, filtra, registra e devolve a cópia (unidade e resumo)', async () => {
    const w = mundo()
    const r = await prepararCopias([item()], w.deps)
    const reg = passosDe(w, 'registrar')[0] as { alvos: Array<{ removidas: number; unidade: { row_count: number; hash_conteudo: string; sha256_bytes: string } }>; resumo: Record<string, unknown> }
    const ficam = [[V2, '2026-09-01', '7', '2', '1']]
    expect(reg.alvos[0]!.removidas).toBe(2)
    expect(reg.alvos[0]!.unidade.row_count).toBe(1)
    expect(reg.alvos[0]!.unidade.hash_conteudo).toBe(hashConteudo(ficam))
    expect(reg.resumo.versao).toBe(2)                                              // resumo.versao do abrir + 1
    expect(reg.resumo.tabelas_lidas).toEqual(['competitor_video_daily', 'competitor_video_hourly'])   // alvo e outras
    expect(r.copias.map(c => c.caminho)).toEqual([
      caminhoDe('competitor_video_daily', 2),
      `serie/canais/${CANAL}/resumo/2026-09.v2.canal.csv.gz`,
      `serie/canais/${CANAL}/resumo/2026-09.v2.video.csv.gz`,
    ])
    const u = r.copias[0]!
    expect(sha(Buffer.from(u.base64, 'base64'))).toBe(u.sha256)
    expect(u.sha256).toBe(reg.alvos[0]!.unidade.sha256_bytes)
    expect(lerUnidadeGz(Buffer.from(u.base64, 'base64')).linhas).toEqual(ficam)
    for (const c of r.copias.slice(1)) expect(sha(Buffer.from(c.base64, 'base64'))).toBe(c.sha256)
    expect(reg.resumo.canal_sha256).toBe(r.copias[1]!.sha256)
    expect(reg.resumo.video_sha256).toBe(r.copias[2]!.sha256)
  })

  it('resumo com as outras tabelas: as linhas da horária entram sem filtro', async () => {
    const w = mundo()
    const r = await prepararCopias([item()], w.deps)
    const canal = gunzipSync(Buffer.from(r.copias[1]!.base64, 'base64')).toString('utf8')
    expect(canal).toContain('competitor_video_hourly')
    expect(canal).toMatch(/competitor_video_hourly,2026-09,2,2,/)     // 2 vídeos, 2 linhas: a horária não foi tocada
  })

  it('sha diferente bloqueia', async () => {
    const w = mundo(); w.nas.set(caminhoDe('competitor_video_daily'), Buffer.from('outra coisa'))
    const r = await prepararCopias([item()], w.deps)
    expect(passosDe(w, 'bloquear')[0]).toMatchObject({ motivo: 'antiga_divergente', alvo_id: 11 })
    expect(r.copias).toHaveLength(0)
    expect(r.avisos).toHaveLength(1)
  })

  it('hash de conteúdo diferente bloqueia', async () => {
    const w = mundo()
    const orig = w.deps.site
    w.deps.site = async p => { const r = await orig(p); if ((p as { passo: string }).passo === 'abrir') (r.corpo as { grupos: Array<{ alvos: Array<{ hash_conteudo: string }> }> }).grupos[0]!.alvos[0]!.hash_conteudo = 'b'.repeat(64); return r }
    const r = await prepararCopias([item()], w.deps)
    expect(passosDe(w, 'bloquear')[0]).toMatchObject({ motivo: 'antiga_divergente' })
    expect(r.copias).toHaveLength(0)
  })

  it('ausente bloqueia (NAS montado)', async () => {
    const w = mundo(); w.nas.delete(caminhoDe('competitor_video_daily'))
    await prepararCopias([item()], w.deps)
    expect(passosDe(w, 'bloquear')[0]).toMatchObject({ motivo: 'antiga_ausente', alvo_id: 11 })
  })

  it('grupo sem linhas do item: removidas 0, unidade nula, nenhuma cópia de unidade', async () => {
    const w = mundo()
    const orig = w.deps.site
    w.deps.site = async p => {
      const r = await orig(p)
      if ((p as { passo: string }).passo === 'abrir') (r.corpo as { grupos: Array<{ alvos: Array<{ chaves: string[] }> }> }).grupos[0]!.alvos[0]!.chaves = ['naoExiste']
      if ((p as { passo: string }).passo === 'registrar') return { status: 200, corpo: { status: 'ok', alvos: [{ alvo_id: 11, estado: 'sem_linhas' }], resumo: null } }
      return r
    }
    const r = await prepararCopias([item({ youtubeId: 'naoExiste' })], w.deps)
    const reg = passosDe(w, 'registrar')[0] as { alvos: Array<{ removidas: number; unidade: unknown }> }
    expect(reg.alvos).toEqual([{ alvo_id: 11, removidas: 0, unidade: null }])
    expect(r.copias).toHaveLength(0)
  })

  it('recusa de um grupo não derruba os outros', async () => {
    const w = mundo()
    const orig = w.deps.site
    let abertos = 0
    w.deps.site = async p => {
      const q = p as { passo: string }
      if (q.passo === 'abrir') {
        const r = await orig(p); const g = (r.corpo as { grupos: unknown[] }).grupos
        abertos++
        const g2 = structuredClone(g[0]) as { mes: string }; g2.mes = '2026-09'
        ;(r.corpo as { grupos: unknown[] }).grupos = [g[0], g2]
        return r
      }
      if (q.passo === 'registrar' && w.passos.filter(x => x.passo === 'registrar').length === 0) { w.passos.push(p as Record<string, unknown>); return { status: 409, corpo: { motivo: 'base_mudou' } } }
      return orig(p)
    }
    const r = await prepararCopias([item()], w.deps)
    expect(abertos).toBe(1)
    expect(passosDe(w, 'registrar')).toHaveLength(2)
    expect(r.copias.length).toBeGreaterThan(0)
    expect(r.avisos.join('\n')).toContain('base_mudou')
  })

  it('rota fora não deixa meio registro: lança e nenhuma cópia sai', async () => {
    const w = mundo()
    const orig = w.deps.site
    w.deps.site = async p => { if ((p as { passo: string }).passo === 'registrar') throw new TypeError('fetch failed'); return orig(p) }
    await expect(prepararCopias([item()], w.deps)).rejects.toThrow()
    expect(w.guardado.size).toBe(3)                                               // a cópia já estava no Mac antes do registro (resposta perdida não a perde)
    expect(w.indice).toHaveLength(0)
  })

  it('resposta do registrar perdida: a execução seguinte avisa em voz alta (nunca silêncio)', async () => {
    const w = mundo()
    const r = await prepararCopias([item({ tempo: 'sem_comando', falta: 'unidade_no_nas' })], w.deps)
    expect(r.copias).toHaveLength(0)
    expect(r.avisos.join('\n')).toContain('este Mac não a tem guardada')
  })

  it('registro recusado de vez: o .gz solto é apagado', async () => {
    const w2 = mundo()
    const orig = w2.deps.site
    w2.deps.site = async p => (p as { passo: string }).passo === 'registrar' ? { status: 409, corpo: { motivo: 'base_mudou' } } : orig(p)
    await prepararCopias([item()], w2.deps)
    expect(w2.guardado.size).toBe(0)
  })

  it('resumo: a falta resumo também reemite as cópias guardadas', async () => {
    const w = mundo()
    await prepararCopias([item()], w.deps)
    w.nas.clear()
    const r = await prepararCopias([item({ tempo: 'sem_comando', falta: 'resumo' })], w.deps)
    expect(r.copias).toHaveLength(3)
  })

  it('montagem que cai no meio: arquivo ausente com a montagem caída = NAS fora, sem bloquear', async () => {
    const w = mundo(); w.nas.delete(caminhoDe('competitor_video_daily'))
    let n = 0
    w.deps.nasMontado = async () => ++n === 1
    const r = await prepararCopias([item()], w.deps)
    expect(r.nasFora).toBe(true)
    expect(passosDe(w, 'bloquear')).toHaveLength(0)
  })

  it('bloquear recusado pelo site: o aviso não diz que bloqueou', async () => {
    const w = mundo(); w.nas.set(caminhoDe('competitor_video_daily'), Buffer.from('outra coisa'))
    const orig = w.deps.site
    w.deps.site = async p => (p as { passo: string }).passo === 'bloquear' ? { status: 409, corpo: { motivo: 'alvo_fora_de_copiar' } } : orig(p)
    const r = await prepararCopias([item()], w.deps)
    expect(r.avisos.join('\n')).toContain('não consegui bloquear')
  })

  it('LGPD: a cópia guardada some quando o item conclui ou o NAS já a recebeu; fica enquanto espera', async () => {
    const w = mundo()
    await prepararCopias([item()], w.deps)
    expect(w.guardado.size).toBe(3)
    await prepararCopias([item({ tempo: 'sem_comando', falta: 'unidade_no_nas' })], w.deps)
    expect(w.guardado.size).toBe(3)                                               // ainda espera o NAS
    const w2 = mundo(); await prepararCopias([item()], w2.deps)
    await prepararCopias([], w2.deps)                                             // item concluído: sumiu da lista
    expect(w2.guardado.size).toBe(0)
    const w3 = mundo(); await prepararCopias([item()], w3.deps)
    await prepararCopias([item({ tempo: 'apagar_antigas' })], w3.deps)
    expect(w3.guardado.size).toBe(0)
  })

  it('bloqueado: com cópia já registrada (aguardando_nova) o Mac a mantém; sem ela, apaga', async () => {
    const w = mundo(); await prepararCopias([item()], w.deps)
    expect(w.guardado.size).toBe(3)
    await prepararCopias([item({ tempo: 'bloqueado', motivo: 'antiga_divergente' })], w.deps)
    expect(w.guardado.size).toBe(3)                                               // o desbloqueio precisa dela
    await prepararCopias([item({ tempo: 'apagar_antigas' })], w.deps)
    expect(w.guardado.size).toBe(0)
    // sem alvo aguardando: só sobrou o pendente de um registro que não saiu; bloqueado apaga
    const w2 = mundo(); w2.pendentes.set('f'.repeat(64), 'item:7'); w2.guardado.set('f'.repeat(64), Buffer.from('x'))
    w2.deps.guardar.itensGuardados = async () => ['item:7']
    w2.deps.guardar.apagarDoItem = async () => { w2.guardado.clear() }
    await prepararCopias([item({ tempo: 'bloqueado', motivo: 'antiga_divergente' })], w2.deps)
    expect(w2.guardado.size).toBe(0)
  })

  it('o índice entra antes do registrar (pendente) e a varredura de 24 h roda a cada execução', async () => {
    const w = mundo()
    let pendentesNoRegistrar = 0
    const orig = w.deps.site
    w.deps.site = async p => { if ((p as { passo: string }).passo === 'registrar') pendentesNoRegistrar = w.pendentes.size; return orig(p) }
    await prepararCopias([item()], w.deps)
    expect(pendentesNoRegistrar).toBe(3)
    expect(w.pendentes.size).toBe(0)                                              // completos pelo gravar
    expect(w.varridoAntes!.getTime()).toBe(AGORA.getTime() - 24 * 3_600_000)
  })

  it('LGPD com --item: os outros itens da lista inteira não perdem a cópia', async () => {
    const w = mundo(); await prepararCopias([item()], w.deps)
    await prepararCopias([item({ itemId: 'item:8' })], w.deps, undefined, [item({ tempo: 'sem_comando', falta: 'unidade_no_nas' }), item({ itemId: 'item:8' })])
    expect(w.guardado.size).toBe(3)
  })

  it('cópia guardada é reemitida (unidade_no_nas) sem reler o NAS; sumida: aviso e nada', async () => {
    const w = mundo()
    const ja = await prepararCopias([item()], w.deps)
    expect(ja.copias).toHaveLength(3)
    w.nas.clear()                                                                 // o NAS não é mais lido
    const esperando = item({ tempo: 'sem_comando', falta: 'unidade_no_nas' })
    const r = await prepararCopias([esperando], w.deps)
    expect(r.copias.map(c => c.caminho)).toEqual(ja.copias.map(c => c.caminho))
    expect(r.copias[0]!.sha256).toBe(ja.copias[0]!.sha256)
    w.guardado.delete(ja.copias[0]!.sha256)
    const r2 = await prepararCopias([esperando], w.deps)
    expect(r2.copias).toHaveLength(2)
    expect(r2.avisos.join('\n')).toContain('não consigo reemitir')
  })

  it('teto total: o grupo que estoura fica para a próxima, com aviso', async () => {
    const w = mundo()
    expect(TETO_TOTAL_BYTES).toBe(256 * 1024 * 1024)
    // teto de 1 byte: nenhum grupo cabe; nada é registrado
    const r = await prepararCopias([item()], w.deps, 1)
    expect(r.copias).toHaveLength(0)
    expect(passosDe(w, 'registrar')).toHaveLength(0)
    expect(r.avisos.join('\n')).toContain('teto de 256 MB')
  })

  it('só tempo copiar e item:<n> entram', async () => {
    const w = mundo()
    await prepararCopias([item({ tempo: 'apagar_antigas', apagar: [{ filho: 'numerico', caminho: 'x/y', sha256: FP, nova: null }] }), item({ itemId: 'canal:' + CANAL, kind: 'canal' })], w.deps)
    expect(w.passos).toHaveLength(0)
  })
})

describe('marcas dos comentários', () => {
  it('video: as marcas dos comentários do vídeo saem; as de outros ficam', async () => {
    const CC = ['id', 'video_id', 'parent_id', 'first_seen_at']
    const coment: UnidadeLida = { colunas: CC, linhas: [['c1', V1, null, '2026-09-01 03:00:00+00'], ['c2', V2, null, '2026-09-01 03:00:00+00'], ['c3', V1, 'c1', '2026-09-02 03:00:00+00']] }
    const marcas: UnidadeLida = { colunas: ['comment_id', 'marca'], linhas: [['c1', 'x'], ['c2', 'y'], ['c3', 'z']] }
    const nas = new Map<string, Buffer>()
    const mk = (t: string, u: UnidadeLida) => { const s = serializarUnidade(u, null); nas.set(`texto/canais/${CANAL}/${t}/2026-09.v1.csv.gz`, s.gz!); return { caminho: `texto/canais/${CANAL}/${t}/2026-09.v1.csv.gz`, sha256: s.sha256_bytes!, hash: s.hash_conteudo } }
    const c = mk('competitor_video_comments', coment), m = mk('competitor_video_comment_marks', marcas)
    const alvo = (id: number, t: string, x: { caminho: string; sha256: string; hash: string }) => ({ alvo_id: id, tabela: t, versao: 1, linhas: 3, soma: null, coluna_controle: null, schema_fp: FP, hash_conteudo: x.hash, esperadas: null, chaves: [V1], refs: [], arquivos: [{ caminho: x.caminho, sha256: x.sha256, parte: 1 }] })
    const w = mundo({ responder: (p) => p.passo === 'abrir'
      ? { status: 200, corpo: { grupos: [{ classe: 'texto', canal: CANAL, mes: '2026-09', filho: 'texto', alvos: [alvo(21, 'competitor_video_comments', c), alvo(22, 'competitor_video_comment_marks', m)], outras: [], vazias: [], resumo: null, mes_online: true, dias_do_mes: 30 }], esperando: 0 } }
      : { status: 200, corpo: { status: 'ok', alvos: [], resumo: null } } })
    w.deps.lerDoNas = async (_f, cam) => nas.get(cam) ?? null
    await prepararCopias([item()], w.deps)
    const reg = passosDe(w, 'registrar')[0] as { alvos: Array<{ alvo_id: number; removidas: number }> }
    expect(reg.alvos).toEqual([expect.objectContaining({ alvo_id: 21, removidas: 2 }), expect.objectContaining({ alvo_id: 22, removidas: 2 })])
  })

  it('comentario: a marca da resposta do comentário também sai (idsDeComentarioComRespostas)', async () => {
    const CC = ['id', 'video_id', 'parent_id', 'first_seen_at']
    const coment: UnidadeLida = { colunas: CC, linhas: [['c1', V1, null, '2026-09-01 03:00:00+00'], ['c2', V1, null, '2026-09-01 03:00:00+00'], ['c3', V1, 'c1', '2026-09-02 03:00:00+00']] }
    const marcas: UnidadeLida = { colunas: ['comment_id', 'marca'], linhas: [['c1', 'x'], ['c2', 'y'], ['c3', 'z']] }
    const nas = new Map<string, Buffer>()
    const mk = (t: string, u: UnidadeLida) => { const s = serializarUnidade(u, null); const caminho = `texto/canais/${CANAL}/${t}/2026-09.v1.csv.gz`; nas.set(caminho, s.gz!); return { caminho, sha256: s.sha256_bytes!, hash: s.hash_conteudo } }
    const c = mk('competitor_video_comments', coment), m = mk('competitor_video_comment_marks', marcas)
    const alvo = (id: number, t: string, x: { caminho: string; sha256: string; hash: string }) => ({ alvo_id: id, tabela: t, versao: 1, linhas: 3, soma: null, coluna_controle: null, schema_fp: FP, hash_conteudo: x.hash, esperadas: null, chaves: ['c1'], refs: [], arquivos: [{ caminho: x.caminho, sha256: x.sha256, parte: 1 }] })
    const w = mundo({ responder: (p) => p.passo === 'abrir'
      ? { status: 200, corpo: { grupos: [{ classe: 'texto', canal: CANAL, mes: '2026-09', filho: 'texto', alvos: [alvo(21, 'competitor_video_comments', c), alvo(22, 'competitor_video_comment_marks', m)], outras: [], vazias: [], resumo: null, mes_online: true, dias_do_mes: 30 }], esperando: 0 } }
      : { status: 200, corpo: { status: 'ok', alvos: [], resumo: null } } })
    w.deps.lerDoNas = async (_f, cam) => nas.get(cam) ?? null
    await prepararCopias([item({ kind: 'comentario' })], w.deps)
    const reg = passosDe(w, 'registrar')[0] as { alvos: Array<{ alvo_id: number; removidas: number }> }
    expect(reg.alvos.find(a => a.alvo_id === 21)!.removidas).toBe(2)   // c1 e a resposta c3
    expect(reg.alvos.find(a => a.alvo_id === 22)!.removidas).toBe(2)   // marcas de c1 e de c3
  })
})

describe('expurgar --item no cli', () => {
  const env = { HOME: '/h' }
  it('interpretar: --item numérico; --canal fica para a M9b; sem --item é erro', () => {
    expect(interpretar(['expurgar', '--item', '7'], env)).toEqual({ nome: 'expurgar', item: '7', apagarAntigas: false })
    expect(interpretar(['expurgar', '--item', '7', '--apagar-antigas'], env)).toEqual({ nome: 'expurgar', item: '7', apagarAntigas: true })
    expect(interpretar(['expurgar', '--canal', CANAL], env)).toEqual({ erro: expect.stringContaining('M9b') })
    expect(interpretar(['expurgar', '--apagar-antigas'], env)).toEqual({ erro: expect.stringContaining('--item') })
    expect(interpretar(['expurgar', '--item', 'abc'], env)).toEqual({ erro: expect.stringContaining('--item') })
    expect(interpretar(['expurgar', '--item', '0'], env)).toEqual({ erro: expect.stringContaining('--item') })
  })

  it('obs:expurgar existe no package.json e interpretar entende o comando sem o prefixo pendencias', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../../../package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['obs:expurgar']).toMatch(/scripts\/obs-arquivo\.ts expurgar$/)
    expect(interpretar(['expurgar', '--item', '5'], env)).toEqual({ nome: 'expurgar', item: '5', apagarAntigas: false })
    expect(interpretar(['pendencias', 'expurgar', '--item', '5'], env)).toHaveProperty('erro')
  })

  const pendente = (o: Record<string, unknown>) => ({ item_id: 'item:7', kind: 'video', tempo: 'sem_comando', desde: '2026-10-01T12:00:00Z', mes: '2026-09', channel_ref: CANAL, youtube_id: V1,
    marcado_rodado_em: null, apagar: [], b2_nomes: [], falta: 'resumo', motivo: null, prefixos: [], bloqueados: 0, snapshot_mais_antigo: null, ...o })
  const deps = (itens: unknown[], expurgo?: DepsExpurgo): DepsDoComando => ({ sql: null, disco: discoFalso().disco, baixar: baixarFalso().baixar, agora: () => AGORA, ehTerminal: false,
    perguntar: async () => { throw new Error('não pergunta') }, versaoDoScript: 'teste', expurgo,
    pedirPendencias: async () => ({ status: 200, corpo: JSON.stringify({ data: { versao: 2, lido_em: '2026-12-01T10:00:00Z', total: itens.length, itens } }) }) })

  it('--apagar-antigas fora de apagar_antigas/conferir_b2: recusa com a frase do tempo atual', async () => {
    const r = await rodar({ nome: 'expurgar', item: '7', apagarAntigas: true }, deps([pendente({})]))
    expect(r.codigo).toBe(1)
    expect(r.erros![0]).toContain('item:7')
    expect(r.erros![0]).toContain('ainda não há comando liberado')
    expect(r.saida.join('\n')).not.toContain('apaga_conferido')
  })

  it('item fora da lista: código 1 e frase', async () => {
    const r = await rodar({ nome: 'expurgar', item: '9', apagarAntigas: false }, deps([pendente({})]))
    expect(r.codigo).toBe(1)
    expect(r.erros![0]).toContain('item:9')
  })

  it('--item: o script leva só o item pedido e as cópias registradas viram grava_recebendo', async () => {
    const w = mundo()
    let leituras = 0
    const d: DepsDoComando = { ...deps([]), pedirPendencias: async () => {
      leituras++
      const itens = leituras === 1
        ? [pendente({ tempo: 'copiar', falta: null }), pendente({ item_id: 'item:8', youtube_id: V2 })]
        : [pendente({ falta: 'unidade_no_nas' }), pendente({ item_id: 'item:8', youtube_id: V2 })]
      return { status: 200, corpo: JSON.stringify({ data: { versao: 2, lido_em: '2026-12-01T10:00:00Z', total: itens.length, itens } }) }
    }, expurgo: w.deps }
    const r = await rodar({ nome: 'expurgar', item: '7', apagarAntigas: false }, d)
    expect(r.codigo).toBe(0)
    expect(leituras).toBe(2)                                  // lê, prepara, lê de novo (D-F23)
    const s = r.saida.join('\n')
    expect(s).toContain("grava_recebendo 'numerico'")
    expect(s).toContain('2026-09.v2.csv.gz')
    expect(s).not.toContain('item:8')
  })

  it('pendencias sem expurgo continua como antes: copiar vira ESPERA-COPIA', async () => {
    const r = await rodar({ nome: 'pendencias' }, deps([pendente({ tempo: 'copiar', falta: null })]))
    expect(r.saida.join('\n')).toContain('ESPERA-COPIA item:7')
  })
})
