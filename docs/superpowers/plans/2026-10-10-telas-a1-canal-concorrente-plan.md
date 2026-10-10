# Telas do Observatório, fase A1 (canal do concorrente) — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Um implementador por vez,
> Sonnet, `effort: high` (desce para `medium` quando as revisões voltarem limpas; nunca `xhigh` nem `max`). Revisão
> final do lote em Opus, `high`. Os passos usam caixas (`- [ ]`).

**Objetivo:** o clique num concorrente na lista de Canais abre a **página do canal** (`canal/<id>`): cabeçalho com a faixa de números, vídeos em Capas e em Lista, controles, "Carregar mais", aba Trocas e aba Leitura. O painel lateral deixa de abrir para concorrente.

**Arquitetura:** rota nova de servidor que roda a guarda de acesso, lê **um canal só** com `loadChannelDataset` (A0) e monta um modelo de tela (`buildCanalView`) com os campos brutos e o texto pronto de cada vídeo. Um componente cliente guarda filtro, ordenação, busca, vista e quantidade carregada, filtra e ordena no navegador sobre os campos brutos e espelha o estado na URL sem navegar. A moldura da página é nova e pequena: só a trilha.

**Stack:** Next 16, React 19, TypeScript estrito, Vitest (happy-dom; jsdom onde indicado), Playwright (projeto `observatorio`, banco local).

**Spec:** `docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md` (v9): seção 4.2 "A1", seções 3, 5 (inteira), 7.1, 10, 11 e 19. Quem executa lê o spec junto com a tarefa: **todo texto de tela citado aqui está no spec e vale o do spec, letra por letra.**

**Fonte visual (mockup aprovado em 10/10):** `docs/superpowers/mockups/2026-10-07-pagina-canal/{canal.html,canal.css,canal.js,faixa-numeros.js,dados.js}`. As medidas, o espaçamento e a ordem dos elementos saem dali. O mockup tem dados próprios e não tem banco: copia-se a forma, nunca o dado.

**Ledger:** `.superpowers/sdd/2026-10-10-telas-a1-canal-plan/progress.md` (criar na Tarefa 1). Relatório de cada tarefa em `task-N-report.md` na mesma pasta; a resposta do agente ao controlador tem até 10 linhas.

Abreviações de caminho:
- `C/` = `apps/web/src/app/cms/(authed)/youtube/competitors/`
- `L/` = `apps/web/src/lib/youtube/observatorio/`
- `T/` = `apps/web/test/youtube/observatorio/`
- `E/` = `apps/web/e2e/tests/cms/observatorio/`
- `M/` = `docs/superpowers/mockups/2026-10-07-pagina-canal/`

## Restrições globais

- Trabalho em `staging`, sem branch nem worktree. Nunca `git stash`, `git reset`, `--no-verify`, `pkill`. Commit por caminho explícito (`git add <caminhos>` e `git commit -- <caminhos>`). **Nunca** commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. **Sem push**: o push é portão do dono.
- Nenhum `color-mix()` em CSS. Cores em hex ou `rgba` literal. Nenhum `z-index` numérico em arquivo novo: só `var(--z-*)` (`C/_chrome/camadas.css`).
- Nulo nunca vira zero. Dado ausente é `null` no tipo e, na tela, a frase do spec 5.9 na classe `.obs-ch-nm` ("não medido" rosa com hachura). Zero medido é "0".
- Toda dica, popover e menu usa `Popover` ou `HoverTip` de `C/_chrome/flut/flut.tsx`. Nenhuma flutuante filha de cartão, célula ou contêiner com `overflow`.
- `strict: true`, nunca `any`. Arquivos em kebab-case. Corpo de texto mínimo de 12 px. No máximo um botão preenchido por vista (o de "Carregar mais").
- Nunca passar `next/link` (nem componente importado num Server Component) como prop para componente cliente; server actions chegam por props.
- Teste que muda de expectativa vai no **mesmo commit** da mudança.
- Horários em São Paulo (`obs.date`). Datas em `<time datetime>`.
- O conjunto de um canal (`scope: 'canal'`) **lança** em tudo que agrega entre canais: `ownChannels`, `channelSlots`, `tabCounts`, `TAB_COUNTS`, `integrity`, `hasCompetitors`, `nicheRef`, `nicheStats`, `heatmap`, `forja.niches`, `session.current('todos')`, `compose` com `split`. O modelo da página do canal não chama nenhum deles.
- `$SCRATCH` = o diretório de rascunho da sessão, que o controlador informa no brief.
- Subagente nunca espera mais de 4 min parado: suíte, build e Playwright vão em fundo, com saída em arquivo; no contexto entram só as falhas.
- Suíte de uma pasta: `cd apps/web && npx vitest run test/youtube/observatorio > $SCRATCH/vitest.txt 2>&1`. Typecheck: `cd apps/web && npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`.
- E2E local: `npm run db:start` (nunca `db:reset`), depois `cd apps/web && npx playwright test --project=observatorio <spec> > $SCRATCH/pw.txt 2>&1`. O servidor sobe sozinho na porta 3099.
- Navegador (DevTools/Chrome MCP) só em subagente Sonnet; capturas vão para arquivo, o veredito volta em texto.

## Decisões deste plano (o spec deixou para o plano, ou o dono decidiu em 10/10)

| # | Decisão | Por quê | Custo se errado |
|---|---|---|---|
| D1 | A página do canal tem **moldura própria**, `TrailChrome`: raiz `[data-obs]`, avisos, trilha e "Horários em São Paulo". Não usa `ObservatoryChromeServer` | emenda 25 (só a trilha); a moldura de hoje lê `TAB_COUNTS`, que lança no conjunto de um canal | a A2 e a A3 reusam `TrailChrome`; se precisarem de mais, crescem o componente |
| D2 | Os vídeos **antigos vêm todos no primeiro pacote**, em forma enxuta (sem série nem versões); "Carregar mais" revela 40 no navegador | spec 5.10 deixa ao plano; assim o clique fica abaixo de 100 ms, a busca acha os antigos e o Voltar reabre a grade igual | canal com milhares de vídeos guardados engorda a página. Teste da Tarefa 3 fixa o teto (3.000 antigos em até 1,2 MB de JSON); acima disso, o plano B é pedir por lote, e vira tarefa nova |
| D3 | Vídeos e Trocas trocam de aba **no navegador** (mesmo pacote); Leitura é navegação de verdade e lê o conjunto do site | spec seção 10; a leitura do nicho precisa de `forja.niches`, que o conjunto de um canal não dá | a aba Leitura paga a leitura do site (a mesma das outras telas, com cache) |
| D4 | **"Comparar com o meu canal" e o atalho "Meu canal" não entram na A1.** O cabeçalho fica com "Abrir no YouTube" e o menu ⋯ | a tela de comparação e o atalho são da A3 (spec 4.1); um botão que leva a rota inexistente é pior que a ausência | a A3 acrescenta os dois; o lugar deles no cabeçalho e na trilha fica reservado no CSS |
| D5 | Views por dia **positivo e menor que 0,05** mostra "menos de 0,1" | spec 19.3 deixa a borda ao plano; "0,0" parece zero medido | trocar por mais casas é uma linha em `vpdText` |
| D6 | A URL do Histórico ganha `canal=<id>` (origem: página do canal) e `troca=<id>`. Na A1 o Histórico usa `canal` só para apontar o item do canal na trilha para a página, com o estado dela; `troca` é emitido e **ignorado** até a A2 | A2 é quem faz a chegada pela troca; a A1 não pode deixar link que volta ao painel lateral | o link "Abrir nesta troca" abre o Histórico sem destaque até a A2 |
| D7 | Tema claro: a A1 define o valor claro só dos três tokens que usa (`--nm #8E2A62`, `--nm-line #A85585`, `--nm-bg #F7E1EC`), com teste de contraste calculado contra a superfície clara de `chrome.css` | pendência D7 da A0; o dono usa o tema escuro, mas o CMS troca de tema | **cor a confirmar com o dono**; os outros seis tokens ficam para a A3 e a A4 |
| D8 | Os e2e de fidelidade contra os mockups de 02/10: a A1 **apaga os estados do painel de concorrente** em `E/canais.spec.ts` (e os de `E/forja.spec.ts` que dependem dele) e escreve `E/canal.spec.ts`, que mede comportamento e medidas na moldura real, não compara DOM com mockup | decisão do dono em 10/10 (ruling G1: aposentar e reescrever por tela); o mockup de 10/10 não tem oráculo de dados para comparar DOM | as outras telas seguem com os specs antigos até a fase delas |
| D9 | `comment_count ?? 0` nos agregados de `apps/web/src/lib/pipeline/services/competitors.ts` (ruling G2) fica **fora**: backlog | decisão do dono em 10/10 | nenhum para a A1 |
| D10 | Pré-carga por hover: `router.prefetch(href)` depois de 150 ms de hover ou foco, no máximo 3 em andamento. O cabeçalho otimista "com o que a linha tinha" **não** é feito: o `loading.tsx` da rota mostra o esqueleto na forma final | a rota é dinâmica e o pacote do canal já está em cache quando a lista abriu; medir antes de construir estado otimista | se a navegação quente passar de 1 s (medida na Tarefa 11), o cabeçalho otimista vira tarefa da A3 |
| D11 | "Remover canal…" do menu ⋯ reusa `RemoveDialog` de `C/_canais/remove-dialog.tsx`; as regras de CSS dele presas a `[data-obs-screen="canais"]` são copiadas para `C/_chrome/kit.css` com prefixo `obs-ch-`, sob o teste de paridade que já existe (`T/kit-css.test.ts`) | mesmo padrão D4 da A0 (promoção por cópia, sem mexer na tela de produção) | duplicação de CSS até alguém deduplicar |

## Foco de revisão

Entradas que o spec implica e que mais mordem quem usa; cada linha tem o teste na tarefa dona do código.

1. **Canal de outro site ou id inventado na URL:** "Canal não encontrado" dentro da moldura, status 200, nenhuma leitura pesada, nada no Sentry. → Tarefa 4, teste "id de outro site".
2. **Canal em primeira sincronização** (`sync.state === 'backfill'`, vídeos pela metade): faixa "Sincronizando: 12 de 48 vídeos…", nenhum número calculado sobre a metade, nenhum "0". → Tarefa 2, teste "canal em backfill".
3. **Todos os vídeos visíveis sem número para a ordenação escolhida** ("Maior múltiplo" num canal sem base): a grade mostra todos sob o divisor "Sem múltiplo ainda (N)", nunca fica vazia. → Tarefa 3, teste "ordenação sem nenhum valor".
4. **URL com estado inválido** (`fmt=xyz`, `n=-5`, `n=37`, `sort=imp` em concorrente, `q` com 2.000 caracteres): cai no padrão em silêncio, `n` vira o múltiplo de 40 abaixo, `q` é cortado em 100; a página nunca dá 500. → Tarefa 1, teste "parâmetros inválidos".
5. **Título com HTML, emoji ou em outro alfabeto na busca** ("São João <b>", "東京"): a busca ignora acento e caixa, não quebra com caractere especial de regex, e o texto aparece escapado. → Tarefa 3, teste "busca com caracteres especiais".

---

### Tarefa 1: links, parâmetros da URL, número de views por dia e tokens do tema claro

**Arquivos:**
- Modificar: `L/links.ts`, `C/_chrome/tokens-telas.css`
- Criar: `C/_canal/params.ts`, `C/_canal/numeros.ts`
- Teste: `T/links.test.ts` (acrescentar), `T/canal-params.test.ts`, `T/canal-numeros.test.ts`, `T/camadas-css.test.ts` (acrescentar)
- Criar: `.superpowers/sdd/2026-10-10-telas-a1-canal-plan/progress.md` (uma linha: "A1 iniciada", data e o commit base)

**Interfaces:**
- Produz, em `L/links.ts`:
  ```ts
  export type CanalTab = 'videos' | 'trocas' | 'leitura'
  export type CanalFmt = 'todos' | 'longos' | 'shorts' | 'fixados'
  export type CanalSort = 'recentes' | 'vistos' | 'multiplo' | 'vpd'
  export interface CanalLinkParams { tab?: CanalTab; fmt?: CanalFmt; sort?: CanalSort; dir?: 'asc' | 'desc'; q?: string; ver?: 'capas' | 'lista'; n?: number; video?: string; nums?: 1; from?: 'outliers' | 'mudancas' | 'video'; back?: string }
  link.canal(id: string, p?: CanalLinkParams): string
  link.historico(videoId, p?: { from?; back?; ids?; canal?: string; troca?: string }): string
  ```
