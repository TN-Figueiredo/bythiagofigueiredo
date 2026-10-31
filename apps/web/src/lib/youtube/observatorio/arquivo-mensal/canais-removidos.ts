/** Manutenção M5, Tarefa 8 (04 §14.2, item 163 parte M5): o bloco "Canais removidos" só de leitura e a marca ao lado da pastilha. PURO (exceto `lerCanaisRemovidos`).
 *  Tempo em ms; `corDaRemocao` recebe `Date` convertido uma vez na borda. Frases de `arq-dados.js` (CAN), números trocados por parâmetros.
 *  Sem o comando de limpeza (`cap.comandoDeLimpeza` falso, o caso da M5 até a M9): nenhuma cor por idade, "ver os comandos" e "Apagar do arquivo" não existem (M9). */
import { avisarFuncaoAusente } from './funcao-ausente'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateOf } from '../time'
import type { Capacidades } from './capacidades'
import { corDaRemocao, type Cor, type EstadoRemocao, type LinhaRemocao } from './estado-remocao'
import type { Casa, Etapa, Forma, Gravidade } from './estado-do-mes'
import { LINHA_DO_DONO, marcaDoItem, type Falta, type LeituraPendencias, type SnapBloqueio, type TempoPendencia } from './pendencias'

const ts = z.string().nullable()
const LinhaV2 = z.object({
  channel_ref: z.string(), versao: z.literal(2),
  /** Texto livre de propósito: um estado que esta tela não conhece vira "não medido", nunca falha nem "ok". */
  estado: z.string(),
  decided_at: ts, nas_absent_at: ts, b2_absent_at: ts, snapshots_clear_on: ts, reappeared_at: ts,
  reappeared_count: z.number(), online_thumbs_known: z.boolean().nullable(), thumbs_unknown_ack_at: ts,
  blobs_pendentes: z.number(), youtube_channel_id: ts, nome: ts, removido_em: ts, removido_via: z.string(),
  primeiro_mes: ts, ultimo_mes: ts, meses: z.number().nullable(), registros: z.number().nullable(), classes: z.array(z.string()),
  // M9 (wrapper de obs_archive_removed_channel_list): opcionais para a tela ler antes e depois da migration.
  nas_last_absent_at: ts.optional(), marcado_rodado_em: ts.optional(), completed_at: ts.optional(), lote_e10_aberto: z.boolean().optional(),
  prefixos_total: z.number().optional(), prefixos_ausentes_nas: z.number().optional(), snap_ok: z.number().optional(), snapshot_mais_antigo: ts.optional(),
}).strict()
const ListaV2 = z.array(LinhaV2)
export type ListaRemovidosV2 = z.infer<typeof ListaV2>

export interface DialogoApagar { titulo: string; corpo: string; /** o que a pessoa digita para liberar o botão: o nome, ou o código quando o canal não tem nome */ confirma: string; porCodigo: boolean
  /** o lote exportado à mão (removido_via e10_export) fica no Mac e no NAS: o aviso vem antes (Decisão 4) */ loteE10: boolean
  /** sem_destino: o site não anotou quais imagens são do canal */ avisoBlob: boolean }
export interface LinhaCanalRemovido { channelRef: string; codigo: string; rotulo: string; regua: Etapa[]; frase: string
  forma: Forma; gravidade: Gravidade; noTopo: boolean; blob: null | { frase: string; forma: Forma }
  /** M9b T7: o botão da linha. `apagar` = "Apagar do arquivo"; `comandos` = "Ver os comandos". Nulo = sem botão (a frase diz o porquê). */
  acao: 'apagar' | 'comandos' | null; dialogo: DialogoApagar | null; comandos: null | { titulo: string; linha: string }
  /** segunda linha de leitura (ex.: "Você marcou que rodou em dd/mm"), sem botão */ nota: null | { frase: string; forma: Forma }
  /** vem de e10_export: o `concluido` e o diálogo lembram do lote à mão */ viaE10: boolean }
export interface BlocoCanaisRemovidos { resumo: string; acimaDosTipos: boolean; linhas: LinhaCanalRemovido[]; jaLimpos: { n: number; ultimoEm: number | null; /** quantos desses vieram de e10_export */ viaE10: number } }
export type LeituraBloco = { ok: true; bloco: BlocoCanaisRemovidos } | { ok: false }

