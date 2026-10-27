/** Manutenção M5, Tarefa 8 (04 §14.2, item 163 parte M5): o bloco "Canais removidos" só de leitura e a marca ao lado da pastilha. PURO (exceto `lerCanaisRemovidos`).
 *  Tempo em ms; `corDaRemocao` recebe `Date` convertido uma vez na borda. Frases de `arq-dados.js` (CAN), números trocados por parâmetros.
 *  Sem o comando de limpeza (`cap.comandoDeLimpeza` falso, o caso da M5 até a M9): nenhuma cor por idade, "ver os comandos" e "Apagar do arquivo" não existem (M9). */
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateOf } from '../time'
import type { Capacidades } from './capacidades'
import { corDaRemocao, type Cor, type EstadoRemocao, type LinhaRemocao } from './estado-remocao'
import type { Casa, Etapa, Forma, Gravidade } from './estado-do-mes'

const ts = z.string().nullable()
const LinhaV2 = z.object({
  channel_ref: z.string(), versao: z.literal(2),
  /** Texto livre de propósito: um estado que esta tela não conhece vira "não medido", nunca falha nem "ok". */
  estado: z.string(),
  decided_at: ts, nas_absent_at: ts, b2_absent_at: ts, snapshots_clear_on: ts, reappeared_at: ts,
  reappeared_count: z.number(), online_thumbs_known: z.boolean().nullable(), thumbs_unknown_ack_at: ts,
  blobs_pendentes: z.number(), youtube_channel_id: ts, nome: ts, removido_em: ts, removido_via: z.string(),
  primeiro_mes: ts, ultimo_mes: ts, meses: z.number().nullable(), registros: z.number().nullable(), classes: z.array(z.string()),
}).strict()
const ListaV2 = z.array(LinhaV2)
export type ListaRemovidosV2 = z.infer<typeof ListaV2>

export interface LinhaCanalRemovido { channelRef: string; codigo: string; rotulo: string; regua: Etapa[]; frase: string
  forma: Forma; gravidade: Gravidade; noTopo: boolean; blob: null | { frase: string; forma: Forma } }
export interface BlocoCanaisRemovidos { resumo: string; acimaDosTipos: boolean; linhas: LinhaCanalRemovido[]; jaLimpos: { n: number; ultimoEm: number | null } }
export type LeituraBloco = { ok: true; bloco: BlocoCanaisRemovidos } | { ok: false }
type Opcoes = { agora: number; casa: Casa; cap: Capacidades }

const dm = (ms: number): string => { const d = spDateOf(ms); return d.slice(8, 10) + '/' + d.slice(5, 7) }
const dmy = (ms: number): string => dm(ms) + '/' + spDateOf(ms).slice(0, 4)
const hm = (ms: number): string => new Date(ms - 3 * 3_600_000).toISOString().slice(11, 16)
const instante = (v: string | null): number | null => { if (v === null) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : t }
const mesAno = (m: string): string => m.slice(5, 7) + '/' + m.slice(0, 4)
const nImagens = (n: number): string => (n === 1 ? '1 imagem do canal ainda não foi apagada' : `${n} imagens do canal ainda não foram apagadas`)

const ETAPAS = ['Limpeza pedida', 'Apagado do NAS', 'Apagado do B2', 'Prazo dos snapshots do NAS']
const ESTADO_PASSO: Record<string, number> = { pedido: 0, apagado_nas: 1, apagado_b2: 2, concluido: 4 }
function formaDaCor(c: Cor, padrao: Forma): Forma { return c === 'vermelho' ? 'octogono' : c === 'ambar' ? 'triangulo' : padrao }
function gravDaCor(c: Cor): Gravidade { return c === 'vermelho' ? 'vermelho' : c === 'ambar' ? 'ambar' : 'nenhuma' }
function regua(estado: string, atual: Forma): Etapa[] {
  const passo = ESTADO_PASSO[estado] ?? 0
  return ETAPAS.map((rotulo, i): Etapa => ({ rotulo, curto: rotulo, forma: i < passo ? 'visto' : i === passo ? atual : 'pontilhado' }))
}

