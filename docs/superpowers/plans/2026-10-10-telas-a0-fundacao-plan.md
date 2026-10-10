# Telas do Observatório, fase A0 (fundação) — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Um implementador por vez,
> Sonnet, `effort: high` (desce para `medium` quando as revisões voltarem limpas; nunca `xhigh` nem `max`). Os passos
> usam caixas (`- [ ]`).

**Objetivo:** toda dica, popover e menu do Observatório abre numa camada única, acima do conteúdo e dentro da janela; a escala de camadas e os tokens de cor novos ficam num arquivo só; e existe um carregador de **um canal só**, com nulos de verdade.

**Arquitetura:** um módulo pequeno em `_chrome/flut/` (função pura de posição, um armazém de "uma aberta por vez" e dois componentes, `Popover` e `HoverTip`) renderiza por `createPortal` num contêiner `#flut[data-obs]` criado no fim do `<body>`. As oito flutuantes que existem hoje migram para ele, uma tela por tarefa, com o teste que muda no mesmo commit. O carregador novo reaproveita o pacote por canal que o cache já guarda.

**Stack:** Next 16, React 19, TypeScript estrito, Vitest (happy-dom), Playwright (projeto `observatorio`, banco local).

**Spec:** `docs/superpowers/specs/2026-10-07-observatorio-canal-video-ui-design.md` (v9): seção 4.2 "A0", seção 19, seção 2, seções 5.9 e 5.10. Modelo da camada: `docs/superpowers/mockups/2026-10-07-pagina-canal/{camadas.css,flut.js,prova-flutuantes.js}`.

**Ledger:** `.superpowers/sdd/2026-10-10-telas-a0-plan/progress.md` (criar na Tarefa 1). Relatório de cada tarefa em `task-N-report.md` na mesma pasta; a resposta do agente ao controlador tem até 10 linhas.

Abreviações de caminho usadas abaixo:
- `C/` = `apps/web/src/app/cms/(authed)/youtube/competitors/`
- `L/` = `apps/web/src/lib/youtube/observatorio/`
- `T/` = `apps/web/test/youtube/observatorio/`
- `E/` = `apps/web/e2e/tests/cms/observatorio/`

## Restrições globais

- Trabalho em `staging`, sem branch nem worktree. Nunca `git stash`, `git reset`, `--no-verify`. Commit por caminho explícito (`git commit -- <caminhos>` depois de `git add <caminhos>`). **Nunca** commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`. **Sem push**: o push é portão do dono.
- Nenhum `color-mix()` em CSS (o Opera do dono o renderiza transparente). Cores em hex ou `rgba` literal.
- Nulo nunca vira zero. Dado ausente é `null` no tipo e "não medido" na tela.
- `strict: true`, nunca `any`. Arquivos em kebab-case.
- Nunca passar `next/link` (nem componente importado num Server Component) como prop para componente cliente.
- Teste que muda de expectativa vai no **mesmo commit** da mudança.
- Nenhum `z-index` numérico em arquivo novo: só `var(--z-*)`.
- Escala de camadas (valores do spec 19.1, item 2): `--z-fundo` 0, `--z-conteudo` 1, `--z-marca` 2, `--z-marca-alta` 3, `--z-marca-topo` 4, `--z-grudado` 10, `--z-flutuante` 1000, `--z-aviso` 1100, `--z-modal` 2000. Reconciliação com o CMS (medida em 10/10): o maior `z-index` do CMS fora do Observatório é 60 e o maior dentro é 90 (`.modal` de Canais); 1000 fica acima de todos, que é o que a regra pede.
- Tokens novos (spec 19.2): `--nm #E59CC0`, `--nm-line #B0678F`, `--nm-bg #3A2232`, `--lado-o #FF8240`, `--lado-b #7CC8F8`, `--lado-n #D9C08F`, `--terco-baixo #F2C14E`, `--im-cl #38BDF8`, `--im-zero #7A8FA6`.
- `$SCRATCH` nos comandos = o diretório de rascunho da sessão, que o controlador informa no brief de cada tarefa.
- Subagente nunca espera mais de 4 min parado: suíte, build e Playwright vão em fundo, com saída em arquivo; no contexto entram só as falhas.
- Suíte de uma pasta: `cd apps/web && npx vitest run test/youtube/observatorio > <arquivo> 2>&1`. Typecheck: `cd apps/web && npx tsc --noEmit -p . > <arquivo> 2>&1`.
- E2E local: `npm run db:start` (nunca `db:reset`), depois `cd apps/web && npx playwright test --project=observatorio <spec> > <arquivo> 2>&1`. O servidor sobe sozinho na porta 3099.
- Mudança que toca o CMS exige validação AUTENTICADA local antes de promover (`docs/ops/runbook-cms-e2e-local.md`, sem `db:reset`): é a Tarefa 11.

## Decisões deste plano (o spec deixou para o plano)

| # | Decisão | Por quê | Custo se errado |
|---|---|---|---|
| D1 | A camada **não usa Provider**: armazém de módulo (`store.ts`) e contêiner criado sob demanda | os testes de tela renderizam os componentes soltos; um Provider obrigatório quebraria dezenas deles | trocar por contexto é mudança local em `flut.tsx` |
| D2 | As **oito flutuantes de produção migram na A0** (Canais, moldura, Mudanças, Outliers, Histórico), não só as das telas novas | o spec 4.1 diz "de todas as telas do Observatório" e o aceite 19.1, item 1, não abre exceção | o Histórico (Tarefa 8) é o de maior risco; pode ser adiado para a A2 sem desfazer o resto |
| D3 | Os 34 `z-index` numéricos existentes (35 linhas no grep do spec, uma delas comentário): saem os das flutuantes migradas; os outros ficam, com um **teste catraca** (a contagem só pode cair) | migrar marcas e grudados não entrega nada ao dono agora | a migração total vira tarefa de acabamento |
| D4 | A0.3: as classes são promovidas por **cópia** para `_chrome/kit.css` com prefixo `obs-ch-`; as telas existentes não mudam de classe; `.btn` não é copiado (já existe `.obs-ch-btn`, spec seção 2) | "telas existentes sem mudança visual"; o harness de fidelidade compara as telas com o mockup antigo | duplicação de umas 40 linhas de CSS até alguém deduplicar; um teste de paridade impede a deriva |
| D5 | Vídeo com `comment_count` nulo **sai da base do engajamento** (hoje entra como 0 comentário) | regra "nulo, nunca zero"; curtidas nulas já saem | canal com comentários desligados em todos os vídeos passa a mostrar "sem engajamento" em vez de um número subestimado. **Decisão a confirmar com o dono.** |
| D6 | `loadChannelDataset` de concorrente devolve só o canal pedido (sem canais próprios); de canal próprio, só ele e os vídeos dele | "não lê os outros canais"; a comparação e a posição são da A3 | a A3 acrescenta o que precisar |
| D7 | Os tokens novos têm só o valor do tema escuro (o spec e o mockup não definem o claro). Nenhuma tela os usa na A0 | sem consumidor não há como aprovar cor | **pendência registrada para a A1**: definir e medir o tema claro antes da primeira tela que use `--nm` |
| D8 | O "?" de Canais e os ícones de Outliers continuam abrindo por mouse e foco (`HoverTip`); menus e o ⓘ do múltiplo são `Popover` | não mudar comportamento de tela em produção | — |

## Foco de revisão

Entradas que o spec implica e que mais mordem; cada linha tem o teste na tarefa dona do código.

1. **O gatilho some com a flutuante aberta** (a linha da tabela sai numa sincronização ou reordenação): a flutuante fecha; não fica órfã em (0,0). → Tarefa 3, teste "gatilho que some".
2. **Flutuante fora de `[data-obs-screen]` perde as variáveis da tela** e fica com fundo transparente, nos dois temas, sem erro nenhum. → Tarefa 9, checagem `fundo` da prova (fundo com alfa maior que zero, tema claro e escuro).
3. **Janela muito baixa** (celular deitado, 320×180): a caixa ganha rolagem interna e fica inteira na janela. → Tarefa 2, teste "janela baixa".
4. **`channelId` de outro site na URL**: `loadChannelDataset` devolve `null` e não faz nenhuma leitura pesada. → Tarefa 10, teste "canal de outro site".
5. **Comentário nulo com curtida presente**: o engajamento do canal não conta o vídeo; não vira `likes / views` em silêncio. → Tarefa 10, teste "comentário nulo fora da base".

---

### Tarefa 1: escala de camadas, tokens de cor e guarda de CSS (A0.2, parte da A0.3)

**Arquivos:**
- Criar: `C/_chrome/camadas.css`, `C/_chrome/tokens-telas.css`
- Modificar: `C/layout.tsx`
- Teste: `T/camadas-css.test.ts`
- Criar (sem commit): `E/a0-sem-mudanca.spec.ts` e a pasta de capturas dele

**Interfaces:**
- Produz: as variáveis `--z-*` em `:root`; os tokens de cor em `[data-obs]`; a classe `.obs-ch-nm` (pastilha "não medido" com hachura); o contêiner `#flut`.

- [ ] **Passo 1: criar o ledger.** `mkdir -p .superpowers/sdd/2026-10-10-telas-a0-plan` e escrever `progress.md` com a linha `Tarefa 1: iniciada (BASE <hash de HEAD>)`.

- [ ] **Passo 2: capturas de antes (não vão para o git).** Criar `E/a0-sem-mudanca.spec.ts`:

```ts
// NÃO COMMITAR. Prova "telas existentes sem mudança visual" (spec A0.3): a 1ª execução, com --update-snapshots, grava as
// capturas de antes; a Tarefa 11 roda de novo, sem a flag, e compara.
import { test, expect } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf } from './fidelity'
import { MANY_VERSIONS_ID } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => { ids = seedIdsOf(await ensureSeeded({ manyVersions: true })) })

const TELAS: Array<[string, () => string]> = [
  ['canais', () => '/cms/youtube/competitors'],
  ['outliers', () => '/cms/youtube/competitors/outliers'],
  ['mudancas', () => '/cms/youtube/competitors/mudancas'],
  ['insights', () => '/cms/youtube/competitors/insights'],
  ['historico', () => '/cms/youtube/competitors/video/' + ids.video(MANY_VERSIONS_ID)],
]
for (const [nome, url] of TELAS) for (const largura of [1440, 390]) {
  test(`${nome} ${largura}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 })
    await page.goto(url())
    await page.locator('[data-obs-screen]').first().waitFor()
    await page.waitForLoadState('networkidle')
    expect(await page.screenshot({ animations: 'disabled' })).toMatchSnapshot(`${nome}-${largura}.png`, { maxDiffPixels: 0 })
  })
}
```

Rodar em fundo: `npm run db:start`, depois `cd apps/web && npx playwright test --project=observatorio e2e/tests/cms/observatorio/a0-sem-mudanca.spec.ts --update-snapshots > "$SCRATCH/a0-antes.log" 2>&1`. Esperado: 10 testes passam e existe `E/a0-sem-mudanca.spec.ts-snapshots/` com 10 PNG. Se o Docker não estiver de pé, parar e avisar o controlador (não tentar instalar nada).

- [ ] **Passo 3: escrever o teste que falha.** `T/camadas-css.test.ts`:

```ts
// @vitest-environment node
/** Guarda de CSS da fase A0 (spec 19.1 item 2 e 19.2): escala de camadas num arquivo só, tokens novos, sem color-mix. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const cssFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? cssFiles(path.join(dir, e.name)) : e.name.endsWith('.css') ? [path.join(dir, e.name)] : [])
const numericos = (f: string) => (semComentario(fs.readFileSync(f, 'utf8')).match(/z-index\s*:\s*-?\d+/g) ?? []).length

/** Arquivos que nasceram na fase A: nenhum z-index numérico. A lista cresce a cada fase. */
const NOVOS = ['_chrome/tokens-telas.css', '_chrome/flut/flut.css', '_chrome/kit.css']
/** z-index numéricos nos arquivos antigos em 10/10/2026, antes da A0 (34 declarações; a 35ª linha do grep é um comentário). Catraca: só pode cair. */
const TETO_ANTIGOS = 34