- Produz, em `C/_canal/params.ts`:
  ```ts
  export interface CanalState { tab: CanalTab; fmt: CanalFmt; sort: CanalSort; dir: 'asc' | 'desc'; q: string; ver: 'capas' | 'lista'; n: number; video: string | null; nums: boolean }
  export const CANAL_DEFAULT: CanalState
  export const LOTE = 40
  export function parseCanalState(sp: Record<string, string | undefined>): CanalState
  export function canalQuery(s: CanalState): string   // '' ou '?…', só o que difere do padrão, na ordem tab, fmt, sort, dir, q, ver, n, video, nums
  ```
- Produz, em `C/_canal/numeros.ts`: `export function vpdText(v: number | null, num: (n: number) => string): string | null` (null quando `v` é null).

- [ ] **Passo 1: testes que falham**

Em `T/links.test.ts`, acrescentar:
```ts
describe('link.canal', () => {
  it('padrões ficam fora da URL', () => {
    expect(link.canal('abc')).toBe('/cms/youtube/competitors/canal/abc')
    expect(link.canal('abc', { tab: 'videos', fmt: 'todos', sort: 'recentes', ver: 'capas', n: 0 })).toBe('/cms/youtube/competitors/canal/abc')
  })
  it('estado fora do padrão vai na URL', () => {
    expect(link.canal('abc', { tab: 'trocas', video: 'v1' })).toBe('/cms/youtube/competitors/canal/abc?tab=trocas&video=v1')
    expect(link.canal('abc', { fmt: 'fixados', sort: 'vistos', dir: 'asc', q: 'são joão', ver: 'lista', n: 80, nums: 1 }))
      .toBe('/cms/youtube/competitors/canal/abc?fmt=fixados&sort=vistos&dir=asc&q=s%C3%A3o+jo%C3%A3o&ver=lista&n=80&nums=1')
  })
  it('id com caractere especial é codificado', () => {
    expect(link.canal('a/b?c')).toBe('/cms/youtube/competitors/canal/a%2Fb%3Fc')
  })
  it('back só vale começando por "?" e só com from', () => {
    expect(link.canal('abc', { from: 'outliers', back: '?fmt=short' })).toContain('back=%3Ffmt%3Dshort')
    expect(link.canal('abc', { from: 'outliers', back: 'https://x' })).not.toContain('back=')
    expect(link.canal('abc', { back: '?x=1' })).not.toContain('back=')
  })
})
describe('link.historico com origem no canal', () => {
  it('leva canal e troca', () => {
    expect(link.historico('v1', { from: 'canais', canal: 'abc', troca: 'chg-9', back: '?fmt=longos' }))
      .toBe('/cms/youtube/competitors/video/v1?from=canais&back=%3Ffmt%3Dlongos&canal=abc&troca=chg-9')
  })
})
```
Em `T/canal-params.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseCanalState, canalQuery, CANAL_DEFAULT } from '@/app/cms/(authed)/youtube/competitors/_canal/params'

describe('estado da página do canal na URL', () => {
  it('sem parâmetro: o padrão', () => { expect(parseCanalState({})).toEqual(CANAL_DEFAULT) })
  it('ida e volta', () => {
    const s = { ...CANAL_DEFAULT, tab: 'trocas' as const, video: 'v1' }
    expect(parseCanalState(Object.fromEntries(new URLSearchParams(canalQuery(s))))).toEqual(s)
  })
  it('parâmetros inválidos caem no padrão, sem erro', () => {
    const s = parseCanalState({ tab: 'retencao', fmt: 'xyz', sort: 'imp', dir: 'cima', ver: 'mosaico', n: '-5', nums: '2' })
    expect(s).toEqual(CANAL_DEFAULT)
  })
  it('n vira o múltiplo de 40 abaixo e tem teto', () => {
    expect(parseCanalState({ n: '37' }).n).toBe(0)
    expect(parseCanalState({ n: '95' }).n).toBe(80)
    expect(parseCanalState({ n: 'abc' }).n).toBe(0)
    expect(parseCanalState({ n: '999999999' }).n).toBe(100000)
  })
  it('q é aparado e cortado em 100 caracteres', () => {
    expect(parseCanalState({ q: '  lisboa  ' }).q).toBe('lisboa')
    expect(parseCanalState({ q: 'x'.repeat(2000) }).q).toHaveLength(100)
  })
  it('video só vale na aba Trocas', () => {
    expect(parseCanalState({ video: 'v1' }).video).toBeNull()
    expect(parseCanalState({ tab: 'trocas', video: 'v1' }).video).toBe('v1')
  })
  it('dir padrão depende da ordenação: recentes, vistos, múltiplo e vpd abrem em desc', () => {
    expect(parseCanalState({ sort: 'vistos' }).dir).toBe('desc')
    expect(canalQuery({ ...CANAL_DEFAULT, sort: 'vistos' })).toBe('?sort=vistos')
  })
})
```
Em `T/canal-numeros.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
const num = (n: number) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' mil' : String(Math.round(n)))

describe('views por dia (spec 19.3)', () => {
  it('nulo não tem texto', () => { expect(vpdText(null, num)).toBeNull() })
  it('zero exato é "0"', () => { expect(vpdText(0, num)).toBe('0') })
  it('abaixo de 10, uma casa', () => { expect(vpdText(0.3, num)).toBe('0,3'); expect(vpdText(9.94, num)).toBe('9,9') })
  it('9,95 arredonda para 10, inteiro', () => { expect(vpdText(9.95, num)).toBe('10') })
  it('de 10 a 999, inteiro', () => { expect(vpdText(480.4, num)).toBe('480') })
  it('de 1.000 em diante, milhar', () => { expect(vpdText(6100, num)).toBe('6,1 mil') })
  it('positivo menor que 0,05 não vira "0,0"', () => { expect(vpdText(0.02, num)).toBe('menos de 0,1') })
  it('negativo (contagem corrigida pelo YouTube) não inventa sinal: não medido', () => { expect(vpdText(-3, num)).toBeNull() })
})
```
Em `T/camadas-css.test.ts`, acrescentar um teste que lê `C/_chrome/tokens-telas.css` e `C/_chrome/chrome.css`, extrai `--nm`, `--nm-line`, `--nm-bg` do bloco `[data-theme="light"] [data-obs]` e `--surface` do bloco claro de `chrome.css`, calcula o contraste WCAG (luminância relativa) e afirma: `--nm` sobre `--surface` ≥ 4,5; `--nm` sobre `--nm-bg` ≥ 4,5; `--nm-line` sobre `--surface` ≥ 3. A função de contraste fica no próprio teste:
```ts
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! }
const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05) }
```

- [ ] **Passo 2: rodar e ver falhar**

`cd apps/web && npx vitest run test/youtube/observatorio/links.test.ts test/youtube/observatorio/canal-params.test.ts test/youtube/observatorio/canal-numeros.test.ts test/youtube/observatorio/camadas-css.test.ts > $SCRATCH/t1.txt 2>&1`. Esperado: falha por `link.canal` e pelos módulos inexistentes.

- [ ] **Passo 3: implementar**

`L/links.ts`: `canal(id, p)` monta `OBS_BASE + '/canal/' + encodeURIComponent(id) + query`, tirando da query os valores iguais ao padrão (`tab=videos`, `fmt=todos`, `sort=recentes`, `ver=capas`, `n=0`), tirando `dir` quando é `desc`, e tirando `back` quando não começa por `?` ou quando não há `from`. A ordem das chaves é a da interface. `historico` passa a aceitar `canal` e `troca` (só acrescenta as chaves ao tipo; `cleanLink` já as deixa passar).

`C/_canal/params.ts`: `parseCanalState` valida cada campo contra a lista fechada; `n = Math.min(100000, Math.max(0, Math.floor(Number(n) / 40) * 40))`, com `NaN` virando 0; `q` com `trim()` e `slice(0, 100)`; `video` só com `tab === 'trocas'`; `nums` só com `'1'`. `canalQuery` usa `link.canal('x', …)` e devolve o que vem depois do caminho.

`C/_canal/numeros.ts`:
```ts
/** Views por dia (spec 19.3): zero medido é "0"; abaixo de 10, uma casa; de 10 a 999, inteiro; milhar depois. */
export function vpdText(v: number | null, num: (n: number) => string): string | null {
  if (v == null || v < 0) return null
  if (v === 0) return '0'
  if (v < 0.05) return 'menos de 0,1'
  const r1 = Math.round(v * 10) / 10
  if (r1 < 10) return r1.toFixed(1).replace('.', ',')
  return v < 1000 ? String(Math.round(v)) : num(v)
}
```
`C/_chrome/tokens-telas.css`: acrescentar o bloco
```css
/* Tema claro: só os tokens que a página do canal usa (plano da A1, D7). Cor a confirmar com o dono. */
[data-theme="light"] [data-obs]{--nm:#8E2A62;--nm-line:#A85585;--nm-bg:#F7E1EC}
[data-theme="light"] [data-obs] .obs-ch-nm{background:repeating-linear-gradient(135deg,var(--nm-bg) 0 6px,rgba(142,42,98,.10) 6px 8px)}
```
Se o teste de contraste reprovar algum par, escureça o token reprovado em passos de 8 em cada canal até passar e registre o valor final no ledger.

- [ ] **Passo 4: rodar e ver passar** (o mesmo comando do passo 2), mais o `tsc`.

- [ ] **Passo 5: commit**

`git add` dos sete arquivos e `git commit -m "feat: canal do concorrente: link.canal, estado na URL, views por dia e tokens do tema claro" -- <caminhos>`.

---

### Tarefa 2: modelo do cabeçalho (faixa de números, "Todos os números", linha de sincronização)

**Arquivos:**
- Criar: `C/_canal/header-model.ts`, `T/canal-fixture.ts`
- Teste: `T/canal-header-model.test.ts`

**Interfaces:**
- Consome: `Observatory` (`obs.channel`, `obs.videos`, `obs.channelStats(id, 'long' | 'short')`, `obs.cadence(id, f)`, `obs.fmt`, `obs.date`, `obs.RULES`, `obs.nicheLabel`), `vpdText` (Tarefa 1).
- Produz, em `C/_canal/header-model.ts`:
  ```ts
  /** Uma célula de número. `value` null = sem dado: a tela mostra `missing` em .obs-ch-nm. `base` é o texto do ⓘ e nunca é vazio. */
  export interface NumCell { key: string; value: string | null; missing: string | null; label: string; n: string | null; base: string }
  export interface CanalHeaderView {
    id: string; name: string; fullName: string; avatar: string | null; ini: string; color: string; lang: string
    niche: string | null; nicheLabel: string | null; handle: string | null; url: string
    faixa: NumCell[]      // 6, nesta ordem: subs, growth30, ritmo, vpd, engajamento, acima2x
    todos: NumCell[]      // 12, na ordem do spec 5.3
    sync: { tone: 'ok' | 'warn' | 'danger'; text: string; banner: string | null }
    counts: { total: number; tracked: number; pinnedOld: number; older: number; undated: number }
    /** A linha de resultado à direita das abas: "133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado." */
    result: string
    backfill: { done: number; total: number } | null
  }
  export function buildCanalHeader(obs: Observatory, channelId: string): CanalHeaderView | null   // null = canal não está no conjunto
  ```
- Produz, em `T/canal-fixture.ts`: `export function canalWorld(mut?: (ds: Dataset, chId: string) => void): { obs: Observatory; chId: string; ds: Dataset }`. Parte de `datasetFromOracle(loadOracle())` (`T/oracle.ts`), escolhe o concorrente `matt-wolfe`, aplica `mut` numa cópia (`plain` de `T/fase4-world.ts`) e devolve `createTestObservatory(ds)`. As tarefas 2, 3 e 5 usam este mundo: os casos de dado ausente são mutações de um vídeo real do oráculo, nunca um vídeo montado do zero.