function quando(cap: Capacidades): string {
  const d = cap.dataDoComando
  if (d === null) return 'ainda não tem data para chegar'
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? `chega em ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : `chega em ${d}`
}
function faixa(l: ListaRemovidosV2[number]): string {
  if (l.meses === null || l.meses <= 0 || l.primeiro_mes === null || l.ultimo_mes === null) return ''
  return `${l.meses === 1 ? '1 mês' : `${l.meses} meses`}, de ${mesAno(l.primeiro_mes)} a ${mesAno(l.ultimo_mes)}`
}
function casaFrase(casa: Casa): string {
  return casa.desde === null ? 'Espera a casa, que ainda não deu sinal. Nada a fazer agora.' : `Espera a casa, que não responde desde ${dm(casa.desde)} ${hm(casa.desde)}. Nada a fazer agora.`
}

function montarLinha(l: ListaRemovidosV2[number], o: Opcoes): LinhaCanalRemovido {
  const codigo = l.channel_ref.slice(0, 8).toUpperCase()
  const casaResponde = o.casa.estado === 'responde'
  const base = { channelRef: l.channel_ref, codigo, noTopo: false, blob: null as LinhaCanalRemovido['blob'] }
  const nome = l.nome ?? codigo
  const removido = instante(l.removido_em), decidido = instante(l.decided_at)
  const cabeca = removido !== null ? `${nome}, removido em ${dmy(removido)}.` : l.nome !== null ? `${nome}.` : decidido !== null ? `${codigo}, removido sem aviso, limpeza pedida em ${dm(decidido)}.` : `${codigo}, removido sem aviso.`

  if (l.estado === 'sem_destino') {
    const f = faixa(l)
    return { ...base, rotulo: codigo, regua: [{ rotulo: 'Sem destino', curto: 'Sem destino', forma: 'octogono' }], forma: 'octogono', gravidade: 'vermelho', noTopo: true,
      frase: `Um canal foi removido sem o site anotar o que fazer com o arquivo dele. O nome dele não ficou guardado no arquivo (código interno: ${codigo}).${f ? ` Há ${f.replace(', de ', ' no arquivo, de ')}.` : ''} Esta tela não guarda um arquivo sem o canal que o explica. Se quiser guardá-lo, não o apague: a linha continua vermelha.` }
  }
  if (l.estado === 'guardado') {
    const f = faixa(l)
    return { ...base, rotulo: nome, regua: [{ rotulo: 'Guardado', curto: 'Guardado', forma: 'arquivo' }], forma: 'arquivo', gravidade: 'nenhuma',
      frase: `${cabeca.replace(/\.$/, '')} com exportação: ${f ? `${f.split(',')[0]} guardados` : 'arquivo guardado'} no arquivo.`.replace('1 mês guardados', '1 mês guardado') }
  }
  const lr: LinhaRemocao = { estado: l.estado as EstadoRemocao, decided_at: l.decided_at, reappeared_at: l.reappeared_at, nas_absent_at: l.nas_absent_at, b2_absent_at: l.b2_absent_at, snapshots_clear_on: l.snapshots_clear_on, blobs_pendentes: l.blobs_pendentes }
  const cr = corDaRemocao(lr, { agora: new Date(o.agora), casaResponde, limpezaEmProducao: o.cap.comandoDeLimpeza })
  let blob: LinhaCanalRemovido['blob'] = null
  if (l.blobs_pendentes > 0) {
    const forma = formaDaCor(cr.blob, 'pontilhado')
    const desde = decidido !== null ? ` (desde ${dmy(decidido)})` : ''
    const dias = cr.blob === 'ambar' || cr.blob === 'vermelho' ? Math.floor((o.agora - (decidido ?? o.agora)) / 86_400_000) : null
    const frase = !o.cap.comandoDeLimpeza ? `${nImagens(l.blobs_pendentes)} do Blob; o comando que as apaga ainda não tem data para chegar.`
      : dias !== null ? `${l.blobs_pendentes} imagens do canal continuam no Blob há ${dias} dias: o site tenta apagá-las todo dia e não conseguiu. Peça para investigar o apagamento no Blob.`
      : `${nImagens(l.blobs_pendentes)} do Blob; o site tenta de novo${desde}.`
    blob = { frase, forma }
  }
  if (l.estado === 'sem_arquivo') {
    return { ...base, rotulo: nome, regua: [{ rotulo: 'Imagens no Blob', curto: 'Imagens', forma: blob?.forma ?? 'pontilhado' }], forma: blob?.forma ?? 'pontilhado', gravidade: gravDaCor(cr.blob), frase: blob?.frase ?? cabeca, blob: null }
  }
  if (l.estado === 'pedido') {
    if (!o.cap.comandoDeLimpeza) {
      return { ...base, rotulo: nome, regua: regua('pedido', 'pontilhado'), forma: 'pontilhado', gravidade: 'nenhuma', blob,
        frase: `${cabeca} Limpeza pedida${l.meses !== null && faixa(l) ? `: ${faixa(l)}` : ''}. Espera o comando, que ${quando(o.cap)}.` }
    }
    if (!casaResponde) return { ...base, rotulo: nome, regua: regua('pedido', 'triangulo'), forma: 'triangulo', gravidade: 'ambar', blob, frase: `${cabeca} ${casaFrase(o.casa)}` }
    const forma = formaDaCor(cr.cor, 'pontilhado')
    return { ...base, rotulo: nome, regua: regua('pedido', forma), forma, gravidade: gravDaCor(cr.cor), blob,
      frase: `${cabeca} Limpeza pedida${faixa(l) ? `: ${faixa(l)}` : ''}. Falta você rodar o comando no Mac e depois rodar, na forja, o arquivo que ele gravar. Se você já fez os dois, a confirmação chega em até 24 horas; não precisa avisar. Passadas as 24 horas, rode o comando de novo: ele diz o que falta.` }
  }
  if (l.estado === 'apagado_nas' || l.estado === 'apagado_b2' || l.estado === 'concluido') {
    // A v2 não devolve estes estados antes da M9; as frases ficam prontas e nunca dizem "apagado" sem a data da prova.
    const prova = l.estado === 'apagado_nas' ? instante(l.nas_absent_at) : l.estado === 'apagado_b2' ? instante(l.b2_absent_at) : (instante(l.b2_absent_at) ?? instante(l.nas_absent_at))
    if (prova === null) return { ...base, rotulo: nome, regua: regua(l.estado, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${cabeca} O estado da limpeza não foi medido.`, blob }
    const forma = !casaResponde ? 'triangulo' : formaDaCor(cr.cor, l.estado === 'concluido' ? 'visto' : 'pontilhado')
    const o2 = l.estado === 'apagado_nas' ? `Apagado do NAS em ${dmy(prova)}.` : l.estado === 'apagado_b2' ? `Apagado do NAS e do B2 em ${dmy(prova)}.` : `Limpeza concluída em ${dmy(prova)}.`
    return { ...base, rotulo: nome, regua: regua(l.estado, forma), forma, gravidade: casaResponde ? gravDaCor(cr.cor) : 'ambar', blob, frase: `${cabeca} ${o2}` }
  }
  return { ...base, rotulo: nome, regua: [{ rotulo: 'Não medido', curto: 'Não medido', forma: 'hachura' }], forma: 'hachura', gravidade: 'nao_medido', blob, frase: `${cabeca} O estado da limpeza não foi medido.` }
}

