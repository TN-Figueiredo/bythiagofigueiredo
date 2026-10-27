/** Manutenção M5, Tarefa 7 (04 §14.2, item 39): o estado de cada mês e de cada problema da página do Arquivo. PURO: sem relógio da máquina, sem rede.
 *  O tempo da página é o do banco (`lido_em`, Phil M5): `montarPagina` não recebe `agora`. Tempo em ms; texto só na borda das frases.
 *  Frases copiadas de `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/arq-dados.js` (MES = estado do mês, PROB = problema), com os números
 *  de exemplo trocados por parâmetros. Onde o dado ainda não chega à página (porcentagem liberada, canal removido em risco, "voltou ao banco"), a frase fica de fora (M6/M9). */
import type { ReactNode } from 'react'
import { DAY, H, spDateOf, spDateStart } from '../time'
import type { PaginaLida, LinhaMesLida } from './pagina'
import { descreverVermelho, type LinhaDeProblema } from './vermelhos'

export type { LinhaDeProblema } from './vermelhos'
export type Forma = 'visto' | 'pontilhado' | 'pontilhado_ambar' | 'triangulo' | 'octogono' | 'hachura' | 'arquivo' | 'zero' | 'barra'
export type Etapa = { rotulo: string; curto: string; forma: Forma }
export type Gravidade = 'nenhuma' | 'ambar' | 'vermelho' | 'nao_medido'
export interface LinhaDoMes {
  chave: string; mesNome: string; regua: Etapa[]; frase: string; secundaria: string | null; gravidade: Gravidade; sobeAoTopo: boolean
  /** O encaixe da M6: o botão (Sair do banco, Liberar, Trazer de volta) entra aqui; a M5 nunca o preenche. */
  acoes?: ReactNode
}
export interface CartaoDoTipo { tipo: 'horaria' | 'serie' | 'texto'; titulo: string; resumo: string; linhas: LinhaDoMes[]; anosNoArquivo: { ano: number; meses: number; todosConferidos: boolean }[]; acoes?: ReactNode }
export interface Casa { estado: 'responde' | 'nao_respondeu' | 'nunca_deu_sinal' | 'programa_sem_sinal' | 'nas_fora' | 'nas_cheio' | 'nas_sem_verificar' | 'nao_medida'; desde: number | null; forma: Forma; frase: string }
export interface ModeloPagina {
  resumo: { texto: string; forma: Forma }; casa: Casa; tipos: CartaoDoTipo[]; problemas: LinhaDeProblema[]; mesesAFrente: { tabela: string; frase: string; forma: Forma }[]
  teste: null | { faixa: string; linhas: LinhaDoMes[]; encerradoEm: number | null }; ligado: boolean
}

