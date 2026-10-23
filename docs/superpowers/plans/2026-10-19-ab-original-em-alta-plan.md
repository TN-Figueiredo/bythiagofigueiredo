# A/B Lab: original em alta resolução (plano de implementação, r6, escopo D12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 21/10/2026. **r6 (Sonnet, 21/10 noite): conserto da r5** conforme `revisao-plano-r5-phil.md` (86) e `revisao-plano-r5-yannis.md` (84): fixture compartilhada com `dimensions: '1280x720'`, teste B1 com imagem 1280x720 de verdade, hook sem "Tudo pronto." sem leitura e com resposta `ok` tardia vencendo o tempo-limite, teste C3 sem `initialStep`, riscos do Blob e espera do `maxres` na T20; ver "Decisões da r6" (§10). **r5 (Sonnet, 21/10 tarde): emenda pós-M1** conforme os pareceres de Logan (70, re-revisão 93) e Naksu (84, re-revisão 94) sobre o mockup M1 r2 (`docs/superpowers/mockups/2026-10-19-ab-original-em-alta/`, seção "M1 (atual)", commit `d49aca338`): tarefa nova **T1c** (ajusta o código já feito em `10fb16929` e `d523f7d06` e regrava a original baixa no início do teste), passos 5–9 da T1b reescritos, ver "Decisões da r5" (§9). r4 (Sonnet) corrige a r3 conforme as revisões de Phil (84), Yannis (86) e Logan (74), ver "Decisões da r4" no fim. r3 (Opus) sobre a r2 (`b8236eed9`, 22 tarefas), reduzida pela **decisão D12 do dono (21/10 12:35)**, registrada na §5.7 e na linha D12 de `/Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md`. O texto integral da r2 vive em `git show b8236eed9:docs/superpowers/plans/2026-10-19-ab-original-em-alta-plan.md` e continua neste arquivo, resumido, no apêndice "Congeladas (D12)". Esta r5 **não** autoriza executar nem pushar: precisa de nova revisão de Yannis (B1 e tempo-limite) e Logan (textos) e do portão normal.

## Escopo D12

| | O que | Estado |
|---|---|---|
| **FICA** | T0 (linha de base), T1 (regra única 1280: `originalBaixaResolucao`, testes de fronteira 1279/1280, diálogo de encerrar), **T1b** (aviso antes de iniciar o teste no assistente quando a original guardada tem largura < 1280; passos 1–4 já feitos), **T1c nova** (ajuste pós-M1 do código da T1b e regravação da original baixa no início), T20 reduzida (prova local) | ativas |
| **CONGELA** | T2 a T18, T19 (5º caso de D) e T21 (medição com o arquivo-mestre) | apêndice |

Sem migration, sem envio de arquivo, sem rota nova de escrita, **sem bloquear o início** (a bola do Short: ver Riscos).

**Gatilho de descongelar T2–T18:** o dono rodar o primeiro teste nosso em vídeo longo com >= 28 dias e **perder a original em alta**, ou um Short/kids ser **recusado de verdade** por original baixa. **Antes de qualquer descongelo**, sondar 2 Shorts reais (Gio ou Phil): a guarda de início da T11 da r2 pode **bloquear Shorts** cuja imagem vertical não tem `maxres` 1280, e Short é o uso principal do nosso teste. O resultado vira subnúmero de 21 no roteiro (`docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`). T19 e T21 só voltam junto com o envio.

**Goal:** o dono não perde a original em alta sem saber: o diálogo de encerrar e o assistente dizem, com a mesma régua de 1280, quando a original guardada é baixa; quando a resolução não foi medida ou não deu para ler, dizem exatamente isso, sem alarme.

**Tech Stack:** Next.js 16 (server action de leitura), TypeScript estrito, Vitest, Testing Library. Nada de SQL, sharp ou Blob.

> **Para quem executa:** `superpowers:subagent-driven-development`, agente `executor` (Sonnet, `medium`). T20: Gio (Sonnet, `medium`). Ledger: `.superpowers/sdd/ab-lab/original-em-alta/progress.md` (criar na T0). Código só em `~/Workspace/bythiago-ab-s7` (branch `lote/ab-p4b-a`).

> **Abreviações:** `W` = `~/Workspace/bythiago-ab-s7`; `AB` = `apps/web/src/app/cms/(authed)/youtube/ab-lab`; `Y` = `apps/web/src/lib/youtube`; `T` = `apps/web/test`.

## Global Constraints

- `LARGURA_ALTA = 1280` é a **única** constante: limiar de "baixa" no diálogo de encerrar e no aviso. Baixa = largura nula, 0, ilegível ou < 1280 (D1).
- O aviso **nunca** desabilita "Salvar rascunho" nem "Ativar teste" nem muda `stepIsValid`.
- O aviso **só lê** o que já está guardado (`ab_test_variants.dimensions` da variante `is_original`); nenhuma chamada ao YouTube, nenhuma escrita.
- Texto do aviso: só frases do mockup aprovado (`docs/superpowers/mockups/2026-10-19-ab-original-em-alta/index.html`, estado B) e de `.superpowers/sdd/ab-lab/original-em-alta/textos-pendentes-logan.md`; **as adaptações** (trocar "A pública" por "A original guardada"; tirar "Envie a original", que não tem como acontecer sem o envio; o texto de "não medida", a linha de leitura que falhou e a saída "troque a thumbnail... ou ative assim mesmo", todos de Logan na r3) estão marcadas na T1b.
- Sem `any`; testes de componente com `// @vitest-environment jsdom`; de função pura em `node`. Commit por caminho explícito; proibido `stash`, `reset` e `push`.

## Review Focus

1. **Short ou vídeo sem `maxres`:** o aviso aparece e o teste inicia mesmo assim (Tarefa 1b, teste "não bloqueia").
2. **`dimensions` nula (original não medida; 2 dos 3 testes de produção têm `blob_url` fora do Blob e `dimensions` nulo):** selo e texto próprios "Resolução não medida", nunca "baixa"; `0x0`/ilegível **com** a original já medida (dHash presente) é "Baixa resolução" sem número (Tarefa 1b).
3. **A leitura falha, lança, devolve mais de uma original ou demora:** erro/ambiguidade vira a linha neutra "Não consegui conferir a resolução da original agora. Isso não impede de ativar."; **demora mostra o esqueleto e o banner "Pronto para ativar." (nunca "Tudo pronto."), e passados 8 s vira a mesma linha neutra** (r5); nunca o aviso de "baixa", nenhum bloqueio, nenhum "undefined" na tela.
4. **1279 avisa, 1280 não**, nos dois lugares (diálogo e aviso), pela mesma função.
5. **O aviso não empurra o veredito:** fica abaixo do banner, que vira "Pronto para ativar, com um aviso abaixo." (baixa, não medida) ou "Pronto para ativar." (falhou, lendo); "Tudo pronto." só com a leitura em alta ou tipo só título; a leitura começa ao entrar em Variantes (`state.step >= 2`, r5).
6. **A saída do aviso é verdadeira (B1, r5):** trocar a thumbnail no YouTube pela mesma arte em 1280 px, com dHash igual, **regrava** a original no início do teste (T1c, teste "dHash igual e 480x360").
7. **Cor por tema (Naksu, r5):** palavra do veredito, ícone e selo usam os tokens novos; nunca `#4ade80`/`Badge tone="amber"` no claro.

---

## 1. Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `Y/ab-original-resolucao.ts` (novo) | `LARGURA_ALTA`, `publicaBaixa`, `dimensoesDeTexto`, `textoAvisoOriginalBaixa`, `AvisoOriginal`, `AVISO_INDISPONIVEL` (puras); textos da r5 (T1c) |
| `Y/ab-start.ts` (T1c) | `:317-321` regrava a original também quando a guardada é baixa; `dimensions` entra no select (`:222`) e em `VarianteInicio` (`:169`) |
| `apps/web/src/app/globals.css` (T1b passo 7) | tokens `--cms-green-text/-icon`, `--cms-amber-text/-soft/-line`, `--cms-ban-bg/-bd` por tema |
| `AB/_components/encerrar-props.ts` | `originalBaixaResolucao` passa a usar a regra única |
| `AB/actions.ts` | `lerDimensoesDaOriginal(testId)` (server action, só leitura; devolve `dimensions` e `medida`) |
| `AB/_components/use-aviso-original.ts` (novo) | hook que **recebe** a action por parâmetro e devolve 3 estados: `'pendente' \| null \| AvisoOriginal`; tempo-limite de 8 s (T1c) |
| `AB/_components/step-revisar.tsx` | prop `avisoOriginal`, título do banner por estado, esqueleto, `AvisoResolucao` abaixo do banner, tokens de cor |
| `AB/_components/ab-create-wizard.tsx` | importa a action, a passa ao hook e passa o resultado ao `StepRevisar` |
| `T/ab-wizard-aviso-original.test.tsx` (novo) | prova no assistente que o aviso não bloqueia e que a prop está ligada |
| `T/ab-start-internal.test.ts` (T1c, acrescentar) | original guardada baixa com dHash igual regrava |

## 2. Fatos conferidos no código (W, `2d85f30c3`, em dia com `origin/staging` de 21/10)

- `originalBaixaResolucao` está em `AB/_components/encerrar-props.ts:22-26` com a regra antiga `<= 480` e o comentário "Ruling do Phil (T15)" em :18-21; é chamada em :58 (`originalBaixaResolucao(original?.dimensions)`) e usada por `AB/_components/ab-end-test-dialog.tsx:119,233,297,301`. Teste atual: `T/youtube/ab-end-test-dialog.test.tsx:304-309` (`1280x720` false, `480x360`/`null`/`undefined`/`'lixo'` true) e :316-323.
- `dimensions` é TEXT `"LxA"`. Nasce em `createAbTest` (`AB/actions.ts:250-289`): `preserveOriginalThumbnail` (:48-51) → `guardarOriginalMaior` (`Y/ab-variant-dhash.ts:79-92`, devolve `meta.width ?? 0`) → `` `${largura}x${altura}` `` (:259); fica **nula** quando `thumbnail_hq_url` não é de `ytimg|ggpht|googleusercontent` (:249-250, `originalDimensions` começa `null`). `"0x0"` é possível se o sharp não medir.
- **O rascunho existe antes do passo Revisar:** `handleTypeSelect` cria o teste ao escolher o tipo (`AB/_components/ab-create-wizard.tsx:~346-371`, `createAbTest` → `SET_DRAFT_ID`), então, **nos caminhos "novo teste" e "continuar rascunho do servidor"**, em `step === 4` há `state.draftTestId` (`existingDraftId` o traz ao continuar, :~262). **Exceção (Yannis M2):** `saveDraft` (:117-133) não grava `draftTestId` e o estado inicial usa `existingDraftId ?? null` (:296) com `step: saved?.step` (:285); quem reabre um vídeo com rascunho só local no passo 4, sem `existingDraftId`, chega ao Revisar com `draftTestId = null`: o hook não lê, **não há aviso**, e o teste nasce no clique de Ativar (:398-414). Ver Riscos.
- O assistente **não** sabe as dimensões: `WizardState` (:75-87) só tem `originalThumbUrl`; `AbTestDraftVariant` (`Y/ab-types.ts:325-330`) não tem `dimensions`. Por isso a leitura é uma action pelo `draftTestId`.
- `StepRevisar` é montado em `ab-create-wizard.tsx:~555-567` com `type`, `variants`, `config`, `videoTitle`; `Badge` vem de `./ab-primitives`. O passo Revisar tem os botões "Salvar rascunho" (:~674) e "Ativar teste" (:~682), ambos já chamam `handleSubmit` (:391), que termina em `startAbTest(testId)` (:~477).
- Padrão de leitura com escopo: `cleanupDraftVariants` (`AB/actions.ts:518-538`): `requireEditAccess()` + `.eq('site_id', siteId)`.
- Paridade Cowork/MCP: `manage_ab_test` (`apps/web/src/lib/pipeline/mcp/tools.ts:665`, enum de ações) tem `list_tests`, `get_test`, `list_variants`, `upsert_variants`… **nenhuma ação inicia teste**; só o CMS inicia. Logo não há "antes de iniciar" no MCP.