describe('Observatório · escala de camadas', () => {
  const camadas = semComentario(read('_chrome/camadas.css'))
  it('a escala tem os nove níveis do spec, com os valores do spec', () => {
    const esperado: Record<string, string> = { fundo: '0', conteudo: '1', marca: '2', 'marca-alta': '3', 'marca-topo': '4', grudado: '10', flutuante: '1000', aviso: '1100', modal: '2000' }
    for (const [k, v] of Object.entries(esperado)) expect(camadas, k).toMatch(new RegExp(`--z-${k}\\s*:\\s*${v}\\s*[;}]`))
  })
  it('#flut é fixo, cobre a janela, usa a variável e não captura clique', () => {
    const regra = camadas.match(/#flut\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(regra).toMatch(/position\s*:\s*fixed/)
    expect(regra).toMatch(/inset\s*:\s*0/)
    expect(regra).toMatch(/z-index\s*:\s*var\(--z-flutuante\)/)
    expect(regra).toMatch(/pointer-events\s*:\s*none/)
  })
  it('arquivo novo não tem z-index numérico', () => {
    for (const f of NOVOS) if (fs.existsSync(path.join(DIR, f))) expect(numericos(path.join(DIR, f)), f).toBe(0)
  })
  it('catraca: os z-index numéricos dos arquivos antigos só diminuem', () => {
    const antigos = cssFiles(DIR).filter(f => !NOVOS.some(n => f.endsWith(n)) && !f.endsWith('camadas.css'))
    expect(antigos.reduce((n, f) => n + numericos(f), 0)).toBeLessThanOrEqual(TETO_ANTIGOS)
  })
})

describe('Observatório · tokens das telas novas', () => {
  const tokens = semComentario(read('_chrome/tokens-telas.css'))
  it('cada token do spec 19.2 existe com o valor do spec', () => {
    const esperado: Record<string, string> = { nm: '#E59CC0', 'nm-line': '#B0678F', 'nm-bg': '#3A2232', 'lado-o': '#FF8240', 'lado-b': '#7CC8F8', 'lado-n': '#D9C08F', 'terco-baixo': '#F2C14E', 'im-cl': '#38BDF8', 'im-zero': '#7A8FA6' }
    for (const [k, v] of Object.entries(esperado)) expect(tokens, k).toMatch(new RegExp(`--${k}\\s*:\\s*${v}\\s*[;}]`, 'i'))
  })
  it('"não medido" tem forma além da cor: hachura', () => {
    expect(tokens).toMatch(/\.obs-ch-nm\s*\{[^}]*repeating-linear-gradient/)
  })
  it('nenhum CSS do Observatório usa color-mix()', () => {
    for (const f of cssFiles(DIR)) expect(semComentario(fs.readFileSync(f, 'utf8')), f).not.toMatch(/color-mix\s*\(/)
  })
})
```

- [ ] **Passo 4: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/camadas-css.test.ts`. Esperado: FALHA com `ENOENT ... camadas.css`.

- [ ] **Passo 5: escrever os dois arquivos.** `C/_chrome/camadas.css`:

```css
/* A ESCALA DE CAMADAS do Observatório, num lugar só (spec de telas v9, 19.1). Arquivo novo usa só estas variáveis.
   Toda dica, popover e menu mora em #flut, filho direto do <body>: nenhum ancestral (overflow, transform, contain,
   sticky) consegue prendê-la ou cortá-la. O contêiner é criado por _chrome/flut/store.ts e carrega data-obs, para
   herdar os tokens de [data-obs] nos dois temas. */
:root{
  --z-fundo:0;
  --z-conteudo:1;
  --z-marca:2;
  --z-marca-alta:3;
  --z-marca-topo:4;
  --z-grudado:10;
  --z-flutuante:1000;
  --z-aviso:1100;
  --z-modal:2000;
}
#flut{position:fixed;inset:0;z-index:var(--z-flutuante);pointer-events:none}
#flut>*{pointer-events:auto}
#flut>.obs-fl-tip{pointer-events:none}
```

`C/_chrome/tokens-telas.css`:

```css
/* Tokens das telas de canal e vídeo (spec de telas v9, 19.2). Hex e rgba literais: nunca color-mix().
   Só o tema escuro tem valor aprovado; o claro é pendência da fase A1 (plano da A0, decisão D7). */
[data-obs]{
  --nm:#E59CC0;--nm-line:#B0678F;--nm-bg:#3A2232;
  --lado-o:#FF8240;--lado-b:#7CC8F8;--lado-n:#D9C08F;
  --terco-baixo:#F2C14E;--im-cl:#38BDF8;--im-zero:#7A8FA6;
}
/* "não medido": a hachura é a forma, o rosa é o reforço. Sempre com o texto do motivo dentro ou ao lado. */
[data-obs] .obs-ch-nm{display:inline-block;padding:1px 6px;border:1px solid var(--nm-line);border-radius:4px;color:var(--nm);
  background:repeating-linear-gradient(135deg,var(--nm-bg) 0 6px,rgba(229,156,192,.14) 6px 8px)}
```

Em `C/layout.tsx`, depois de `import './_chrome/chrome.css'`, acrescentar:

```ts
import './_chrome/camadas.css'
import './_chrome/tokens-telas.css'
```

- [ ] **Passo 6: rodar e ver passar.** Mesmo comando do passo 4. Esperado: 7 testes passam.

- [ ] **Passo 7: commit.**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/camadas.css" "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/tokens-telas.css" "apps/web/src/app/cms/(authed)/youtube/competitors/layout.tsx" apps/web/test/youtube/observatorio/camadas-css.test.ts
git commit -m "feat: escala de camadas e tokens de cor das telas do Observatório (A0.2)" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/camadas.css" "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/tokens-telas.css" "apps/web/src/app/cms/(authed)/youtube/competitors/layout.tsx" apps/web/test/youtube/observatorio/camadas-css.test.ts
```

---

### Tarefa 2: a função de posição (A0.1)

**Arquivos:**
- Criar: `C/_chrome/flut/place.ts`
- Teste: `T/flut-place.test.ts`

**Interfaces:**
- Produz:

```ts
export interface Box { left: number; top: number; right: number; bottom: number }
export type Side = 'baixo' | 'cima' | 'lado'
export interface PlaceOpts { pref?: Side; align?: 'fim' | 'meio' | 'inicio'; cx?: number; gap?: number }
export interface Placed { left: number; top: number; maxHeight: number | null; side: Side }
export const EDGE = 8
export function maxWidthFor(viewportW: number, maxW?: number): number
export function place(anchor: Box, size: { w: number; h: number }, vp: { w: number; h: number }, o?: PlaceOpts): Placed
```

- [ ] **Passo 1: escrever o teste que falha.** `T/flut-place.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { place, maxWidthFor, EDGE, type Box } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/place'

const VP = { w: 1440, h: 900 }
const box = (left: number, top: number, w = 24, h = 24): Box => ({ left, top, right: left + w, bottom: top + h })
const cobre = (p: { left: number; top: number }, s: { w: number; h: number }, a: Box) =>
  !(p.left + s.w <= a.left || p.left >= a.right || p.top + s.h <= a.top || p.top >= a.bottom)
const dentro = (p: { left: number; top: number; maxHeight: number | null }, s: { w: number; h: number }, vp = VP) =>
  p.left >= 0 && p.top >= 0 && p.left + s.w <= vp.w && p.top + Math.min(s.h, p.maxHeight ?? s.h) <= vp.h

describe('flut · place', () => {
  const S = { w: 270, h: 120 }
  it('prefere abaixo, com a borda direita alinhada à do gatilho', () => {
    const a = box(700, 400), p = place(a, S, VP)
    expect(p).toEqual({ left: a.right - S.w, top: a.bottom + 6, maxHeight: null, side: 'baixo' })
  })
  it('vira para cima quando não cabe embaixo', () => {
    const a = box(700, 860), p = place(a, S, VP)
    expect(p.side).toBe('cima')
    expect(p.top).toBe(a.top - 6 - S.h)
  })
  it('linha do meio encostada no pé da janela: inteira na janela e sem cobrir o gatilho', () => {
    const a = box(300, 900 - 24 - 2), p = place(a, S, VP)
    expect(dentro(p, S)).toBe(true)
    expect(cobre(p, S, a)).toBe(false)
  })
  it('desloca na horizontal para não encostar na borda', () => {
    expect(place(box(4, 400), S, VP).left).toBe(EDGE)
    expect(place(box(1430, 400, 8, 24), S, VP, { align: 'inicio' }).left).toBe(VP.w - S.w - EDGE)
  })
  it('align meio centraliza no gatilho; cx centraliza no ponto pedido', () => {
    const a = box(700, 400)
    expect(place(a, S, VP, { align: 'meio' }).left).toBe(Math.round(712 - S.w / 2))
    expect(place(a, S, VP, { cx: 500 }).left).toBe(500 - S.w / 2)
  })
  it('pref cima abre para cima quando cabe e cai para baixo quando não', () => {
    expect(place(box(700, 400), S, VP, { pref: 'cima' }).side).toBe('cima')
    expect(place(box(700, 20), S, VP, { pref: 'cima' }).side).toBe('baixo')
  })
  it('não cabe em cima nem embaixo: usa o lado maior e limita a altura, com rolagem interna', () => {
    const alto = { w: 270, h: 800 }, a = box(700, 500), p = place(a, alto, VP)
    expect(p.side).toBe('cima')
    expect(p.maxHeight).toBe(a.top - 6 - EDGE)
    expect(dentro(p, alto)).toBe(true)
    expect(cobre({ left: p.left, top: p.top }, { w: alto.w, h: p.maxHeight! }, a)).toBe(false)
  })
  it('pref lado: à direita do gatilho; sem espaço, à esquerda; sem nenhum, cai para baixo', () => {
    const a = box(700, 400)
    expect(place(a, S, VP, { pref: 'lado' })).toMatchObject({ left: a.right + 6, top: a.top, side: 'lado' })
    const b = box(1400, 400)
    expect(place(b, S, VP, { pref: 'lado' })).toMatchObject({ left: b.left - 6 - S.w, side: 'lado' })
    expect(place(box(180, 400), S, { w: 390, h: 844 }, { pref: 'lado' }).side).toBe('baixo')
  })
  it('janela baixa (320×180): a caixa fica inteira na janela, com altura limitada', () => {
    const vp = { w: 320, h: 180 }, p = place(box(150, 80), S, vp)
    expect(p.maxHeight).not.toBeNull()
    expect(dentro(p, S, vp)).toBe(true)
  })
  it('em 390 px a largura máxima é a janela menos 16', () => {
    expect(maxWidthFor(390)).toBe(374)
    expect(maxWidthFor(1440, 310)).toBe(310)
    const p = place(box(300, 400), { w: 374, h: 100 }, { w: 390, h: 844 })
    expect(p.left).toBe(EDGE)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/flut-place.test.ts`. Esperado: FALHA, módulo não encontrado.

- [ ] **Passo 3: implementar.** `C/_chrome/flut/place.ts`:

```ts
// Where a floating surface goes, in viewport coordinates (port of the approved mockup's flut.js `posicionar`).
// Pure: the caller measures the trigger and the surface. Rules of the spec (telas v9, 19.1): prefers below, turns up
// when it does not fit, shifts sideways to stay off the edges, and when it fits on neither side takes the larger one
// with a capped height (the caller turns on inner scroll).
export interface Box { left: number; top: number; right: number; bottom: number }
export type Side = 'baixo' | 'cima' | 'lado'
export interface PlaceOpts {
  pref?: Side
  /** Horizontal alignment to the trigger when above or below. 'fim' = right edges aligned (the default). */
  align?: 'fim' | 'meio' | 'inicio'
  /** Centre the surface on this x instead (a chart tooltip follows the point, not the trigger's box). */
  cx?: number
  gap?: number
}
export interface Placed { left: number; top: number; maxHeight: number | null; side: Side }

/** Distance kept from every edge of the viewport. */
export const EDGE = 8
/** Lowest height a squeezed surface keeps before it scrolls inside. */
const MIN_H = 80

export const maxWidthFor = (viewportW: number, maxW?: number): number => Math.min(maxW ?? Infinity, viewportW - 2 * EDGE)

export function place(anchor: Box, size: { w: number; h: number }, vp: { w: number; h: number }, o: PlaceOpts = {}): Placed {
  const G = o.gap ?? 6, { w } = size
  let h = size.h, pref: Side = o.pref ?? 'baixo'
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), vp.h - h - EDGE)
  if (pref === 'lado') {
    let x = anchor.right + G
    if (x + w > vp.w - EDGE) x = anchor.left - G - w
    if (x >= EDGE) {
      const maxHeight = h > vp.h - 2 * EDGE ? vp.h - 2 * EDGE : null
      if (maxHeight != null) h = maxHeight
      return { left: Math.round(x), top: Math.round(clampY(anchor.top)), maxHeight, side: 'lado' }
    }
    pref = 'baixo' // fits on neither side: above or below
  }
  const below = vp.h - anchor.bottom - G - EDGE, above = anchor.top - G - EDGE
  const up = pref === 'cima' ? (h <= above ? true : h <= below ? false : above >= below) : (h <= below ? false : h <= above ? true : above > below)
  const room = up ? above : below
  let maxHeight: number | null = null
  if (h > room) { maxHeight = Math.min(Math.max(MIN_H, room), vp.h - 2 * EDGE); h = maxHeight }
  const aw = anchor.right - anchor.left
  const x = o.cx != null ? o.cx - w / 2 : o.align === 'meio' ? anchor.left + aw / 2 - w / 2 : o.align === 'inicio' ? anchor.left : anchor.right - w
  return {
    left: Math.round(Math.min(Math.max(EDGE, x), vp.w - w - EDGE)),
    top: Math.round(clampY(up ? anchor.top - G - h : anchor.bottom + G)),
    maxHeight, side: up ? 'cima' : 'baixo',
  }
}
```

- [ ] **Passo 4: rodar e ver passar.** Mesmo comando. Esperado: 10 testes passam. Se um falhar por arredondamento, corrigir a **implementação** só se a regra do spec estiver violada; senão, conferir a conta do teste com o controlador (não afrouxar a asserção).

- [ ] **Passo 5: commit.**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/flut/place.ts" apps/web/test/youtube/observatorio/flut-place.test.ts
git commit -m "feat: posição das flutuantes do Observatório (vira para cima, fica na janela)" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/flut/place.ts" apps/web/test/youtube/observatorio/flut-place.test.ts
```

---

### Tarefa 3: armazém, `Popover` e `HoverTip` (A0.1)

**Arquivos:**
- Criar: `C/_chrome/flut/store.ts`, `C/_chrome/flut/flut.tsx`, `C/_chrome/flut/flut.css`
- Modificar: `C/layout.tsx` (import do CSS)
- Teste: `T/flut.test.tsx`

**Interfaces:**
- Consome: `place`, `maxWidthFor`, `PlaceOpts`, `Box` da Tarefa 2.
- Produz:

```ts
// store.ts
export function flutHost(): HTMLElement                         // #flut[data-obs], filho do <body>; cria se não existe
export function currentFlut(): string | null                    // id do popover aberto
export function subscribeFlut(f: () => void): () => void

// flut.tsx ('use client')
export type Anchor = () => Element | null
export function Popover(p: {
  open: boolean; anchor: Anchor; onClose: () => void; children: ReactNode
  id?: string; className?: string; role?: 'dialog' | 'menu' | 'tooltip' | 'group'; label?: string
  pref?: Side; align?: 'fim' | 'meio' | 'inicio'; maxW?: number
}): ReactNode
export function HoverTip(p: {
  show: boolean; anchor: Anchor; children: ReactNode
  id?: string; className?: string; pref?: Side; align?: 'fim' | 'meio' | 'inicio'; cx?: number; maxW?: number; ariaHidden?: boolean
}): ReactNode
```

Regras que os dois cumprem: moram em `#flut`; uma `Popover` aberta por vez (abrir outra chama o `onClose` da anterior); Esc fecha e **devolve o foco ao gatilho**; clique fora e foco fora fecham, sem mexer no foco; reposicionam em rolagem (de qualquer contêiner), redimensionamento e a cada render; fecham se o gatilho sai da janela ou some do documento. `HoverTip` só posiciona, tem `pointer-events:none` e se esconde enquanto houver `Popover` aberta. No servidor os dois renderizam nada.

- [ ] **Passo 1: escrever o teste que falha.** `T/flut.test.tsx` (mesmos imports de `@testing-library/react` que `T/pin-kit.test.tsx` usa):

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useRef, useState } from 'react'
import { Popover, HoverTip } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/flut'
import { currentFlut } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/store'

afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })
const flut = () => document.getElementById('flut')

function Um({ id, onClose }: { id: string; onClose?: () => void }) {
  const [open, setOpen] = useState(false), btn = useRef<HTMLButtonElement>(null)
  return (
    <div style={{ overflow: 'hidden' }}>
      <button ref={btn} data-testid={'btn-' + id} aria-expanded={open} onClick={() => setOpen(o => !o)}>abrir {id}</button>
      <Popover open={open} anchor={() => btn.current} onClose={() => { setOpen(false); onClose?.() }} id={'pop-' + id} role="dialog" label={'Popover ' + id}>
        <button data-testid={'dentro-' + id}>dentro {id}</button>
      </Popover>
    </div>
  )
}

describe('flut · Popover', () => {
  it('fechado não renderiza; aberto mora em #flut, filho do body, com data-obs', () => {
    const { getByTestId } = render(<Um id="a" />)
    expect(flut()?.querySelector('#pop-a') ?? null).toBeNull()
    fireEvent.click(getByTestId('btn-a'))
    const pop = document.getElementById('pop-a')!
    expect(pop.parentElement).toBe(flut())
    expect(flut()!.parentElement).toBe(document.body)
    expect(flut()!.hasAttribute('data-obs')).toBe(true)
    expect(pop.getAttribute('role')).toBe('dialog')
    expect(pop.getAttribute('aria-label')).toBe('Popover a')
    expect(pop.style.position).toBe('fixed')
    expect(currentFlut()).toBe('pop-a')
  })
  it('uma aberta por vez: abrir a segunda fecha a primeira', () => {
    const { getByTestId } = render(<><Um id="a" /><Um id="b" /></>)
    fireEvent.click(getByTestId('btn-a'))
    fireEvent.click(getByTestId('btn-b'))
    expect(document.getElementById('pop-a')).toBeNull()
    expect(document.getElementById('pop-b')).not.toBeNull()
    expect(flut()!.children).toHaveLength(1)
  })
  it('Esc fecha e devolve o foco ao gatilho', () => {
    const { getByTestId } = render(<Um id="a" />)
    fireEvent.click(getByTestId('btn-a'))
    getByTestId('dentro-a').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.getElementById('pop-a')).toBeNull()
    expect(document.activeElement).toBe(getByTestId('btn-a'))
  })
  it('clique fora fecha e não mexe no foco; clique dentro e no gatilho não fecham por fora', () => {
    const { getByTestId } = render(<><Um id="a" /><button data-testid="fora">fora</button></>)
    fireEvent.click(getByTestId('btn-a'))
    fireEvent.mouseDown(getByTestId('dentro-a'))
    expect(document.getElementById('pop-a')).not.toBeNull()
    fireEvent.mouseDown(getByTestId('btn-a'))
    expect(document.getElementById('pop-a')).not.toBeNull()
    fireEvent.mouseDown(getByTestId('fora'))
    expect(document.getElementById('pop-a')).toBeNull()
    expect(document.activeElement).not.toBe(getByTestId('btn-a'))
  })
  it('foco que vai para fora fecha', () => {
    const { getByTestId } = render(<><Um id="a" /><button data-testid="fora">fora</button></>)
    fireEvent.click(getByTestId('btn-a'))
    act(() => { getByTestId('fora').focus() })
    expect(document.getElementById('pop-a')).toBeNull()
  })
  it('gatilho que some do documento com a flutuante aberta: ela fecha', () => {
    const onClose = vi.fn()
    function Some() {
      const [tem, setTem] = useState(true), el = useRef<HTMLButtonElement | null>(null)
      return <>
        {tem ? <button ref={el} data-testid="g">g</button> : null}
        <button data-testid="tira" onClick={() => setTem(false)}>tira</button>
        <Popover open anchor={() => el.current} onClose={onClose} id="pop-s">x</Popover>
      </>
    }
    const { getByTestId } = render(<Some />)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(getByTestId('tira'))
    expect(onClose).toHaveBeenCalled()
  })
  it('no servidor não renderiza nada e não lança', () => {
    expect(() => renderToString(<Popover open anchor={() => null} onClose={() => {}}>x</Popover>)).not.toThrow()
    expect(renderToString(<Popover open anchor={() => null} onClose={() => {}}>x</Popover>)).toBe('')
  })
})

