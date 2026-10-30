// apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts
/**
 * Manutenção M3b, emenda de 14/10 (peça 7): o leitor puro da leitura C12 (`obs_archive_owner_pending`), usado pela página e pelo comando
 * `npm run -s obs:arquivo`. Puro: só `zod` e o contrato; o `tsx` da raiz o importa. Estrito de propósito: qualquer desvio da forma é
 * `{ ok: false }`, que a tela mostra como "não medido" e o comando trata como erro, nunca como "nada pendente" (o sistema falha em verde).
 * Os caminhos de `apagar` viram argumento de `rm` na forja: nada vindo do banco vira pedaço de comando sem passar por aqui.
 */
import { z } from 'zod'
import { MES_RE, SHA_RE, UUID_RE, type Filho } from './contrato'

export const LINHA_DO_DONO = "cd ~/Workspace/bythiagofigueiredo && npm run -s obs:arquivo | ssh forja 'bash -s'"
export const VERSAO_PENDENCIAS = 2

export const TEMPOS_PENDENCIA = ['sem_comando', 'copiar', 'conferir_b2', 'apagar_antigas', 'bloqueado'] as const
export type TempoPendencia = (typeof TEMPOS_PENDENCIA)[number]
export const FALTAS = ['unidade_no_nas', 'resumo', 'manifesto', 'b2_nova', 'versao_em_curso', 'segunda_conferencia', 'snapshots', 'conferencia_nas_recente', 'b2_sync', 'blobs', 'imagens', 'lote_e10', 'so_prefixo', 'm9_desligado'] as const
export type Falta = (typeof FALTAS)[number]
export const MOTIVOS = ['antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente'] as const
export type Motivo = (typeof MOTIVOS)[number]
const KINDS = ['canal', 'video', 'comentario', 'versao'] as const
// O nome do B2 vai a uma linha de shell na forja: alfabeto seguro e sem "..".
const NOME_B2 = /^[A-Za-z0-9._/-]{1,600}$/