export function montarBloco(lista: ListaRemovidosV2, o: Opcoes): BlocoCanaisRemovidos {
  const linhas: LinhaCanalRemovido[] = []
  let jaN = 0, jaUltimo: number | null = null
  const contagem = { semDestino: 0, pedido: 0, imagens: 0, guardado: 0, outros: 0 }
  for (const l of lista) {
    if ((l.estado === 'sem_arquivo' && l.blobs_pendentes === 0) || l.estado === 'concluido') {
      jaN++
      const t = Math.max(...[l.b2_absent_at, l.nas_absent_at, l.decided_at].map(instante).filter((x): x is number => x !== null), -Infinity)
      if (t !== -Infinity && (jaUltimo === null || t > jaUltimo)) jaUltimo = t
      continue
    }
    const linha = montarLinha(l, o)
    linhas.push(linha)
    if (l.estado === 'sem_destino') contagem.semDestino++
    else if (l.estado === 'pedido') contagem.pedido++
    else if (l.estado === 'sem_arquivo') contagem.imagens++
    else if (l.estado === 'guardado') contagem.guardado++
    else contagem.outros++
  }
  linhas.sort((a, b) => Number(b.noTopo) - Number(a.noTopo))
  let resumo: string
  if (linhas.length === 0) resumo = 'Nenhum canal removido pede limpeza.'
  else {
    const p: string[] = []
    if (contagem.semDestino) p.push(`${contagem.semDestino} sem destino do arquivo`)
    if (contagem.pedido) p.push(o.cap.comandoDeLimpeza ? `${contagem.pedido} com limpeza pedida` : `${contagem.pedido} esperam o comando de limpeza, que ${quando(o.cap)}`)
    if (contagem.imagens) p.push(`${contagem.imagens} com imagens por apagar no Blob`)
    if (contagem.guardado) p.push(`${contagem.guardado} guardados no arquivo`)
    if (contagem.outros) p.push(`${contagem.outros} em limpeza`)
    resumo = `Canais removidos: ${p.join('; ')}.`
  }
  return { resumo, acimaDosTipos: linhas.some(l => l.noTopo), linhas, jaLimpos: { n: jaN, ultimoEm: jaUltimo } }
}