- [ ] **Passo 1: testes que falham** (`T/canal-header-model.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'

describe('cabeçalho do canal', () => {
  it('seis células na faixa, doze em "Todos os números", na ordem do spec', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    expect(h.faixa.map(c => c.key)).toEqual(['subs', 'growth30', 'ritmo', 'vpd', 'engajamento', 'acima2x'])
    expect(h.todos.map(c => c.key)).toEqual(['trocas30', 'vpdPorMil', 'vpdShorts', 'engShorts', 'multTipico', 'maiorMult', 'ultimoVideo', 'habito', 'duracaoMediana', 'viewsSomadas', 'medianaViews', 'tema'])
  })
  it('todo número tem base escrita: o ⓘ nunca abre vazio', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    for (const c of [...h.faixa, ...h.todos]) expect(c.base.trim().length, c.key).toBeGreaterThan(0)
  })
  it('célula sem dado tem frase, nunca zero nem traço', () => {
    const { obs, chId } = canalWorld()
    for (const c of [...buildCanalHeader(obs, chId)!.faixa, ...buildCanalHeader(obs, chId)!.todos]) {
      if (c.value == null) expect(c.missing, c.key).toBeTruthy()
      else { expect(c.value).not.toBe('—'); expect(c.missing).toBeNull() }
    }
  })
  it('os números batem com o painel de Canais de hoje para o mesmo canal', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    const S = obs.channelStats(chId, 'long')
    const drawer = buildCanaisView(obs, { niche: 'todos', nicheExplicit: false, limit: 75, channel: chId, scale: 'abs' }).drawer!
    const stat = (label: RegExp) => drawer.stats.find(s => label.test(s.label))!.value
    expect(h.faixa.find(c => c.key === 'ritmo')!.value).toBe(stat(/^Ritmo/))
    expect(h.faixa.find(c => c.key === 'engajamento')!.value ?? '—').toBe(stat(/^Engajamento/))
    if (S.vpdMedian != null) expect(h.faixa.find(c => c.key === 'vpd')!.value).not.toBeNull()
    expect(h.todos.find(c => c.key === 'trocas30')!.value).toBe(String(S.changes30))
  })
  it('sem longo em 90 dias: "nenhum longo em 90 dias" no engajamento', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id || v.fmt !== 'long' || v.ageDays > 90) })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'engajamento')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('nenhum longo em 90 dias')
  })
  it('base com menos de 3 vídeos mostra "n = 2"', () => {
    const { obs, chId } = canalWorld((ds, id) => {
      const longs = ds.videos.filter(v => v.ch === id && v.fmt === 'long' && v.tracked)
      const keep = new Set(longs.slice(0, 2).map(v => v.id))
      ds.videos = ds.videos.filter(v => v.ch !== id || v.fmt !== 'long' || keep.has(v.id))
    })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'vpd')!
    if (c.value != null) expect(c.n).toMatch(/^n = [12]$/)
  })
  it('sem duas contagens de inscritos com 30 dias entre elas: "sem contagem de 30 dias atrás"', () => {
    const { obs, chId } = canalWorld((ds, id) => { const c = ds.channels.find(x => x.id === id)!; c.snapshots = c.snapshots.slice(-1) })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'growth30')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('sem contagem de 30 dias atrás')
  })
  it('inscritos ocultos pelo canal: frase, não zero', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.channels.find(x => x.id === id)!.subs = null })
    const c = buildCanalHeader(obs, chId)!.faixa.find(x => x.key === 'subs')!
    expect(c.value).toBeNull(); expect(c.missing).toBe('inscritos ocultos pelo canal')
  })
  it('sem tema: "sem tema ainda"', () => {
    const { obs, chId } = canalWorld((ds, id) => { ds.videos.forEach(v => { if (v.ch === id) v.theme = null }) })
    expect(buildCanalHeader(obs, chId)!.todos.find(x => x.key === 'tema')!.missing).toBe('sem tema ainda')
  })
  it('a linha 3 soma certo: acompanhados + fixados antigos + mais antigos + sem data = total', () => {
    const { obs, chId } = canalWorld(), k = buildCanalHeader(obs, chId)!.counts
    expect(k.tracked + k.pinnedOld + k.older + k.undated).toBe(k.total)
  })
  it('partes que valem zero somem da frase de sincronização', () => {
    const { obs, chId } = canalWorld(), h = buildCanalHeader(obs, chId)!
    if (h.counts.pinnedOld === 0) expect(h.sync.text).not.toMatch(/fixado/)
    expect(h.sync.text).toMatch(/^Sincronizado há /)
  })
  it('sincronização atrasada e com erro mudam o tom e abrem a faixa', () => {
    const late = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'atrasado' })
    const hl = buildCanalHeader(late.obs, late.chId)!
    expect(hl.sync.tone).toBe('warn'); expect(hl.sync.text).toMatch(/^Sincronização atrasada: a última foi /); expect(hl.sync.banner).toMatch(/^Atenção: dados de /)
    const err = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'erro'; s.msg = 'quota'; s.errorSince = ds.now - 36e5 })
    const he = buildCanalHeader(err.obs, err.chId)!
    expect(he.sync.tone).toBe('danger'); expect(he.sync.banner).toMatch(/^Erro: a última sincronização falhou em /)
  })
  it('canal em backfill: faixa "Sincronizando: N de M vídeos" e nenhuma célula com número', () => {
    const { obs, chId } = canalWorld((ds, id) => { const s = ds.channels.find(x => x.id === id)!.sync; s.state = 'backfill'; s.backfill = { done: 12, total: 48 } })
    const h = buildCanalHeader(obs, chId)!
    expect(h.backfill).toEqual({ done: 12, total: 48 })
    expect(h.sync.banner).toBe('Sincronizando: 12 de 48 vídeos. Os números aparecem quando a sincronização terminar.')
    for (const c of h.faixa.filter(x => x.key !== 'subs')) expect(c.value, c.key).toBeNull()
  })
  it('canal fora do conjunto: null', () => { expect(buildCanalHeader(canalWorld().obs, 'nao-existe')).toBeNull() })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/observatorio/canal-header-model.test.ts > $SCRATCH/t2.txt 2>&1`. Esperado: módulo inexistente. Se algum teste falhar por causa do **oráculo** (o canal `matt-wolfe` não ter o dado que a mutação supõe), escolha no `canal-fixture.ts` outro concorrente do oráculo que tenha longos acompanhados, Shorts e ao menos uma troca em 30 dias, e registre no ledger qual foi.

- [ ] **Passo 3: implementar `buildCanalHeader`**

Origem de cada célula (spec 5.3), sempre de `obs`, nunca recalculada à mão quando o motor já tem:

| key | value | missing | base (ⓘ) |
|---|---|---|---|
| `subs` | `F.subs(ch.subs)` | "inscritos ocultos pelo canal" | "arredondado pelo YouTube a 3 algarismos" |
| `growth30` | `≈ 0` se `g.withinRounding`; senão `±X,X%` de `g.pct` | "sem contagem de 30 dias atrás" quando `g.pending` | "de {from} em {dd/mm} para {to} em {dd/mm}" + `g.roundingText` |
| `ritmo` | `F.dec1(kl.pw) + ' + ' + F.dec1(ks.pw)` | — | "longos + Shorts por semana, média de 13 semanas ({kl.n} longos, {ks.n} Shorts)" |
| `vpd` | `vpdText(S.vpdMedian, F.num)`; `n` = "n = N" se `S.vpdN < RULES.weakBase` | "sem contagem diária ainda" | "mediana em {S.vpdN} longos acompanhados, {S.vpdWindow}" |
| `engajamento` | `F.dec1(median*100) + '%'`; `n` idem | "nenhum longo em 90 dias" | "(curtidas + comentários) ÷ views, mediana em {n} longos de até 90 dias" |
| `acima2x` | `String(S.outliers90)` (zero medido é "0") | — | "{S.outliers90} de {S.pctOutliersN} longos de até 90 dias com múltiplo de 2× ou mais" |
| `trocas30` | `String(S.changes30)` | — | "título e thumbnail, últimos 30 dias" (conta só `type` `title` e `thumb`; ver Tarefa 5) |
| `vpdPorMil` | `F.dec1(S.perMilSubs)` | a mesma do `vpd`, ou "inscritos ocultos pelo canal" | "views/dia nos longos ÷ milhares de inscritos" |
| `vpdShorts`, `engShorts` | como `vpd` e `engajamento`, com `channelStats(id, 'short')` | "nenhum Short acompanhado" / "nenhum Short em 90 dias" | idem, com "Shorts" |
| `multTipico` | `F.mult(S.typicalMult)` | "sem base: nenhum longo com múltiplo em 90 dias" | "mediana do múltiplo em {S.typicalMultN} longos de até 90 dias" |
| `maiorMult` | `S.bestOutlier ? rótulo do múltiplo : S.maxMultBelowMin?.label` | "sem base" | o título do vídeo |
| `ultimoVideo` | `kl.lastUploadAgo` (o mais recente entre longo e Short) | "nenhum vídeo guardado" | a data em São Paulo |
| `habito` | "terça às 18:00" se `habit.costuma` | `habit.text` ("horário variado (n = 2)", "nenhum vídeo em 13 semanas") | "{n} de {total} longos em 13 semanas" |
| `duracaoMediana` | mm:ss da mediana de `dur` dos longos acompanhados com `dur != null` | "sem duração nos longos" | "mediana em N longos acompanhados" |
| `viewsSomadas` | `F.num(soma de views dos acompanhados com views != null)` | "sem contagem" | "soma de N vídeos acompanhados; M sem contagem ficam fora" |
| `medianaViews` | "X longos · Y Shorts" (`obs.median`) | "sem contagem" | "N longos e M Shorts acompanhados" |
| `tema` | tema mais frequente entre os longos de até 90 dias com `theme`, se `count ≥ RULES.theme.minCount` e `share ≥ RULES.theme.minShare` | "sem tema ainda" | "{count} de {total} longos de até 90 dias" |

`counts`: `total` = vídeos do canal em `obs.videos` + `ch.undated.length`; `tracked` = `tracked === true`; `pinnedOld` = `pinned === true && !tracked`; `older` = `!tracked && !pinned`; `undated` = `ch.undated.length`.
`sync.text` (ok): "Sincronizado há 4 h (07/10 18:03) · 133 vídeos: 50 acompanhados, 1 fixado antigo, 82 mais antigos sem contagem diária", com plural certo ("2 fixados antigos") e as partes zeradas fora; `sem data` entra como "2 sem data de publicação". Atrasado: "Sincronização atrasada: a última foi {dd/mm hh:mm} · …" e `banner` "Atenção: dados de {dd/mm hh:mm}. A sincronização está atrasada.". Erro: "Erro: …" e `banner` "Erro: a última sincronização falhou em {dd/mm hh:mm}. Os números são de {dd/mm}." (com `sync.last` nulo, a segunda frase vira "Este canal nunca sincronizou com sucesso."). Backfill: todas as células menos `subs` com `value: null` e `missing: 'quando a sincronização terminar'`.
`result`: "133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado." (`isShort === null` conta em "formato não confirmado" e sai de longos e de Shorts; partes zeradas somem).

- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal do concorrente: modelo do cabecalho com faixa de numeros e sincronizacao`.

---

### Tarefa 3: modelo dos vídeos, filtro, ordenação, busca e "Carregar mais" (funções puras)

**Arquivos:**
- Criar: `C/_canal/videos-model.ts`, `C/_canal/lista.ts`
- Teste: `T/canal-videos-model.test.ts`, `T/canal-lista.test.ts`

**Interfaces:**
- Consome: `canalWorld` (Tarefa 2), `vpdText`, `CanalState`, `LOTE` (Tarefa 1), `obs.multiplier(id)`, `obs.multiplierCard(id)`, `obs.changesIn({ days: 30, video })`, `pinViewOf` (`C/_chrome/pin-view.ts`), `obs.link.historico`.
- Produz, em `C/_canal/videos-model.ts`:
  ```ts
  export type Grupo = 'acompanhado' | 'fixado-antigo' | 'antigo' | 'sem-data'
  export interface ChannelVideoView {
    id: string; ytId: string; title: string; url: string; grupo: Grupo
    // brutos, para filtrar e ordenar no navegador
    pub: number | null; views: number | null; vpd7: number | null; mult: number | null
    isShort: boolean | null; pinned: boolean; tracked: boolean; dur: number | null; likes: number | null; comments: number | null; swaps: number
    // prontos para a tela
    thumbSrc: string | null; durText: string | null; ageText: string | null; pubISO: string | null; pubTitle: string | null
    viewsText: string | null; viewsMissing: string | null          // "sem contagem: <motivo>"
    vpdText: string | null; multText: string | null; multTier: 'mid' | 'high' | 'top' | null; multWord: string | null
    /** Quando faltam views/dia E múltiplo: a frase única que ocupa as duas colunas. null = há pelo menos um dos dois. */
    semMedida: string | null
    likesText: string | null; commentsText: string | null
    badges: string[]                                               // "fixado", "sem duração", "formato não confirmado", "sem data", "2 trocas"
    /** Topo do menu "Ações do vídeo": a base do múltiplo e o motivo de cada "não medido" do cartão. */
    notas: string[]
    pin: PinView | null
  }
  export interface CanalVideosView { videos: ChannelVideoView[]; nota: string; semVideos: string | null }
  export function buildCanalVideos(obs: Observatory, channelId: string): CanalVideosView
  ```
- Produz, em `C/_canal/lista.ts` (sem React, sem `obs`):
  ```ts
  export interface Divisor { key: string; label: string; count: number }
  export interface Secao { divisor: Divisor | null; itens: ChannelVideoView[] }
  export interface ListaView {
    secoes: Secao[]; visiveis: string[]                 // ids na ordem da tela (para ids= do Histórico)
    counts: { todos: number; longos: number; shorts: number; fixados: number; naoConfirmado: number }
    resultado: string                                   // linha de resultado / anúncio do status
    vazio: { text: string; acao: 'limpar-busca' | 'buscar-em-todos' | null } | null
    mais: { mostrando: number; total: number; proximo: number; faltam: number; frase: string; botao: string; soAntigos: string | null } | null
  }
  export function norm(s: string): string               // minúsculas, sem acento
  export function montarLista(all: readonly ChannelVideoView[], s: Pick<CanalState, 'fmt' | 'sort' | 'dir' | 'q' | 'n'>): ListaView
  ```

- [ ] **Passo 1: testes que falham**

`T/canal-videos-model.test.ts` — um vídeo por caso de dado ausente do spec 5.9, cada um por mutação de um vídeo real do oráculo, afirmando o nulo e a frase:
```ts
import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'

const first = (ds: import('@/lib/youtube/observatorio').Dataset, id: string) => ds.videos.find(v => v.ch === id && v.tracked)!
const view = (mut: Parameters<typeof canalWorld>[0], pick?: (ds: import('@/lib/youtube/observatorio').Dataset, id: string) => string) => {
  let alvo = ''
  const w = canalWorld((ds, id) => { alvo = pick ? pick(ds, id) : first(ds, id).id; mut!(ds, id) })
  return buildCanalVideos(w.obs, w.chId).videos.find(v => v.id === alvo)!
}

describe('vídeos do canal: dado ausente (spec 5.9)', () => {
  it('comentários nulos: "não medido", com o motivo no menu', () => {
    const v = view((ds, id) => { first(ds, id).comments = null })
    expect(v.comments).toBeNull(); expect(v.commentsText).toBeNull()
    expect(v.notas).toContain('Comentários: o YouTube não devolveu a contagem.')
  })
  it('curtidas nulas: sem texto', () => { expect(view((ds, id) => { first(ds, id).likes = null }).likesText).toBeNull() })
  it('marca de Short nula: selo "formato não confirmado"', () => {
    const v = view((ds, id) => { first(ds, id).isShort = null })
    expect(v.isShort).toBeNull(); expect(v.badges).toContain('formato não confirmado')
  })
  it('duração nula: selo "sem duração"', () => {
    const v = view((ds, id) => { first(ds, id).dur = null })
    expect(v.durText).toBeNull(); expect(v.badges).toContain('sem duração')
  })
  it('views nulas: "sem contagem: <motivo>" e nada de views/dia', () => {
    const v = view((ds, id) => { const x = first(ds, id); x.views = null; x.series = []; x.firstIdx = null })
    expect(v.views).toBeNull(); expect(v.viewsText).toBeNull(); expect(v.viewsMissing).toMatch(/^sem contagem: /); expect(v.vpdText).toBeNull()
  })
  it('vídeo fora dos acompanhados: grupo "antigo" e a frase única', () => {
    const v = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.series = []; x.firstIdx = null })
    expect(v.grupo).toBe('antigo'); expect(v.semMedida).toBe('views/dia e múltiplo: não medido')
    expect(v.notas.join(' ')).toMatch(/Este vídeo está fora dos \d+ acompanhados, então não há contagem diária dele\./)
  })
  it('fixado fora dos recentes: grupo "fixado-antigo" e a frase dele', () => {
    const v = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'ativo'; x.series = []; x.firstIdx = null })
    expect(v.grupo).toBe('fixado-antigo'); expect(v.semMedida).toBe('fixado antigo: sem views/dia nem múltiplo'); expect(v.badges).toContain('fixado')
  })
  it('fixado ainda não conferido e fixado sem resposta: a frase de cada estado', () => {
    const a = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'aguardando-primeira' })
    expect(a.notas).toContain('Fixado: aguardando a primeira sincronização.')
    const b = view((ds, id) => { const x = first(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'sem-resposta' })
    expect(b.notas).toContain('Fixado: o YouTube não devolveu este vídeo.')
  })
  it('vídeo sem data entra no fim, sem idade nem múltiplo, com selo', () => {
    const w = canalWorld((ds, id) => { ds.channels.find(c => c.id === id)!.undated.push({ id: 'u1', ytId: 'yt-u1', title: null, url: 'https://youtu.be/yt-u1', isShort: null, dur: null, views: null, likes: null, comments: null, pinned: false, checkedAt: null }) })
    const v = buildCanalVideos(w.obs, w.chId).videos.find(x => x.id === 'u1')!
    expect(v.grupo).toBe('sem-data'); expect(v.pub).toBeNull(); expect(v.ageText).toBeNull(); expect(v.mult).toBeNull()
    expect(v.title).toBe('sem título'); expect(v.badges).toEqual(expect.arrayContaining(['sem data']))
  })
  it('zero medido de views por dia é "0", diferente de não medido', () => {
    const w = canalWorld(), vs = buildCanalVideos(w.obs, w.chId).videos
    for (const v of vs) { if (v.vpd7 === 0) expect(v.vpdText).toBe('0'); if (v.vpd7 == null) expect(v.vpdText).toBeNull() }
  })
  it('o múltiplo é o do motor, o mesmo do Histórico', () => {
    const w = canalWorld(), vs = buildCanalVideos(w.obs, w.chId).videos.filter(v => v.mult != null)
    expect(vs.length).toBeGreaterThan(0)
    for (const v of vs) expect(v.mult).toBe(w.obs.multiplier(v.id).value)
  })
  it('nível do múltiplo por escrito: alto, muito alto, topo; abaixo de 2, sem palavra', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) {
      if (v.mult == null) { expect(v.multWord).toBeNull(); continue }
      expect(v.multWord).toBe(v.mult >= 10 ? 'topo' : v.mult >= 5 ? 'muito alto' : v.mult >= 2 ? 'alto' : null)
    }
  })
  it('base fraca aparece nas notas ("n = 2"); sem base nenhuma: "sem comparação"', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) {
      const m = w.obs.multiplier(v.id)
      if (m.value != null && m.weak) expect(v.notas.join(' ')).toMatch(/base fraca \(n = \d\)/)
      if (m.value == null && v.grupo === 'acompanhado' && v.pub != null) expect(v.notas.join(' ')).toMatch(/sem comparação: nenhum vídeo do canal na mesma faixa de idade/)
    }
  })
  it('swaps conta só título e thumbnail dos últimos 30 dias', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) {
      const n = w.obs.changesIn({ days: 30, video: v.id }).filter(c => c.type !== 'desc').length
      expect(v.swaps).toBe(n)
      if (n) expect(v.badges).toContain(n === 1 ? '1 troca' : `${n} trocas`)
    }
  })
  it('thumbSrc: o blob da versão atual quando existe; senão mqdefault; sem ytId, null', () => {
    const w = canalWorld()
    for (const v of buildCanalVideos(w.obs, w.chId).videos) expect(v.thumbSrc === null || /^https:\/\//.test(v.thumbSrc)).toBe(true)
  })
  it('canal sem vídeos: a frase do spec', () => {
    const w = canalWorld((ds, id) => { ds.videos = ds.videos.filter(v => v.ch !== id) })
    expect(buildCanalVideos(w.obs, w.chId).semVideos).toBe('Este canal ainda não tem vídeos sincronizados.')
  })
  it('3.000 vídeos antigos cabem em 1,2 MB de JSON (teto da decisão D2)', () => {
    const w = canalWorld((ds, id) => {
      const base = first(ds, id)
      for (let i = 0; i < 3000; i++) ds.videos.push({ ...base, id: 'old-' + i, ytId: 'yt-old-' + i, tracked: false, pinned: false, pub: base.pub - (400 + i) * 864e5, ageDays: base.ageDays + 400 + i, series: [], firstIdx: null, titles: base.titles.slice(-1), thumbs: base.thumbs.slice(-1), descs: [] })
    })
    const t0 = performance.now(), out = buildCanalVideos(w.obs, w.chId), ms = performance.now() - t0
    expect(JSON.stringify(out.videos.filter(v => v.grupo === 'antigo')).length).toBeLessThan(1_200_000)
    console.log(`buildCanalVideos com 3.000 antigos: ${Math.round(ms)} ms`)   // registrar no ledger
  })
})
```
`T/canal-lista.test.ts` — sobre vídeos montados à mão (a função é pura; um construtor `vid(over)` no topo do teste preenche um `ChannelVideoView` válido):
```ts
describe('lista do canal', () => {
  it('abre só com acompanhados, fixados e sem data; antigos só entram por n', () => { /* 3 acompanhados + 1 fixado-antigo + 90 antigos + 2 sem-data, n=0 → 6 visíveis; n=40 → 46; n=80 → 86; n=120 → 96 */ })
  it('"Longos + Shorts + formato não confirmado = Todos"', () => { /* counts.longos + counts.shorts + counts.naoConfirmado === counts.todos */ })
  it('isShort nulo conta em Todos e fica fora de Longos e de Shorts', () => {})
  it('fmt=fixados mostra só fixados, de qualquer grupo', () => {})
  it('ordem das seções: acompanhados e fixados antigos, depois o divisor da ordenação, "Sem data de publicação (N)", "Mais antigos, sem contagem diária (N)"', () => {})
  it('antigos ficam sempre abaixo dos acompanhados, em qualquer ordenação', () => {})
  it('ordenação "vistos": quem não tem views vai para "Sem contagem de views (N)"', () => {})
  it('ordenação "multiplo" e "vpd": quem não tem o número vai para "Sem múltiplo ainda (N)" / "Sem views por dia ainda (N)"', () => {})
  it('ordenação sem nenhum valor: todos sob o divisor, grade nunca vazia', () => { /* todos mult null, sort=multiplo → secoes com 1 divisor "Sem múltiplo ainda (5)" e 5 itens; vazio === null */ })
  it('dir=asc inverte só quem tem valor; os divisores ficam no fim', () => {})
  it('empate mantém a ordem por data, mais recente primeiro (ordenação estável)', () => {})
  it('busca ignora acento e caixa', () => { /* q "sao joao" acha "São João na Paraíba" */ })
  it('busca com caracteres especiais não quebra', () => { /* q "<b>", "(", "[", "\\", "東京": não lança; "東京" acha o título com 東京 */ })
  it('busca vazia dentro de um filtro oferece "Buscar em Todos" com a contagem', () => { /* fmt=shorts, q casa 2 longos → vazio.text "Nenhum Short com “lisboa”. Há 2 em Todos.", acao 'buscar-em-todos' */ })
  it('filtros sem resultado: as frases do spec', () => { /* "Nenhum Short neste canal." / "Nenhum vídeo longo neste canal." / "Nenhum vídeo fixado. Fixe um vídeo para acompanhá-lo mesmo quando sair dos mais recentes." / "Nenhum vídeo com “x”." + acao 'limpar-busca' */ })
  it('busca que só casa antigos não carregados: a frase com a contagem e o bloco aparece', () => { /* mais.soAntigos === 'Nenhum dos vídeos acompanhados tem “japão”. Há 3 vídeos antigos, sem contagem diária.' */ })
  it('bloco "Carregar mais": frases e rótulo do botão em cada ponta', () => {
    /* 51 de 133, 82 antigos, n=0: frase "Mais 40 vídeos antigos, sem contagem diária. Depois deste lote faltam 42.", botao "Carregar mais 40 vídeos"
       n=40: "…Depois deste lote faltam 2." ; n=80, restam 2: botao "Carregar os últimos 2 vídeos", frase "…Depois deste lote não falta nenhum."
       resta 1: botao "Carregar o último vídeo"; n cobre todos: mais === null */
  })
  it('os divisores contam só o que está na tela; os antigos não carregados entram só na frase do bloco', () => {})
  it('resultado: "133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado." e, com busca, "5 vídeos com “lisboa”"', () => {})
  it('visiveis traz os ids na ordem da tela, antigos carregados inclusive', () => {})
})
```
Cada `it` acima é escrito por inteiro pelo implementador com os números do comentário; nenhum fica vazio. O revisor da tarefa reprova `it` sem `expect`.

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar**

`buildCanalVideos`: para cada vídeo do canal em `obs.videos` (ordem: `pub` decrescente) e depois cada `ch.undated`:
- `grupo`: `tracked` → `acompanhado`; `pinned && !tracked` → `fixado-antigo`; sem data → `sem-data`; o resto → `antigo`.
- `vpd7` e `mult` vêm do vídeo derivado do motor (`obs.video(id)!.vpd7`, `obs.multiplier(id).value`); nunca recalcular.
- `viewsMissing`: a mesma regra de `viewsTxt` em `C/_canais/view-model.ts:219-225` ("sem contagem: sincronização do canal com erro desde…", "…atrasada desde…", "sem registro diário ainda"). **Extraia** essa função para `C/_chrome/views-text.ts` e faça `_canais/view-model.ts` importá-la, para as duas telas dizerem a mesma frase; `T/canais-view-model.test.ts` continua verde sem mudança.
- `semMedida`: `fixado-antigo` → "fixado antigo: sem views/dia nem múltiplo"; `vpd7 == null && mult == null` nos demais → "views/dia e múltiplo: não medido"; senão `null`.
- `notas`: nesta ordem, só as que valem — a base do múltiplo (`obs.multiplierCard(id)`: "contra os longos do canal com 91 a 365 dias, n = 18"; com `weak`, acrescenta "base fraca (n = 2)"; sem valor em vídeo acompanhado com data, "sem comparação: nenhum vídeo do canal na mesma faixa de idade"); "Comentários: o YouTube não devolveu a contagem."; "Este vídeo está fora dos {video_limit} acompanhados, então não há contagem diária dele."; para antigo e fixado antigo com `viewsAt`, "Views contadas em {dd/mm/aaaa}."; "Fixado: aguardando a primeira sincronização." / "Fixado: o YouTube não devolveu este vídeo."; "sem data de publicação: sem idade nem múltiplo".
- `thumbSrc`: `blobUrl` da versão de thumbnail `current`, senão `https://i.ytimg.com/vi/<ytId>/mqdefault.jpg`, senão `null`.
- `nota` (fixa sob a grade): "Múltiplo = views do vídeo ÷ mediana dos outros vídeos do mesmo formato e da mesma faixa de idade do canal. De 2 a 5, alto; de 5 a 10, muito alto; 10 ou mais, topo. Views por dia = média entre a primeira e a última contagem diária dos últimos 7 dias; a contagem diária existe desde {obs.SERIES_START_LABEL} e só para os vídeos acompanhados."
- Vídeo antigo vai enxuto: os campos de `ChannelVideoView` acima e nada mais (o tipo não carrega série nem versões).

