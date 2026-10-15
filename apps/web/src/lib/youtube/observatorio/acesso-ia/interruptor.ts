// A5 · E17 degrau 2: as três travas do acesso externo da IA, todas fechadas por padrão (plano, 4.1). Lidas a CADA requisição, nunca no import.
//   1. `OBSERVATORIO_IA_EXTERNA` com o valor exato `on` (trava do dono, na Vercel);
//   2. a E19 publicada em modo `recusa` (trava de git: `modoLeitura()`);
//   3. `ACESSO_IA_RULES.e19RecusaConferidaEm` preenchida (a conferência do dia da promoção da E19 está no ledger dela).
import { modoLeitura } from '@/lib/pipeline/leitura-modo'
import { ACESSO_IA_RULES } from './regras'

export type Travas = { ligado: true } | { ligado: false; motivo: 'variavel' | 'e19_em_aviso' | 'e19_nao_conferida' }
export type ConferidaParaChave = { ok: true } | { ok: false; motivo: 'e19_em_aviso' | 'e19_nao_conferida' }

/** Só as travas 2 e 3, sem ler ambiente: é a única guarda do comando de criar chave (a chave nasce antes de a variável existir). */
export function e19ConferidaParaChave(): ConferidaParaChave {
  if (modoLeitura().modo !== 'recusa') return { ok: false, motivo: 'e19_em_aviso' }
  if (ACESSO_IA_RULES.e19RecusaConferidaEm === null) return { ok: false, motivo: 'e19_nao_conferida' }
  return { ok: true }
}

export function acessoExternoLigado(env: NodeJS.ProcessEnv = process.env): Travas {
  if (env.OBSERVATORIO_IA_EXTERNA !== 'on') return { ligado: false, motivo: 'variavel' }
  const conferida = e19ConferidaParaChave()
  return conferida.ok ? { ligado: true } : { ligado: false, motivo: conferida.motivo }
}
