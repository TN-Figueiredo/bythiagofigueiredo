/** Manutenção M5, Tarefa 11 (04 §14.5, NOTAS-18-v2): o aviso do banco, versão 2, PURO. Não lê banco, relógio nem ambiente.
 *  A cor da pastilha e da frase segue o MAIS ALTO que o banco chega antes da próxima saída; a barra segue o tamanho de hoje.
 *  Sem dado: sem leitura do tamanho = como o 18 (última medida, cor nunca verde); leitura leve nula = cópia em hachura e régua sem o traço da saída. */
import type { AvisoDoArquivo } from '../arquivo/aviso'
import type { AvisoLeve } from './aviso-leve'
import type { Casa, Forma } from './estado-do-mes'
import type { marcaAoLadoDaPastilha } from './canais-removidos'

const MB_LIMITE = 500
const AMARELO = 70
const VERMELHO = 85
const DIA_MS = 86_400_000

export interface AvisoV2 {
  pastilha: { pct: number | null; cor: 'neutra' | 'ambar' | 'vermelho' | 'nao_medido'; texto: string }
  barra: { hojePct: number | null; chegaAPct: number | null; rotuloChegaA: string | null }
  regua: null | { losango85: number | null; tracoProximaSaida: number | null; alivioDepoisDoAperto: boolean; frase: string | null; rotulo85: string | null; rotuloSaida: string | null }
  linhaDaCopia: { forma: Forma; texto: string; portaArquivo: boolean }
  oQueLibera: string[] | null
  casa: null | { texto: string; oQueFazer: string[]; forma: Forma }
  marcas: { automatico: null; canaisRemovidos: ReturnType<typeof marcaAoLadoDaPastilha> }
}

const nDias = (de: string, ate: string): number => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / DIA_MS)
const somaDias = (iso: string, n: number): string => new Date(Date.parse(iso + 'T00:00:00Z') + n * DIA_MS).toISOString().slice(0, 10)
const dm = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesDe = (iso: string): string => MESES[Number(iso.slice(5, 7)) - 1]!
const SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const diaSP = (ms: number): string => SP.format(new Date(ms))
const plural = (n: number, a: string, b: string): string => `${n} ${n === 1 ? a : b}`
const BASE_COPIA = 'Todo mês fechado é copiado para o NAS e para o B2.'

const NOME: Record<string, string> = { com_folga: 'Com folga', enchendo: 'Enchendo', quase_cheio: 'Quase cheio', acima_do_limite: 'Acima do limite' }

function pastilhaEBarra(banco: AvisoDoArquivo['banco'], leve: AvisoLeve | null): { pastilha: AvisoV2['pastilha']; barra: AvisoV2['barra']; tam: { db: number; porDia: number | null; hoje: string; pct: number } | null } {
  if (!('valor' in banco)) return { pastilha: { pct: null, cor: 'nao_medido', texto: 'Não medido' }, barra: { hojePct: null, chegaAPct: null, rotuloChegaA: null }, tam: null }
  const s = banco.valor
  if (s.estado === 'nunca_medido') return { pastilha: { pct: null, cor: 'nao_medido', texto: 'Sem medida' }, barra: { hojePct: null, chegaAPct: null, rotuloChegaA: null }, tam: null }
  if (s.estado === 'sem_leitura_hoje' || !s.tela || !s.ultima) {
    // como o 18: a última medida aparece (data e valor) e a cor nunca é verde
    const cor = s.cor === 'vermelho' ? 'vermelho' : s.cor === 'amarelo' ? 'ambar' : 'nao_medido'
    return { pastilha: { pct: null, cor, texto: 'Sem leitura hoje' }, barra: { hojePct: s.ultima?.pctDoLimite ?? null, chegaAPct: null, rotuloChegaA: null }, tam: null }
  }
  const pct = s.tela.pctDoLimite
  let cor: AvisoV2['pastilha']['cor'] = s.cor === 'vermelho' ? 'vermelho' : s.cor === 'amarelo' ? 'ambar' : 'neutra'
  let texto = s.tela.nivel === 'enche_em_dias' && s.projecao.estado === 'medida' ? `Enche em ${plural(s.projecao.diasAteOLimite, 'dia', 'dias')}` : (NOME[s.tela.nivel] ?? 'Com folga')
  const porDia = s.tela.mb.porDia
  const hoje = s.diaDeLeitura
  let chegaA: number | null = null
  if (leve?.proximo_mes && porDia !== null) {
    const dP = Math.max(0, nDias(hoje, leve.proximo_mes.pronto_em))
    chegaA = Math.round(((s.ultima.dbMb + Math.max(porDia, 0) * dP) / MB_LIMITE) * 100)
    if (chegaA >= VERMELHO && cor !== 'vermelho') { cor = 'vermelho'; texto = 'Quase cheio antes da saída' }
    else if (chegaA >= AMARELO && cor === 'neutra') { cor = 'ambar'; texto = 'Enchendo' }
  }
  const mostra = chegaA !== null && chegaA > pct
  return {
    pastilha: { pct, cor, texto },
    barra: { hojePct: pct, chegaAPct: mostra ? chegaA : null, rotuloChegaA: mostra ? `chega a ${chegaA}% antes da próxima saída` : null },
    tam: { db: s.ultima.dbMb, porDia, hoje, pct },
  }
}