`montarLista`: filtra por `fmt` (`longos`: `isShort === false`; `shorts`: `isShort === true`; `fixados`: `pinned`), depois por `q` com `norm(title).includes(norm(q))` (nunca `RegExp` montada do texto); separa por grupo; ordena `acompanhado` + `fixado-antigo` pela chave (`recentes`: `pub`; `vistos`: `views`; `multiplo`: `mult`; `vpd`: `vpd7`), com os de chave nula no divisor próprio; `sem-data` no divisor "Sem data de publicação (N)"; os antigos, ordenados por `pub` decrescente, cortados em `n`, sob "Mais antigos, sem contagem diária (N)" (N = todos os antigos que casam com filtro e busca), só quando `n > 0` ou a busca só casa antigos. `norm` = `s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()`.

- [ ] **Passo 4: rodar e ver passar**, mais `tsc` e `T/canais-view-model.test.ts` (por causa da extração de `viewsTxt`).
- [ ] **Passo 5: commit** — `feat: canal do concorrente: modelo dos videos, filtro, ordenacao, busca e carregar mais`. Registrar no ledger os ms do teste dos 3.000 antigos.

---

### Tarefa 4: rota `canal/[id]`, moldura só com a trilha, cabeçalho na tela

**Arquivos:**
- Criar: `C/canal/[id]/page.tsx`, `C/canal/[id]/loading.tsx`, `C/_chrome/trail-chrome.tsx`, `C/_canal/canal.css`, `C/_canal/canal-screen.tsx`, `C/_canal/canal-header.tsx`, `C/_canal/view-model.ts`
- Modificar: `C/_chrome/page-data.ts` (acrescentar `openChannelPage`), `C/_chrome/kit.css` (cópia das regras do diálogo de remoção, D11), `T/kit-css.test.ts`
- Teste: `T/canal-page-data.test.ts`, `T/canal-header.test.tsx`, `T/trail-chrome.test.tsx`

