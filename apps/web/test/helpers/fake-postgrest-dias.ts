import { fakePostgrest, type FakePostgrestOptions } from './fake-postgrest'
import { COLUNAS_DO_PLACAR } from '@/lib/youtube/ab-gravacao/placar'

/** `fakePostgrest` com `ab_test_dias` vazia (o Cowork lê o placar em toda leitura de teste, S8-F3 T4). */
export function fakePostgrestComDias(opts: FakePostgrestOptions) {
  return fakePostgrest({
    ...opts,
    tables: { ab_test_dias: [], ...opts.tables },
    columns: { ab_test_dias: COLUNAS_DO_PLACAR.split(',').map(c => c.trim()), ...opts.columns },
  })
}