describe('flut · HoverTip', () => {
  function Dica({ show }: { show: boolean }) {
    const el = useRef<HTMLSpanElement>(null)
    return <><span ref={el}>?</span><HoverTip show={show} anchor={() => el.current} id="tip-1" className="minha">texto da dica</HoverTip></>
  }
  it('aparece em #flut como tooltip, com a classe que não captura clique', () => {
    render(<Dica show />)
    const tip = document.getElementById('tip-1')!
    expect(tip.parentElement).toBe(flut())
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(tip.classList.contains('obs-fl-tip')).toBe(true)
    expect(tip.classList.contains('minha')).toBe(true)
    expect(tip.textContent).toBe('texto da dica')
  })
  it('show falso não renderiza', () => {
    render(<Dica show={false} />)
    expect(document.getElementById('tip-1')).toBeNull()
  })
  it('se esconde enquanto há um popover aberto', () => {
    const { getByTestId } = render(<><Dica show /><Um id="a" /></>)
    expect(document.getElementById('tip-1')).not.toBeNull()
    fireEvent.click(getByTestId('btn-a'))
    expect(document.getElementById('tip-1')).toBeNull()
  })
})
```

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/flut.test.tsx`. Esperado: FALHA, módulo não encontrado.

- [ ] **Passo 3: implementar o armazém.** `C/_chrome/flut/store.ts`:

```ts
// The one floating layer of the Observatório (spec telas v9, 19.1): the #flut container at the end of <body>, and
// "one popover open at a time". Module state on purpose (plan decision D1): screens are rendered alone in tests and by
// several routes, and a provider would have to wrap every one of them.
export interface OpenFlut {
  id: string
  anchor: () => Element | null
  el: () => HTMLElement | null
  /** Asks the owner to close. `focus` = give the focus back to the trigger (Esc); false for outside click / focus. */
  close: (focus: boolean) => void
}

let host: HTMLElement | null = null
let open: OpenFlut | null = null
let wired = false
const subs = new Set<() => void>()
const emit = () => { for (const f of [...subs]) f() }

const inside = (t: EventTarget | null): boolean => {
  if (!open || !(t instanceof Node)) return false
  return !!open.el()?.contains(t) || !!open.anchor()?.contains(t)
}

function wire() {
  if (wired) return
  wired = true
  // capture: the layer answers Esc before the screen under it (one Esc closes one thing)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); open.close(true) } }, true)
  document.addEventListener('mousedown', e => { if (open && !inside(e.target)) open.close(false) }, true)
  document.addEventListener('focusin', e => { if (open && !inside(e.target)) open.close(false) })
}

/** The container, created on first use. `data-obs` makes it inherit the [data-obs] tokens in both themes. */
export function flutHost(): HTMLElement {
  if (!host || !host.isConnected) {
    host = document.getElementById('flut') ?? document.createElement('div')
    host.id = 'flut'
    host.setAttribute('data-obs', '')
    document.body.appendChild(host)
  }
  wire()
  return host
}

export function claimFlut(o: OpenFlut): void {
  const prev = open
  open = o
  emit()
  if (prev && prev.id !== o.id) prev.close(false)
}
export function releaseFlut(id: string): void {
  if (open?.id !== id) return
  open = null
  emit()
}
export const currentFlut = (): string | null => open?.id ?? null
export const subscribeFlut = (f: () => void): (() => void) => { subs.add(f); return () => { subs.delete(f) } }
```

- [ ] **Passo 4: implementar os componentes.** `C/_chrome/flut/flut.tsx`:

```tsx
'use client'
/**
 * Floating surfaces of the Observatório: every tooltip, popover and menu renders through one of these two, into #flut
 * (spec telas v9, 19.1). <Popover> opens by click or keyboard and is the only one open; <HoverTip> follows the mouse
 * or the focus, never takes a click, and hides while a popover is open.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { place, maxWidthFor, type PlaceOpts, type Side } from './place'
import { flutHost, claimFlut, releaseFlut, currentFlut, subscribeFlut } from './store'

/** The trigger, looked up when needed: a ref's current, or a DOM lookup (a row's button is found by id). */
export type Anchor = () => Element | null
type Opts = PlaceOpts & { maxW?: number }

const noSub = () => () => {}
/** false on the server and during hydration, true after: a portal cannot render on the server. */
const useIsClient = () => useSyncExternalStore(noSub, () => true, () => false)

function usePlacement(active: boolean, ref: RefObject<HTMLDivElement | null>, anchor: Anchor, o: Opts, onGone: () => void) {
  const live = useRef({ anchor, o, onGone })
  useEffect(() => { live.current = { anchor, o, onGone } })
  const run = useCallback(() => {
    const el = ref.current, { anchor: at, o: opts, onGone: gone } = live.current
    if (!el) return
    const a = at()
    // the trigger left the document (its row was removed, the list was sorted): nothing to point at
    if (!a || !a.isConnected) { gone(); return }
    const r = a.getBoundingClientRect()
    const vp = { w: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight }
    // scrolled out of the window (a rect with no size says nothing: no layout, as in jsdom)
    if ((r.width || r.height) && (r.bottom < 0 || r.top > vp.h || r.right < 0 || r.left > vp.w)) { gone(); return }
    el.style.maxWidth = maxWidthFor(vp.w, opts.maxW) + 'px'
    el.style.maxHeight = ''
    el.style.overflowY = ''
    const p = place(r, { w: el.offsetWidth, h: el.offsetHeight }, vp, opts)
    if (p.maxHeight != null) { el.style.maxHeight = p.maxHeight + 'px'; el.style.overflowY = 'auto' }
    el.style.left = p.left + 'px'
    el.style.top = p.top + 'px'
    el.dataset.lado = p.side
  }, [ref])
  // before every paint while it is open: a render of the screen may have moved the trigger
  useLayoutEffect(() => { if (active) run() })
  useEffect(() => {
    if (!active) return
    const on = (e: Event) => { if (e.type === 'scroll' && e.target instanceof Node && ref.current?.contains(e.target)) return; run() }
    window.addEventListener('resize', on)
    document.addEventListener('scroll', on, { capture: true, passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => run())
    const a = live.current.anchor()
    if (a) ro?.observe(a)
    ro?.observe(document.documentElement)
    return () => { window.removeEventListener('resize', on); document.removeEventListener('scroll', on, { capture: true }); ro?.disconnect() }
  }, [active, run, ref])
}

export function Popover({ open, anchor, onClose, children, id, className, role = 'dialog', label, pref, align, maxW }: {
  open: boolean; anchor: Anchor
  /** Close it (set your state). The focus goes back to the trigger by itself when it was Esc. */
  onClose: () => void
  children: ReactNode
  id?: string; className?: string; role?: 'dialog' | 'menu' | 'tooltip' | 'group'; label?: string
  pref?: Side; align?: 'fim' | 'meio' | 'inicio'; maxW?: number
}) {
  const client = useIsClient()
  const auto = useId(), pid = id ?? 'flut-' + auto
  const ref = useRef<HTMLDivElement>(null)
  const live = useRef({ anchor, onClose })
  useEffect(() => { live.current = { anchor, onClose } })
  useEffect(() => {
    if (!open) return
    claimFlut({
      id: pid, anchor: () => live.current.anchor(), el: () => ref.current,
      close: focus => {
        const a = live.current.anchor()
        live.current.onClose()
        if (focus && a instanceof HTMLElement) a.focus()
      },
    })
    return () => releaseFlut(pid)
  }, [open, pid])
  usePlacement(open && client, ref, anchor, { pref, align, maxW }, () => live.current.onClose())
  if (!open || !client) return null
  return createPortal(
    <div ref={ref} id={pid} role={role} aria-label={label} className={'obs-fl-pop' + (className ? ' ' + className : '')} style={{ position: 'fixed', left: 0, top: 0 }}>{children}</div>,
    flutHost(),
  )
}

export function HoverTip({ show, anchor, children, id, className, pref = 'cima', align = 'meio', cx, maxW, ariaHidden }: {
  show: boolean; anchor: Anchor; children: ReactNode
  id?: string; className?: string; pref?: Side; align?: 'fim' | 'meio' | 'inicio'; cx?: number; maxW?: number
  /** true when the same words are already the trigger's accessible name or description. */
  ariaHidden?: boolean
}) {
  const client = useIsClient()
  const popover = useSyncExternalStore(subscribeFlut, currentFlut, () => null)
  const ref = useRef<HTMLDivElement>(null)
  const active = show && client && popover == null
  usePlacement(active, ref, anchor, { pref, align, cx, maxW }, () => {})
  if (!active) return null
  return createPortal(
    <div ref={ref} id={id} role="tooltip" aria-hidden={ariaHidden || undefined} className={'obs-fl-tip' + (className ? ' ' + className : '')} style={{ position: 'fixed', left: 0, top: 0 }}>{children}</div>,
    flutHost(),
  )
}
```

`C/_chrome/flut/flut.css`:

```css
/* Base das flutuantes do Observatório. Elas moram em #flut[data-obs], fora de [data-obs-screen]: as regras de cada
   flutuante são escritas com #flut na frente, no CSS da tela dona, e só usam variáveis de [data-obs] (chrome.css). */
#flut .obs-fl-pop,#flut .obs-fl-tip{box-sizing:border-box;margin:0;background:var(--surface);color:var(--text);border:1px solid var(--border-strong);border-radius:8px;box-shadow:var(--shadow);font:400 12.5px/1.45 Inter,var(--font-sans),system-ui,sans-serif;text-align:left}
#flut .obs-fl-tip{padding:9px 11px;border-radius:7px}
#flut .obs-fl-pop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
```

Em `C/layout.tsx`, acrescentar `import './_chrome/flut/flut.css'` depois dos imports da Tarefa 1.

- [ ] **Passo 4b: o teste "gatilho que some".** O `Popover` chama `onGone` no `useLayoutEffect` do render seguinte à remoção do gatilho. Se o teste falhar porque o componente `Some` não re-renderiza o `Popover`, **não mude o teste**: o `Popover` é filho de `Some` e re-renderiza com ele; investigue o `isConnected` do gatilho.

- [ ] **Passo 5: rodar e ver passar.** Mesmo comando do passo 2. Esperado: 10 testes passam. Depois `npx tsc --noEmit -p .` limpo.