**Interfaces:**
- Consome: `loadChannelDataset(siteId, channelId, now)` (`L/load-page.ts`), `buildCanalHeader`, `buildCanalVideos`, `parseCanalState`, `Popover` (`C/_chrome/flut/flut.tsx`), `ChannelAvatar`, `ToastProvider`/`useToast`, `RemoveDialog`, as actions `syncCompetitorNow`, `removeCompetitorChannel`, `getCompetitorRemovalImpactAction`, `setChannelNiche`, `pinVideo`, `unpinVideo`.
- Produz:
  ```ts
  // C/_chrome/page-data.ts
  export interface ChannelPage { siteId: string; now: number; obs: Observatory | null; canEdit: boolean }
  /** Guarda de acesso PRIMEIRO; depois o conjunto de um canal. obs null = o id não é um canal deste site. */
  export async function openChannelPage(channelId: string): Promise<ChannelPage>
  // C/_canal/view-model.ts
  export interface CanalView { header: CanalHeaderView; videos: CanalVideosView; trocas: CanalTrocasView | null; state: CanalState; own: boolean; canaisHref: string }
  export function buildCanalView(obs: Observatory, channelId: string, sp: Record<string, string | undefined>): CanalView | null
  // C/_chrome/trail-chrome.tsx ('use client')
  export interface Crumb { text: string; href?: string }
  export function TrailChrome({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }): JSX.Element
  // C/_canal/canal-screen.tsx ('use client')
  export interface CanalActions { onSyncOne: typeof syncCompetitorNow; onRemove: typeof removeCompetitorChannel; onRemovalImpact: typeof getCompetitorRemovalImpactAction; onSetNiche: typeof setChannelNiche; onPin: PinAction; onUnpin: PinAction }
  export function CanalScreen({ view, niches, canAdmin, leitura, actions }: { view: CanalView; niches: NicheOption[]; canAdmin: boolean; leitura: ReactNode | null; actions: CanalActions }): JSX.Element
  ```
  `CanalTrocasView` nasce na Tarefa 7; nesta tarefa o campo é `trocas: null` e o tipo é declarado em `view-model.ts` como `export type CanalTrocasView = never` até lá.

- [ ] **Passo 1: conferir o que este plano não abriu.** Rode e anote no relatório: `grep -n "NicheSelect" -r "apps/web/src/app/cms/(authed)/youtube/competitors/_canais"` (o componente de nicho e as props dele); `grep -n "data-obs-screen=\"canais\"\] \.\(modal\|dlg\|confirm\)" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css"` (as regras do diálogo de remoção); `sed -n '1,60p' "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/toasts.tsx"`. Se `NicheSelect` depender de estado da tela de Canais que não dá para passar por props, o nicho no cabeçalho vira **só leitura** nesta fase e isso vai ao ledger como pendência para o dono.

- [ ] **Passo 2: testes que falham**

`T/canal-page-data.test.ts` (ambiente node; mesmo padrão de mocks de `T/page-data.test.ts`, que o implementador lê antes):
```ts
it('acesso negado: redireciona e NÃO lê o canal', async () => { /* requireSiteScope → { ok: false, reason: 'unauthenticated' }; espera redirect('/cms/login') e loadChannelDataset com 0 chamadas */ })
it('id de outro site ou inventado: obs null, sem leitura pesada', async () => { /* loadChannelDataset → null; openChannelPage devolve obs null; nenhum throw; Sentry.captureException com 0 chamadas */ })
it('canal do site: devolve o motor do conjunto de um canal', async () => { /* obs.channels.length === 1 */ })
it('siteId vem do contexto do site, nunca da URL', async () => { /* loadChannelDataset chamado com o siteId de getSiteContext */ })
```
`T/trail-chrome.test.tsx`: renderiza `TrailChrome` com `[{ text: 'Canais', href: '/cms/youtube/competitors' }, { text: 'Leo Khev' }]` e afirma: raiz com `data-obs`; `nav` com `aria-label="Caminho"`; o último item sem link e com `aria-current="page"`; **nenhum** `[data-obs-tabs]` nem barra de nicho; o texto "Horários em São Paulo".
`T/canal-header.test.tsx` (jsdom): com `canalWorld()` e `buildCanalView`:
```ts
it('h1 é o nome do canal', ...)
it('a faixa é um dl rotulado; no DOM o valor vem antes do rótulo', ...)        // dl[aria-label="Números do canal"] > div > dd + dt? Não: dt/dd na ordem valor, rótulo: <div><dd>84 mil</dd><dt>inscritos</dt></div>
it('célula sem dado mostra a frase na classe obs-ch-nm, nunca "0" nem "—"', ...)
it('"Todos os números" é botão com aria-expanded; aberto, mostra as 12 células e põe nums=1 na URL sem navegar', ...)
it('o ⓘ único abre um Popover em #flut com a base das 6 células; com "Todos os números" aberto, das 18', ...)
it('nenhum botão preenchido no cabeçalho', ...)                                   // nenhum .obs-ch-forja-solid nem botão com a classe de preenchido
it('"Abrir no YouTube" diz "abre em nova aba" no nome acessível', ...)
it('@ só aparece quando o canal tem handle', ...)
it('menu ⋯: "Sincronizar só este canal" sempre; "Remover canal…" só com canAdmin', ...)
it('"Sincronizar só este canal" chama onSyncOne com o id, avisa e desabilita enquanto roda', ...)
it('faixa de aviso de sincronização atrasada começa por "Atenção:" e a de erro por "Erro:"', ...)
it('"Comparar com o meu canal" não existe nesta fase (D4)', ...)
```

- [ ] **Passo 3: rodar e ver falhar.**

- [ ] **Passo 4: implementar**

`openChannelPage`: copia a guarda de `openObservatoryPage` (as mesmas duas saídas), depois `loadChannelDataset(siteId, channelId, now)`; `null` → `{ obs: null }`; senão `createObservatory(ds)`. `canEdit` = resultado de `requireSiteScope({ area: 'cms', siteId, mode: 'edit' }).ok`.

`C/canal/[id]/page.tsx` (Server Component, `dynamic = 'force-dynamic'`, `maxDuration = 60`, `metadata.title = 'Canal · Competidores'`):
```tsx
export default async function CanalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ObsSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = Array.isArray(v) ? v[0] : v
  const { obs, siteId } = await openChannelPage(id)
  const view = obs ? buildCanalView(obs, id, flat) : null
  if (!view) return (
    <TrailChrome crumbs={[{ text: 'Canais', href: link.canais() }, { text: 'Canal não encontrado' }]}>
      <CanalNotFound />
    </TrailChrome>
  )
  // Canal próprio continua no painel lateral até a A4 (emenda 26).
  if (view.own) redirect(link.canais({ channel: id }))
  const canAdmin = await canAdminSiteUsers(siteId)
  return (
    <TrailChrome crumbs={[{ text: 'Canais', href: view.canaisHref }, { text: view.header.name }]}>
      <CanalScreen view={view} niches={nicheOptions(obs!)} canAdmin={canAdmin} leitura={null}
        actions={{ onSyncOne: syncCompetitorNow, onRemove: removeCompetitorChannel, onRemovalImpact: getCompetitorRemovalImpactAction, onSetNiche: setChannelNiche, onPin: pinVideo, onUnpin: unpinVideo }} />
    </TrailChrome>
  )
}
```
`CanalNotFound` (em `canal-screen.tsx`): "Canal não encontrado. Ele pode ter sido removido." + link "Voltar para Canais". Status 200, sem `notFound()` e sem lançar.
`view.canaisHref`: `link.canais()` mais o `back` quando `from` veio de Outliers ou Mudanças (aí o primeiro item da trilha é a tela de origem: "Outliers" / "Mudanças", com `link.outliers()`/`link.mudancas()` + `back`).
`loading.tsx`: esqueleto do **miolo** na forma final (3 linhas de cabeçalho e 10 retângulos 16:9 em 5 colunas), com `aria-hidden="true"` e um `<span class="sr-only">Carregando…</span>`; aparece só depois de 100 ms (animação CSS com `animation-delay:100ms` e `opacity:0` inicial; sem `prefers-reduced-motion` não anima, só aparece).
`TrailChrome`: `<div data-obs="" className="obs-ch-root"><ToastProvider><div className="obs-ch-content"><div className="obs-tr-top"><nav className="crumbs" aria-label="Caminho"><ol>…</ol></nav><span className="obs-tr-tz">Horários em São Paulo</span></div><div className="obs-ch-screen">{children}</div></div></ToastProvider></div>`. O `Link` é importado dentro do próprio arquivo cliente.
`CanalHeader` segue `M/canal.html` e `M/faixa-numeros.js`: linha 1 (avatar, `h1` em Fraunces 22 px, `NicheSelect`, @ com link externo quando há, à direita "Abrir no YouTube" e o menu ⋯ por `Popover role="menu"`); a faixa `dl` de 6 células com fio vertical; a linha de sincronização com o ⓘ e "Todos os números" à direita; as 12 células abaixo dela quando abertas. Medidas do spec 5.3: nome → faixa 10 px; padding lateral das células 20 px (14 px em ≤ 600 px); faixa → sincronização 8 px; cabeçalho → abas 14 px; em 768 px a faixa quebra em 3 colunas, em 390 e 320 px em 2; **quebra, não rola**. `canal.css` tem todos os seletores sob `[data-obs-screen="canal"]`.
`nums` na URL: `window.history.replaceState(null, '', location.pathname + canalQuery(next))` (sem `router.push`: não navega, não recarrega o servidor).

