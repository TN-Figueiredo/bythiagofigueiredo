// @vitest-environment node
// Varredura do código-fonte: o dado privado do canal próprio só se lê depois da guarda de edição.
// Nenhum arquivo fora do módulo da guarda constrói o token, pede a prova de edição ou chama os leitores.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'

const SRC = join(__dirname, '../../../src')
const EDICAO = 'lib/youtube/observatorio/proprio/edicao.ts'
const LER = 'lib/youtube/observatorio/proprio/ler.ts'
/** O leitor das dimensões (A5 E11): lê `yt_own_video_dim_daily` e companhia; entra na regra "quem pode chamar um leitor" (E17 passo 0, Tarefa 6). */
const LER_DIMENSOES = 'lib/youtube/observatorio/proprio/ler-dimensoes.ts'
/** O leitor da curva de retenção (A5 E8, Tarefa 12b): o único arquivo fora da coleta que consulta `yt_own_video_retention`. */
const LER_RETENCAO = 'lib/youtube/observatorio/proprio/ler-retencao.ts'
/** A coleta ESCREVE a curva (service role, passo `retencao`); a leitura da tela é só do leitor acima. */
const COLETA_DIR = 'lib/youtube/coleta/'
const DADOS = 'app/cms/(authed)/youtube/competitors/_proprio/dados.ts'
/** E5b T9: o leitor do diário por período; as entradas da origem e dos termos (a dos termos prova a EDIÇÃO do site do token). */
const LER_DIARIO_PERIODO = 'lib/youtube/observatorio/proprio/ler-diario-periodo.ts'
const DADOS_ORIGEM = 'app/cms/(authed)/youtube/competitors/_proprio/dados-origem.ts'
const DADOS_TERMOS = 'app/cms/(authed)/youtube/competitors/_proprio/dados-termos.ts'
const DADOS_TROCAS = 'app/cms/(authed)/youtube/competitors/_proprio/dados-trocas.ts'
const LER_TESTES_AB = 'lib/youtube/observatorio/proprio/ler-testes-ab.ts'
/** A prova de tipo do token (compilada pelo tsc do web, nunca executada): o único outro arquivo que nomeia a classe como valor. */
const TIPOS = 'lib/youtube/observatorio/proprio/edicao.type-test.ts'
/** Usos do token como VALOR (a classe em si), que o brand check de edicao.ts não pode deixar de cobrir: estender, protótipo, construção reflexiva, typeof, instanceof. */
const USO_COMO_VALOR = /\bextends\s+EdicaoDoSite\b|\bEdicaoDoSite\s*\.\s*(prototype|ehEdicao)\b|\bReflect\s*\.\s*construct\s*\([^)]*\bEdicaoDoSite\b|\bObject\s*\.\s*create\s*\([^)]*\bEdicaoDoSite\b|\btypeof\s+EdicaoDoSite\b|\binstanceof\s+EdicaoDoSite\b/
/** `import { EdicaoDoSite }` sem `type` traz a classe como valor. */
const importaComoValor = (s: string) =>
  [...s.matchAll(/import\s*(?!type\b)\{([^}]*)\}\s*from\s*['"][^'"]*proprio\/edicao['"]/g)].some(m => m[1]!.split(',').some(n => /^\s*EdicaoDoSite\b/.test(n)))
const importaNamespace = (s: string) => /import\s*\*\s*as\s+\w+\s+from\s*['"][^'"]*proprio\/edicao['"]|import\s*\(\s*['"][^'"]*proprio\/edicao['"]\s*\)|require\s*\(\s*['"][^'"]*proprio\/edicao['"]\s*\)/.test(s)
/** O token de LEITURA do desempenho privado (E17 passo 0) e a prova de tipo dele. */
const LEITURA = 'lib/youtube/observatorio/proprio/leitura-privada.ts'
const TIPOS_LEITURA = 'lib/youtube/observatorio/proprio/leitura-privada.type-test.ts'
const USO_LEITURA_COMO_VALOR = /\bextends\s+LeituraPrivadaDoSite\b|\bLeituraPrivadaDoSite\s*\.\s*(prototype|ehLeitura)\b|\bReflect\s*\.\s*construct\s*\([^)]*\bLeituraPrivadaDoSite\b|\bObject\s*\.\s*create\s*\([^)]*\bLeituraPrivadaDoSite\b|\btypeof\s+LeituraPrivadaDoSite\b|\binstanceof\s+LeituraPrivadaDoSite\b/
const importaLeituraComoValor = (s: string) =>
  [...s.matchAll(/import\s*(?!type\b)\{([^}]*)\}\s*from\s*['"][^'"]*proprio\/leitura-privada['"]/g)].some(m => m[1]!.split(',').some(n => /^\s*LeituraPrivadaDoSite\b/.test(n)))
const importaLeituraNamespace = (s: string) => /import\s*\*\s*as\s+\w+\s+from\s*['"][^'"]*proprio\/leitura-privada['"]|import\s*\(\s*['"][^'"]*proprio\/leitura-privada['"]\s*\)|require\s*\(\s*['"][^'"]*proprio\/leitura-privada['"]\s*\)/.test(s)
/** Degrau 2: a segunda porta do token (pela prova da chave do perfil) e quem fabrica a prova da chave. */
const ROTA_MCP = 'app/api/mcp/route.ts'
const PROVA_CHAVE = 'lib/youtube/observatorio/acesso-ia/prova.ts'
const PORTA_CHAVE = 'lib/youtube/observatorio/acesso-ia/porta.ts'
const TIPOS_CHAVE = 'lib/youtube/observatorio/acesso-ia/prova.type-test.ts'
/** Degrau 2, Tarefa 8a: os carregadores SEM guarda das telas só podem ser chamados pela página (com guarda) e pelo abridor da chave. */
const PAGE_DATA = 'app/cms/(authed)/youtube/competitors/_chrome/page-data.ts'
const ABRIR_CHAVE = 'app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave.ts'
/** Quem pode pedir a prova de edição e chamar os leitores: o módulo da guarda. */
const PODE_PROVAR = new Set([EDICAO, LEITURA, DADOS_TERMOS])
const PODE_LER = new Set([LER, LER_RETENCAO, LER_DIMENSOES, LER_DIARIO_PERIODO, DADOS, DADOS_ORIGEM, DADOS_TERMOS, DADOS_TROCAS])
/** Os leitores e o módulo de dados pedem o token de LEITURA: citar o de edição neles é voltar atrás. */
const VERSOES_LER = 'lib/youtube/observatorio/proprio-versoes/ler.ts'
const COMENTARIOS_LER = 'lib/youtube/observatorio/medidas/ler-comentarios.ts'
const LEITORES_E_DADOS = new Set([LER, LER_RETENCAO, LER_DIMENSOES, LER_DIARIO_PERIODO, DADOS, DADOS_ORIGEM, DADOS_TROCAS, LER_TESTES_AB, VERSOES_LER, COMENTARIOS_LER])
/**
 * As DOZE tabelas privadas do canal próprio (leitura por `can_view_private_site` depois da MG11). Cópia da lista de
 * `test/integration/observatorio-a5-e17-p0-doze.test.ts` (T3, ainda fora desta base): quando os dois chegarem juntos, o teste de igualdade entra.
 */
