// A5 E5a, Tarefa 20 (mockup 13): a frase-resumo nas oito variações da tabela (típico, magro, zero, não medido, semanal, saiu, ao vivo,
// vazio) e a faixa de números. Puro, com o relógio por parâmetro. Números grandes por extenso ("1,02 milhão"; nunca "mi" nesta tela).
// A frase termina com a segunda metade da pergunta do dono (algo mudou antes de subir?), sempre como lista de coincidências, sem causa.
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { abrev, dm, idadeTxt, juntar, milhar } from './formatos'
import { celulasDaFaixa, type BlocoDeIdade, type CelulaDeIdade, type PontoDeIdade } from './idade-model'
import { LISTA_CURTA_ATE, dentroDosDiasAntes, type MudancaNumerada } from './mudancas-model'
import { celulaDaSubida, type CartaoDaSubida, type CelulaDaSubida } from './subida-model'

export type VarianteDoResumo = 'tipico' | 'magro' | 'zero' | 'nao_medido' | 'semanal' | 'saiu' | 'ao_vivo' | 'vazio' | 'simples' | 'nao_carregou'

const ARTIGO: Record<string, string> = {
  título: 'o título', miniatura: 'a miniatura', descrição: 'a descrição', tags: 'as tags', categoria: 'a categoria', duração: 'a duração', capítulos: 'os capítulos', idioma: 'o idioma',
}

export interface EntradaDoResumo {
  hojeSP: string
  inicioDaContagem: string
  viewsAgora: number | null
  idade: BlocoDeIdade
  subida: CartaoDaSubida
  /** Nulo = as mudanças não foram lidas. */
  mudancas: readonly MudancaNumerada[] | null
  semanal: boolean
  aoVivo: boolean
  /** Dias com leitura (contagem por dia); zero = nenhuma ainda; nulo = a série não foi lida (portão Phil I1). */
  diasDeContagem: number | null
  /** Idade do vídeo em dias inteiros (para a frase simples). */
  idadeDoVideoDias: number
  /** Vídeo que saiu: o dia da saída e o da última contagem (`AAAA-MM-DD`). */
  saiu: { em: string; ultimaContagem: string | null } | null
  /** Vídeo que entrou tarde na contagem: o dia em que entrou e o da contagem que falta. */
  entrouTarde: { em: string; falta: string | null } | null
  /** Dias (e horas) com zero medido, e quantos foram medidos. */
  zeros: { dias: number; diasMedidos: number; horas: number | null; horasMedidas: number | null }
}

export interface FaixaDeNumeros {
  viewsAgora: { rotulo: 'Views agora'; texto: string; sub: string }
  idades: CelulaDeIdade[]
  subida: CelulaDaSubida
}

export interface Resumo {
  variante: VarianteDoResumo
  frase: string
  faixa: FaixaDeNumeros
}

const viewsTxt = (n: number | null, exato: boolean): string => (n === null ? 'sem número' : exato ? milhar(n) : abrev(n))

/** A frase "Nos 14 dias antes, o canal mudou…" (só com subida). */
function fraseAntes(mudancas: readonly MudancaNumerada[] | null, subidaDia: string): string {
  // TEXTO-A-REVISAR: mudanças não lidas nunca viram "nenhuma mudança"
  if (mudancas === null) return ' Não carregou: as mudanças deste vídeo não foram lidas.'
  const antes = mudancas.filter((m) => dentroDosDiasAntes(m, subidaDia))
  const dias = MEASURE_RULES.rise.lookbackDays
  if (antes.length === 0) return ` Nenhuma mudança registrada nos ${dias} dias antes.`
  if (antes.length > LISTA_CURTA_ATE) return ` O canal fez ${mudancas.length} mudanças no vídeo, ${antes.length} delas nos ${dias} dias antes (a lista está no fim da página).`
  const por = new Map<string, string[]>()
  for (const m of antes) {
    const k = m.tipo === 'titulo' ? 'título' : m.tipo === 'miniatura' ? 'miniatura' : m.nomeDosCampos
    por.set(k, [...(por.get(k) ?? []), dm(m.dia)])
  }
  const ordem = (k: string): number => (k === 'título' ? 0 : k === 'miniatura' ? 1 : 2)
  const itens = [...por.keys()].sort((a, b) => ordem(a) - ordem(b)).map((k) => `${ARTIGO[k] ?? k} (${juntar(por.get(k)!)})`)
  return ` Nos ${dias} dias antes, o canal mudou ${juntar(itens)}.`
}

/** O ponto de referência da frase típica: a maior idade (30, 7, 3, 1) com o vídeo medido e o normal medido. */
function referencia(pontos: readonly PontoDeIdade[]): PontoDeIdade | null {
  for (const a of [30, 7, 3, 1]) {
    const p = pontos.find((x) => x.idade === a)
    if (p && p.video.tipo === 'medido' && p.normal.tipo === 'medido') return p
  }
  return null
}

