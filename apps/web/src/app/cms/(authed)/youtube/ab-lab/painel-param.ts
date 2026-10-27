// `?painel=<testId>` da página do A/B Lab (link "Abrir o painel" da faixa de restauração e da ficha, M7b). O id vira alvo de tela,
// nunca de consulta: fora do formato de uuid é descartado, e só abre se o teste estiver entre os concluídos que a página montou.
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function painelDaUrl(bruto: string | string[] | undefined): string | null {
  if (typeof bruto !== 'string') return null
  return FORMATO_UUID.test(bruto) ? bruto.toLowerCase() : null
}

export const hrefDoPainel = (testId: string): string => `/cms/youtube/ab-lab?painel=${encodeURIComponent(testId)}`