## 3. Comandos comuns

```bash
cd ~/Workspace/bythiago-ab-s7/apps/web
# alvo rápido da tarefa (arquivos novos e tocados):
npx vitest run test/youtube/ab-original-resolucao.test.ts test/youtube/ab-end-test-dialog.test.tsx test/youtube/ab-aviso-original-baixa.test.tsx test/youtube/ab-ler-dimensoes-da-original.test.ts test/cms/ab-step-revisar.test.tsx test/ab-wizard-aviso-original.test.tsx test/ab-wizard-variante-vazia.test.tsx test/ab-wizard-referencia.test.tsx > /tmp/oea-tN.log 2>&1; tail -30 /tmp/oea-tN.log
# prova da família (youtube + CMS do A/B + assistente), obrigatória antes de cada commit de código e na T20:
npx vitest run test/youtube test/cms/ab- test/ab- > /tmp/oea-fam.log 2>&1; tail -30 /tmp/oea-fam.log
npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log   # esperado: 0
```

Commit: `git -C ~/Workspace/bythiago-ab-s7 add <arquivos> && git -C ~/Workspace/bythiago-ab-s7 commit -m "<tipo>: <descrição>" -- <arquivos>`.

---

## 4. As tarefas ativas

### Tarefa 0: linha de base

**Files:** `.superpowers/sdd/ab-lab/original-em-alta/progress.md` (criar).

- [ ] **Passo 1:** `git -C ~/Workspace/bythiago-ab-s7 status --short` sem modificações rastreadas além de `shots/`; anotar o sha de `HEAD` no ledger.
- [ ] **Passo 2:** `npx vitest run test/youtube test/cms/ab- test/ab- > /tmp/oea-t0.log 2>&1; tail -30 /tmp/oea-t0.log` e `npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log`. Esperado: 0 falhas, 0 `error TS`. Anotar as contagens. (Sem `bythiago_int`: esta r3 não tem SQL.)

### Tarefa 1: regra única de resolução e o diálogo de encerrar (revisada)

Revisão frente à r2: o módulo nasce **só** com o que o diálogo e o aviso usam. `proporcaoOk`, `ehQuatroPorTres`, `PROPORCAO`, `TOLERANCIA_PROPORCAO` e `MAX_BYTES` pertencem ao envio e ficam na T7 congelada.

**Files:**
- Create: `Y/ab-original-resolucao.ts`, `T/youtube/ab-original-resolucao.test.ts`
- Modify: `AB/_components/encerrar-props.ts:18-26` (corpo de `originalBaixaResolucao`; apagar o comentário "Ruling do Phil (T15)" e a regra `<= 480`; importar de `@/lib/youtube/ab-original-resolucao`)
- Test: `T/youtube/ab-end-test-dialog.test.tsx:304-309` (continua verde) mais casos novos no mesmo `it` ou vizinho

**Interfaces (Produces):** `LARGURA_ALTA = 1280`; `publicaBaixa(largura: number | null | undefined): boolean`; `dimensoesDeTexto(d: string | null | undefined): { largura: number; altura: number } | null` (regex `^(\d+)x(\d+)$`, ambos > 0, senão `null`).

- [ ] **Passo 1: testes que falham** em `T/youtube/ab-original-resolucao.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { LARGURA_ALTA, publicaBaixa, dimensoesDeTexto } from '@/lib/youtube/ab-original-resolucao'
import { originalBaixaResolucao } from '@/app/cms/(authed)/youtube/ab-lab/_components/encerrar-props'

describe('regra única de baixa resolução', () => {
  it('a constante é 1280', () => { expect(LARGURA_ALTA).toBe(1280) })
  it('1279 é baixa, 1280 não', () => {
    expect(publicaBaixa(1279)).toBe(true)
    expect(publicaBaixa(1280)).toBe(false)
  })
  it('nulo, 0 e indefinido são baixa', () => {
    for (const v of [null, undefined, 0]) expect(publicaBaixa(v)).toBe(true)
  })
  it('dimensoesDeTexto lê "LxA" e devolve null no resto', () => {
    expect(dimensoesDeTexto('1920x1080')).toEqual({ largura: 1920, altura: 1080 })
    for (const d of [null, undefined, '', '0x0', '480x0', 'abc', '1920X1080 ']) expect(dimensoesDeTexto(d)).toBeNull()
  })
  it('diálogo de encerrar: selo com nulo, 0x0, 480, 640 e 1279; sem selo com 1280', () => {
    for (const d of [null, undefined, '0x0', '480x360', '640x480', '1279x719', 'lixo']) {
      expect(originalBaixaResolucao(d)).toBe(true)
    }
    expect(originalBaixaResolucao('1280x720')).toBe(false)
    expect(originalBaixaResolucao('1920x1080')).toBe(false)
  })
})
```

- [ ] **Passo 2:** `npx vitest run test/youtube/ab-original-resolucao.test.ts` → FAIL (módulo inexistente).
- [ ] **Passo 3:** implementar `Y/ab-original-resolucao.ts`:

```ts
export const LARGURA_ALTA = 1280

/** Baixa = largura ausente, 0, não numérica ou < 1280 (D1). */
export function publicaBaixa(largura: number | null | undefined): boolean {
  return !Number.isFinite(largura) || (largura as number) < LARGURA_ALTA
}

/** `dimensions` é TEXT "LxA"; nulo, 0 ou ilegível devolve null. */
export function dimensoesDeTexto(d: string | null | undefined): { largura: number; altura: number } | null {
  const m = /^(\d+)x(\d+)$/.exec(d ?? '')
  if (!m) return null
  const largura = Number(m[1]); const altura = Number(m[2])
  return largura > 0 && altura > 0 ? { largura, altura } : null
}
```

e em `encerrar-props.ts` o corpo vira `return publicaBaixa(dimensoesDeTexto(dimensions)?.largura ?? null)`, com o comentário trocado por "D1/D12: largura < 1280 (ou ilegível) avisa; mesma régua do aviso do assistente".
- [ ] **Passo 4:** mesmo comando → PASS; rodar os dois comandos da seção 3 (a expectativa antiga de 640×480 sem selo, se existir em `T/`, muda no mesmo commit: `grep -rn "640x480" T/youtube/ab-end-test-dialog.test.tsx`).
- [ ] **Passo 5:** commit `feat: regra única de baixa resolução da original (1280)`, caminhos explícitos dos 4 arquivos.

### Tarefa 1c: ajuste pós-M1 do código da T1b e regravação da original baixa (nova, r5)

**Quando:** depois dos passos 1–4 da T1b (feitos: `10fb16929`, `d523f7d06`, com os textos **antigos** e o hook de 2 estados) e **antes** dos passos 5–9. Fonte: `.superpowers/sdd/ab-lab/original-em-alta/revisao-m1-logan.md` (B1, C1, C2, C4, C5, M1) e `revisao-m1-naksu.md` (C4 iii), textos copiados letra por letra de `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/index.html` (r2, objeto `E`, linhas ~202-239).

**Fatos conferidos em W (HEAD `d49aca338`):** `ab-start.ts:317-321` só regrava a original quando `guardado === null || hamming(guardado, sonda.dhash) > DHASH_MAX_SAME`; mesma arte em 1280 px tem o mesmo dHash e **não** regrava. O `select` das variantes (`ab-start.ts:222`) e `VarianteInicio` (`:169`) **não trazem `dimensions`**: a condição nova precisa dos dois. O hook de `d523f7d06` tem 2 estados (`AvisoOriginal | null`, `null` = pendente e alta juntos) e `type: string`.

**Files:**
- Modify: `Y/ab-start.ts`, `Y/ab-original-resolucao.ts`, `AB/_components/use-aviso-original.ts`
- Test (ajustar/acrescentar): `T/ab-start-internal.test.ts`, `T/youtube/ab-original-resolucao.test.ts`, `T/youtube/ab-aviso-original-baixa.test.tsx`

- [ ] **Passo 1: fixture e teste B1 (falha)**. **Fixture primeiro (r6, Phil C1 e Yannis C1):** em `T/helpers/banco-ab.ts:88` acrescentar `dimensions: '1280x720'` à variante `A` (um lugar só). Sem isso `dimensions` indefinido vira "baixa" na régua única e **todo** início de thumbnail/combo dos arquivos que usam `criarBanco` (`ab-start-internal`, `youtube/start-concorrente` com `put: vi.fn()` sem retorno, `youtube/ab-fila-inicio` sem mock de `@vercel/blob`, `ab-actions-resume`, `ab-rotate-*`, `ab-watchdog-*`, `ab-evaluate-duracao-maxima`, `montar-saida-automatica`) passaria a regravar e quebraria por razão errada. **Não** criar a opção `dimensoesOriginal`: os casos baixa e nulo usam o `ajustar` que `montar` já repassa (`ajustar: (v) => { v[0]!.dimensions = '480x360' }` e `... = null`); o falso devolve a linha inteira em qualquer `select` (`banco-ab.ts:31`), então a coluna chega sem mais ajuste. Nenhuma asserção de teste que não seja o caso 24/"nada mudou" pode ser afrouxada.

Helper novo em `T/helpers/youtube-falso.ts`, ao lado de `imagemComDhash` (:21, que serve 450x360 e por isso **não prova** a saída): `imagemGrande(hex)`, mesmo corpo de `imagemComDhash` com `.resize(1280, 720, { kernel: 'nearest' })` ao final (o dHash fica igual porque o resize é `nearest` sobre a grade 9x8). Em `T/ab-start-internal.test.ts`, no `describe('startAbTestInternal: o original é relido depois da reivindicação')` (:~202), junto do caso 24:

```ts
it('B1: original guardada baixa (480x360), dHash igual e a thumbnail do YouTube agora 1280x720 -> regrava, mede 1280x720 e o aviso some', async () => {
  const { banco, iniciar } = await montar({ testType: 'thumbnail', thumb: await imagemGrande(H.A), ajustar: (v) => { v[0]!.dimensions = '480x360' } })
  const antesBlob = banco.variantes()[0]!.blob_url
  expect((await iniciar()).ok).toBe(true)
  expect(put).toHaveBeenCalledTimes(1)
  const a = banco.variantes()[0]!
  expect(a.blob_url).not.toBe(antesBlob)
  expect(banco.teste().original_thumbnail_url).toBe(a.blob_url)
  expect(a.dimensions).toBe('1280x720')
  expect(hamming(a.thumbnail_dhash!, H.A)).toBeLessThanOrEqual(DHASH_MAX_SAME)
  expect(textoAvisoOriginalBaixa(a.dimensions, true)).toBeNull()   // o aviso some
})
it('B1b: Short sem maxres (o falso serve 450x360) -> regrava uma vez, fica 450x360, sem erro (idempotente, ainda baixa)', async () => {
  const { banco, iniciar } = await montar({ testType: 'thumbnail', ajustar: (v) => { v[0]!.dimensions = '480x360' } })
  expect((await iniciar()).ok).toBe(true)
  expect(put).toHaveBeenCalledTimes(1)
  expect(banco.variantes()[0]!.dimensions).toBe('450x360')
})
it('B1: original guardada em alta (1280x720, fixture padrão) com dHash igual -> nenhuma cópia nova (o caso "nada mudou" continua)', async () => {
  const { banco, iniciar } = await montar({ testType: 'thumbnail' })
  await iniciar()
  expect(put).not.toHaveBeenCalled()
  expect(banco.variantes()[0]).toMatchObject({ blob_url: BLOB('A'), thumbnail_dhash: H.A })
})
it('B1: dimensions nula com dHash guardado e igual -> regrava (nulo/ilegível é "baixa" na régua única)', async () => {
  const { iniciar } = await montar({ testType: 'thumbnail', ajustar: (v) => { v[0]!.dimensions = null } })
  await iniciar()
  expect(put).toHaveBeenCalledTimes(1)
})
```

