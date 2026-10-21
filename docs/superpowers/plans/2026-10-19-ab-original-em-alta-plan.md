# A/B Lab: original em alta resolução (plano de implementação, r3, escopo D12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 21/10/2026. r3 (Opus) sobre a r2 (`b8236eed9`, 22 tarefas), reduzida pela **decisão D12 do dono (21/10 12:35)**, registrada na §5.7 e na linha D12 de `/Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md`. O texto integral da r2 vive em `git show b8236eed9:docs/superpowers/plans/2026-10-19-ab-original-em-alta-plan.md` e continua neste arquivo, resumido, no apêndice "Congeladas (D12)". Esta r3 **não** autoriza executar nem pushar: precisa de revisão de Phil e Yannis e do portão normal.

## Escopo D12

| | O que | Estado |
|---|---|---|
| **FICA** | T0 (linha de base), T1 (regra única 1280: `originalBaixaResolucao`, testes de fronteira 1279/1280, diálogo de encerrar), **T1b nova** (aviso antes de iniciar o teste no assistente quando a original guardada tem largura < 1280), T20 reduzida (prova local) | ativas |
| **CONGELA** | T2 a T18, T19 (5º caso de D) e T21 (medição com o arquivo-mestre) | apêndice |

Sem migration, sem envio de arquivo, sem rota nova de escrita, **sem bloquear o início** (a bola do Short: ver Riscos).

**Gatilho de descongelar T2–T18:** o dono rodar o primeiro teste nosso em vídeo longo com >= 28 dias e **perder a original em alta**, ou um Short/kids ser **recusado de verdade** por original baixa. **Antes de qualquer descongelo**, sondar 2 Shorts reais (Gio ou Phil): a guarda de início da T11 da r2 pode **bloquear Shorts** cuja imagem vertical não tem `maxres` 1280, e Short é o uso principal do nosso teste. O resultado vira subnúmero de 21 no roteiro (`docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`). T19 e T21 só voltam junto com o envio.

**Goal:** o dono não perde a original em alta sem saber: o diálogo de encerrar e o assistente dizem, com a mesma régua de 1280, quando a original guardada é baixa.

**Tech Stack:** Next.js 16 (server action de leitura), TypeScript estrito, Vitest, Testing Library. Nada de SQL, sharp ou Blob.

> **Para quem executa:** `superpowers:subagent-driven-development`, agente `executor` (Sonnet, `medium`). T20: Gio (Sonnet, `medium`). Ledger: `.superpowers/sdd/ab-lab/original-em-alta/progress.md` (criar na T0). Código só em `~/Workspace/bythiago-ab-s7` (branch `lote/ab-p4b-a`).

> **Abreviações:** `W` = `~/Workspace/bythiago-ab-s7`; `AB` = `apps/web/src/app/cms/(authed)/youtube/ab-lab`; `Y` = `apps/web/src/lib/youtube`; `T` = `apps/web/test`.

## Global Constraints

- `LARGURA_ALTA = 1280` é a **única** constante: limiar de "baixa" no diálogo de encerrar e no aviso. Baixa = largura nula, 0, ilegível ou < 1280 (D1).
- O aviso **nunca** desabilita "Salvar rascunho" nem "Ativar teste" nem muda `stepIsValid`.
- O aviso **só lê** o que já está guardado (`ab_test_variants.dimensions` da variante `is_original`); nenhuma chamada ao YouTube, nenhuma escrita.
- Texto do aviso: só frases do mockup aprovado (`docs/superpowers/mockups/2026-10-19-ab-original-em-alta/index.html`, estado B) e de `.superpowers/sdd/ab-lab/original-em-alta/textos-pendentes-logan.md`; **a única adaptação** (trocar "A pública" por "A original guardada" e tirar a frase "Envie a original", que não tem como acontecer sem o envio) vai marcada para Logan conferir.
- Sem `any`; testes de componente com `// @vitest-environment jsdom`; de função pura em `node`. Commit por caminho explícito; proibido `stash`, `reset` e `push`.

## Review Focus

