import type { EstadoMiniatura, EstadoMiniaturaBase, EstadoTitulo, EstadoTituloBase, Motivo, VersaoLida } from './estado-de-leitura'
import { W_RODADAS } from './inferir'

/** Textos ao dono (§11). Única fonte do texto: a tela, o Cowork e o MCP leem daqui. "teste" vem sempre com "possível"; nunca "venceu"; contagem em passagens, nunca em %. */
export const NOTA_PASSAGENS = 'a contagem é das nossas passagens, não da divisão de público do YouTube'
export const AINDA_NAO_CONFERIDA = 'Ainda não conferida com os dados do YouTube.'

/** `{quando}` é preenchido com a data da última rodada (`vistoAte`), quando existe. */
export const TEXTO_MOTIVO: Record<Motivo, string> = {
  aprendendo: 'vídeo novo, juntando passagens (até 4 dias)',
  sem_leitura: 'sonda sem leitura desde {quando}',
  flag_off: 'leitura de concorrentes desligada',
  sem_publicacao: 'sem data de publicação',
  saiu: 'saiu da observação',
  regra: 'leitura inconclusiva agora: títulos mudando sem padrão claro',
}

const FUSO = 'America/Sao_Paulo'
const DIA_MS = 86_400_000

function partes(iso: string): { dia: string; mes: string; hora: string } {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', hourCycle: 'h23' })
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return { dia: p.day ?? '', mes: p.month ?? '', hora: p.hour ?? '' }
}
/** '22/10 10h' em America/Sao_Paulo (Intl, sem -3 fixo). */
export function quando(iso: string): string {
  const p = partes(iso)
  return `${p.dia}/${p.mes} ${p.hora}h`
}
/** '22/10'. */
export function dia(iso: string): string {
  const p = partes(iso)
  return `${p.dia}/${p.mes}`
}
const hora = (iso: string): string => `${partes(iso).hora}h`

/** Versão entre aspas simples, no máximo 80 pontos de código (79 + "…"). */
function q(s: string): string {
  const cs = Array.from(s)
  return `'${cs.length > 80 ? cs.slice(0, 79).join('') + '…' : s}'`
}
const lista = (xs: readonly string[], ult: string): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${ult} ${xs[xs.length - 1]}`)
const maisRecente = (vs: readonly VersaoLida[]): number => Math.max(...vs.map(x => Date.parse(x.ultimaVista)))

interface Opcoes { agoraMs: number; trocaConferida: boolean }

function textoBaseTitulo(e: EstadoTituloBase, o: Opcoes): string {
  switch (e.estado) {
    case 'em_andamento': {
      if (e.sumindo) {
        const seguem = e.versoes.filter(x => x.rodadasEmW > 0)
        const sumidas = e.versoes.filter(x => x.rodadasEmW === 0)
        const n = seguem.length
        const cab = `Possível teste do YouTube: ${n} ${n === 1 ? 'título segue' : 'títulos seguem'}.`
        if (sumidas.length === 0) return cab
        return `${cab} ${lista(sumidas.map(x => q(x.ref)), 'e')} ${sumidas.length === 1 ? 'não aparece' : 'não aparecem'} desde ${quando(new Date(maisRecente(sumidas)).toISOString())}.`
      }
      // "passagens" só na 1ª contagem, como no exemplo do §11
      const cont = e.versoes.map((x, i) => `${q(x.ref)} em ${x.rodadasEmW} de ${e.passagens}${i === 0 ? ' passagens' : ''}`).join(', ')
      return `Possível teste do YouTube: ${e.versoes.length} títulos alternando desde ${quando(e.desde)} (${e.passagens} passagens da sonda). ${cont}.`
    }
    case 'provavelmente_terminou': {
      const cab = `Possível teste do YouTube, provavelmente terminou: ficou ${q(e.ficou)}.`
      if (e.sumidas.length === 0) return cab
      const dias = Math.floor((o.agoraMs - maisRecente(e.sumidas)) / DIA_MS)
      const nomes = e.sumidas.map(x => q(x.ref))
      const sumiu = e.sumidas.length === 1 ? 'não aparece' : 'não aparecem'
      return `${cab} ${lista(nomes, 'e')} ${sumiu} há ${dias} ${dias === 1 ? 'dia' : 'dias'}. Pode reabrir se ${lista(nomes, 'ou')} voltar.`
    }
    case 'troca': {
      const mesmoDia = dia(e.entre.de) === dia(e.entre.ate)
      const intervalo = mesmoDia ? `${quando(e.entre.de)} e ${hora(e.entre.ate)}` : `${quando(e.entre.de)} e ${quando(e.entre.ate)}`
      const base = `Título trocado entre ${intervalo}: ${q(e.antes)} → ${q(e.depois)}. Pode ser edição manual.`
      return o.trocaConferida ? base : `${base} ${AINDA_NAO_CONFERIDA}`
    }
    case 'sem_troca_vista':
      return `Um título só nas últimas ${W_RODADAS} passagens (desde ${dia(e.desde)}). Não quer dizer que não houve teste antes.`
  }
}

function textoBaseMiniatura(e: EstadoMiniaturaBase): string {
  switch (e.estado) {
    case 'troca': return `Miniatura trocada em ${dia(e.entre.ate)} (a anterior não voltou).`
    case 'indeterminada': return 'Miniatura alternando entre versões: não dá para afirmar troca.'
    case 'sem_troca_vista': return `A mesma miniatura nas últimas ${W_RODADAS} passagens. O teste de miniatura dos concorrentes não é visível para nós.`
  }
}

function motivo(m: Motivo, vistoAte: string | undefined): string {
  if (m !== 'sem_leitura') return TEXTO_MOTIVO[m]
  return vistoAte ? TEXTO_MOTIVO.sem_leitura.replace('{quando}', quando(vistoAte)) : 'sonda sem leitura'
}

function naoMedido(m: Motivo, vistoAte: string | undefined, ultimo: string | null): string {
  const base = `Não medido agora (${motivo(m, vistoAte)}).`
  if (ultimo === null) return base
  return `${base} Último estado visto${vistoAte ? ` até ${dia(vistoAte)}` : ''}: ${ultimo}`
}
const foraDaJanela = (vistoAte: string, ultimo: string | null): string =>
  `Fora da observação desde ${dia(vistoAte)} (30 dias da publicação). Último estado: ${ultimo ?? 'não medido.'}`

export function textoTitulo(e: EstadoTitulo, o: Opcoes): string {
  if (e.estado === 'nao_medido') return naoMedido(e.motivo, e.vistoAte, e.ultimo ? textoBaseTitulo(e.ultimo, o) : null)
  if (e.estado === 'fora_da_janela') return foraDaJanela(e.vistoAte, e.ultimo ? textoBaseTitulo(e.ultimo, o) : null)
  return textoBaseTitulo(e, o)
}

export function textoMiniatura(e: EstadoMiniatura, _o: Opcoes): string {
  if (e.estado === 'nao_medido') return naoMedido(e.motivo, e.vistoAte, e.ultimo ? textoBaseMiniatura(e.ultimo) : null)
  if (e.estado === 'fora_da_janela') return foraDaJanela(e.vistoAte, e.ultimo ? textoBaseMiniatura(e.ultimo) : null)
  return textoBaseMiniatura(e)
}