export function resumoDoVideo(e: EntradaDoResumo): Resumo {
  const subiu = e.subida.tipo === 'subiu' ? e.subida : null
  const sub = subiu ? ` ▲ Subiu em ${dm(subiu.dia)}.${fraseAntes(e.mudancas, subiu.dia)}` : ''
  const zeros = e.zeros
  const pouquissimo =
    (zeros.dias > 0 && zeros.diasMedidos > 0 && zeros.dias * 2 >= zeros.diasMedidos) ||
    (zeros.horas !== null && zeros.horasMedidas !== null && zeros.horas > 0 && zeros.horas * 2 >= zeros.horasMedidas)

  let variante: VarianteDoResumo
  let frase: string
  const views = e.viewsAgora
  if (e.diasDeContagem === null && e.saiu === null && !e.semanal && e.idade.tipo !== 'nao_medido') {
    variante = 'nao_carregou'
    // TEXTO-A-REVISAR: a série não foi lida; o histórico existe, só não carregou (nunca "ainda não há histórico")
    frase = `O vídeo tem ${viewsTxt(views, true)} views agora. O histórico por dia não carregou; recarregue a página.`
  } else if (e.diasDeContagem === 0 && e.saiu === null && !e.semanal && e.idade.tipo !== 'nao_medido') {
    variante = 'vazio'
    frase = `O vídeo tem ${viewsTxt(views, true)} views agora. Ainda não há histórico: a primeira contagem por dia é às 12:00 de amanhã.`
  } else if (e.saiu !== null) {
    variante = 'saiu'
    const n = e.diasDeContagem
    // sem leitura (ou série não lida) não há "última contagem": nem data nem número inventados
    frase = e.saiu.ultimaContagem === null || n === null || n === 0
      ? `O vídeo saiu do YouTube em ${dm(e.saiu.em)}. ${n === null ? 'A contagem por dia não carregou' : 'Não há nenhuma contagem por dia dele'}, então não há última contagem para mostrar.`
      : `O vídeo saiu do YouTube em ${dm(e.saiu.em)}. A última contagem, em ${dm(e.saiu.ultimaContagem)}, foi de ${viewsTxt(views, true)} views, depois de ${n} ${n === 1 ? 'dia' : 'dias'} de contagem. A contagem termina em ${dm(e.saiu.ultimaContagem)}.`
  } else if (e.aoVivo) {
    variante = 'ao_vivo'
    frase = `Vídeo ao vivo ou estreia: tem ${viewsTxt(views, false)} views e fica fora do normal do canal, que só conta vídeos comuns.${sub}`
  } else if (e.idade.tipo === 'nao_medido') {
    variante = 'magro'
    frase = `O vídeo tem ${viewsTxt(views, false)} views agora. Foi publicado antes de ${dm(e.inicioDaContagem)}, então a contagem por dia só existe desde ${dm(e.inicioDaContagem)} e a comparação por idade não dá.`
  } else if (e.semanal) {
    variante = 'semanal'
    frase = `O vídeo tem ${viewsTxt(views, false)} views e uma contagem por semana: o que sobe e desce dentro da semana não aparece.`
  } else if (e.entrouTarde !== null) {
    variante = 'nao_medido'
    const falta = e.entrouTarde.falta ? ` e falta a de ${dm(e.entrouTarde.falta)}` : ''
    frase = `O vídeo tem ${viewsTxt(views, false)} views agora, mas entrou na contagem só em ${dm(e.entrouTarde.em)}${falta}: quase tudo abaixo é “não medido”, cada um com o motivo.`
  } else if (pouquissimo) {
    variante = 'zero'
    const h = zeros.horas !== null && zeros.horasMedidas !== null ? `, e em ${zeros.horas} das ${zeros.horasMedidas} horas medidas também não` : ''
    frase = `O vídeo tem só ${viewsTxt(views, true)} views. Em ${zeros.dias} dos ${zeros.diasMedidos} dias não ganhou nenhuma view (medido: 0)${h}.`
  } else {
    const ref = e.idade.tipo === 'ok' ? referencia(e.idade.pontos) : null
    if (ref && ref.video.tipo === 'medido' && ref.normal.tipo === 'medido') {
      variante = 'tipico'
      frase = `Com ${idadeTxt(ref.idade)}, o vídeo tinha ${abrev(ref.video.views)} views ● e o normal do canal, ${abrev(ref.normal.views)} □ (${ref.normal.n} vídeos): ${ref.razao?.texto ?? ''}.${sub}`
    } else {
      variante = 'simples'
      frase = `O vídeo tem ${viewsTxt(views, false)} views com ${idadeTxt(e.idadeDoVideoDias)}.${sub}`
    }
  }

  const saiu = e.saiu !== null
  return {
    variante, frase,
    faixa: {
      viewsAgora: {
        rotulo: 'Views agora',
        texto: viewsTxt(views, saiu),
        sub: saiu ? (e.saiu!.ultimaContagem === null ? 'sem contagem por dia' : `última contagem, ${dm(e.saiu!.ultimaContagem)}`) : 'contagem de hoje',
      },
      idades: celulasDaFaixa(e.idade),
      subida: celulaDaSubida(e.subida, e.diasDeContagem),
    },
  }
}
