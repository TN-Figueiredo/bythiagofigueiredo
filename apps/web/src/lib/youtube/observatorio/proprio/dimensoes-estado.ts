// A5 · E11 · Tarefa 11: o modelo dos estados das dimensões do canal próprio (origem, aparelho, país, inscrito, detalhe da
// origem, alcance por origem e aparelho). PURO: sem banco, sem servidor, sem texto de tela. A tela só lê o que sai daqui
// para nunca mentir: seis estados distintos, e nenhum vira zero nem vira o outro.
//
//   por CONJUNTO (a tabela inteira de um conjunto, `classificarConjunto`):
//     schema_ausente   a migration não foi aplicada (a leitura da tabela falhou por tabela ou coluna inexistente)
//     passo_desligado  o interruptor do passo está desligado agora
//     coleta_em_erro   a última tentativa de coleta falhou
//     nao_coletado     nada foi coletado ainda (tabela vazia e sem cobertura)
//     coletado         há cobertura ou linhas; o que cada dia vale vem do estado do dia
//   por DIA e valor (`estadoDoDia`):
//     valor | zero_medido | zero_ou_abaixo_do_limiar | em_revisao | nao_medido (antes do início, fora da cobertura, base não medida)
import { rotuloAparelho, rotuloOrigem, rotuloSistema } from '@/lib/youtube/reporting/codigos'
import { OUTCOMES, type Outcome } from '@/lib/youtube/coleta/types'

/** 'AAAA-MM-DD': o dia do YouTube (Pacífico), o mesmo das tabelas. */
export type DiaYt = string

export type ConjuntoDim = 'trafego' | 'dispositivo' | 'pais' | 'inscrito' | 'detalhe' | 'alcance_dim'
/** Os cinco que `lerDimensoes` entrega (o `detalhe` é de `lerDetalheDaOrigem`). */
export type ConjuntoDimensoes = Exclude<ConjuntoDim, 'detalhe'>
export const CONJUNTOS_DIMENSOES: readonly ConjuntoDimensoes[] = ['trafego', 'dispositivo', 'pais', 'inscrito', 'alcance_dim']

// ---------------------------------------------------------------------------------------------------------------
// O dia
// ---------------------------------------------------------------------------------------------------------------

export type EstadoValor =
  | { tipo: 'valor'; views: number | null; minutos: number | null }
  | { tipo: 'zero_medido' }
  | { tipo: 'zero_ou_abaixo_do_limiar' }
  | { tipo: 'em_revisao' }
  | { tipo: 'nao_medido'; motivo: 'antes_do_inicio' | 'fora_da_cobertura' | 'base_nao_medida'; desde: string | null }

/** A linha de um valor no dia. Em `alcance_dim`, `views` leva as IMPRESSÕES (a contagem principal do conjunto). */
export interface LinhaBasica { valor: string; views: number | null; minutos: number | null }

export interface ParamsDoDia {
  /** o dia está dentro de algum intervalo da cobertura DESTE conjunto para o vídeo */
  coberto: boolean
  /** a referência do dia (o diário, ou as impressões do alcance) foi medida: sem ela, não há como dizer zero */
  baseMedida: boolean
  antesDoInicio: boolean
  /** a data de partida do conjunto, para a frase "não medido antes de dd/mm" */
  desde: string | null
  linhas: readonly LinhaBasica[]
  /** com `baseMedida` verdadeiro, nulo quer dizer "o dia foi medido e não teve atividade": base 0 */
  base: number | null
}

export interface EstadoDoDia {
  /** soma das contagens das linhas do dia (nulo conta 0 só aqui; o estado de quem não tem linha nunca afirma zero com nulo na mão) */
  soma: number
  /** quanto da base ficou sem linha (abaixo do limiar do YouTube); nulo se não dá para afirmar */
  omitido: number | null
  emRevisao: boolean
  de(valor: string): EstadoValor
}

/**
 * Regras, nesta ordem: antes do início → `nao_medido/antes_do_inicio`; não coberto no conjunto → `fora_da_cobertura`; coberto e
 * `baseMedida` falso → `base_nao_medida` para todo valor (a base ausente NÃO vira zero); coberto com base medida: há linha do valor
 * → `valor`; sem linha: `soma = base` → `zero_medido`, `soma < base` → `zero_ou_abaixo_do_limiar` (`omitido = base − soma`),
 * `soma > base` → `em_revisao` para TODO valor do dia (inclusive os que têm linha), `omitido = null`.
 * Linha com a contagem nula impede afirmar zero: o valor sem linha fica `zero_ou_abaixo_do_limiar` e `omitido` nulo.
 */
export function estadoDoDia(p: ParamsDoDia): EstadoDoDia {
  const soma = p.linhas.reduce((s, l) => s + (l.views ?? 0), 0)
  const comNulo = p.linhas.some(l => l.views === null)
  const naoMedido = (motivo: 'antes_do_inicio' | 'fora_da_cobertura' | 'base_nao_medida'): EstadoValor =>
    ({ tipo: 'nao_medido', motivo, desde: motivo === 'base_nao_medida' ? null : p.desde })
  const fixo: EstadoValor | null = p.antesDoInicio ? naoMedido('antes_do_inicio')
    : !p.coberto ? naoMedido('fora_da_cobertura')
      : !p.baseMedida ? naoMedido('base_nao_medida')
        : null
  if (fixo) return { soma, omitido: null, emRevisao: false, de: () => fixo }
  const base = p.base ?? 0
  const emRevisao = soma > base
  const omitido = emRevisao || comNulo ? null : base - soma
  return {
    soma,
    omitido,
    emRevisao,
    de(valor: string): EstadoValor {
      if (emRevisao) return { tipo: 'em_revisao' }
      const linha = p.linhas.find(l => l.valor === valor)
      if (linha) return { tipo: 'valor', views: linha.views, minutos: linha.minutos }
      return !comNulo && soma === base ? { tipo: 'zero_medido' } : { tipo: 'zero_ou_abaixo_do_limiar' }
    },
  }
}

