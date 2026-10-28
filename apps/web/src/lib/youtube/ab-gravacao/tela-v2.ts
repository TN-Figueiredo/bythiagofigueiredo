/**
 * Modelo da tela v2 do teste A/B (S8-F4 T12, T4): função pura, SÓ LEITURA.
 * Lê o que a decisão gravou em `result_metadata.v2`, os pisos sobre as linhas de `ab_test_dias` e `provisorioAte`.
 * Nada de estatística aqui: a tela mostra a decisão, não a recalcula.
 */
import type { DisplayLabel } from '../ab-types'
import { lerResultadoV2, type ResultadoV2 } from '../ab-types'
import { paraRestoreStatus, voltaConcluida } from '../ab-restore'
import { noArConfirmado, type TentativaNoAr } from '../ab-no-ar'
import { dayPt } from '../coleta/day-pt'
import { PRAZO_FECHAMENTO_DIAS } from './placar'
import { ctrDosValidos, estadoV2DoTeste, pisos, provisorioAte, tetoDoTesteV2, type CicloComNumero, type DiaDaDecisao } from './decisao-v2'

export interface VarianteDaTela { id: string; letra: DisplayLabel; titulo: string; is_original: boolean }
export interface LinhaPisoV2 { variant_id: string; letra: DisplayLabel; titulo: string; volume: number | null; dias_validos: number | null }
export type SeloV2 =
  | { tipo: 'vence'; provisorio: boolean; letra: DisplayLabel } | { tipo: 'original' } | { tipo: 'sem_diferenca' }
  | { tipo: 'volume' } | { tipo: 'dado' } | { tipo: 'falha' } | { tipo: 'aguardando' } | { tipo: 'pendente' } | { tipo: 'ilegivel' }
export type NoArV2 =
  | { tipo: 'original' } | { tipo: 'aplicada'; letra: DisplayLabel; desfechoMudou: boolean }
  | { tipo: 'desfeita'; letra: DisplayLabel; desfechoMudou: boolean } | { tipo: 'desconhecido' }
export type TelaV2 =
  | { fase: 'ativo'; dia: number; teto: number; pausado: boolean; passouDoFim: boolean; ilegivel: boolean
      frase: { principal: string; apoio: string }; n: number | null; pisos: LinhaPisoV2[]; sinal: DisplayLabel | null }
  | { fase: 'concluido'; selo: SeloV2; frase: { principal: string; apoio: string | null; complemento?: string }
      prazo: { tipo: 'provisorio'; ate: string | null } | { tipo: 'final' } | null
      noAr: NoArV2; aplicar: { variant_id: string; letra: DisplayLabel } | null; voltar: boolean
      /** Aplicação desfeita (Voltar): reaplicar a mesma letra. Nulo se o desfecho mudou de letra ou há `bloqueio`. */
      aplicarDeNovo: { variant_id: string; letra: DisplayLabel } | null
      /** Motivo de não oferecer "Aplicar de novo" (só na desfeita com o mesmo desfecho). */
      bloqueio: 'outro_teste' | 'sem_leitura' | null
      n: number | null; pisos: LinhaPisoV2[] | null; tentarDeNovo: boolean }
export interface EntradaTelaV2 {
  teste: { id: string; status: string; regra: 'v1' | 'v2'; config: unknown; paused_at: string | null; completed_at: string | null
    completed_reason: string | null; winner_variant_id: string | null; winner_applied_at: string | null
    revert_expires_at: string | null; restore_status: unknown; result_metadata: unknown; original_title: string | null; test_type: 'thumbnail' | 'title' | 'combo'
    /** M7b: o dono já escolheu (escolha_em preenchida): o que está no ar vem de `noArConfirmado`, não do vencedor. */
    escolha_em?: string | null; restore_seq?: number }
  variantes: VarianteDaTela[]; ciclos: CicloComNumero[]; dias: DiaDaDecisao[]
  agora: Date
  /** M7b: histórico de ab_test_restores deste teste (lido pelo chamador); só vale com `escolha_em`. */
  historico?: TentativaNoAr[] | null
  /** Há outro teste nosso aberto (draft/queued/active/paused) no mesmo vídeo? Só a desfeita usa. 'sem_leitura' = a consulta falhou (sem botão, motivo próprio). Obrigatório: esquecer não pode liberar o botão. */
  outroTesteAberto: boolean | 'sem_leitura'
}