- [ ] **Passo 5: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 6: commit** — `feat: canal do concorrente: rota canal/[id], moldura so com a trilha e cabecalho`.

---

### Tarefa 5: vista Capas, controles e "Carregar mais"

**Arquivos:**
- Criar: `C/_canal/controles.tsx`, `C/_canal/grade.tsx`, `C/_canal/video-card.tsx`, `C/_canal/video-menu.tsx`, `C/_canal/carregar-mais.tsx`, `C/_canal/use-canal-state.ts`
- Modificar: `C/_canal/canal-screen.tsx`, `C/_canal/canal.css`
- Teste: `T/canal-grade.test.tsx`, `T/canal-controles.test.tsx`, `T/canal-carregar-mais.test.tsx`

**Interfaces:**
- Consome: `montarLista`, `ChannelVideoView`, `CanalState`, `canalQuery`, `Thumb` e `MultBlock` (`C/_outliers/outlier-card.tsx`, props mínimas `ThumbData` e `MultData`), `PinProvider`/`PinButton` (`C/_chrome/pin-kit.tsx`), `Popover`.
- Produz: `export function useCanalState(initial: CanalState): [CanalState, (patch: Partial<CanalState>) => void]` (guarda o estado, aplica o `patch`, escreve a URL com `history.replaceState` e devolve o novo estado no mesmo render); `export function Grade({ lista, sort, hrefDe, onAmpliar }: …)`; `export function VideoCard(…)`; `export function CarregarMais({ mais, onMais }: …)`.

- [ ] **Passo 1: testes que falham** (jsdom; cada `it` com os `expect` escritos)

`T/canal-grade.test.tsx`:
```ts
it('Capas é ul/li; cada cartão tem exatamente 2 paradas de Tab: o link (thumbnail + título) e "Ações do vídeo: <título>"', ...)   // conta [tabindex="0"], a, button sem tabindex=-1 em 12 cartões: 24
it('a lupa do cartão tem tabindex=-1 e nome "Ampliar a thumbnail: <título>"', ...)
it('thumbnail tem alt="" e fica dentro do link com o título', ...)
it('os três números ficam sempre na ordem views, views por dia, múltiplo; a ordenação só muda qual tem a classe de destaque', ...)
it('no DOM o rótulo acompanha o valor ("84 mil views")', ...)
it('quando faltam views/dia e múltiplo, uma frase só ocupa as duas colunas, em obs-ch-nm', ...)
it('views nulas: "sem contagem: <motivo>" no lugar de views e de views/dia', ...)
it('os selos são texto, nunca controle', ...)                                       // nenhum button/a dentro de .cv-badges
it('título truncado tem o nome inteiro no nome acessível do link', ...)
it('divisores com contagem são h3 dentro da lista e não somem com filtro', ...)
it('link "Pular a lista de vídeos" antes da grade leva ao bloco depois dela', ...)
it('o href do cartão leva ao Histórico com from=canais, canal=<id>, back=<query do estado> e ids= da vizinhança (no máximo 100, em torno do vídeo)', ...)
it('menu "Ações do vídeo": padrão menu button (aria-haspopup, aria-expanded), abre em #flut, setas/Home/End, Esc devolve o foco', ...)
it('o topo do menu traz as notas do vídeo (base do múltiplo e motivos de "não medido")', ...)
it('itens do menu: "Fixar" ou "Desafixar", "Ampliar thumbnail", "Abrir no YouTube" (abre em nova aba), "Ver trocas"', ...)
it('"Ver trocas" troca para a aba Trocas com video=<id>, sem navegar', ...)
it('"Fixar" chama onPin e mostra o resultado pelo PinProvider; no limite, a mensagem do limite', ...)
it('nenhum controle some fora do hover: a lupa e o ⋯ estão no DOM e visíveis sem hover', ...)
```
`T/canal-controles.test.tsx`:
```ts
it('grupo "Formato": role=group, botões com aria-pressed e a contagem no nome ("Longos, 61")', ...)
it('"Ordenar" é select nativo com as quatro opções e os rótulos exatos', ...)
it('grupo "Vista": Capas (padrão) e Lista, com aria-pressed', ...)
it('busca: placeholder "Buscar por título"; botão "Limpar busca" só com texto; ignora acento', ...)
it('digitar "[" na busca não dispara atalho nenhum', ...)
it('cada troca de filtro atualiza a lista no mesmo render e escreve a URL sem navegar', ...)   // history.replaceState espiado; router.push com 0 chamadas
it('o status (role=status, aria-atomic) anuncia uma vez por mudança, 500 ms depois da última tecla, e nunca move o foco', ...)   // fake timers
it('ao trocar a vista o status diz "Vista Lista, 51 vídeos"', ...)
it('busca vazia dentro de um filtro mostra "Buscar em Todos" e o botão troca o filtro mantendo a busca', ...)
```
`T/canal-carregar-mais.test.tsx`:
```ts
it('o bloco tem role=progressbar com aria-valuenow e aria-valuemax, "Mostrando 51 de 133 vídeos" e a frase do que vem', ...)
it('o botão é o único preenchido da tela e tem 44 px de altura', ...)              // classe de preenchido presente 1 vez no documento
it('o clique revela 40 sob o divisor "Mais antigos, sem contagem diária (82)", com o aviso da contagem antiga', ...)
it('depois do clique o foco vai para o primeiro cartão novo, com preventScroll', ...)   // spy em HTMLElement.prototype.focus: chamado com { preventScroll: true }
it('o status anuncia "Mostrando 91 de 133 vídeos. 40 vídeos antigos carregados."', ...)
it('n vai para a URL (?n=40) sem navegar', ...)
it('no último lote o rótulo é "Carregar os últimos 2 vídeos" e depois o botão some', ...)
it('nada carrega sozinho: nenhum IntersectionObserver é criado', ...)               // vi.stubGlobal('IntersectionObserver', spy) e 0 chamadas
it('abrir já com ?n=80 mostra os 80 antigos sem clique (o Voltar reabre a grade igual)', ...)
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar.** Forma e medidas de `M/canal.html` e `M/canal.css`: grade de 5 colunas em 1440 px com `gap:14px` (4 em ≤ 1280, 3 em ≤ 1024, 2 em ≤ 768, 1 em ≤ 480), cartão de 224 × 247 px em 1440, todos da mesma altura; thumbnail 16:9; título em 13,5 px, 2 linhas (`.obs-ch-ttl` do kit); três colunas fixas de número com valor em cima (JetBrains Mono) e rótulo embaixo; lupa de 28 px (44 px sob `pointer:coarse` e em viewport ≤ 900 px); "Ações do vídeo" (⋯) sempre visível. Borda da busca e do seletor em `--dim`; contorno do segmento ativo em `--muted`. A linha de controles fica presa (`position:sticky; z-index:var(--z-grudado)`) só com largura ≥ 768 px **e** altura ≥ 600 px; um `ResizeObserver` escreve `--obs-sticky-h` na raiz da tela (0 fora dessa condição) e todo alvo de foco da grade tem `scroll-margin-top:calc(var(--obs-sticky-h) + 12px)`. O foco (`outline:2px solid var(--accent); outline-offset:2px`) nunca é cortado: o `overflow:hidden` fica só na thumbnail, não no cartão. "Ampliar thumbnail" (lupa e item do menu): na A1 abre a imagem em nova aba (`thumbSrc`); o visualizador é da A2 e troca só o destino.
`hrefDe(v)`: `link.historico(v.id, { from: 'canais', canal: channelId, back: canalQuery(state), ids: vizinhança })`, onde a vizinhança são até 100 ids de `lista.visiveis` centrados em `v`.

- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal do concorrente: vista Capas, controles e carregar mais`.

---

### Tarefa 6: vista Lista

**Arquivos:**
- Criar: `C/_canal/tabela.tsx`
- Modificar: `C/_canal/canal-screen.tsx`, `C/_canal/canal.css`
- Teste: `T/canal-tabela.test.tsx`

**Interfaces:**
- Consome: `ListaView`, `CanalState`, `useCanalState`, `VideoMenu` (Tarefa 5).
- Produz: `export function Tabela({ lista, state, set, hrefDe }: …)`.

- [ ] **Passo 1: testes que falham**
```ts
it('é uma table com th scope="col" para Vídeo, Publicado, Views, Views/dia, Múltiplo, Curtidas, Comentários, Trocas', ...)
it('as colunas ordenáveis têm um botão dentro do th; aria-sort só na coluna ativa', ...)
it('clicar no cabeçalho da coluna ativa inverte a direção; noutra coluna, ordena por ela em desc', ...)
it('o status anuncia "Ordenado por Views, decrescente"', ...)
it('Publicado ordena como "Mais recentes"; Curtidas, Comentários e Trocas não ordenam (sem botão)', ...)
it('comentário nulo mostra "não medido" em obs-ch-nm; zero medido mostra "0"', ...)
it('os divisores viram linhas de grupo (tr com th colspan) com a contagem', ...)
it('o bloco "Carregar mais" é o mesmo componente, depois da tabela', ...)
it('a linha tem 56 px e a thumbnail 96 px de largura', ...)                        // classes; a medida real é da Tarefa 10
it('abaixo de 820 px cada célula carrega o rótulo (data-label) para a pilha', ...)  // td[data-label="Views"]
it('o select "Ordenar" e o cabeçalho da coluna mostram o mesmo estado', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** Tabela de `M/canal.html` (vista Lista): linha de 56 px; abaixo de 820 px vira pilha por CSS (`display:block` nas células, rótulo por `::before` com `attr(data-label)`; duas colunas de blocos até 480 px, uma abaixo), sem rolagem horizontal da página. Mapeamento coluna → `CanalSort`: Publicado `recentes`, Views `vistos`, Views/dia `vpd`, Múltiplo `multiplo`.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal do concorrente: vista Lista`.

---

### Tarefa 7: aba Trocas

**Arquivos:**
- Criar: `C/_canal/trocas-model.ts`, `C/_canal/trocas.tsx`, `C/_chrome/effect-view.ts`
- Modificar: `C/_canal/view-model.ts` (o tipo `CanalTrocasView` de verdade), `C/_canal/canal-screen.tsx`, `C/_canal/canal.css`, `C/_canais/view-model.ts` (importa `effView` do arquivo novo)
- Teste: `T/canal-trocas-model.test.ts`, `T/canal-trocas.test.tsx`