- [ ] **Passo 6: commit.**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/flut" "apps/web/src/app/cms/(authed)/youtube/competitors/layout.tsx" apps/web/test/youtube/observatorio/flut.test.tsx
git commit -m "feat: camada única de dicas, popovers e menus do Observatório (A0.1)" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/flut" "apps/web/src/app/cms/(authed)/youtube/competitors/layout.tsx" apps/web/test/youtube/observatorio/flut.test.tsx
```

---

## Como migrar uma flutuante (vale para as Tarefas 4 a 8)

Cada tarefa de migração repete este roteiro; o que muda é a tabela dela.

1. **Marcação:** a flutuante deixa de ser filha do gatilho e passa a ser `<Popover>` ou `<HoverTip>` com `anchor={() => ref.current}`. A classe da caixa vai no `className`.
2. **CSS:** as regras da caixa trocam o prefixo de tela por `#flut` (ex.: `[data-obs-screen="canais"] .menu button` → `#flut .cn-menu button`) e perdem `position`, `top`, `right`, `bottom`, `left`, `transform` de posição, `z-index` e `display:none`. Achar todas: `grep -n '<classe antiga>' <arquivo.css>`.
3. **Variáveis:** `grep -o 'var(--[a-z0-9-]*)' ` nas regras movidas; toda variável que **não** está em `[data-obs]` de `C/_chrome/chrome.css` (linhas 7-20 e 21 em diante para o tema claro) é definida na regra `#flut .<classe>` com o valor literal dos dois temas (`[data-theme="light"] #flut .<classe>{...}`). É o item 2 do Foco de revisão.
4. **Comportamento duplicado:** os ouvintes de `mousedown`, `focusin` e `Escape` que a tela tinha para aquela flutuante saem (o armazém faz). O `onClose` do `Popover` só muda o estado da tela.
5. **Testes:** `grep -ln '<classe antiga>' apps/web/test/youtube/observatorio apps/web/e2e/tests/cms/observatorio`. Cada asserção que procurava a flutuante dentro da tela passa a procurar em `document.getElementById('flut')`; a asserção de conteúdo e de `role` fica igual. No **mesmo commit**.
6. **Verificar:** os testes da tela e `T/camadas-css.test.ts` (a catraca cai; **baixe `TETO_ANTIGOS`** para a contagem medida, que deve ser a que a tarefa anuncia, e diga o número no relatório), mais `npx tsc --noEmit -p .`.

---

### Tarefa 4: Canais — o "?" e o menu da linha

**Arquivos:**
- Modificar: `C/_canais/cells.tsx:36-44`, `C/_canais/row-menu.tsx`, `C/_canais/canais-screen.tsx` (linhas ~157-179 e ~399-406), `C/_canais/canais.css` (linhas 53-61, 207 e as regras de `.menu`)
- Testes: `T/canais-row-menu.test.tsx`, `T/canais-screen.test.tsx`, e os que o grep do roteiro achar; `E/canais.spec.ts` e `E/allowances.ts` se citarem `.tt` ou `.menu`

**Interfaces:**
- Consome: `Popover`, `HoverTip` (Tarefa 3).
- Produz: `Tip` com a mesma assinatura (`{ label, children, left? }`); `RowMenu` com as mesmas props; `placeMenu` **deixa de existir** (a posição é de `place.ts`).

| Hoje | Passa a ser |
|---|---|
| `<span class="tip"><span class="tt" role="tooltip">` (CSS `:hover`/`:focus`) | gatilho `.tip` com estado; `<HoverTip className="cn-tt" align={left ? 'fim' : 'meio'} pref="baixo" maxW={270}>` |
| `canais.css:59` e `:61` (conserto `45a9bbfb`: `td:first-child:has(.tip…){z-index:3}` e `tr:last-child .tip .tt`) | **removidas**, com os dois comentários: a camada resolve os dois casos e o da linha do meio |
| `<div class="menu on" role="menu" style="left:0;top:0">` medido à mão | `<Popover open className="cn-menu" role="menu" label="Ações do canal" anchor={() => rowMenuButton(row.id)}>` |

- [ ] **Passo 1: escrever os testes que falham.** Em `T/canais-screen.test.tsx`, acrescentar (use o `render` e a fixture que o arquivo já tem para montar a tela com pelo menos duas linhas):

```tsx
describe('Canais · flutuantes na camada única (A0.1)', () => {
  it('a dica do "?" não é descendente de célula nem de linha: abre em #flut no foco e some no blur', () => {
    const { container } = renderCanais()
    const q = container.querySelector<HTMLElement>('[data-obs-screen="canais"] td .tip')!
    expect(q.querySelector('[role="tooltip"]')).toBeNull()
    fireEvent.focus(q)
    const tip = document.querySelector('#flut .cn-tt')!
    expect(tip.closest('td, tr, table')).toBeNull()
    expect(q.getAttribute('aria-describedby')).toBe(tip.id)
    expect(tip.textContent!.length).toBeGreaterThan(10)
    fireEvent.blur(q)
    expect(document.querySelector('#flut .cn-tt')).toBeNull()
    expect(q.hasAttribute('aria-describedby')).toBe(false)
  })
  it('Esc com a dica aberta esconde a dica e mantém o foco no "?"', () => {
    const { container } = renderCanais()
    const q = container.querySelector<HTMLElement>('[data-obs-screen="canais"] td .tip')!
    q.focus(); fireEvent.focus(q)
    fireEvent.keyDown(q, { key: 'Escape' })
    expect(document.querySelector('#flut .cn-tt')).toBeNull()
    expect(document.activeElement).toBe(q)
  })
  it('o menu da linha mora em #flut; Esc fecha e devolve o foco ao botão ⋯', () => {
    const { container } = renderCanais()
    const btn = container.querySelector<HTMLElement>('[data-menu]')!
    fireEvent.click(btn)
    const menu = document.querySelector('#flut [role="menu"]')!
    expect(menu.classList.contains('cn-menu')).toBe(true)
    expect(container.querySelector('[role="menu"]')).toBeNull()
    fireEvent.keyDown(menu.querySelector('button')!, { key: 'Escape' })
    expect(document.querySelector('#flut [role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
})
```

`renderCanais` = o auxiliar de renderização que o arquivo já usa (o nome pode ser outro; use o existente, não crie um segundo). Acrescentar `afterEach(() => document.getElementById('flut')?.remove())` ao arquivo.

- [ ] **Passo 2: rodar e ver falhar.** `cd apps/web && npx vitest run test/youtube/observatorio/canais-screen.test.tsx`. Esperado: os 3 novos FALHAM (a dica ainda é filha do `span`).

- [ ] **Passo 3: `Tip`.** Em `C/_canais/cells.tsx`, trocar o `Tip` por:

```tsx
/** "?" help. The words open in the floating layer (#flut) on mouse and on focus; Esc hides them and keeps the focus. */
export function Tip({ label, children, left }: { label: string; children: ReactNode; left?: boolean }) {
  const id = useId()
  const el = useRef<HTMLSpanElement>(null)
  const [show, setShow] = useState(false)
  return (
    <span ref={el} className="tip" tabIndex={0} role="button" aria-label={label} aria-describedby={show ? id : undefined}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}
      onKeyDown={e => { if (e.key === 'Escape' && show) { e.stopPropagation(); setShow(false) } }}>
      <HoverTip show={show} anchor={() => el.current} id={id} className="cn-tt" pref="baixo" align={left ? 'fim' : 'meio'} maxW={270}>{children}</HoverTip>
    </span>
  )
}
```

Imports: `useId, useRef, useState, type ReactNode` de `react`; `HoverTip` de `'../_chrome/flut/flut'`.

- [ ] **Passo 4: `RowMenu`.** Em `C/_canais/row-menu.tsx`: apagar `placeMenu`, `GAP`, `EDGE`, `Box`, a função `place`, o `useLayoutEffect` e o `useEffect` de `resize`/`scroll`/`ResizeObserver`; manter `rowMenuButton`, o foco no primeiro item, `onKey` e os itens. O retorno passa a ser:

```tsx
  return (
    <Popover open anchor={() => rowMenuButton(row.id)} onClose={() => onClose(false)} className="cn-menu" role="menu" label="Ações do canal" align="fim">
      <div ref={ref} data-menu-for={row.id} onKeyDown={onKey}>
        {/* os mesmos botões e a nota de hoje, sem mudança */}
      </div>
    </Popover>
  )
```

O comentário do topo do arquivo é reescrito: a posição agora é da camada (`_chrome/flut`), que é filha do `<body>` e por isso não é capturada por nenhum ancestral da casca do CMS.

Em `C/_canais/canais-screen.tsx`: sai o `useEffect` de "Click outside closes the row menu" (linhas ~173-179) e o ramo `if (menu) { closeMenu(true); return }` do tratador de Esc (linha ~164): o armazém fecha o menu e devolve o foco. `closeMenu` continua existindo para os itens do menu (`onSync`, `onYoutube`, `onCopy`).

- [ ] **Passo 5: CSS.** Em `C/_canais/canais.css`, seguindo o roteiro: as regras de `.tip .tt` (linhas 55-57) viram `#flut .cn-tt{width:270px}` (o resto vem de `.obs-fl-tip`); as linhas 58-61 saem inteiras; `.menu` (linha 207) e suas regras filhas viram `#flut .cn-menu{min-width:230px;padding:4px}` e `#flut .cn-menu button{…}`, `#flut .cn-menu hr{…}`, `#flut .cn-menu .del{…}`, `#flut .cn-menu .cw{…}` com as mesmas declarações de hoje.

- [ ] **Passo 6: testes antigos.** `T/canais-row-menu.test.tsx`: os casos de `placeMenu` saem (a posição é coberta por `T/flut-place.test.ts`); os de teclado e de itens passam a procurar o menu em `#flut`. Rodar o grep do roteiro para `.tt`, `.menu`, `placeMenu`, `data-menu-for` e ajustar.

- [ ] **Passo 7: verificar.** `cd apps/web && npx vitest run test/youtube/observatorio -t canais > "$SCRATCH/t4.log" 2>&1` e os arquivos `canais-*.test.*` inteiros; `camadas-css.test.ts` com `TETO_ANTIGOS` baixado (saem 3 numéricos: `.tt` 40, `:has` 3, `.menu` 30 → 31); `tsc` limpo.

- [ ] **Passo 8: commit** (caminhos: os quatro de `_canais/`, os testes tocados, `camadas-css.test.ts`), mensagem `fix: dica e menu da lista de Canais na camada única (cobre a linha do meio no pé da janela)`.

---

### Tarefa 5: moldura — menu ⋯, "Frescor por canal" e a dica de "Fixar vídeo"

**Arquivos:**
- Modificar: `C/_chrome/menu.tsx`, `C/_chrome/freshness.tsx`, `C/_chrome/observatory-chrome.tsx:138-157`, `C/_chrome/pin-kit.tsx:104-131`, `C/_chrome/chrome.css` (linhas 76, 92, 106, 279-282)
- Testes: `T/chrome.test.tsx`, `T/pin-kit.test.tsx`, `T/chrome-fixed-layers.test.ts` (não muda, tem de continuar verde); `E/chrome.spec.ts`, `E/fixar.spec.ts` se citarem as classes

| Hoje | Passa a ser |
|---|---|
| `{open ? <div class="obs-ch-pop obs-ch-menu" id="obs-ch-menu" role="menu">` dentro de `.obs-ch-menu-wrap` | `<Popover open={open} anchor={() => btnRef.current} onClose={() => onClose(false)} id="obs-ch-menu" className="obs-ch-pop obs-ch-menu" role="menu" label="Mais ações" align="fim">` |
| `{open ? <FreshPopover/>}` com `<div class="obs-ch-pop" id="obs-ch-fresh-pop" role="dialog">` | `<Popover open={open} anchor={() => btnRef.current} onClose={onToggle} id="obs-ch-fresh-pop" className="obs-ch-pop" role="dialog" label="Frescor por canal" align="inicio">` com o mesmo miolo |
| `.fx-hint[data-open]` posicionada por CSS à esquerda do botão | o `span.fx-hint` **continua** (texto só para leitor de tela, com o `data-open` de estado); a caixa visível é `<HoverTip show={open} anchor={() => btn.current} className="fx-hint-pop" pref="lado" maxW={300} ariaHidden>` |

- [ ] **Passo 1: testes que falham.** Em `T/chrome.test.tsx`:

```tsx
describe('moldura · flutuantes na camada única (A0.1)', () => {
  it('o menu ⋯ abre em #flut e Esc devolve o foco ao botão', () => {
    const { container } = renderChrome()
    const btn = container.querySelector<HTMLElement>('.obs-ch-menu-wrap [aria-haspopup="menu"]')!
    fireEvent.click(btn)
    const menu = document.querySelector('#flut #obs-ch-menu')!
    expect(menu.getAttribute('role')).toBe('menu')
    expect(container.querySelector('#obs-ch-menu')).toBeNull()
    fireEvent.keyDown(menu.querySelector('[role="menuitem"]')!, { key: 'Escape' })
    expect(document.getElementById('obs-ch-menu')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
  it('clicar num item do menu não o fecha antes do clique (o menu não é mais filho da caixa do botão)', () => {
    const { container } = renderChrome()
    fireEvent.click(container.querySelector<HTMLElement>('.obs-ch-menu-wrap [aria-haspopup="menu"]')!)
    const item = document.querySelector<HTMLElement>('#flut #obs-ch-menu [role="menuitem"]')!
    fireEvent.mouseDown(item)
    expect(document.getElementById('obs-ch-menu')).not.toBeNull()
  })
  it('"Frescor por canal" abre em #flut; abrir o menu fecha o frescor', () => {
    const { container } = renderChrome()
    fireEvent.click(container.querySelector<HTMLElement>('.obs-ch-fresh > button')!)
    expect(document.querySelector('#flut #obs-ch-fresh-pop')).not.toBeNull()
    fireEvent.click(container.querySelector<HTMLElement>('.obs-ch-menu-wrap [aria-haspopup="menu"]')!)
    expect(document.getElementById('obs-ch-fresh-pop')).toBeNull()
    expect(document.getElementById('obs-ch-menu')).not.toBeNull()
  })
})
```

Em `T/pin-kit.test.tsx`:

```tsx
  it('a dica de "Fixar vídeo" visível mora em #flut; o texto para leitor de tela continua junto do botão', () => {
    const { container } = renderPin()   // o auxiliar que o arquivo já usa, com um vídeo não fixado
    const btn = container.querySelector<HTMLElement>('.fx-btn[data-pin-act="pin"]')!
    fireEvent.focus(btn)
    const sr = container.querySelector('.fx-hint')!
    expect(sr.hasAttribute('data-open')).toBe(true)
    const vis = document.querySelector('#flut .fx-hint-pop')!
    expect(vis.textContent).toBe(sr.textContent)
    expect(vis.getAttribute('aria-hidden')).toBe('true')
    fireEvent.blur(btn)
    expect(document.querySelector('#flut .fx-hint-pop')).toBeNull()
  })
```

- [ ] **Passo 2: rodar e ver falhar** (`chrome.test.tsx` e `pin-kit.test.tsx`).

- [ ] **Passo 3: implementar.** Conforme a tabela. Em `observatory-chrome.tsx`: o `useEffect` das linhas 144-153 (mousedown e focusin sobre `menuBox`/`freshBox`) **sai**; o ramo `Escape` de `onKey` (linha 156) **sai**; `close(focusBack)` fica para os itens do menu. `menuBox` e `freshBox` deixam de ter uso para fechar: remova as refs e as props `boxRef` de `Menu` e `Freshness` se nada mais as ler (`grep -n 'menuBox\|freshBox\|boxRef' C/_chrome`). Em `pin-kit.tsx`, `PinButton` ganha `const btn = useRef<HTMLButtonElement>(null)` no `<button ref={btn}>` e o `HoverTip` da tabela logo depois do `span.fx-hint`.

- [ ] **Passo 4: CSS** em `chrome.css`. Linha 92: tirar `position:absolute;z-index:40;top:calc(100% + 6px);left:0` de `.obs-ch-pop` (o resto fica: os seletores `[data-obs] .obs-ch-pop …` casam dentro de `#flut[data-obs]`). Linha 106: tirar `right:0;left:auto` de `.obs-ch-menu`. Linha 280: a regra `.fx-hint[data-open]` vira `[data-obs] .fx-hint-pop{width:300px;padding:8px 10px;border-radius:6px;font-size:12px;color:var(--muted)}`; as linhas 281-282 (media queries de posição) saem.

- [ ] **Passo 5: verificar.** Os dois arquivos de teste, `chrome-fixed-layers.test.ts`, `camadas-css.test.ts` com o teto baixado (saem 2: 40 e 30 → 29), `tsc`.

- [ ] **Passo 6: commit**, mensagem `fix: menu, frescor e dica de fixar da moldura do Observatório na camada única`.

---

### Tarefa 6: Mudanças — "Mais filtros"

**Arquivos:**
- Modificar: `C/_mudancas/filters.tsx:40-88`, `C/_mudancas/mudancas.css` (linha 134 e as regras de `.more`)
- Testes: `T/mudancas-screen.test.tsx`; `E/mudancas.spec.ts`

O `<details class="more">` com `.more-pop` dentro vira botão + `Popover` (o conteúdo de um `<details>` não pode sair dele).

- [ ] **Passo 1: teste que falha**, em `T/mudancas-screen.test.tsx`:

```tsx
  it('"Mais filtros" abre em #flut, mantém os controles e Esc devolve o foco ao botão', () => {
    const { container } = renderMudancas()
    const btn = container.querySelector<HTMLButtonElement>('.filters .more-btn')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    const pop = document.querySelector('#flut .mu-more-pop')!
    expect(pop.querySelector('#mu-fChannel')).not.toBeNull()
    expect(pop.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    fireEvent.mouseDown(pop.querySelector('#mu-fChannel')!)
    expect(document.querySelector('#flut .mu-more-pop')).not.toBeNull()
    fireEvent.keyDown(pop.querySelector('#mu-fChannel')!, { key: 'Escape' })
    expect(document.querySelector('#flut .mu-more-pop')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
```

- [ ] **Passo 2: ver falhar.**

- [ ] **Passo 3: implementar.** Em `filters.tsx`: sai o `useEffect` das linhas 40-46 e as refs `moreRef`/`moreSum`; entra `const moreBtn = useRef<HTMLButtonElement>(null)`. O bloco `<details>…</details>` vira:

```tsx
      <button ref={moreBtn} type="button" className={'more-btn' + (c.moreCount ? ' on' : '')} aria-expanded={more} aria-controls={more ? 'mu-more' : undefined}
        onClick={() => setMore(m => !m)}>{c.moreCount ? 'Mais filtros (' + c.moreCount + ')' : 'Mais filtros'}</button>
      <Popover open={more} anchor={() => moreBtn.current} onClose={() => setMore(false)} id="mu-more" className="mu-more-pop" role="group" label="Mais filtros" align="fim">
        {/* os três controles de hoje (Canal, Só com efeito medido, Só o swipe file), sem mudança */}
      </Popover>
```

- [ ] **Passo 4: CSS.** As regras `[data-obs-screen="mudancas"] .more summary…` passam a valer para `.more-btn` (mesmas declarações; some `list-style` e o marcador). `.more-pop` (linha 134) vira `#flut .mu-more-pop{min-width:260px;padding:12px;display:flex;flex-direction:column;gap:10px}`. As regras de `.field`, `.lbl`, `.sel` e `.check` que os controles usam são de `[data-obs-screen="mudancas"]`: copie-as com o prefixo `#flut .mu-more-pop` (roteiro, item 3 para as variáveis).

- [ ] **Passo 5: testes antigos e e2e** (`grep -n 'more-pop\|details\|summary' T/mudancas-*.test.tsx E/mudancas.spec.ts E/allowances.ts`), `camadas-css.test.ts` com o teto baixado (sai 1 → 28), `tsc`.

- [ ] **Passo 6: commit**, mensagem `fix: "Mais filtros" de Mudanças na camada única`.

---

### Tarefa 7: Outliers — o ⓘ do múltiplo e as dicas dos ícones

**Arquivos:**
- Modificar: `C/_outliers/outlier-card.tsx:50-71` e `:95-96`, `C/_outliers/outliers.css` (linhas 140-144, 166, 203)
- Testes: `T/outliers-screen.test.tsx`; `E/outliers.spec.ts`

| Hoje | Passa a ser |
|---|---|
| `.obs-out-tip` filha de `.obs-out-mult`, aberta por `:hover`/`:focus-visible` no CSS e por clique (`obs-out-open`) | estado `hover` e `open` no botão ⓘ: `<HoverTip show={hover && !open} …>` e `<Popover open={open} role="tooltip" …>`, os dois com `className="obs-out-tip"`, `id={id}`, `pref="baixo"`, `align="inicio"`, `maxW={320}` |
| `.obs-out-ib[data-tip]:hover:after` (pseudo-elemento dentro do cartão) | componente `IbLink` com estado e `<HoverTip className="obs-out-ibtip" pref="cima" align="fim" ariaHidden>` |

- [ ] **Passo 1: testes que falham**, em `T/outliers-screen.test.tsx`:

```tsx
describe('Outliers · flutuantes na camada única (A0.1)', () => {
  it('o ⓘ do múltiplo abre a conta em #flut por clique e fecha com Esc, com o foco de volta', () => {
    const { container } = renderOutliers()
    const info = container.querySelector<HTMLButtonElement>('.obs-out-info')!
    expect(container.querySelector('.obs-out-tip')).toBeNull()
    fireEvent.click(info)
    const tip = document.querySelector('#flut .obs-out-tip')!
    expect(tip.closest('.obs-out-card, td')).toBeNull()
    expect(info.getAttribute('aria-expanded')).toBe('true')
    expect(info.getAttribute('aria-describedby')).toBe(tip.id)
    fireEvent.keyDown(info, { key: 'Escape' })
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
    expect(document.activeElement).toBe(info)
  })
  it('passar o mouse no ⓘ mostra a mesma conta, sem abrir popover', () => {
    const { container } = renderOutliers()
    const info = container.querySelector<HTMLButtonElement>('.obs-out-info')!
    fireEvent.mouseEnter(info)
    expect(document.querySelector('#flut .obs-out-tip.obs-fl-tip')).not.toBeNull()
    expect(info.getAttribute('aria-expanded')).toBe('false')
    fireEvent.mouseLeave(info)
    expect(document.querySelector('#flut .obs-out-tip')).toBeNull()
  })
  it('a dica do ícone "Ver histórico do vídeo" abre em #flut no foco', () => {
    const { container } = renderOutliers()
    const a = container.querySelector<HTMLAnchorElement>('a.obs-out-ib[data-hist]')!
    fireEvent.focus(a)
    expect(document.querySelector('#flut .obs-out-ibtip')!.textContent).toBe('Ver histórico do vídeo')
    fireEvent.blur(a)
    expect(document.querySelector('#flut .obs-out-ibtip')).toBeNull()
  })
})
```

- [ ] **Passo 2: ver falhar.**

- [ ] **Passo 3: implementar.** `MultBlock`: sai o estado `off` e as classes `obs-out-open`/`obs-out-tipoff`; o botão ganha `ref`, `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` (estado `hover`) e mantém `onClick={() => setOpen(o => !o)}`; `aria-describedby={open || hover ? id : undefined}`. O `div.obs-out-tip` sai; no lugar, o `HoverTip` e o `Popover` da tabela, os dois com `<RichText parts={c.tip} />` e `onClose={() => setOpen(false)}`. O `onKeyDown` de Esc do `div` sai (o armazém fecha o popover; para o `HoverTip`, `onKeyDown` no botão: Esc → `setHover(false)`).

`IbLink` (no mesmo arquivo, usado nas duas âncoras das linhas 95-96; os atributos `data-hist`/`data-yt`, `aria-label`, `href`, `target`, `rel` passam por `...rest`):

```tsx
function IbLink({ tip, children, ...rest }: { tip: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const el = useRef<HTMLAnchorElement>(null)
  const [show, setShow] = useState(false)
  return (
    <a {...rest} ref={el} className="obs-out-ib" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      <HoverTip show={show} anchor={() => el.current} className="obs-out-ibtip" pref="cima" align="fim" ariaHidden>{tip}</HoverTip>
    </a>
  )
}
```

- [ ] **Passo 4: CSS.** `outliers.css:140-144`, `:166` e `:203` saem; entram:

```css
#flut .obs-out-tip{width:min(320px,80vw);background:#100E0B;border-radius:6px;padding:10px 12px;font-size:12px;color:var(--muted);line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.3)}
[data-theme="light"] #flut .obs-out-tip,[data-theme="light"] #flut .obs-out-ibtip{background:#FFFFFF}
#flut .obs-out-tip b{color:var(--text);font-weight:500}
#flut .obs-out-tip .obs-out-w{color:var(--warning-text)}
#flut .obs-out-ibtip{background:#100E0B;color:var(--text);font-size:11.5px;padding:4px 8px;border-radius:4px;white-space:nowrap}
```

(`#100E0B` e `#FFFFFF` são o `--tip-bg` de `.obs-out`, `outliers.css:6-7`, que não existe fora da tela.) A regra `.obs-out .obs-out-w` sozinha (fora da dica) continua.

- [ ] **Passo 5: testes antigos e e2e** (`grep -n 'obs-out-tip\|obs-out-open\|data-tip' T E`), `camadas-css.test.ts` com o teto baixado (saem 2 → 26), `tsc`.

- [ ] **Passo 6: commit**, mensagem `fix: conta do múltiplo e dicas de ícone de Outliers na camada única`.

---

### Tarefa 8: Histórico — dica da linha do tempo e lista de grupo (risco alto)

**Arquivos:**
- Modificar: `C/_historico/views-chart.tsx:49-95` e `:141-145`, `C/_historico/lanes.tsx:44-62` e `:199-246` (e o `wrapBlur`), `C/_historico/historico-screen.tsx:49`, `C/_historico/historico.css` (linhas 121 e seguintes de `.tip`; 410, 426 e 436 e seguintes de `.gpop`)
- Testes: `T/historico-screen.test.tsx`, `T/historico-fase4-screen.test.tsx`, `T/historico-fase4-css.test.ts`; `E/historico.spec.ts`, `E/muitas-versoes.spec.ts`

Esta tela está em produção e é aberta por quatro origens; a A2 vai mexer nela de novo. **Nada do que ela mostra muda:** mesmos textos, mesmos `id` (`hv-tip`), mesmas teclas. Se um teste existente exigir mudança de **expectativa de comportamento** (e não só de onde o elemento mora), pare e leve ao controlador.

| Hoje | Passa a ser |
|---|---|
| `<div class="tip [show]" id="hv-tip" role="tooltip">` sempre no DOM, com `left`/`top` calculados contra `.tl-wrap` | `<HoverTip show={!!tip} anchor={() => tip?.el ?? null} id="hv-tip" className="hv-tip" pref="cima" align="meio" maxW={310}>` com o mesmo miolo; `TipState` guarda `el: HTMLElement` no lugar de `px` e `laneTop`; saem `tipRef`, `tipTop`, `tw`, `tipLeft` e o `useLayoutEffect` da linha 64 |
| `<div class="gpop" hidden={!open}>` filho de `.gwrap`, com `left` corrigido contra `.tl-wrap` | `<Popover open={open} anchor={() => document.querySelector('[aria-controls="' + id + '"]')} onClose={onClose} id={id} className="hv-gpop gpop" role="group" label={title} pref="baixo" align="inicio" maxW={380}>` |

A cor da faixa (`--c`) que hoje chega por herança passa por `style` no miolo: `<div style={{ ['--c' as string]: TYPE_COLOR[tip.type] }}>` envolvendo o conteúdo da dica.

- [ ] **Passo 1: testes que falham**, em `T/historico-fase4-screen.test.tsx` (a fixture de muitas versões que o arquivo já usa tem grupos):

