/** Manutenção M5, Tarefa 7 (04 §14.2, item 39): o estado de cada mês e de cada problema da página do Arquivo. PURO: sem relógio da máquina, sem rede.
 *  O tempo da página é o do banco (`lido_em`, Phil M5): `montarPagina` não recebe `agora`. Tempo em ms; texto só na borda das frases.
 *  Frases copiadas de `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/arq-dados.js` (MES = estado do mês, PROB = problema), com os números
 *  de exemplo trocados por parâmetros. Onde o dado ainda não chega à página (porcentagem liberada, canal removido em risco, "voltou ao banco"), a frase fica de fora (M6/M9). */
import type { ReactNode } from 'react'
import { DAY, H, spDateOf, spDateStart } from '../time'
import type { PaginaLida, LinhaMesLida } from './pagina'
import { agruparVermelhos, descreverVermelho, type LinhaDeProblema } from './vermelhos'
import { INFO } from './info'

export type { LinhaDeProblema } from './vermelhos'
/** A frase da linha de um mês que voltou ao banco fora de ordem (M6 trata; a tela só avisa, em triângulo âmbar). */
export const FRASE_FORA_DE_ORDEM = 'Voltou fora de ordem'
/** A faixa do grupo "Dado de teste" (mockup 19, TESTE-1). */
export const FAIXA_DO_TESTE = 'Dado de teste. Isto é um mês fictício, criado para você testar o caminho inteiro sem tocar no dado real. Nada que sair daqui libera espaço de verdade.'
export type Forma = 'visto' | 'pontilhado' | 'pontilhado_ambar' | 'triangulo' | 'octogono' | 'hachura' | 'arquivo' | 'zero' | 'barra'
export type Etapa = { rotulo: string; curto: string; forma: Forma }
export type Gravidade = 'nenhuma' | 'ambar' | 'vermelho' | 'nao_medido'
export interface LinhaDoMes {
  chave: string; mesNome: string; regua: Etapa[]; frase: string; secundaria: string | null; gravidade: Gravidade; sobeAoTopo: boolean
  /** O que fazer, em poucas palavras, para a linha vermelha (entra no link da frase do topo). */
  acao?: string | null
  /** O texto do ⓘ "Por que se espera" (A3, Logan r1). */
  info?: string | null
  /** O encaixe da M6: o botão (Sair do banco, Liberar, Trazer de volta) entra aqui; a M5 nunca o preenche. */
  acoes?: ReactNode
  /** Para o encaixe da M6 (D-M5-14): a tabela cuja saída o botão comanda, o mês ('AAAA-MM-01'), onde o mês está agora e a espera da política em dias. A M5 só os carrega. */
  tabela?: string; mes?: string; fora?: 'online' | 'destacado' | 'descartado'; esperaDias?: number | null
  /** M6a T12 r1 (Phil C1): a saída é por tabela, não pela classe. Uma entrada por tabela comandada, lida de cada linha ANTES de `juntarTabelas` (o `fora` juntado só avança quando as duas saem). */
  saidas?: { tabela: string; fora: 'online' | 'destacado' | 'descartado' }[]
}
/** Um mês que já saiu do banco e só aparece dentro do `<details>` do ano (A2, Logan r1 / Naksu N1). `verificadoEm`: ms, ou nulo se nunca conferido. */
export interface MesNoArquivo { mesNome: string; verificadoEm: number | null }
export interface CartaoDoTipo { tipo: 'horaria' | 'serie' | 'texto'; titulo: string; resumo: string; linhas: LinhaDoMes[]; anosNoArquivo: { ano: number; meses: number; todosConferidos: boolean; semConferencia?: number; itens?: MesNoArquivo[] }[]; acoes?: ReactNode }
/** A frase do topo em partes: texto solto ou link para uma âncora da página. */
export type ParteDaFrase = string | { texto: string; ancora: string }
export interface Topo { texto: string; forma: Forma; partes?: ParteDaFrase[] }
/** A âncora (id) da linha de um mês: tipo e mês. */
export const ancoraDoMes = (chave: string): string => 'mes-' + chave.replace(/[^a-z0-9-]/gi, '-')
export interface Casa { estado: 'responde' | 'nao_respondeu' | 'nunca_deu_sinal' | 'programa_sem_sinal' | 'programa_atrasado' | 'nas_fora' | 'nas_cheio' | 'nas_sem_verificar' | 'nao_medida'; desde: number | null; forma: Forma; frase: string }
export interface ModeloPagina {
  /** O dia de hoje em SP ('AAAA-MM-DD'), do relógio do banco; o encaixe da M6 o usa nas datas. Ausente nos modelos sem leitura. */
  hojeSP?: string
  resumo: Topo; /** "Além disso: …": o que perdeu o cabeçalho para a casa, nunca some (A1c). */ alem?: Topo | null; casa: Casa; tipos: CartaoDoTipo[]; problemas: LinhaDeProblema[]; mesesAFrente: { tabela: string; frase: string; forma: Forma }[]
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
export const NOME_DA_TABELA: Record<string, string> = { competitor_video_daily: 'Views por dia', competitor_video_early: 'Primeiras horas', competitor_video_hourly: 'Views por hora', competitor_video_comments: 'Comentários e dados antigos do YouTube', competitor_video_comment_marks: 'Comentários e dados antigos do YouTube', competitor_raw: 'Comentários e dados antigos do YouTube' }
const NOME_DO_TIPO: Record<'horaria' | 'serie' | 'texto', string> = { horaria: 'Views por hora', serie: 'Views por dia', texto: 'Comentários e dados antigos do YouTube' }

interface Ctx { agora: number; hoje: string; hojeMs: number; mesCorrente: string; p: PaginaLida }
const quando = (c: Ctx, ms: number): string => (spDateOf(ms) === c.hoje ? `hoje às ${hm(ms)}` : `em ${dmy(ms)}`)

// ---------- a régua ----------
const NOMES5: readonly (readonly [string, string])[] = [['No NAS', 'No NAS'], ['No B2', 'No B2'], ['Recuperação', 'Recup.'], ['Prazo', 'Prazo'], ['Pode sair', 'Pode sair']]
const r5 = (f: Forma[]): Etapa[] => NOMES5.map(([rotulo, curto], i) => ({ rotulo, curto, forma: f[i] ?? 'pontilhado' }))
const r2 = (a: Forma, b: Forma): Etapa[] => [{ rotulo: 'Saiu das telas', curto: 'Saiu', forma: a }, { rotulo: 'Espaço liberado', curto: 'Espaço', forma: b }]
const rArq = (problema?: Forma): Etapa[] => [{ rotulo: 'No arquivo', curto: 'Arquivo', forma: 'arquivo' }, ...(problema ? [{ rotulo: 'Verificação', curto: 'Verif.', forma: problema }] : [])]
interface Res { frase: string; secundaria?: string | null; acao?: string; info?: string; gravidade: Gravidade; regua: Etapa[]; grupo: 0 | 1 | 2 | 3 | 4 }
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

interface Classe { wait: number; janela: number; margem: number }
type Prog = PaginaLida['progresso'][number]
type Rec = PaginaLida['recuperacao'][number]

// ---------- o estado de um mês ----------
function mesDescartado(c: Ctx, r: LinhaMesLida): Res {
  const mes = nomeDoMes(r.month)
  const dropped = tms(r.dropped_at)!
  const nas = tms(r.nas_attested_at)
  const tent = r.b2_last_attempt_result
  if (r.manifest_nas_withdrawn_at) { // arq-dados.js:m11b
    return { frase: `O arquivo de ${mes} no NAS está ausente ou diferente. Este mês já saiu do banco: a cópia que resta é a do B2. Confira o B2 agora e recupere dele (ver os comandos)`, acao: 'conferir o B2', gravidade: 'vermelho', regua: rArq('octogono'), grupo: 0 }
  }
  if (r.b2_withdrawn_at || (tent && ['divergente', 'arquivo_ausente', 'nao_decifra'].includes(tent))) { // m11c
    const em = tms(r.b2_last_attempt_at) ?? tms(r.b2_withdrawn_at)
    return { frase: `A cópia de ${mes} no B2 falhou na conferência${em ? ` de ${dmy(em)}` : ''}. A cópia que resta é a do NAS. Rode a conferência de novo (ver o comando)`, acao: 'rodar a conferência do B2', gravidade: 'vermelho', regua: rArq('octogono'), grupo: 0 }
  }
  const dd = Math.floor((c.agora - (nas ?? dropped)) / DAY)
  if (dd > 45) return { frase: `No arquivo. Sem verificação há ${nDias(dd)}`, secundaria: 'O que fazer: religar a casa; nada mais.', acao: 'religar a casa', gravidade: 'vermelho', regua: rArq('octogono'), grupo: 0 } // m11a2
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
    return { frase: `A cópia de ${mes} precisa ser refeita (${motivos.join(' e ')}), e para isso o mês tem de voltar ao banco. Traga de volta.`, acao: 'trazer de volta ao banco', gravidade: dd ? 'vermelho' : 'ambar', regua: r2(dd ? 'octogono' : 'triangulo', 'pontilhado'), grupo: 0 }
  }
  if (dias > 14) { // m8b
    return { frase: `Saiu das telas há ${nDias(dias)} e o espaço ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. Libere o espaço ou traga o mês de volta.`, gravidade: 'ambar', regua: r2('visto', 'triangulo'), grupo: 0 }
  }
  if (dias >= cl.wait) return { frase: 'Pronto para liberar o espaço. Ainda dá para trazer de volta', gravidade: 'nenhuma', regua: r2('visto', 'pontilhado'), grupo: 1 } // m8a
  return { // m8
    frase: `Saiu das telas em ${dmy(det)}. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de ${dmy(det + cl.wait * DAY)} você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo.`,
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
    if (c.hojeMs < devidoMs) return { ...neutro(`Fechado. Cópia a partir de ${dmy(devidoMs)}`), info: INFO(`A cópia espera o mês parar de mudar (${nDias(cl.margem)} depois de fechar), para não precisar ser refeita.`) } // m2
    if (!pg) return { frase: 'O andamento da cópia deste mês não foi medido', gravidade: 'nao_medido', regua: r5(['hachura']), grupo: 3 }
    if (pg.canais_esperados === 0) return { frase: 'Sem canais neste mês', gravidade: 'nenhuma', regua: [{ rotulo: 'Sem canais', curto: 'Sem canais', forma: 'zero' }], grupo: 3 }
    if (pg.canais_prontos < pg.canais_esperados) {
      const atraso = Math.round((c.hojeMs - devidoMs) / DAY) // mesmas faixas de obs_archive_atraso (m3b: > 5 âmbar, > 30 vermelho)
      const grav: Gravidade = atraso > 30 ? 'vermelho' : atraso > 5 ? 'ambar' : 'nenhuma'
      const forma: Forma = grav === 'vermelho' ? 'octogono' : grav === 'ambar' ? 'triangulo' : pg.canais_prontos > 0 ? 'barra' : 'pontilhado'
      const X = pg.canais_prontos
      const frase = X > 0 ? `Copiando: ${X} de ${pg.canais_esperados} canais${atraso > 5 ? `. Cópia atrasada há ${nDias(atraso)}` : ''}` // m3, pa1, pa2
        : atraso >= 1 ? `Cópia atrasada há ${nDias(atraso)}` : `Copiando: 0 de ${pg.canais_esperados} canais`
      return { frase, acao: grav === 'vermelho' ? 'ver a cópia atrasada' : undefined, gravidade: grav, regua: r5([forma]), grupo: grav === 'nenhuma' ? 3 : 0 }
    }
  }
  // copiado: a cadeia NAS -> B2 -> recuperação -> prazo -> pode sair
  const nasMs = tms(r.nas_attested_at)
  const nasH = nasMs == null ? null : Math.floor((c.agora - nasMs) / H)
  if (r.manifest_nas_withdrawn_at) { // pr1
    return { frase: `O arquivo de ${mes} está diferente do que o site guardou. Nada sai deste mês até resolver`, acao: 'ver o arquivo diferente', gravidade: 'vermelho', regua: r5(['octogono']), grupo: 0 }
  }
  const forjaOk = tms(r.b2_forja_ok_at), donoOk = tms(r.b2_dono_ok_at), diverg = tms(r.b2_forja_diverged_at)
  const forjaValida = forjaOk != null && c.agora - forjaOk < 7 * DAY
  const donoValida = donoOk != null && c.agora - donoOk < 35 * DAY
  const nasForma: Forma = nasH == null ? 'pontilhado' : nasH >= 24 ? 'triangulo' : 'visto'
  const tent = r.b2_last_attempt_result
  const tentEm = tms(r.b2_last_attempt_at)
  const tentVia = r.b2.ultima_tentativa?.via === 'dono' ? 'por você' : 'pela forja'
  const jaConferiu = forjaOk != null || donoOk != null
  const redB2 = (frase: string): Res => ({ frase, acao: 'conferir o B2', gravidade: 'vermelho', regua: r5([nasForma === 'triangulo' ? 'triangulo' : 'visto', 'octogono']), grupo: 0 })
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
const NOME_DO_PROGRAMA: Record<string, string> = { copiador: 'O copiador', conferir_b2: 'A conferência do B2' }
/** As cinco chaves que `casaDe` lê: o aviso leve do chrome traz só estas, e o compilador avisa se alguém passar a ler outra (Phil M6, Yannis M-3). */
type Batimento = Pick<PaginaLida['casa'][number], 'worker' | 'last_poll_at' | 'updated_at' | 'nas_ok' | 'nas_checked_at'>

/** Prazos em horas, um por programa (Phil I2 + Gio D2, 27/10). A casa é o COPIADOR (bate a cada 12 h): triângulo acima de 18 h (o mockup pc1 mostra o triângulo a ~20,5 h),
 *  octógono acima de 36 h (04 §14.1/11.6). A conferência do B2 bate UMA vez por dia, no FIM da execução (conferir.py): 30 h (um dia mais 6 h de duração) e 54 h, com frase
 *  própria, e NÃO é "a casa não respondeu" (não manda religar a forja). O respondedor não é periódico e fica fora. */
export const PRAZOS_DA_CASA = { copiadorTriangulo: 18, copiadorOctogono: 36, conferirTriangulo: 30, conferirOctogono: 54 } as const

/** O sinal de cada programa é `max(last_poll_at, updated_at)`: `last_poll_at` só o copiador grava, os outros dois só `updated_at` (m3b, obs_archive_heartbeat_write).
 *  A varredura do NAS abre com `nas_checked_at` anterior a 24 h (heartbeat_write, m3b).
 *  Precedência: não respondeu (octógono) > NAS fora > NAS cheio > não respondeu (triângulo) > conferência atrasada > NAS sem verificar > programa sem sinal > responde. */
export function casaDe(batimentos: readonly Batimento[], vermelhos: readonly string[], agora: number): Casa {
  const sinais = new Map<string, number>()
  let copiador: Batimento | undefined
  for (const b of batimentos) {
    const s = Math.max(tms(b.last_poll_at) ?? -Infinity, tms(b.updated_at) ?? -Infinity)
    if (Number.isFinite(s)) sinais.set(b.worker, s)
    if (b.worker === 'copiador') copiador = b
  }
  if (sinais.size === 0) return { estado: 'nunca_deu_sinal', desde: null, forma: 'triangulo', frase: 'A casa ainda não deu sinal' }
  const sinalCopiador = sinais.get('copiador')
  const idadeC = sinalCopiador == null ? null : (agora - sinalCopiador) / H
  const naoRespondeu = (forma: Forma): Casa => ({ estado: 'nao_respondeu', desde: sinalCopiador!, forma, frase: `A casa não respondeu desde ${dmhm(sinalCopiador!)}. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.` })
  if (idadeC != null && idadeC > PRAZOS_DA_CASA.copiadorOctogono) return naoRespondeu('octogono')
  if (copiador && copiador.nas_ok === false) {
    const d = tms(copiador.nas_checked_at) ?? sinalCopiador ?? null
    return { estado: 'nas_fora', desde: d, forma: 'triangulo', frase: `O NAS não está acessível pela forja${d ? ` desde ${dmhm(d)}` : ''}. Nada se perde: o mês só sai quando o NAS voltar. O que fazer: confira se o NAS está ligado e se a pasta do arquivo está montada na forja (ver os comandos).` }
  }
  if (vermelhos.some(v => v.startsWith('nas_80:'))) return { estado: 'nas_cheio', desde: null, forma: 'triangulo', frase: 'O NAS está cheio: a cópia não coube. Nada se perde: o mês só sai depois que houver espaço. O que fazer: libere espaço no NAS (ver os comandos). A cópia é refeita sozinha em até 12 horas.' }
  if (idadeC != null && idadeC > PRAZOS_DA_CASA.copiadorTriangulo) return naoRespondeu('triangulo')
  const sinalConferir = sinais.get('conferir_b2')
  if (sinalConferir != null) {
    const idadeB = (agora - sinalConferir) / H
    if (idadeB > PRAZOS_DA_CASA.conferirTriangulo) {
      return { estado: 'programa_atrasado', desde: sinalConferir, forma: idadeB > PRAZOS_DA_CASA.conferirOctogono ? 'octogono' : 'triangulo', frase: `A conferência do B2 não roda desde ${dmhm(sinalConferir)}` }
    }
  }
  if (copiador) {
    const v = tms(copiador.nas_checked_at)
    const vh = v == null ? null : (agora - v) / H
    if (vh == null || vh > 24) {
      return { estado: 'nas_sem_verificar', desde: v, forma: vh != null && vh > 36 ? 'octogono' : 'triangulo', frase: v == null ? 'O NAS ainda não foi verificado' : `O NAS não é verificado desde ${dmhm(v)}` }
    }
  }
  const falta = PROGRAMAS_ESPERADOS.find(w => !sinais.has(w))
  if (falta) return { estado: 'programa_sem_sinal', desde: null, forma: 'triangulo', frase: `${NOME_DO_PROGRAMA[falta]} ainda não deu sinal` }
  return { estado: 'responde', desde: sinalCopiador ?? null, forma: 'visto', frase: 'A casa responde' }
}

// ---------- o cabeçalho da página ----------
const GRAVIDADE_DA_FORMA: Partial<Record<Forma, number>> = { octogono: 2, triangulo: 1 }
/** A REGRA DO CABEÇALHO, num lugar só (decisão dos 4 especialistas, 27/10; o dono pode inverter): a forma mais grave vence; no empate vence a casa; a outra desce para "Além disso:", nunca some.
 *  Para inverter (casa vence todas, como no mockup 11.8), troque por `return true`. */
export function casaVenceOTopo(formaDaCasa: Forma, formaDoProblema: Forma | null): boolean {
  if (formaDoProblema == null) return true
  return (GRAVIDADE_DA_FORMA[formaDaCasa] ?? 0) >= (GRAVIDADE_DA_FORMA[formaDoProblema] ?? 0)
}

const uns = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`
/** Resumo simétrico dos dois blocos da série (mockup 19 B r4): diária fora, early fora, ou as duas; nunca "segue online" para uma tabela que não é a do outro lado. Vazio quando nenhuma está escondida. */
export function fraseDosEscondidos(linhas: { mes?: string; saidas?: LinhaDoMes['saidas'] }[]): string {
  const maisAntigo = (t: string): string | null => { const ms = linhas.filter(l => l.mes && l.saidas?.some(x => x.tabela === t && x.fora === 'destacado')).map(l => l.mes!).sort(); return ms[0] ?? null }
  const d = maisAntigo('competitor_video_daily'), e = maisAntigo('competitor_video_early')
  const nomeD = NOME_DA_TABELA.competitor_video_daily!, nomeE = NOME_DA_TABELA.competitor_video_early!
  if (d && e) return ` Os dois estão escondidos das telas e esperam o prazo para apagar do banco: ${nomeD} (${nomeDoMes(d)}) e ${nomeE} (${nomeDoMes(e)}).`
  if (d) return ` ${nomeD}: ${nomeDoMes(d)} está escondido das telas e espera o prazo para apagar do banco. ${nomeE} segue online.`
  if (e) return ` ${nomeE}: ${nomeDoMes(e)} está escondido das telas e espera o prazo para apagar do banco. ${nomeD} segue online.`
  return ''
}

/** A frase-resumo dos problemas, uma unidade por parte (Logan A1): meses (linhas vermelhas), canais (bloco) e outros (itens do pulso que não são de mês nem de canal). */
function resumoDosProblemas(o: { tipos: CartaoDoTipo[]; mesesVm: LinhaDoMes[]; probOct: LinhaDeProblema[]; amb: number }): Topo | null {
  const meses = o.mesesVm.length
  const canais = o.probOct.filter(x => x.tipo === 'canal').reduce((s, x) => s + (x.n ?? 1), 0)
  // o item do pulso que fala de mês já está na linha do mês; sem nenhuma linha vermelha ele passa a contar como "outro", para não sumir
  const outros = o.probOct.filter(x => x.tipo === 'outro' || x.tipo == null || (x.tipo === 'mes' && meses === 0)).length
  const partes: ParteDaFrase[] = []
  if (meses > 0) {
    const l = o.mesesVm[0]!
    const t = o.tipos.find(x => x.linhas.includes(l))
    partes.push(`${uns(meses, 'mês precisa', 'meses precisam')} de você; o mais urgente: `, { texto: `${t?.titulo ?? 'Mês'}, ${l.mesNome}: ${l.acao ?? 'ver a linha marcada'}`, ancora: ancoraDoMes(l.chave) }, '.')
  }
  if (canais > 0) partes.push(`${meses > 0 ? ' ' : ''}${uns(canais, 'canal removido está', 'canais removidos estão')} sem destino do arquivo (`, { texto: 'ver', ancora: 'canais-removidos' }, ').')
  if (outros > 0) partes.push(`${meses > 0 || canais > 0 ? ' ' : ''}${uns(outros, 'outro problema', 'outros problemas')} `, { texto: 'abaixo', ancora: 'problemas' }, '.')
  if (partes.length === 0) {
    if (o.amb === 0) return null
    return { texto: `O arquivo tem ${uns(o.amb, 'ponto', 'pontos')} de atenção`, forma: 'triangulo' }
  }
  if (o.amb > 0) partes.push(` ${uns(o.amb, 'ponto', 'pontos')} de atenção.`)
  return { texto: partes.map(x => (typeof x === 'string' ? x : x.texto)).join(''), forma: 'octogono', partes }
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
    const tabela = NOME_DA_TABELA[m.table_name] ?? 'Outro dado'
    const n = m.months_ahead
    if (n == null) return { tabela, frase: 'Ainda sem meses à frente: não medido', forma: 'hachura' as const }
    if (n === -1) return { tabela, frase: 'O mês corrente não existe para estes dados. Rode a criação dos meses à frente.', forma: 'octogono' as const }
    if (n >= 6) return { tabela, frase: `${n} meses à frente`, forma: 'visto' as const }
    if (n >= 3) return { tabela, frase: `Só ${n} meses à frente. Rode a criação dos meses à frente.`, forma: 'triangulo' as const }
    return { tabela, frase: `Só ${n} ${n === 1 ? 'mês à frente' : 'meses à frente'}. Rode a criação dos meses à frente já.`, forma: 'octogono' as const }
  })
}

function linhaDeTeste(t: PaginaLida['teste']['meses'][number]): LinhaDoMes {
  const frase = t.dropped_at ? 'Saiu do banco (dado de teste)' : t.detached_at ? 'Saiu das telas (dado de teste)' : t.b2_attested_at ? 'No B2 (dado de teste)'
    : t.nas_attested_at ? 'No NAS (dado de teste)' : t.sealed_at ? 'Copiado (dado de teste)' : 'Em teste'
  // a régua acompanha o estágio, com as mesmas réguas dos meses reais (Gio D1: antes era toda pontilhada)
  const regua = t.dropped_at ? rArq() : t.detached_at ? r2('visto', 'pontilhado') : t.b2_attested_at ? r5(['visto', 'visto']) : t.nas_attested_at ? r5(['visto']) : r5([])
  return { chave: 'ensaio:' + t.month, mesNome: nomeDoMes(t.month), regua, frase, secundaria: null, gravidade: 'nenhuma', sobeAoTopo: false,
    tabela: 'obs_archive_rehearsal', mes: t.month, fora: t.dropped_at ? 'descartado' : t.detached_at ? 'destacado' : 'online', esperaDias: null }
}

/** r5 (Logan r2 A4): o vermelho `b2_atrasado: N meses…` não traz o mês. Se, nos dados da página, só um mês selado sem B2 passou de 7 dias, ele é nomeado com a classe; senão a frase genérica fica (nada inventado). */
function nomearB2Atrasado(l: LinhaDeProblema, p: PaginaLida, agora: number): LinhaDeProblema {
  const limite = agora - 7 * DAY
  const cand = new Map<string, string>()
  for (const m of p.meses) {
    const sel = tms(m.sealed_at)
    if (sel !== null && sel <= limite && !m.b2_attested_at && !m.dropped_at) cand.set(`${m.class}:${m.month}`, `${NOME_DO_TIPO[m.class]}, ${nomeDoMes(m.month)}`)
  }
  if (cand.size !== 1) return l
  return { ...l, frase: `O mês copiado de ${[...cand.values()][0]} ainda não chegou ao B2 depois de 7 dias. Nada se perde: a cópia do NAS continua. Veja a linha marcada.` }
}

/** A tabela cuja saída o botão de cada tipo comanda (a série sai pela diária; a horária pela dela). Fica para a M5 e para a linha de teste. */
const TABELA_DA_SAIDA_DO_TIPO: Record<'horaria' | 'serie' | 'texto', string | undefined> = { horaria: 'competitor_video_hourly', serie: 'competitor_video_daily', texto: undefined }
/** As tabelas que cada tipo comanda, na ordem da tela (M6a T12 r1, decisão do dono: um bloco por tabela). */
const TABELAS_DA_SAIDA_DO_TIPO: Record<'horaria' | 'serie' | 'texto', readonly string[]> = { horaria: ['competitor_video_hourly'], serie: ['competitor_video_daily', 'competitor_video_early'], texto: [] }
const foraDe = (r: { dropped_at?: string | null; detached_at?: string | null }): 'online' | 'destacado' | 'descartado' => (r.dropped_at ? 'descartado' : r.detached_at ? 'destacado' : 'online')

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
    const cl: Classe = { wait: info.wait_days, janela: info.window_months, margem: info.seal_margin_days }
    const recs = p.recuperacao.filter(r => r.class === tipo)
    const porMes = new Map<string, LinhaMesLida[]>()
    for (const r of p.meses.filter(m => m.class === tipo)) porMes.set(r.month, [...(porMes.get(r.month) ?? []), r])
    if (porMes.size === 0) continue // a grade sempre traz as classes liberadas; classe sem nenhuma linha lida não vira cartão vazio
    const itens = [...porMes.entries()].map(([mes, rows]) => {
      const r = juntarTabelas(rows)
      const pg = p.progresso.find(x => x.class === tipo && x.month === mes)
      const online = !r.dropped_at && !r.detached_at
      const res = r.dropped_at ? mesDescartado(c, r) : r.detached_at ? mesDestacado(c, r, cl) : mesOnline(c, r, pg, recs, cl, tipo)
      // M5 Tarefa 9 (Yannis I-12): a leitura de `reattach_out_of_order` é da M5 (o botão que trata é da M6)
      const secundaria = [res.secundaria ?? null, rows.some(x => x.reattach_out_of_order) ? FRASE_FORA_DE_ORDEM : null].filter((x): x is string => x !== null).join(' ') || null
      const linha: LinhaDoMes = {
        chave: `${tipo}:${mes}`, mesNome: nomeDoMes(mes), regua: res.regua, frase: res.frase, secundaria, gravidade: res.gravidade,
        tabela: TABELA_DA_SAIDA_DO_TIPO[tipo], mes, fora: foraDe(r), esperaDias: cl.wait,
        saidas: TABELAS_DA_SAIDA_DO_TIPO[tipo].flatMap(t => { const x = rows.find(y => y.table_name === t); return x ? [{ tabela: t, fora: foraDe(x) }] : [] }),
        sobeAoTopo: res.gravidade === 'ambar' || res.gravidade === 'vermelho', ...(res.acao ? { acao: res.acao } : {}), ...(res.info ? { info: res.info } : {}),
      }
      return { linha, grupo: res.grupo, mes, online, verificadoEm: r.dropped_at ? tms(r.nas_attested_at) : null }
    })
    // ordem: o que precisa do dono, o que já saiu das telas, o que pode sair, os online (do mais antigo ao corrente: "o caminho de cada mês"), o que está no arquivo
    itens.sort((a, b) => a.grupo - b.grupo || (a.mes < b.mes ? -1 : 1))
    const noArquivo = itens.filter(i => i.grupo === 4)
    // Naksu N1: o mês arquivado e conferido não vira linha; só entra no `<details>` do ano. O que pede atenção (grupo 0) continua linha.
    const linhas = itens.filter(i => i.grupo !== 4).map(i => i.linha)
    const anos = new Map<number, { meses: number; todosConferidos: boolean; semConferencia: number; itens: MesNoArquivo[] }>()
    for (const i of noArquivo) {
      const ano = Number(i.mes.slice(0, 4)); const a = anos.get(ano) ?? { meses: 0, todosConferidos: true, semConferencia: 0, itens: [] }
      anos.set(ano, { meses: a.meses + 1, todosConferidos: a.todosConferidos && i.verificadoEm != null, semConferencia: a.semConferencia + (i.verificadoEm == null ? 1 : 0), itens: [...a.itens, { mesNome: i.linha.mesNome, verificadoEm: i.verificadoEm }] })
    }
    const atencao = linhas.filter(l => l.sobeAoTopo).length
    const online = itens.length - noArquivo.length
    // o próximo a sair: o mês online mais antigo que não é o corrente (A2c)
    const prox = itens.find(i => i.online && i.mes !== c.mesCorrente && i.grupo !== 0)
    const saidaProx = prox ? spDateStart(maisMeses(prox.mes, 1 + cl.janela)) : null
    const proxima = prox && saidaProx != null ? `. ${nomeDoMes(prox.mes)[0]!.toUpperCase()}${nomeDoMes(prox.mes).slice(1)} pode sair ${c.hojeMs >= saidaProx ? 'agora' : `em ${dmy(saidaProx)}`}.` : ''
    const escondidos = fraseDosEscondidos(linhas.map(l => ({ mes: l.mes, saidas: l.saidas })))
    tipos.push({
      tipo, titulo: NOME_DO_TIPO[tipo],
      resumo: `${online} ${online === 1 ? 'mês online' : 'meses online'}, ${noArquivo.length} no arquivo${atencao ? `, ${atencao} ${atencao === 1 ? 'pede' : 'pedem'} atenção` : ''}${proxima}${escondidos}`,
      linhas, anosNoArquivo: [...anos.entries()].sort((a, b) => b[0] - a[0]).map(([ano, v]) => ({ ano, ...v, itens: v.itens })),
    })
  }
  // r5 (Logan r2): "atraso de cópia" e "mês sem selo" descrevem os mesmos meses; fica a que traz a contagem
  const vermelhos = p.vermelhos.some(v => v.startsWith('mês sem selo')) ? p.vermelhos.filter(v => !v.startsWith('atraso de cópia')) : p.vermelhos
  const problemas = agruparVermelhos(vermelhos).map(descreverVermelho).map(l => (l.prefixo === 'b2_atrasado' ? nomearB2Atrasado(l, p, agora) : l))
  const todas = tipos.flatMap(t => t.linhas)
  const mesesVm = todas.filter(l => l.gravidade === 'vermelho')
  const probOct = problemas.filter(x => x.forma === 'octogono')
  const verm = mesesVm.length + probOct.length
  const amb = todas.filter(l => l.gravidade === 'ambar').length + problemas.filter(x => x.forma === 'triangulo').length
  const algoCopiado = todas.some(l => l.regua.some(e => e.forma === 'visto' || e.forma === 'arquivo' || e.forma === 'barra')) || tipos.some(t => t.anosNoArquivo.length > 0)
  const doProblema = resumoDosProblemas({ tipos, mesesVm, probOct, amb })
  let resumo: Topo
  let alem: Topo | null = null
  if (casa.estado !== 'responde' && casaVenceOTopo(casa.forma, doProblema?.forma ?? null)) { resumo = { texto: casa.frase, forma: casa.forma }; alem = doProblema }
  else if (doProblema) resumo = doProblema
  else if (!algoCopiado) {
    // M2: nada escrito à mão; a data e a margem vêm da classe. Sem first_month em nenhuma classe, a tela não inventa uma primeira cópia
    const prim = p.meses.length ? [...p.meses].sort((a, b) => (a.month < b.month ? -1 : 1))[0]! : null
    const ini = p.classes.filter(k => k.first_month != null).sort((x, y) => (x.first_month! < y.first_month! ? -1 : 1))[0]
    if (!prim && !ini) resumo = { texto: 'Nenhum tipo de dado foi liberado para o arquivo ainda', forma: 'pontilhado' }
    else {
      const mesIni = prim ? prim.month : ini!.first_month!
      const devido = prim ? prim.devido_em : spDateOf(spDateStart(maisMeses(ini!.first_month!, 1)) - DAY + ini!.seal_margin_days * DAY)
      resumo = { texto: `A primeira cópia é a de ${MESES[Number(mesIni.slice(5, 7)) - 1]}, a partir de ${dm(spDateStart(devido))}`, forma: 'pontilhado' }
    }
  } else {
    const arq = tipos.reduce((s, t) => s + t.anosNoArquivo.reduce((x, a) => x + a.meses, 0), 0)
    const onl = todas.length
    resumo = { texto: `Tudo em dia: ${arq} ${arq === 1 ? 'mês' : 'meses'} no arquivo e ${onl} online, nada precisa de você`, forma: 'visto' }
  }
  const t = p.teste
  const teste = t.aberto || t.encerrado_em ? { faixa: t.aberto ? FAIXA_DO_TESTE : `Dado de teste encerrado${tms(t.encerrado_em) ? ` em ${dmy(tms(t.encerrado_em)!)}` : ''}.`, linhas: t.meses.map(linhaDeTeste), encerradoEm: tms(t.encerrado_em) } : null
  return { hojeSP: p.hoje, resumo, alem, casa, tipos, problemas, mesesAFrente: mesesAFrente(p), teste, ligado: true }
}