(O caso "nada mudou" existente, :~215, passa a ser o 3º caso acima e a fixture padrão já tem `1280x720`; listar no commit. Importar `hamming`, `DHASH_MAX_SAME` e `textoAvisoOriginalBaixa` se o arquivo ainda não os importa.)
- [ ] **Passo 2: implementar B1** em `Y/ab-start.ts`: importar `{ dimensoesDeTexto, publicaBaixa }` de `./ab-original-resolucao`; acrescentar `dimensions: string | null` a `VarianteInicio` (:169) e `dimensions` ao `select` (:222). Trocar o `if` (:319-321) por:

```ts
const guardado = original?.thumbnail_dhash ?? null
const originalBaixa = publicaBaixa(dimensoesDeTexto(original?.dimensions)?.largura ?? 0)   // r5 B1: nula, 0x0, ilegível ou < 1280
if (guardado === null || originalBaixa || hamming(guardado, sonda.dhash) > DHASH_MAX_SAME) {
  guardada = await guardarOriginalMaior(youtubeVideoId, testId)
  patchTeste.original_thumbnail_url = guardada.url
}
```

Custo (Phil e Yannis conferiram; ver Riscos): uma leitura+gravação a mais no Blob só quando a guardada é baixa, e só no início de teste de `thumbnail`/`combo`; `guardarOriginalMaior` cai para a `hqdefault` quando não há `maxres`/`sddefault`, então um Short sem 1280 regrava a mesma 480×360 (idempotente, sem dano, uma cópia a mais no Blob por início). O aviso **continua** na tela depois da troca no YouTube (lê só o guardado); por isso o texto da saída diz "mesmo que este aviso continue aqui" (T1c passo 3). Sem migration.
- [ ] **Passo 3: textos da r5 (testes primeiro, falham)**, em `T/youtube/ab-original-resolucao.test.ts`. **Asserções trocadas** (as de `d523f7d06`):

| Caso | Antes | Depois (r5) |
|---|---|---|
| baixa, com número | contém `ative assim mesmo` | contém `Sem uma maior, pode ativar assim mesmo.` e `o teste guarda a nova ao ativar, mesmo que este aviso continue aqui` |
| baixa, sem número (nula, `0x0`, lixo) | `é de baixa resolução (mínimo 1280 px de largura)` | `está abaixo do mínimo de 1280 px de largura` (C4) |
| não medida | `ainda não foi medida` (e o texto antigo da guarda) | contém `ainda não foi medida; o teste mede ao ativar`, `Se a thumbnail do vídeo no YouTube tem 1280 px de largura ou mais, pode ativar` e `troque-a no YouTube antes de ativar`; **não** contém `baixa resolução`, `ative assim mesmo`, `undefined`, `null`, `NaN` (C1) |
| `AVISO_INDISPONIVEL` | `texto: 'Não consegui conferir a resolução da original agora.'` | `texto: 'Não consegui conferir a resolução da original agora. Isso não impede de ativar.'` (M1) |

Textos novos em `Y/ab-original-resolucao.ts`, **letra por letra** (do mockup r2; o tipo `AvisoOriginal` e o literal de `texto` do `indisponivel` mudam junto):

```ts
const CAUDA_AVISO = 'o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.'   // sem mudança
const SAIDA_AVISO = `Para evitar, troque no YouTube a thumbnail do vídeo por uma de ${LARGURA_ALTA} px ou mais e depois ative: o teste guarda a nova ao ativar, mesmo que este aviso continue aqui. Sem uma maior, pode ativar assim mesmo.`
const TEXTO_NAO_MEDIDA = `A resolução da original ainda não foi medida; o teste mede ao ativar. Se a thumbnail do vídeo no YouTube tem ${LARGURA_ALTA} px de largura ou mais, pode ativar. Se tem menos, o vídeo voltaria borrado a cada troca: troque-a no YouTube antes de ativar.`
// baixa com número:  `A original guardada tem só ${L}×${A}: ${CAUDA_AVISO} ${SAIDA_AVISO}`
// baixa sem número:  `A original guardada está abaixo do mínimo de ${LARGURA_ALTA} px de largura: ${CAUDA_AVISO} ${SAIDA_AVISO}`
// indisponível:      'Não consegui conferir a resolução da original agora. Isso não impede de ativar.'
```

Textos do banner e da nota (usados na T1b passo 7), com função pura exportada e testada aqui para o componente só consumir:

```ts
export type EstadoAviso = 'pendente' | null | AvisoOriginal   // pendente = leitura em andamento; null = alta ou tipo só título
export function tituloDoBanner(aviso: EstadoAviso | undefined): string {
  if (aviso === undefined || aviso === null) return 'Tudo pronto.'
  if (aviso === 'pendente' || aviso.kind === 'indisponivel') return 'Pronto para ativar.'
  return 'Pronto para ativar, com um aviso abaixo.'
}
export const NOTA_ATIVAR = 'Clique em Ativar teste para começar. As variantes passam a rotacionar na hora.'
```

Teste de `tituloDoBanner`: `undefined`/`null` → `Tudo pronto.`; `'pendente'` e `AVISO_INDISPONIVEL` → `Pronto para ativar.`; `textoAvisoOriginalBaixa('480x360', true)` e `textoAvisoOriginalBaixa(null, false)` → `Pronto para ativar, com um aviso abaixo.`.
- [ ] **Passo 4: hook de 3 estados e tempo-limite (testes primeiro, falham)**, em `T/youtube/ab-aviso-original-baixa.test.tsx`. Valor do tempo-limite: **`TEMPO_LIMITE_LEITURA_MS = 8000`** (proposta; a leitura são 2 consultas simples por rascunho, normalmente < 1 s; 8 s cobre a rede ruim de fora do país sem deixar o esqueleto cinza para sempre; Yannis confirma). Asserções trocadas e acrescentadas:
  - Em todos os casos antigos que esperavam `null` por **pendente** ou por **alta**, separar: alta (`1280x720`) → `null` **depois** da resposta; enquanto a promessa não volta → `'pendente'`.
  - `L7` (trocar o rascunho): depois de `rerender({ id: 'b' })` com a leitura pendurada, `result.current` é `'pendente'` (antes: `null`).
  - Tipo `title` ou passo inativo: `result.current` é `null` e `ler` não é chamada (não aplica; o banner mostra "Tudo pronto.").
  - **Novo (r6, Yannis C3):** thumbnail/combo, `ativo` e **sem rascunho** (`draftTestId = null`): `renderHook(() => useAvisoOriginal(ler, null, 'thumbnail', true))` devolve `kind: 'nao-medida'` (aviso "não medida", verdadeiro: a original ainda nem foi guardada) e `ler` **não** é chamada. Nunca "Tudo pronto." sem ter lido. (Caminho real: `prefill.testType` sem `existingDraftId`, o rascunho só nasce em `handleSubmit`.)
  - **Novo, com `vi.useFakeTimers()`**: leitura que nunca volta (`new Promise(() => {})`): em 7999 ms `result.current` é `'pendente'`; em 8000 ms vira `AVISO_INDISPONIVEL` (`kind: 'indisponivel'`).
  - **Novo (r6, Phil C2 e Yannis C5):** o `indisponivel` vindo **só do tempo** é provisório. Leitura que resolve em 9 s com `480x360`, depois do timer: `result.current` passa de `indisponivel` a `kind: 'baixa'`. Só erro (`ok:false` ou throw) fecha o desfecho; **mantido**: `ok:false` tardio **não** sobrescreve um resultado já bom.
  - **Novo**: resposta em 100 ms cancela o timer: depois dela, `await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })` e o aviso continua intacto (**não** afirmar `vi.getTimerCount() === 0`: React e `act` agendam timers próprios). Com fake timers, nada de `waitFor` (trava): usar `act` e `advanceTimersByTimeAsync`.
  - **Novo (Phil menor 3):** trocar `draftTestId` não mostra o aviso do rascunho anterior nem por um quadro (o estado guarda `{ id, valor }`).
  - Rodar com `vi.useRealTimers()` no `afterEach`.

  Implementação (`use-aviso-original.ts`; o parâmetro `type` volta a ser `TestType | null` só se o tipo já existir no hook; senão manter `string`, como está):

```ts
export const TEMPO_LIMITE_LEITURA_MS = 8000   // limite do esqueleto, não teto de custo (r6: não decide com perda)
// EstadoAviso é importado de ab-original-resolucao; não redefinir aqui.

export function useAvisoOriginal(ler, draftTestId, type, ativo): EstadoAviso {
  const tipoLe = type === 'thumbnail' || type === 'combo'
  const aplica = ativo && tipoLe
  const [lido, setLido] = useState<{ id: string | null; valor: EstadoAviso }>({ id: null, valor: 'pendente' })
  useEffect(() => {
    if (!aplica || !draftTestId) return
    const id = draftTestId
    setLido({ id, valor: 'pendente' })   // L7: nunca mostrar o aviso do rascunho anterior
    let cancelado = false
    let resolvido = false   // só uma resposta real (ok ou erro) resolve; o tempo não
    let timer: ReturnType<typeof setTimeout> | undefined
    const resolve = (valor: AvisoOriginal | null) => {
      if (cancelado || resolvido) return
      resolvido = true
      clearTimeout(timer)
      setLido({ id, valor })
    }
    // o tempo-limite só mostra o placeholder; uma resposta ok tardia o substitui (r6, Phil C2)
    timer = setTimeout(() => { if (!cancelado && !resolvido) setLido({ id, valor: AVISO_INDISPONIVEL }) }, TEMPO_LIMITE_LEITURA_MS)
    try {
      Promise.resolve(ler(id)).then(
        (r) => resolve(r.ok ? textoAvisoOriginalBaixa(r.dimensions, r.medida) : AVISO_INDISPONIVEL),
        () => resolve(AVISO_INDISPONIVEL),
      )
    } catch { resolve(AVISO_INDISPONIVEL) }
    return () => { cancelado = true; clearTimeout(timer) }
  }, [aplica, draftTestId, ler])
  if (!aplica) return null                                         // tipo só título ou passo inativo
  if (!draftTestId) return textoAvisoOriginalBaixa(null, false)    // sem rascunho: "não medida", nunca "Tudo pronto." sem ler (r6, Yannis C3)
  return lido.id === draftTestId ? lido.valor : 'pendente'          // sem quadro de cena velha (Phil menor 3)
}
```

