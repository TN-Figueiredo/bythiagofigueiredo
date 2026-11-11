/**
 * A4 R5 T9: o ramo puro da ação `consultar`. Recebe o `ResultadoDaConsulta` pronto (a T8 montou) e devolve o texto dentro do teto, a Cobertura
 * e os números do registro. Sem banco, sem relógio. Duas regras que a ação cria:
 *   - a lista da consultar NÃO tem janela (`a_partir_da_linha`): o que não cabe no tamanho sai do fim de cada bloco e a Cobertura diz quantas;
 *   - o teto se divide entre os blocos pelo que cabe (busca binária), nunca por metade fixa: o bloco que usa pouco empresta ao outro.
 */
import type { z } from 'zod'
import type { ENTRADA } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import type { Cobertura } from '@/lib/youtube/observatorio/acesso-ia/cobertura'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { LinhaDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'
import { empacotarConsulta, maisRecenteDosDados, type ResultadoDaConsulta } from '../_contexto-ia/empacotar-consulta'

type Entrada = z.infer<typeof ENTRADA>
type Proxima = Cobertura['proximas'][number]
type Numeros = Cobertura['numeros']

const FRASE_DO_FIM = '\n[texto cortado por tamanho: o fim não saiu]'
const nomeDoBloco = (f: 'longos' | 'shorts'): string => (f === 'shorts' ? 'Shorts' : 'longos')

export interface RespostaDaConsulta {
  texto: string
  cobertura: Cobertura
  params: Record<string, string | number | boolean | string[] | Record<string, number>>
}

/** Mostra as `k[i]` primeiras linhas de cada bloco; o que sobra entra em `cortadasPorTamanho`. */
function comLinhas(r: ResultadoDaConsulta, k: readonly number[]): ResultadoDaConsulta {
  return {
    ...r,
    blocos: r.blocos.map((b, i) => {
      const mostrar = Math.min(b.linhas.length, k[i]!)
      return { ...b, linhas: b.linhas.slice(0, mostrar), cortadasPorTamanho: (b.cortadasPorTamanho ?? 0) + (b.linhas.length - mostrar) }
    }),
  }
}

const SEM_TETO = 10_000_000
const milhar = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Mede o texto inteiro (sem teto interno: quem corta é `melhorCorte`), mas a frase "O pacote tem X de Y caracteres" mostra o teto real `teto`. */
function renderizar(r: ResultadoDaConsulta, agora: number, teto: number): { texto: string; numeros: Numeros } {
  const pacote = segmentar(empacotarConsulta(r), { geradoEm: agora, recente: maisRecenteDosDados(r.dadosDe) })
  const t = montarTexto(pacote, '', SEM_TETO, 'todos', undefined, { ia: true })
  return { texto: t.texto.replace(`de ${milhar(SEM_TETO)} caracteres`, `de ${milhar(teto)} caracteres`), numeros: t.numerosNoTexto }
}

/** O maior número de linhas por bloco que cabe em `teto`: primeiro um `c` igual para todos, depois cada bloco sobe sozinho. `null` se nem 1 linha por bloco cabe. */
function melhorCorte(r: ResultadoDaConsulta, teto: number, agora: number): number[] | null {
  const tams = r.blocos.map((b) => b.linhas.length)
  const cabe = (k: readonly number[]): boolean => renderizar(comLinhas(r, k), agora, teto).texto.length <= teto
  const minimo = tams.map((n) => Math.min(n, 1))
  if (!cabe(minimo)) return null
  const topo = Math.max(...tams, 1)
  let lo = 1, hi = topo
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (cabe(tams.map((n) => Math.min(n, mid)))) lo = mid
    else hi = mid - 1
  }
  const k = tams.map((n) => Math.min(n, lo))
  for (let i = 0; i < k.length; i++) {
    let a = k[i]!, b = tams[i]!
    while (a < b) {
      const mid = Math.ceil((a + b) / 2)
      const prova = [...k]; prova[i] = mid
      if (cabe(prova)) a = mid
      else b = mid - 1
    }
    k[i] = a
  }
  return k
}

const temReacao = (ls: readonly LinhaDaConsulta[]): boolean =>
  ls.some((l) => (['likes', 'comentarios', 'engajamento'] as const).some((m) => { const c = l.celulas[m]; return c !== undefined && c.x !== null && (c.estado === 'medido' || c.estado === 'zero_medido') }))