function reguaDe(tam: { db: number; porDia: number | null; hoje: string; pct: number } | null, leve: AvisoLeve | null): AvisoV2['regua'] {
  if (!tam || !leve?.proximo_mes) return null
  const dP = Math.max(0, nDias(tam.hoje, leve.proximo_mes.pronto_em))
  const cresce = tam.porDia !== null && tam.porDia > 0.0001
  const d85 = tam.pct >= VERMELHO ? 0 : cresce ? Math.max(0, ((MB_LIMITE * VERMELHO) / 100 - tam.db) / (tam.porDia as number)) : null
  const x = (d: number): number => Math.round(Math.min(d / 365, 1) * 1000) / 10
  const aperto = d85 !== null && d85 < dP
  const gap = d85 === null ? 0 : Math.round(dP - d85)
  const quando = d85 === null ? null : tam.pct >= VERMELHO ? `já passou dos ${VERMELHO}%` : `${VERMELHO}% em ${dm(somaDias(tam.hoje, Math.round(d85)))}`
  return {
    losango85: d85 === null ? null : x(d85),
    tracoProximaSaida: x(dP),
    alivioDepoisDoAperto: aperto,
    frase: d85 === null ? null : aperto
      ? `O alívio chega depois do aperto: ${plural(gap, 'dia', 'dias')} entre o banco chegar a ${VERMELHO}% e o mês poder sair.`
      : `O próximo mês fica pronto antes de o banco chegar a ${VERMELHO}%.`,
    rotulo85: quando,
    rotuloSaida: `${mesDe(leve.proximo_mes.month)} pronto em ${dm(leve.proximo_mes.pronto_em)}`,
  }
}

function copiaDe(leve: AvisoLeve | null, casa: Casa): AvisoV2['linhaDaCopia'] {
  if (!leve) return { forma: 'hachura', texto: 'Não foi possível ler a última cópia.', portaArquivo: false }
  const a = leve.atraso
  if (a.amarelos + a.vermelhos > 0) {
    const dias = a.mais_antiga ? Math.max(0, nDias(a.mais_antiga, leve.hoje)) : null
    const mes = a.mais_antiga ? mesDe(somaDias(a.mais_antiga, -28)) : null
    const octogono = a.vermelhos > 0 || (dias !== null && dias > 30)
    const texto = mes && dias !== null ? `A cópia de ${mes} está atrasada há ${plural(dias, 'dia', 'dias')}.` : 'Há cópia atrasada.'
    return { forma: octogono ? 'octogono' : 'triangulo', texto, portaArquivo: true }
  }
  if (leve.ultima_copia === null) {
    const d = leve.primeira_devida_em
    return { forma: 'pontilhado', texto: d ? `${BASE_COPIA} A primeira cópia é a de ${mesDe(somaDias(d, -28))}, a partir de ${dm(d)}.` : `${BASE_COPIA} Ainda não há cópia.`, portaArquivo: false }
  }
  const espera = casa.estado === 'nao_respondeu' ? ' A próxima espera a casa.' : casa.estado === 'nas_fora' || casa.estado === 'nas_cheio' ? ' A próxima espera o NAS.' : ''
  const ms = Date.parse(leve.ultima_copia)
  return { forma: 'visto', texto: `${BASE_COPIA} Última cópia: ${Number.isFinite(ms) ? dm(diaSP(ms)) : 'data ilegível'}.${espera}`, portaArquivo: false }
}

function liberaDe(pct: number | null, leve: AvisoLeve | null): string[] | null {
  if (pct === null || pct < VERMELHO) return null
  const l: string[] = []
  if (leve?.proximo_mes) l.push(`O próximo mês fica pronto em ${dm(leve.proximo_mes.pronto_em)}: ao sair das telas, o espaço dele volta ao banco.`)
  l.push('Encurtar de 90 para 60 dias as views por dia que ficam no banco: a tela de histórico passa a mostrar 60 dias, não 90.')
  l.push('Mandar para o arquivo os vídeos com mais de 1 ano dos canais acompanhados: esses vídeos deixam de abrir o histórico na hora.')
  l.push('Tirar canais: cada canal removido devolve espaço ao banco.')
  return l
}

function casaDeFora(casa: Casa, pausaExiste: boolean): AvisoV2['casa'] {
  if (casa.estado !== 'nao_respondeu' && casa.estado !== 'nas_fora' && casa.estado !== 'nas_cheio') return null
  const p1 = casa.estado === 'nao_respondeu'
    ? 'Peça a quem está em casa para religar a forja e o NAS (se não houver ninguém, a data acima é a sua folga: nada mais a fazer agora).'
    : casa.estado === 'nas_fora'
      ? 'Confira se o NAS está ligado e se a pasta do arquivo está montada na forja (ver os comandos).'
      : 'Libere espaço no NAS (ver os comandos). A cópia é refeita sozinha em até 12 horas.'
  const p3 = pausaExiste ? `Se chegar a ${VERMELHO}% antes disso, pause a coleta de canais (ver o comando).` : 'A pausa da coleta de canais ainda não existe.'
  return { texto: casa.frase, oQueFazer: [p1, 'Até lá, não acrescente canais.', p3], forma: casa.forma }
}

export function montarAvisoV2(o: { aviso: Pick<AvisoDoArquivo, 'banco'>; leve: AvisoLeve | null; agora: number; casa: Casa; marcaCanais: AvisoV2['marcas']['canaisRemovidos']; /** o comando `pausar` da E10 existe em produção */ pausaExiste?: boolean }): AvisoV2 {
  const { pastilha, barra, tam } = pastilhaEBarra(o.aviso.banco, o.leve)
  return {
    pastilha, barra,
    regua: reguaDe(tam, o.leve),
    linhaDaCopia: copiaDe(o.leve, o.casa),
    oQueLibera: liberaDe(pastilha.pct, o.leve),
    casa: casaDeFora(o.casa, o.pausaExiste ?? true),
    marcas: { automatico: null, canaisRemovidos: o.marcaCanais },
  }
}