(r6: `resolve` guarda `cancelado` e `resolvido`, então o erro fecha e a resposta `ok` posterior ao timer ainda grava; `timer` é `let` declarado antes de uso; `EstadoAviso` vive só em `ab-original-resolucao.ts`.)
- [ ] **Passo 5 (prova, r6):** os três arquivos de teste → PASS; `tsc` 0. Como o B1 muda o comportamento da fixture compartilhada, rodar também, sem alterar asserção de teste algum fora do caso 24/"nada mudou": `cd W/apps/web && npx vitest run test/ab- test/youtube test/pipeline > /tmp/oea-t1c.log 2>&1; tail -30 /tmp/oea-t1c.log` e, com o banco local de integração (`bythiago_int`, portas 54421/54422; `npm run db:start` conforme `reference_banco_local_integracao`), `HAS_LOCAL_DB=1 npx vitest run test/integration/ab-p4a-retomar-iniciar.test.ts` (tem `thumbnail_dhash` e **só roda com `HAS_LOCAL_DB`: a CI não pega**). Commit `feat: regrava a original baixa no início do teste e textos pós-M1 do aviso (D12, r5)`, caminhos explícitos: `Y/ab-start.ts`, `Y/ab-original-resolucao.ts`, `use-aviso-original.ts`, `T/helpers/banco-ab.ts`, `T/helpers/youtube-falso.ts` e os testes tocados (listar no commit).

### Tarefa 1b: aviso antes de iniciar o teste quando a original guardada é baixa (nova, r4; passos 5–9 reescritos na r5)

O aviso aparece no passo Revisar do assistente (`step-revisar.tsx`), **logo abaixo do banner de veredito** (cujo título muda por estado, ver T1c e `tituloDoBanner`), antes do resumo. É a última tela antes de "Ativar teste". Não toca `step-variantes.tsx` (o envio que moraria lá está congelado). Só para `thumbnail` e `combo`.

**Decisões (ver "Decisões da r4"):** três estados, nunca confundidos. (1) **Medida e baixa** (largura < 1280, ou `dimensions` nula/`0x0`/ilegível com a original já guardada e com dHash): selo "Baixa resolução", texto com ou sem número. (2) **Não medida** (`thumbnail_dhash` nulo na original, ou original ausente): selo neutro "Resolução não medida" e texto próprio, porque o início do teste (`ab-start.ts:316-337`) regrava a maior cópia e mede; **nunca** afirmar "baixa" sem medida. (3) **Leitura falhou** (erro ou mais de uma original): linha neutra "Não consegui conferir a resolução da original agora." Em nenhum dos três o aviso bloqueia.

**Files:**
- Modify: `Y/ab-original-resolucao.ts` (+ `AvisoOriginal`, `textoAvisoOriginalBaixa`, `AVISO_INDISPONIVEL`), `AB/actions.ts` (+ `lerDimensoesDaOriginal`, logo após `cleanupDraftVariants`, ~:560), `AB/_components/step-revisar.tsx`, `AB/_components/ab-create-wizard.tsx`
- Create: `AB/_components/use-aviso-original.ts`, `T/youtube/ab-aviso-original-baixa.test.tsx` (só o hook), `T/youtube/ab-ler-dimensoes-da-original.test.ts`, `T/ab-wizard-aviso-original.test.tsx`
- Test (acrescentar): `T/youtube/ab-original-resolucao.test.ts`, `T/cms/ab-step-revisar.test.tsx` (os casos do componente moram aqui, onde o `StepRevisar` já é montado com os mocks de `lucide-react` e `click-moment`)
- Test (ajustar mocks): `T/ab-wizard-variante-vazia.test.tsx:5-8` e `T/ab-wizard-referencia.test.tsx:8-10`

**Texto (r5):** vigora o do mockup M1 r2, copiado letra por letra na **T1c passo 3** (saída com "o teste guarda a nova ao ativar, mesmo que este aviso continue aqui"; não medida com "o teste mede ao ativar"; 1b com "abaixo do mínimo de 1280 px de largura"; leitura falhou com "Isso não impede de ativar."). Os passos 1 e 4 abaixo e o código dos passos 1–4 são o **histórico** do que `10fb16929`/`d523f7d06` entregaram: as asserções e textos que a T1c troca estão na tabela do passo 3 dela. A diferença para o diálogo de encerrar (que segue "Baixa resolução" para nulo/ilegível, porque depois do início a linha está medida) continua registrada nas decisões.

- [ ] **Passo 1: teste da função de texto (falha)**, em `T/youtube/ab-original-resolucao.test.ts`:

```ts
import { textoAvisoOriginalBaixa, AVISO_INDISPONIVEL } from '@/lib/youtube/ab-original-resolucao'

describe('textoAvisoOriginalBaixa(dimensions, medida)', () => {
  it('1280x720 e acima: sem aviso (medida ou não)', () => {
    expect(textoAvisoOriginalBaixa('1280x720', true)).toBeNull()
    expect(textoAvisoOriginalBaixa('1920x1080', true)).toBeNull()
    expect(textoAvisoOriginalBaixa('1280x720', false)).toBeNull()
  })
  it('1279 avisa com o número, selo Baixa resolução, e traz a saída', () => {
    const a = textoAvisoOriginalBaixa('1279x719', true)
    expect(a?.kind).toBe('baixa')
    expect(a?.selo).toBe('Baixa resolução')
    expect(a?.texto).toContain('A original guardada tem só 1279×719: o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.')
    expect(a?.texto).toContain('ative assim mesmo')
    expect(textoAvisoOriginalBaixa('480x360', true)?.texto).toContain('480×360')
  })
  it('medida mas ilegível (nula, 0x0, lixo): baixa, sem número, sem "undefined"/"null"/"NaN"', () => {
    for (const d of [null, undefined, '', '0x0', 'lixo']) {
      const a = textoAvisoOriginalBaixa(d, true)
      expect(a?.kind).toBe('baixa')
      expect(a?.texto).toContain('é de baixa resolução (mínimo 1280 px de largura)')
      expect(a?.texto).not.toMatch(/undefined|null|NaN/)
    }
  })
  it('não medida: selo e texto próprios, nunca "baixa"', () => {
    for (const d of [null, undefined, '0x0', '480x360']) {
      const a = textoAvisoOriginalBaixa(d, false)
      expect(a?.kind).toBe('nao-medida')
      expect(a?.selo).toBe('Resolução não medida')
      expect(a?.texto).toContain('ainda não foi medida')
      expect(a?.texto).not.toMatch(/baixa resolução|undefined|null|NaN/i)
    }
  })
  it('a linha de leitura que falhou é neutra e fixa', () => {
    expect(AVISO_INDISPONIVEL).toEqual({ kind: 'indisponivel', selo: null, texto: 'Não consegui conferir a resolução da original agora.' })
  })
})
```

Implementar em `Y/ab-original-resolucao.ts`:

```ts
export type AvisoOriginal =
  | { kind: 'baixa'; selo: 'Baixa resolução'; texto: string }
  | { kind: 'nao-medida'; selo: 'Resolução não medida'; texto: string }
  | { kind: 'indisponivel'; selo: null; texto: 'Não consegui conferir a resolução da original agora.' }

export const AVISO_INDISPONIVEL: AvisoOriginal = {
  kind: 'indisponivel', selo: null, texto: 'Não consegui conferir a resolução da original agora.',
}

const CAUDA_AVISO = 'o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.'
const SAIDA_AVISO = `Para evitar, troque a thumbnail do vídeo no YouTube por uma de ${LARGURA_ALTA} px ou mais antes de ativar; ou ative assim mesmo.`

/**
 * Aviso do passo Revisar (D12). null = original em alta, nada a dizer. Nunca bloqueia.
 * `medida` = a original já tem dHash guardado (foi guardada e medida). Sem medida não se afirma "baixa":
 * o início do teste regrava a maior cópia e mede.
 */
export function textoAvisoOriginalBaixa(
  dimensions: string | null | undefined,
  medida: boolean,
): Exclude<AvisoOriginal, { kind: 'indisponivel' }> | null {
  const dim = dimensoesDeTexto(dimensions)
  if (dim && !publicaBaixa(dim.largura)) return null
  if (!medida) {
    return {
      kind: 'nao-medida', selo: 'Resolução não medida',
      texto: `A resolução da original ainda não foi medida. Ao ativar, o teste guarda a maior cópia que o YouTube tiver; se ela tiver menos de ${LARGURA_ALTA} px de largura, o vídeo voltaria borrado a cada troca. ${SAIDA_AVISO}`,
    }
  }
  return {
    kind: 'baixa', selo: 'Baixa resolução',
    texto: dim
      ? `A original guardada tem só ${dim.largura}×${dim.altura}: ${CAUDA_AVISO} ${SAIDA_AVISO}`
      : `A original guardada é de baixa resolução (mínimo ${LARGURA_ALTA} px de largura): ${CAUDA_AVISO} ${SAIDA_AVISO}`,
  }
}
```

- [ ] **Passo 2: teste da action (falha)**, `T/youtube/ab-ler-dimensoes-da-original.test.ts`, no molde de `T/youtube/pin-actions.test.ts` (mocks de `@/lib/cms/site-context`, `@tn-figueiredo/auth-nextjs/server`, `@/lib/supabase/service`, `next/cache`). Casos: (a) sem permissão (`requireEditAccess` lança) → `{ ok: false }`; (b) teste de outro site (consulta do `ab_tests` com `.eq('site_id', ...)` devolve nulo) → `{ ok: false }`; (c) uma variante `is_original` com `dimensions: '480x360'` e `thumbnail_dhash: 'abc'` → `{ ok: true, dimensions: '480x360', medida: true }`; (d1) uma variante sem `dimensions` e sem `thumbnail_dhash` → `{ ok: true, dimensions: null, medida: false }`; (d2) `dimensions: '0x0'` com `thumbnail_dhash` → `{ ok: true, dimensions: '0x0', medida: true }`; (d3) nenhuma linha `is_original` (rascunho legado) → `{ ok: true, dimensions: null, medida: false }`; (e) a consulta de variantes filtra `is_original = true` (assertar o `.eq('is_original', true)`); (f) erro na consulta de variantes (`{ data: null, error: { message: 'x' } }`) → `{ ok: false }`; (g) **duas** linhas `is_original` para o mesmo teste → `{ ok: false }` (ambíguo; não escolher uma); (h) erro na consulta de `ab_tests` → `{ ok: false }`.
- [ ] **Passo 3:** implementar em `AB/actions.ts`, junto das outras (mesmo padrão de `cleanupDraftVariants`, :518-538). A consulta de variantes termina em `.limit(2)` (sem `maybeSingle`: 2 originais é ambíguo e tem de falhar, e `ab_test_variants` não tem índice único por `is_original`):

```ts
/** D12: só leitura da original guardada do rascunho; o assistente avisa, nunca bloqueia. Erro ou ambiguidade = ok:false. */
export async function lerDimensoesDaOriginal(
  testId: string,
): Promise<{ ok: true; dimensions: string | null; medida: boolean } | { ok: false }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  const supabase = getSupabaseServiceClient()
  const { data: test, error: eTeste } = await supabase
    .from('ab_tests').select('id').eq('id', testId).eq('site_id', siteId).maybeSingle()
  if (eTeste || !test) return { ok: false }
  const { data: originais, error: eVar } = await supabase
    .from('ab_test_variants').select('dimensions, thumbnail_dhash')
    .eq('test_id', testId).eq('is_original', true).limit(2)
  if (eVar || !originais || originais.length > 1) return { ok: false }
  const original = originais[0]
  return { ok: true, dimensions: original?.dimensions ?? null, medida: original?.thumbnail_dhash != null }
}
```