const DOZE = [
  'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_coverage',
  'yt_own_video_retention', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily',
  'yt_own_video_versions', 'yt_own_versions_state', 'competitor_video_comments', 'competitor_video_comment_marks',
] as const
/**
 * Gravadores que LEEM uma das doze só para gravar (deduplicar, achar o que falta): não mostram nada a ninguém. Lista fechada.
 * `ab-gravacao/retrato-step.ts` (A/B S8-F1, cron `ab-retrato`, cliente de serviço) copia o dia por variante para `ab_test_dias`,
 * cuja RLS é `can_edit_site`, mais estrita que `can_view_private_site` (que é edição OU visualizador privado). Quem ler
 * `ab_test_dias` numa tela (F2–F4) não herda esta isenção.
 * F2 T8: `sinais/leitura.ts` lê `yt_own_video_meta_daily` só para saber se o vídeo é PÚBLICO (`privacy_status`, `proprios_agora`); nenhum número
 * do Analytics sai dali (a lista de sinais já é leitura de editor do site, via a guarda da rota/ação).
 * F2: `sinais/lugares-do-site.ts` (`lerProprios`, tarefa diária `sinais_do_nicho`) lê `yt_own_video_meta_daily` só `privacy_status` e `is_short` (janela de 7 dias,
 * para o casamento de lugar nos vídeos PÚBLICOS) e grava em `video_lugares`; nenhuma métrica de desempenho (D20), nada volta a tela por este arquivo.
 * F2b T3: `proprio/consultas.ts` são as consultas SEM prova extraídas de `ler-dimensoes.ts` (que as chama com a prova); a única outra chamadora é `sinais/medida/series.ts`
 * (tarefa `medida_d2`, cliente de serviço), que só devolve somas por janela e presença, nunca a linha do dia, e fica atrás do corte da §3.6 (sem leitura até o gatilho).
 * Importar `proprio/consultas` é lista fechada (regra `PODE_IMPORTAR_CONSULTAS`).
 * S8-F4 T10b: `ab-gravacao/aviso-volume.ts` lê `yt_own_video_reach_daily` (14 dias) só para estimar quantos dias o teste v2 precisa (dias_previstos, n,
 * impressoes_dia); chamado só pelo `get_test` de rascunho (chave do Cowork) e pela ação do assistente (editor). PONTO PARA PORTÃO (Phil/Yannis): sai um
 * agregado, nunca a linha do dia.
 */
const GRAVADORES_QUE_LEEM = new Set(['lib/youtube/observatorio/sinais/leitura.ts', 'lib/youtube/observatorio/sinais/lugares-do-site.ts', 'lib/youtube/observatorio/comentarios/gravar.ts', 'lib/youtube/horaria/gravar.ts', 'lib/youtube/ab-gravacao/retrato-step.ts', 'lib/youtube/ab-gravacao/aviso-volume.ts', 'lib/youtube/observatorio/proprio/consultas.ts', 'lib/youtube/observatorio/sinais/medida/series.ts'])

/**
 * Yannis I4: o especificador é RESOLVIDO contra a pasta do arquivo (`./consultas` dentro de `proprio/` também vale), para
 * `import`, `export ... from`, `import()` e `require()`; `@/` aponta para `src/`.
 */
