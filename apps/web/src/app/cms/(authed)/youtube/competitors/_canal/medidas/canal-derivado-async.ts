// E5a Tarefa 19: o `await` da promessa única das medidas, igual para os três elementos. Se ela rejeitasse (o carregador e o `.catch` da página
// garantem que não), vira o canal inteiro "não carregou": nenhum elemento lança.
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { derivar, type CanalDerivado, type ContextoDoCanal } from './canal-derivado'

export type { ContextoDoCanal }

export function canalNaoCarregou(): CanalInteiro {
  return {
    medidas: { naoCarregou: 'erro_do_banco' }, videos: { lido: false, causa: 'erro_do_banco' }, retratos: { lido: false, causa: 'erro_do_banco' },
    marcas: { lido: false, causa: 'erro_do_banco' }, serie: { lido: false, causa: 'erro_do_banco' }, mudancas: { lido: false, causa: 'erro_do_banco' },
    horas: { lido: false, causa: 'erro_do_banco' }, falhas: [{ medida: 'canal', classe: 'calculo_falhou' }], esgotou: [],
  }
}

export async function canalDerivadoDe(medidas: Promise<CanalInteiro>, ctx: ContextoDoCanal): Promise<{ c: CanalInteiro; d: CanalDerivado }> {
  const c = await medidas.catch(canalNaoCarregou)
  return { c, d: derivar(ctx, c) }
}
