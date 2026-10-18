import { CAMINHO_AVISO, CAMINHO_CADEADO } from '../_chrome/ausencia/glifos'

/**
 * Os símbolos da origem das views (mockup 12, `ov.js`): traço de 14 px, sem emoji. Cada origem, aparelho e estado tem a sua forma,
 * para a tela se ler também em escala de cinza. Os caminhos são constantes do código (nada vem de dado), por isso entram como marcação fixa.
 */
export const CAMINHOS = {
  pesquisa: '<circle cx="6" cy="6" r="3.7"/><path d="M8.8 8.8 12.2 12.2"/>',
  sugeridos: '<path d="M7 1.6 12.4 7 7 12.4 1.6 7Z"/>',
  navegacao: '<path d="M1.8 7 7 2.2 12.2 7"/><path d="M3.4 6v5.6h7.2V6"/>',
  shorts: '<path d="M8.2 1.4 3.4 8h3.2l-.8 4.6 4.8-6.6H7.4Z"/>',
  externa: '<path d="M6 3H2.8v8.2H11V8"/><path d="M8 1.8h4.2V6M12.2 1.8 6.8 7.2"/>',
  outras: '<circle cx="3" cy="7" r=".9"/><circle cx="7" cy="7" r=".9"/><circle cx="11" cy="7" r=".9"/>',
  omitido: '<path d="M1.2 7c1.6-3 4-4.3 5.8-4.3S11.2 4 12.8 7c-1.6 3-4 4.3-5.8 4.3S2.8 10 1.2 7Z"/><circle cx="7" cy="7" r="1.6"/><path d="M2 12 12 2"/>',
  celular: '<rect x="4" y="1.6" width="6" height="10.8" rx="1.3"/><path d="M6.4 10.6h1.2"/>',
  computador: '<rect x="2" y="3" width="10" height="6.4" rx="1"/><path d="M1 11.4h12"/>',
  tv: '<rect x="1.6" y="2.6" width="10.8" height="7.2" rx="1"/><path d="M5 12.2h4"/>',
  tablet: '<rect x="2.6" y="1.8" width="8.8" height="10.4" rx="1.3"/><path d="M6.4 10.4h1.2"/>',
  outros: '<circle cx="7" cy="7" r="5"/><path d="M5.4 5.6a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1M7 10v.1"/>',
  inscritos: '<circle cx="5.4" cy="4.4" r="2.1"/><path d="M1.6 12c.3-2.4 1.7-3.6 3.8-3.6S8.9 9.6 9.2 12M9.6 6.6l1.4 1.4 2.4-2.6"/>',
  nao_inscritos: '<circle cx="7" cy="4.4" r="2.3"/><path d="M2.6 12.4c.4-2.6 2-3.9 4.4-3.9s4 1.3 4.4 3.9"/>',
  pais: '<circle cx="7" cy="7" r="5.2"/><path d="M1.8 7h10.4M7 1.8c-2 1.6-2 8.8 0 10.4M7 1.8c2 1.6 2 8.8 0 10.4"/>',
  lock: CAMINHO_CADEADO,
  relogio: '<circle cx="7" cy="7" r="5.2"/><path d="M7 4v3.2l2 1.3"/>',
  aviso: CAMINHO_AVISO,
} as const

export type ChaveGlifo = keyof typeof CAMINHOS

/** O glifo da chave; chave que não existe cai em "outras" (nunca um quadrado vazio). */
export function Glifo({ k }: { k: string }) {
  const caminho = (CAMINHOS as Record<string, string>)[k] ?? CAMINHOS.outras
  return <svg className="ov-g" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: caminho }} />
}
