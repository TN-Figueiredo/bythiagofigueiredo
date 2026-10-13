// Fabrica o token de edição nos testes pelo CAMINHO REAL (provarEdicao), com a guarda simulada pelo `vi.mock` do próprio
// arquivo de teste. Não existe construtor de teste: o token só nasce depois da guarda.
import { provarEdicao, type EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'

export async function edicaoDe(siteId: string): Promise<EdicaoDoSite> {
  const e = await provarEdicao(siteId)
  if (!e) throw new Error('a guarda simulada do teste deveria deixar editar o site ' + siteId)
  return e
}