// Sem "..", sem "." isolado, sem "/" no começo nem no fim, sem "//" (outro nome do mesmo arquivo), sem aspas, espaço, "$" ou crase.
export const CAMINHO_SEGURO = /^(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)(?!.*\/$)[A-Za-z0-9_][A-Za-z0-9._/-]{0,299}$/
const ITEM_ID_RE = /^(?:canal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|item:[1-9][0-9]{0,18}|antiga:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const data = z.string().datetime({ offset: true })
const caminho = z.string().regex(CAMINHO_SEGURO)
const FILHOS = ['numerico', 'texto'] as const satisfies readonly Filho[]
const filho = z.enum(FILHOS)

const Apagar = z.object({
  filho, caminho, sha256: z.string().regex(SHA_RE),
  nova: z.object({ caminho, sha256: z.string().regex(SHA_RE) }).strict().nullable(),
}).strict().superRefine((a, ctx) => {
  // versao 2 (M9): `nova` nulo é aceito (arquivo sem versão nova a exigir, ex.: canal removido); o script pula a exigência.
  if (a.nova !== null && a.nova.caminho === a.caminho) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a antiga é a própria nova' })
})

export const SNAP_BLOQUEIOS = ['ilegivel', 'lista_vazia', 'fora_do_padrao', 'mtime_diverge', 'relogio', 'retido'] as const
export type SnapBloqueio = (typeof SNAP_BLOQUEIOS)[number]

/** Motivo e ação por bloqueio (M9-snap, passo 5; revisão 29/10): o que o dono lê quando a espera por snapshot não termina sozinha. */
export const MOTIVO_SNAP_EM_PALAVRAS: Record<SnapBloqueio, string> = {
  fora_do_padrao: 'há um snapshot manual ou de outra tarefa',
  retido: 'um snapshot de antes da remoção não expira (bloqueio ou retenção maior que 14 dias)',
  lista_vazia: 'a forja não vê nenhum snapshot',
  mtime_diverge: 'a data gravada nos snapshots não bate com o nome deles',
  relogio: 'o relógio da forja ou do NAS está errado',
  ilegivel: 'a última leitura da lista falhou',
}
export const ACAO_SNAP: Record<SnapBloqueio, string> = {
  fora_do_padrao: 'decida se apaga esse snapshot',
  retido: 'procure e retire o bloqueio ou a retenção',
  lista_vazia: 'confira a tarefa de snapshot no NAS',
  mtime_diverge: 'confira os snapshots no NAS',
  relogio: 'confira a hora da forja e a do NAS',
  ilegivel: 'nenhuma',
}
const CAUDA_SNAP = 'Detalhe: runbook, seção Snapshots por tempo.'
/** A frase âmbar do ramo (b). Nunca diz "libera DD/MM". `ilegivel` não passa por aqui (é espera neutra). */
export const fraseSnapBloqueado = (b: SnapBloqueio): string => `Atenção: os snapshots do NAS não liberam sozinhos: ${MOTIVO_SNAP_EM_PALAVRAS[b]}. O que fazer: ${ACAO_SNAP[b]}. ${CAUDA_SNAP}`

/**
 * A frase da espera por snapshot (tela e script do Mac dizem o mesmo). O bloqueio vem primeiro (nunca escondido por falta de data).
 * `passou`: a data de liberar já passou; `atrasada`: passou há mais de 24 h. Data no passado nunca aparece como "libera".
 */
export function fraseSnapEspera(a: { bloqueio: SnapBloqueio | null; esperaDesde: Date | null; liberaEm: Date | null; passou: boolean; atrasada: boolean }, dm: (d: Date) => string): { ambar: boolean; texto: string } {
  if (a.bloqueio && a.bloqueio !== 'ilegivel') return { ambar: true, texto: fraseSnapBloqueado(a.bloqueio) }
  if (a.liberaEm && a.atrasada && !a.bloqueio) return { ambar: true, texto: `Atenção: o prazo dos snapshots do NAS (${dm(a.liberaEm)}) passou; aguarda a próxima conferência da forja. Se passar de 2 dias, veja se a rotina da forja está rodando.` }
  const desde = a.esperaDesde ? ` desde ${dm(a.esperaDesde)}` : ''
  if (a.bloqueio === 'ilegivel') return { ambar: false, texto: `Aguardando os snapshots do NAS${desde}; a última leitura da lista falhou e a próxima rodada tenta de novo. Nada a fazer até lá.` }
  if (!a.esperaDesde && !a.liberaEm) return { ambar: false, texto: 'Aguardando os snapshots do NAS.' }
  const libera = !a.liberaEm ? '' : a.passou ? '; deve liberar na próxima verificação da forja' : `; o comando libera por volta de ${dm(a.liberaEm)}`
  return { ambar: false, texto: `Aguardando os snapshots do NAS${desde}${libera}. Nada a fazer até lá.` }
}

const Item = z.object({
  item_id: z.string().regex(ITEM_ID_RE),
  kind: z.enum(KINDS),
  tempo: z.enum(TEMPOS_PENDENCIA),
  desde: data,
  mes: z.string().regex(MES_RE).nullable(),
  channel_ref: z.string().regex(UUID_RE).nullable(),
  youtube_id: z.string().regex(YOUTUBE_ID_RE).nullable(),
  marcado_rodado_em: data.nullable(),
  apagar: z.array(Apagar),
  b2_nomes: z.array(z.string().regex(NOME_B2).refine(n => !n.includes('..'), 'nome de B2 com ..')),
  falta: z.enum(FALTAS).nullable(),
  motivo: z.enum(MOTIVOS).nullable(),
  prefixos: z.array(caminho).max(2000),
  bloqueados: z.number().int().min(0),
  snapshot_mais_antigo: z.string().nullable(),
  // M9-snap: opcionais porque o código vai ao ar ANTES da migration (o leitor é .strict()); ausentes = sem espera por snapshot
  snap_espera_desde: data.nullable().optional(),
  snap_libera_em: data.nullable().optional(),
  snap_bloqueio: z.enum(SNAP_BLOQUEIOS).nullable().optional(),
}).strict().superRefine((i, ctx) => {
  const falha = (message: string): void => { ctx.addIssue({ code: z.ZodIssueCode.custom, message }) }
  if ((i.apagar.length > 0) !== (i.tempo === 'apagar_antigas')) falha('apagar só existe em apagar_antigas, e lá não é vazio')
  if ((i.b2_nomes.length > 0) !== (i.tempo === 'conferir_b2')) falha('b2_nomes só existe em conferir_b2, e lá não é vazio')
  if (i.falta !== null && i.tempo !== 'sem_comando') falha('falta só em sem_comando')
  if ((i.motivo !== null) !== (i.tempo === 'bloqueado')) falha('motivo só em bloqueado, e lá obrigatório')
  const deCanal = i.item_id.startsWith('canal:')
  if (deCanal !== (i.kind === 'canal')) falha('kind canal se e só se item_id começa por canal:')
  if (deCanal && i.item_id.slice('canal:'.length) !== i.channel_ref) falha('canal:<uuid> diferente de channel_ref')
  if (i.item_id.startsWith('antiga:') !== (i.kind === 'versao')) falha('kind versao se e só se item_id começa por antiga:')
  if (i.prefixos.length > 0 && !deCanal) falha('prefixos só em canal')
  if (deCanal && i.channel_ref) {
    // o script apaga o que o site manda: em canal:<ref>, nada fora de <classe>/canais/<ref> (formato de obs_archive_caminho_unidade e de removal_open_rows)
    const alvo = new RegExp(`^[a-z_]+/canais/${i.channel_ref}$`)
    if (i.prefixos.some(p => !alvo.test(p))) falha('prefixo fora de <classe>/canais/<canal>')
    if (i.apagar.some(a => !new RegExp(`^[a-z_]+/canais/${i.channel_ref}/`).test(a.caminho))) falha('apagar fora de <classe>/canais/<canal>/')
  }
})

const Corpo = z.object({ versao: z.literal(VERSAO_PENDENCIAS), lido_em: data, total: z.number().int().nonnegative(), itens: z.array(Item) })
  .strict().superRefine((c, ctx) => {
    if (c.total !== c.itens.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'total diferente do tamanho da lista' })
    const novas = new Set<string>(), antigas: string[] = []
    for (const i of c.itens) for (const a of i.apagar) { antigas.push(`${a.filho}/${a.caminho}`); if (a.nova) novas.add(`${a.filho}/${a.nova.caminho}`) }
    if (antigas.some(a => novas.has(a))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'uma antiga a apagar é a nova de outra' })
  })