/** O que a leitura das pendências diz de UM canal (item `canal:<uuid>`). Sem item = nada a rodar agora. */
export interface PendenciaDoCanal { tempo: TempoPendencia; falta: Falta | null; snapLiberaEm: number | null; snapBloqueio: SnapBloqueio | null; marcadoRodadoEm: number | null; b2Nomes: number }
/** `ok: false` = a leitura falhou: a linha diz "não medido", nunca "sem pendência". */
export type PendenciasDoBloco = { ok: false } | { ok: true; canais: ReadonlyMap<string, PendenciaDoCanal> }
export function pendenciasDoBloco(l: LeituraPendencias): PendenciasDoBloco {
  if (!l.ok) return { ok: false }
  const canais = new Map<string, PendenciaDoCanal>()
  for (const i of l.itens) {
    if (i.kind !== 'canal' || !i.channelRef || canais.has(i.channelRef)) continue
    canais.set(i.channelRef, { tempo: i.tempo, falta: i.falta, snapLiberaEm: i.snapLiberaEm?.getTime() ?? null, snapBloqueio: i.snapBloqueio, marcadoRodadoEm: i.marcadoRodadoEm?.getTime() ?? null, b2Nomes: i.b2Nomes.length })
  }
  return { ok: true, canais }
}
type Opcoes = { agora: number; casa: Casa; cap: Capacidades; /** quem administra o site pode apagar do arquivo e ver os comandos */ administra?: boolean; /** ausente = a leitura não foi feita (tratada como falha) */ pend?: PendenciasDoBloco }

const dm = (ms: number): string => { const d = spDateOf(ms); return d.slice(8, 10) + '/' + d.slice(5, 7) }
const dmy = (ms: number): string => dm(ms) + '/' + spDateOf(ms).slice(0, 4)
const hm = (ms: number): string => new Date(ms - 3 * 3_600_000).toISOString().slice(11, 16)
const instante = (v: string | null): number | null => { if (v === null) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : t }
const mesAno = (m: string): string => m.slice(5, 7) + '/' + m.slice(0, 4)
const nImagens = (n: number): string => (n === 1 ? '1 imagem do canal ainda não foi apagada' : `${n} imagens do canal ainda não foram apagadas`)