```tsx
describe('Histórico · flutuantes na camada única (A0.1)', () => {
  it('a dica do marcador mora em #flut com o mesmo id e some no blur', () => {
    const { container } = renderHistorico()
    const mk = container.querySelector<HTMLElement>('.lanes .mk')!
    expect(document.getElementById('hv-tip')).toBeNull()
    fireEvent.focus(mk)
    const tip = document.getElementById('hv-tip')!
    expect(tip.parentElement!.id).toBe('flut')
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(tip.textContent!.length).toBeGreaterThan(5)
    fireEvent.blur(mk)
    expect(document.getElementById('hv-tip')).toBeNull()
  })
  it('a lista de um grupo abre em #flut no Enter, nunca no foco; as setas andam nas linhas; Esc devolve o foco ao contador', () => {
    const { container } = renderHistorico()
    const g = container.querySelector<HTMLButtonElement>('.lanes .gbtn')!
    g.focus(); fireEvent.focus(g)
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    fireEvent.click(g)
    const pop = document.querySelector('#flut .hv-gpop')!
    expect(pop.id).toBe(g.getAttribute('aria-controls'))
    const linhas = pop.querySelectorAll<HTMLButtonElement>('button')
    expect(linhas.length).toBeGreaterThan(1)
    linhas[0]!.focus()
    expect(document.querySelector('#flut .hv-gpop')).not.toBeNull()   // o foco dentro da lista não a fecha
    fireEvent.keyDown(linhas[0]!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(linhas[1])
    fireEvent.keyDown(linhas[1]!, { key: 'Escape' })
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    expect(document.activeElement).toBe(g)
  })
  it('escolher uma linha do grupo seleciona a troca e fecha a lista', () => {
    const { container } = renderHistorico()
    fireEvent.click(container.querySelector<HTMLButtonElement>('.lanes .mkg.gbtn')!)
    const linha = document.querySelector<HTMLButtonElement>('#flut .hv-gpop button[data-pair]')!
    const par = linha.getAttribute('data-pair')
    fireEvent.click(linha)
    expect(document.querySelector('#flut .hv-gpop')).toBeNull()
    expect(container.querySelector('#hv-compare')!.innerHTML).toContain(par!)
  })
})
```

Se `#hv-compare` não carregar o id da troca no HTML, troque a última asserção pela que o teste existente de "escolher troca no grupo" já usa (procure `data-pair` em `T/historico-fase4-screen.test.tsx`); não invente outra.

- [ ] **Passo 2: ver falhar.**

- [ ] **Passo 3: implementar `views-chart.tsx`** conforme a tabela. `onMarker` e `onGroupTip` passam a guardar `el` no estado. O ouvinte de Esc das linhas 67-71 fica (fecha a dica de mouse). `aria-describedby="hv-tip"` nos marcadores fica como está.

- [ ] **Passo 4: implementar `lanes.tsx`.** O `useEffect` das linhas 50-62 (Esc e mousedown) **sai**: o `Popover` chama `onClose={() => setOpen(null)}` e devolve o foco ao contador. `GroupPop` vira o `Popover` da tabela e perde o estado `left` e o `useLayoutEffect`. O `wrapBlur` passa a tratar a lista como parte do grupo:

```ts
  const wrapBlur = (e: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => {
    const to = e.relatedTarget as Node | null
    // the list lives in #flut now: focus moving into it is still "inside the group"
    if (to && (e.currentTarget.contains(to) || document.getElementById('flut')?.contains(to))) return
    setOpen(null)
  }
```

(adapte ao corpo atual de `wrapBlur`: a única mudança é a segunda condição). O `onKeys` não muda: eventos de teclado do React sobem pela árvore do React, e a lista continua filha de `Lanes` nela. Em `historico-screen.tsx:49`, o seletor `.gwrap.open, .tip.show` vira a pergunta `currentFlut() != null || document.getElementById('hv-tip') != null` (import de `'../_chrome/flut/store'`).

- [ ] **Passo 5: CSS.** `.tip` e filhos → `#flut .hv-tip` (sem `position`, `z-index`, `opacity`, `transform`, `transition`, `pointer-events`; com `width:310px`); `.tip.show` sai. `.gpop` e filhos → `#flut .hv-gpop` (sem `position`, `top`, `left`, `z-index`, `display`); `.gwrap.open{z-index:20}` (410 e 426) sai. Variáveis: `--shadow-pop`, `--well` e as cores de tipo são de `[data-obs-screen="historico"]` (`historico.css:7-17`): definir em `#flut .hv-tip,#flut .hv-gpop{…}` e na variante `[data-theme="light"]` as que as regras movidas usam, com os mesmos valores literais.

- [ ] **Passo 6: testes antigos.** `grep -n '\.tip\b\|hv-tip\|gpop\|gwrap.open' T/historico*.test.* E/historico.spec.ts E/muitas-versoes.spec.ts`. Em `E/muitas-versoes.spec.ts`, a checagem "a lista do grupo fica dentro da linha do tempo" passa a ser "fica inteira dentro da janela" (é a regra nova, 19.1); o filtro `!e.closest('.gpop, …')` da linha ~50 continua válido. `T/historico-fase4-css.test.ts` pode afirmar declarações de `.gpop`: ajustar o seletor para `#flut .hv-gpop`.

- [ ] **Passo 7: verificar.** Todos os `T/historico*.test.*`, `T/many-versions.test.ts`, `T/lane-layout.test.ts`; `camadas-css.test.ts` com o teto baixado (saem 4: `.tip` 10, `.gwrap.open` 20 duas vezes, `.gpop` 21 → 22); `tsc`.

- [ ] **Passo 8: commit**, mensagem `fix: dica e lista de grupo da linha do tempo do Histórico na camada única`.

---

### Tarefa 9: a prova das flutuantes, no navegador (A0.1, aceite 3)

**Arquivos:**
- Criar: `E/flutuantes.spec.ts`
- Saída: o resumo vai para o ledger

**Interfaces:**
- Consome: as classes e ids das Tarefas 4 a 8; `ADMIN_STATE`, `ensureSeeded`, `seedIdsOf` de `E/fidelity.ts`; `MANY_VERSIONS_ID`.

- [ ] **Passo 1: escrever a prova.** `E/flutuantes.spec.ts`:

```ts
// apps/web/e2e/tests/cms/observatorio/flutuantes.spec.ts
// A prova das flutuantes (spec de telas v9, 19.1, aceite 3; modelo: prova-flutuantes.js do mockup aprovado). Para cada
// flutuante, com o gatilho no centro da janela, colado embaixo e colado em cima: (a) elementsFromPoint no centro e nos
// quatro cantos devolve a própria caixa, (b) a caixa está inteira na janela, (c) mora em #flut, filho do <body>, e não
// cobre o gatilho, (d) Esc fecha e, nos popovers de clique, o foco volta ao gatilho, (e) o fundo não é transparente
// (uma variável de tela que não chega a #flut falha em silêncio). Em 1440 e 390 px, nos dois temas.
// Controle negativo: uma caixa absolute numa célula da última linha, com z-index alto, TEM de reprovar.
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STATE, ensureSeeded, seedIdsOf, THEMES } from './fidelity'
import { MANY_VERSIONS_ID } from '../../../fixtures/observatorio-seed'

test.use({ storageState: ADMIN_STATE })
let ids: ReturnType<typeof seedIdsOf>
test.beforeAll(async () => { ids = seedIdsOf(await ensureSeeded({ manyVersions: true })) })

type Modo = 'clique' | 'foco'
interface Familia { id: string; gatilho: string; modo: Modo; caixa: string; max?: number }
const TELAS: Array<{ nome: string; url: () => string; familias: Familia[] }> = [
  { nome: 'canais', url: () => '/cms/youtube/competitors', familias: [
    { id: '"?" da tabela', gatilho: '[data-obs-screen="canais"] td .tip', modo: 'foco', caixa: '#flut .cn-tt', max: 8 },
    { id: 'menu da linha', gatilho: '[data-obs-screen="canais"] [data-menu]', modo: 'clique', caixa: '#flut .cn-menu', max: 6 },
    { id: 'menu ⋯ da moldura', gatilho: '.obs-ch-menu-wrap [aria-haspopup="menu"]', modo: 'clique', caixa: '#flut #obs-ch-menu' },
    { id: 'frescor por canal', gatilho: '.obs-ch-fresh > button', modo: 'clique', caixa: '#flut #obs-ch-fresh-pop' },
  ] },
  { nome: 'outliers', url: () => '/cms/youtube/competitors/outliers', familias: [
    { id: 'ⓘ do múltiplo', gatilho: '.obs-out-info', modo: 'clique', caixa: '#flut .obs-out-tip', max: 6 },
    { id: 'dica de ícone', gatilho: 'a.obs-out-ib', modo: 'foco', caixa: '#flut .obs-out-ibtip', max: 6 },
    { id: 'fixar vídeo', gatilho: '.fx-btn[data-pin-act="pin"]', modo: 'foco', caixa: '#flut .fx-hint-pop', max: 4 },
  ] },
  { nome: 'mudancas', url: () => '/cms/youtube/competitors/mudancas', familias: [
    { id: 'mais filtros', gatilho: '.filters .more-btn', modo: 'clique', caixa: '#flut .mu-more-pop' },
  ] },
  { nome: 'historico', url: () => '/cms/youtube/competitors/video/' + ids.video(MANY_VERSIONS_ID), familias: [
    { id: 'marcador da linha do tempo', gatilho: '.lanes .mk', modo: 'foco', caixa: '#hv-tip', max: 8 },
    { id: 'lista de grupo', gatilho: '.lanes .gbtn', modo: 'clique', caixa: '#flut .hv-gpop', max: 6 },
  ] },
]
const LARGURAS = [1440, 390] as const
const POS = [['centro', 'center'], ['colado embaixo', 'end'], ['colado em cima', 'start']] as const

interface Res { ok: boolean; dentro: boolean; topo: boolean; cobre: boolean; noFlut: boolean; fundo: boolean; quem: string }
/** Roda no navegador. As dicas de mouse têm pointer-events:none: a prova liga durante a medida, senão elementsFromPoint não as vê. */
async function conferir(page: Page, gatilho: string, n: number, caixa: string): Promise<Res> {
  return page.evaluate(({ gatilho, n, caixa }) => {
    const g = document.querySelectorAll<HTMLElement>(gatilho)[n]!, tip = document.querySelector<HTMLElement>(caixa)
    if (!tip) return { ok: false, dentro: false, topo: false, cobre: false, noFlut: false, fundo: false, quem: 'a flutuante não abriu' }
    const st = document.createElement('style'); st.textContent = '#flut>*{pointer-events:auto!important}'; document.head.appendChild(st)
    const r = tip.getBoundingClientRect(), W = document.documentElement.clientWidth, H = innerHeight
    const dentro = r.width > 0 && r.height > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5
    let topo = true, quem = ''
    for (const [px, py] of [[(r.left + r.right) / 2, (r.top + r.bottom) / 2], [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]]) {
      const x = Math.min(Math.max(px!, 0), W - 1), y = Math.min(Math.max(py!, 0), H - 1), t = document.elementsFromPoint(x, y)[0]
      if (!(t && (t === tip || tip.contains(t)))) { topo = false; quem = (t ? t.tagName + '.' + String((t as HTMLElement).className) : 'nada') + ' em ' + Math.round(x) + ',' + Math.round(y) }
    }
    st.remove()
    const b = g.getBoundingClientRect()
    const cobre = !(r.right <= b.left + 0.5 || r.left >= b.right - 0.5 || r.bottom <= b.top + 0.5 || r.top >= b.bottom - 0.5)
    const flut = tip.closest('#flut'), noFlut = !!flut && flut.parentNode === document.body
    const bg = getComputedStyle(tip).backgroundColor, m = bg.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',').map(s => parseFloat(s)) ?? []
    const fundo = m.length === 3 || (m.length === 4 && m[3]! > 0.9)
    return { ok: dentro && topo && !cobre && noFlut && fundo, dentro, topo, cobre, noFlut, fundo, quem }
  }, { gatilho, n, caixa })
}

/** Índices dos gatilhos visíveis, espalhados do primeiro ao último, no máximo `max`. */
async function amostra(page: Page, gatilho: string, max = 3): Promise<number[]> {
  const vis = await page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(sel)].map((e, i) => (e.getBoundingClientRect().width > 0 ? i : -1)).filter(i => i >= 0), gatilho)
  if (vis.length <= max) return vis
  return Array.from({ length: max }, (_, k) => vis[Math.round(k * (vis.length - 1) / (max - 1))]!)
}

for (const tema of THEMES) for (const largura of LARGURAS) for (const tela of TELAS) {
  test(`${tela.nome} · ${largura} px · ${tema}: toda flutuante acima do conteúdo e dentro da janela`, async ({ page }) => {
    await page.context().addCookies([{ name: 'btf_theme', value: tema, url: 'http://localhost:3099' }])
    await page.setViewportSize({ width: largura, height: 900 })
    await page.goto(tela.url())
    await page.locator('[data-obs-screen]').first().waitFor()
    await page.waitForLoadState('networkidle')
    const falhas: string[] = []
    let total = 0
    for (const f of tela.familias) {
      for (const n of await amostra(page, f.gatilho, f.max)) {
        const g = page.locator(f.gatilho).nth(n)
        for (const [pos, bloco] of POS) {
          await g.evaluate((e, b) => e.scrollIntoView({ block: b as ScrollLogicalPosition, inline: 'nearest' }), bloco)
          if (!(await g.isVisible())) continue
          await g.evaluate(e => { (e as HTMLElement).blur(); (e as HTMLElement).focus({ preventScroll: true }) })
          if (f.modo === 'clique') await g.click()
          await page.waitForTimeout(80)
          total++
          const r = await conferir(page, f.gatilho, n, f.caixa)
          if (!r.ok) falhas.push(`${f.id} #${n} ${pos}: ${JSON.stringify(r)}`)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(40)
          if (await page.locator(f.caixa).count()) falhas.push(`${f.id} #${n} ${pos}: Esc não fechou`)
          if (f.modo === 'clique' && !(await g.evaluate(e => document.activeElement === e))) falhas.push(`${f.id} #${n} ${pos}: o foco não voltou ao gatilho`)
          await g.evaluate(e => (e as HTMLElement).blur())
        }
      }
    }
    console.info(`[prova-flutuantes] ${tela.nome} ${largura} ${tema}: ${total - falhas.length} de ${total}`)
    expect(total, 'nenhuma flutuante foi exercitada: o seletor do gatilho mudou?').toBeGreaterThan(0)
    expect(falhas).toEqual([])
  })
}

test('controle negativo: uma caixa absolute numa célula da última linha, com z-index alto, reprova', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/cms/youtube/competitors')
  await page.locator('[data-obs-screen="canais"] tbody tr').first().waitFor()
  await page.evaluate(() => {
    const td = document.querySelector<HTMLElement>('[data-obs-screen="canais"] tbody tr:last-child td:first-child')!
    td.scrollIntoView({ block: 'end' })
    const g = document.createElement('button'); g.id = 'neg-g'; g.textContent = '?'; td.appendChild(g)
    const c = document.createElement('div'); c.id = 'neg-caixa'
    c.style.cssText = 'position:absolute;z-index:9999;top:30px;left:0;width:270px;height:160px;background:#221E1A'
    td.appendChild(c)
  })
  const r = await conferir(page, '#neg-g', 0, '#neg-caixa')
  expect(r.ok).toBe(false)
  expect(r.noFlut).toBe(false)
})