export interface PendenciaDoDono {
  itemId: string
  kind: (typeof KINDS)[number]
  tempo: TempoPendencia
  desde: Date
  mes: string | null
  channelRef: string | null
  youtubeId: string | null
  marcadoRodadoEm: Date | null
  apagar: Array<{ filho: Filho; caminho: string; sha256: string; nova: { caminho: string; sha256: string } | null }>
  b2Nomes: string[]
  falta: Falta | null
  motivo: Motivo | null
  prefixos: string[]
  bloqueados: number
  snapshotMaisAntigo: string | null
  snapEsperaDesde: Date | null
  snapLiberaEm: Date | null
  snapBloqueio: SnapBloqueio | null
}
export type LeituraPendencias = { ok: true; lidoEm: Date; itens: PendenciaDoDono[] } | { ok: false; porque: string }

/** Lê a resposta do C12. Nunca devolve lista vazia no lugar de um erro. A razão da recusa não repete o valor recebido. */
export function lerPendencias(bruto: unknown): LeituraPendencias {
  const r = Corpo.safeParse(bruto)
  if (!r.success) {
    const e = r.error.issues[0]
    return { ok: false, porque: e ? `${e.path.join('.') || 'corpo'}: ${e.message}` : 'forma inválida' }
  }
  return {
    ok: true, lidoEm: new Date(r.data.lido_em),
    itens: r.data.itens.map(i => ({
      itemId: i.item_id, kind: i.kind, tempo: i.tempo, desde: new Date(i.desde), mes: i.mes, channelRef: i.channel_ref, youtubeId: i.youtube_id,
      marcadoRodadoEm: i.marcado_rodado_em ? new Date(i.marcado_rodado_em) : null, apagar: i.apagar, b2Nomes: i.b2_nomes,
      falta: i.falta, motivo: i.motivo, prefixos: i.prefixos, bloqueados: i.bloqueados, snapshotMaisAntigo: i.snapshot_mais_antigo,
      snapEsperaDesde: i.snap_espera_desde ? new Date(i.snap_espera_desde) : null, snapLiberaEm: i.snap_libera_em ? new Date(i.snap_libera_em) : null,
      snapBloqueio: i.snap_bloqueio ?? null,
    })),
  }
}