const ETAPAS: Array<[string, string]> = [['Limpeza pedida', 'Pedida'], ['Apagado do NAS', 'NAS'], ['Snapshots do NAS (14 dias)', 'Snapshots'], ['Apagado do B2', 'B2']]
function formaDaCor(c: Cor, padrao: Forma): Forma { return c === 'vermelho' ? 'octogono' : c === 'ambar' ? 'triangulo' : padrao }
function gravDaCor(c: Cor): Gravidade { return c === 'vermelho' ? 'vermelho' : c === 'ambar' ? 'ambar' : 'nenhuma' }
/** Ordem desde a M9-snap: pedida, NAS, snapshots, B2. `passo` = índice da etapa atual (4 = tudo feito). */
function regua(passo: number, atual: Forma): Etapa[] {
  return ETAPAS.map(([rotulo, curto], i): Etapa => ({ rotulo, curto, forma: i < passo ? 'visto' : i === passo ? atual : 'pontilhado' }))
}
/** O prazo dos snapshots já cumpriu? `snapshots_clear_on` (data de São Paulo) vencida, ou a leitura das pendências já fala de B2. */
function snapshotsCumpridos(l: ListaRemovidosV2[number], p: PendenciaDoCanal | undefined, agora: number): boolean {
  if (l.snapshots_clear_on !== null && l.snapshots_clear_on.slice(0, 10) <= spDateOf(agora)) return true
  return p !== undefined && (p.tempo === 'conferir_b2' || p.tempo === 'apagar_antigas')
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

const fraseSoPrefixo = (administra: boolean): string => `Só restam pastas vazias do canal no NAS; ${administra ? 'a próxima linha que você rodar as limpa (ver os comandos).' : 'a próxima linha que quem administra o site rodar as limpa.'}`
const diasTxt = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`
const SEM_ACAO = { acao: null, dialogo: null, comandos: null, nota: null } as const

/** O arquivo tem de dizer quantos meses guarda para a ação "Apagar do arquivo" existir: sem isso o diálogo não teria número (plano, tabela de riscos: `meses` nulo). */
const temMeses = (l: ListaRemovidosV2[number]): boolean => l.meses !== null && l.meses > 0 && l.primeiro_mes !== null && l.ultimo_mes !== null
const SEM_MESES = ' Não foi possível ler quantos meses o arquivo deste canal tem; por isso o botão não aparece. Recarregue a página.'

function dialogoDe(l: ListaRemovidosV2[number], nome: string, codigo: string): DialogoApagar {
  const porCodigo = l.nome === null
  const sujeito = porCodigo ? `do código ${codigo}` : `de ${nome}`
  const ok = l.meses !== null && l.meses > 0 && l.primeiro_mes !== null && l.ultimo_mes !== null
  const n = l.meses ?? 0
  return {
    titulo: ok ? `Apagar do arquivo ${n === 1 ? 'o 1 mês' : `os ${n} meses`} ${sujeito}?` : `Apagar do arquivo os dados ${sujeito}?`,
    corpo: ok ? `${n === 1 ? 'O 1 mês' : `Os ${n} meses`} (de ${mesAno(l.primeiro_mes!)} a ${mesAno(l.ultimo_mes!)}) saem do arquivo e podem ser a única cópia${porCodigo ? '' : ' dos registros deste canal'}.` : 'O arquivo deste canal sai e pode ser a única cópia dos registros dele.',
    confirma: porCodigo ? codigo : nome, porCodigo, loteE10: l.removido_via === 'e10_export', avisoBlob: l.estado === 'sem_destino',
  }
}

function montarLinha(l: ListaRemovidosV2[number], o: Opcoes): LinhaCanalRemovido {
  const codigo = l.channel_ref.slice(0, 8).toUpperCase()
  const casaResponde = o.casa.estado === 'responde'
  const administra = o.administra === true
  const viaE10 = l.removido_via === 'e10_export'
  const base = { channelRef: l.channel_ref, codigo, noTopo: false, blob: null as LinhaCanalRemovido['blob'], viaE10, ...SEM_ACAO }
  const nome = l.nome ?? codigo
  const removido = instante(l.removido_em), decidido = instante(l.decided_at)
  const cabeca = removido !== null ? `${nome}, removido em ${dmy(removido)}.` : l.nome !== null ? `${nome}.` : decidido !== null ? `${codigo}, removido sem aviso, limpeza pedida em ${dm(decidido)}.` : `${codigo}, removido sem aviso.`
  const podeApagar = o.cap.comandoDeLimpeza && administra && temMeses(l)
  /** a frase de quem poderia apagar mas não tem os meses lidos */
  const semMeses = o.cap.comandoDeLimpeza && administra && !temMeses(l) ? SEM_MESES : ''
  /** O fim da frase de quem não pode apagar: sem o comando, ou sem ser admin. */
  const semBotao = !o.cap.comandoDeLimpeza ? ` Espera o comando, que ${quando(o.cap)}.` : !administra ? ' Espera quem administra o site para apagar do arquivo.' : ''

  if (l.estado === 'sem_destino') {
    const f = faixa(l)
    return { ...base, rotulo: codigo, regua: [{ rotulo: 'Sem destino', curto: 'Sem destino', forma: 'octogono' }], forma: 'octogono', gravidade: 'vermelho', noTopo: true,
      acao: podeApagar ? 'apagar' : null, dialogo: podeApagar ? dialogoDe(l, nome, codigo) : null,
      frase: `Um canal foi removido sem o site anotar o que fazer com o arquivo dele. O nome dele não ficou guardado no arquivo (código interno: ${codigo}).${f ? ` Há ${f.replace(', de ', ' no arquivo, de ')}.` : ''} Esta tela não guarda um arquivo sem o canal que o explica. Se quiser guardá-lo, não o apague: a linha continua vermelha.${semBotao}${semMeses}` }
  }
  if (l.estado === 'guardado') {
    const f = faixa(l)
    // o site só tenta apagar as imagens depois de "Apagar do arquivo", e só com a tentativa diária ligada: sem ela, a frase não promete nada
    const blob = l.blobs_pendentes > 0 ? { frase: o.cap.comandoDeLimpeza && o.cap.blobsLigados
      ? `${nImagens(l.blobs_pendentes)} do Blob. Saem quando você apagar do arquivo: o site só tenta apagá-las depois disso.`
      : `${nImagens(l.blobs_pendentes)} do Blob; o comando que as apaga ainda não tem data para chegar.`, forma: 'pontilhado' as Forma } : null
    return { ...base, rotulo: nome, regua: [{ rotulo: 'Guardado', curto: 'Guardado', forma: 'arquivo' }], forma: 'arquivo', gravidade: 'nenhuma', blob,
      acao: podeApagar ? 'apagar' : null, dialogo: podeApagar ? dialogoDe(l, nome, codigo) : null,
      frase: `${cabeca.replace(/\.$/, '')} com exportação: ${f ? `${f.split(',')[0]} guardados` : 'arquivo guardado'} no arquivo.`.replace('1 mês guardados', '1 mês guardado') + semBotao + semMeses }
  }
  const lr: LinhaRemocao = { estado: l.estado as EstadoRemocao, decided_at: l.decided_at, reappeared_at: l.reappeared_at, nas_absent_at: l.nas_absent_at, b2_absent_at: l.b2_absent_at, snapshots_clear_on: l.snapshots_clear_on, blobs_pendentes: l.blobs_pendentes }
  const cr = corDaRemocao(lr, { agora: new Date(o.agora), casaResponde, limpezaEmProducao: o.cap.comandoDeLimpeza && o.cap.blobsLigados })
  let blob: LinhaCanalRemovido['blob'] = null
  if (l.blobs_pendentes > 0) {
    const forma = formaDaCor(cr.blob, 'pontilhado')
    const desde = decidido !== null ? ` (desde ${dmy(decidido)})` : ''
    const dias = cr.blob === 'ambar' || cr.blob === 'vermelho' ? Math.floor((o.agora - (decidido ?? o.agora)) / 86_400_000) : null
    // sem o comando, ou com a tentativa diária desligada (OBS_ARQUIVO_LIMPEZA_BLOBS), o site NÃO tenta de novo: a frase não pode prometer isso
    // `sem_arquivo` (guardado e depois sem arquivo) não tem nova tentativa que o site faça por aqui: a frase não promete "tenta de novo"
    const frase = !o.cap.comandoDeLimpeza || !o.cap.blobsLigados ? `${nImagens(l.blobs_pendentes)} do Blob; o comando que as apaga ainda não tem data para chegar.`
      : l.estado === 'sem_arquivo' ? `${nImagens(l.blobs_pendentes)} do Blob${dias !== null ? ` há ${dias} dias` : ''}. Peça para investigar o apagamento no Blob.`
      : dias !== null ? `${l.blobs_pendentes} imagens do canal continuam no Blob há ${dias} dias: o site tenta apagá-las todo dia e não conseguiu. Peça para investigar o apagamento no Blob.`
      : `${nImagens(l.blobs_pendentes)} do Blob; o site tenta de novo${desde}.`
    blob = { frase, forma }
  }
  if (l.estado === 'sem_arquivo') {
    return { ...base, rotulo: nome, regua: [{ rotulo: 'Imagens no Blob', curto: 'Imagens', forma: blob?.forma ?? 'pontilhado' }], forma: blob?.forma ?? 'pontilhado', gravidade: gravDaCor(cr.blob), frase: blob?.frase ?? cabeca, blob: null }
  }

  const pendLida = o.pend !== undefined && o.pend.ok
  const p = o.pend !== undefined && o.pend.ok ? o.pend.canais.get(l.channel_ref) : undefined
  const idade = cr.idadeDias
  const idadeForma = formaDaCor(cr.cor, 'arquivo')
  const naoLida = (passo: number, frase: string): LinhaCanalRemovido => ({ ...base, rotulo: nome, regua: regua(passo, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', blob, frase })
  /** O comando: só quem administra, só com a linha lida. Quem só edita lê a frase "espera quem administra". */
  const comComando = (titulo: string): Pick<LinhaCanalRemovido, 'acao' | 'comandos'> => (administra ? { acao: 'comandos', comandos: { titulo, linha: LINHA_DO_DONO } } : { acao: null, comandos: null })

  if (l.estado === 'pedido') {
    if (!o.cap.comandoDeLimpeza) {
      return { ...base, rotulo: nome, regua: regua(0, 'pontilhado'), forma: 'pontilhado', gravidade: 'nenhuma', blob,
        frase: `${cabeca} Limpeza pedida${l.meses !== null && faixa(l) ? `: ${faixa(l)}` : ''}. Espera o comando, que ${quando(o.cap)}.` }
    }
    if (!casaResponde) return { ...base, rotulo: nome, regua: regua(0, 'triangulo'), forma: 'triangulo', gravidade: 'ambar', blob, frase: `${cabeca} ${casaFrase(o.casa)}` }
    const pedida = idade === null ? 'Limpeza pedida' : idade <= 0 ? 'Limpeza pedida hoje' : `Limpeza pedida há ${diasTxt(idade)}${idade >= 60 ? ', mais de 60' : ''}`
    if (!pendLida) return naoLida(0, `${cabeca} ${pedida}. Não foi possível ler a linha dos comandos; recarregue a página.`)
    if (p?.falta === 'lote_e10') return { ...base, rotulo: nome, regua: regua(0, idadeForma), forma: 'pontilhado', gravidade: 'nenhuma', blob, frase: `${cabeca} A exportação que você fez à mão deste canal ainda está aberta. Termine-a antes: a limpeza espera.` }
    if (p?.falta === 'imagens') return naoLida(0, `${cabeca} O site não anotou quais imagens deste canal estão no Blob; a limpeza espera o seu aceite, que ainda não foi dado. Peça para olhar; a limpeza espera.`)
    if (p?.falta === 'so_prefixo') {
      // o canal só tem pastas vazias no NAS: a próxima linha as limpa. Antes deste ramo a linha caía em "Espera o site; nada a fazer" (mudo)
      return { ...base, rotulo: nome, regua: regua(0, idadeForma), forma: idadeForma, gravidade: gravDaCor(cr.cor), blob, ...comComando(`Só restam pastas vazias de ${nome} no NAS: rode a mesma linha.`),
        frase: `${cabeca} ${pedida}. ${fraseSoPrefixo(administra)}` }
    }
    if (p && p.tempo === 'sem_comando' && p.falta !== null) {
      return { ...base, rotulo: nome, regua: regua(0, idadeForma), forma: 'pontilhado', gravidade: 'nenhuma', blob, frase: `${cabeca} ${pedida}. Espera o site; nada a fazer agora.` }
    }
    const reap = instante(l.reappeared_at)
    if (reap !== null && (decidido === null || reap >= decidido)) {
      return { ...base, rotulo: nome, regua: regua(3, 'octogono'), forma: 'octogono', gravidade: 'vermelho', blob, ...comComando(`Para limpar de novo o arquivo de ${nome}, rode uma linha no Mac.`),
        frase: `${cabeca} O arquivo do canal reapareceu em ${dmy(reap)}, depois de apagado. ${administra ? 'Falta você rodar a linha de novo (ver os comandos).' : 'Espera quem administra o site rodar a linha.'}` }
    }
    const marca = marcaDoItem({ tempo: p?.tempo ?? 'sem_comando', marcadoRodadoEm: p?.marcadoRodadoEm == null ? null : new Date(p.marcadoRodadoEm) }, new Date(o.agora), casaResponde)
    const marcado = marca.marcadoRodadoEm === null ? null : marca.marcadoRodadoEm.getTime()
    if (marca.marcadoRefutado && marcado !== null) {
      // marcou há mais de 24 h, a forja responde e o item segue na lista: a verificação não achou a mudança (âmbar da peça 7)
      const f: Forma = cr.cor === 'vermelho' ? 'octogono' : 'triangulo'
      return { ...base, rotulo: nome, regua: regua(0, f), forma: f, gravidade: cr.cor === 'vermelho' ? 'vermelho' : 'ambar', blob, ...comComando(`Para limpar o arquivo de ${nome}, rode uma linha no Mac.`),
        nota: { frase: `Você marcou que rodou em ${dm(marcado)}, mas a verificação não achou a mudança.`, forma: 'triangulo' },
        frase: `${cabeca} ${pedida}. ${administra ? 'Rode a linha de novo (ver os comandos): ela mostra o que falta.' : 'Espera quem administra o site rodar a linha de novo.'}` }
    }
    const frase = marcado !== null ? `${cabeca} ${pedida}. Falta a confirmação do site, em até 24 horas.`
      : !administra ? `${cabeca} ${pedida}. Espera quem administra o site rodar a linha.`
      : `${cabeca} ${pedida}. Falta você rodar a linha no Mac (ver os comandos). Se você já rodou, a confirmação chega em até 24 horas; não precisa avisar. Passadas as 24 horas, rode a mesma linha de novo: ela mostra o que falta.`
    return { ...base, rotulo: nome, regua: regua(0, idadeForma), forma: idadeForma, gravidade: gravDaCor(cr.cor), blob, ...comComando(`Para limpar o arquivo de ${nome}, rode uma linha no Mac.`),
      nota: marcado !== null ? { frase: `Você marcou que rodou em ${dm(marcado)}; a confirmação chega em até 24 horas.`, forma: 'pontilhado' } : null, frase }
  }
  if (l.estado === 'apagado_nas' || l.estado === 'apagado_b2' || l.estado === 'concluido') {
    // As frases nunca dizem "apagado" sem a data da prova.
    const prova = l.estado === 'apagado_nas' ? instante(l.nas_absent_at) : l.estado === 'apagado_b2' ? instante(l.b2_absent_at) : (instante(l.b2_absent_at) ?? instante(l.nas_absent_at))
    const passoSemProva = l.estado === 'apagado_nas' ? 2 : 3
    if (prova === null) return { ...base, rotulo: nome, regua: regua(passoSemProva, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${cabeca} O estado da limpeza não foi medido.`, blob }
    const fim = (r: Omit<LinhaCanalRemovido, 'channelRef' | 'codigo' | 'noTopo' | 'rotulo' | 'blob' | 'viaE10' | 'acao' | 'dialogo' | 'comandos' | 'nota'> & Partial<Pick<LinhaCanalRemovido, 'acao' | 'comandos' | 'nota'>>): LinhaCanalRemovido =>
      ({ ...base, rotulo: nome, blob, ...r, ...(casaResponde ? {} : { forma: 'triangulo' as Forma, gravidade: 'ambar' as Gravidade }) })
    if (l.estado === 'concluido') return fim({ regua: regua(4, 'visto'), forma: 'visto', gravidade: 'nenhuma', frase: `${cabeca} Limpeza concluída em ${dmy(prova)}.` })

    const head = l.estado === 'apagado_nas' ? `${cabeca} Apagado do NAS em ${dmy(prova)}.` : `${cabeca} Apagado do NAS e do B2 em ${dmy(prova)}.`
    const cumprido = l.estado === 'apagado_b2' || snapshotsCumpridos(l, p, o.agora)
    if (p?.falta === 'so_prefixo') {
      return fim({ regua: regua(3, 'arquivo'), forma: 'pontilhado', gravidade: 'nenhuma', ...comComando(`Só restam pastas vazias de ${nome} no NAS: rode a mesma linha.`),
        frase: `${cabeca} ${fraseSoPrefixo(administra)}` })
    }
    if (!cumprido) {
      // Esperando os snapshots do NAS (14 dias): sem comando e sem idade. O bloqueio vem primeiro e nunca fica escondido por falta de data.
      if (!pendLida) return fim({ regua: regua(2, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${head} Aguardando os snapshots do NAS; a data não foi lida. A leitura é refeita na próxima carga.` })
      if (p?.snapBloqueio && p.snapBloqueio !== 'ilegivel') return fim({ regua: regua(2, 'triangulo'), forma: 'triangulo', gravidade: 'ambar', frase: `${head} Os snapshots do NAS não puderam ser conferidos: peça para olhar a conferência dos snapshots.` })
      const libera = p?.snapLiberaEm ?? null
      if (libera === null) return fim({ regua: regua(2, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${head} Os snapshots ainda guardam o arquivo; a data em que expiram não foi lida. Nada a fazer agora.` })
      if (libera > o.agora) return fim({ regua: regua(2, 'pontilhado'), forma: 'pontilhado', gravidade: 'nenhuma', frase: `${head} Aguardando os snapshots do NAS. Espere até ${dm(libera)}.` })
      if (libera < o.agora - 86_400_000) return fim({ regua: regua(2, 'triangulo'), forma: 'triangulo', gravidade: 'ambar', frase: `${head} O prazo dos snapshots do NAS (${dm(libera)}) passou; aguarda a próxima conferência da forja. Se passar de 2 dias, veja se a rotina da forja está rodando.` })
      return fim({ regua: regua(2, 'pontilhado'), forma: 'pontilhado', gravidade: 'nenhuma', frase: `${head} Aguardando os snapshots do NAS; deve liberar na próxima verificação da forja.` })
    }
    if (l.estado === 'apagado_nas') {
      if (!pendLida) return fim({ regua: regua(3, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${head} Prazo dos snapshots cumprido. A linha dos comandos não foi lida; recarregue a página.` })
      if (p?.tempo === 'conferir_b2') {
        const n = p.b2Nomes
        return fim({ regua: regua(3, 'triangulo'), forma: 'triangulo', gravidade: 'ambar', ...comComando(`Para apagar do B2 as versões que sobraram de ${nome}, rode a mesma linha.`),
          frase: `${head} Prazo dos snapshots cumprido. O B2 ainda lista ${n} ${n === 1 ? 'arquivo' : 'arquivos'} deste canal. ${administra ? 'Rode a linha de novo (ver os comandos): ela imprime B2-PAINEL: <nome> para cada arquivo. Se o painel do B2 só os escondeu, apague as versões antigas por lá.' : 'Espera quem administra o site rodar a linha.'}` })
      }
      if (p && p.tempo !== 'sem_comando') {
        const f = formaDaCor(cr.cor, 'arquivo')
        return fim({ regua: regua(3, f), forma: f, gravidade: gravDaCor(cr.cor), ...comComando(`Os snapshots do NAS já expiraram. Falta apagar ${nome} do B2: rode a mesma linha.`),
          frase: `${head} Prazo dos snapshots cumprido. ${administra ? 'Falta apagar no B2: rode a linha de novo (ver os comandos).' : 'Falta apagar no B2: espera quem administra o site rodar a linha.'}` })
      }
      // a cor vem da idade (b2_sync parado aos 90 dias não pode ficar neutro)
      const fe = formaDaCor(cr.cor, 'pontilhado')
      return fim({ regua: regua(3, fe), forma: fe, gravidade: gravDaCor(cr.cor), frase: `${head} Prazo dos snapshots cumprido. Espera o site; nada a fazer agora.` })
    }
    // apagado_b2: a parte do dono terminou
    if (p?.falta === 'blobs' || l.blobs_pendentes > 0) {
      return fim({ regua: regua(4, 'visto'), forma: 'visto', gravidade: blob ? gravDaCor(cr.blob) : 'nenhuma', frase: `${head} Sua parte terminou. A limpeza do arquivo espera as imagens saírem do Blob.` })
    }
    // a parte do dono NÃO terminou enquanto a exportação à mão estiver aberta, ou as imagens sem aceite: a frase não culpa o B2 nem diz "conclui sozinho"
    if (p?.falta === 'lote_e10') {
      return fim({ regua: regua(3, 'pontilhado'), forma: 'pontilhado', gravidade: 'nenhuma', frase: `${head} A exportação que você fez à mão deste canal ainda está aberta. Termine-a antes: a limpeza espera.` })
    }
    if (p?.falta === 'imagens') {
      return fim({ regua: regua(3, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${head} O site não anotou quais imagens deste canal estão no Blob; a limpeza espera o seu aceite, que ainda não foi dado. Peça para olhar; a limpeza espera.` })
    }
    // sem a leitura das pendências não dá para dizer que "não há mais nada a rodar": não medido, nunca verde
    if (!pendLida) return fim({ regua: regua(3, 'hachura'), forma: 'hachura', gravidade: 'nao_medido', frase: `${head} A linha dos comandos não foi lida; recarregue a página.` })
    const fimB2 = instante(l.b2_absent_at)
    if (l.completed_at === null && fimB2 !== null && o.agora - fimB2 > 86_400_000) {
      return fim({ regua: regua(3, 'triangulo'), forma: 'triangulo', gravidade: 'ambar', frase: `${cabeca} Apagado do NAS e do B2 em ${dmy(prova)}, e a confirmação final ainda não chegou: peça para olhar a conferência do B2.` })
    }
    return fim({ regua: regua(4, 'visto'), forma: 'visto', gravidade: 'nenhuma', frase: `${head} Sua parte terminou. O site conclui a limpeza sozinho; não há mais nada a rodar.` })
  }
  return { ...base, rotulo: nome, regua: [{ rotulo: 'Não medido', curto: 'Não medido', forma: 'hachura' }], forma: 'hachura', gravidade: 'nao_medido', blob, frase: `${cabeca} O estado da limpeza não foi medido.` }
}