const PISO_DIAS = 4

const milhar = (n: number): string => n.toLocaleString('pt-BR')
const pct1 = (frac: number): string => (frac * 100).toFixed(1).replace('.', ',')
const liftTxt = (frac: number): string => `${frac >= 0 ? '+' : ''}${pct1(frac)}`

/** "A", "A e B", "A, B e C". */
function listaE(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function ddmm(dia: string): string {
  const [, m, d] = dia.split('-')
  return `${d}/${m}`
}

function linhasDePiso(vars: VarianteDaTela[], dias: readonly DiaDaDecisao[], p: ReturnType<typeof pisos>): LinhaPisoV2[] {
  return vars.map(v => {
    const temLinha = dias.some(d => d.variant_id === v.id)
    return {
      variant_id: v.id, letra: v.letra, titulo: v.titulo,
      volume: temLinha ? (p.volume[v.id] ?? null) : null,
      dias_validos: temLinha ? (p.dias_validos[v.id] ?? 0) : null,
    }
  })
}

function porLetra(a: LinhaPisoV2, b: LinhaPisoV2): number { return a.letra < b.letra ? -1 : a.letra > b.letra ? 1 : 0 }

const SEM_DIA = 'ainda não tem dia medido'

export const TITULO_CONTA_PENDENTE = 'Os dias mínimos já foram atingidos; o resultado sai amanhã.'

function fraseAtivo(e: {
  linhas: LinhaPisoV2[]; n: number | null; p: ReturnType<typeof pisos>; dia: number; teto: number; pausado: boolean
  passouDoFim: boolean; ilegivel: boolean; nenhumDia: boolean; v2: ResultadoV2 | null; sinal: DisplayLabel | null
}): { principal: string; apoio: string } {
  if (e.ilegivel) return { principal: 'Não consegui ler a avaliação; este teste não encerra sozinho.', apoio: 'Para decidir agora, use Encerrar.' }
  if (e.passouDoFim) return { principal: 'O encerramento atrasou; o teste tenta encerrar de novo na próxima avaliação diária.', apoio: '' }
  if (e.nenhumDia) return { principal: 'Ainda não decide: o YouTube ainda não fechou nenhum dia.', apoio: `O YouTube fecha cada dia com até ${PRAZO_FECHAMENTO_DIAS} dias de atraso. O Lab confere uma vez por dia.` }
  if (e.n === null) return { principal: 'Ainda não decide: falta calcular quantas impressões cada versão precisa.', apoio: 'A conta roda uma vez por dia.' }
  const N = milhar(e.n)
  const diasTxt = (l: LinhaPisoV2) => (l.dias_validos === null || l.dias_validos === 0 ? `${l.letra} ${SEM_DIA}` : `${l.letra} tem ${l.dias_validos}`)
  const volTxt = (l: LinhaPisoV2) => (l.volume === null ? `${l.letra} ${SEM_DIA}` : `${l.letra} tem ${milhar(l.volume)}`)
  if (e.p.piso_dias && e.p.piso_volume) {
    if (e.sinal) return { principal: `Há um sinal de ${e.sinal}, mas ainda não decide.`, apoio: 'Os pisos fecharam. O teste segue até o fim para o resultado valer.' }
    if (e.v2 && !('vencedor_sugerido' in e.v2)) return { principal: TITULO_CONTA_PENDENTE, apoio: 'Volte amanhã.' }
    return { principal: 'Os pisos fecharam; nenhuma versão está à frente da original.', apoio: 'O teste segue até o fim para o resultado valer.' }
  }
  if (!e.p.piso_dias) {
    // variante sem dia válido (volume nulo) não conta como volume aberto: é problema de dias (◆T 1)
    if (e.linhas.some(l => l.volume !== null && l.volume < (e.n as number))) {
      const partes = e.linhas.map((l, i) => {
        const base = l.dias_validos === null || l.dias_validos === 0 ? `${l.letra} ${SEM_DIA}` : `${l.letra} tem ${l.dias_validos}${i === 0 ? ' dias' : ''} e ${l.volume === null ? '—' : milhar(l.volume)}`
        return base
      })
      return {
        principal: 'Ainda não decide: faltam dias válidos e impressões.',
        apoio: `Cada versão precisa de ${PISO_DIAS} dias e ${N} impressões; ${partes.join(', ')}.`,
      }
    }
    return { principal: 'Ainda não decide: faltam dias válidos.', apoio: `Cada versão precisa de ${PISO_DIAS}; ${listaE(e.linhas.map(diasTxt))}.` }
  }
  const lista = `Cada versão precisa de ${N}; ${listaE(e.linhas.map(volTxt))}.`
  if (e.pausado) return { principal: 'Faltam impressões; o teste está pausado.', apoio: lista }
  if (e.dia >= e.teto - 1) return { principal: 'Faltam impressões; o teste encerra amanhã.', apoio: `Amanhã a original volta ao ar. ${lista}` }
  return { principal: 'Ainda não decide: faltam impressões.', apoio: lista }
}

function telaAtiva(e: EntradaTelaV2): TelaV2 {
  const { teste, variantes } = e
  const ids = variantes.map(v => v.id)
  const original = variantes.find(v => v.is_original) ?? null
  const teto = tetoDoTesteV2(teste.config, variantes.length)
  const lido = lerResultadoV2(teste.result_metadata)
  const v2 = lido.estado === 'ok' ? lido.v2 : null
  const ilegivel = lido.estado === 'ilegivel'
  const n = v2 && typeof v2.n === 'number' ? v2.n : null
  const dia = estadoV2DoTeste(
    { id: teste.id, status: teste.status, paused_at: teste.paused_at, completed_at: teste.completed_at, original_title: teste.original_title },
    e.ciclos, null, e.agora, teto,
  ).dia
  const p = pisos(e.dias, ids, n ?? Number.POSITIVE_INFINITY)
  const linhas = linhasDePiso(variantes, e.dias, p)
  const pisosFechados = n !== null && p.piso_dias && p.piso_volume
  let sinal: DisplayLabel | null = null
  if (pisosFechados && v2 && 'vencedor_sugerido' in v2 && v2.vencedor_sugerido && v2.vencedor_sugerido !== original?.id) {
    sinal = variantes.find(v => v.id === v2.vencedor_sugerido)?.letra ?? null
  }
  const nenhumDia = linhas.every(l => !l.dias_validos)
  const passouDoFim = !ilegivel && dia > teto
  const pausado = teste.status === 'paused'
  return {
    fase: 'ativo', dia, teto, pausado, passouDoFim, ilegivel, n, pisos: linhas, sinal,
    frase: fraseAtivo({ linhas, n, p, dia, teto, pausado, passouDoFim, ilegivel, nenhumDia, v2, sinal }),
  }
}

const ESTADO_AGORA: Record<string, string> = {
  sem_diferenca: 'não há diferença clara', volume: 'faltou volume para decidir', dado: 'faltam dias medidos',
  aguardando: 'o YouTube ainda não enviou o alcance', pendente: 'o desfecho está sendo recalculado', falha: 'o teste consta como encerrado por segurança',
  original: 'a original parece melhor',
}

function telaConcluida(e: EntradaTelaV2): TelaV2 | null {
  const { teste, variantes } = e
  const lido = lerResultadoV2(teste.result_metadata)
  const v2 = lido.estado === 'ok' ? lido.v2 : null
  const enc = v2?.encerrado_em_dia ?? null
  const dentro = teste.completed_reason === 'regra_v2' || (teste.completed_reason === 'manual_winner' && enc !== null)
  if (!dentro) return null

  const ids = variantes.map(v => v.id)
  const original = variantes.find(v => v.is_original) ?? null
  const letraDe = (id: string | null | undefined): DisplayLabel | null => (id ? variantes.find(v => v.id === id)?.letra ?? null : null)
  const ate = enc ? e.dias.filter(d => d.day_pt <= enc) : e.dias // D-T12-8 (P1)
  const n = v2 && typeof v2.n === 'number' ? v2.n : null
  const p = pisos(ate, ids, n ?? Number.POSITIVE_INFINITY)
  const linhas = linhasDePiso(variantes, ate, p)

  // noAr (D-T12-4)
  const w = teste.winner_variant_id
  let noAr: NoArV2
  if (w === null || w === original?.id) noAr = { tipo: 'original' }
  else {
    const letra = letraDe(w)
    if (!letra) noAr = { tipo: 'desconhecido' }
    else if (teste.winner_applied_at !== null) noAr = { tipo: 'aplicada', letra, desfechoMudou: w !== (v2?.vencedor_sugerido ?? null) }
    else {
      const rs = paraRestoreStatus(teste.restore_status)
      const tudoOk = voltaConcluida(rs, teste.test_type)
      noAr = teste.completed_reason === 'manual_winner' && tudoOk ? { tipo: 'desfeita', letra, desfechoMudou: w !== (v2?.vencedor_sugerido ?? null) } : { tipo: 'desconhecido' }
    }
  }
  const escolhido = teste.escolha_em != null
  // D28: sem vencedor e sem escolha, o `restore_status` ainda pode dizer o que está no ar (caminho legado): mesma fonte única do título e da faixa.
  const semVencedorNemEscolha = !escolhido && w === null
  if (escolhido || semVencedorNemEscolha) {
    // M7b: com a escolha do dono, o vencedor não diz o que está no ar. Fonte única: noArConfirmado.
    // `historico: null` = leitura falhou: desconhecido (igual à linha de Concluídos). Ausente = sem histórico (lista vazia).
    const lidoNoAr = e.historico === null ? null : noArConfirmado({
      test_type: teste.test_type, restore_status: teste.restore_status, restore_seq: teste.restore_seq ?? 0, completed_at: teste.completed_at,
      winner_variant_id: teste.winner_variant_id, winner_applied_at: teste.winner_applied_at,
      variantes: variantes.map(v => ({ id: v.id, label: v.letra, is_original: v.is_original })),
    }, e.historico ?? [])
    if (escolhido) {
      if (lidoNoAr === null || lidoNoAr.tipo !== 'confirmado') noAr = { tipo: 'desconhecido' }
      else if (lidoNoAr.varianteId === original?.id) noAr = { tipo: 'original' }
      else noAr = { tipo: 'aplicada', letra: lidoNoAr.letra, desfechoMudou: lidoNoAr.varianteId !== (v2?.vencedor_sugerido ?? null) }
    } else if (paraRestoreStatus(teste.restore_status) !== null) {
      // Y2: com restore_status gravado, leitura falha ou incompleta = desconhecido (igual ao título). Sem restore_status, o original no ar é o caso comum.
      if (lidoNoAr === null || lidoNoAr.tipo !== 'confirmado') noAr = { tipo: 'desconhecido' }
      else if (lidoNoAr.varianteId !== original?.id) noAr = { tipo: 'aplicada', letra: lidoNoAr.letra, desfechoMudou: lidoNoAr.varianteId !== (v2?.vencedor_sugerido ?? null) }
    }
  }
  const mudou = !escolhido && noAr.tipo === 'aplicada' && noAr.desfechoMudou // com escolha do dono a frase "ao encerrar, X parecia melhor" não vale
  const voltar = !escolhido && w !== null && noAr.tipo === 'aplicada' && teste.revert_expires_at !== null && Date.parse(teste.revert_expires_at) > e.agora.getTime()

  const sugeridoId = v2?.vencedor_sugerido ?? null
  const sugeridoLetra = letraDe(sugeridoId)
  const base = { noAr, voltar, n, tentarDeNovo: false, aplicarDeNovo: null as null | { variant_id: string; letra: DisplayLabel }, bloqueio: null as 'outro_teste' | 'sem_leitura' | null }

  let selo: SeloV2
  if (lido.estado === 'ilegivel') selo = { tipo: 'ilegivel' }
  else if (!v2 || !v2.desfecho) selo = { tipo: 'pendente' }
  else {
    switch (v2.desfecho) {
      case 'vencedor_provavel':
        selo = sugeridoId !== null && sugeridoId === original?.id ? { tipo: 'original' }
          : sugeridoLetra ? { tipo: 'vence', provisorio: v2.provisorio === true, letra: sugeridoLetra } : { tipo: 'ilegivel' }
        break
      case 'sem_diferenca_detectavel': selo = { tipo: 'sem_diferenca' }; break
      case 'inconclusivo_por_volume': selo = { tipo: 'volume' }; break
      case 'inconclusivo_por_dado': selo = { tipo: 'dado' }; break
      case 'inconclusivo_por_falha': selo = { tipo: 'falha' }; break
      case 'aguardando_alcance': selo = { tipo: 'aguardando' }; break
    }
  }

  if (selo.tipo === 'ilegivel') {
    return {
      fase: 'concluido', selo, ...base, tentarDeNovo: true, prazo: null, aplicar: null, pisos: null,
      frase: { principal: 'Não consegui ler o desfecho deste teste.', apoio: 'Os números abaixo são os gravados. Nada foi alterado.' },
    }
  }

  const comPrazo = ['vence', 'original', 'sem_diferenca', 'volume', 'dado'].includes(selo.tipo)
  let prazo: Extract<TelaV2, { fase: 'concluido' }>['prazo'] = null
  if (comPrazo) {
    if (v2?.provisorio === true) {
      const limite = enc ? provisorioAte(enc) : null
      prazo = { tipo: 'provisorio', ate: enc && limite && dayPt(e.agora) <= limite ? ddmm(limite) : null }
    } else prazo = { tipo: 'final' }
  }

  const aplicar = !escolhido && selo.tipo === 'vence' && teste.completed_reason === 'regra_v2' && w === null && sugeridoId && !(noAr.tipo === 'aplicada' && noAr.letra === selo.letra)
    ? { variant_id: sugeridoId, letra: selo.letra } : null

  let frase: { principal: string; apoio: string | null; complemento?: string }
  const desfeitaMesmoDesfecho = !escolhido && noAr.tipo === 'desfeita' && !noAr.desfechoMudou && selo.tipo === 'vence' && sugeridoId !== null
  let aplicarDeNovo: { variant_id: string; letra: DisplayLabel } | null = null
  let bloqueio: 'outro_teste' | 'sem_leitura' | null = null
  if (desfeitaMesmoDesfecho && selo.tipo === 'vence' && sugeridoId) {
    if (e.outroTesteAberto === true) bloqueio = 'outro_teste'
    else if (e.outroTesteAberto === 'sem_leitura') bloqueio = 'sem_leitura'
    else aplicarDeNovo = { variant_id: sugeridoId, letra: selo.letra }
  }
  // Aplicar/Voltar também escrevem no ciclo do vídeo: com outro teste aberto o servidor recusa (ja_encerrado/outro_teste), então a tela não os oferece.
  if (bloqueio === null && (aplicar !== null || voltar) && e.outroTesteAberto !== false) bloqueio = e.outroTesteAberto === true ? 'outro_teste' : 'sem_leitura'
  if (desfeitaMesmoDesfecho && selo.tipo === 'vence') {
    const normal = fraseConcluida(selo, { variantes, linhas, n, ate, ids, originalId: original?.id ?? '', sugeridoId })
    frase = {
      principal: `${selo.letra} ainda parece melhor, mas a original está no ar.`, apoio: normal.apoio,
      complemento: `Você voltou à original.${aplicarDeNovo ? ` Pode aplicar ${selo.letra} de novo.` : ''}`,
    }
  } else if (mudou && noAr.tipo === 'aplicada') {
    // ◆T 7 / 7b: o desfecho de hoje não bate com o que foi aplicado
    const aplicadaLetra = noAr.letra
    if (selo.tipo === 'vence') frase = { principal: `Agora ${selo.letra} parece melhor; ao encerrar, ${aplicadaLetra} parecia melhor.`, apoio: null }
    else frase = { principal: `Agora ${ESTADO_AGORA[selo.tipo]}; ao encerrar, ${aplicadaLetra} parecia melhor.`, apoio: null }
  } else {
    frase = fraseConcluida(selo, { variantes, linhas, n, ate, ids, originalId: original?.id ?? '', sugeridoId })
  }
  return { fase: 'concluido', selo, ...base, aplicarDeNovo, bloqueio, prazo, aplicar, pisos: linhas, frase }
}

function fraseConcluida(selo: SeloV2, c: {
  variantes: VarianteDaTela[]; linhas: LinhaPisoV2[]; n: number | null; ate: readonly DiaDaDecisao[]; ids: string[]; originalId: string; sugeridoId: string | null
}): { principal: string; apoio: string | null } {
  switch (selo.tipo) {
    case 'vence': {
      const x = c.sugeridoId ? ctrDosValidos(c.ate, c.ids, c.originalId) : {}
      const alvo = c.sugeridoId ? x[c.sugeridoId] : undefined
      const ctrA = x[c.originalId]?.ctr ?? null
      const ctrX = alvo?.ctr ?? null
      const lift = alvo?.lift ?? null
      let apoio: string | null = null
      // M2 (Phil): o selo é do cron de ontem, o lift é das linhas de agora; se contradizem, não mostra o CTR.
      if (lift !== null && lift <= 0) apoio = 'Os números mudaram desde a última avaliação; o desfecho é revisto no próximo cron.'
      else if (ctrX !== null && ctrA !== null) apoio = `CTR ≈ ${pct1(ctrX)}% contra ${pct1(ctrA)}% de A${lift !== null ? ` (${liftTxt(lift)}% vs A)` : ''}.`
      else if (lift !== null) apoio = `${selo.letra} está ${liftTxt(lift)}% acima de A no CTR.`
      return { principal: selo.provisorio ? `${selo.letra} provavelmente vence.` : `${selo.letra} vence.`, apoio }
    }
    case 'original': return { principal: 'A original se saiu melhor; nada a aplicar.', apoio: 'A original segue no ar.' }
    case 'sem_diferenca': return { principal: `Sem diferença clara entre ${listaE(c.variantes.map(v => v.letra))}.`, apoio: 'A original segue no ar.' }
    case 'volume': {
      const menor = [...c.linhas].sort((a, b) => (a.volume ?? -1) - (b.volume ?? -1) || porLetra(a, b))[0]
      const alvo = menor && menor.volume !== null
        ? `${menor.letra} teve ${milhar(menor.volume)}${c.n !== null ? ` de ${milhar(c.n)}` : ''} impressões`
        : `${menor?.letra ?? 'A'} ${SEM_DIA}`
      return { principal: `Faltou volume: ${alvo}.`, apoio: 'Este vídeo recebe poucas impressões para decidir. A original segue no ar.' }
    }
    case 'dado': {
      const menor = [...c.linhas].sort((a, b) => (a.dias_validos ?? 0) - (b.dias_validos ?? 0) || porLetra(a, b))[0]
      const alvo = menor && menor.dias_validos ? `${menor.letra} tem ${menor.dias_validos} de ${PISO_DIAS}` : `${menor?.letra ?? 'A'} ${SEM_DIA}`
      return { principal: `Faltaram dias medidos: ${alvo}.`, apoio: 'O YouTube não enviou o CTR de alguns dias. A original segue no ar.' }
    }
    case 'falha': return { principal: 'O teste foi encerrado por segurança, não por resultado.', apoio: 'A original voltou ao ar.' }
    case 'aguardando': return { principal: 'O YouTube ainda não enviou o alcance dos últimos dias.', apoio: 'O desfecho pode mudar quando chegar.' }
    case 'pendente': return { principal: 'Calculando o desfecho.', apoio: 'A conta roda uma vez por dia. Volte amanhã.' }
    case 'ilegivel': return { principal: 'Não consegui ler o desfecho deste teste.', apoio: 'Os números abaixo são os gravados. Nada foi alterado.' }
  }
}

export function telaV2DoTeste(e: EntradaTelaV2): TelaV2 | null {
  if (e.teste.regra !== 'v2') return null
  const s = e.teste.status
  if (s === 'draft' || s === 'queued') return null
  if (s === 'active' || s === 'paused') return telaAtiva(e)
  return telaConcluida(e)
}
