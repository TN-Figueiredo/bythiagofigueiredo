// apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts
/**
 * Manutenção M9, Tarefa 8: o tempo `copiar` no Mac (02 §11.3; D-M9-4, D-M9-6). Lê a versão antiga do NAS pela montagem `ro` (por ssh),
 * filtra o item, serializa em TS, registra pela rota C14 e devolve as cópias para o script. Nunca escreve no NAS: quem grava é o
 * script, rodado pelo dono. Só o ramo de item; a limpeza do canal removido não passa por aqui: é do `obs:arquivo` (M9b, T5).
 */
import { createHash } from 'node:crypto'
import type { Filho } from '../arquivo-mensal/contrato'
import { RespostaAbrir, RespostaRegistrar } from '../arquivo-mensal/expurgo-contrato'
import {
  filtrarUnidade, hashConteudo, idsDeComentarioComRespostas, idsDeComentariosDoVideo, lerUnidadeGz, serializarUnidade, type UnidadeLida,
} from '../arquivo-mensal/expurgo-filtro'
import { refazerResumo } from '../arquivo-mensal/expurgo-resumo'
import type { PendenciaDoDono } from '../arquivo-mensal/pendencias'
import { serializarResumo } from '../arquivo-mensal/resumo'

export const RAIZ_DO_FILHO: Record<Filho, string> = { numerico: '/mnt/arquivo/escrita/numerico', texto: '/mnt/arquivo/escrita/texto' }
export const RAIZ_LEITURA: Record<Filho, string> = { numerico: '/mnt/arquivo/leitura/numerico', texto: '/mnt/arquivo/leitura/texto' }
export const TETO_COPIA_BYTES = 64 * 1024 * 1024
export const TETO_TOTAL_BYTES = 256 * 1024 * 1024

export interface Copia { itemId: string; filho: Filho; caminho: string; sha256: string; base64: string }
export interface CopiaGuardada { sha256: string; filho: Filho; caminho: string }
export interface DepsExpurgo {
  nasMontado(filho: Filho): Promise<boolean>
  lerDoNas(filho: Filho, caminho: string): Promise<Buffer | null>
  /** `corpo` é o `data` do envelope em 200; em erro, `{ motivo: <code> }`. Rede/5xx: lança. */
  site(passo: unknown): Promise<{ status: number; corpo: unknown }>
  agora(): Date
  guardar: {
    ler(sha: string): Promise<Buffer | null>
    /** `meta` vira o índice para reemitir a cópia numa execução seguinte (o `abrir` não devolve alvo já registrado). */
    gravar(sha: string, dados: Buffer, meta: { itemId: string; filho: Filho; caminho: string }): Promise<void>
    /** O `.gz` (nome = sha) e um índice `.json` PENDENTE (sem caminho: ele só vem na resposta), ANTES do `registrar`. */
    gravarDados(sha: string, dados: Buffer, pendente: { itemId: string; filho: Filho }): Promise<void>
    /** Apaga o `.gz` e o índice pendente (registro recusado de vez, ou alvo sem linhas). Nunca toca um índice já completo. */
    apagarDados(sha: string): Promise<void>
    /** Apaga `.tmp`, `.gz` sem `.json` e índice pendente com mais de 24 h (`antesDe` = agora - 24 h). */
    varrer(antesDe: Date): Promise<void>
    daItem(itemId: string): Promise<CopiaGuardada[]>
    /** Itens que têm cópia guardada, para a limpeza (LGPD: comentários de terceiros). */
    itensGuardados(): Promise<string[]>
    /** Apaga `.gz` e `.json` de todas as cópias do item. */
    apagarDoItem(itemId: string): Promise<void>
  }
}
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const vazia: UnidadeLida = { colunas: ['id', 'video_id', 'parent_id'], linhas: [] }

/** Um item que o Mac já registrou e cujo script o dono ainda não rodou: sem_comando por `unidade_no_nas`. */
const aguardaCopia = (i: PendenciaDoDono): boolean => i.tempo === 'sem_comando' && (i.falta === 'unidade_no_nas' || i.falta === 'resumo')
/** Tempos em que a cópia do Mac já cumpriu o papel (ou não vai mais ser usada): ela some do Mac (LGPD). */
const copiaSemUso = (i: PendenciaDoDono | undefined): boolean => i === undefined || i.tempo === 'apagar_antigas' || i.tempo === 'conferir_b2' || i.tempo === 'bloqueado'
/** Em `bloqueado`, a cópia já registrada (índice completo no Mac = alvo em `aguardando_nova` no site) fica: o desbloqueio precisa dela. */