export function respostaDaConsulta(r: ResultadoDaConsulta, entrada: Extract<Entrada, { acao: 'consultar' }>, tetoFinal: number, agora: number): RespostaDaConsulta {
  const p = r.pedido
  const todos = r.blocos.map((b) => b.linhas.length)
  let final = r
  let texto: string
  let numeros: Numeros
  let antesDoCorte = false
  const inteiro = renderizar(r, agora, tetoFinal)
  if (inteiro.texto.length <= tetoFinal) {
    texto = inteiro.texto; numeros = inteiro.numeros
  } else {
    const k = melhorCorte(r, tetoFinal, agora)
    final = comLinhas(r, k ?? todos.map(() => 0))
    const f = renderizar(final, agora, tetoFinal)
    numeros = f.numeros
    if (f.texto.length > tetoFinal) {
      // nem uma linha por bloco cabe: o fim do texto cai e a Cobertura diz
      texto = f.texto.slice(0, Math.max(0, tetoFinal - FRASE_DO_FIM.length)) + FRASE_DO_FIM
      antesDoCorte = true
    } else texto = f.texto
  }

  const mostradas = final.blocos.map((b) => b.linhas.length)
  const elegiveis = final.blocos.map((b) => b.agregado.elegiveis)
  const somaEleg = elegiveis.reduce((s, n) => s + n, 0)
  const somaLinhas = mostradas.reduce((s, n) => s + n, 0)
  const rotulos: string[] = []
  final.blocos.forEach((b, i) => {
    const tam = b.cortadasPorTamanho ?? 0
    if (tam > 0) rotulos.push(`${tam} linhas de ${nomeDoBloco(b.formato)} (${mostradas[i]} de ${r.blocos[i]!.linhas.length} que o limite deixou)`)
  })
  if (antesDoCorte) rotulos.push('o fim do texto')

  const [principal, segundo] = final.blocos
  const vazio = somaEleg === 0
  const cobertura: Cobertura = {
    ...(principal ? { lista: { titulo: `Vídeos ${nomeDoBloco(principal.formato)} da consulta`, de: 1, ate: mostradas[0]!, total: elegiveis[0]!, ordem: 'do pedido' as const, semJanela: { limite: p.limite } } } : {}),
    apoio: {
      inteiras: segundo && mostradas[1]! >= elegiveis[1]! ? 1 : 0,
      total: segundo ? 1 : 0,
      cortadas: segundo && mostradas[1]! < elegiveis[1]! ? [{ titulo: nomeDoBloco(segundo.formato), saiu: mostradas[1]!, de: elegiveis[1]! }] : [],
    },
    cortesDeTamanho: rotulos, numeros, vazio,
    ...(antesDoCorte ? { numerosAntesDoCorte: true } : {}),
    proximas: proximasDa(r, final, entrada),
  }

  const naoMedidos: Record<string, number> = {}
  for (const m of p.metricas) {
    const n = final.blocos.reduce((s, b) => s + b.linhas.filter((l) => l.celulas[m]?.estado === 'nao_medido').length, 0)
    if (n > 0) naoMedidos[m] = n
  }
  const params: RespostaDaConsulta['params'] = {
    elegiveis: somaEleg, linhas: somaLinhas, total: somaEleg, cortadas: Math.max(0, somaEleg - somaLinhas),
    ...(Object.keys(naoMedidos).length > 0 ? { nao_medidos: naoMedidos } : {}),
    ...(r.lugar?.estado === 'marcado' ? { sem_lugar_calculado: r.lugar.semLugarCalculado } : {}),
    ...(r.canaisSemMedida.length > 0 ? { canais_sem_medida: r.canaisSemMedida.length } : {}),
    ...(r.leituraMaisAntiga ? { dados_de: r.leituraMaisAntiga.slice(0, 13) } : {}),
    n_metricas: p.metricas.length, n_faixas: p.janelaIdade === 'todas' ? 0 : p.janelaIdade.length,
    privado: false, comentarios: false, cortes: rotulos.length,
  }
  return { texto, cobertura, params }
}

/** Até 3 (o rodapé corta o resto): mais linhas, outra ordem, o canal e o vídeo do topo. Quem chama passa por `validas`. */
function proximasDa(r: ResultadoDaConsulta, final: ResultadoDaConsulta, entrada: Extract<Entrada, { acao: 'consultar' }>): Proxima[] {
  const p = r.pedido
  const { entidade: _entidade, ...base } = entrada
  void _entidade
  const out: Proxima[] = []
  if (p.limite < 50) {
    for (const b of r.blocos) {
      const cortadoPorTamanho = (final.blocos.find((x) => x.formato === b.formato)?.cortadasPorTamanho ?? 0) > 0
      if (b.cortadasPorLimite > 0 && !cortadoPorTamanho) out.push({ chamada: { ...base, formato: b.formato, limite: 50 }, para: `ver até 50 linhas de ${nomeDoBloco(b.formato)}` })
    }
  }
  const linhas = r.blocos.flatMap((b) => b.linhas)
  if (p.ordenarPor !== 'engajamento' && temReacao(linhas)) out.push({ chamada: { ...base, ordenar_por: 'engajamento' }, para: 'ordenar por engajamento (curtidas e comentários por mil visualizações)' })
  else if (p.ordenarPor !== 'views') out.push({ chamada: { ...base, ordenar_por: 'views' }, para: 'ordenar por views' })
  const primeira = r.blocos.find((b) => b.linhas.length > 0)?.linhas[0]
  if (primeira) {
    out.push({ chamada: { acao: 'canal', canal_id: primeira.canalId }, para: 'ver o canal do vídeo do topo da lista' })
    out.push({ chamada: { acao: 'video', video_id: primeira.ytId }, para: 'ver o vídeo do topo da lista' })
  }
  return out
}