export type PendenciasDaTela =
  | { estado: 'nao_medido' }
  | { estado: 'zero'; lidoEm: Date; linha: string | null }
  | { estado: 'com_itens'; lidoEm: Date; n: number; maisAntigoDias: number; itens: Array<{ item_id: string; kind: string; tempo: TempoPendencia; falta: Falta | null; motivo: Motivo | null; bloqueados: number; snapshotMaisAntigo: string | null; /** dias desde o início da espera por snapshot (nulo = sem espera) */ snapEsperaDias: number | null; snapEsperaDesde: Date | null; snapLiberaEm: Date | null; /** a data de liberar já passou */ snapLiberaHoje: boolean; /** passou há mais de 24 h */ snapLiberaAtrasada: boolean; snapBloqueio: SnapBloqueio | null; /** quando o dono marcou "Já rodei" (nulo = não marcou) */ marcadoRodadoEm: Date | null; /** marcou há mais de 24 h, o item segue em `apagar_antigas` e a forja responde: a verificação não achou a mudança */ marcadoRefutado: boolean; /** marcou há mais de 24 h em `apagar_antigas` mas a forja não responde: a verificação não rodou, nada foi refutado */ marcadoAtrasado: boolean; /** marcou há mais de 24 h em `apagar_antigas` e não se leu o batimento: não se sabe se foi verificado */ marcadoIncerto: boolean; idadeDias: number; /** o nome (canal ou vídeo) ou, sem nome, o mês; nulo = nada para dizer. Nunca inventado. */ titulo: string | null; /** desde quando o item espera (a data de saída do site) */ desde: Date; /** o código curto, para o item sem nome: o do YouTube ou os 8 primeiros do registro */ codigo: string | null }>; linha: string | null }

