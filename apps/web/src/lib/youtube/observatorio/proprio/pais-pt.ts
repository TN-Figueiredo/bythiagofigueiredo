/**
 * Nome do país em português, com a preposição certa ("do Brasil", "dos Estados Unidos", "de Portugal"). Plano E5b, Tarefa 7. Puro.
 * O nome vem de `Intl.DisplayNames`; a preposição vem da tabela abaixo. País fora da tabela usa "de {nome}". Nunca lança.
 */

type Artigo = 'do' | 'da' | 'dos' | 'das' | 'de'
/** [código ISO, preposição com artigo, nome que substitui o do ICU (opcional)] */
const TABELA: ReadonlyArray<readonly [string, Artigo, string?]> = [
  ['BR', 'do'], ['PT', 'de'], ['US', 'dos'], ['AO', 'de'], ['MZ', 'de'], ['CV', 'de'], ['GW', 'da'], ['ST', 'de', 'São Tomé e Príncipe'], ['TL', 'do'],
  ['AR', 'da'], ['UY', 'do'], ['PY', 'do'], ['CL', 'do'], ['BO', 'da'], ['PE', 'do'], ['EC', 'do'], ['CO', 'da'], ['VE', 'da'], ['MX', 'do'],
  ['CA', 'do'], ['CU', 'de'], ['DO', 'da', 'República Dominicana'], ['PA', 'do'], ['CR', 'da'], ['GT', 'da'], ['HN', 'de'], ['SV', 'de'], ['NI', 'da'],
  ['ES', 'da'], ['FR', 'da'], ['IT', 'da'], ['DE', 'da'], ['GB', 'do', 'Reino Unido'], ['IE', 'da'], ['NL', 'dos', 'Países Baixos'], ['BE', 'da'],
  ['CH', 'da'], ['AT', 'da'], ['SE', 'da'], ['NO', 'da'], ['DK', 'da'], ['FI', 'da'], ['PL', 'da'], ['CZ', 'da', 'Tchéquia'], ['GR', 'da'], ['RO', 'da'],
  ['HU', 'da'], ['UA', 'da'], ['RU', 'da'], ['TR', 'da'], ['IL', 'de'], ['SA', 'da'], ['AE', 'dos', 'Emirados Árabes Unidos'], ['EG', 'do'],
  ['MA', 'de'], ['ZA', 'da', 'África do Sul'], ['NG', 'da'], ['KE', 'do'], ['CD', 'da', 'República Democrática do Congo'], ['CG', 'da', 'República do Congo'],
  ['IN', 'da'], ['CN', 'da'], ['JP', 'do'], ['KR', 'da', 'Coreia do Sul'], ['ID', 'da'], ['TH', 'da'], ['VN', 'do'], ['PH', 'das'], ['MY', 'da'],
  ['SG', 'de'], ['AU', 'da'], ['NZ', 'da', 'Nova Zelândia'], ['PK', 'do'], ['BD', 'de'], ['LU', 'de'], ['IS', 'da'], ['HR', 'da'], ['RS', 'da'],
  ['BG', 'da'], ['SK', 'da', 'Eslováquia'], ['SI', 'da'], ['LT', 'da'], ['LV', 'da'], ['EE', 'da'],
]

export const PAISES_COM_ARTIGO_TOTAL = TABELA.length

const POR_CODIGO: ReadonlyMap<string, { artigo: Artigo; nome: string | undefined }> =
  new Map(TABELA.map(([c, a, n]) => [c, { artigo: a, nome: n }]))

let nomes: Intl.DisplayNames | null | undefined
function displayNames(): Intl.DisplayNames | null {
  if (nomes !== undefined) return nomes
  try { nomes = new Intl.DisplayNames(['pt-BR'], { type: 'region' }) } catch { nomes = null }
  return nomes
}

export function nomeDoPais(iso: string): { nome: string; de: string } {
  const bruto = typeof iso === 'string' ? iso.trim() : ''
  const cod = bruto.toUpperCase()
  if (cod === 'ZZ') return { nome: 'Não identificado', de: 'de país não identificado' }
  if (!/^[A-Z]{2}$/.test(cod)) return { nome: bruto, de: 'de ' + bruto }
  let nome: string | undefined
  try { nome = displayNames()?.of(cod) } catch { nome = undefined }
  const e = POR_CODIGO.get(cod)
  const final = e?.nome ?? (nome !== undefined && nome !== cod ? nome : undefined)
  if (final === undefined) return { nome: cod, de: 'de ' + cod }
  return { nome: final, de: `${e?.artigo ?? 'de'} ${final}` }
}
