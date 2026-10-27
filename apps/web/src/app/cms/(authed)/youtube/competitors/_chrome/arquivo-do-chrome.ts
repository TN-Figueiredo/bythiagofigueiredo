import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerSinalDoBanco, type SinalLido } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { arquivoBancoTag, lerAvisoLeve, type AvisoLeve } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-leve'
import { podeEditarSite } from './permissoes'

export type ArquivoNoChrome = { arquivoVisivel: boolean; aviso: { ok: true; leve: AvisoLeve } | { ok: false; porque: 'sem_permissao' | 'desligado' | 'funcao_ausente' | 'erro_do_banco' }; /** só quando o aviso foi lido: o tamanho do banco, lido em paralelo ao aviso */ banco?: SinalLido }

/** Quem decide a aba Arquivo e a pastilha: a guarda (`podeEditarSite`, em cache, sem `canAdminSiteUsers`) primeiro, a variável depois, a leitura leve por último. Nunca chama obs_archive_pagina. */
export async function arquivoNoChrome(siteId: string): Promise<ArquivoNoChrome> {
  if (!(await podeEditarSite(siteId))) return { arquivoVisivel: false, aviso: { ok: false, porque: 'sem_permissao' } }
  if (process.env.OBS_ARQUIVO !== 'on') return { arquivoVisivel: true, aviso: { ok: false, porque: 'desligado' } }
  // o aviso (~160 ms medidos no caso cheio) e o tamanho do banco correm juntos; o tamanho é descartado se o aviso não vier (Phil M1)
  const [r, banco] = await Promise.all([lerAvisoLeve(siteId), bancoNoChrome(siteId)])
  if (r.ok) return { arquivoVisivel: true, aviso: { ok: true, leve: r.leve }, banco }
  return { arquivoVisivel: r.porque !== 'funcao_ausente', aviso: { ok: false, porque: r.porque } }
}

/** O tamanho do banco para a pastilha: o sinal da E10 (uma consulta a `obs_db_size_daily`, que muda 1 vez por dia), em cache de 3600 s e etiqueta própria. Só para quem passou pela guarda. */
export async function bancoNoChrome(siteId: string): Promise<SinalLido> {
  try {
    // uma falha NÃO entra no cache de 1 h: o corpo lança e quem chama devolve a causa (a leitura boa é a única guardada)
    return await unstable_cache(async () => { const r = await lerSinalDoBanco(getSupabaseServiceClient(), Date.now()); if ('porque' in r) throw new FalhaDoSinal(r); return r }, ['arquivo-sinal-banco', siteId], { revalidate: 3600, tags: [arquivoBancoTag(siteId)] })()
  } catch (e) {
    if (e instanceof FalhaDoSinal) return e.lido
    Sentry.captureException(e, { tags: { step: 'aviso-banco-sinal' } })
    return { porque: 'excecao' } // o chrome nunca cai por causa do aviso: a pastilha vira "Não medido"
  }
}
class FalhaDoSinal extends Error { constructor(readonly lido: { porque: Extract<SinalLido, { porque: unknown }>['porque'] }) { super('sinal do banco: ' + lido.porque) } }