1. **Short ou vídeo sem `maxres`:** o aviso aparece e o teste inicia mesmo assim (Tarefa 1b, teste "não bloqueia").
2. **`dimensions` nula, `0x0` ou ilegível** (2 dos 3 testes de produção têm `blob_url` fora do Blob e `dimensions` nulo): o aviso aparece, sem número, sem quebrar (Tarefa 1b).
3. **A leitura falha ou demora:** nenhum aviso, nenhum bloqueio, nenhum "undefined" na tela.
4. **1279 avisa, 1280 não**, nos dois lugares (diálogo e aviso), pela mesma função.

---

## 1. Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `Y/ab-original-resolucao.ts` (novo) | `LARGURA_ALTA`, `publicaBaixa`, `dimensoesDeTexto`, `textoAvisoOriginalBaixa` (puras) |
| `AB/_components/encerrar-props.ts` | `originalBaixaResolucao` passa a usar a regra única |
| `AB/actions.ts` | `lerDimensoesDaOriginal(testId)` (server action, só leitura) |
| `AB/_components/use-aviso-original.ts` (novo) | hook que chama a action e devolve `string \| null` |
| `AB/_components/step-revisar.tsx` | prop `avisoOriginalBaixa` e a faixa de aviso |
| `AB/_components/ab-create-wizard.tsx` | usa o hook e passa o texto ao `StepRevisar` |

## 2. Fatos conferidos no código (W, `2d85f30c3`, em dia com `origin/staging` de 21/10)

- `originalBaixaResolucao` está em `AB/_components/encerrar-props.ts:22-26` com a regra antiga `<= 480` e o comentário "Ruling do Phil (T15)" em :18-21; é chamada em :58 (`originalBaixaResolucao(original?.dimensions)`) e usada por `AB/_components/ab-end-test-dialog.tsx:119,233,297,301`. Teste atual: `T/youtube/ab-end-test-dialog.test.tsx:304-309` (`1280x720` false, `480x360`/`null`/`undefined`/`'lixo'` true) e :316-323.
- `dimensions` é TEXT `"LxA"`. Nasce em `createAbTest` (`AB/actions.ts:250-289`): `preserveOriginalThumbnail` (:48-51) → `guardarOriginalMaior` (`Y/ab-variant-dhash.ts:79-92`, devolve `meta.width ?? 0`) → `` `${largura}x${altura}` `` (:259); fica **nula** quando `thumbnail_hq_url` não é de `ytimg|ggpht|googleusercontent` (:249-250, `originalDimensions` começa `null`). `"0x0"` é possível se o sharp não medir.
- **O rascunho existe antes do passo Revisar:** `handleTypeSelect` cria o teste ao escolher o tipo (`AB/_components/ab-create-wizard.tsx:~346-371`, `createAbTest` → `SET_DRAFT_ID`), então em `step === 4` há `state.draftTestId` sempre; ao continuar rascunho, `existingDraftId` já o traz (:~262).
- O assistente **não** sabe as dimensões: `WizardState` (:75-87) só tem `originalThumbUrl`; `AbTestDraftVariant` (`Y/ab-types.ts:325-330`) não tem `dimensions`. Por isso a leitura é uma action pelo `draftTestId`.
- `StepRevisar` é montado em `ab-create-wizard.tsx:~555-567` com `type`, `variants`, `config`, `videoTitle`; `Badge` vem de `./ab-primitives`. O passo Revisar tem os botões "Salvar rascunho" (:~674) e "Ativar teste" (:~682), ambos já chamam `handleSubmit` (:391), que termina em `startAbTest(testId)` (:~477).
- Padrão de leitura com escopo: `cleanupDraftVariants` (`AB/actions.ts:518-538`): `requireEditAccess()` + `.eq('site_id', siteId)`.
- Paridade Cowork/MCP: `manage_ab_test` (`apps/web/src/lib/pipeline/mcp/tools.ts:665`, enum de ações) tem `list_tests`, `get_test`, `list_variants`, `upsert_variants`… **nenhuma ação inicia teste**; só o CMS inicia. Logo não há "antes de iniciar" no MCP.

## 3. Comandos comuns

```bash
cd ~/Workspace/bythiago-ab-s7/apps/web
npx vitest run test/youtube/ab-original-resolucao.test.ts test/youtube/ab-end-test-dialog.test.tsx test/youtube/ab-aviso-original-baixa.test.tsx test/youtube/ab-ler-dimensoes-da-original.test.ts > /tmp/oea-tN.log 2>&1; tail -30 /tmp/oea-tN.log
npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log   # esperado: 0
```