/** O dia como o leitor o entrega (`dia` e as demais colunas); `L` é a linha do conjunto (mais campos que `LinhaBasica`). */
export interface DiaLido<L extends LinhaBasica = LinhaBasica> extends ParamsDoDia {
  dia: DiaYt
  linhas: readonly L[]
}

export function estadoDoDiaLido(d: DiaLido): EstadoDoDia {
  return estadoDoDia(d)
}

/** Cliques estimados ÷ impressões; nulo se faltar um dos dois ou se não há impressões (nunca zero por ausência). */
export function taxaDeClique(impressoes: number | null, cliquesEst: number | null): number | null {
  if (impressoes === null || cliquesEst === null) return null
  if (!(impressoes > 0) || cliquesEst < 0) return null
  return cliquesEst / impressoes
}

// ---------------------------------------------------------------------------------------------------------------
// O conjunto
// ---------------------------------------------------------------------------------------------------------------

export type EstadoConjunto =
  | { tipo: 'schema_ausente' }
  | { tipo: 'passo_desligado'; comDados: boolean }
  | { tipo: 'coleta_em_erro'; outcome: Outcome | 'desconhecido'; comDados: boolean }
  | { tipo: 'nao_coletado' }
  | { tipo: 'coletado' }

const BENIGNOS: readonly string[] = ['ok', 'sem_dado_na_janela', 'video_novo']

/**
 * Precedência: schema ausente > passo desligado > coleta em erro > não coletado > coletado. `ultimaTentativa` é o pior resultado da
 * tentativa mais recente do conjunto (o leitor escolhe); resultado fora do catálogo é erro com o resultado "desconhecido", e o texto
 * dele nunca passa adiante. "Tabela vazia" só é `nao_coletado` sem cobertura nenhuma: com cobertura, o zero vem do dia.
 */
export function classificarConjunto(p: {
  schemaAusente: boolean
  passoDesligado: boolean
  ultimaTentativa: { outcome: string } | null
  temCobertura: boolean
  temLinhas: boolean
}): EstadoConjunto {
  if (p.schemaAusente) return { tipo: 'schema_ausente' }
  const comDados = p.temCobertura || p.temLinhas
  if (p.passoDesligado) return { tipo: 'passo_desligado', comDados }
  if (p.ultimaTentativa && !BENIGNOS.includes(p.ultimaTentativa.outcome)) {
    const o = p.ultimaTentativa.outcome
    const outcome = (OUTCOMES as readonly string[]).includes(o) ? (o as Outcome) : 'desconhecido'
    return { tipo: 'coleta_em_erro', outcome, comDados }
  }
  return comDados ? { tipo: 'coletado' } : { tipo: 'nao_coletado' }
}

// ---------------------------------------------------------------------------------------------------------------
// Rótulos: código desconhecido aparece como desconhecido (visível), nunca vazio
// ---------------------------------------------------------------------------------------------------------------

export interface RotuloDoValor { rotulo: string; catalogado: boolean }

const CORTE = 40
const cortar = (s: string): string => (s.length > CORTE ? s.slice(0, CORTE) + '…' : s)

function parte(r: { rotulo: string; catalogado: boolean }, nome: string): RotuloDoValor {
  return r.catalogado ? r : { rotulo: `${nome} desconhecid${nome === 'Origem' ? 'a' : 'o'} (${cortar(r.rotulo)})`, catalogado: false }
}

function juntar(partes: RotuloDoValor[]): RotuloDoValor {
  return { rotulo: partes.map(x => x.rotulo).join(' · '), catalogado: partes.every(x => x.catalogado) }
}

const origem = (v: string): RotuloDoValor => parte(rotuloOrigem(v), 'Origem')
const aparelho = (v: string): RotuloDoValor => parte(rotuloAparelho(v), 'Aparelho')
const sistema = (v: string): RotuloDoValor => parte(rotuloSistema(v), 'Sistema')

/** O rótulo de um valor de dimensão, por conjunto. `dispositivo`: `APARELHO|SISTEMA`; `alcance_dim`: `origem|aparelho|sistema` (códigos do lote). */
export function rotuloDoValor(conjunto: ConjuntoDim, valor: string): RotuloDoValor {
  const v = valor.trim()
  switch (conjunto) {
    case 'trafego':
    case 'detalhe':
      return origem(v)
    case 'dispositivo': {
      const [a = '', s = ''] = v.split('|')
      return juntar([aparelho(a), sistema(s)])
    }
    case 'alcance_dim': {
      const [o = '', a = '', s = ''] = v.split('|')
      return juntar([origem(o), aparelho(a), sistema(s)])
    }
    case 'pais':
      if (v === 'ZZ') return { rotulo: 'Região desconhecida', catalogado: false }
      return /^[A-Z]{2}$/.test(v) ? { rotulo: v, catalogado: true } : { rotulo: `País desconhecido (${cortar(v || 'sem valor')})`, catalogado: false }
    case 'inscrito':
      if (v === 'SUBSCRIBED') return { rotulo: 'Inscritos', catalogado: true }
      if (v === 'UNSUBSCRIBED') return { rotulo: 'Não inscritos', catalogado: true }
      return { rotulo: `Situação desconhecida (${cortar(v || 'sem valor')})`, catalogado: false }
  }
}
