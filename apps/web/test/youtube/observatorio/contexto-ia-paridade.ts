/**
 * A5 · E17 degrau 1, Tarefa 5: o auxiliar de teste que prova a paridade entre a tela e o pacote. Cada teste de empacotador (Tarefas 6 e 7)
 * chama `provarParidade` com o modelo da tela, o inventário de folhas, o pacote que o empacotador montou, o texto da tela expandida e o
 * texto do pacote. Falha (lança) com uma mensagem que diz o caminho.
 */
import { act, fireEvent } from '@testing-library/react'
import {
  destinoDe, folhas, generalizar, passosDaOrigem, resolverOrigem, semDestino, type Destino, type Inventario, type ValorDeFolha,
} from '@/lib/youtube/observatorio/contexto-ia/inventario'
import { naCelula } from '@/lib/youtube/observatorio/contexto-ia/terceiros'
import type { Celula, PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'

/** Número cru que a tela formata no componente: o empacotador usa o MESMO formatador, e a igualdade compara com ele aplicado à folha. */
export interface FolhaCrua { caminho: string; nome: string; formatador: (valor: ValorDeFolha) => string }

export interface EntradaDaParidade {
  modelo: unknown
  inventario: Inventario
  pacote: PacoteModelo
  textoDaTela: string
  textoDoPacote: string
  /** (d3) id da tabela → título da coluna → o fim do caminho que a `origem` de toda célula dessa coluna tem de ter. Escrito à mão no teste de cada tela. */
  colunas: Record<string, Record<string, string | readonly string[]>>
  /** Folhas de número cru e o formatador de cada uma (`SEM_PROVA_POR_IGUALDADE_DIRETA` do teste da tela). */
  cruas?: readonly FolhaCrua[]
}

/** O fim do caminho, com fronteira: 'base' casa com 'x.base' e com 'x', '.base' casa com 'x.base'; 'ase' e 'mediana' contra 'submediana' não. */
const terminaEm = (origem: string, fim: string): boolean => {
  if (!origem.endsWith(fim)) return false
  if (origem.length === fim.length || /^[.[\]]/.test(fim)) return true
  return /[.\]]$/.test(origem.slice(0, origem.length - fim.length))
}

export const normalizar = (s: string): string => s.replace(/\s+/g, ' ').trim()

const textoDaFolha = (valor: ValorDeFolha | undefined, caminho: string, cruas: readonly FolhaCrua[]): string | null => {
  if (valor === null || valor === undefined) return null
  const crua = cruas.find((c) => c.caminho === caminho)
  return crua ? crua.formatador(valor) : String(valor)
}

/** O texto que a célula carrega e que tem de ser igual ao da folha de origem: o texto, ou o motivo de quem não foi medido. */
const textoDaCelula = (c: Celula): string => (c.papel === 'numero' && c.estado === 'nao_medido' ? c.motivo : c.texto)

function destinoCompativel(c: Celula, destino: Destino | undefined, daSerie: boolean): boolean {
  if (destino === undefined || typeof destino !== 'string') return false
  if (c.papel === 'numero') return c.estado === 'nao_medido' ? destino === 'motivo' : destino === 'numero' || (daSerie && destino === 'serie')
  return destino === c.papel
}

/** Os índices de lista que a origem atravessa, na ordem. */
const indicesDaOrigem = (origem: string): number[] => passosDaOrigem(origem).flatMap((p) => ('indice' in p && p.indice !== null ? [p.indice] : []))

function lerJsonDoPacote(textoDoPacote: string): { medidas: Array<{ tabela: string; valores: Record<string, unknown> }> } | null {
  const a = textoDoPacote.indexOf('## 8. Bloco estruturado\n')
  const b = textoDoPacote.indexOf('\n## 9. Minha pergunta')
  if (a === -1 || b === -1) return null
  try { return JSON.parse(textoDoPacote.slice(a + '## 8. Bloco estruturado\n'.length, b)) } catch { return null }
}

const esperadoNoJson = (c: Celula): Record<string, unknown> => {
  if (c.papel !== 'numero') return { texto: naCelula(c.texto) }
  if (c.estado === 'nao_medido') return { estado: 'nao_medido', motivo: naCelula(c.motivo) }
  return { estado: c.estado, texto: naCelula(c.texto) }
}

/** O JSON lido de volta tem o mesmo texto, estado e motivo da célula (o resto do que ele escreve, como `x`, não entra na comparação). */
const mesmoNoJson = (dele: unknown, c: Celula): boolean => {
  const d = (dele ?? {}) as Record<string, unknown>
  const m = esperadoNoJson(c)
  return JSON.stringify([d['estado'], d['texto'], d['motivo']]) === JSON.stringify([m['estado'], m['texto'], m['motivo']])
}