/** A marca existe só com o comando de limpeza (M9); a M5 nunca o liga. Conta pedido e apagado_nas; a pior cor manda. */
export function marcaAoLadoDaPastilha(lista: ListaRemovidosV2, o: Opcoes): null | { n: number; forma: 'arquivo' | 'triangulo' | 'octogono' } {
  if (!o.cap.comandoDeLimpeza) return null
  let n = 0, pior: Cor = 'nenhuma'
  for (const l of lista) {
    if (l.estado !== 'pedido' && l.estado !== 'apagado_nas') continue
    n++
    const cr = corDaRemocao({ estado: l.estado, decided_at: l.decided_at, reappeared_at: l.reappeared_at, nas_absent_at: l.nas_absent_at, b2_absent_at: l.b2_absent_at, snapshots_clear_on: l.snapshots_clear_on, blobs_pendentes: l.blobs_pendentes },
      { agora: new Date(o.agora), casaResponde: o.casa.estado === 'responde', limpezaEmProducao: true })
    if (cr.cor === 'vermelho') pior = 'vermelho'; else if (cr.cor === 'ambar' && pior !== 'vermelho') pior = 'ambar'
  }
  if (n === 0) return null
  return { n, forma: pior === 'vermelho' ? 'octogono' : pior === 'ambar' ? 'triangulo' : 'arquivo' }
}

/** Nunca lança. Qualquer falha (função ausente, erro, fora do esquema) = `{ ok: false }`: a tela diz "Não foi possível ler os canais removidos.", nunca lista vazia. */
export async function lerCanaisRemovidos(sb: SupabaseClient, siteId: string): Promise<{ ok: true; lista: ListaRemovidosV2 } | { ok: false }> {
  let res: { data: unknown; error: { code?: string } | null }
  try { res = await sb.rpc('obs_archive_removed_channel_list', { p_site: siteId }) } catch {
    Sentry.captureMessage('obs_archive_removed_channel_list: exceção ao chamar o rpc', 'error')
    return { ok: false }
  }
  if (res.error) {
    if (res.error.code !== '42883' && res.error.code !== 'PGRST202') Sentry.captureMessage('obs_archive_removed_channel_list falhou: ' + (res.error.code ?? 'sem código'), 'error')
    return { ok: false }
  }
  const r = ListaV2.safeParse(res.data)
  if (!r.success) { Sentry.captureMessage('obs_archive_removed_channel_list fora do esquema', 'error'); return { ok: false } }
  return { ok: true, lista: r.data }
}