export function montarBloco(lista: ListaRemovidosV2, o: Opcoes): BlocoCanaisRemovidos {
  const linhas: LinhaCanalRemovido[] = []
  let jaN = 0, jaE10 = 0, jaUltimo: number | null = null
  const contagem = { semDestino: 0, pedido: 0, imagens: 0, guardado: 0, outros: 0 }
  for (const l of lista) {
    if ((l.estado === 'sem_arquivo' && l.blobs_pendentes === 0) || l.estado === 'concluido') {
      jaN++
      if (l.removido_via === 'e10_export') jaE10++
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
    if (contagem.pedido) p.push(o.cap.comandoDeLimpeza ? `${contagem.pedido} com limpeza pedida` : `${contagem.pedido} ${contagem.pedido === 1 ? 'espera' : 'esperam'} o comando de limpeza, que ${quando(o.cap)}`)
    if (contagem.imagens) p.push(`${contagem.imagens} com imagens por apagar no Blob`)
    if (contagem.guardado) p.push(`${contagem.guardado} guardados no arquivo`)
    if (contagem.outros) p.push(`${contagem.outros} em limpeza`)
    resumo = `Canais removidos: ${p.join('; ')}.`
  }
  return { resumo, acimaDosTipos: linhas.some(l => l.noTopo), linhas, jaLimpos: { n: jaN, ultimoEm: jaUltimo, viaE10: jaE10 } }
}

/** `apagado_nas` cujo prazo dos snapshots ainda não venceu pela data da linha (nula ou futura): só a leitura das pendências diz se ele pede algo ao dono. */
export function esperaSnapshots(l: Pick<ListaRemovidosV2[number], 'estado' | 'snapshots_clear_on'>, agora: number): boolean {
  return l.estado === 'apagado_nas' && (l.snapshots_clear_on === null || l.snapshots_clear_on.slice(0, 10) > spDateOf(agora))
}

/** A marca existe só com o comando de limpeza (M9); a M5 nunca o liga. Conta pedido e apagado_nas; a pior cor manda. */
export function marcaAoLadoDaPastilha(lista: ListaRemovidosV2, o: Opcoes): null | { n: number; forma: 'arquivo' | 'triangulo' | 'octogono' } {
  if (!o.cap.comandoDeLimpeza) return null
  let n = 0, pior: Cor = 'nenhuma'
  for (const l of lista) {
    if (l.estado !== 'pedido' && l.estado !== 'apagado_nas') continue
    if (esperaSnapshots(l, o.agora)) {
      // Sem a leitura das pendências não sabemos se a linha pede algo ao dono: ela não infla a marca (a linha própria mostra "não medido").
      if (o.pend?.ok !== true) continue
      const pc = o.pend.canais.get(l.channel_ref)
      // Esperando os snapshots do NAS não pede nada ao dono (Phil I5), SÓ se a espera termina sozinha: sem bloqueio, ou com `ilegivel` (a próxima rodada tenta de novo).
      // `retido`, `fora_do_padrao` e os outros bloqueios pedem uma decisão do dono e seguem na marca.
      if (pc?.falta === 'snapshots' && (pc.snapBloqueio === null || pc.snapBloqueio === 'ilegivel')) continue
    }
    n++
    const cr = corDaRemocao({ estado: l.estado, decided_at: l.decided_at, reappeared_at: l.reappeared_at, nas_absent_at: l.nas_absent_at, b2_absent_at: l.b2_absent_at, snapshots_clear_on: l.snapshots_clear_on, blobs_pendentes: l.blobs_pendentes },
      { agora: new Date(o.agora), casaResponde: o.casa.estado === 'responde', limpezaEmProducao: o.cap.comandoDeLimpeza && o.cap.blobsLigados })
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
    if (res.error.code === '42883' || res.error.code === 'PGRST202') avisarFuncaoAusente('obs_archive_removed_channel_list')
    else Sentry.captureMessage('obs_archive_removed_channel_list falhou: ' + (res.error.code ?? 'sem código'), 'error')
    return { ok: false }
  }
  const r = ListaV2.safeParse(res.data)
  if (!r.success) { Sentry.captureMessage('obs_archive_removed_channel_list fora do esquema', 'error'); return { ok: false } }
  return { ok: true, lista: r.data }
}