Commit: `git -C ~/Workspace/bythiago-ab-s7 add <arquivos> && git -C ~/Workspace/bythiago-ab-s7 commit -m "<tipo>: <descrição>" -- <arquivos>`.

---

## 4. As tarefas ativas

### Tarefa 0: linha de base

**Files:** `.superpowers/sdd/ab-lab/original-em-alta/progress.md` (criar).

- [ ] **Passo 1:** `git -C ~/Workspace/bythiago-ab-s7 status --short` sem modificações rastreadas além de `shots/`; anotar o sha de `HEAD` no ledger.
- [ ] **Passo 2:** `npx vitest run test/youtube > /tmp/oea-t0.log 2>&1; tail -30 /tmp/oea-t0.log` e `npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log`. Esperado: 0 falhas, 0 `error TS`. Anotar as contagens. (Sem `bythiago_int`: esta r3 não tem SQL.)

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

### Tarefa 1b: aviso antes de iniciar o teste quando a original guardada é baixa (nova)

O aviso aparece no passo Revisar do assistente (`step-revisar.tsx`), logo acima do resumo, que é a última tela antes de "Ativar teste". Não toca `step-variantes.tsx` (o envio que moraria lá está congelado). Só para `thumbnail` e `combo`.

**Decisões (ver "Decisões da r3"):** `dimensions` nula, `0x0` ou ilegível **avisa**, sem número; leitura que falha ou que ainda não voltou **não avisa**; o aviso **não bloqueia**.

**Files:**
- Modify: `Y/ab-original-resolucao.ts` (+ `textoAvisoOriginalBaixa`), `AB/actions.ts` (+ `lerDimensoesDaOriginal`, logo após `cleanupDraftVariants`, ~:560), `AB/_components/step-revisar.tsx`, `AB/_components/ab-create-wizard.tsx`
- Create: `AB/_components/use-aviso-original.ts`, `T/youtube/ab-aviso-original-baixa.test.tsx`, `T/youtube/ab-ler-dimensoes-da-original.test.ts`
- Test: acrescentar a `T/youtube/ab-original-resolucao.test.ts`

**Texto (do mockup, estado B; adaptação a conferir por Logan):**
- Com largura medida (o mockup diz "A pública tem só 480×360: o vídeo voltaria borrado a cada troca e ficaria assim depois do teste."): `A original guardada tem só ${L}×${A}: o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.`
- Sem medida (nula, `0x0`, ilegível): `A original guardada é de baixa resolução (mínimo 1280): o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.` ("Baixa resolução" e "mínimo 1280" são palavras do mockup, estados B e G.)
- Selo ao lado: `Baixa resolução` (do mockup e do diálogo de encerrar).

- [ ] **Passo 1: teste da função de texto (falha)**, em `T/youtube/ab-original-resolucao.test.ts`:

```ts
import { textoAvisoOriginalBaixa } from '@/lib/youtube/ab-original-resolucao'

describe('textoAvisoOriginalBaixa', () => {
  it('1280x720 e acima: sem aviso', () => {
    expect(textoAvisoOriginalBaixa('1280x720')).toBeNull()
    expect(textoAvisoOriginalBaixa('1920x1080')).toBeNull()
  })
  it('1279 avisa com o número', () => {
    expect(textoAvisoOriginalBaixa('1279x719')).toBe('A original guardada tem só 1279×719: o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.')
    expect(textoAvisoOriginalBaixa('480x360')).toContain('480×360')
  })
  it('nula, 0x0 e ilegível avisam sem número e sem "undefined"/"null"', () => {
    for (const d of [null, undefined, '', '0x0', 'lixo']) {
      const t = textoAvisoOriginalBaixa(d)
      expect(t).toBe('A original guardada é de baixa resolução (mínimo 1280): o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.')
      expect(t).not.toMatch(/undefined|null|NaN/)
    }
  })
})
```

Implementar em `Y/ab-original-resolucao.ts`:

```ts
const CAUDA_AVISO = 'o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.'

/** Aviso do passo Revisar (D12). null = original em alta, nada a dizer. Nunca bloqueia. */
export function textoAvisoOriginalBaixa(dimensions: string | null | undefined): string | null {
  const dim = dimensoesDeTexto(dimensions)
  if (dim && !publicaBaixa(dim.largura)) return null
  return dim
    ? `A original guardada tem só ${dim.largura}×${dim.altura}: ${CAUDA_AVISO}`
    : `A original guardada é de baixa resolução (mínimo ${LARGURA_ALTA}): ${CAUDA_AVISO}`
}
```

- [ ] **Passo 2: teste da action (falha)**, `T/youtube/ab-ler-dimensoes-da-original.test.ts`, no molde de `T/youtube/pin-actions.test.ts` (mocks de `@/lib/cms/site-context`, `@tn-figueiredo/auth-nextjs/server`, `@/lib/supabase/service`, `next/cache`). Casos: (a) sem permissão (`requireEditAccess` lança) → `{ ok: false }`; (b) teste de outro site (consulta do `ab_tests` com `.eq('site_id', ...)` devolve nulo) → `{ ok: false }`; (c) variante `is_original` com `dimensions: '480x360'` → `{ ok: true, dimensions: '480x360' }`; (d) variante sem `dimensions` → `{ ok: true, dimensions: null }`; (e) a consulta de variantes filtra `is_original = true` (assertar o `.eq('is_original', true)`).
- [ ] **Passo 3:** implementar em `AB/actions.ts`, junto das outras (mesmo padrão de `cleanupDraftVariants`, :518-538):

```ts
/** D12: só leitura das dimensões da original guardada do rascunho; o assistente avisa, nunca bloqueia. */
export async function lerDimensoesDaOriginal(
  testId: string,
): Promise<{ ok: true; dimensions: string | null } | { ok: false }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  const supabase = getSupabaseServiceClient()
  const { data: test } = await supabase
    .from('ab_tests').select('id').eq('id', testId).eq('site_id', siteId).maybeSingle()
  if (!test) return { ok: false }
  const { data: original } = await supabase
    .from('ab_test_variants').select('dimensions').eq('test_id', testId).eq('is_original', true).maybeSingle()
  return { ok: true, dimensions: (original?.dimensions as string | null | undefined) ?? null }
}
```

(o ajuste dos mocks encadeados `eq().eq().maybeSingle()` vs `single()` segue o que o teste montar; manter `maybeSingle` na implementação.)
- [ ] **Passo 4: teste do componente e do hook (falha)**, `T/youtube/ab-aviso-original-baixa.test.tsx`, `// @vitest-environment jsdom`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import { StepRevisar } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import { useAvisoOriginal } from '@/app/cms/(authed)/youtube/ab-lab/_components/use-aviso-original'
import { initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

const ler = vi.fn()
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({ lerDimensoesDaOriginal: (id: string) => ler(id) }))

const base = {
  type: 'thumbnail' as const,
  variants: [{ label: 'A' as const, thumbUrl: null, title: 't', isOriginal: true }],
  config: initWizardConfig(AB_SITE_SETTINGS_DEFAULTS),
  videoTitle: 'v',
}