(`dimensions` já é `string | null` em `database.types.ts:268`, então não há `as`. Conferir que `thumbnail_dhash` consta nos tipos; o ajuste dos mocks encadeados segue o que o teste montar.)
- [ ] **Passo 4: testes do hook (falha)**, `T/youtube/ab-aviso-original-baixa.test.tsx`, `// @vitest-environment jsdom`. O hook recebe a função por parâmetro (regra do CLAUDE.md: server action em client component só por prop/callback), então **não há `vi.mock`**:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAvisoOriginal } from '@/app/cms/(authed)/youtube/ab-lab/_components/use-aviso-original'

const ler = vi.fn()

describe('useAvisoOriginal', () => {
  beforeEach(() => ler.mockReset())

  it('480x360 medida → baixa; 1280x720 → null', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    const a = renderHook(() => useAvisoOriginal(ler, 't1', 'thumbnail', true))
    await waitFor(() => expect(a.result.current?.texto).toContain('480×360'))
    ler.mockResolvedValueOnce({ ok: true, dimensions: '1280x720', medida: true })
    const b = renderHook(() => useAvisoOriginal(ler, 't2', 'combo', true))
    await waitFor(() => expect(ler).toHaveBeenCalledTimes(2))
    expect(b.result.current).toBeNull()
  })
  it('dimensions nula e original medida: baixa sem número', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null, medida: true })
    const h = renderHook(() => useAvisoOriginal(ler, 't3', 'thumbnail', true))
    await waitFor(() => expect(h.result.current?.texto).toContain('mínimo 1280 px de largura'))
  })
  it('não medida: selo e texto próprios, sem "baixa"', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null, medida: false })
    const h = renderHook(() => useAvisoOriginal(ler, 't3b', 'thumbnail', true))
    await waitFor(() => expect(h.result.current?.kind).toBe('nao-medida'))
    expect(h.result.current?.selo).toBe('Resolução não medida')
  })
  it('leitura que falha, lança de forma síncrona ou rejeita: linha neutra, nunca "baixa"', async () => {
    ler.mockResolvedValueOnce({ ok: false })
    const a = renderHook(() => useAvisoOriginal(ler, 't4', 'thumbnail', true))
    await waitFor(() => expect(a.result.current?.kind).toBe('indisponivel'))
    ler.mockRejectedValueOnce(new Error('rede'))
    const b = renderHook(() => useAvisoOriginal(ler, 't5', 'thumbnail', true))
    await waitFor(() => expect(b.result.current?.kind).toBe('indisponivel'))
    ler.mockImplementationOnce(() => { throw new Error('síncrono') })
    const c = renderHook(() => useAvisoOriginal(ler, 't5b', 'thumbnail', true))
    await waitFor(() => expect(c.result.current?.kind).toBe('indisponivel'))
  })
  it('tipo title ou passo inativo não lê', () => {
    renderHook(() => useAvisoOriginal(ler, 't6', 'title', true))
    renderHook(() => useAvisoOriginal(ler, 't7', 'thumbnail', false))
    expect(ler).not.toHaveBeenCalled()
  })
  it('thumbnail sem rascunho: aviso "não medida", sem leitura (r6)', () => {
    const h = renderHook(() => useAvisoOriginal(ler, null, 'thumbnail', true))
    expect(h.result.current).toMatchObject({ kind: 'nao-medida' })
    expect(ler).not.toHaveBeenCalled()
  })
  it('trocar o rascunho limpa o aviso antigo antes da nova resposta (Logan L7)', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    const h = renderHook(({ id }) => useAvisoOriginal(ler, id, 'thumbnail', true), { initialProps: { id: 'a' } })
    await waitFor(() => expect(h.result.current?.kind).toBe('baixa'))
    ler.mockReturnValueOnce(new Promise(() => {}))
    h.rerender({ id: 'b' })
    expect(h.result.current).toBeNull()
  })
})
```

- [ ] **Passo 5: tokens de cor por tema (Naksu C1-C3; testes não dependem de cor)**, em `apps/web/src/app/globals.css`, dentro dos blocos `[data-theme="dark"]` (:255) e `[data-theme="light"]` (:384), junto das demais `--cms-*`. Valores do README do mockup r2:

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--cms-green-text` | `#4ADE80` | `#126B35` | palavra do veredito (5,75:1 no claro; o `#4ade80` fixo dava 1,52:1) |
| `--cms-green-icon` | `#22C55E` | `#15803D` | ícone do banner (4,37:1; era 1,98:1) |
| `--cms-amber-text` | `#FBBF24` | `#7A4E00` | texto e ícone do selo "Baixa resolução" |
| `--cms-amber-soft` | `rgba(251,191,36,.12)` | `rgba(245,158,11,.14)` | fundo do selo |
| `--cms-amber-line` | `rgba(245,158,11,.5)` | `rgba(160,100,0,.55)` | borda do selo |
| `--cms-ban-bg` | `rgba(34,197,94,.08)` | `#F4F7F8` | fundo do banner do passo Revisar (dono 21/10 16:16: no claro, gelo em vez de verde-claro; mockup r3 `e6d802ebd`) |
| `--cms-ban-bd` | `transparent` | `#DCE3E6` | borda do banner (só no claro) |

Neutro: tokens que já existem, `--theme-cms-text-dim` na borda tracejada e `--cms-surface-3` no fundo/esqueleto. **Proibido** `Badge tone="amber"` (o `--cms-amber` do produto é `#f59e0b` nos dois temas: 1,83:1 no claro), `*-subtle` (usa sintaxe de cor relativa, da família do `color-mix()` que o Opera do dono mostrou transparente) e `color-mix()`; só hex/rgba literal. Teste: acrescentar em `T/cms/ab-step-revisar.test.tsx` um caso que lê o fonte (`fs.readFileSync` de `step-revisar.tsx`) e afirma que **não** contém `#4ade80`, `#22c55e`, `tone="amber"`, `-subtle` nem `color-mix(`.
- [ ] **Passo 6: casos do componente**, em `T/cms/ab-step-revisar.test.tsx` (acrescentar; reaproveita a montagem e os mocks do arquivo; `base` = as props que o arquivo já usa). **Asserções trocadas** em relação à r4: `Pronto para iniciar.` some do arquivo e dos testes (vira os dois títulos novos); o caso "leitura falhou" ganha a frase nova; o "sem aviso" ganha o esqueleto.

```tsx
import { textoAvisoOriginalBaixa, AVISO_INDISPONIVEL } from '@/lib/youtube/ab-original-resolucao'

describe('StepRevisar: aviso da original (D12, r5)', () => {
  it('baixa: faixa com selo abaixo do banner; título "Pronto para ativar, com um aviso abaixo."', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} />)
    expect(screen.getByRole('status').textContent).toContain('480×360')
    expect(screen.getByText('Baixa resolução')).toBeTruthy()
    expect(screen.getByText('Pronto para ativar, com um aviso abaixo.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
    expect(screen.queryByText(/Pronto para iniciar/)).toBeNull()
  })
  it('a faixa vem DEPOIS do banner no DOM (Logan L1)', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} />)
    const banner = screen.getByText('Pronto para ativar, com um aviso abaixo.')
    const faixa = screen.getByRole('status')
    expect(banner.compareDocumentPosition(faixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('não medida: selo "Resolução não medida" e título com aviso, sem "Baixa resolução"', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa(null, false)} />)
    expect(screen.getByText('Resolução não medida')).toBeTruthy()
    expect(screen.getByText('Pronto para ativar, com um aviso abaixo.')).toBeTruthy()
    expect(screen.queryByText('Baixa resolução')).toBeNull()
  })
  it('leitura falhou: linha neutra, sem selo, título "Pronto para ativar."', () => {
    render(<StepRevisar {...base} avisoOriginal={AVISO_INDISPONIVEL} />)
    expect(screen.getByRole('status').textContent).toBe('Não consegui conferir a resolução da original agora. Isso não impede de ativar.')
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Baixa resolução')).toBeNull()
  })
  it('C5: leitura pendente: "Pronto para ativar.", esqueleto com aria-busy, nenhum role=status, nunca "Tudo pronto."', () => {
    const { container } = render(<StepRevisar {...base} avisoOriginal="pendente" />)
    expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    const esqueleto = container.querySelector('[aria-busy="true"]') as HTMLElement
    expect(esqueleto).toBeTruthy()
    expect(esqueleto.querySelector('[class*="h-5"]')).toBeTruthy()   // 20 px
  })
  it('role="status" entra junto com o conteúdo, nunca vazio (Naksu S3)', () => {
    render(<StepRevisar {...base} avisoOriginal={textoAvisoOriginalBaixa('480x360', true)} />)
    expect(screen.getByRole('status').textContent?.length).toBeGreaterThan(20)
  })
  it('sem aviso (null ou ausente): nada na tela e o banner segue "Tudo pronto."; nota "para começar"', () => {
    const { unmount } = render(<StepRevisar {...base} avisoOriginal={null} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Tudo pronto.')).toBeTruthy()
    expect(screen.getByText(/Clique em/).textContent).toContain('para começar')
    unmount()
    render(<StepRevisar {...base} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
```

(Antes de acrescentar, conferir que o arquivo não tem outro `role="status"`; Logan conferiu que `step-revisar.tsx` não tem. A nota do rodapé existe em `step-revisar.tsx`; trocar `iniciar` por `começar` e usar `NOTA_ATIVAR` da T1c.)
- [ ] **Passo 7: teste do assistente que prova "não bloqueia", a fiação da prop e o passo 2 (Yannis I1, Logan C3)**, `T/ab-wizard-aviso-original.test.tsx`, no molde de `T/ab-wizard-variante-vazia.test.tsx` (mesmo `vi.mock` de actions, acrescentando `lerDimensoesDaOriginal`, o mesmo stub de `localStorage` e o mesmo `video`):