const DIA_MS = 86_400_000
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeDoMes = (m: string): string => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`
/**
 * A marca "Já rodei" depois de 24 h (conserto 1, item 1). Só `apagar_antigas` tem o que a verificação pode refutar: lá, com a forja respondendo, a marca velha
 * foi REFUTADA (o item voltou); com a forja parada, nada foi verificado e a marca fica "atrasada". Em `copiar`, `conferir_b2` e os demais, a marca velha
 * não quer dizer nada (o passo seguinte ainda não rodou): vira nula e o botão "Já rodei" volta.
 */
export function marcaDoItem(i: { tempo: TempoPendencia; marcadoRodadoEm: Date | null }, agora: Date, verificadorEm: number | null | undefined): { marcadoRodadoEm: Date | null; marcadoRefutado: boolean; marcadoAtrasado: boolean; marcadoIncerto: boolean } {
  const m = i.marcadoRodadoEm
  const nada = { marcadoRefutado: false, marcadoAtrasado: false, marcadoIncerto: false }
  if (m === null || m.getTime() >= agora.getTime() - DIA_MS) return { marcadoRodadoEm: m, ...nada }
  if (i.tempo !== 'apagar_antigas') return { marcadoRodadoEm: null, ...nada }
  // `undefined` = o batimento não foi lido: não se sabe se foi verificado (neutro, sem culpar a forja). `null` = lido e sem batimento: a verificação não rodou.
  if (verificadorEm === undefined) return { marcadoRodadoEm: m, ...nada, marcadoIncerto: true }
  const verificou = verificadorEm !== null && verificadorEm > m.getTime() + DIA_MS
  return { marcadoRodadoEm: m, marcadoRefutado: verificou, marcadoAtrasado: !verificou, marcadoIncerto: false }
}
/** O batimento (ms) da conferência do B2 (`conferir_b2`), o programa que verifica; nulo = nunca deu sinal. O do `copiador` NÃO serve: a forja pode ter voltado agora sem que a conferência tenha rodado. */
export function sinalDoVerificador(casa: ReadonlyArray<{ worker: string; last_poll_at: string | null; updated_at: string | null }>): number | null {
  const t = (v: string | null): number => { const x = v === null ? NaN : Date.parse(v); return Number.isNaN(x) ? -Infinity : x }
  const b = casa.find(c => c.worker === 'conferir_b2')
  const s = b ? Math.max(t(b.last_poll_at), t(b.updated_at)) : -Infinity
  return Number.isFinite(s) ? s : null
}
/** Os nomes que a página já tem, montados UMA vez (O(c + v)): canal pelo id do registro, vídeo pelo id do YouTube. */
export interface NomesDaFila { canais?: ReadonlyMap<string, string>; videos?: ReadonlyMap<string, string> }
/** O que a tela recebe. `apagar` e `b2_nomes` nunca saem daqui; a linha só vai a quem administra o site (E-D4). */
export function pendenciasParaTela(l: LeituraPendencias, o: { podeVerComandos: boolean; agora: Date; nomes?: NomesDaFila; /** o batimento (ms) do programa que verifica; nulo = sem batimento; ausente = não lido (neutro) */ verificadorEm?: number | null }): PendenciasDaTela {
  if (!l.ok) return { estado: 'nao_medido' }
  const linha = o.podeVerComandos ? LINHA_DO_DONO : null
  if (l.itens.length === 0) return { estado: 'zero', lidoEm: l.lidoEm, linha }
  const idade = (d: Date): number => Math.max(0, Math.floor((o.agora.getTime() - d.getTime()) / DIA_MS))
  const titulo = (i: PendenciaDoDono): string | null => (i.channelRef ? o.nomes?.canais?.get(i.channelRef) : i.youtubeId ? o.nomes?.videos?.get(i.youtubeId) : undefined) ?? (i.mes ? nomeDoMes(i.mes) : i.kind === 'canal' && i.channelRef ? i.channelRef.slice(0, 8) : null)
  const itens = l.itens.map(i => ({ item_id: i.itemId, kind: i.kind, tempo: i.tempo, falta: i.falta, motivo: i.motivo, bloqueados: i.bloqueados, snapshotMaisAntigo: i.snapshotMaisAntigo, snapEsperaDias: i.snapEsperaDesde ? idade(i.snapEsperaDesde) : null, snapEsperaDesde: i.snapEsperaDesde, snapLiberaEm: i.snapLiberaEm, snapLiberaHoje: i.snapLiberaEm ? i.snapLiberaEm.getTime() <= o.agora.getTime() : false, snapLiberaAtrasada: i.snapLiberaEm ? i.snapLiberaEm.getTime() < o.agora.getTime() - 86_400_000 : false, snapBloqueio: i.snapBloqueio, ...marcaDoItem(i, o.agora, o.verificadorEm), idadeDias: idade(i.desde), titulo: titulo(i), desde: i.desde, codigo: i.youtubeId ?? (i.channelRef ? i.channelRef.slice(0, 8) : null) }))
  return { estado: 'com_itens', lidoEm: l.lidoEm, n: itens.length, maisAntigoDias: Math.max(...itens.map(i => i.idadeDias)), itens, linha }
}
