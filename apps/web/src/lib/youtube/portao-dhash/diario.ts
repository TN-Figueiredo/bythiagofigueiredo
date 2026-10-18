import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { Variante } from './imagem'

export type Fase = 'preparado' | 'trocando' | 'trocada' | 'devolvendo' | 'devolvida' | 'conferida' | 'devolvida_sem_conferir' | 'devolucao_falhou'

export interface Medida {
  motivo: 'estavel' | 'teto' | 'parado'
  primeiraEm: number | null; estavelEm: number | null
  distanciaNaEstavel: number | null; menorDistancia: number | null
  sondas: number; outras: number; semDado: number; lacunas: number
  /** ETag da hqdefault na sonda estável (o ETag numérico é o instante do upload, spike S1). Ausente em estados antigos. */
  etagNaEstavel?: string | null
  /** Distância (bits) da primeira sonda (T+0) e a maior até 3 h da `desde`, contra a referência do alvo. Ausentes em estados antigos. */
  distanciaT0?: number | null
  maiorAte3h?: number | null
}

export interface Estado {
  versao: 1; video: string; fase: Fase; criadoEm: string; atualizadoEm: string
  original: { variante: Variante; largura: number; altura: number; sha256: string; sha256Hq: string; dhashHq: string }
  teste: { sha256: string; dhashComoHq: string; distanciaDoOriginal: number }
  trocaEm: number | null; devolucaoEm: number | null
  cotaGasta: number; tentativasDevolucao: number
  aparicao: Medida | null; volta: Medida | null
  /** ETag CRU (como veio, ex. W/"1792001270") da hqdefault lido antes da troca. Só informativo: a (ii) compara o ETag do teste com o da volta (Y-7). */
  etagAntes?: string | null
  /** Erro da sonda de antes da troca (Y-7), se ela lançou; null/ausente = a sonda respondeu. */
  erroSondaAntes?: string | null
  /** 'hq' = devolver-hq: o que sobe na devolução é original-hq.jpg (a hqdefault 480×360), não a maior cópia. Ausente = original-maior.jpg. */
  modo?: 'hq'
}

/** Arquivo e sha256 da imagem que a devolução sobe. */
export const arquivoDaOriginal = (e: Pick<Estado, 'modo' | 'original'>): { nome: string; sha256: string } =>
  e.modo === 'hq' ? { nome: 'original-hq.jpg', sha256: e.original.sha256Hq } : { nome: 'original-maior.jpg', sha256: e.original.sha256 }

export const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

export class Diario {
  constructor(readonly pasta: string, private readonly agora: () => number) {}
  private c(nome: string) { return path.join(this.pasta, nome) }
  private garantir() { fs.mkdirSync(this.pasta, { recursive: true }) }

  temAlgo(): boolean { return fs.existsSync(this.pasta) && fs.readdirSync(this.pasta).length > 0 }

  ler(): Estado | null {
    if (!fs.existsSync(this.c('estado.json'))) return null
    return JSON.parse(fs.readFileSync(this.c('estado.json'), 'utf8')) as Estado
  }

  /** Atômico: temporário + fsync + rename. Um processo morto deixa o estado anterior inteiro. */
  gravar(e: Estado): void {
    this.garantir()
    e.atualizadoEm = new Date(this.agora()).toISOString()
    const tmp = this.c('estado.json.tmp')
    const fd = fs.openSync(tmp, 'w')
    try { fs.writeSync(fd, JSON.stringify(e, null, 2)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    fs.renameSync(tmp, this.c('estado.json'))
    this.sincronizarPasta()
  }

  /** fsync da pasta: o rename só é durável depois dele. */
  private sincronizarPasta(): void {
    const fd = fs.openSync(this.pasta, 'r')
    try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  }

  /** Nunca sobrescreve (flag wx): a cópia da original não pode ser trocada pela imagem de teste numa segunda rodada. */
  salvarUmaVez(nome: string, bytes: Buffer): string {
    this.garantir()
    const fd = fs.openSync(this.c(nome), 'wx')
    try { fs.writeSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    this.sincronizarPasta()
    return sha256(bytes)
  }

  lerArquivo(nome: string): Buffer { return fs.readFileSync(this.c(nome)) }
  escrever(nome: string, texto: string): void { this.garantir(); fs.writeFileSync(this.c(nome), texto) }

  /** Nunca lança: o registro é auxiliar, o estado.json é o crítico. A falha vai para o stderr (que também não lança). */
  registrar(evento: string, dados: Record<string, unknown> = {}): void {
    try {
      this.garantir()
      fs.appendFileSync(this.c('registro.jsonl'), JSON.stringify({ em: new Date(this.agora()).toISOString(), evento, ...dados }) + '\n')
    } catch (err) {
      try { process.stderr.write(`aviso: não consegui registrar "${evento}": ${err instanceof Error ? err.message : String(err)}\n`) } catch { /* nada a fazer */ }
    }
  }
}