// ---------- texto e datas (SP) ----------
const SP_OFF = 3 * H
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dm = (ms: number): string => { const d = spDateOf(ms); return d.slice(8, 10) + '/' + d.slice(5, 7) }
const dmy = (ms: number): string => dm(ms) + '/' + spDateOf(ms).slice(0, 4)
const hm = (ms: number): string => new Date(ms - SP_OFF).toISOString().slice(11, 16)
const dmhm = (ms: number): string => dm(ms) + ' ' + hm(ms)
const nomeDoMes = (d: string): string => `${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`
const nDias = (n: number): string => (n === 1 ? '1 dia' : `${n} dias`)
const tms = (s: string | null | undefined): number | null => { if (!s) return null; const v = Date.parse(s); return Number.isNaN(v) ? null : v }
/** 1º dia do mês `d` (aaaa-mm-dd) mais `n` meses. */
function maisMeses(d: string, n: number): string {
  const t = Number(d.slice(0, 4)) * 12 + (Number(d.slice(5, 7)) - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}
const NOME_DA_TABELA: Record<string, string> = { competitor_video_daily: 'Views por dia', competitor_video_early: 'Primeiras horas', competitor_video_hourly: 'Views por hora' }
const NOME_DO_TIPO: Record<'horaria' | 'serie' | 'texto', string> = { horaria: 'Views por hora', serie: 'Views por dia', texto: 'Comentários e dados antigos do YouTube' }

interface Ctx { agora: number; hoje: string; hojeMs: number; mesCorrente: string; p: PaginaLida }
const quando = (c: Ctx, ms: number): string => (spDateOf(ms) === c.hoje ? `hoje às ${hm(ms)}` : `em ${dmy(ms)}`)

// ---------- a régua ----------
const NOMES5: readonly (readonly [string, string])[] = [['No NAS', 'No NAS'], ['No B2', 'No B2'], ['Recuperação', 'Recup.'], ['Prazo', 'Prazo'], ['Pode sair', 'Pode sair']]
const r5 = (f: Forma[]): Etapa[] => NOMES5.map(([rotulo, curto], i) => ({ rotulo, curto, forma: f[i] ?? 'pontilhado' }))
const r2 = (a: Forma, b: Forma): Etapa[] => [{ rotulo: 'Saiu das telas', curto: 'Saiu', forma: a }, { rotulo: 'Espaço liberado', curto: 'Espaço', forma: b }]
const rArq = (problema?: Forma): Etapa[] => [{ rotulo: 'No arquivo', curto: 'Arquivo', forma: 'arquivo' }, ...(problema ? [{ rotulo: 'Verificação', curto: 'Verif.', forma: problema }] : [])]
interface Res { frase: string; secundaria?: string | null; gravidade: Gravidade; regua: Etapa[]; grupo: 0 | 1 | 2 | 3 | 4 }
const neutro = (frase: string, f: Forma[] = []): Res => ({ frase, gravidade: 'nenhuma', regua: r5(f), grupo: 3 })

// ---------- juntar as tabelas de uma classe num mês ----------
const TODAS_PRECISAM: readonly (keyof LinhaMesLida)[] = ['sealed_at', 'nas_attested_at', 'b2_attested_at', 'detached_at', 'dropped_at']
/** Uma classe tem várias tabelas (a série: diária e primeiras horas). O mês só avançou numa etapa quando TODAS as tabelas avançaram (a mais atrasada manda);
 *  um problema de qualquer uma conta. */
export function juntarTabelas(rows: LinhaMesLida[]): LinhaMesLida {
  const base: LinhaMesLida = { ...rows[0]! }
  if (rows.length === 1) return base
  const mutavel = base as Record<string, unknown>
  for (const k of Object.keys(base) as (keyof LinhaMesLida)[]) {
    if (k === 'b2' || k === 'class' || k === 'month') continue
    const vals = rows.map(r => r[k])
    if (k === 'tem_linha') mutavel[k] = vals.some(Boolean)
    else if (k === 'devido_em') mutavel[k] = [...vals as string[]].sort()[0]
    else if (TODAS_PRECISAM.includes(k)) mutavel[k] = vals.some(v => v == null) ? null : [...vals as string[]].sort()[0]
    else mutavel[k] = vals.find(v => v != null) ?? null
  }
  return base
}

interface Classe { wait: number; janela: number }
type Prog = PaginaLida['progresso'][number]
type Rec = PaginaLida['recuperacao'][number]

// ---------- o estado de um mês ----------
function mesDescartado(c: Ctx, r: LinhaMesLida): Res {
  const mes = nomeDoMes(r.month)
  const dropped = tms(r.dropped_at)!
  const nas = tms(r.nas_attested_at)
  const tent = r.b2_last_attempt_result
  if (r.manifest_nas_withdrawn_at) { // arq-dados.js:m11b
    return { frase: `O arquivo de ${mes} no NAS está ausente ou diferente. Este mês já saiu do banco: a cópia que resta é a do B2. Confira o B2 agora e recupere dele (ver os comandos)`, gravidade: 'vermelho', regua: rArq('octogono'), grupo: 0 }
  }
  if (r.b2_withdrawn_at || (tent && ['divergente', 'arquivo_ausente', 'nao_decifra'].includes(tent))) { // m11c
    const em = tms(r.b2_last_attempt_at) ?? tms(r.b2_withdrawn_at)
    return { frase: `A cópia de ${mes} no B2 falhou na conferência${em ? ` de ${dmy(em)}` : ''}. A cópia que resta é a do NAS. Rode a conferência de novo (ver o comando)`, gravidade: 'vermelho', regua: rArq('octogono'), grupo: 0 }
  }
  const dd = Math.floor((c.agora - (nas ?? dropped)) / DAY)
  if (dd > 45) return { frase: `No arquivo. Sem verificação há ${nDias(dd)}`, secundaria: 'O que fazer: religar a casa; nada mais.', gravidade: 'vermelho', regua: rArq('octogono'), grupo: 0 } // m11a2
  if (dd > 21) return { frase: `No arquivo. Sem verificação há ${nDias(dd)}`, secundaria: 'O que fazer: religar a casa; nada mais.', gravidade: 'ambar', regua: rArq('triangulo'), grupo: 0 } // m11a
  return { frase: `No arquivo desde ${dmy(dropped)}${nas ? `. Verificado em ${dmy(nas)}` : ''}`, gravidade: 'nenhuma', regua: rArq(), grupo: 4 } // m11
}

function mesDestacado(c: Ctx, r: LinhaMesLida, cl: Classe): Res {
  const mes = nomeDoMes(r.month)
  const det = tms(r.detached_at)!
  const dias = Math.floor((c.agora - det) / DAY)
  const tent = r.b2_last_attempt_result
  const motivos: string[] = []
  if (r.manifest_nas_withdrawn_at) motivos.push('o arquivo do NAS está diferente')
  if (tent && ['divergente', 'arquivo_ausente', 'nao_decifra'].includes(tent)) motivos.push(`o do B2 falhou na conferência${tms(r.b2_last_attempt_at) ? ` de ${dmy(tms(r.b2_last_attempt_at)!)}` : ''}`)
  if (motivos.length) { // m9 e m9b
    const dd = dias >= 14
    return { frase: `A cópia de ${mes} precisa ser refeita (${motivos.join(' e ')}), e para isso o mês tem de voltar ao banco. Traga de volta.`, gravidade: dd ? 'vermelho' : 'ambar', regua: r2(dd ? 'octogono' : 'triangulo', 'pontilhado'), grupo: 0 }
  }
  if (dias > 14) { // m8b
    return { frase: `Saiu das telas há ${nDias(dias)} e o espaço ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. Libere o espaço ou traga o mês de volta`, gravidade: 'ambar', regua: r2('visto', 'triangulo'), grupo: 0 }
  }
  if (dias >= cl.wait) return { frase: 'Pronto para liberar o espaço. Ainda dá para trazer de volta', gravidade: 'nenhuma', regua: r2('visto', 'pontilhado'), grupo: 1 } // m8a
  return { // m8
    frase: `Saiu das telas em ${dmy(det)}. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de ${dmy(det + cl.wait * DAY)} você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo`,
    gravidade: 'nenhuma', regua: r2('visto', 'pontilhado'), grupo: 1,
  }
}

function mesOnline(c: Ctx, r: LinhaMesLida, pg: Prog | undefined, recs: Rec[], cl: Classe, tipo: 'horaria' | 'serie' | 'texto'): Res {
  const mes = nomeDoMes(r.month)
  if (r.unsealed_at) { // pr2 e m10b
    const frase = r.unsealed_reason === 'conteudo_mudou' ? 'O dado deste mês mudou depois da cópia. Será copiado de novo'
      : r.unsealed_reason === 'unidade_nova' ? 'Chegou dado novo neste mês depois da cópia. Será copiado de novo' : 'Este mês será copiado de novo'
    return neutro(frase)
  }
  const selado = r.sealed_at != null
  const devidoMs = spDateStart(r.devido_em)
  if (selado && (r.sealed_kind === 'vazio_conferido' || r.sealed_kind === 'sem_dado_a_guardar')) { // m14
    return { frase: `Sem registro neste mês (conferimos em ${dmy(tms(r.sealed_at)!)})`, gravidade: 'nenhuma', regua: [{ rotulo: 'Sem registro', curto: 'Vazio', forma: 'zero' }], grupo: 3 }
  }
  if (!selado) {
    if (r.month === c.mesCorrente) return neutro('Em coleta', ['pontilhado']) // m1
    if (c.hojeMs < devidoMs) return neutro(`Fechado. Cópia a partir de ${dmy(devidoMs)}`) // m2
    if (!pg) return { frase: 'O andamento da cópia deste mês não foi medido', gravidade: 'nao_medido', regua: r5(['hachura']), grupo: 3 }
    if (pg.canais_esperados === 0) return { frase: 'Sem canais neste mês', gravidade: 'nenhuma', regua: [{ rotulo: 'Sem canais', curto: 'Sem canais', forma: 'zero' }], grupo: 3 }
    if (pg.canais_prontos < pg.canais_esperados) {
      const atraso = Math.round((c.hojeMs - devidoMs) / DAY) // mesmas faixas de obs_archive_atraso (m3b: > 5 âmbar, > 30 vermelho)
      const grav: Gravidade = atraso > 30 ? 'vermelho' : atraso > 5 ? 'ambar' : 'nenhuma'
      const forma: Forma = grav === 'vermelho' ? 'octogono' : grav === 'ambar' ? 'triangulo' : pg.canais_prontos > 0 ? 'barra' : 'pontilhado'
      const X = pg.canais_prontos
      const frase = X > 0 ? `Copiando: ${X} de ${pg.canais_esperados} canais${atraso > 5 ? `. Cópia atrasada há ${nDias(atraso)}` : ''}` // m3, pa1, pa2
        : atraso >= 1 ? `Cópia atrasada há ${nDias(atraso)}` : `Copiando: 0 de ${pg.canais_esperados} canais`
      return { frase, gravidade: grav, regua: r5([forma]), grupo: grav === 'nenhuma' ? 3 : 0 }
    }
  }
  // copiado: a cadeia NAS -> B2 -> recuperação -> prazo -> pode sair
  const nasMs = tms(r.nas_attested_at)
  const nasH = nasMs == null ? null : Math.floor((c.agora - nasMs) / H)
  if (r.manifest_nas_withdrawn_at) { // pr1
    return { frase: `O arquivo de ${mes} está diferente do que o site guardou. Nada sai deste mês até resolver`, gravidade: 'vermelho', regua: r5(['octogono']), grupo: 0 }
  }
  const forjaOk = tms(r.b2_forja_ok_at), donoOk = tms(r.b2_dono_ok_at), diverg = tms(r.b2_forja_diverged_at)
  const forjaValida = forjaOk != null && c.agora - forjaOk < 7 * DAY
  const donoValida = donoOk != null && c.agora - donoOk < 35 * DAY
  const nasForma: Forma = nasH == null ? 'pontilhado' : nasH >= 24 ? 'triangulo' : 'visto'
  const tent = r.b2_last_attempt_result
  const tentEm = tms(r.b2_last_attempt_at)
  const tentVia = r.b2.ultima_tentativa?.via === 'dono' ? 'por você' : 'pela forja'
  const jaConferiu = forjaOk != null || donoOk != null
  const redB2 = (frase: string): Res => ({ frase, gravidade: 'vermelho', regua: r5([nasForma === 'triangulo' ? 'triangulo' : 'visto', 'octogono']), grupo: 0 })
  if (diverg != null && (forjaOk == null || diverg > forjaOk)) { // pd2
    return redB2(`A forja disse que o arquivo de ${mes} no B2 está ruim, e o seu Mac disse que está bom. Nada sai sozinho deste mês. O que fazer: rode a conferência de novo no seu Mac (ver o comando); se a diferença continuar, avise quem cuida do site.`)
  }
  if (tent && ['divergente', 'arquivo_ausente', 'nao_decifra'].includes(tent)) { // pt1
    const motivo = tent === 'arquivo_ausente' ? ': faltam arquivos no B2' : tent === 'divergente' ? ': o arquivo no B2 está diferente' : ': o arquivo no B2 não abre'
    const ant = Math.max(forjaOk ?? 0, donoOk ?? 0)
    return redB2(`Última tentativa de conferir o B2: ${tentEm ? dmy(tentEm) : 'sem data'}, ${tentVia}, falhou${motivo}. ${ant ? `A conferência de ${dmy(ant)} não vale mais. ` : ''}Nada sai deste mês até uma conferência boa. A forja tenta de novo amanhã, sozinha.`)
  }
  if (jaConferiu && !forjaValida && !donoValida) { // pb2
    const ref = Math.max(forjaOk ?? 0, donoOk ?? 0)
    return redB2(`A forja não confere o B2 há ${nDias(Math.floor((c.agora - (forjaOk ?? ref)) / DAY))}. Nada sai deste mês até uma conferência boa. O que fazer: veja se a casa está respondendo; se a forja não puder conferir, rode a conferência no seu Mac (ver o comando).`)
  }
  if (nasH != null && nasH >= 24) { // pv
    return { frase: `Cópia sem verificação há ${nasH} horas`, gravidade: 'ambar', regua: r5(['triangulo']), grupo: 0 }
  }
  const ambarB2 = (frase: string): Res => ({ frase, gravidade: 'ambar', regua: r5([nasForma, 'triangulo']), grupo: 0 })
  if (tent && ['chave_ausente', 'sem_acesso'].includes(tent)) { // pt2
    const valida = forjaValida ? forjaOk! + 7 * DAY : donoValida ? donoOk! + 35 * DAY : null
    const ate = forjaValida ? forjaOk! : donoOk
    return ambarB2(`A conferência${tentEm ? ` de ${dmy(tentEm)}` : ''} não pôde ser feita: ${tent === 'chave_ausente' ? 'falta a chave' : 'sem acesso ao B2'}. ${valida && ate ? `A conferência de ${dmy(ate)} continua valendo até ${dmy(valida)}.` : 'Nenhuma conferência vale agora.'}`)
  }
  if (donoValida && !forjaValida) { // m5a
    return ambarB2(`No B2, conferido por você em ${dmy(donoOk!)} (vale até ${dmy(donoOk! + 35 * DAY)}). ${forjaOk != null ? `A forja não confere desde ${dmy(forjaOk)}.` : 'A forja ainda não conferiu.'}`)
  }
  if (forjaValida && !donoValida && Math.floor((c.agora - forjaOk!) / DAY) >= 6) { // pb1
    return ambarB2(`A forja não confere o B2 há ${nDias(Math.floor((c.agora - forjaOk!) / DAY))}. A conferência de ${dmy(forjaOk!)} vale até ${dmy(forjaOk! + 7 * DAY)}.`)
  }
  const b2Visto = forjaValida || donoValida
  if (!b2Visto) { // só o NAS
    if (nasMs == null) return neutro(selado ? 'Copiado. Aguardando a primeira verificação do NAS' : 'Cópia recebida. Aguardando a primeira verificação do NAS')
    if (tent === 'aguardando_b2') return neutro('Aguardando a cópia para o B2', ['visto']) // pt3
    return neutro(`No NAS, verificado ${quando(c, nasMs)}`, ['visto']) // m4
  }
  const maisRecenteForja = forjaValida && (!donoValida || forjaOk! >= donoOk!)
  const fraseB2 = maisRecenteForja ? `No B2, conferido pela forja ${quando(c, forjaOk!)}` : `No B2, conferido por você em ${dmy(donoOk!)}` // m5, m5b
  // recuperação
  if (recs.length === 0 || recs.some(x => x.schema_fp_atual == null)) return neutro(fraseB2, ['visto', 'visto', 'hachura']) // tabela ausente: não medido
  if (recs.some(x => x.done_at == null)) return neutro(fraseB2, ['visto', 'visto']) // ainda não testada: não é falha (ps4)
  const feita = Math.min(...recs.map(x => tms(x.done_at)!))
  const idade = (c.agora - feita) / DAY
  const amb = (frase: string): Res => ({ frase, gravidade: 'ambar', regua: r5(['visto', 'visto', 'triangulo']), grupo: 0 })
  if (recs.some(x => x.schema_fp !== x.schema_fp_atual)) return amb('Refaça o teste de recuperação: o formato dos dados mudou desde o último teste') // ps2 (triângulo, não octógono: decisão do plano)
  if (idade >= 180) return amb(`Refaça o teste de recuperação: o último é de ${dmy(feita)} e vale 180 dias`) // ps1
  if (180 - idade <= 30) return amb(`O teste de recuperação de ${NOME_DO_TIPO[tipo]} vence em ${dmy(feita + 180 * DAY)}. Refaça antes disso, no seu Mac (ver o comando): sem ele, nada desta parte sai.`) // ps3
  const saidaEm = spDateStart(maisMeses(r.month, 1 + cl.janela))
  if (c.hojeMs >= saidaEm) return { frase: 'Pode sair', gravidade: 'nenhuma', regua: r5(['visto', 'visto', 'visto', 'visto', 'visto']), grupo: 2 } // m7
  return neutro(`Recuperação testada em ${dmy(feita)}. Pode sair em ${dmy(saidaEm)}.`, ['visto', 'visto', 'visto']) // m6
}

// ---------- a casa ----------
const PROGRAMAS_ESPERADOS = ['copiador', 'conferir_b2'] as const
const NOME_DO_PROGRAMA: Record<string, string> = { copiador: 'O copiador', conferir_b2: 'A conferência do B2', respondedor: 'O respondedor' }
type Batimento = Partial<PaginaLida['casa'][number]> & { worker: string }

/** O sinal de cada programa é `max(last_poll_at, updated_at)`: `last_poll_at` só o copiador grava, os outros dois só `updated_at` (m3b, obs_archive_heartbeat_write).
 *  Limiares de 24 h e 36 h: a varredura do NAS abre com `nas_checked_at` anterior a 24 h (heartbeat_write, m3b); 36 h é o corte do octógono (04 §14.1/11.6).
 *  Precedência: não respondeu (octógono) > NAS fora > NAS cheio > não respondeu (triângulo) > NAS sem verificar > programa sem sinal > responde. */
export function casaDe(batimentos: PaginaLida['casa'], vermelhos: readonly string[], agora: number): Casa {
  const sinais = new Map<string, number>()
  let copiador: Batimento | undefined
  for (const b of batimentos as Batimento[]) {
    const s = Math.max(tms(b.last_poll_at) ?? -Infinity, tms(b.updated_at) ?? -Infinity)
    if (Number.isFinite(s)) sinais.set(b.worker, s)
    if (b.worker === 'copiador') copiador = b
  }
  if (sinais.size === 0) return { estado: 'nunca_deu_sinal', desde: null, forma: 'triangulo', frase: 'A casa ainda não deu sinal' }
  const maisVelho = [...sinais.entries()].sort((a, b) => a[1] - b[1])[0]!
  const idadeH = (agora - maisVelho[1]) / H
  const naoRespondeu = (forma: Forma): Casa => ({ estado: 'nao_respondeu', desde: maisVelho[1], forma, frase: `A casa não respondeu desde ${dmhm(maisVelho[1])}. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.` })
  if (idadeH > 36) return naoRespondeu('octogono')
  const sinalCopiador = sinais.get('copiador')
  if (copiador && copiador.nas_ok === false) {
    const d = tms(copiador.nas_checked_at) ?? sinalCopiador ?? null
    return { estado: 'nas_fora', desde: d, forma: 'triangulo', frase: `O NAS não está acessível pela forja${d ? ` desde ${dmhm(d)}` : ''}. Nada se perde: o mês só sai quando o NAS voltar. O que fazer: confira se o NAS está ligado e se a pasta do arquivo está montada na forja (ver os comandos).` }
  }
  if (vermelhos.some(v => v.startsWith('nas_80:'))) return { estado: 'nas_cheio', desde: null, forma: 'triangulo', frase: 'O NAS está cheio: a cópia não coube. Nada se perde: o mês só sai depois que houver espaço. O que fazer: libere espaço no NAS (ver os comandos). A cópia é refeita sozinha em até 12 horas.' }
  if (idadeH > 24) return naoRespondeu('triangulo')
  if (copiador) {
    const v = tms(copiador.nas_checked_at)
    const vh = v == null ? null : (agora - v) / H
    if (vh == null || vh > 24) {
      return { estado: 'nas_sem_verificar', desde: v, forma: vh != null && vh > 36 ? 'octogono' : 'triangulo', frase: v == null ? 'O NAS ainda não foi verificado' : `O NAS não é verificado desde ${dmhm(v)}` }
    }
  }
  const falta = PROGRAMAS_ESPERADOS.find(w => !sinais.has(w))
  if (falta) return { estado: 'programa_sem_sinal', desde: null, forma: 'triangulo', frase: `${NOME_DO_PROGRAMA[falta]} ainda não deu sinal` }
  return { estado: 'responde', desde: maisVelho[1], forma: 'visto', frase: 'A casa responde' }
}

// ---------- a página ----------
const semCasa: Casa = { estado: 'nao_medida', desde: null, forma: 'hachura', frase: 'A casa não foi medida' }
function modelo(texto: string, forma: Forma, ligado: boolean): ModeloPagina {
  return { resumo: { texto, forma }, casa: semCasa, tipos: [], problemas: [], mesesAFrente: [], teste: null, ligado }
}
/** O que a página mostra com o arquivo desligado. */
export function modeloDesligado(): ModeloPagina { return modelo('O arquivo está desligado neste site: nada está sendo copiado nem tirado', 'pontilhado', false) }
/** Leitura que falhou: nunca lista vazia, nunca "nada precisa de você". */
export function modeloNaoLido(porque: 'funcao_ausente' | 'erro_do_banco' | 'fora_do_esquema'): ModeloPagina {
  return modelo(porque === 'funcao_ausente' ? 'O arquivo ainda não foi instalado neste banco.' : 'Não foi possível ler o estado do arquivo', 'hachura', true)
}

function mesesAFrente(p: PaginaLida): ModeloPagina['mesesAFrente'] {
  return p.meses_a_frente.map(m => {
    const tabela = NOME_DA_TABELA[m.table_name] ?? m.table_name
    const n = m.months_ahead
    if (n == null) return { tabela, frase: 'Tabela ainda não particionada: não medido', forma: 'hachura' as const }
    if (n === -1) return { tabela, frase: 'O mês corrente não existe nesta tabela. Rode a criação de partições.', forma: 'octogono' as const }
    if (n >= 6) return { tabela, frase: `${n} meses à frente`, forma: 'visto' as const }
    if (n >= 3) return { tabela, frase: `Só ${n} meses à frente. Rode a criação de partições.`, forma: 'triangulo' as const }
    return { tabela, frase: `Só ${n} ${n === 1 ? 'mês à frente' : 'meses à frente'}. Rode a criação de partições já.`, forma: 'octogono' as const }
  })
}

function linhaDeTeste(c: Ctx, t: PaginaLida['teste']['meses'][number]): LinhaDoMes {
  const frase = t.dropped_at ? 'Saiu do banco (dado de teste)' : t.detached_at ? 'Saiu das telas (dado de teste)' : t.b2_attested_at ? 'No B2 (dado de teste)'
    : t.nas_attested_at ? 'No NAS (dado de teste)' : t.sealed_at ? 'Copiado (dado de teste)' : 'Em teste'
  void c
  return { chave: 'ensaio:' + t.month, mesNome: nomeDoMes(t.month), regua: r5([]), frase, secundaria: null, gravidade: 'nenhuma', sobeAoTopo: false }
}

export function montarPagina(p: PaginaLida, o: { arquivoLigado: boolean }): ModeloPagina {
  if (!o.arquivoLigado) return modeloDesligado()
  const agora = Date.parse(p.lido_em) // um relógio só: o do banco
  const c: Ctx = { agora, hoje: p.hoje, hojeMs: spDateStart(p.hoje), mesCorrente: p.hoje.slice(0, 7) + '-01', p }
  const casa = casaDe(p.casa, p.vermelhos, agora)
  const TIPOS = ['horaria', 'serie', 'texto'] as const
  const tipos: CartaoDoTipo[] = []
  for (const tipo of TIPOS) {
    const info = p.classes.find(k => k.class === tipo)
    if (!info) continue
    const cl: Classe = { wait: info.wait_days, janela: info.window_months }
    const recs = p.recuperacao.filter(r => r.class === tipo)
    const porMes = new Map<string, LinhaMesLida[]>()
    for (const r of p.meses.filter(m => m.class === tipo)) porMes.set(r.month, [...(porMes.get(r.month) ?? []), r])
    if (porMes.size === 0) continue // a grade sempre traz as classes liberadas; classe sem nenhuma linha lida não vira cartão vazio
    const itens = [...porMes.entries()].map(([mes, rows]) => {
      const r = juntarTabelas(rows)
      const pg = p.progresso.find(x => x.class === tipo && x.month === mes)
      const res = r.dropped_at ? mesDescartado(c, r) : r.detached_at ? mesDestacado(c, r, cl) : mesOnline(c, r, pg, recs, cl, tipo)
      const linha: LinhaDoMes = {
        chave: `${tipo}:${mes}`, mesNome: nomeDoMes(mes), regua: res.regua, frase: res.frase, secundaria: res.secundaria ?? null, gravidade: res.gravidade,
        sobeAoTopo: res.gravidade === 'ambar' || res.gravidade === 'vermelho',
      }
      return { linha, grupo: res.grupo, mes }
    })
    // ordem: o que precisa do dono, o que já saiu das telas, o que pode sair, os online (do mais novo ao mais velho), o que está no arquivo
    itens.sort((a, b) => a.grupo - b.grupo || (a.mes < b.mes ? 1 : -1))
    const linhas = itens.map(i => i.linha)
    const noArquivo = itens.filter(i => i.grupo === 4)
    const anos = new Map<number, { meses: number; todosConferidos: boolean }>()
    for (const i of noArquivo) {
      const ano = Number(i.mes.slice(0, 4)); const a = anos.get(ano) ?? { meses: 0, todosConferidos: true }
      anos.set(ano, { meses: a.meses + 1, todosConferidos: a.todosConferidos && i.linha.gravidade === 'nenhuma' })
    }
    const atencao = linhas.filter(l => l.sobeAoTopo).length
    const online = itens.length - noArquivo.length
    tipos.push({
      tipo, titulo: NOME_DO_TIPO[tipo],
      resumo: `${online} ${online === 1 ? 'mês online' : 'meses online'}, ${noArquivo.length} no arquivo${atencao ? `, ${atencao} ${atencao === 1 ? 'pede' : 'pedem'} atenção` : ''}`,
      linhas, anosNoArquivo: [...anos.entries()].sort((a, b) => b[0] - a[0]).map(([ano, v]) => ({ ano, ...v })),
    })
  }
  const problemas = p.vermelhos.map(descreverVermelho)
  const todas = tipos.flatMap(t => t.linhas)
  const verm = todas.filter(l => l.gravidade === 'vermelho').length + problemas.filter(x => x.forma === 'octogono').length
  const amb = todas.filter(l => l.gravidade === 'ambar').length + problemas.filter(x => x.forma === 'triangulo').length
  const algoCopiado = todas.some(l => l.regua.some(e => e.forma === 'visto' || e.forma === 'arquivo' || e.forma === 'barra'))
  let resumo: ModeloPagina['resumo']
  if (casa.estado !== 'responde') resumo = { texto: casa.frase, forma: casa.forma }
  else if (verm > 0) resumo = { texto: `O arquivo tem ${verm} ${verm === 1 ? 'problema' : 'problemas'} que ${verm === 1 ? 'precisa' : 'precisam'} de você`, forma: 'octogono' }
  else if (amb > 0) resumo = { texto: `O arquivo tem ${amb} ${amb === 1 ? 'ponto' : 'pontos'} de atenção`, forma: 'triangulo' }
  else if (!algoCopiado) {
    const prim = p.meses.length ? [...p.meses].sort((a, b) => (a.month < b.month ? -1 : 1))[0]! : null
    const ini = p.classes.map(k => k.first_month).filter((x): x is string => x != null).sort()[0] ?? '2026-10-01'
    const mesIni = prim ? prim.month : ini
    const devido = prim ? prim.devido_em : (() => { const f = maisMeses(ini, 1); return spDateOf(spDateStart(f) - DAY + 28 * DAY) })()
    resumo = { texto: `A primeira cópia é a de ${MESES[Number(mesIni.slice(5, 7)) - 1]}, a partir de ${dm(spDateStart(devido))}`, forma: 'pontilhado' }
  } else {
    const arq = tipos.reduce((s, t) => s + t.anosNoArquivo.reduce((x, a) => x + a.meses, 0), 0)
    const onl = todas.length - arq
    resumo = { texto: `Tudo em dia: ${arq} ${arq === 1 ? 'mês' : 'meses'} no arquivo e ${onl} online, nada precisa de você`, forma: 'visto' }
  }
  const t = p.teste
  const teste = t.aberto || t.encerrado_em ? { faixa: t.aberto ? `Dado de teste: ${t.meses.length} ${t.meses.length === 1 ? 'mês' : 'meses'}` : 'Dado de teste encerrado', linhas: t.meses.map(m => linhaDeTeste(c, m)), encerradoEm: tms(t.encerrado_em) } : null
  return { resumo, casa, tipos, problemas, mesesAFrente: mesesAFrente(p), teste, ligado: true }
}