```tsx
// @vitest-environment jsdom
const { ler, start } = vi.hoisted(() => ({ ler: vi.fn(), start: vi.fn(async () => ({ ok: true })) }))  // Yannis N1: vi.mock é içado antes de const
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: vi.fn(), uploadVariant: vi.fn(), startAbTest: start, createTextVariant: vi.fn(),
  updateAbTestType: vi.fn(), cleanupDraftVariants: vi.fn(async () => ({ ok: true })), fetchAbBriefingData: vi.fn(),
  fetchLibraryEntries: vi.fn(async () => []), lerDimensoesDaOriginal: (id: string) => ler(id),
}))
const prefill = { testType: 'thumbnail' as const, draftVariants: [
  { label: 'A', isOriginal: true, thumbUrl: 'https://i.ytimg.com/a.jpg', titleText: 'v' },
  { label: 'B', isOriginal: false, thumbUrl: 'https://blob/b.jpg', titleText: '' } ] }
const montar = () => render(<AbCreateWizard video={video} siteId="s" settings={{} as never}
  onClose={vi.fn()} onCreated={vi.fn()} prefill={prefill} existingDraftId="d1" />)

it('passo Revisar: aviso aparece, lido pelo rascunho, e Ativar teste segue habilitado e inicia', async () => {
  ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
  montar()
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('480×360'))
  expect(ler).toHaveBeenCalledWith('d1')
  const ativar = screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement
  expect(ativar.disabled).toBe(false)
  expect((screen.getByRole('button', { name: /Salvar rascunho/ }) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(ativar)
  await waitFor(() => expect(start).toHaveBeenCalledWith('d1'))
})
it('leitura pendurada: botões habilitados, esqueleto e "Pronto para ativar." (nunca "Tudo pronto."), sem role=status', () => {
  ler.mockReturnValueOnce(new Promise(() => {}))
  const { container } = montar()
  expect((screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.getByText('Pronto para ativar.')).toBeTruthy()
  expect(screen.queryByText('Tudo pronto.')).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
})
it('leitura que falha: linha neutra e Ativar teste habilitado', async () => {
  ler.mockResolvedValueOnce({ ok: false })
  montar()
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Não consegui conferir'))
  expect((screen.getByRole('button', { name: /Ativar teste/ }) as HTMLButtonElement).disabled).toBe(false)
})
it('C3: abre direto em Variantes (passo 2) e já lê a original', async () => {
  // r6: sem prop nova. step inicial = prefillType || existingDraftId ? 2 : 0 (ab-create-wizard.tsx:289) quando NÃO é continuingDraft
  // (continuingDraft exige draftVariants.length > 1, :256); draftTestId vem só de existingDraftId (:296). localStorage limpo no beforeEach (senão saved.step manda).
  ler.mockResolvedValue({ ok: true, dimensions: '1280x720', medida: true })
  render(<AbCreateWizard video={video} siteId="s" settings={{} as never}
    onClose={vi.fn()} onCreated={vi.fn()} prefill={{ testType: 'thumbnail' } as never} existingDraftId="d2" />)
  await waitFor(() => expect(ler).toHaveBeenCalledWith('d2'))
  expect(ler).toHaveBeenCalledTimes(1)
})
it('C3b: no passo 1 a leitura não começa', async () => {
  // localStorage com { type: 'thumbnail', step: 1 }, mesmo formato do stub de ab-wizard-variante-vazia; sem prefill.testType
  window.localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ type: 'thumbnail', step: 1 }))   // usar a chave/formato do stub de ab-wizard-variante-vazia
  render(<AbCreateWizard video={video} siteId="s" settings={{} as never}
    onClose={vi.fn()} onCreated={vi.fn()} prefill={{} as never} existingDraftId="d2" />)
  await Promise.resolve()
  expect(ler).not.toHaveBeenCalled()
})
```

(Com `existingDraftId` e `draftVariants.length > 1`, `continuingDraft` é verdadeiro e o assistente abre direto no passo 4 (`ab-create-wizard.tsx:256,285`); por isso o caso C3 não passa variantes. A variante B com `thumbUrl` http não dispara upload. Estes testes matam os mutantes que o `grep` do diff não pega: a leitura embrulhada em `startTransition` (o `isPending` desabilitaria os botões, `:675`/`:683`), a prop esquecida no `<StepRevisar>`, o `step >= 3`/`>= 4` (C3 falha: `ler` nunca é chamada no passo 2) e o `>= 1` (C3b falha). `initialStep` **não existe** em `Props`. O teste do hook com `ativo=false` (`ler` não chamada; `rerender({ ativo: true })`, chamada uma vez) é a reserva barata. `LEITURA_A_PARTIR_DO_PASSO` fica exportada como cinto, **sem** teste que afirma o valor `2` (espelharia a implementação).)
- [ ] **Passo 8:** `npx vitest run` dos arquivos novos e alterados → FAIL. Implementar:

`AB/_components/use-aviso-original.ts`: **já existe** (T1b passo 4 + T1c passo 4). Acrescentar `export const LEITURA_A_PARTIR_DO_PASSO = 2` (Variantes; trilho Tipo 0, Ideias 1, Variantes 2, Config 3, Revisar 4, `ab-create-wizard.tsx:76` e `:235`).

`step-revisar.tsx`: em `StepRevisarProps` (:21-26) acrescentar `avisoOriginal?: EstadoAviso`; desestruturar. Banner (:137-149): o ícone `CheckCircle` troca `style={{ color: '#22c55e' }}` por `className="... text-[var(--cms-green-icon)]"` (`'pendente'`: `text-cms-text-muted`, S1 da Naksu: ícone neutro, sem verde antes da resposta); a palavra troca `style={{ color: '#4ade80' }}` por `text-[var(--cms-green-text)]` (em `'pendente'`: `text-cms-text`, sem verde) e o texto vira `{tituloDoBanner(avisoOriginal)}`; o resumo (`summaryText`) troca `text-cms-text-muted` por `text-cms-text` (Naksu M1: 4,30:1 no escuro, defeito que já existe, uma classe). Nota do rodapé (`Clique em Ativar teste para iniciar...`) vira `{NOTA_ATIVAR}`. **Logo depois do banner** e antes do resumo:

```tsx
{avisoOriginal === 'pendente' ? (
  <div aria-busy="true" aria-label="Lendo a resolução da original">
    <span className="block h-5 w-3/5 rounded bg-cms-surface-3 motion-safe:animate-pulse" />
  </div>
) : avisoOriginal ? (
  avisoOriginal.kind === 'indisponivel' ? (
    <p role="status" className="m-0 text-[12.5px] text-cms-text-muted">{avisoOriginal.texto}</p>
  ) : (
    <AvisoResolucao aviso={avisoOriginal} />
  )
) : null}
```

`AvisoResolucao` (no mesmo arquivo ou em `ab-primitives.tsx`; **recebe o aviso por prop**, o sujeito do selo vem de `aviso.kind`, não de `Badge`): `<div role="status" className="grid justify-items-start gap-2 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 text-[12.5px] leading-[1.55] text-cms-text">` com o selo `<span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-px text-[12px] font-semibold leading-5" ...>`: para `baixa`, ícone triângulo (lucide `AlertTriangle`, 14 px) e `style` com `color: var(--cms-amber-text)`, `borderColor: var(--cms-amber-line)`, `background: var(--cms-amber-soft)` (borda contínua); para `nao-medida`, ícone círculo tracejado com interrogação (`CircleHelp`, 14 px, ou SVG do mockup), cor `text-cms-text-muted`, borda `1px dashed var(--theme-cms-text-dim)`, fundo `bg-cms-surface-3` (tracejado: o selo se distingue sem cor). O texto numa `<p className="m-0 max-w-[78ch]">`. O `role="status"` **entra junto com o conteúdo** (o `div` só é renderizado com o texto pronto; nunca um `role="status"` vazio que se preenche depois, Naksu S3). Esqueleto: 20 px (`h-5`), 60% da largura, sem animação com `prefers-reduced-motion` (`motion-safe:`), sem `role="status"`. Teste dos mocks de `lucide-react` em `ab-step-revisar.test.tsx`: **acrescentar** `AlertTriangle` e `CircleHelp` (ou os nomes usados) ao mock, que hoje só tem os ícones atuais; conferir antes.

`ab-create-wizard.tsx`: **o assistente** importa `lerDimensoesDaOriginal` de `../actions` (já importa 8 actions por aí, `:14-23`; dívida existente, registrada nos Riscos) e `useAvisoOriginal`. Depois de `useState` do `libraryPickerFor` (:~309): `const avisoOriginal = useAvisoOriginal(lerDimensoesDaOriginal, state.draftTestId, state.type, state.step >= LEITURA_A_PARTIR_DO_PASSO)` (Logan C3: **passo 2 = Variantes**; a linha `is_original` já existe desde `createAbTest` ao escolher o tipo, `actions.ts:286`, então ler em Variantes não espera nada; o tempo de montar as variantes cobre a leitura numa conexão ruim, e em Config, passo 3, a janela seria de segundos). No `<StepRevisar ... />` (:~555-567) passar `avisoOriginal={avisoOriginal}`. **Não** alterar `stepIsValid` (:240-249), `goNext`, `handleSubmit` (:391) nem os botões (:~674-682).

**Ajuste obrigatório dos mocks existentes (custo do hook injetado):** o assistente passa a ler o binding `lerDimensoesDaOriginal` a cada render, e o vitest lança quando falta export num mock de fábrica. Acrescentar `lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false }))` ao `vi.mock` de `T/ab-wizard-variante-vazia.test.tsx:5-8` e de `T/ab-wizard-referencia.test.tsx:8-10`, e a **qualquer outro** teste que renderize o `AbCreateWizard` real: `grep -rln "AbCreateWizard" apps/web/test` e abrir cada um que tenha `vi.mock` da `actions`.
- [ ] **Passo 9:** os arquivos novos e alterados → PASS; depois a seção 3 inteira (suíte `test/youtube test/cms/ab- test/ab-` e `tsc` 0). Conferir no diff que `stepIsValid` e `handleSubmit` não mudaram: `git diff -U0 -- '<AB>/_components/ab-create-wizard.tsx' | grep -E "stepIsValid|handleSubmit|startAbTest"` → vazio (o teste do passo 7 é a prova de comportamento; o `grep` é só o cinto).
- [ ] **Passo 10:** commit `feat: aviso de original baixa antes de iniciar o teste (D12)`, caminhos explícitos: os de código (`step-revisar.tsx`, `ab-create-wizard.tsx`, `use-aviso-original.ts`, `actions.ts`, `ab-original-resolucao.ts`, `globals.css`) e os de teste (`ab-original-resolucao`, `ab-aviso-original-baixa`, `ab-ler-dimensoes-da-original`, `ab-step-revisar`, `ab-wizard-aviso-original`, `ab-wizard-variante-vazia`, `ab-wizard-referencia`, `cms/ab-create-wizard-restore` (Yannis N2: mocka as actions com o assistente real; acrescentar `lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false }))` ao mock da linha 6); mais qualquer mock ajustado no passo 8). `ab-start.ts` e seu teste já saíram no commit da T1c.

**Paridade Cowork/MCP (registro, sem tarefa):** fora. `manage_ab_test` não tem ação de iniciar (`tools.ts:665`), então não há "antes de iniciar" no MCP; o Cowork só edita variantes de rascunho. Não mexer em `apps/web/src/lib/pipeline/` nem em `cowork-docs-youtube.md` (sem rota nem campo novo). Se um dia o MCP ganhar `start`, o aviso entra na resposta junto do descongelo (T15 do apêndice).

**Fora desta tarefa (registro):** o início pela lista (`batchStartTests`, `AB/actions.ts:~1373`) e pelo detalhe do teste não mostram o aviso; o diálogo de encerrar já mostra o selo no fim. Entram junto de T17/T18 se descongelarem.

### Tarefa 20: prova local (reduzida)

**Files:** capturas em `.superpowers/sdd/ab-lab/original-em-alta/prova-shots/` (Gio).

