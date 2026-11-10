// A7d T3: a seção "Cobertura" no fim de toda resposta `ok` da IA. Pura: sem relógio, sem banco. Só recebe números do MODELO (nunca extraídos de frase).
import type { PacoteSerializado } from '../contexto-ia/segmentar'

export interface Cobertura {
  lista?: { titulo: string; de: number; ate: number; total: number; concorrentes?: boolean }
  serie?: { pontos: number; total: number; de: string; ate: string; grao: 'dia' | 'semana' }
  apoio: { inteiras: number; total: number; cortadas: Array<{ titulo: string; saiu: number; de: number }> }
  foraDoPacote?: { mostrados: number; total: number }
  cortesDeTamanho: string[]
  numeros: PacoteSerializado['numeros']
  lidaAs?: string
  marcaMudou?: boolean
  vazio: boolean
  proximas: Array<{ chamada: Record<string, unknown>; para: string }>
}
export const RODAPE_MAX = 1_800

const dmy = (d: string): string => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d)
const encurta = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`)

/** Completa = sem lista ou `ate == total`, sem série parcial, apoio todo inteiro, sem corte de tamanho e sem grupo paginado pela tela. Vazia nunca é completa. */
export function coberturaCompleta(c: Cobertura): boolean {
  if (c.vazio) return false
  if (c.lista && c.lista.ate !== c.lista.total) return false
  if (c.serie && c.serie.pontos < c.serie.total) return false
  if (c.apoio.cortadas.length > 0 || c.apoio.inteiras < c.apoio.total) return false
  if (c.cortesDeTamanho.length > 0) return false
  if (c.foraDoPacote) return false
  return true
}

/** `naoMedidos` do modelo já soma falhou e restrito; `max` protege quem monta o objeto à mão. */
const semMedida = (n: Cobertura['numeros']): number => Math.max(n.naoMedidos, n.falhou + n.restrito)

function fraseFinal(c: Cobertura): string {
  if (c.vazio) return 'A lista está vazia neste recorte; vazio não é zero.'
  if (!coberturaCompleta(c)) return 'Você viu só uma parte: diga isso a quem perguntou antes de concluir sobre o conjunto e ofereça aprofundar.'
  const k = semMedida(c.numeros)
  return k > 0
    ? `Você viu tudo o que a tela mostra neste recorte, mas ${k} números estão sem medida; sem medida não é zero.`
    : 'Você viu tudo o que a tela mostra neste recorte.'
}

/** Os degraus do corte do rodapé, do primeiro ao último a aplicar quando passa de `RODAPE_MAX`. */
interface Nivel { paraQue: number; titulosDeApoio: boolean; chamadas: number; serieCurta: boolean; tituloDaLista: number }
const NIVEIS: Nivel[] = [
  { paraQue: Infinity, titulosDeApoio: true, chamadas: 3, serieCurta: false, tituloDaLista: 200 },
  { paraQue: 30, titulosDeApoio: true, chamadas: 3, serieCurta: false, tituloDaLista: 200 },
  { paraQue: 30, titulosDeApoio: false, chamadas: 3, serieCurta: false, tituloDaLista: 200 },
  { paraQue: 30, titulosDeApoio: false, chamadas: 2, serieCurta: false, tituloDaLista: 200 },
  { paraQue: 30, titulosDeApoio: false, chamadas: 1, serieCurta: false, tituloDaLista: 200 },
  { paraQue: 30, titulosDeApoio: false, chamadas: 1, serieCurta: true, tituloDaLista: 200 },
  { paraQue: 30, titulosDeApoio: false, chamadas: 1, serieCurta: true, tituloDaLista: 60 },
]

function montar(c: Cobertura, n: Nivel): string {
  const L: string[] = ['## Cobertura']
  if (c.marcaMudou) L.push('- A lista mudou desde a janela anterior: linhas podem repetir ou faltar; refaça da linha 1.')
  if (c.lista) {
    const l = c.lista
    const trecho = l.total === 0 ? '0 de 0 linhas' : `linhas ${l.de}–${l.ate} de ${l.total}`
    L.push(`- Lista principal ("${encurta(l.titulo, n.tituloDaLista)}"): ${trecho}${l.concorrentes ? '; seu canal está na parte do dado privado' : ''}, na ordem da tela.${c.lidaAs ? ` Lida às ${c.lidaAs}.` : ''}`)
  }
  if (c.serie) {
    const s = c.serie
    L.push(n.serieCurta ? `- Série: ${s.pontos} de ${s.total} pontos, grão ${s.grao}.` : `- Série: ${s.pontos} de ${s.total} pontos entre ${dmy(s.de)} e ${dmy(s.ate)}, grão ${s.grao}.`)
  }
  if (c.apoio.total > 0 || c.apoio.cortadas.length > 0) {
    const cort = c.apoio.cortadas
    let fim = ''
    if (cort.length > 0) {
      if (n.titulosDeApoio) {
        const vistas = cort.slice(0, 3).map((x) => `"${x.titulo}" (${x.saiu} de ${x.de} linhas)`).join(', ')
        fim = `; cortadas: ${vistas}${cort.length > 3 ? `, mais ${cort.length - 3}` : ''}`
      } else fim = `; cortadas: mais ${cort.length}`
    }
    L.push(`- Tabelas de apoio: ${c.apoio.inteiras} de ${c.apoio.total} inteiras${fim}.`)
  }
  if (c.foraDoPacote) L.push(`- A tela mostra ${c.foraDoPacote.mostrados} de ${c.foraDoPacote.total} outliers (cada grupo é paginado na tela); os outros não estão neste pacote.`)
  if (c.cortesDeTamanho.length > 0) {
    const r = c.cortesDeTamanho
    L.push(`- Cortado por tamanho: ${r.slice(0, 3).join('; ')}${r.length > 3 ? `, mais ${r.length - 3}` : ''}.`)
  }
  const k = c.numeros
  L.push(`- Números nesta resposta: ${k.medidos} medidos, ${k.zerosMedidos} zeros medidos, ${semMedida(k)} sem medida (${k.falhou} falharam, ${k.restrito} restritos).`)
  L.push(`- ${fraseFinal(c)}`)
  const proximas = c.proximas.slice(0, n.chamadas)
  if (proximas.length > 0) {
    L.push('Próximas chamadas (use uma se precisar de mais):')
    for (const p of proximas) L.push(`- ${JSON.stringify(p.chamada)} : ${encurta(p.para, n.paraQue)}`)
  }
  return L.join('\n')
}

/** Sempre ≤ `RODAPE_MAX`. Nunca cai: a linha da lista, a de números, a frase final, o aviso de lista mudada e a chamada 1. */
export function secaoDeCobertura(c: Cobertura): string {
  let t = ''
  for (const n of NIVEIS) {
    t = montar(c, n)
    if (t.length <= RODAPE_MAX) return t
  }
  return t
}
