/**
 * A5 E5a T7 + E17 degrau 1, 6a: as medidas novas da comparação (estado do canal, Direção, primeiros dias, acerto, reação) em TEXTO, com a
 * MESMA frase que a tela escreve (a prova de paridade pega a divergência). Puro. A tela desenha a partir de `MedidasDoPar`; o pacote lê
 * este modelo. Toda folha é texto ou nulo; o que a tela mostra só como desenho (barras, régua, casas) não entra.
 */
import type { EstadoDaLinha } from '../_canais/estado-model'
import { PALAVRA, fraseEscrita, type LinhaDeDirecao } from '../_comparar/direcao-model'
import type {
  CelulaAcerto, CelulaContagem, CelulaDirecao, CelulaNumero, CelulaReacao, Falta, Ainda,
} from '../_comparar/medidas-do-lado'
import { textoDaMarca } from '../_comparar/medidas-do-lado'
import { TEXTO_LEITURAS_DIFERENTES, type MedidasDoPar } from '../_comparar/medidas-do-par'
import type { RelacaoNova } from '../_comparar/relacao-do-par'
import { direcaoExibida } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'

/** Uma célula de número: medida (`texto`) ou não (`motivo`). `palavra` e `notas` são as frases curtas sob o número. */
export interface CelulaDoModeloMedidas {
  estado: 'medido' | 'nao_medido'
  texto: string | null
  palavra: string | null
  notas: string[]
  motivo: string | null
}
export interface LinhaDoModeloMedidas {
  titulo: string
  /** A base da linha e, quando houver, a nota dela (a leitura (c) antes da data). */
  notas: string[]
  a: CelulaDoModeloMedidas
  b: CelulaDoModeloMedidas
  relacao: string | null
}
export interface EstadoDoModeloMedidas {
  canal: string
  pastilha: string | null
  /** A linha sob a pastilha, o apoio, "Também em queda." e o motivo da queda não medida, nesta ordem. */
  detalhes: string[]
}
export interface ModeloMedidas {
  leituraPrincipal: string
  estado: [EstadoDoModeloMedidas, EstadoDoModeloMedidas]
  direcao: LinhaDoModeloMedidas[]
  frases: string[]
  primeiros: LinhaDoModeloMedidas[]
  acerto: LinhaDoModeloMedidas[]
  reacao: LinhaDoModeloMedidas[]
  contexto: string | null
}

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const sem = (motivo: string): CelulaDoModeloMedidas => ({ estado: 'nao_medido', texto: null, palavra: null, notas: [], motivo })
const medido = (texto: string, palavra: string | null = null, notas: Array<string | null> = []): CelulaDoModeloMedidas =>
  ({ estado: 'medido', texto, palavra, notas: notas.filter((n): n is string => n !== null), motivo: null })

function falta(c: Falta | Ainda): CelulaDoModeloMedidas {
  switch (c.tipo) {
    case 'nao_carregou': return sem('Não carregou')
    case 'canal_proprio': return sem(c.porque)
    case 'ainda_nao_existe': return sem(`só a partir de ${dm(c.existeEm)}`)
    case 'nao_medido': return sem(c.porque)
    default: { const nunca: never = c; return nunca }
  }
}

function direcional(c: CelulaDirecao | CelulaContagem): CelulaDoModeloMedidas {
  if (c.tipo !== 'medido') return falta(c)
  if ('recente' in c) {
    const notas = [`${c.recente} contra ${c.anterior}${c.pct === null ? ' (sem base para percentual)' : ''}`, c.fora]
    return medido(c.pct === null ? PALAVRA[c.simbolo] : direcaoExibida(c.pct / 100).texto, PALAVRA[c.simbolo], notas)
  }
  return medido(c.texto, PALAVRA[c.simbolo], [c.sub, c.marca ? textoDaMarca(c.marca.ate) : null])
}
const numerico = (c: CelulaNumero): CelulaDoModeloMedidas => (c.tipo === 'medido' ? medido(c.texto, null, [c.sub]) : falta(c))
const acertar = (c: CelulaAcerto): CelulaDoModeloMedidas =>
  (c.tipo === 'medido' ? medido(`${c.acertos} de ${c.total}`, null, [c.pct !== null && c.total >= 10 ? `${c.pct}% de acerto` : null]) : falta(c))