- [ ] **Passo 1:** `cd W/apps/web && npx vitest run test/youtube test/cms/ab- test/ab- > /tmp/oea-suite.log 2>&1; tail -30 /tmp/oea-suite.log` e `npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log`. Esperado: 0 falhas, 0 `error TS`; só falhas no contexto. Em background se passar de 4 min. **Sem** `next build` obrigatório (o Vercel faz; CLAUDE.md) e sem integração (não há SQL).
- [ ] **Passo 2 (Gio, navegador, Sonnet):** CMS local autenticado (`docs/ops/runbook-cms-e2e-local.md`), vídeo de semente cujo rascunho tem a original `480x360`, outro `1280x720`, outro com `dimensions` nula e sem dHash (não medida): abrir o assistente até Revisar a 1440 e 390, claro e escuro. Esperado: `480x360` com banner "Pronto para ativar, com um aviso abaixo.", faixa abaixo dele e selo "Baixa resolução" (âmbar legível nos dois temas: texto `#7A4E00` no claro); `1280x720` sem faixa e com "Tudo pronto." (verde `#126B35` legível no claro); não medida com selo neutro tracejado "Resolução não medida" e o texto "ainda não foi medida; o teste mede ao ativar" (nunca "baixa"); leitura com a rede estrangulada: esqueleto de 20 px, banner "Pronto para ativar.", e passados 8 s a linha "Não consegui conferir... Isso não impede de ativar."; **B1 de ponta a ponta: no vídeo de semente com original `480x360`, trocar a thumbnail do vídeo (de teste) no YouTube pela mesma arte em 1280 px, **esperar o `maxresdefault` responder 200** (`curl -sI https://i.ytimg.com/vi/<id>/maxresdefault.jpg`; logo após a troca o CDN pode servir 404 por minutos e cair em `sddefault` 640x480, e então o B1 regrava mas o aviso continua), ativar, conferir que o tempo do "Ativar" com regravação cabe no `prazo` já em uso, e conferir que a original guardada passou a `1280x720` (diálogo "O que fica no vídeo?"); no banco local/prod de teste: `select id, dimensions, thumbnail_dhash from ab_test_variants where is_original and test_id = '<teste da T20>'` dá `1280x720`**; depois de ativar a não medida, o diálogo "O que fica no vídeo?" mostra a medida real; o aviso já está na tela ao chegar (sem salto de layout visível); "Salvar rascunho" e "Ativar teste" habilitados em todos; `scrollWidth` = largura a 390; nenhum "undefined"/"null" no DOM. Abrir o diálogo "O que fica no vídeo?" de um teste com original `640x480`: selo "Baixa resolução". Veredito em texto no ledger.
- [ ] **Passo 3:** sonda dos Shorts, **só leitura, sem criar rascunho** (criar rascunho chama `guardarOriginalMaior` e grava no Blob, `ab-variant-dhash.ts:85`): para cada um dos 2 Shorts reais, `for q in maxresdefault hq720 sddefault hqdefault; do curl -s -o /tmp/s-$q.jpg -w "$q %{http_code} " "https://i.ytimg.com/vi/<id>/$q.jpg"; sips -g pixelWidth -g pixelHeight /tmp/s-$q.jpg; done` e anotar o `http_code` e a LxA de cada; **só vale resposta 200** (Phil M1: em 404 o ytimg devolve um placeholder 120×90, que o `sips` mede como se fosse a imagem); a primeira com 200 é o que `guardarOriginalMaior` guardaria. Registrar no roteiro (`docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`) como subnúmero de 21 (§5.7), não só no ledger. É o dado do gatilho de descongelar. Opcional, só se o dono autorizar leitura em produção: `select v.dimensions, count(*) from ab_test_variants v join ab_tests t on t.id=v.test_id where v.is_original group by 1 order by 2 desc;`.

---

## 5. Portão e envio

**Portão (antes de qualquer push; r6: Phil e Yannis reconferem só o diff da r6):** Yannis (B1, tempo-limite) e Logan (textos) revisam a emenda da r5, Naksu confere os tokens na captura da execução; Gio faz a T20. (A r4 foi aprovada por Phil 93, Yannis 93, Logan 90.) Conserta-se até haver acordo (sem BLOQUEIA/CORRIGE aberto). Logan confere os textos novos (T1b).

**Envio:** junto do próximo push com código do lote `lote/ab-p4b-a`; **sem migration**, logo sem `db:push:prod` e sem fila de DB; nenhum push só deste plano; ≤ 3 pushes de staging/dia (crédito da Vercel). CI verde depois do push.

## 6. Riscos

- **Short sem `maxres` 1280** (o risco que congelou a T11): o aviso aparece e o teste inicia; é por isso que o aviso não bloqueia. A sonda da T20 passo 3 mede quantos Shorts caem aqui.
- **(r5) A saída "troque no YouTube e ative" agora funciona:** a T1c regrava a original quando a guardada é baixa, mesmo com dHash igual (B1). Custo: uma cópia a mais no Blob por início de teste com original baixa; um Short sem `maxres` regrava a mesma 480×360 (idempotente). O aviso continua na tela depois da troca (lê só o guardado) e o texto diz isso.
- **(r6) B1 custa 1 `put` extra no Blob por início com original baixa, e a cópia antiga fica órfã:** nada apaga `ab-originals/*` (o único `del` de variante é `ab-draft-cleanup/route.ts:79-93`, que lê o `blob_url` **atual**; a carência de 7/30 dias do Blob não cobre esse prefixo); `source_variant_id` e rodadas (`parent_test_id`) podem apontar a mesma URL, então **não** se apaga no B1. Teto **estimado, não medido** (1280x720 JPEG 100-250 KB): ~3 inícios/semana, 1,33 `put` cada (1 retentativa em 3) = ~208 cópias/ano = ~52 MB/ano; com 3x mais canais ~156 MB/ano. Cabe com folga. **Dívida com gatilho:** mais de 1.000 objetos ou 100 MB no prefixo `ab-originals/` -> tarefa separada de varredura que lista o prefixo, compara com `blob_url` e `original_thumbnail_url` vivos e apaga com carência de 30 dias (Phil define). Short sem `maxres` regrava a mesma 480x360 a cada início (idempotente).
- **(r6) A promessa "o teste guarda a nova ao ativar" pode falhar logo após a troca:** `biggerCopy` pede `maxresdefault` e depois `sddefault` (`thumb-fingerprint.ts:83`); com `maxres` 404 por minutos o B1 regrava 640x480 e o aviso continua. A T20 espera o `maxres` 200 antes de ativar.
- **(r6) Resposta lenta da leitura:** server actions do Next executam em fila por cliente; a leitura vai primeiro porque dispara ao entrar no passo 2, antes de qualquer upload de variante; mover o gatilho para depois pode estourar os 8 s sem rede ruim. O teste C3 guarda a fiação. O `indisponivel` por tempo é provisório: resposta `ok` tardia o substitui.
- **Aviso para quem só tem uma saída:** sem o envio, o dono lê o aviso e pode ignorá-lo ("ative assim mesmo") ou **trocar a thumbnail no YouTube antes de ativar**: o início do teste guarda a nova cópia quando o dHash difere (`ab-start.ts:316-337`), então **não** é preciso recriar o rascunho (Phil P1). Aceito pela D12 (informar, não bloquear); o envio volta no descongelo.
- **`dimensions` nula não é "baixa":** só fica nula quando `thumbnail_hq_url` é nula ou fora de `ytimg|ggpht|googleusercontent` (`AB/actions.ts:249-259`), e então o dHash também é nulo; o início regrava a maior cópia e mede. Por isso o estado "Resolução não medida" existe e a T1b nunca afirma "baixa" sem `medida` (Phil P1).
- **Aviso lido uma vez:** se o dono trocar a thumbnail no YouTube com o assistente aberto, o aviso fica com o valor velho; sem dano (não bloqueia, e o início guarda a nova). Sem código (Phil P4).
- **Rascunho só local, sem `draftTestId` (r6: agora mostra "não medida", não "Tudo pronto."):** sem leitura; o teste nasce no clique de Ativar; o diálogo de encerrar mostra o selo no fim. Coberto pelo teste do hook "thumbnail sem rascunho" (`testId = null`). Gatilho: T17 descongelada (Yannis M2).
- **Dívida existente:** o assistente importa 9 server actions direto (8 antes da T1b), contra o CLAUDE.md. O hook novo já recebe a função por parâmetro; o assistente é o único ponto de importação. Gatilho de quitar: próximo refactor do assistente ou incidente de bundle (Yannis M1).
- **Sem índice único de original por teste** (`ab_test_variants`, só `(test_id, label)`): duas originais com rótulos diferentes tornam a leitura ambígua; a action devolve `ok:false` e o aviso vira a linha neutra. Gatilho: descongelo da T2.
- **`dimensions` mente para a `hqdefault`:** `guardarOriginalMaior` cai para a `hqdefault` 480×360 quando `maxres` e `sddefault` não existem; o aviso mede o que foi guardado, não o que o YouTube tem de melhor. Correto para o objetivo (a original que volta é a guardada).
- **Rascunho antigo sem `ab_test_variants` original** (legado): a consulta devolve zero linhas → `dimensions: null`, `medida: false` → "Resolução não medida" (verdade: o início guarda a original). Não quebra.
- **Reducer duplicado** (`ab-create-wizard.tsx` inline e `Y/ab-wizard-reducer.ts`): o aviso não toca nenhum dos dois.

---

## 7. Decisões da r3 (vigentes salvo onde a r4 corrige)

| Decisão | Por quê |
|---|---|
| Escopo = T0, T1, T1b, T20 reduzida; resto congelado | D12 do dono (21/10 12:35), §5.7 |
| T1 enxuta: só `LARGURA_ALTA`, `publicaBaixa`, `dimensoesDeTexto` | proporção, 2 MB e 4:3 são do envio |
| Aviso no passo Revisar (`step-revisar.tsx`), não em `step-variantes.tsx` | é a última tela antes de "Ativar teste"; a área de envio que moraria nas Variantes está congelada |
| Largura vem de `ab_test_variants.dimensions` (`is_original`) lida por action pelo `draftTestId` | o rascunho já existe no passo Revisar (criado ao escolher o tipo); o assistente não guarda dimensões |
| `dimensions` nula, `0x0` ou ilegível **avisa**, sem número | mesma régua da T1 e do diálogo ("ilegível = baixa"); 2 dos 3 testes de produção são nulos; calar seria falhar em verde |
| Leitura que falha ou não voltou **não avisa** e não bloqueia | o aviso é informação; a falha dele não pode impedir o início |
| O aviso nunca desabilita botão nem muda `stepIsValid` | Shorts e D12 ("sem bloquear o início") |
| Texto só do mockup, com uma adaptação marcada para Logan | brief: não inventar texto |
| MCP/Cowork fora | `manage_ab_test` não inicia teste; não há "antes de iniciar" lá |
| Início pela lista e pelo detalhe fora | fora do escopo; entra com T17/T18 se descongelar |
| T20 sem `next build` e sem integração | sem SQL; build é do Vercel (CLAUDE.md) |
| Sonda de 2 Shorts entra na T20 como dado do gatilho | §5.7 exige a sonda antes de qualquer descongelo |

## 8. Decisões da r4

Conserto de r3 conforme `revisao-plano-r3-{phil,yannis,logan}.md` (84, 86, 74) e os rulings do controlador. Relatório achado → lugar: `.superpowers/sdd/ab-lab/original-em-alta/plano-r4-report.md`.