**Interfaces:**
- Consome: `obs.changesIn({ days: 30, channel })`, `obs.effect(changeId)`, `obs.link.historico`, `obs.link.mudancas`, `canalWorld`.
- Produz:
  ```ts
  // C/_chrome/effect-view.ts — a função effView de C/_canais/view-model.ts:401-423, extraída sem mudar uma letra
  export function effView(obs: Observatory, e: EffectResult | null): EffectView | null
  /** A frase de uma linha da aba Trocas: "aguardando: 1 de 7 dias coletados, leitura em 13/10" etc. Mesmo motor do Histórico. */
  export function effLine(obs: Observatory, e: EffectResult | null): string
  // C/_canal/trocas-model.ts
  export interface TrocaView { id: string; campo: 'Título trocado' | 'Thumbnail trocada'; quando: string; quandoTitle: string; antes: { texto: string | null; thumb: string | null; semArquivo: boolean }; agora: { texto: string | null; thumb: string | null }; efeito: string; href: string; hrefLabel: string }
  export interface TrocaCard { videoId: string; title: string; thumbSrc: string | null; contagem: string; href: string; hrefLabel: string; trocas: TrocaView[] }
  export interface CanalTrocasView { tabCount: string; titulo: string; intro: string; cards: TrocaCard[]; vazio: string | null; total: number; mudancasLink: { href: string; text: string } | null }
  export function buildCanalTrocas(obs: Observatory, channelId: string): CanalTrocasView
  ```

- [ ] **Passo 1: testes que falham** (`T/canal-trocas-model.test.ts`)
```ts
it('conta só título e thumbnail dos últimos 30 dias; descrição fica fora', ...)     // total === changesIn(...).filter(c => c.type !== 'desc').length
it('a contagem da aba é "7 em 30 d" e o título da seção diz "Trocas de título e thumbnail nos últimos 30 dias"', ...)
it('um cartão por vídeo, mesmo com trocas não vizinhas no tempo: N vídeos com troca = N cartões', ...)
it('os cartões saem na ordem da troca mais recente de cada vídeo; dentro do cartão, da mais recente para a mais antiga', ...)
it('cartão com uma troca: o botão abre já nela (href com troca=) e não há link por troca', ...)
it('cartão com duas ou mais: o botão abre o histórico sem troca= e cada troca tem o seu link com troca=', ...)
it('nome acessível do botão: "Abrir histórico do vídeo: <título>"; do link: "Abrir o histórico do vídeo na troca de título de 28/09: <título>"', ...)
it('thumbnail anterior não arquivada: "imagem anterior não arquivada", nunca imagem inventada', ...)
it('a frase de efeito é a mesma do Histórico para a mesma troca', ...)              // effLine(obs, obs.effect(id)) === linha do buildHistoricoView para a mesma troca (comparações do Histórico)
it('efeito sem série, aguardando e sem base: as três frases do spec 5.7, sem número inventado', ...)
it('todos os links levam from=canais, canal=<id> e back=?tab=trocas', ...)
it('o link "Ver as 7 trocas em Mudanças" continua no fim', ...)
it('canal sem troca: "Nenhuma troca de título ou thumbnail nos últimos 30 dias."', ...)
it('canal em backfill: sem cartão e a frase de que ainda não há o que comparar', ...)
```
`T/canal-trocas.test.tsx` (jsdom):
```ts
it('cada cartão é um h3; a aba ativa é um h2', ...)
it('N cartões = N botões "Abrir histórico do vídeo"', ...)
it('a thumbnail do cartão fica fora da ordem de Tab; a lupa É uma parada de Tab aqui', ...)
it('"Ver trocas" de um vídeo (video=<id>): mostra só as dele, a linha "Só as trocas de “<título>”: 2 de 7" e "Ver as 7 trocas do canal"', ...)
it('video=<id> de vídeo sem troca: "Este vídeo não teve troca de título nem de thumbnail nos últimos 30 dias."', ...)
it('video=<id> que não é deste canal: mostra todas, sem erro', ...)
it('as abas são nav "Seções do canal" com links e aria-current="page", não tablist', ...)
it('trocar entre Vídeos e Trocas não navega (history.pushState) e põe o foco no título da aba', ...)
```
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar.** `effView` sai de `_canais/view-model.ts` para `_chrome/effect-view.ts` recebendo `obs` no lugar do fecho (`F`, `obs.SERIES_START_LABEL`); `T/canais-view-model.test.ts` fica verde sem mudança. `effLine` monta a frase em uma linha a partir do mesmo `EffectResult`: `aguardando` → "aguardando: {collected} de 7 dias coletados, {readyText}"; `sem-serie` → "sem série: {reason}"; `sem-antes` → "sem base: {reason}"; veredito → "{label}: {numbersFlat}". Antes de escrever, leia como `C/_historico/view-model.ts` (linhas 900 a 930) monta o texto da comparação e reaproveite a mesma função se ela existir separada; o teste de igualdade é o juiz. A troca de aba entre Vídeos e Trocas usa `history.pushState` (o Voltar do navegador desfaz) e um `popstate` relê o estado com `parseCanalState`. Forma do cartão: `M/canal.html`, aba Trocas.
- [ ] **Passo 4: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 5: commit** — `feat: canal do concorrente: aba Trocas com um cartao por video`.

---

### Tarefa 8: aba Leitura

**Arquivos:**
- Criar: `C/_canal/leitura.tsx`
- Modificar: `C/canal/[id]/page.tsx`, `C/_canal/canal-screen.tsx`, `C/_canal/canal.css`
- Teste: `T/canal-leitura.test.tsx`

**Interfaces:**
- Consome: `openObservatoryPage()` (conjunto do site), `buildMudancasView` e `ReadingCard` (`C/_mudancas/view-model.ts`, `C/_mudancas/reading-card.tsx`: `ReadingCard({ view, onAsk })`).
- Produz: `export function LeituraDoNicho({ nicheLabel, children }: { nicheLabel: string | null; children: ReactNode }): JSX.Element` (cliente; só a moldura e os textos) e, no `page.tsx`, o nó `leitura` passado a `CanalScreen`.

- [ ] **Passo 1: conferir.** Leia `C/_mudancas/reading-card.tsx` inteiro e a parte de `C/_mudancas/view-model.ts` que monta a leitura. Confirme no relatório: (a) `ReadingCard` sem `onAsk` não mostra botão de pedido; (b) quais classes de CSS ele usa e se estão presas a `[data-obs-screen="mudancas"]`. Se estiverem, a página importa `C/_mudancas/mudancas.css` e embrulha o cartão num `div data-obs-screen="mudancas"` **dentro** da aba (decisão registrada no ledger; promover as classes é trabalho da A2, que troca o cartão).

- [ ] **Passo 2: testes que falham**
```ts
it('o rótulo diz "Leitura do nicho Viagem (não é só deste canal)"', ...)
it('o botão do canal está apagado: aria-disabled, rótulo "Pedir leitura deste canal à forja"', ...)
it('sob o botão: "Leitura por canal ainda não existe. Por enquanto, a leitura do nicho Viagem está logo abaixo."', ...)
it('a região é role=region rotulada "Leitura da forja"', ...)
it('canal sem nicho: "Escolha o nicho do canal para ver a leitura do nicho." e nenhum cartão', ...)
it('nicho sem leitura publicada: a frase de vazio do cartão de Mudanças, sem botão de pedir', ...)
it('clicar no botão apagado não chama nada', ...)
```
- [ ] **Passo 3: rodar e ver falhar.**
- [ ] **Passo 4: implementar.** No `page.tsx`, **só quando `state.tab === 'leitura'`** e o canal tem nicho: `const site = await openObservatoryPage()`; `const mv = buildMudancasView(site.obs, { niche: canal.niche, … })` com os filtros padrão; `leitura = <LeituraDoNicho nicheLabel={…}><ReadingCard view={mv} /></LeituraDoNicho>` (sem `onAsk`: o pedido do nicho continua em Mudanças). Nas outras abas `leitura` é `null` e o conjunto do site não é lido. A aba "Leitura" em `CanalScreen` é um `Link` de verdade para `link.canal(id, { tab: 'leitura' })` (navegação), e as abas Vídeos e Trocas, vistas a partir da Leitura, também. A aba "Retenção" **não aparece** em concorrente (spec 5.8: só canal próprio).
- [ ] **Passo 5: rodar e ver passar**, mais `tsc`.
- [ ] **Passo 6: commit** — `feat: canal do concorrente: aba Leitura com a leitura do nicho, rotulada`.

---

### Tarefa 9: o painel lateral sai para concorrente; os cliques levam à página

**Arquivos:**
- Modificar: `C/page.tsx`, `C/_canais/cells.tsx`, `C/_canais/channel-table.tsx`, `C/_canais/channel-cards.tsx`, `C/_canais/canais-screen.tsx`, `C/_canais/view-model.ts`, `C/_chrome/pin-view.ts`, `C/_historico/view-model.ts`, `C/_outliers/view-model.ts` e o cartão de Outliers, `C/_mudancas/view-model.ts` e a linha de Mudanças
- Teste (mudam no mesmo commit): `T/canais-screen.test.tsx`, `T/canais-view-model.test.ts`, `T/canais-pending.test.tsx`, `T/canais-pinned.test.tsx`, `T/pin-view.test.ts`, `T/historico-view-model.test.ts`, `T/outliers-view-model.test.ts`, `T/mudancas-view-model.test.ts`, `T/legacy-redirect.test.ts`; novo `T/canal-redirect.test.ts`
- E2E: `E/canais.spec.ts`, `E/forja.spec.ts`

**Interfaces:**
- Consome: `link.canal` (Tarefa 1).
- Produz: `CanaisRow.href: string | null` (a página do canal para concorrente; `null` para canal próprio, que continua abrindo o painel); em `C/_historico/view-model.ts`, o item do canal na trilha (`crumbs.sub.href`) aponta para `link.canal(v.ch)` + o `back` quando a URL traz `canal=<id>`, e para `link.canal(v.ch)` puro nas outras origens, sempre que o canal é concorrente.

- [ ] **Passo 1: conferir onde o nome do canal aparece.** `grep -n "channelName\|\.ch\b.*name\|chName\|channel\.name" -r "apps/web/src/app/cms/(authed)/youtube/competitors/_outliers" "apps/web/src/app/cms/(authed)/youtube/competitors/_mudancas" | head -40`. Anote no relatório cada lugar em que o nome ou o avatar de um canal é texto ou link em Outliers e em Mudanças, e o que ele faz hoje.

- [ ] **Passo 2: testes que falham / mudam**
```ts
// T/canal-redirect.test.ts — a página de Canais com ?channel=
it('?channel=<concorrente> redireciona para a página do canal', ...)                 // redirect chamado com link.canal(id)
it('?channel=<concorrente>&tab=videos#… : redireciona; tab=outliers também', ...)
it('?channel=<canal próprio> NÃO redireciona: o painel abre como hoje', ...)
it('?channel=<id desconhecido> não redireciona nem dá erro (o painel some, como hoje)', ...)
// T/canais-screen.test.tsx
it('nome e avatar de um concorrente são link para a página do canal, não botão que abre o painel', ...)
it('nome de canal próprio continua sendo o botão "Abrir detalhes de <nome>" e abre o painel', ...)
it('o "?" dos inscritos e o menu da linha continuam na linha do concorrente', ...)
it('pré-carga: 150 ms de hover ou foco no link chama router.prefetch; no máximo 3 em andamento; sair antes de 150 ms não chama', ...)   // fake timers
// T/pin-view.test.ts
it('pinnedHref leva à página do canal com fmt=fixados', ...)                         // link.canal(ch.id, { fmt: 'fixados' })
// T/historico-view-model.test.ts
it('vindo do canal (canal=<id>): o item do canal na trilha volta à página do canal com o estado de back', ...)
it('vindo de Mudanças, Outliers ou Insights: o item do canal aponta para a página do canal, sem back', ...)
it('vídeo de canal próprio: o item do canal continua abrindo o painel de Canais', ...)
it('troca= na URL é ignorado sem erro (a chegada pela troca é da A2)', ...)
// T/outliers-view-model.test.ts e T/mudancas-view-model.test.ts
it('o nome do canal de um cartão/linha é link para a página do canal, com from e back da tela', ...)
```
Os testes existentes que afirmam "clicar no nome de um concorrente abre o painel" são **reescritos** para o comportamento novo no mesmo commit; os que exercitam o conteúdo do painel passam a abrir o painel de um **canal próprio**, ou saem quando o conteúdo só existe para concorrente (abas Trocas e Outliers do painel de concorrente, fixados do painel). Liste no relatório cada teste removido e o porquê.

