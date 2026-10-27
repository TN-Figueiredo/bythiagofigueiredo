import 'server-only'
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { observatoryTag } from '@/lib/youtube/observatorio/cache-tag'
import { lerSinalDoBanco, type SinalLido } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { lerAvisoLeve, type AvisoLeve } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-leve'
import { podeEditarSite } from './permissoes'

export type ArquivoNoChrome = { arquivoVisivel: boolean; aviso: { ok: true; leve: AvisoLeve } | { ok: false; porque: 'sem_permissao' | 'desligado' | 'funcao_ausente' | 'erro_do_banco' } }

/** Quem decide a aba Arquivo e a pastilha: a guarda (`podeEditarSite`, em cache, sem `canAdminSiteUsers`) primeiro, a variável depois, a leitura leve por último. Nunca chama obs_archive_pagina. */
export async function arquivoNoChrome(siteId: string): Promise<ArquivoNoChrome> {
  if (!(await podeEditarSite(siteId))) return { arquivoVisivel: false, aviso: { ok: false, porque: 'sem_permissao' } }
  if (process.env.OBS_ARQUIVO !== 'on') return { arquivoVisivel: true, aviso: { ok: false, porque: 'desligado' } }
  const r = await lerAvisoLeve(siteId)
  if (r.ok) return { arquivoVisivel: true, aviso: { ok: true, leve: r.leve } }
  return { arquivoVisivel: r.porque !== 'funcao_ausente', aviso: { ok: false, porque: r.porque } }
}

/** O tamanho do banco para a pastilha: o sinal da E10 (uma consulta a `obs_db_size_daily`), em cache de 60 s por site. Só para quem passou pela guarda. */
export async function bancoNoChrome(siteId: string): Promise<SinalLido> {
  try {
    return await unstable_cache(() => lerSinalDoBanco(getSupabaseServiceClient(), Date.now()), ['arquivo-sinal-banco', siteId], { revalidate: 60, tags: [observatoryTag(siteId)] })()
  } catch {
    return { porque: 'excecao' } // o chrome nunca cai por causa do aviso: a pastilha vira "Não medido"
  }
}