| Decisão | Por quê |
|---|---|
| Três estados no aviso: **baixa** (medida), **não medida**, **leitura falhou** | `dimensions` nula = "ainda não medida", não "baixa"; o início regrava e mede (Phil P1, Logan L2, L5) |
| Action devolve `medida = thumbnail_dhash != null` e falha em erro ou em 2 originais | calar erro virava aviso falso (Phil P2, Yannis I3); sem índice único por `is_original` |
| Texto "não medida" diz que o início guarda a maior cópia, sem alarme; selo neutro "Resolução não medida" | Logan L2 ajustado à realidade de Phil P1 |
| Leitura que falha: linha neutra "Não consegui conferir a resolução da original agora."; nunca "baixa" | Logan L5; substitui a decisão r3 "falha não avisa" |
| Aviso abaixo do banner; título "Pronto para iniciar." quando há aviso (**r5: "Pronto para ativar..." por estado**) | Logan L1 (tela dizia duas coisas opostas) |
| Texto termina com a saída "troque a thumbnail... antes de ativar; ou ative assim mesmo" | Logan L3; "antes de ativar" e não "criar de novo" porque o início guarda a nova (Phil P1) |
| Leitura começa em `step >= 3` (**corrigido na r5: `>= 2`**, Variantes é o passo 2) | Logan L4: aviso pronto ao chegar no Revisar; a conferência da numeração mostrou o erro |
| "mínimo 1280 px de largura" com unidade | Logan L6 |
| `setAviso(null)` no início do efeito | Logan L7 |
| Hook recebe a action por parâmetro (`ler`), com `Promise.resolve().then` | regra do CLAUDE.md (server action só por prop/callback) e throw síncrono (Yannis M1); ajusta os 2 mocks de assistente |
| Teste no assistente que prova "não bloqueia", a prop ligada e a leitura pendurada | Yannis I1: o `grep` do diff não pega `startTransition` nem prop esquecida |
| Comandos de prova incluem `test/cms/ab-` e `test/ab-` | Yannis I2: regressão no assistente só aparecia na CI |
| Casos do componente vão para `T/cms/ab-step-revisar.test.tsx`; arquivo do hook fica só com o hook | Yannis M3 (um arquivo de teste a menos) |
| Rascunho só local sem `draftTestId`: sem aviso, registrado em Riscos com o teste "sem rascunho não lê" | Yannis M2; corrigido o fato da §2 |
| Sonda dos Shorts só leitura (`curl` + `sips`), sem rascunho; registrada no roteiro como subnúmero de 21 | Phil P3: criar rascunho grava no Blob |
| Riscos: troca de thumbnail com o assistente aberto; frase "recriar o rascunho" corrigida | Phil P4 e P1 |
| Diálogo de encerrar mantém "Baixa resolução" para nulo/ilegível | depois do início a linha está medida; é outro momento |

## 9. Decisões da r5

Emenda pós-M1 conforme `revisao-m1-logan.md` (70, re-revisão 93) e `revisao-m1-naksu.md` (84, re-revisão 94), mockup M1 r2 (`d49aca338`). Código da T1/T1b passos 1–4 já commitado (`10fb16929`, `d523f7d06`) com os textos antigos: a **T1c** o ajusta.

| Decisão | Por quê |
|---|---|
| **T1c nova** (entre os passos 4 e 5 da T1b); passos 5–9 da T1b reescritos (viram 5–10) | o código feito precisa dos textos novos, do hook de 3 estados e do B1 antes da tela |
| **B1:** `ab-start.ts:317-321` regrava a original também quando a guardada é baixa (`publicaBaixa(dimensoesDeTexto(original?.dimensions)?.largura ?? 0)`); `dimensions` entra no select (`:222`) e em `VarianteInicio` (`:169`), que **não traziam** a coluna | sem isso a saída do aviso ("troque no YouTube e ative") é falsa: mesma arte em 1280 px tem o mesmo dHash e não regrava (Logan B1, falha em verde); Yannis confirma o custo (uma cópia a mais no Blob só quando baixa) |
| Teste B1: dHash igual + `480x360` regrava; dHash igual + `1280x720` não; `dimensions` nula com dHash igual regrava | o caso "nada mudou" existente passa a usar `1280x720` na fixture |
| Textos C1 (não medida), C2 (títulos do banner e nota "para começar"), C4 (1b "abaixo do mínimo de 1280 px de largura"), M1 (falhou: "Isso não impede de ativar."), B1 (saída) copiados **letra por letra** do mockup r2; `tituloDoBanner` e `NOTA_ATIVAR` puras e testadas | o componente só consome; sem texto inventado |
| Banner: "Tudo pronto." só com leitura em alta ou tipo só título; "Pronto para ativar." (falhou, lendo); "Pronto para ativar, com um aviso abaixo." (baixa, não medida) | Logan C2/C5: dois verbos, e verde de relance escondia o âmbar |
| Leitura em `state.step >= 2` (`LEITURA_A_PARTIR_DO_PASSO = 2`), plano corrigido (a r4 dizia 3) | Logan C3: trilho Tipo 0, Ideias 1, Variantes 2, Config 3, Revisar 4 (`ab-create-wizard.tsx:76`, `:235`); a linha `is_original` existe desde a escolha do tipo (`actions.ts:286`) |
| Hook de 3 estados `'pendente' \| null \| AvisoOriginal`; `null` = alta ou não se aplica | Logan C5: pendente e alta não podem ser o mesmo valor |
| **Tempo-limite do esqueleto: 8 s** (`TEMPO_LIMITE_LEITURA_MS`), vira `indisponivel`; primeiro desfecho vence, resposta tardia ignorada; teste com fake timers (7999 pendente, 8000 indisponível, tardia ignorada, resposta cancela o timer) | Naksu C4 iii, Logan sugestão 2; 8 s é proposta (2 consultas simples, normalmente < 1 s; rede ruim de fora do país), Yannis confirma |
| Tokens `--cms-green-text/-icon`, `--cms-amber-text/-soft/-line` por tema em `globals.css` (valores do README do mockup) | Naksu C1/C2: `#4ade80` fixo dava 1,52:1 no claro, `--cms-amber` 1,83:1 |
| Selo **não** usa `Badge tone="amber"`: `AvisoResolucao` recebe o aviso por prop, ícone (triângulo / círculo tracejado com "?"), rgba literal; sem `*-subtle` nem `color-mix()` | Naksu C2/C3 (Opera); teste de fonte proíbe as cores e classes velhas |
| Esqueleto 20 px (`h-5`, 60%, `bg-cms-surface-3`), `aria-busy="true"`, `motion-safe:animate-pulse`, sem `role="status"`; `role="status"` só com o conteúdo pronto | Naksu C4 ii, S3; a faixa entra sem salto grande porque a leitura começa no passo 2 |
| "Lendo": ícone do banner neutro e palavra em cor de texto | Naksu S1 (verde antes da resposta afirmaria "pronto") |
| Resumo do banner em `text-cms-text` | Naksu M1 (4,30:1 no escuro) |
| Fora: nota de 11 px e título de variante de 10 px (Naksu M2), refazer a leitura ao entrar no passo 4 (Logan M1 opcional) | dívida existente / sem custo-benefício; registrados, não feitos |
| T20 ganha o B1 de ponta a ponta, o esqueleto sob rede lenta e o contraste nos dois temas | itens que Logan e Naksu declararam não verificados |

## 10. Decisões da r6

Conserto da r5 conforme `revisao-plano-r5-phil.md` (86) e `revisao-plano-r5-yannis.md` (84); nenhum BLOQUEIA.

| Decisão | Por quê |
|---|---|
| Fixture `banco-ab.ts:88` ganha `dimensions: '1280x720'` na linha A; casos baixa/nulo via `ajustar`; opção `dimensoesOriginal` descartada; suíte `test/ab- test/youtube test/pipeline` e integração `ab-p4a-retomar-iniciar` com `HAS_LOCAL_DB` (`bythiago_int`) no passo de prova | Phil C1, Yannis C1: sem isso todo início de thumbnail/combo nos 10 arquivos que usam `criarBanco` regrava e quebra por razão errada; a integração a CI não pega |
| Teste B1 serve imagem 1280x720 com o mesmo dHash (`imagemGrande`) e afirma `'1280x720'` e que o aviso some; caso B1b do Short (450x360, idempotente) | Yannis C2: `imagemComDhash` serve 450x360 e o teste passava sem provar a saída |
| Hook: thumbnail/combo sem rascunho devolve "não medida", nunca "Tudo pronto." sem ler | Yannis C3 (falha em verde) |
| Hook: erro fecha; resposta `ok` tardia substitui o `indisponivel` do tempo; teste sem `getTimerCount() === 0`; 8 s mantido | Phil C2, Yannis C5: informação nova vale mais que o placeholder |
| Hook guarda `{ id, valor }` | Phil menor 3: sem quadro de cena velha |
| C3: `existingDraftId="d2"` + `prefill.testType='thumbnail'` + localStorage vazio lê `d2` no passo 2; C3b no passo 1 não lê; sem `initialStep`; sem teste do valor `2` | Phil C3, Yannis C4 |
| Riscos: 1 `put` extra por início com original baixa, cópia antiga órfã, teto estimado, dívida com gatilho; T20 espera `maxres` 200 antes de ativar | Phil menor 1 e 2, Yannis dívida |

---

## Apêndice. Congeladas (D12)

Gatilho de descongelar (§5.7): o dono rodar o primeiro teste nosso em vídeo longo com >= 28 dias e perder a original em alta, ou Short/kids recusado de verdade por original baixa; **antes**, sondar 2 Shorts reais (a guarda da T11 pode bloquear Short sem `maxres` 1280). O texto integral, com código e passos de cada tarefa, está em `git show b8236eed9:docs/superpowers/plans/2026-10-19-ab-original-em-alta-plan.md` (seção 4; Global Constraints, Review Focus, mapa de arquivos, fatos de `5e581375b` e a seção 7 "Decisões da r2" no mesmo commit). Ao descongelar: refazer os `git grep` dos fatos (os números de linha são de `5e581375b`) e a T1 da r3 substitui a T1 da r2.

| Tarefa (r2) | Em uma linha |
|---|---|
| 2 | migration 1: tabela `ab_test_originais`, ponteiros em `ab_tests`, RLS, `ab_garantir_original_publica`, backfill |
| 3 | migration 2: `ab_aplicar_original` e `ab_registrar_original` |
| 4 | migration 3: `create_playoff_test` copia as linhas |
| 5 | leitura `IOriginalDoTeste` e captura da pública pelos chamadores |
| 6 | `removerMetadadosJpeg`, limpeza sem recodificar |
| 7 | `validarArquivoDaOriginal` (traz `proporcaoOk`, `ehQuatroPorTres`, `MAX_BYTES` que a T1 da r3 deixou de fora) |
| 8 | prova do pior caso do mozjpeg; `maxDuration = 60` |
| 9 | `enviarOriginal` (orquestração do envio) |
| 10 | rota `POST`/`DELETE` do envio |
| 11 | guarda do início e passo 2 contra a pública (**o risco dos Shorts**) |
| 12 | a fila sai na hora com `original_baixa` |
| 13 | restauração com reserva quando a enviada some (D11) |
| 14 | rotação e retomada com a enviada ausente |
| 15 | paridade Cowork/MCP (referência e docs do pipeline) |
| 16 | envio no cliente e estado do assistente |
| 17 | telas do assistente A–G (aqui entra o bloqueio do Próximo/Iniciar) |
| 18 | ficha do teste (H) |
| 19 | 5º caso de D, "não é a mesma imagem" (D13), aguarda o dono |
| 21 | medição com o arquivo-mestre real do dono (distância dHash) |

### Fecho da r4 (controlador, 21/10)
Re-revisão: Phil 93, Yannis 93, Logan 90 — todos ≥ 90, nada bloqueia. Aplicados no fecho: Yannis N1 (`vi.hoisted`), N2 (mock do `ab-create-wizard-restore`), N3 (13 arquivos); Phil M1 (`hq720` e só 200 na sonda). Aceitos sem ação: Logan N1/N2, Phil M2 (já em Riscos). Divergência `.limit(2)`: os três dão razão ao redator. Pendente fora do plano: contraste do âmbar nos dois temas (Naksu, na captura da execução).