export function provarParidade(e: EntradaDaParidade): void {
  const problemas: string[] = []
  const cruas = e.cruas ?? []
  const tela = normalizar(e.textoDaTela)
  const pacoteTexto = normalizar(e.textoDoPacote)

  // (a) toda folha do modelo tem destino
  for (const caminho of semDestino(e.modelo, e.inventario)) problemas.push(`(a) folha sem destino no inventário: ${caminho}`)

  // (b) tela → pacote (segunda rede, por presença de texto no documento inteiro)
  for (const f of folhas(e.modelo)) {
    const destino = destinoDe(f.caminho, e.inventario)
    if (destino !== 'numero' && destino !== 'base' && destino !== 'motivo') continue
    const texto = textoDaFolha(f.valor, f.caminho, cruas)
    if (texto === null || texto.trim() === '') continue
    const t = normalizar(texto)
    if (tela.includes(t) && !pacoteTexto.includes(t)) problemas.push(`(b) a tela mostra "${t}" (${f.caminho}) e o pacote não`)
  }

  for (const t of e.pacote.tabelas) {
    const mapa = e.colunas[t.id]
    t.linhas.forEach((linha, i) => {
      // (d) toda origem existe no modelo, com destino compatível; (d2) o texto é igual ao da folha; as células da linha apontam para o mesmo elemento
      const indicesDaLinha: number[][] = []
      linha.forEach((c, j) => {
        const onde = `${t.id}, linha ${i + 1}, coluna "${t.colunas[j] ?? j}"`
        if (c.origem.includes('[]')) { problemas.push(`(d) origem sem índice numa lista (${onde}): ${c.origem}`); return }
        const r = resolverOrigem(e.modelo, c.origem)
        if (!r.existe) { problemas.push(`(d) a origem não existe no modelo (${onde}): ${c.origem}`); return }
        const caminho = generalizar(passosDaOrigem(c.origem))
        if (!destinoCompativel(c, destinoDe(caminho, e.inventario), t.tipo === 'dia_a_dia')) {
          problemas.push(`(d) destino incompatível (${onde}): ${c.origem} → ${JSON.stringify(destinoDe(caminho, e.inventario))} para célula ${c.papel}`)
        }
        const daFolha = textoDaFolha(r.valor, caminho, cruas)
        if (daFolha === null || normalizar(textoDaCelula(c)) !== normalizar(daFolha)) {
          problemas.push(`(d2) o texto da célula não é o da folha (${onde}): célula "${normalizar(textoDaCelula(c))}", folha ${c.origem} "${daFolha === null ? 'nulo' : normalizar(daFolha)}"`)
        }
        indicesDaLinha.push(indicesDaOrigem(c.origem))
        // (d3) a célula sob o cabeçalho certo
        const coluna = t.colunas[j] ?? ''
        const aceitos = mapa?.[coluna] === undefined ? undefined : ([] as string[]).concat(mapa[coluna] as string | string[])
        if (aceitos === undefined) problemas.push(`(d3) coluna sem entrada no mapa (${onde})`)
        else if (!aceitos.some((fim) => terminaEm(c.origem, fim))) problemas.push(`(d3) célula sob o cabeçalho errado (${onde}): a origem ${c.origem} deveria terminar em ${aceitos.join(' ou ')}`)
      })
      for (let x = 0; x < indicesDaLinha.length; x += 1) {
        for (let y = x + 1; y < indicesDaLinha.length; y += 1) {
          const n = Math.min(indicesDaLinha[x]!.length, indicesDaLinha[y]!.length)
          if (indicesDaLinha[x]!.slice(0, n).join(',') !== indicesDaLinha[y]!.slice(0, n).join(',')) {
            problemas.push(`(d2) as células da linha ${i + 1} de ${t.id} apontam para elementos diferentes da lista: ${linha[x]!.origem} e ${linha[y]!.origem}`)
            x = indicesDaLinha.length
            break
          }
        }
      }
    })
  }

  // (c) pacote → tela: número, base e motivo do pacote aparecem na tela expandida (salvo dia a dia, que a origem já conferiu)
  for (const t of e.pacote.tabelas) {
    if (t.tipo === 'dia_a_dia') continue
    for (const linha of t.linhas) {
      for (const c of linha) {
        if (c.papel === 'rotulo' || c.papel === 'terceiros') continue
        const texto = normalizar(textoDaCelula(c))
        if (texto !== '' && !tela.includes(texto)) problemas.push(`(c) o pacote tem "${texto}" (${c.origem}) e a tela não`)
      }
    }
  }

  // (e) o JSON do bloco estruturado, lido de volta, tem o mesmo texto, estado e motivo das células
  const json = lerJsonDoPacote(e.textoDoPacote)
  if (json === null) problemas.push('(e) o texto do pacote não tem um bloco estruturado legível')
  else {
    for (const t of e.pacote.tabelas) {
      const entradas = json.medidas.filter((m) => m.tabela === t.id)
      if (t.tipo === 'dia_a_dia') {
        const linhasJson = (entradas[0]?.valores['linhas'] ?? []) as Array<Record<string, unknown>>
        if (linhasJson.length !== t.linhas.length) { problemas.push(`(e) ${t.id}: o JSON tem ${linhasJson.length} dias e a tabela ${t.linhas.length}`); continue }
        t.linhas.forEach((linha, i) => { for (const [j, c] of linha.entries()) if (!mesmoNoJson(Object.values(linhasJson[i] ?? {})[j], c)) problemas.push(`(e) ${t.id}, dia ${i + 1}, coluna ${j + 1}: o JSON diverge da tabela`) })
        continue
      }
      const linhasJson = entradas.filter((m) => !('bloco' in m.valores))
      if (linhasJson.length !== t.linhas.length) { problemas.push(`(e) ${t.id}: o JSON tem ${linhasJson.length} linhas e a tabela ${t.linhas.length}`); continue }
      t.linhas.forEach((linha, i) => {
        const valores = Object.values(linhasJson[i]!.valores)
        linha.forEach((c, j) => {
          if (!mesmoNoJson(valores[j], c)) problemas.push(`(e) ${t.id}, linha ${i + 1}, coluna "${t.colunas[j] ?? j}": o JSON diverge da tabela`)
        })
      })
    }
  }

  if (problemas.length) throw new Error(`paridade entre a tela e o pacote:\n${problemas.map((p) => `  - ${p}`).join('\n')}`)
}

