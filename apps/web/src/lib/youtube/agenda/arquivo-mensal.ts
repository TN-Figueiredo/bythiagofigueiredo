// apps/web/src/lib/youtube/agenda/arquivo-mensal.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { BANCO_MS, comPrazo } from './relogio'
import type { ItemAgenda } from './saude'
import type { Lido } from './tipos'

/**
 * O vigia do arquivo mensal (manutenção M3b, Tarefa 13; spec 02 §10.6, itens 28 e 160). Rotina de LEITURA, a cada disparo do vigia;
 * não desliga com `OBS_AGENDA=off`. Dado ausente nunca é verde: função ausente (`42883`), erro, exceção, resposta fora da forma
 * ou nenhum site lido → vermelho "sem leitura". Verde só com a leitura certa e tudo zero.
 */
export interface LeituraArquivo {
  atraso: { amarelos: number; vermelhos: number; meses_sem_selo: number }
  vigia: { c1: number; c2: number; c3: number; c4: number }
}
export type Gravidade = 'verde' | 'amarelo' | 'vermelho'
export interface Avaliacao { gravidade: Gravidade; motivo: string }

export const NOME_ATRASO = 'arquivo_atraso_copia'
export const NOME_VIGIA = 'arquivo_vigia_remocao'
export const MOTIVO_SEM_LEITURA = 'arquivo mensal: sem leitura'
const TOLERANCIA_H = 24

const nat = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
const obj = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null)

function lerAtraso(x: unknown): LeituraArquivo['atraso'] | null {
  const o = obj(x)
  if (!o || !nat(o.amarelos) || !nat(o.vermelhos) || !nat(o.meses_sem_selo)) return null
  return { amarelos: o.amarelos, vermelhos: o.vermelhos, meses_sem_selo: o.meses_sem_selo }
}
function lerVigia(x: unknown): LeituraArquivo['vigia'] | null {
  const o = obj(x)
  if (!o || !nat(o.c1) || !nat(o.c2) || !nat(o.c3) || !nat(o.c4)) return null
  return { c1: o.c1, c2: o.c2, c3: o.c3, c4: o.c4 }
}

/** Lê os sites e, para cada um, `obs_archive_atraso` e `obs_archive_vigia_remocao`; soma. Nunca lança. */
export async function lerArquivoParaVigia(sb: SupabaseClient): Promise<Lido<LeituraArquivo>> {
  try {
    const s = await sb.from('sites').select('id').abortSignal(AbortSignal.timeout(BANCO_MS))
    if (s.error) return { porque: 'erro do banco', causa: 'erro_do_banco' }
    const ids = Array.isArray(s.data) ? (s.data as unknown[]).map(r => obj(r)?.id).filter((i): i is string => typeof i === 'string') : []
    if (ids.length === 0) return { porque: 'nenhum site lido', causa: 'forma_invalida' }
    const soma: LeituraArquivo = { atraso: { amarelos: 0, vermelhos: 0, meses_sem_selo: 0 }, vigia: { c1: 0, c2: 0, c3: 0, c4: 0 } }
    for (const id of ids) {
      for (const fn of ['obs_archive_atraso', 'obs_archive_vigia_remocao'] as const) {
        const { data, error } = await sb.rpc(fn, { p_site: id }).abortSignal(AbortSignal.timeout(BANCO_MS))
        if (error) {
          const codigo = typeof error.code === 'string' ? error.code : ''
          return CODIGOS_SCHEMA_AUSENTE.includes(codigo)
            ? { porque: 'função do arquivo ausente', causa: 'schema_ausente', codigo }
            : { porque: 'erro do banco', causa: 'erro_do_banco' }
        }
        if (fn === 'obs_archive_atraso') {
          const a = lerAtraso(data)
          if (!a) return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
          soma.atraso.amarelos += a.amarelos; soma.atraso.vermelhos += a.vermelhos; soma.atraso.meses_sem_selo += a.meses_sem_selo
        } else {
          const v = lerVigia(data)
          if (!v) return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
          soma.vigia.c1 += v.c1; soma.vigia.c2 += v.c2; soma.vigia.c3 += v.c3; soma.vigia.c4 += v.c4
        }
      }
    }
    return { valor: soma }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'vigia', invariante: 'arquivo_mensal' } })
    return { porque: 'o banco não respondeu', causa: 'excecao' }
  }
}

export async function lerArquivoParaVigiaComPrazo(sb: SupabaseClient): Promise<Lido<LeituraArquivo>> {
  const r = await comPrazo(lerArquivoParaVigia(sb), 2 * BANCO_MS + 1_000).catch(() => ({ estourou: true as const }))
  return 'estourou' in r ? { porque: 'o banco não respondeu', causa: 'prazo' } : r.valor
}

const SEM_LEITURA: Avaliacao = { gravidade: 'vermelho', motivo: MOTIVO_SEM_LEITURA }

export function avaliarAtraso(l: Lido<LeituraArquivo>): Avaliacao {
  if ('porque' in l) return SEM_LEITURA
  const a = l.valor.atraso
  if (a.vermelhos > 0) return { gravidade: 'vermelho', motivo: `cópia do arquivo atrasada há mais de 30 dias (${a.vermelhos})` }
  if (a.amarelos > 0) return { gravidade: 'amarelo', motivo: `cópia do arquivo atrasada há mais de 5 dias (${a.amarelos})` }
  if (a.meses_sem_selo > 0) return { gravidade: 'amarelo', motivo: `mês devido sem selo (${a.meses_sem_selo})` }
  return { gravidade: 'verde', motivo: 'cópia do arquivo em dia' }
}

export function avaliarVigia(l: Lido<LeituraArquivo>): Avaliacao {
  if ('porque' in l) return SEM_LEITURA
  const v = l.valor.vigia
  const ruins = (['c1', 'c2', 'c3', 'c4'] as const).filter(k => v[k] !== 0)
  if (ruins.length > 0) return { gravidade: 'vermelho', motivo: `remoção de canal: consulta ${ruins.map(k => k.slice(1)).join(', ')} diferente de zero` }
  return { gravidade: 'verde', motivo: 'remoção de canal em ordem' }
}

/** O pior dos dois. */
export function avaliarArquivo(l: Lido<LeituraArquivo>): Avaliacao {
  const a = avaliarAtraso(l)
  const v = avaliarVigia(l)
  const peso: Record<Gravidade, number> = { verde: 0, amarelo: 1, vermelho: 2 }
  return peso[v.gravidade] > peso[a.gravidade] ? v : a
}

function item(nome: string, a: Avaliacao): ItemAgenda {
  return a.gravidade === 'verde'
    ? { nome, status: 'ok', ultimoOk: null, toleranciaH: TOLERANCIA_H }
    : { nome, status: 'late', ultimoOk: null, toleranciaH: TOLERANCIA_H, gravidade: a.gravidade, motivo: a.motivo }
}

/** Os dois itens do relatório (`agenda:arquivo_atraso_copia`, `agenda:arquivo_vigia_remocao`). */
export function itensDoArquivo(l: Lido<LeituraArquivo>): ItemAgenda[] {
  return [item(NOME_ATRASO, avaliarAtraso(l)), item(NOME_VIGIA, avaliarVigia(l))]
}
