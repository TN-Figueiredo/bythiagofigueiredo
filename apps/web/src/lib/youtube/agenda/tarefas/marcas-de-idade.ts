import * as Sentry from '@sentry/nextjs'
import { runFecharMarcas } from '@/lib/youtube/observatorio/medidas/fechar-marcas'
import { DEFINICAO_MARCAS_DE_IDADE } from '../definicoes'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BANCO_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/** O que a tarefa devolve em `extra`: os canais (competitor_channels.id) com marca ou motivo gravado, por site; `sitesInteiros` quando o canal não pôde ser resolvido. */
export interface ExtraDasMarcas { channelIdsBySite: Record<string, string[]>; sitesInteiros: string[] }

const FATIA = 150
/** Resolve o canal de cada vídeo escrito (o RPC não o devolve). Falha na leitura: o site inteiro do vídeo sem canal resolvido cai (nunca nada). */
async function canaisDasMarcas(sb: SupabaseClient, escritos: ReadonlyArray<{ videoId: string; siteId: string }>): Promise<ExtraDasMarcas> {
  const porSite = new Map<string, Set<string>>()
  const inteiros = new Set<string>()
  const canalDoVideo = new Map<string, string>()
  for (let i = 0; i < escritos.length; i += FATIA) {
    const fatia = escritos.slice(i, i + FATIA)
    try {
      const r = await sb.from('competitor_videos').select('id, competitor_channel_id').in('id', fatia.map(e => e.videoId)).abortSignal(AbortSignal.timeout(BANCO_MS))
      if (r.error === null && Array.isArray(r.data)) {
        for (const x of r.data as unknown[]) {
          if (typeof x === 'object' && x !== null && 'id' in x && 'competitor_channel_id' in x && typeof x.id === 'string' && typeof x.competitor_channel_id === 'string') canalDoVideo.set(x.id, x.competitor_channel_id)
        }
      }
    } catch { /* o vídeo sem canal resolvido derruba o site inteiro, abaixo */ }
  }
  for (const e of escritos) {
    const canal = canalDoVideo.get(e.videoId)
    if (canal === undefined) { inteiros.add(e.siteId); continue }
    const set = porSite.get(e.siteId) ?? new Set<string>()
    set.add(canal)
    porSite.set(e.siteId, set)
  }
  return { channelIdsBySite: Object.fromEntries([...porSite].map(([site, set]) => [site, [...set]])), sitesInteiros: [...inteiros] }
}

/**
 * `marcas_de_idade` (A5 E4, Tarefa 11): delega a `runFecharMarcas` e devolve só CÓDIGO de catálogo e número. Nenhuma exceção chega ao despachante
 * (a mensagem do Postgres iria para `competitor_agenda_runs.reason`): quem lança vira `inesperado`, e só a classe do erro e o SQLSTATE vão ao Sentry.
 * Sem guarda de começo: a função ausente é o `schema_ausente` do próprio resultado. Sem `devidaPeloDado` e sem `nuncaDesliga`.
 * A definição (rótulo, período, tolerância do vigia, tempos, frases) mora em `agenda/definicoes.ts`, o módulo leve que o vigia também lê.
 */
export const marcasDeIdade: Tarefa = {
  ...DEFINICAO_MARCAS_DE_IDADE,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const s = await runFecharMarcas({ sb: c.sb, now: c.agora })
      const extra = s.escritos && s.escritos.length > 0 ? await canaisDasMarcas(c.sb, s.escritos) : undefined
      return {
        estado: s.status, feitas: s.feitos, deixadas: s.ficaram,
        ...(s.motivo !== undefined ? { motivo: s.motivo } : {}),
        detalhe: s.numeros,
        ...(extra ? { extra } : {}),
      }
    } catch (err) {
      const codigo = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? ' ' + err.code.slice(0, 5) : ''
      Sentry.captureMessage('marcas_de_idade: inesperado: ' + (err instanceof Error ? err.name : typeof err) + codigo, 'error')
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