const CONSULTAS = 'lib/youtube/observatorio/proprio/consultas'
export function importaConsultas(arq: string, s: string): boolean {
  for (const m of s.matchAll(/(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1]!
    const alvo = spec.startsWith('.') ? posix.join(posix.dirname(arq), spec) : spec.startsWith('@/') ? spec.slice(2) : spec
    if (alvo.replace(/\.(ts|tsx)$/, '') === CONSULTAS) return true
  }
  return false
}
/** F2b T3: quem pode importar as consultas sem prova. */
/**
 * PONTO PARA PORTÃO (F4 T2): `sinais/trafego-terceiro/ler.ts` chama só `lerCobertura`, `lerDetalheDiario` e `contarOrigem` com `ORIGEM_SUGERIDOS` / `'32'`,
 * atrás de `provaValida` (brand check da leitura E mesmo site); sai só estado/contagem/soma por vídeo do terceiro, nunca a linha do dia nem `detail`.
 * `ler.ts` não faz `.from('yt_own_...')` direto.
 */
const PODE_IMPORTAR_CONSULTAS = new Set([LER_DIMENSOES, 'lib/youtube/observatorio/sinais/medida/series.ts', 'lib/youtube/observatorio/proprio/consultas.ts', 'lib/youtube/observatorio/sinais/trafego-terceiro/ler.ts'])
/**
 * PONTO PARA PORTÃO (E9, noite 15/10): dois pontos da fila "Saíram do YouTube" consultam `competitor_video_comments` SEM `leituraValida`.
 * Ambos já estão atrás da guarda de EDIÇÃO do site e usam o cliente de serviço com o site em todo filtro; nenhum recebe o token de leitura
 * (só `leitura-privada.ts` e `_proprio/dados.ts` podem pedi-lo, e a fila não passa por `_proprio`). Lista fechada:
 *  - `saiu/ler-fila.ts`: o leitor da aba, chamado só por `_saiu/dados.ts` depois de `requireSiteScope(mode: 'edit')`;
 *  - `competitors/actions.ts`: a guarda de `removeCompetitorChannel` (contagem `head`, sem trazer texto), depois de `denyUnlessSiteAdmin`.
 */
const DADOS_SAIU = 'app/cms/(authed)/youtube/competitors/_saiu/dados.ts'
const FILA_LER = 'lib/youtube/observatorio/saiu/ler-fila.ts'
const E9_SO_COM_EDICAO = new Set(['lib/youtube/observatorio/saiu/ler-fila.ts', 'app/cms/(authed)/youtube/competitors/actions.ts'])
/**
 * PONTO PARA PORTÃO (E5a C1): os dois leitores dos comentários de destaque consultam `competitor_video_comments` e `competitor_video_comment_marks`
 * sem a palavra `leituraValida` no próprio arquivo, porque quem decide o nível é `nivelDeQuemVe` (`comentarios/leitor-nivel.ts`, que valida os dois
 * tokens, o de leitura e o de edição, e nunca sobe de nível por falta de prova). A isenção vale SÓ para estes dois arquivos, SÓ se chamarem
 * `nivelDeQuemVe(`, e eles continuam proibidos de citar o token de edição e de pedir qualquer prova (`PODE_PROVAR` não ganha arquivo).
 */
const LEITORES_POR_NIVEL = new Set(['lib/youtube/observatorio/comentarios/leitor.ts', 'lib/youtube/observatorio/comentarios/leitor-contagem.ts'])
const cita = (s: string, t: string) => new RegExp(`\\.from\\(\\s*['"]${t}['"]\\s*\\)`).test(s)
/** `yt_own_collection_attempts` é "só quem edita" no banco; fora da coleta o código lê só `attempt_day` e `outcome` (decisão I4 do portão de software). */
const COLUNAS_TENTATIVAS = new Set(['attempt_day', 'outcome'])
const lePorFrom = (s: string) => [...s.matchAll(/\.from\(\s*['"]yt_own_collection_attempts['"]\s*\)/g)].length
const leSoColunasPermitidas = (s: string) => [...s.matchAll(/\.from\(\s*['"]yt_own_collection_attempts['"]\s*\)\s*\.select\(\s*['"]([^'"]*)['"]/g)]
  .filter(m => m[1]!.split(',').map(c => c.trim()).every(c => COLUNAS_TENTATIVAS.has(c))).length

function arquivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) arquivos(p, out)
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}
/** Tira comentários e deixa as strings: o que sobra é o que o compilador vê. */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const cliente = (src: string) => /^\s*(['"])use client\1/.test(semComentarios(src))

export function violacoes(fontes: Record<string, string>): string[] {
  const v: string[] = []
  for (const [arq, bruto] of Object.entries(fontes)) {
    const s = semComentarios(bruto)
    if (arq !== EDICAO && arq !== TIPOS && /\bnew\s+EdicaoDoSite\b|\bEdicaoDoSite\.provar\b/.test(s)) v.push(`${arq}: constrói o token de edição`)
    if (arq !== EDICAO && arq !== TIPOS && USO_COMO_VALOR.test(s)) v.push(`${arq}: usa a classe do token como valor (estender, protótipo, Reflect.construct, Object.create, typeof, instanceof)`)
    if (arq !== EDICAO && arq !== TIPOS && importaComoValor(s)) v.push(`${arq}: importa a classe do token como valor (só \`import type\`)`)
    if (arq !== EDICAO && arq !== TIPOS && importaNamespace(s)) v.push(`${arq}: importa o módulo do token por namespace ou dinâmico`)
    if (arq !== TIPOS && /edicao\.type-test['"]/.test(s)) v.push(`${arq}: importa a prova de tipo (ela não roda)`)
    if (!PODE_PROVAR.has(arq) && /\bprovarEdicao(ComAviso)?\s*\(/.test(s)) v.push(`${arq}: pede a prova de edição fora do módulo da guarda`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && /\bnew\s+LeituraPrivadaDoSite\b|\bLeituraPrivadaDoSite\.provar\b/.test(s)) v.push(`${arq}: constrói o token de leitura`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && USO_LEITURA_COMO_VALOR.test(s)) v.push(`${arq}: usa a classe do token de leitura como valor (estender, protótipo, Reflect.construct, Object.create, typeof, instanceof)`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && importaLeituraComoValor(s)) v.push(`${arq}: importa a classe do token de leitura como valor (só \`import type\`)`)
    if (arq !== LEITURA && arq !== TIPOS_LEITURA && importaLeituraNamespace(s)) v.push(`${arq}: importa o módulo do token de leitura por namespace ou dinâmico`)
    if (arq !== TIPOS_LEITURA && /leitura-privada\.type-test['"]/.test(s)) v.push(`${arq}: importa a prova de tipo da leitura (ela não roda)`)
    if (arq !== LEITURA && arq !== DADOS && /\b(provarAcessoPrivado|provarLeituraPrivada)\s*\(/.test(s)) v.push(`${arq}: pede a prova de leitura privada fora do módulo da guarda`)
    if (arq !== LEITURA && arq !== ROTA_MCP && /\bprovarAcessoPrivadoDaChave\s*\(/.test(s)) v.push(`${arq}: pede a leitura privada pela chave fora da rota do MCP`)
    if (arq !== PROVA_CHAVE && arq !== PORTA_CHAVE && arq !== TIPOS_CHAVE && /\bnew\s+ChaveDoPerfilProvada\b|\bChaveDoPerfilProvada\s*\.\s*fabricar\b|\bfabricarProva\b/.test(s)) v.push(`${arq}: fabrica a prova da chave do perfil`)
    if (arq !== PAGE_DATA && arq !== ABRIR_CHAVE && /\b(carregarObservatorio|carregarCanal)\s*[(<]/.test(s)) v.push(`${arq}: chama um carregador de tela sem guarda fora de page-data.ts e do abridor da chave`)
    if (arq !== LEITURA && /can_view_private_site_as/.test(s)) v.push(`${arq}: cita a função do direito fora do módulo da leitura privada`)
    if (cliente(bruto) && /from\s+['"][^'"]*proprio\/leitura-privada['"]/.test(s)) v.push(`${arq}: componente cliente importa o módulo da leitura privada`)
    if (!PODE_LER.has(arq) && /\b(lerAlcance|lerDiario|lerRetencao|lerDimensoes|lerDetalheDaOrigem|lerDiarioDoPeriodo)\s*\(/.test(s)) v.push(`${arq}: chama um leitor do dado privado`)
    // os termos e os sites de fora (texto digitado por terceiros) só saem por `dados-termos.ts`, que prova a edição; o leitor só os define
    if (PODE_LER.has(arq) && arq !== DADOS_TERMOS && arq !== LER_DIMENSOES && /\blerDetalheDaOrigem\s*\(/.test(s)) v.push(`${arq}: chama lerDetalheDaOrigem fora de dados-termos`)
    // E5b T20c: as trocas (versões, testes do Lab, alcance do vídeo) só entram por `dados-trocas.ts`; o Lab só é lido por `ler-testes-ab.ts`
    if (arq !== DADOS_TROCAS && arq !== 'lib/pipeline/services/competitors-campos.ts' && !arq.startsWith('lib/youtube/observatorio/proprio/') && !arq.startsWith('lib/youtube/observatorio/proprio-versoes/') && /\b(lerAlcanceDoVideo|lerTestesAb|lerVersoes)\s*\(/.test(s)) v.push(`${arq}: chama um leitor das trocas fora de dados-trocas`)
    if (arq.startsWith('lib/youtube/observatorio/proprio/') && arq !== LER_TESTES_AB && /['"`](ab_tests|ab_test_cycles)['"`]/.test(s)) v.push(`${arq}: cita as tabelas do A/B Lab fora de ler-testes-ab`)
    if (arq === LER_TESTES_AB && !/\bleituraValida\b/.test(s)) v.push(`${arq}: a guarda copiada não confere o token do HEAD`)
    if (cliente(bruto) && /from\s+['"][^'"]*_proprio\/dados-trocas['"]/.test(s)) v.push(`${arq}: componente cliente importa o módulo do dado privado`)
    if (arq.startsWith('app/api/') && /yt_own_video_traffic_detail_daily/.test(s)) v.push(`${arq}: rota de API cita a tabela do detalhe da origem`)
    if (LEITORES_E_DADOS.has(arq) && /\bEdicaoDoSite\b|\bedicaoValida\b/.test(s)) v.push(`${arq}: o leitor voltou ao token de edição`)
    if (!arq.startsWith(COLETA_DIR) && !GRAVADORES_QUE_LEEM.has(arq) && !E9_SO_COM_EDICAO.has(arq) && DOZE.some(t => cita(s, t))) {
      const nivelPeloLeitor = LEITORES_POR_NIVEL.has(arq) && /\bnivelDeQuemVe\s*\(/.test(s)
      if (!/\bleituraValida\b/.test(s) && !nivelPeloLeitor) v.push(`${arq}: consulta uma das doze tabelas privadas sem passar por leituraValida`)
      if (/\bEdicaoDoSite\b|\bedicaoValida\b/.test(s)) v.push(`${arq}: consulta uma das doze tabelas privadas com o token de edição`)
    }
    // Phil I1 (lote F1a-tela-1): a RPC do volume lê impressões e privacidade (duas das doze) sem passar por `.from()`; a regra olha a chamada
    if (/\.rpc\(\s*['"`]ab_lab_volume['"`]/.test(s)) {
      if (!/\bleituraValida\b/.test(s)) v.push(`${arq}: chama a RPC ab_lab_volume sem passar por leituraValida`)
      if (/\bEdicaoDoSite\b|\bedicaoValida\b/.test(s)) v.push(`${arq}: chama a RPC ab_lab_volume com o token de edição`)
    }
    if (!PODE_IMPORTAR_CONSULTAS.has(arq) && importaConsultas(arq, s)) v.push(`${arq}: importa as consultas sem prova do dado privado`)
    if (!arq.startsWith(COLETA_DIR) && lePorFrom(s) !== leSoColunasPermitidas(s)) v.push(`${arq}: lê yt_own_collection_attempts além de attempt_day e outcome`)
    if (!PODE_LER.has(arq) && /import\s+(?!type\b)[^'";]*?from\s+['"][^'"]*proprio\/ler(-retencao|-dimensoes|-diario-periodo)?['"]/.test(s)) v.push(`${arq}: importa os leitores do dado privado`)
    if (!PODE_LER.has(arq) && /export\s+(?!type\b)[^'";]*?from\s+['"][^'"]*proprio\/ler(-retencao|-dimensoes|-diario-periodo)?['"]/.test(s)) v.push(`${arq}: importa os leitores do dado privado`)
    // a exceção E9 (fila "Saíram do YouTube") só vale com estas amarras: um único chamador, com a guarda de edição, e sem texto de terceiros
    if (arq !== DADOS_SAIU && arq !== FILA_LER && /\blerFila\s*\(|saiu\/ler-fila['"]/.test(s)) v.push(`${arq}: chama ou importa lerFila fora de _saiu/dados.ts`)
    if (arq === DADOS_SAIU && /\blerFila\s*\(/.test(s) && !/requireSiteScope\(\s*\{\s*area:\s*'cms',\s*siteId,\s*mode:\s*'edit'\s*\}\s*\)/.test(s)) v.push(`${arq}: chama lerFila sem a guarda de edição do site`)
    if (arq === FILA_LER && /\bbody\b/.test(s)) v.push(`${arq}: o leitor da fila cita body (texto de terceiros pede leituraValida além da edição)`)
    if (cliente(bruto) && /from\s+['"][^'"]*(proprio\/ler|proprio\/ler-retencao|proprio\/ler-dimensoes|proprio\/ler-diario-periodo|proprio\/edicao|_proprio\/dados|_proprio\/dados-origem|_proprio\/dados-termos)['"]/.test(s)) v.push(`${arq}: componente cliente importa o módulo do dado privado`)
    if (arq !== LER_RETENCAO && !arq.startsWith(COLETA_DIR) && /yt_own_video_retention/.test(s)) v.push(`${arq}: consulta a tabela da curva de retenção fora do leitor`)
    if ((arq === LER || arq === DADOS) && /\bpodeEditar\b/.test(s)) v.push(`${arq}: volta a usar um booleano no lugar do token`)
  }
  return v
}

const reais: Record<string, string> = {}
for (const p of arquivos(SRC)) reais[relative(SRC, p).split(sep).join('/')] = readFileSync(p, 'utf8')

describe('varredura: o dado privado do canal próprio', () => {
  it('o código real não viola nenhuma regra', () => {
    expect(violacoes(reais)).toEqual([])
  })
  it('a varredura enxerga os arquivos do módulo (não passa por varrer uma pasta errada)', () => {
    for (const a of [EDICAO, LEITURA, LER, LER_RETENCAO, LER_DIMENSOES, LER_DIARIO_PERIODO, DADOS, DADOS_ORIGEM, DADOS_TERMOS]) expect(Object.keys(reais), a).toContain(a)
    expect(Object.keys(reais).length).toBeGreaterThan(300)
  })
  it('a prova de tipo do token está no tsc do web: 3 diretivas, uma única função exportada, nada fora dela', () => {
    expect(Object.keys(reais)).toContain(TIPOS)
    const bruto = reais[TIPOS]!
    expect(bruto.match(/^\s*\/\/ @ts-expect-error/gm)).toHaveLength(3)
    const s = semComentarios(bruto)
    expect(s.match(/^export\b/gm)).toEqual(['export'])
    expect(s).toMatch(/^export function provasDeTipo\(\): void \{/m)
    // nada de statement no topo além do import e da função (nenhuma chamada, nenhum new fora da função)
    const fora = s.replace(/^export function provasDeTipo\(\): void \{[\s\S]*\n\}\s*$/m, '').replace(/^import .*$/gm, '').trim()
    expect(fora).toBe('')
  })
  it('a prova de tipo do token de leitura está no tsc do web: 5 diretivas, uma única função exportada, nada fora dela', () => {
    expect(Object.keys(reais)).toContain(TIPOS_LEITURA)
    const bruto = reais[TIPOS_LEITURA]!
    expect(bruto.match(/^\s*\/\/ @ts-expect-error/gm)).toHaveLength(5)
    const s = semComentarios(bruto)
    expect(s.match(/^export\b/gm)).toEqual(['export'])
    expect(s).toMatch(/^export function provasDeTipo\(/m)
    const fora = s.replace(/^export function provasDeTipo\([\s\S]*\n\}\s*$/m, '').replace(/^import .*$/gm, '').trim()
    expect(fora).toBe('')
  })
  it('a leitura privada pede a guarda com mode "view" e nunca "edit" (quem pede edição é edicao.ts)', () => {
    expect(Object.keys(reais)).toContain(LEITURA)
    const s = semComentarios(reais[LEITURA]!)
    expect(s).toMatch(/requireSiteScope\(\s*\{[^}]*mode:\s*'view'/)
    expect(s).not.toMatch(/mode:\s*'edit'/)
  })
  it('a prova de edição pede a guarda com mode "edit" e nenhum outro', () => {
    const s = semComentarios(reais[EDICAO]!)
    expect(s).toMatch(/requireSiteScope\(\s*\{[^}]*mode:\s*'edit'/)
    expect(s).not.toMatch(/mode:\s*'view'/)
  })
  it('só o leitor da retenção consulta yt_own_video_retention fora da coleta (que a escreve)', () => {
    const donos = Object.entries(reais).filter(([, f]) => /yt_own_video_retention/.test(semComentarios(f))).map(([a]) => a)
    expect(donos.filter(a => !a.startsWith(COLETA_DIR))).toEqual([LER_RETENCAO])
    // a coleta é o único outro dono, e só dentro da pasta da coleta
    expect(donos.filter(a => a.startsWith(COLETA_DIR)).length).toBeGreaterThan(0)
  })
  it('só os leitores e o módulo de dados falam com as duas tabelas privadas', () => {
    const donos = Object.entries(reais).filter(([, s]) => /yt_own_video_daily|yt_own_video_reach_daily/.test(semComentarios(s))).map(([a]) => a)
    // as migrations e a coleta (escrita) vivem em outros lugares; aqui só se confere que nenhuma tela lê as tabelas direto
    const telas = donos.filter(a => a.startsWith('app/') && a !== DADOS)
    expect(telas).toEqual([])
  })
  describe('controles negativos: a varredura pega o que deve pegar', () => {
    const base = { [EDICAO]: '', [LER]: '', [DADOS]: '' }
    it('import relativo das consultas sem prova é pego (Yannis I4), com import, export-from e import()', () => {
      const novo = 'lib/youtube/observatorio/proprio/novo.ts'
      expect(violacoes({ ...base, [novo]: "import { lerBaseDiaria } from './consultas'" })).toEqual([`${novo}: importa as consultas sem prova do dado privado`])
      expect(violacoes({ ...base, [novo]: "export { lerBaseDiaria } from './consultas'" })).toHaveLength(1)
      expect(violacoes({ ...base, [novo]: "const m = await import('../proprio/consultas')" })).toHaveLength(1)
      expect(violacoes({ ...base, 'lib/youtube/observatorio/outro/x.ts': "import { a } from '@/lib/youtube/observatorio/proprio/consultas'" })).toHaveLength(1)
      expect(violacoes({ ...base, [novo]: "import { a } from './tipos'" })).toEqual([])
    })
    it('chamar um leitor fora do módulo', () => {
      expect(violacoes({ ...base, 'app/x/page.tsx': 'await lerDiario(sb, p)' })).toEqual(['app/x/page.tsx: chama um leitor do dado privado'])
      expect(violacoes({ ...base, 'app/x/page.tsx': 'await lerAlcance(sb, p)' })).toHaveLength(1)
    })
    it('retenção: chamar o leitor da curva, importá-lo ou consultar a tabela fora do módulo', () => {
      expect(violacoes({ ...base, 'app/x/page.tsx': 'await lerRetencao(sb, p)' })).toEqual(['app/x/page.tsx: chama um leitor do dado privado'])
      expect(violacoes({ ...base, 'app/x/a.ts': "import { lerRetencao } from '@/lib/youtube/observatorio/proprio/ler-retencao'" })).toEqual(['app/x/a.ts: importa os leitores do dado privado'])
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport { x } from '@/lib/youtube/observatorio/proprio/ler-retencao'" })).toEqual(['app/x/c.tsx: importa os leitores do dado privado', 'app/x/c.tsx: componente cliente importa o módulo do dado privado'])
      expect(violacoes({ ...base, 'app/x/a.ts': "sb.from('yt_own_video_retention').select('points')" })).toEqual(['app/x/a.ts: consulta uma das doze tabelas privadas sem passar por leituraValida', 'app/x/a.ts: consulta a tabela da curva de retenção fora do leitor'])
      expect(violacoes({ ...base, 'lib/youtube/observatorio/outro.ts': "sb.from('yt_own_video_retention')" })).toHaveLength(2)
    })
    it('retenção: o leitor e a coleta podem (não se acusam)', () => {
      expect(violacoes({ ...base, [LER_RETENCAO]: "leituraValida(x); sb.from('yt_own_video_retention'); export async function lerRetencao(sb: X) {}", 'lib/youtube/coleta/retencao-step.ts': "ctx.supabase.from('yt_own_video_retention').upsert(x)", [DADOS]: 'await lerRetencao(sb, p)' })).toEqual([])
    })
    it('fabricar o token', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = new EdicaoDoSite("s")' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = await EdicaoDoSite.provar("s")' })).toHaveLength(1)
    })
    it('pedir a prova de edição fora do módulo', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = await provarEdicao(siteId)' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = await provarEdicaoComAviso(siteId)' })).toHaveLength(1)
      // dados.ts não pede mais a prova de edição: quem pede é a leitura privada
      expect(violacoes({ ...base, [DADOS]: 'const t = await provarEdicao(siteId)' })).toEqual([`${DADOS}: pede a prova de edição fora do módulo da guarda`])
    })
    it('dimensões: chamar os leitores da E11 ou importá-los fora do módulo de dados; e os leitores voltarem ao token de edição', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'await lerDimensoes(sb, p)' })).toEqual(['app/x/a.ts: chama um leitor do dado privado'])
      expect(violacoes({ ...base, 'app/x/a.ts': 'await lerDetalheDaOrigem(sb, p)' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { lerDimensoes } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'" })).toEqual(['app/x/a.ts: importa os leitores do dado privado'])
      expect(violacoes({ ...base, [LER_DIMENSOES]: 'export async function lerDimensoes() {}' })).toEqual([])
      for (const arq of [LER, LER_RETENCAO, LER_DIMENSOES, LER_DIARIO_PERIODO, DADOS, DADOS_ORIGEM]) {
        expect(violacoes({ ...base, [arq]: "import { edicaoValida } from './edicao'" }), arq).toEqual([`${arq}: o leitor voltou ao token de edição`])
        expect(violacoes({ ...base, [arq]: 'p: EdicaoDoSite | null' }), arq).toEqual([`${arq}: o leitor voltou ao token de edição`])
      }
    })
    it('E5b T9: diário por período, origem e termos: quem pode chamar, quem pode provar a edição e o que o cliente não importa', () => {
      const chama = (arq: string) => [`${arq}: chama um leitor do dado privado`]
      expect(violacoes({ ...base, 'app/x/a.ts': 'await lerDiarioDoPeriodo(sb, p)' })).toEqual(chama('app/x/a.ts'))
      expect(violacoes({ ...base, 'app/x/a.ts': "import { lerDiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/ler-diario-periodo'" })).toEqual(['app/x/a.ts: importa os leitores do dado privado'])
      // só TIPO do leitor não dá acesso a nada
      expect(violacoes({ ...base, 'app/x/a.ts': "import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'\nimport { y } from './y'" })).toEqual([])
      // o módulo puro do total pode ser importado por qualquer um
      expect(violacoes({ ...base, 'app/x/a.ts': "import { totalDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'" })).toEqual([])
      expect(violacoes({ ...base, [DADOS_ORIGEM]: 'await lerDimensoes(sb, p); await lerDiarioDoPeriodo(sb, p)', [DADOS_TERMOS]: 'await lerDetalheDaOrigem(sb, p); provarEdicao(s)', [LER_DIARIO_PERIODO]: 'export async function lerDiarioDoPeriodo() {}' })).toEqual([])
      // o detalhe da origem (termos) só em dados-termos: nem em dados.ts nem em dados-origem
      for (const arq of [DADOS, DADOS_ORIGEM, LER, LER_RETENCAO, LER_DIARIO_PERIODO]) expect(violacoes({ ...base, [arq]: 'await lerDetalheDaOrigem(sb, p)' }), arq).toEqual([`${arq}: chama lerDetalheDaOrigem fora de dados-termos`])
      expect(violacoes({ ...base, [LER_DIMENSOES]: 'export async function lerDetalheDaOrigem() {}' })).toEqual([])
      // provar a edição: só dados-termos, além do módulo da guarda
      expect(violacoes({ ...base, [DADOS_ORIGEM]: 'await provarEdicao(s)' })).toEqual([`${DADOS_ORIGEM}: pede a prova de edição fora do módulo da guarda`])
      // componente cliente não importa as entradas
      for (const m of ['dados-origem', 'dados-termos']) expect(violacoes({ ...base, 'app/x/c.tsx': `'use client'\nimport { x } from '@/app/cms/(authed)/youtube/competitors/_proprio/${m}'` }), m).toEqual(['app/x/c.tsx: componente cliente importa o módulo do dado privado'])
      // rota de API não cita a tabela do detalhe
      expect(violacoes({ ...base, 'app/api/x/route.ts': "sb.from('yt_own_video_traffic_detail_daily')" })).toContain('app/api/x/route.ts: rota de API cita a tabela do detalhe da origem')
      expect(violacoes({ ...base, 'lib/youtube/coleta/x.ts': "sb.from('yt_own_video_traffic_detail_daily').upsert(x)" })).toEqual([])
    })
    it('E5b T20c: leitores das trocas só por dados-trocas; o Lab só em ler-testes-ab; guarda sem o token é violação; cliente não importa dados-trocas', () => {
      const chama = (arq: string) => [`${arq}: chama um leitor das trocas fora de dados-trocas`]
      for (const f of ['lerVersoes(sb, p)', 'lerTestesAb(sb, p)', 'lerAlcanceDoVideo(sb, p)']) expect(violacoes({ ...base, 'app/x/a.ts': 'await ' + f }), f).toContain('app/x/a.ts: chama um leitor das trocas fora de dados-trocas')
      expect(chama('x')).toHaveLength(1)
      expect(violacoes({ ...base, [DADOS_TROCAS]: 'await lerVersoes(sb, p); await lerTestesAb(sb, p); await lerAlcanceDoVideo(sb, p)' })).toEqual([])
      expect(violacoes({ ...base, 'lib/youtube/observatorio/proprio/novo.ts': "sb.from('ab_tests')" })).toEqual(['lib/youtube/observatorio/proprio/novo.ts: cita as tabelas do A/B Lab fora de ler-testes-ab'])
      expect(violacoes({ ...base, [LER_TESTES_AB]: "sb.from('ab_tests'); const s = leituraValida(x)" })).toEqual([])
      expect(violacoes({ ...base, [LER_TESTES_AB]: "sb.from('ab_tests')" })).toEqual([`${LER_TESTES_AB}: a guarda copiada não confere o token do HEAD`])
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport { x } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-trocas'" })).toEqual(['app/x/c.tsx: componente cliente importa o módulo do dado privado'])
      expect(violacoes({ ...base, [DADOS_TROCAS]: "import { edicaoValida } from './edicao'" })).toEqual([`${DADOS_TROCAS}: o leitor voltou ao token de edição`])
    })
    it('as doze tabelas: arquivo fora da coleta que cita uma delas precisa de leituraValida e não pode citar o token de edição', () => {
      for (const t of DOZE) {
        expect(violacoes({ ...base, 'lib/x/novo.ts': `sb.from('${t}').select('a')` }).filter(m => m.includes('doze')), t).toEqual(['lib/x/novo.ts: consulta uma das doze tabelas privadas sem passar por leituraValida'])
      }
      expect(violacoes({ ...base, 'lib/x/novo.ts': "import { leituraValida } from '../proprio/leitura-privada'\nsb.from('yt_own_video_versions').select('a')" })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/novo.ts': "import { leituraValida } from '../proprio/leitura-privada'\nimport type { EdicaoDoSite } from '../proprio/edicao'\nsb.from('yt_own_video_daily')" })).toEqual(['lib/x/novo.ts: consulta uma das doze tabelas privadas com o token de edição'])
      // a coleta e os dois gravadores da lista fechada ficam de fora; uma tabela que não é das doze também
      expect(violacoes({ ...base, 'lib/youtube/coleta/x.ts': "sb.from('yt_own_video_daily').upsert(x)" })).toEqual([])
      expect(violacoes({ ...base, 'lib/youtube/horaria/gravar.ts': "sb.from('yt_own_video_meta_daily').select('a')" })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/novo.ts': "sb.from('yt_own_public_video_hourly').select('a')" })).toEqual([])
      // a lista fechada do E9 vale só para os dois caminhos; o mesmo código em outro arquivo continua acusado
      expect(violacoes({ ...base, 'lib/youtube/observatorio/saiu/ler-fila.ts': "sb.from('competitor_video_comments').select('id')", 'app/cms/(authed)/youtube/competitors/actions.ts': "sb.from('competitor_video_comments').select('id')" })).toEqual([])
      expect(violacoes({ ...base, 'lib/youtube/observatorio/saiu/outro.ts': "sb.from('competitor_video_comments').select('id')" })).toEqual(['lib/youtube/observatorio/saiu/outro.ts: consulta uma das doze tabelas privadas sem passar por leituraValida'])
      for (const arq of [VERSOES_LER, COMENTARIOS_LER])
        expect(violacoes({ ...base, [arq]: "import { edicaoValida } from '../proprio/edicao'" }), arq).toEqual([`${arq}: o leitor voltou ao token de edição`])
    })
    it('Phil I1: a RPC ab_lab_volume exige leituraValida no mesmo arquivo (e não o token de edição)', () => {
      const rpc = "sb.rpc('ab_lab_volume', { p_site: s })"
      expect(violacoes({ ...base, 'lib/x/novo.ts': rpc })).toEqual(['lib/x/novo.ts: chama a RPC ab_lab_volume sem passar por leituraValida'])
      expect(violacoes({ ...base, 'lib/x/novo.ts': 'await sb\n  .rpc(\n"ab_lab_volume", {})' })).toHaveLength(1)
      expect(violacoes({ ...base, 'lib/x/novo.ts': "if (!leituraValida(l)) throw new Error('x'); " + rpc })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/novo.ts': "leituraValida(l); import type { EdicaoDoSite } from '../proprio/edicao'; " + rpc })).toEqual(['lib/x/novo.ts: chama a RPC ab_lab_volume com o token de edição'])
      // outra RPC não é acusada; a menção em comentário também não
      expect(violacoes({ ...base, 'lib/x/novo.ts': "sb.rpc('outra_funcao', {})" })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/novo.ts': "// sb.rpc('ab_lab_volume', {})" })).toEqual([])
    })
    it('E5a C1: os leitores dos comentários (e a página do vídeo e a do canal) não pedem a prova de edição; a isenção só vale com nivelDeQuemVe', () => {
      const L = 'lib/youtube/observatorio/comentarios/leitor.ts'
      const LC = 'lib/youtube/observatorio/comentarios/leitor-contagem.ts'
      const cita2 = "sb.from('competitor_video_comments').select('id')"
      expect(violacoes({ ...base, [L]: 'nivelDeQuemVe(p, s); ' + cita2, [LC]: 'nivelDeQuemVe(p, s); ' + cita2 })).toEqual([])
      // sem chamar nivelDeQuemVe, a isenção some
      expect(violacoes({ ...base, [L]: cita2 })).toEqual([`${L}: consulta uma das doze tabelas privadas sem passar por leituraValida`])
      // outro arquivo da pasta não ganha a isenção
      expect(violacoes({ ...base, 'lib/youtube/observatorio/comentarios/outro.ts': 'nivelDeQuemVe(p, s); ' + cita2 })).toHaveLength(1)
      // com a isenção, citar o token de edição continua proibido
      expect(violacoes({ ...base, [L]: 'nivelDeQuemVe(p, s); edicaoValida(x); ' + cita2 })).toEqual([`${L}: consulta uma das doze tabelas privadas com o token de edição`])
      // pedir a prova de edição: violação nos leitores e nas duas páginas (PODE_PROVAR não ganha arquivo)
      for (const arq of [L, LC, 'app/cms/(authed)/youtube/competitors/video/[id]/page.tsx', 'app/cms/(authed)/youtube/competitors/canal/[id]/page.tsx']) {
        expect(violacoes({ ...base, [arq]: 'const e = await provarEdicao(siteId)' }), arq).toEqual([`${arq}: pede a prova de edição fora do módulo da guarda`])
      }
      expect(PODE_PROVAR.size).toBe(3) // guarda de edição, de leitura e os dados dos termos (E5b)
    })
    it('re-export dos leitores é acusado como importação; export type não (Yannis I3)', () => {
      const msg = ['app/x/a.ts: importa os leitores do dado privado']
      expect(violacoes({ ...base, 'app/x/a.ts': "export { lerDiarioDoPeriodo as l } from '@/lib/youtube/observatorio/proprio/ler-diario-periodo'" })).toEqual(msg)
      expect(violacoes({ ...base, 'app/x/a.ts': "export { lerDimensoes as ler } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'" })).toEqual(msg)
      expect(violacoes({ ...base, 'app/x/a.ts': "export * from '@/lib/youtube/observatorio/proprio/ler-retencao'" })).toEqual(msg)
      expect(violacoes({ ...base, 'app/x/a.ts': "export type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/ler-diario-periodo'" })).toEqual([])
    })
    it('a exceção E9: lerFila só é chamada de _saiu/dados.ts, que tem a guarda de edição, e ler-fila.ts nunca cita body (Yannis I4)', () => {
      const DADOS_SAIU = 'app/cms/(authed)/youtube/competitors/_saiu/dados.ts'
      const FILA = 'lib/youtube/observatorio/saiu/ler-fila.ts'
      const guarda = "requireSiteScope({ area: 'cms', siteId, mode: 'edit' })"
      expect(violacoes({ ...base, [DADOS_SAIU]: `import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'\nawait ${guarda}\nlerFila(sb, {})` })).toEqual([])
      expect(violacoes({ ...base, 'app/api/pipeline/x/route.ts': "import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'\nlerFila(sb, {})" })).toEqual(['app/api/pipeline/x/route.ts: chama ou importa lerFila fora de _saiu/dados.ts'])
      expect(violacoes({ ...base, [DADOS_SAIU]: "import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'\nlerFila(sb, {})" })).toEqual([`${DADOS_SAIU}: chama lerFila sem a guarda de edição do site`])
      expect(violacoes({ ...base, [DADOS_SAIU]: `import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'\nawait requireSiteScope({ area: 'cms', siteId, mode: 'view' })\nlerFila(sb, {})` })).toEqual([`${DADOS_SAIU}: chama lerFila sem a guarda de edição do site`])
      expect(violacoes({ ...base, [FILA]: "const C = 'id, body'\nsb.from('competitor_video_comments').select(C)" })).toEqual([`${FILA}: o leitor da fila cita body (texto de terceiros pede leituraValida além da edição)`])
      expect(violacoes({ ...base, [FILA]: "const C = 'id, video_id'\nsb.from('competitor_video_comments').select(C)" })).toEqual([])
    })
    it('tentativas de coleta: fora da coleta, só attempt_day e outcome', () => {
      const erro = (arq: string) => [`${arq}: lê yt_own_collection_attempts além de attempt_day e outcome`]
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select('attempt_day')" })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select('outcome')" })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select('attempt_day, outcome')" })).toEqual([])
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select('*')" })).toEqual(erro('lib/x/a.ts'))
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select('attempt_day, error_message')" })).toEqual(erro('lib/x/a.ts'))
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select(COLS)" })).toEqual(erro('lib/x/a.ts'))
      expect(violacoes({ ...base, 'lib/x/a.ts': "sb.from('yt_own_collection_attempts').select('outcome'); sb.from('yt_own_collection_attempts').select('*')" })).toEqual(erro('lib/x/a.ts'))
      expect(violacoes({ ...base, 'lib/youtube/coleta/a.ts': "sb.from('yt_own_collection_attempts').select('*')" })).toEqual([])
    })
    it('importar o leitor, ou o módulo do dado privado num componente cliente', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': "import { lerDiario } from '@/lib/youtube/observatorio/proprio/ler'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport { x } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'" })).toHaveLength(1)
    })
    it('usar a classe do token como valor fora de edicao.ts: estender, protótipo, Reflect.construct, Object.create, typeof, instanceof', () => {
      for (const codigo of [
        'class F extends EdicaoDoSite {}',
        'Object.create(EdicaoDoSite.prototype, { siteId: { value: "s" } })',
        'Reflect.construct(EdicaoDoSite, ["s"])',
        'Object.create(EdicaoDoSite)',
        'const k = typeof EdicaoDoSite',
        'if (x instanceof EdicaoDoSite) {}',
        'EdicaoDoSite.ehEdicao(x)',
      ]) expect(violacoes({ ...base, 'app/x/a.ts': codigo }), codigo).toHaveLength(1)
      // como TIPO é permitido
      expect(violacoes({ ...base, 'app/x/a.ts': "import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'\nconst f = (e: EdicaoDoSite | null): Promise<EdicaoDoSite | null> => Promise.resolve(e)" })).toEqual([])
      expect(violacoes({ ...base, 'app/x/a.ts': "import { edicaoValida, type EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'" })).toEqual([])
    })
    it('importar a classe como valor, ou o módulo por namespace ou dinâmico', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': "import { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { provarEdicao, EdicaoDoSite } from './proprio/edicao'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import * as E from '@/lib/youtube/observatorio/proprio/edicao'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "const m = await import('@/lib/youtube/observatorio/proprio/edicao')" })).toHaveLength(1)
    })
    it('importar a prova de tipo (ela não deve rodar)', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': "import { provasDeTipo } from '@/lib/youtube/observatorio/proprio/edicao.type-test'" })).toHaveLength(1)
    })
    it('a prova de tipo pode nomear a classe (não acusa a si mesma)', () => {
      expect(violacoes({ ...base, [TIPOS]: "import { EdicaoDoSite } from './edicao'\nclass S extends EdicaoDoSite {}\nnew EdicaoDoSite('s', Symbol())" })).toEqual([])
    })
    it('token de leitura: construir, usar a classe como valor, importá-la como valor ou por namespace, importar a prova de tipo', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'const t = new LeituraPrivadaDoSite("s")' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'await LeituraPrivadaDoSite.provar("s")' })).toHaveLength(1)
      for (const codigo of ['class F extends LeituraPrivadaDoSite {}', 'Object.create(LeituraPrivadaDoSite.prototype)', 'Reflect.construct(LeituraPrivadaDoSite, ["s"])', 'const k = typeof LeituraPrivadaDoSite', 'if (x instanceof LeituraPrivadaDoSite) {}'])
        expect(violacoes({ ...base, 'app/x/a.ts': codigo }), codigo).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import * as L from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "const m = await import('@/lib/youtube/observatorio/proprio/leitura-privada')" })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': "import { provasDeTipo } from '@/lib/youtube/observatorio/proprio/leitura-privada.type-test'" })).toHaveLength(1)
      // como TIPO é permitido
      expect(violacoes({ ...base, 'app/x/a.ts': "import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toEqual([])
    })
    it('token de leitura: pedir a prova fora do módulo e de dados.ts, citar a função do direito, importar num componente cliente', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'await provarAcessoPrivado(siteId)' })).toHaveLength(1)
      expect(violacoes({ ...base, 'app/x/a.ts': 'await provarLeituraPrivada(siteId)' })).toHaveLength(1)
      expect(violacoes({ ...base, [DADOS]: 'await provarAcessoPrivado(siteId)' })).toEqual([])
      expect(violacoes({ ...base, 'app/x/a.ts': "sb.rpc('can_view_private_site_as', {})" })).toEqual(['app/x/a.ts: cita a função do direito fora do módulo da leitura privada'])
      expect(violacoes({ ...base, [LEITURA]: "sb.rpc('can_view_private_site_as', {})" })).toEqual([])
      expect(violacoes({ ...base, 'app/x/c.tsx': "'use client'\nimport type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'" })).toEqual(['app/x/c.tsx: componente cliente importa o módulo da leitura privada'])
    })
    it('segunda porta: provarAcessoPrivadoDaChave só em leitura-privada.ts e na rota do MCP', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': 'await provarAcessoPrivadoDaChave(prova)' })).toEqual(['app/x/a.ts: pede a leitura privada pela chave fora da rota do MCP'])
      expect(violacoes({ ...base, [ROTA_MCP]: 'await provarAcessoPrivadoDaChave(prova)', [LEITURA]: 'export async function provarAcessoPrivadoDaChave(p) {}' })).toEqual([])
    })
    it('a prova da chave só é fabricada em prova.ts e porta.ts', () => {
      for (const codigo of ['new ChaveDoPerfilProvada(a)', 'ChaveDoPerfilProvada.fabricar(a)', 'fabricarProva(a, b, c, d)'])
        expect(violacoes({ ...base, 'app/x/a.ts': codigo }), codigo).toEqual(['app/x/a.ts: fabrica a prova da chave do perfil'])
      expect(violacoes({ ...base, [PROVA_CHAVE]: 'export const fabricarProva = () => ChaveDoPerfilProvada.fabricar(a)', [PORTA_CHAVE]: 'fabricarProva(a, b, c, d)' })).toEqual([])
    })
    it('carregadores sem guarda: só page-data.ts e abrir-por-chave.ts chamam carregarObservatorio( e carregarCanal(', () => {
      const msg = (a: string) => `${a}: chama um carregador de tela sem guarda fora de page-data.ts e do abridor da chave`
      expect(violacoes({ ...base, 'app/x/a.ts': 'await carregarObservatorio({})' })).toEqual([msg('app/x/a.ts')])
      expect(violacoes({ ...base, 'app/x/b.ts': 'await carregarCanal<T>({})' })).toEqual([msg('app/x/b.ts')])
      expect(violacoes({ ...base, 'app/x/c.ts': '// chama carregarCanal(x)\n/* carregarObservatorio( */' })).toEqual([])
      expect(violacoes({ ...base, [PAGE_DATA]: 'export async function carregarCanal(a) {}', [ABRIR_CHAVE]: 'carregarObservatorio({}); carregarCanal({})' })).toEqual([])
    })
    it('o módulo da leitura privada pode (não acusa a si mesmo)', () => {
      expect(violacoes({ ...base, [LEITURA]: 'new LeituraPrivadaDoSite(s, k); provarAcessoPrivado(s)', [TIPOS_LEITURA]: "class S extends LeituraPrivadaDoSite {}" })).toEqual([])
    })
    it('voltar ao booleano', () => {
      expect(violacoes({ ...base, [DADOS]: 'a: { podeEditar: boolean }' })).toHaveLength(1)
    })
    it('comentário que cita o nome não é violação', () => {
      expect(violacoes({ ...base, 'app/x/a.ts': '// chama lerDiario(sb) depois\n/* provarEdicao( */' })).toEqual([])
    })
    it('o módulo da guarda pode (não acusa a si mesmo)', () => {
      expect(violacoes({ ...base, [DADOS]: 'await lerDiario(sb, p); provarAcessoPrivado(s)', [EDICAO]: 'new EdicaoDoSite(s)' })).toEqual([])
    })
  })
})
