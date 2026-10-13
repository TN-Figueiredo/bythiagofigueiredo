import { link } from '@/lib/youtube/observatorio/links'
import { openObservatoryPage } from '../_chrome/page-data'
import { ownMenuOf } from '../_chrome/own-menu'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { TrailChrome } from '../_chrome/trail-chrome'
import { CompararScreen } from '../_comparar/comparar-screen'
import { carregarProprioDaComparacao } from '../_proprio/carregar-extras'
import { buildCompararPack } from '../_comparar/pack'
import { resolverPar } from '../_comparar/par-model'

export const metadata = { title: 'Comparar canais · Competidores' }
export const dynamic = 'force-dynamic'
/** As páginas do Observatório ficam em 60 s. */
export const maxDuration = 60

const primeiro = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/**
 * Comparação entre dois canais (spec 18, `?a=&b=`). A guarda de acesso vem ANTES de qualquer leitura (`openObservatoryPage`); `a` e `b` só valem se
 * forem canais DESTE site (o pacote é feito do conjunto do site): id de outro site, inventado, em maiúsculas, ausente ou `a === b` caem no par padrão
 * de `resolverPar`, nunca num 500 e nunca com dado de outro site. A URL fora do padrão NÃO redireciona (outra carga do site): `usePar` a reescreve no
 * navegador. Só dados simples vão à tela; nenhuma server action (a tela só lê).
 */
export default async function CompararPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const [sp, { siteId, now, obs, meuCanalLembrado }] = await Promise.all([searchParams, openObservatoryPage()])
  // as views por dia e o cartão "Só o seu canal mede" dos canais próprios: lidos só para quem edita o site, depois da guarda; sem canal próprio no site
  // nada é consultado, e quem só lê recebe 'negado' sem nenhum número
  const { extras, soSeuCanal } = await carregarProprioDaComparacao(obs, siteId, now)
  const pack = buildCompararPack(obs, undefined, extras, soSeuCanal)
  const inicial = resolverPar(pack, primeiro(sp?.a), primeiro(sp?.b), meuCanalLembrado)
  return (
    <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: 'Comparar' }]} owns={ownMenuOf(obs, meuCanalLembrado)}>
      <CompararScreen pack={pack} inicial={inicial} />
    </TrailChrome>
  )
}