describe('aviso de original baixa no passo Revisar', () => {
  beforeEach(() => ler.mockReset())

  it('mostra o aviso e o selo, sem bloquear nada', () => {
    render(<StepRevisar {...base} avisoOriginalBaixa="A original guardada tem só 480×360: x" />)
    expect(screen.getByRole('status').textContent).toContain('480×360')
    expect(screen.getByText('Baixa resolução')).toBeTruthy()
  })
  it('sem aviso (null ou ausente): nada na tela', () => {
    render(<StepRevisar {...base} avisoOriginalBaixa={null} />)
    expect(screen.queryByText('Baixa resolução')).toBeNull()
    render(<StepRevisar {...base} />)
    expect(screen.queryByText('Baixa resolução')).toBeNull()
  })
  it('hook: 480x360 → texto; 1280x720 → null', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360' })
    const a = renderHook(() => useAvisoOriginal('t1', 'thumbnail', true))
    await waitFor(() => expect(a.result.current).toContain('480×360'))
    ler.mockResolvedValueOnce({ ok: true, dimensions: '1280x720' })
    const b = renderHook(() => useAvisoOriginal('t2', 'combo', true))
    await waitFor(() => expect(ler).toHaveBeenCalledTimes(2))
    expect(b.result.current).toBeNull()
  })
  it('hook: dimensions nula avisa sem número', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null })
    const h = renderHook(() => useAvisoOriginal('t3', 'thumbnail', true))
    await waitFor(() => expect(h.result.current).toContain('mínimo 1280'))
  })
  it('hook: leitura que falha ou lança não avisa e não quebra', async () => {
    ler.mockResolvedValueOnce({ ok: false })
    const a = renderHook(() => useAvisoOriginal('t4', 'thumbnail', true))
    await waitFor(() => expect(ler).toHaveBeenCalled())
    expect(a.result.current).toBeNull()
    ler.mockRejectedValueOnce(new Error('rede'))
    const b = renderHook(() => useAvisoOriginal('t5', 'thumbnail', true))
    await waitFor(() => expect(ler).toHaveBeenCalledTimes(2))
    expect(b.result.current).toBeNull()
  })
  it('hook: tipo title, passo inativo ou sem rascunho não lê', () => {
    renderHook(() => useAvisoOriginal('t6', 'title', true))
    renderHook(() => useAvisoOriginal('t7', 'thumbnail', false))
    renderHook(() => useAvisoOriginal(null, 'thumbnail', true))
    expect(ler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Passo 5:** `npx vitest run` dos três arquivos → FAIL. Implementar:

`AB/_components/use-aviso-original.ts`:

```ts
'use client'
import { useEffect, useState } from 'react'
import { lerDimensoesDaOriginal } from '../actions'
import { textoAvisoOriginalBaixa } from '@/lib/youtube/ab-original-resolucao'
import type { TestType } from '@/lib/youtube/ab-types'

/** D12: texto do aviso (ou null). Falha na leitura = sem aviso; nunca bloqueia. */
export function useAvisoOriginal(testId: string | null, type: TestType | null, ativo: boolean): string | null {
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!ativo || !testId || (type !== 'thumbnail' && type !== 'combo')) { setAviso(null); return }
    let vivo = true
    lerDimensoesDaOriginal(testId)
      .then(r => { if (vivo) setAviso(r.ok ? textoAvisoOriginalBaixa(r.dimensions) : null) })
      .catch(() => { if (vivo) setAviso(null) })
    return () => { vivo = false }
  }, [testId, type, ativo])
  return aviso
}
```

`step-revisar.tsx`: em `StepRevisarProps` (:21-26) acrescentar `avisoOriginalBaixa?: string | null`; desestruturar na função e, no topo do `<div className="space-y-5">` (:~135), antes do banner de sucesso:

```tsx
{avisoOriginalBaixa ? (
  <div role="status" className="flex items-start gap-2 rounded-lg border border-cms-border bg-cms-surface px-3 py-2 text-[12.5px] text-cms-text">
    <Badge tone="amber">Baixa resolução</Badge>
    <span>{avisoOriginalBaixa}</span>
  </div>
) : null}
```

(`tone="amber"` existe em `./ab-primitives.tsx:32-39`; sem cor nova nem `color-mix()`.)

`ab-create-wizard.tsx`: importar `useAvisoOriginal` e `lerDimensoesDaOriginal` **não** (só o hook); depois de `useState` do `libraryPickerFor` (:~309) acrescentar `const avisoOriginalBaixa = useAvisoOriginal(state.draftTestId, state.type, state.step === 4)`; no `<StepRevisar ... />` (:~555-567) passar `avisoOriginalBaixa={avisoOriginalBaixa}`. **Não** alterar `stepIsValid` (:240-249), `goNext`, `handleSubmit` (:391) nem os botões (:~674-682).
- [ ] **Passo 6:** os três arquivos de teste → PASS; seção 3 inteira (tsc 0). Conferir no diff que `stepIsValid` e `handleSubmit` não mudaram: `git diff -U0 -- '<AB>/_components/ab-create-wizard.tsx' | grep -E "stepIsValid|handleSubmit|startAbTest"` → vazio.
- [ ] **Passo 7:** commit `feat: aviso de original baixa antes de iniciar o teste (D12)`, caminhos explícitos dos 8 arquivos.

**Paridade Cowork/MCP (registro, sem tarefa):** fora. `manage_ab_test` não tem ação de iniciar (`tools.ts:665`), então não há "antes de iniciar" no MCP; o Cowork só edita variantes de rascunho. Não mexer em `apps/web/src/lib/pipeline/` nem em `cowork-docs-youtube.md` (sem rota nem campo novo). Se um dia o MCP ganhar `start`, o aviso entra na resposta junto do descongelo (T15 do apêndice).

**Fora desta tarefa (registro):** o início pela lista (`batchStartTests`, `AB/actions.ts:~1373`) e pelo detalhe do teste não mostram o aviso; o diálogo de encerrar já mostra o selo no fim. Entram junto de T17/T18 se descongelarem.

### Tarefa 20: prova local (reduzida)

**Files:** capturas em `.superpowers/sdd/ab-lab/original-em-alta/prova-shots/` (Gio).

- [ ] **Passo 1:** `cd W/apps/web && npx vitest run test/youtube > /tmp/oea-suite.log 2>&1; tail -30 /tmp/oea-suite.log` e `npx tsc --noEmit -p . > /tmp/oea-tsc.log 2>&1; grep -c "error TS" /tmp/oea-tsc.log`. Esperado: 0 falhas, 0 `error TS`; só falhas no contexto. Em background se passar de 4 min. **Sem** `next build` obrigatório (o Vercel faz; CLAUDE.md) e sem integração (não há SQL).
- [ ] **Passo 2 (Gio, navegador, Sonnet):** CMS local autenticado (`docs/ops/runbook-cms-e2e-local.md`), vídeo de semente cujo rascunho tem a original `480x360`, outro `1280x720`, outro com `dimensions` nula: abrir o assistente até Revisar a 1440 e 390, claro e escuro. Esperado: aviso e selo nos dois baixos; nenhum aviso no 1280; "Salvar rascunho" e "Ativar teste" habilitados em todos; `scrollWidth` = largura a 390; nenhum "undefined"/"null" no DOM. Abrir o diálogo "O que fica no vídeo?" de um teste com original `640x480`: selo "Baixa resolução". Veredito em texto no ledger.
- [ ] **Passo 3:** sonda dos Shorts (registrar, não bloqueia esta r3): 2 Shorts reais, anotar a maior largura que `maxresdefault`/`sddefault` devolve (`curl -sI` não serve: usar o `biggerCopy` por script de leitura ou o navegador do Gio) e o que o aviso mostra. É o dado do gatilho de descongelar.

---

## 5. Portão e envio

**Portão (antes de qualquer push):** Phil e Yannis (Opus, `medium`) revisam esta r3; Gio faz a T20. Conserta-se até haver acordo (sem BLOQUEIA/CORRIGE aberto). Logan confere a adaptação do texto do aviso (Global Constraints).

**Envio:** junto do próximo push com código do lote `lote/ab-p4b-a`; **sem migration**, logo sem `db:push:prod` e sem fila de DB; nenhum push só deste plano; ≤ 3 pushes de staging/dia (crédito da Vercel). CI verde depois do push.

## 6. Riscos

- **Short sem `maxres` 1280** (o risco que congelou a T11): o aviso aparece e o teste inicia; é por isso que o aviso não bloqueia. A sonda da T20 passo 3 mede quantos Shorts caem aqui.
- **Aviso permanente para quem não tem como corrigir:** sem o envio, o dono lê o aviso e só pode ignorá-lo ou trocar a thumbnail no YouTube e recriar o rascunho. Aceito pela D12 (informar, não bloquear); o envio volta no descongelo.
- **`dimensions` mente para a `hqdefault`:** `guardarOriginalMaior` cai para a `hqdefault` 480×360 quando `maxres` e `sddefault` não existem; o aviso mede o que foi guardado, não o que o YouTube tem de melhor. Correto para o objetivo (a original que volta é a guardada).
- **Rascunho antigo sem `ab_test_variants` original** (legado): `maybeSingle` devolve nulo → `dimensions: null` → aviso sem número. Não quebra.
- **Reducer duplicado** (`ab-create-wizard.tsx` inline e `Y/ab-wizard-reducer.ts`): o aviso não toca nenhum dos dois.

---

## 7. Decisões da r3

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