test('uma aberta por vez e clique fora, na tela de verdade', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/cms/youtube/competitors')
  await page.locator('.obs-ch-fresh > button').click()
  await page.locator('.obs-ch-menu-wrap [aria-haspopup="menu"]').click()
  expect(await page.locator('#flut > *').count()).toBe(1)
  await page.mouse.click(5, 895)
  expect(await page.locator('#flut > *').count()).toBe(0)
})
```

- [ ] **Passo 2: rodar em fundo.** `npm run db:start`; `cd apps/web && npx playwright test --project=observatorio e2e/tests/cms/observatorio/flutuantes.spec.ts > "$SCRATCH/prova-flutuantes.log" 2>&1`. Esperado: 18 testes passam (4 telas × 2 larguras × 2 temas = 16, mais 2). Ler só `grep -n 'prova-flutuantes\|✘\|failed\|passed' "$SCRATCH/prova-flutuantes.log"`.

- [ ] **Passo 3: tratar o que reprovar.** Falha de `fundo` = variável de tela que não chegou a `#flut` (roteiro de migração, item 3): corrigir o CSS da tarefa dona. Falha de `topo` ou `dentro` = defeito de posição: corrigir em `flut.tsx`/`place.ts` **com um caso novo em `T/flut-place.test.ts`** que reproduza os números. Seletor de gatilho que não acha nada numa tela = ajustar o seletor da prova, nunca apagar a família. Se o cookie do tema tiver outro nome que `btf_theme`, usar o que `E/fidelity.ts` usa para alternar tema.

- [ ] **Passo 4: registrar.** Copiar as linhas `[prova-flutuantes] …` (16) para o ledger, com o total geral e o resultado do controle negativo.

- [ ] **Passo 5: commit** (`E/flutuantes.spec.ts` e o que o passo 3 tiver corrigido), mensagem `test: prova das flutuantes no navegador, com controle negativo (A0.1)`.

---

### Tarefa 10: carregador — nulos de verdade, vídeos sem data e `loadChannelDataset` (A0.4)

**Arquivos:**
- Modificar: `L/types.ts:14-56`, `L/load.ts:232-320` e `:492-519`, `L/load-page.ts:59-83`, `L/channels.ts:117`, `apps/web/src/lib/pipeline/services/competitors.ts:298`
- Testes: `T/load-videos.test.ts`, `T/load-page.test.ts`, `T/load-measure.test.ts`, `T/channels.test.ts`

**Interfaces:**
- Produz:

```ts
// L/types.ts
export interface UndatedVideo {
  id: string; ytId: string; title: string; url: string
  isShort: boolean | null; dur: number | null; views: number | null; likes: number | null; comments: number | null
  pinned: boolean; checkedAt: number | null
}
// ObsVideo: `comments: number | null` e `isShort: boolean | null` (novo, obrigatório)
// ObsChannel: `undated: UndatedVideo[]` (novo, obrigatório; lista vazia = nenhum vídeo sem data)

// L/load.ts
export async function loadChannelLiveRows(sb: SupabaseClient, siteId: string, channelId: string, now: number): Promise<(LiveRows & { seriesStartAt: number | null }) | null>

// L/load-page.ts
/** Dataset de UM canal (concorrente ou próprio) deste site. null = o id não é de um canal deste site. */
export async function loadChannelDataset(siteId: string, channelId: string, now: number): Promise<Dataset | null>
```

Quem chama `loadChannelDataset` (a rota `canal/<id>`, na A1) faz a guarda de acesso antes, como `openObservatoryPage`: ele lê com o cliente de serviço. O `siteId` vem de `getSiteContext()`; o `channelId` vem da URL e por isso é **conferido contra o site dentro da função**.

- [ ] **Passo 1: testes de nulo que falham.** Em `T/load-videos.test.ts` (use `buildTables`, `ids` e `fakeSupabase` como o arquivo já usa; `S` = site, `NOW` = relógio do arquivo):

```ts
describe('rowsToDataset · nulo nunca vira padrão (spec de telas 5.10)', () => {
  const montar = async (mexer: (t: Record<string, Row[]>) => void) => {
    const tables = buildTables({ siteId: S, now: NOW, channels: 1, videosPerChannel: 4 })
    mexer(tables)
    return rowsToDataset(await loadRows({ siteId: S, now: NOW, supabase: fakeSupabase(tables).client }), NOW)
  }
  const video = (t: Record<string, Row[]>, k: number) => t.competitor_videos!.find(v => v.id === ids.video(S, 0, k))!

  it('comment_count nulo fica nulo', async () => {
    const ds = await montar(t => { video(t, 0).comment_count = null })
    expect(ds.videos.find(v => v.id === ids.video(S, 0, 0))!.comments).toBeNull()
  })
  it('is_short nulo fica nulo em isShort; o fmt continua "long" para o motor', async () => {
    const ds = await montar(t => { video(t, 1).is_short = null })
    const v = ds.videos.find(x => x.id === ids.video(S, 0, 1))!
    expect(v.isShort).toBeNull()
    expect(v.fmt).toBe('long')
  })
  it('is_short verdadeiro e falso passam como estão', async () => {
    const ds = await montar(t => { video(t, 1).is_short = true; video(t, 2).is_short = false })
    expect(ds.videos.find(x => x.id === ids.video(S, 0, 1))!.isShort).toBe(true)
    expect(ds.videos.find(x => x.id === ids.video(S, 0, 2))!.isShort).toBe(false)
  })
  it('vídeo sem data não some: sai de videos e entra em channel.undated, com os campos brutos', async () => {
    const ds = await montar(t => { const v = video(t, 3); v.published_at = null; v.comment_count = null; v.is_short = null })
    expect(ds.videos.some(v => v.id === ids.video(S, 0, 3))).toBe(false)
    const u = ds.channels[0]!.undated
    expect(u).toHaveLength(1)
    expect(u[0]).toMatchObject({ id: ids.video(S, 0, 3), isShort: null, comments: null, pinned: false })
    expect(u[0]!.url).toContain(u[0]!.ytId)
  })
  it('canal sem vídeo sem data: lista vazia, nunca ausente', async () => {
    const ds = await montar(() => {})
    expect(ds.channels[0]!.undated).toEqual([])
  })
})
```

Em `T/channels.test.ts`, com o construtor de dataset que o arquivo já usa:

```ts
  it('comentário nulo fora da base do engajamento: não vira likes / views', () => {
    // dois longos de 30 dias, mesmas views e curtidas; num deles o YouTube não devolveu a contagem de comentários
    const comBase = engajamentoDe([{ views: 1000, likes: 50, comments: 10 }, { views: 1000, likes: 50, comments: 10 }])
    const comNulo = engajamentoDe([{ views: 1000, likes: 50, comments: 10 }, { views: 1000, likes: 50, comments: null }])
    expect(comNulo.n).toBe(comBase.n - 1)
    expect(comNulo.value).toBe(comBase.value)   // a mediana é a do vídeo que tem os dois números
  })
```

`engajamentoDe` = um auxiliar local do teste que monta um canal com esses vídeos (`tracked`, `fmt: 'long'`, `ageDays: 30`) e devolve o que `channelStats(...)` dá para o engajamento (valor e `n`). Leia `L/channels.ts:100-130` para os nomes exatos dos campos antes de escrever o auxiliar.

- [ ] **Passo 2: ver falhar** (`tsc` acusa `isShort`/`undated` inexistentes; os testes falham).

- [ ] **Passo 3: tipos.** Em `L/types.ts`: acrescentar `UndatedVideo`; em `ObsVideo`, `comments: number | null` com o comentário `/** null = o YouTube não devolveu a contagem: "não medido", nunca 0 */` e, ao lado de `fmt`, `/** competitor_videos.is_short como está guardado. null = formato não confirmado; `fmt` continua 'long' para o motor. */ isShort: boolean | null`; em `ObsChannel`, `/** Vídeos guardados sem published_at: ficam fora de `videos` (não têm idade nem múltiplo) e a tela os lista no fim. */ undated: UndatedVideo[]`.

- [ ] **Passo 4: `rowsToDataset`.** Em `L/load.ts`, no laço dos concorrentes:

```ts
    const all = (videosBy.get(c.id) ?? []).map(v => ({ v, pub: ms(v.published_at) }))
    // a video without published_at cannot be aged or banded: it stays out of `videos` and is listed in `undated`
    const vs = all.filter((x): x is { v: VideoRow; pub: number } => x.pub != null).sort((a, b) => b.pub - a.pub)
    const undated: UndatedVideo[] = all.filter(x => x.pub == null).map(({ v }) => ({
      id: v.id, ytId: v.video_id, title: v.title ?? '', isShort: v.is_short ?? null, dur: v.duration_seconds,
      url: v.is_short ? 'https://www.youtube.com/shorts/' + v.video_id : 'https://www.youtube.com/watch?v=' + v.video_id,
      views: v.view_count, likes: v.like_count, comments: v.comment_count, pinned: v.pinned_at != null, checkedAt: ms(v.last_checked_at),
    }))
```

No `videos.push` dos concorrentes: `comments: v.comment_count` (sem `?? 0`) e `isShort: v.is_short ?? null`. No `channels.push` dos concorrentes: `undated`. Nos canais próprios: `isShort: ownIsShort(v)` no `videos.push`; a lista sem data com o mesmo formato (`isShort: ownIsShort(v)`, `pinned: false`, `checkedAt: ms(v.updated_at)`); `undated` no `channels.push`.

- [ ] **Passo 5: leitores.** `L/channels.ts:117`: a base do engajamento ganha `&& v.comments != null` e a conta usa `v.comments!`. `apps/web/src/lib/pipeline/services/competitors.ts:298`: `comment_count: it.video.comments` passa a poder ser `null`; se o tipo `CompetitorOutlierRow.comment_count` for `number`, mude-o para `number | null` e confira o schema Zod e o doc do endpoint (`apps/web/data/pipeline-docs/cowork-docs-*.md`): se o schema mudar, atualize o doc no mesmo commit (regra "Pipeline Integrity" do CLAUDE.md). Depois `npx tsc --noEmit -p .`: cada construtor de `ObsVideo`/`ObsChannel` em fixture ou oráculo (`T/oracle.ts`, `T/fase4-world.ts`, `apps/web/test/fixtures/observatorio/…`) recebe `isShort: fmt === 'short'` e `undated: []`. Nenhum outro leitor muda de comportamento.

- [ ] **Passo 6: testes de `loadChannelDataset` que falham.** Em `T/load-page.test.ts` (com o `setup` do arquivo):

```ts
describe('loadChannelDataset — um canal só', () => {
  const tabelas = () => buildTables({ siteId: 'a', now: NOW, channels: 3, videosPerChannel: 4 })
  it('igual ao recorte do site inteiro para o mesmo canal', async () => {
    const { loadChannelDataset, loadPageDataset } = await setup(tabelas())
    const id = ids.channel('a', 1)
    const site = await loadPageDataset('a', NOW), um = (await loadChannelDataset('a', id, NOW))!
    expect(um.channels).toEqual(site.channels.filter(c => c.id === id))
    expect(um.videos).toEqual(site.videos.filter(v => v.ch === id))
    expect(um.videos.length).toBeGreaterThan(0)
  })
  it('não lê os outros canais: uma ida a cada tabela pesada, contra três do site inteiro', async () => {
    const { loadChannelDataset, db } = await setup(tabelas())
    await loadChannelDataset('a', ids.channel('a', 1), NOW)
    expect(db.trips.filter(t => t === 'competitor_videos')).toHaveLength(1)
    expect(db.trips.filter(t => t === 'competitor_channel_snapshots')).toHaveLength(1)
  })
  it('usa o mesmo pacote do cache que a lista de canais já guardou: zero leitura pesada', async () => {
    const { loadChannelDataset, loadPageRows, db } = await setup(tabelas())
    await loadPageRows('a', NOW)
    const antes = heavy(db)
    await loadChannelDataset('a', ids.channel('a', 1), NOW)
    expect(heavy(db) - antes).toBe(0)
  })
  it('canal de outro site: null e nenhuma leitura pesada', async () => {
    const { loadChannelDataset, db } = await setup(merged(tabelas(), buildTables({ siteId: 'b', now: NOW, channels: 1, videosPerChannel: 4 })))
    expect(await loadChannelDataset('a', ids.channel('b', 0), NOW)).toBeNull()
    expect(heavy(db)).toBe(0)
  })
  it('id que não existe: null', async () => {
    const { loadChannelDataset } = await setup(tabelas())
    expect(await loadChannelDataset('a', '00000000-0000-4000-8000-000000000000', NOW)).toBeNull()
  })
  it('falha de banco lança e nada é guardado (nunca um canal vazio)', async () => {
    const { loadChannelDataset, cache } = await setup(tabelas(), { failOn: 'competitor_videos' })
    await expect(loadChannelDataset('a', ids.channel('a', 1), NOW)).rejects.toThrow()
    expect(cache.entries.size).toBe(0)
  })
})
```

Canal próprio: acrescentar um caso com a opção que `buildTables` tem para canais próprios (veja `FixtureOpts` em `T/load-fixture.ts` e `T/load-own-channels.test.ts`): `loadChannelDataset('a', <id do canal próprio>, NOW)` devolve `channels` com um canal `own: true`, `videos` só dele com `series: []`, e nenhuma ida a `competitor_videos`. Se a fixture não tiver canal próprio, acrescente a opção `ownChannels?: number` a `FixtureOpts` seguindo o formato de `OwnChannelRow`/`OwnVideoRow` de `L/load.ts:23-34`.

- [ ] **Passo 7: implementar a leitura viva de um canal.** Em `L/load.ts`, depois de `loadLiveRows`:

