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
}

export interface Estado {
  versao: 1; video: string; fase: Fase; criadoEm: string; atualizadoEm: string
  original: { variante: Variante; largura: number; altura: number; sha256: string; sha256Hq: string; dhashHq: string }
  teste: { sha256: string; dhashComoHq: string; distanciaDoOriginal: number }
  trocaEm: number | null; devolucaoEm: number | null
  cotaGasta: number; tentativasDevolucao: number
  aparicao: Medida | null; volta: Medida | null
}

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
  }

  /** Nunca sobrescreve (flag wx): a cópia da original não pode ser trocada pela imagem de teste numa segunda rodada. */
  salvarUmaVez(nome: string, bytes: Buffer): string {
    this.garantir()
    fs.writeFileSync(this.c(nome), bytes, { flag: 'wx' })
    return sha256(bytes)
  }

  lerArquivo(nome: string): Buffer { return fs.readFileSync(this.c(nome)) }
  escrever(nome: string, texto: string): void { this.garantir(); fs.writeFileSync(this.c(nome), texto) }

  registrar(evento: string, dados: Record<string, unknown> = {}): void {
    this.garantir()
    fs.appendFileSync(this.c('registro.jsonl'), JSON.stringify({ em: new Date(this.agora()).toISOString(), evento, ...dados }) + '\n')
  }
}