- [ ] **Passo 3: implementar.**
  - `C/page.tsx`: depois de montar `obs`, se `one(sp.channel)` é um canal **não próprio** de `obs.channels`, `redirect(link.canal(id, tab === 'videos' ? {} : {}))` (o `tab` do painel não tem equivalente; cai na aba Vídeos). `legacyTabRedirect` continua antes.
  - `ChCell`: com `r.href`, nome e avatar viram um `Link` (importado no próprio módulo cliente) com `title` e nome acessível "Abrir a página de <nome>"; sem `r.href`, o botão de hoje. A pré-carga usa um hook local `usePrefetchOnIntent(href)`.
  - O código do painel (`ChannelDrawer`, `DrawerForjaBox`, `DrawerForjaFoot`) **fica**: ele ainda serve o canal próprio. Nada é apagado nesta fase além dos testes acima.
  - `coworkOf`, `pickNiche`, o link de Insights (`_insights/view-model.ts:594`, canal próprio) e os de `_outliers/view-model.ts:355,448` continuam com `link.canais({ channel })`: para concorrente o redirecionamento cobre.
- [ ] **Passo 4: e2e de fidelidade (decisão D8).** Em `E/canais.spec.ts`, tire de `DRAWERS` os concorrentes e as combinações `DRAWERS × TABS` deles; ficam os estados da tabela, os dos canais próprios e o resto. Em `E/forja.spec.ts`, tire os estados `CANAIS_FORJA` que abrem o painel de um concorrente. Em `E/allowances.ts`, apague as permissões que ficarem sem uso (`tsc` acusa). Escreva no relatório quantos estados saíram de cada arquivo.
- [ ] **Passo 5: rodar** a pasta inteira de testes do Observatório e o `tsc`; depois `npx playwright test --project=observatorio canais.spec.ts fixar.spec.ts flutuantes.spec.ts > $SCRATCH/pw9.txt 2>&1` em fundo. `fixar.spec.ts` e `flutuantes.spec.ts` têm passos que abrem o painel de um concorrente: os que quebrarem por isso são ajustados para o canal próprio ou movidos para a Tarefa 10, e a lista vai ao relatório.
- [ ] **Passo 6: commit** — `feat: canal do concorrente: o painel lateral sai para concorrente e os cliques levam a pagina`.

---

### Tarefa 10: prova no navegador (`canal.spec.ts`) e flutuantes novas

**Arquivos:**
- Criar: `E/canal.spec.ts`
- Modificar: `E/flutuantes.spec.ts` (famílias novas), `apps/web/e2e/fixtures/observatorio-seed.ts` (só se faltar caso)
- Sem commit: capturas em `docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a1-*`

**Interfaces:**
- Consome: `ADMIN_STATE`, `ensureSeeded`, `seedIdsOf`, `THEMES` (`E/fidelity.ts`); a rota `canal/<id>`.

- [ ] **Passo 1: semente.** Leia `E/fidelity.ts` (`ensureSeeded` e as opções) e `E/fixar.spec.ts` (como semeia um fixado). O canal da prova precisa de: mais vídeos guardados que `video_limit` (antigos), um fixado antigo, um vídeo sem data, um com `is_short` nulo, um com `comment_count` nulo e duas trocas no mesmo vídeo. O que a semente não tiver entra como opção nova de `ensureSeeded` (ex.: `canalCompleto: true`), sem alterar o padrão das outras specs.

- [ ] **Passo 2: escrever `E/canal.spec.ts`** (uma `test` por item; `test.use({ storageState: ADMIN_STATE })`):
```ts
test('A1.1 id desconhecido: "Canal não encontrado" na moldura, status 200', ...)              // response.status() === 200; texto; link "Voltar para Canais"
test('A1.1 a moldura tem só a trilha', ...)                                                   // 0 [data-obs-tabs], 0 barra de nicho
test('A1.2 cabeçalho recolhido com no máximo 150 px em 1440×900', ...)                        // getBoundingClientRect; registrar a medida
test('A1.3 em 1440×900: 5 colunas, cartões da mesma altura, grade a no máximo 340 px do topo do conteúdo, 10 cartões inteiros', ...)   // registrar as medidas; "10 inteiros" é meta: se der 5, registra e NÃO reprova
test('A1.3 sem rolagem horizontal da página em 1440, 1280, 1024, 768, 390 e 320 px, em Capas e em Lista', ...)   // document.documentElement.scrollWidth <= clientWidth
test('A1.4 Lista: 8 ou mais linhas inteiras na carga em 1440×900; abaixo de 820 px vira pilha', ...)
test('A1.5 cada troca de filtro, ordenação, busca e vista atualiza em menos de 100 ms e não navega', ...)   // performance.now em volta do clique + espera do DOM; 0 requisições de documento/RSC
test('A1.5 a URL reproduz o estado: recarregar mantém filtro, ordenação, busca, vista e n', ...)
test('A1.6 "Carregar mais": 40 por clique, a rolagem não muda, o foco vai ao primeiro cartão novo, n na URL', ...)   // window.scrollY igual antes e depois
test('A1.6 Voltar do Histórico reabre a grade com os mesmos cartões e a mesma rolagem', ...)
test('A1.7 aba Trocas: N vídeos com troca = N botões; "Abrir nesta troca" só com 2 ou mais', ...)
test('A1.8 clique no nome de um concorrente em Canais abre a página; o de canal próprio abre o painel', ...)
test('A1.8 /competitors?channel=<concorrente> redireciona para a página', ...)
test('A1.9 aba Leitura: rótulo "não é só deste canal" e botão apagado', ...)
test('teclado: 12 cartões = 24 paradas de Tab; nenhum foco sob a barra presa nem cortado, em 1440, 768 e 390 px', ...)   // para cada elemento focado: elementFromPoint no centro é ele ou filho
test('teclado: "[" no campo de busca não faz nada', ...)
test('alvos: 24×24 sempre; 44×44 em viewport ≤ 900 px (lupa, ⋯, botões de filtro, abas)', ...)
test('escala de cinza: nível do múltiplo, "não medido" e faixas de aviso continuam distinguíveis', ...)   // captura com filter:grayscale(1) salva em shots/a1-cinza-*.png; o teste afirma só que cada um tem texto, não só cor
test('tema claro e escuro: "não medido" visível nos dois', ...)                                // cor computada do texto ≠ cor do fundo; captura
test('console sem erro e nenhuma resposta 5xx na página do canal, nas três abas', ...)
```
- [ ] **Passo 3: flutuantes.** Em `E/flutuantes.spec.ts`, acrescentar a tela `canal` a `TELAS` com as famílias: ⓘ dos números (`modo: 'clique'`), menu ⋯ do canal, menu "Ações do vídeo" de um cartão do alto e de um do pé da grade (`max: 6`), e o mesmo menu na vista Lista. As quatro checagens do spec 19.1 e o controle negativo já estão na spec; só a lista cresce.
- [ ] **Passo 4: rodar** em fundo `npx playwright test --project=observatorio canal.spec.ts flutuantes.spec.ts > $SCRATCH/pw10.txt 2>&1`. Consertar o que reprovar **no código da tela** (não no teste), salvo medida declarada como meta. Registrar no ledger: altura do cabeçalho, topo da grade, cartões inteiros na carga, linhas da Lista, ms de cada troca de filtro, e a navegação Canais → Canal fria e quente (a meta é < 1 s quente; acima disso, registrar e abrir a pendência da decisão D10).
- [ ] **Passo 5: commit** — `test: canal do concorrente: prova no navegador e flutuantes da pagina do canal`.

---

### Tarefa 11: validação autenticada, suíte inteira e fecho

**Arquivos:**
- Modificar: `docs/superpowers/plans/2026-10-08-proximos-passos.md` (seção nova "onde retomar"), o ledger

- [ ] **Passo 1: suíte inteira.** `cd apps/web && npx vitest run > $SCRATCH/suite.txt 2>&1` em fundo (~160 s). Zero falhas. `npx tsc --noEmit -p . > $SCRATCH/tsc.txt 2>&1`.
- [ ] **Passo 2: `next build` local** (`npm run build:web > $SCRATCH/build.txt 2>&1`, em fundo): rota nova com componentes cliente e `Link`; é a mudança que o histórico do projeto manda construir antes de subir.
- [ ] **Passo 3: validação AUTENTICADA do CMS local** (`docs/ops/runbook-cms-e2e-local.md`, sem `db:reset`), por um subagente Sonnet com navegador: abrir Canais, clicar num concorrente, passar pelas três abas, filtrar, buscar, trocar a vista, carregar mais, abrir um vídeo e voltar, abrir os menus e o ⓘ, em 1440 e 390 px, nos dois temas. Console limpo, nenhuma rota 500. Repetir no **Opera** as rotas e, se o agente conseguir dirigir o Opera, os flutuantes; se não conseguir, isso vai escrito como "não conferido" para o dono.
- [ ] **Passo 4: o que nenhum agente confere** vai numa lista para o dono, no relatório final: leitor de tela (VoiceOver: filtrar, buscar, trocar a vista, percorrer a tabela por célula, a lista de títulos sem salto de nível, e o `aria-describedby` das dicas, achado 6 da A0); zoom de 200 a 400% em 320 px; toque real; flutuante dentro de modal (achado 9 da A0: o diálogo de remoção aberto a partir do menu ⋯ é o primeiro caso real; conferir que o menu fecha antes de o diálogo abrir).
- [ ] **Passo 5: pendências herdadas da A0, uma linha cada no ledger, feita ou adiada com motivo:** os 3 menores de `final-fix-rereview.md` (`session.current('todos')` e `compose` com `split` lançam com a mensagem de `forja.niches`; `onHl(null)` pode limpar destaque de outra origem; `gap` da prova declarado à mão); o item pulado de `nice-to-have.md` (fechar o Frescor quando o gatilho sai da janela: **pergunta ao dono**, não se decide aqui).
- [ ] **Passo 6: roteiro.** Seção nova em `docs/superpowers/plans/2026-10-08-proximos-passos.md`: A1 pronta em `staging` local, o que foi medido, a lista de rulings tirada do ledger, o custo de subagentes (tokens Sonnet e Opus), o que o dono precisa conferir e as decisões dele em aberto (cor do "não medido" no tema claro, D7; o Frescor). Commit só do roteiro.
- [ ] **Passo 7: parar.** Push e promoção são portões do dono.

---

## Revisão própria (feita ao escrever)

- **Cobertura do spec:** A1.1 → Tarefas 3 e 4; A1.2 → 2 e 4; A1.3 → 3, 5 e 10; A1.4 → 6 e 10; A1.5 → 1, 3, 5 e 10; A1.6 → 3, 5 e 10; A1.7 → 7; A1.8 → 9; A1.9 → 8; A1.10 → restrições globais e Tarefa 11. Seção 10 (carregamento): `loading.tsx` na 4, pré-carga na 9, medidas na 10. Seção 11: linhas 1, 3, 4, 5, 8, 9, 15, 16, 17, 18, 19 e 22 têm teste nas tarefas 4 a 10; a linha 13 na Tarefa 10; leitor de tela e zoom ficam com o dono (Tarefa 11, passo 4).
- **Fora desta fase, de propósito:** "Comparar com o meu canal" e "Meu canal" (A3, D4); o visualizador de thumbnail e a chegada pela troca (A2, D6); a aba Retenção (só canal próprio, L3); a leitura por canal (7.3); o cabeçalho otimista (D10).
- **Nomes conferidos entre tarefas:** `CanalState`, `canalQuery`, `LOTE` (1 → 3, 5, 6, 7); `NumCell`, `CanalHeaderView`, `buildCanalHeader` (2 → 4); `ChannelVideoView`, `montarLista`, `ListaView` (3 → 5, 6); `CanalTrocasView`, `buildCanalTrocas`, `effView`, `effLine` (7 → 4, 9); `TrailChrome`, `openChannelPage`, `CanalScreen` (4 → 8, 9, 10).
- **O que este plano não abriu e manda conferir:** `NicheSelect` e o CSS de `RemoveDialog` (Tarefa 4, passo 1); o texto da comparação no Histórico (Tarefa 7, passo 3); `ReadingCard` e o CSS dele (Tarefa 8, passo 1); onde o nome do canal aparece em Outliers e Mudanças (Tarefa 9, passo 1); as opções de `ensureSeeded` (Tarefa 10, passo 1).
- **Diferença em relação ao plano da A0:** os componentes de tela (Tarefas 4 a 8) não trazem o JSX inteiro; trazem o contrato (props, DOM exigido, textos, medidas), os testes e o arquivo do mockup que dá a forma. As funções puras (Tarefas 1 a 3) trazem código e testes completos. Nas listas de `it(...)` com `...`, o implementador escreve o corpo; o revisor reprova teste sem `expect`.