```ts
/**
 * The live rows of ONE channel of this site: the site's settings, niches and forja queue as loadLiveRows reads them,
 * and only this channel's row (a competitor, or an own channel with its videos). null = `channelId` is not a channel
 * of `siteId`; the id comes from a URL, so the site filter here is the access boundary.
 */
export async function loadChannelLiveRows(sb: SupabaseClient, siteId: string, channelId: string, now: number): Promise<(LiveRows & { seriesStartAt: number | null }) | null> {
  const ch = await sb.from('competitor_channels').select(CHANNEL_COLS).eq('site_id', siteId).eq('id', channelId).maybeSingle()
  if (ch.error) throw new ObservatoryLoadError('competitor_channels', ch.error.code, ch.error.message)
  const channel = (ch.data as ChannelRow | null) ?? null
  const own = channel ? null : (await readOwnChannels(sb, siteId)).find(c => c.id === channelId) ?? null
  if (!channel && !own) return null

  const st = await sb.from('competitor_settings').select('series_started_at, channel_limit').eq('site_id', siteId).maybeSingle()
  if (st.error) throw new ObservatoryLoadError('competitor_settings', st.error.code, st.error.message)
  const settings = (st.data as SettingsRow | null) ?? null
  const ssAt = ms(settings?.series_started_at)

  const [ownVideos, legacyChanges, readings, tasks, heartbeats, niches] = await Promise.all([
    own ? readAll<OwnVideoRow>('youtube_videos', () => sb.from('youtube_videos').select(OWN_VIDEO_COLS).eq('site_id', siteId).eq('channel_id', channelId).eq('is_hidden', false).order('id')) : Promise.resolve([] as OwnVideoRow[]),
    channel ? readAll<LegacyChangeRow>('competitor_changes', () => sb.from('competitor_changes').select('id, video_id, change_type, old_title, new_title, detected_at')
      .eq('site_id', siteId).is('from_version_id', null).in('change_type', ['title', 'description']).order('id')) : Promise.resolve([] as LegacyChangeRow[]),
    readAll<ReadingRow>('competitor_readings', () => sb.from('competitor_readings').select('id, task_id, task_type, niche, video_id, fmt, model, generated_at, sent, analysis, text, evidence')
      .eq('site_id', siteId).gte('generated_at', new Date(now - READING_DAYS * DAY).toISOString()).order('id')),
    readAll<TaskRow>('youtube_intelligence_tasks', () => sb.from('youtube_intelligence_tasks').select(TASK_COLS)
      .eq('site_id', siteId).in('task_type', [...OBS_TASK_TYPES]).gte('requested_at', new Date(now - TASK_DAYS * DAY).toISOString()).order('id')),
    readAll<HeartbeatRow>('forja_heartbeat', () => sb.from('forja_heartbeat').select('last_poll_at, capabilities').eq('site_id', siteId).order('site_id')),
    readNiches(sb, siteId),
  ])
  return {
    settings, channels: channel ? [channel] : [], ownChannels: own ? [own] : [], ownVideos, legacyChanges, readings, tasks,
    heartbeat: heartbeats[0] ?? null, niches, seriesStartAt: ssAt != null ? spDayStart(ssAt) : null,
  }
}
```

Redução das trocas antigas: rode `grep -n 'competitor_changes: {' -A 30 apps/web/src/types/database.types.ts | grep competitor_channel_id`. Se a coluna existir, acrescente `.eq('competitor_channel_id', channelId)` à leitura de `competitor_changes`; se não existir, a leitura fica do site (o `rowsToDataset` ignora as trocas de vídeos que não estão no conjunto) e isso vai para o relatório.

- [ ] **Passo 8: implementar `loadChannelDataset`.** Em `L/load-page.ts`, extrair de `loadPageRows` a leitura de um canal e usá-la nos dois:

```ts
/** One channel's heavy rows: the stored pack when it can be trusted, the database otherwise. */
async function readChannel(sb: SupabaseClient, siteId: string, c: ChannelRow, seriesStartAt: number | null, now: number): Promise<ChannelRows> {
  const direct = () => loadChannelRows(sb, { channelId: c.id, videoLimit: c.video_limit, seriesStart: seriesStartAt, now })
  // (o comentário de hoje sobre o canal que nunca terminou uma sincronização vem para cá, sem mudança)
  if (!observatoryCacheEnabled() || c.last_ok_synced_at == null) return direct()
  const rows = unpackChannel(await cachedPack(siteId)(siteId, c.id, c.video_limit, seriesStartAt, c.last_ok_synced_at))
  if (rows) return rows
  warn('observatório: a entrada de cache do canal ' + c.id + ' não pôde ser lida; a tela leu o banco', { siteId, channelId: c.id })
  return direct()
}

export async function loadPageRows(siteId: string, now: number): Promise<ObservatoryRows> {
  const sb = getSupabaseServiceClient()
  const { seriesStartAt, ...live } = await loadLiveRows(sb, siteId, now)
  const parts = await mapLimit(live.channels, CHANNEL_CONCURRENCY, c => readChannel(sb, siteId, c, seriesStartAt, now))
  return assembleRows(live, parts, seriesStartAt, now)
}

/**
 * The dataset of ONE channel of this site, without reading the others (spec telas v9, 5.10). Same pack and same cache
 * key as loadPageRows: a channel the list already warmed costs no heavy read here. null = not a channel of this site.
 * SECURITY: service client, no RLS. The caller runs the access guard first and takes `siteId` from getSiteContext();
 * `channelId` may come from the URL, and loadChannelLiveRows refuses one of another site.
 */
export async function loadChannelDataset(siteId: string, channelId: string, now: number): Promise<Dataset | null> {
  const sb = getSupabaseServiceClient()
  const found = await loadChannelLiveRows(sb, siteId, channelId, now)
  if (!found) return null
  const { seriesStartAt, ...live } = found
  const parts = await mapLimit(live.channels, 1, c => readChannel(sb, siteId, c, seriesStartAt, now))
  return rowsToDataset(assembleRows(live, parts, seriesStartAt, now), now)
}
```

Imports novos em `load-page.ts`: `loadChannelLiveRows`, `type ChannelRow` de `./load`; `type SupabaseClient` de `@supabase/supabase-js`.

- [ ] **Passo 9: medir cache frio e quente.** Em `T/load-measure.test.ts`, um `describe` novo com as duas `SHAPES` do arquivo: `loadChannelDataset` do canal 0 com o cache vazio (idas e bytes), depois de novo (idas e bytes do banco), imprimindo `console.info('[medicao] um canal |', shape.name, '| fria: idas', a, 'bytes', b, '| quente: idas', c, 'bytes', d)` e afirmando `idas pesadas quentes === 0` e `competitor_videos` frias `=== 1`. Rodar e copiar as quatro linhas `[medicao] um canal` para o ledger (aceite do A0.4: "cache quente e frio medidos e registrados").

- [ ] **Passo 10: rodar tudo da pasta.** `cd apps/web && npx vitest run test/youtube/observatorio > "$SCRATCH/t10.log" 2>&1`, mais os testes de `apps/web/test` que citem `services/competitors` (`grep -rln 'services/competitors' apps/web/test`), e `tsc`. Ler só as falhas. Os testes de paridade com o oráculo (`*-parity.test.ts`) têm de passar **sem mudar expectativa**: se um mudar por causa da D5, pare e leve o número ao controlador.

- [ ] **Passo 11: commit**, mensagem `feat: carregador de um canal só e nulos de verdade no Observatório (A0.4)`.

---

### Tarefa 11: kit promovido, props mínimas e o fecho da A0 (A0.3)

**Arquivos:**
- Criar: `C/_chrome/kit.css`
- Modificar: `C/layout.tsx` (import), `C/_outliers/outlier-card.tsx:35-50`
- Teste: `T/kit-css.test.ts`

**Interfaces:**
- Produz: as classes `.obs-ch-dstats`, `.obs-ch-youtag`, `.obs-ch-stamp`, `.obs-ch-card`, `.obs-ch-ttl` sob `[data-obs]`; `Thumb` e `MultBlock` aceitando uma fatia do `OutlierCardView`:

```ts
export type ThumbData = Pick<OutlierCardView, 'art' | 'thumb' | 'dur'>
export type MultData = Pick<OutlierCardView, 'id' | 'mult' | 'multLabel' | 'tier' | 'stale' | 'weak' | 'neutral' | 'flags' | 'tip'>
export function Thumb({ c, rank }: { c: ThumbData; rank?: boolean })
export function MultBlock({ c, compact, lead }: { c: MultData; compact?: boolean; lead?: boolean })
```

- [ ] **Passo 1: teste de paridade que falha.** `T/kit-css.test.ts`:

```ts
// @vitest-environment node
/** O kit promovido (spec de telas, seção 2 "Reuso exige promoção"; plano da A0, D4): cada classe obs-ch-* tem as mesmas
 *  declarações da classe de tela de onde veio. Quem mudar uma sem a outra quebra aqui. */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const css = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Declarações da regra cujo seletor é exatamente `sel`, normalizadas e ordenadas. */
function decl(src: string, sel: string): string[] {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const m = src.match(new RegExp('(?:^|})\\s*' + esc + '\\s*\\{([^}]*)\\}'))
  if (!m) throw new Error('regra não encontrada: ' + sel)
  return m[1]!.split(';').map(d => d.trim().replace(/\s*:\s*/, ':')).filter(Boolean).sort()
}
const PARES: Array<[string, string, string]> = [
  ['_canais/canais.css', '[data-obs-screen="canais"] .dstats', '[data-obs] .obs-ch-dstats'],
  ['_canais/canais.css', '[data-obs-screen="canais"] .youtag', '[data-obs] .obs-ch-youtag'],
  ['_insights/insights.css', '[data-obs-screen="insights"] .stamp', '[data-obs] .obs-ch-stamp'],
  ['_outliers/outliers.css', '.obs-out .obs-out-card', '[data-obs] .obs-ch-card'],
  ['_outliers/outliers.css', '.obs-out .obs-out-ttl', '[data-obs] .obs-ch-ttl'],
]
describe('Observatório · kit promovido', () => {
  const kit = css('_chrome/kit.css')
  it.each(PARES)('%s %s = %s', (arquivo, origem, promovida) => {
    expect(decl(kit, promovida)).toEqual(decl(css(arquivo), origem))
  })
  it('o kit não traz color-mix nem z-index numérico', () => {
    expect(kit).not.toMatch(/color-mix\s*\(/)
    expect(kit).not.toMatch(/z-index\s*:\s*-?\d/)
  })
})
```

Se o seletor de origem de alguma classe for outro (confira com `grep -n '\.dstats{\|\.youtag{\|\.stamp{\|\.obs-out-card{\|\.obs-out-ttl{' C/_canais/canais.css C/_insights/insights.css C/_outliers/outliers.css`), use o seletor real na tabela `PARES`.

- [ ] **Passo 2: ver falhar; criar `kit.css`** copiando, para cada par, a regra principal e as regras filhas (`grep -n '\.dstats' C/_canais/canais.css` etc.) com o seletor trocado; variáveis que não são de `[data-obs]` entram com o valor literal dos dois temas. Cabeçalho do arquivo:

```css
/* Kit das telas de canal e vídeo: classes que nasceram presas a uma tela, copiadas com o prefixo obs-ch- para as telas
   novas usarem (spec de telas v9, seção 2). As telas de origem NÃO mudaram de classe (plano da A0, decisão D4);
   test/youtube/observatorio/kit-css.test.ts mantém as duas cópias iguais. Botão: use .obs-ch-btn de chrome.css. */
```

Importar em `C/layout.tsx`. Rodar o teste: 6 passam; `camadas-css.test.ts` continua verde.

- [ ] **Passo 3: props mínimas.** Em `outlier-card.tsx`, exportar `ThumbData` e `MultData` e trocar as assinaturas de `Thumb` e `MultBlock` (o corpo não muda: só lê esses campos). Quem passa o `OutlierCardView` inteiro continua compilando. `tsc` limpo e `T/outliers-screen.test.tsx` verde.

- [ ] **Passo 4: commit**, mensagem `feat: kit de classes e props mínimas de Thumb e MultBlock para as telas de canal (A0.3)`.

- [ ] **Passo 5: suíte inteira, em fundo.** `cd apps/web && npx vitest run > "$SCRATCH/suite-a0.log" 2>&1`. Esperado: zero falhas (~170 s). No relatório: arquivos e testes passados, pulados, falhas.

- [ ] **Passo 6: fidelidade e "sem mudança visual", em fundo.** `cd apps/web && npx playwright test --project=observatorio > "$SCRATCH/e2e-a0.log" 2>&1` (inclui `flutuantes.spec.ts` e `a0-sem-mudanca.spec.ts`, este agora **sem** `--update-snapshots`). Esperado: tudo verde; as 10 capturas iguais às de antes. Diferença de captura = mudança visual numa tela fechada: achar a regra de CSS que mudou e corrigir; não regravar a captura. Falha de fidelidade de texto por flutuante que saiu da tela: ajustar o seletor na spec dona, no commit da tarefa que a migrou (commit de conserto próprio se a tarefa já fechou).

- [ ] **Passo 7: validação AUTENTICADA do CMS local**, por subagente Sonnet com navegador (`docs/ops/runbook-cms-e2e-local.md`, **sem `db:reset`**): logado, abrir Canais, Outliers, Mudanças, Insights e um Histórico; em cada uma abrir uma flutuante de cada família em 1440 e 390 px; console sem erro. Repetir **no Opera** se o dono tiver o Opera nesta máquina (`ls /Applications | grep -i opera`); se não tiver, registrar "não testado no Opera" no ledger (item 9 de "A rever no fim"). O agente devolve o veredito em texto e salva as capturas em `docs/superpowers/mockups/2026-10-07-pagina-canal/shots/a0-*` (pasta fora do git).

- [ ] **Passo 8: limpar e fechar.** Apagar `E/a0-sem-mudanca.spec.ts` e a pasta `E/a0-sem-mudanca.spec.ts-snapshots/` (nunca foram commitados). No ledger: os quatro aceites da A0 com a evidência de cada um, o `TETO_ANTIGOS` final, as medições do carregador, o que ficou para a A1 (D7: tema claro dos tokens) e para a A2. `git status` e `git log --oneline origin/staging..HEAD` no relatório. **Sem push.**

---

## O que este plano não faz (e onde está)

- Rota `canal/<id>`, `ChannelVideoView`, a guarda de acesso da rota: fase A1.
- O ⓘ da faixa de números, o menu "Meu canal", as réguas e o gráfico de impressões: nascem nas fases A1, A3 e A4 já sobre a camada.
- Migrar para variáveis os `z-index` de marcas, grudados, gaveta, modal e avisos que existem hoje (D3).
- Deduplicar o kit com as classes de origem (D4).
- Leitor de `yt_own_video_daily` e `yt_own_video_reach_daily`: fase A4.