const reagir = (c: CelulaReacao): CelulaDoModeloMedidas =>
  (c.tipo === 'medido'
    ? medido(c.texto, c.idade === 'hoje' ? 'total de hoje' : 'primeiros 30 dias', [c.soCurtidas ? 'só curtidas' : c.soComentarios ? 'só comentários' : null])
    : falta(c))

const relacionar = (r: RelacaoNova | null): string | null => (r === null ? null : r.tipo === 'igual' ? r.texto.charAt(0).toUpperCase() + r.texto.slice(1) : r.texto)

/** A pastilha como a tela escreve (o `EstadoDoCanal` do kit, ou a forma de erro/não medido). */
export function pastilhaDoEstado(e: EstadoDaLinha, naoCarregou: boolean): string | null {
  if (naoCarregou) return 'Não carregou'
  const dias = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`
  switch (e.pastilha) {
    case 'ativo': case 'canal_proprio': return null
    case 'nao_carregou': return 'Não carregou'
    case 'nao_medido': return e.linha ?? 'não medido'
    case 'pausado': return 'Coleta pausada'
    case 'sem_videos': return 'Sem vídeos'
    case 'em_queda': return 'Em queda sustentada'
    case 'parado': return typeof e.dataOuDias === 'number' ? `Parado há ${dias(e.dataOuDias)} sem publicar` : 'Parado'
    case 'fora_do_ar': return typeof e.dataOuDias === 'string' ? `Saiu do YouTube em ${dm(e.dataOuDias)}` : 'Saiu do YouTube'
  }
}

function estadoDo(nome: string, lado: MedidasDoPar['lados'][number]): EstadoDoModeloMedidas {
  const e = lado.estado
  const detalhes: string[] = []
  if (!lado.naoCarregou) {
    if ((e.pastilha === 'ativo' || e.pastilha === 'canal_proprio') && e.linha) detalhes.push(e.linha)
    if (e.apoio && !['ativo', 'canal_proprio', 'nao_carregou', 'nao_medido', 'pausado'].includes(e.pastilha)) detalhes.push(e.apoio)
    if (e.pastilha === 'parado' && e.tambemEmQueda) detalhes.push('Também em queda.')
    if (e.quedaLinha) detalhes.push(e.quedaLinha)
  }
  return { canal: nome, pastilha: pastilhaDoEstado(e, lado.naoCarregou), detalhes }
}

const linhaDeDirecao = (l: LinhaDeDirecao): LinhaDoModeloMedidas => ({
  titulo: l.titulo, notas: [l.sub, ...(l.nota ? [l.nota] : [])],
  a: direcional(l.lados[0]), b: direcional(l.lados[1]), relacao: relacionar(l.relacao),
})

export function modeloDasMedidas(m: MedidasDoPar, nomes: readonly [string, string]): ModeloMedidas {
  return {
    leituraPrincipal: m.direcao.leituraPrincipal,
    estado: [estadoDo(nomes[0], m.lados[0]), estadoDo(nomes[1], m.lados[1])],
    direcao: m.direcao.linhas.map(linhaDeDirecao),
    frases: m.direcao.frases.map(fraseEscrita),
    primeiros: m.primeiros.linhas.map((l): LinhaDoModeloMedidas => ({ titulo: l.titulo, notas: [l.sub], a: numerico(l.lados[0]), b: numerico(l.lados[1]), relacao: relacionar(l.relacao) })),
    acerto: [{ titulo: 'Vídeos longos que acertaram', notas: [m.acerto.nota ?? 'contra a mediana do próprio canal'], a: acertar(m.acerto.lados[0]), b: acertar(m.acerto.lados[1]), relacao: null }],
    reacao: [{
      titulo: 'Engajamento', notas: ['curtidas e comentários por view, mediana dos longos'], a: reagir(m.reacao.lados[0]), b: reagir(m.reacao.lados[1]),
      relacao: m.reacao.diferentes ? TEXTO_LEITURAS_DIFERENTES : relacionar(m.reacao.relacao),
    }],
    contexto: m.contexto,
  }
}