// ───────────────────────── a tela expandida
const textoDe = (el: Element): string => normalizar(el.textContent ?? '')
const botoes = (raiz: HTMLElement): HTMLElement[] => [...raiz.querySelectorAll<HTMLElement>('button, [role="button"]')]
const MAIS = /^(carregar|mostrar|ver) mais\b/i

async function clicar(el: Element): Promise<void> {
  await act(async () => { fireEvent.click(el) })
}

/**
 * O texto da tela com tudo aberto: clica "Carregar mais" e "Mostrar mais" até não mudar mais nada, abre todo texto de descrição
 * fechado (`aria-expanded="false"`) e alterna cada seletor de medida (abas e botões de rádio) uma vez, juntando o texto de todos os estados.
 * A lista do que ele sabe expandir é a tabela da seção 4.3 do plano mais o resultado da conferência C15.
 */
export async function expandirTela(raiz: HTMLElement): Promise<string> {
  const estados: string[] = []
  for (let volta = 0; volta < 300; volta += 1) {
    const alvo = botoes(raiz).find((b) => MAIS.test(textoDe(b)) && b.getAttribute('aria-disabled') !== 'true' && !(b as HTMLButtonElement).disabled)
    if (!alvo) break
    const antes = textoDe(raiz)
    await clicar(alvo)
    if (textoDe(raiz) === antes) break // clicou e nada mudou: não é paginação
  }
  const abertos = new WeakSet<Element>()
  for (let volta = 0; volta < 300; volta += 1) {
    const fechado = [...raiz.querySelectorAll<HTMLElement>('[aria-expanded="false"]')].find((el) => !abertos.has(el) && !el.hasAttribute('aria-haspopup'))
    if (!fechado) break
    abertos.add(fechado)
    await clicar(fechado)
  }
  estados.push(textoDe(raiz))
  for (const grupo of raiz.querySelectorAll<HTMLElement>('[role="tablist"], [role="radiogroup"]')) {
    const opcoes = [...grupo.querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]')]
    const original = opcoes.find((o) => o.getAttribute('aria-selected') === 'true' || o.getAttribute('aria-checked') === 'true')
    for (const o of opcoes) {
      if (o === original) continue
      await clicar(o)
      estados.push(textoDe(raiz))
    }
    if (original) { await clicar(original); estados.push(textoDe(raiz)) }
  }
  return estados.join('\n')
}