/** `todos` é a lista inteira de pendências (com `--item`, `itens` traz só um; a limpeza precisa ver todos). */
export async function prepararCopias(itens: PendenciaDoDono[], d: DepsExpurgo, tetoTotal: number = TETO_TOTAL_BYTES, todos: PendenciaDoDono[] = itens): Promise<{ copias: Copia[]; avisos: string[]; nasFora: boolean }> {
  const copias: Copia[] = []
  const avisos: string[] = []
  let total = 0
  const montado = new Map<Filho, boolean>()
  const filhoOk = async (f: Filho): Promise<boolean> => { if (!montado.has(f)) montado.set(f, await d.nasMontado(f)); return montado.get(f)! }

  // 0. LGPD: a cópia guardada no Mac some quando o item concluiu (sumiu da lista), ficou bloqueado ou o NAS já a recebeu
  await d.guardar.varrer(new Date(d.agora().getTime() - 24 * 3_600_000))
  for (const id of await d.guardar.itensGuardados()) {
    const it = todos.find(i => i.itemId === id)
    if (!copiaSemUso(it)) continue
    if (it?.tempo === 'bloqueado' && (await d.guardar.daItem(id)).length > 0) continue
    await d.guardar.apagarDoItem(id)
  }

  // 1. reemissão: cópia já registrada e ainda não recebida sai do guardado, sem reler o NAS (o script é idempotente)
  for (const it of itens.filter(i => aguardaCopia(i) && i.itemId.startsWith('item:'))) {
    const guardadas = await d.guardar.daItem(it.itemId)
    if (guardadas.length === 0) {
      avisos.push(`obs:arquivo: ${it.itemId}: o site espera uma cópia e este Mac não a tem guardada (se foi outro computador ou a pasta de cópias sumiu, é "cópia perdida"; runbook)`)
    }
    for (const g of guardadas) {
      const b = await d.guardar.ler(g.sha256)
      if (b === null || sha(b) !== g.sha256) {
        avisos.push(`obs:arquivo: ${it.itemId}: a cópia guardada de ${g.caminho} sumiu ou não bate com o registro; não consigo reemitir (runbook, "alvo bloqueado")`)
        continue
      }
      copias.push({ itemId: it.itemId, filho: g.filho, caminho: g.caminho, sha256: g.sha256, base64: b.toString('base64') })
    }
  }

  // 2. cópia nova
  for (const it of itens.filter(i => i.tempo === 'copiar' && i.itemId.startsWith('item:'))) {
    const pedido = await d.site({ passo: 'abrir', item_id: it.itemId })
    if (pedido.status === 404) { avisos.push(`obs:arquivo: ${it.itemId}: o site não o conhece mais; pulado`); continue }
    if (pedido.status !== 200) {
      avisos.push(`obs:arquivo: ${it.itemId}: o site recusou o pedido (${JSON.stringify((pedido.corpo as { motivo?: string } | null)?.motivo ?? pedido.status)}); pulado`)
      continue
    }
    const aberto = RespostaAbrir.parse(pedido.corpo)
    grupo: for (const g of aberto.grupos) {
      if (!(await filhoOk(g.filho))) { avisos.push('obs:arquivo: NAS fora; nada feito'); return { copias, avisos, nasFora: true } }
      const lidas = new Map<number, UnidadeLida>()
      for (const a of g.alvos) {
        const partes: Buffer[] = []
        for (const f of a.arquivos) {
          const b = await d.lerDoNas(g.filho, f.caminho)
          // a montagem pode cair no meio da execução: "ausente" só vale com ela de pé, medida de novo (como o copiador)
          if (b === null && !(await d.nasMontado(g.filho))) { avisos.push('obs:arquivo: NAS fora; nada feito'); return { copias, avisos, nasFora: true } }
          const motivo = b === null ? 'antiga_ausente' : sha(b) !== f.sha256 ? 'antiga_divergente' : null
          if (motivo) {
            const bl = await d.site({ passo: 'bloquear', item_id: it.itemId, alvo_id: a.alvo_id, motivo })
            avisos.push(`obs:arquivo: ${it.itemId}: ${f.caminho} ${motivo === 'antiga_ausente' ? 'não está no NAS' : 'no NAS não é o registrado'}; ${bl.status === 200 ? 'alvo bloqueado (runbook, "alvo bloqueado")' : 'não consegui bloquear; nada mudou'}`)
            continue grupo
          }
          partes.push(b!)
        }
        const us = partes.map(lerUnidadeGz)
        const lida: UnidadeLida = { colunas: us[0]!.colunas, linhas: us.flatMap(u => u.linhas) }
        if (hashConteudo(lida.linhas) !== a.hash_conteudo) {
          await d.site({ passo: 'bloquear', item_id: it.itemId, alvo_id: a.alvo_id, motivo: 'antiga_divergente' })
          avisos.push(`obs:arquivo: ${it.itemId}: o conteúdo de ${a.tabela} no NAS não bate com o hash registrado; alvo bloqueado`)
          continue grupo
        }
        lidas.set(a.alvo_id, lida)
      }
      // as outras tabelas do mês entram no resumo sem filtro (o item não as toca); o Mac as lê também
      const outras: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }> = []
      for (const o of g.outras) {
        const bs: Buffer[] = []
        for (const f of o.arquivos) {
          const b = await d.lerDoNas(g.filho, f.caminho)
          if (b === null || sha(b) !== f.sha256) { avisos.push(`obs:arquivo: ${it.itemId}: ${f.caminho} (outra tabela do mês) ilegível; grupo pulado`); continue grupo }
          bs.push(b)
        }
        const us = bs.map(lerUnidadeGz)
        outras.push({ tabela: o.tabela, unidade: { colunas: us[0]!.colunas, linhas: us.flatMap(u => u.linhas) }, hashConteudo: o.hash_conteudo })
      }
      const chaves = new Set(g.alvos[0]?.chaves ?? [])
      const kind = it.kind === 'video' ? 'video' : 'comentario'
      const alvoComentarios = g.alvos.find(a => a.tabela === 'competitor_video_comments')
      // comentários ORIGINAIS do mês (antes do filtro): base do conjunto de ids que as marcas do item devem tirar
      const comentariosOriginais = (alvoComentarios ? lidas.get(alvoComentarios.alvo_id) : undefined)
        ?? outras.find(o => o.tabela === 'competitor_video_comments')?.unidade ?? vazia
      const idsParaMarcas = kind === 'video' ? idsDeComentariosDoVideo(comentariosOriginais, chaves) : idsDeComentarioComRespostas(comentariosOriginais, chaves)
      const unidades: Array<{ alvo_id: number; removidas: number; unidade: Record<string, unknown>; ser: ReturnType<typeof serializarUnidade>; tabela: string; filtrada: UnidadeLida }> = []
      for (const a of g.alvos) {
        const marcas = a.tabela === 'competitor_video_comment_marks'
        const r = filtrarUnidade({
          tabela: a.tabela, kind, chaves: marcas && kind === 'comentario' ? idsParaMarcas : chaves, unidade: lidas.get(a.alvo_id)!,
          comentariosDoVideo: kind === 'video' ? idsParaMarcas : undefined,
        })
        if (r.removidas === 0) continue
        const ser = serializarUnidade(r.unidade, a.coluna_controle)
        if (ser.file_bytes > TETO_COPIA_BYTES) {
          await d.site({ passo: 'bloquear', item_id: it.itemId, alvo_id: a.alvo_id, motivo: 'grande_demais' })
          avisos.push(`obs:arquivo: ${it.itemId}: a versão nova de ${a.tabela} passa de 64 MB; alvo bloqueado`)
          continue grupo
        }
        unidades.push({ alvo_id: a.alvo_id, removidas: r.removidas, tabela: a.tabela, ser, filtrada: r.unidade, unidade: {
          row_count: ser.row_count, control_sum: ser.control_sum, hash_conteudo: ser.hash_conteudo, schema_fp: a.schema_fp,
          sha256_bytes: ser.sha256_bytes, csv_sha256: ser.csv_sha256, file_bytes: ser.file_bytes, partes: 1, min_key: null, max_key: null, parts: [] } })
      }
      const bytesDoGrupo = unidades.reduce((s, u) => s + u.ser.file_bytes, 0)
      if (total + bytesDoGrupo > tetoTotal) { avisos.push(`obs:arquivo: ${it.itemId}: teto de 256 MB por execução; o resto fica para a próxima`); continue }
      const versaoResumo = (g.resumo?.versao ?? 0) + 1
      const filtradaDe = (alvo: number): UnidadeLida => unidades.find(u => u.alvo_id === alvo)?.filtrada ?? lidas.get(alvo)!
      const todas = [
        ...g.alvos.map(a => ({ tabela: a.tabela, unidade: filtradaDe(a.alvo_id), hashConteudo: unidades.find(u => u.alvo_id === a.alvo_id)?.ser.hash_conteudo ?? a.hash_conteudo })),
        ...outras]
      const comentariosParaResumo = alvoComentarios ? filtradaDe(alvoComentarios.alvo_id) : outras.find(o => o.tabela === 'competitor_video_comments')?.unidade
      const resumo = serializarResumo(refazerResumo({
        classe: g.classe, canal: g.canal, mes: g.mes, diasDoMes: g.dias_do_mes, versao: versaoResumo,
        unidades: todas, vazias: g.vazias.map(v => ({ tabela: v.tabela, hashConteudo: v.hash_conteudo })), comentarios: comentariosParaResumo }))
      const arq = (p: 'canal' | 'video') => resumo.arquivos.find(x => x.papel === p) ?? null
      // a cópia fica no Mac ANTES do registro: o site só espera cópia que este Mac já tem
      const gzs: string[] = []
      for (const u of unidades) if (u.ser.gz && u.ser.sha256_bytes !== null) { await d.guardar.gravarDados(u.ser.sha256_bytes, u.ser.gz, { itemId: it.itemId, filho: g.filho }); gzs.push(u.ser.sha256_bytes) }
      for (const f of resumo.arquivos) { await d.guardar.gravarDados(f.sha256, f.gz, { itemId: it.itemId, filho: g.filho }); gzs.push(f.sha256) }
      const resp = await d.site({
        passo: 'registrar', item_id: it.itemId, classe: g.classe, canal: g.canal, mes: g.mes,
        alvos: g.alvos.map(a => {
          const u = unidades.find(x => x.alvo_id === a.alvo_id)
          return { alvo_id: a.alvo_id, removidas: u?.removidas ?? 0, unidade: u?.unidade ?? null }
        }),
        resumo: { versao: versaoResumo, vazio: resumo.vazio,
          canal_sha256: arq('canal')?.sha256 ?? null, canal_bytes: arq('canal')?.bytes ?? 0, canal_rows: arq('canal')?.linhas ?? 0,
          video_sha256: arq('video')?.sha256 ?? null, video_bytes: arq('video')?.bytes ?? 0, video_rows: arq('video')?.linhas ?? 0,
          tabelas_lidas: todas.map(u => u.tabela).concat(g.vazias.map(v => v.tabela)).sort() },
      })
      if (resp.status === 409 || resp.status === 404) {
        avisos.push(`obs:arquivo: ${it.itemId} ${g.classe}/${g.mes}: recusado pelo site (${JSON.stringify((resp.corpo as { motivo?: string } | null)?.motivo ?? 'sem motivo')}); sigo com os outros grupos`)
        for (const h of gzs) await d.guardar.apagarDados(h)
        continue
      }
      if (resp.status !== 200) throw new Error(`site_http_${resp.status}`)
      const ok = RespostaRegistrar.parse(resp.corpo)
      if (ok.status === 'recusado') { avisos.push(`obs:arquivo: ${it.itemId} ${g.classe}/${g.mes}: recusado pelo site (${ok.motivo}); sigo com os outros grupos`); for (const h of gzs) await d.guardar.apagarDados(h); continue }
      total += bytesDoGrupo
      const gravados = new Set<string>()
      for (const u of ok.alvos) {
        const x = unidades.find(y => y.alvo_id === u.alvo_id)
        if (!x || !x.ser.gz || x.ser.sha256_bytes === null || u.versao === undefined) continue
        const caminho = `${g.classe}/canais/${g.canal}/${x.tabela}/${g.mes}.v${u.versao}.csv.gz`
        await d.guardar.gravar(x.ser.sha256_bytes, x.ser.gz, { itemId: it.itemId, filho: g.filho, caminho }); gravados.add(x.ser.sha256_bytes)
        copias.push({ itemId: it.itemId, filho: g.filho, caminho, sha256: x.ser.sha256_bytes, base64: x.ser.gz.toString('base64') })
      }
      if (ok.resumo) for (const f of resumo.arquivos) {
        const caminho = `${g.classe}/canais/${g.canal}/resumo/${g.mes}.v${ok.resumo.versao}.${f.papel}.csv.gz`
        await d.guardar.gravar(f.sha256, f.gz, { itemId: it.itemId, filho: g.filho, caminho }); gravados.add(f.sha256)
        copias.push({ itemId: it.itemId, filho: g.filho, caminho, sha256: f.sha256, base64: f.gz.toString('base64') })
      }
      for (const h of gzs) if (!gravados.has(h)) await d.guardar.apagarDados(h)   // sem versão devolvida (sem_linhas): nada a esperar
    }
  }
  return { copias, avisos, nasFora: false }
}
