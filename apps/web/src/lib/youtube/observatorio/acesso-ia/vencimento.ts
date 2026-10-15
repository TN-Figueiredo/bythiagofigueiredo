// A5 · E17 degrau 2, Tarefa 14: o vencimento da chave do perfil. Puro.
//   - `conferenciaDeVencimento`: a conferência com data do DONO, 14 dias antes de a chave vencer (a Tarefa 20 acrescenta uma entrada em
//     `lib/conferencias.ts` por chave criada). O aviso no cabeçalho do Observatório espera mockup aprovado; por isso a função que o alimentaria
//     (`chavesAVencer`) não nasce aqui, e nenhum componente de tela importa este arquivo;
//   - `podeRenovar`: o comando de criar aceita uma SEGUNDA chave da mesma pessoa quando a atual vence em até 14 dias (renovar sem buraco).
import { instanteValido } from '@/lib/pipeline/chave'
import type { Conferencia } from '@/lib/conferencias'
import { ACESSO_IA_RULES } from './regras'

const DIA_MS = 86_400_000
const TRES_HORAS_MS = 3 * 3_600_000 // São Paulo é UTC-3, sem horário de verão desde 2019 (igual a `lib/pipeline/chave.ts`)

/** O nome que o comando de criar gera: sem dado pessoal, único por emissão. Só ele vai ao git. */
const NOME_DA_CHAVE = /^observatorio-(\d{4})(\d{2})(\d{2})-[0-9a-f]{4}$/

const dataReal = (a: number, m: number, d: number): boolean => {
  const t = new Date(Date.UTC(a, m - 1, d))
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

const dataDoTextoExiste = (instante: string): boolean => dataReal(Number(instante.slice(0, 4)), Number(instante.slice(5, 7)), Number(instante.slice(8, 10)))

const PLANO = 'docs/superpowers/plans/2026-10-13-a5-e17-degrau-2-acesso-pelo-claude-code-plan.md, seção 7 (vencimento da chave)'

/**
 * `null` quando `expiresAt` não passa em `instanteValido` ou o nome não tem a forma `observatorio-AAAAMMDD-xxxx`: nunca uma conferência com
 * data inventada, nunca um identificador que carregue e-mail ou nome de pessoa.
 */
export function conferenciaDeVencimento(nomeDaChave: string, expiresAt: string): Conferencia | null {
  const m = NOME_DA_CHAVE.exec(nomeDaChave)
  if (!m || !dataReal(Number(m[1]), Number(m[2]), Number(m[3]))) return null
  // o motor de datas aceita 30 de fevereiro e rola para março: a data do TEXTO tem de existir
  if (!instanteValido(expiresAt) || !dataDoTextoExiste(expiresAt)) return null
  const venceNoDiaDeSp = new Date(Date.parse(expiresAt) - TRES_HORAS_MS)
  const dia = new Date(Date.UTC(venceNoDiaDeSp.getUTCFullYear(), venceNoDiaDeSp.getUTCMonth(), venceNoDiaDeSp.getUTCDate() - ACESSO_IA_RULES.avisoDeVencimentoDias))
  const dd = String(venceNoDiaDeSp.getUTCDate()).padStart(2, '0')
  const mm = String(venceNoDiaDeSp.getUTCMonth() + 1).padStart(2, '0')
  return {
    id: `e17d2-chave-${nomeDaChave}-vence`,
    etapa: 'E17',
    data: dia.toISOString().slice(0, 10),
    responsavel: 'dono',
    onde: `${PLANO}: a chave ${nomeDaChave} vence em ${dd}/${mm}. Decida renovar (criar outra com o comando; ele aceita a segunda chave a partir de hoje) ou deixar vencer; nos dois casos marque esta conferência como feita, ou 7 dias depois do vencimento o cron fica vermelho`,
    feitaEm: null,
  }
}

/** Verdadeiro quando faltam 14 dias ou menos (inclusive já vencida). `expiresAt` inválida ou `agora` inválido: falso. */
export function podeRenovar(expiresAt: string, agora: number): boolean {
  if (!instanteValido(expiresAt) || !Number.isFinite(agora)) return false
  return Date.parse(expiresAt) - agora <= ACESSO_IA_RULES.avisoDeVencimentoDias * DIA_MS
}
