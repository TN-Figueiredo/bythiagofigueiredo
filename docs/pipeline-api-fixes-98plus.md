# Content Pipeline API — Fixes para 98+/100

> Instrução completa para Claude Code. Executar todos os blocos na ordem.
> Após cada bloco, rodar `npm run test:web` para garantir que nada quebrou.

---

## BLOCO 1 — Segurança: tsquery injection no Search

**Arquivo:** `apps/web/src/app/api/pipeline/search/route.ts`

**Problema:** Linha 30 usa `textSearch('search_vector', q, { type: 'plain' })` com o `q` bruto do query param. Embora `type: 'plain'` converta para `plainto_tsquery` (que é mais seguro que `to_tsquery`), caracteres como `\` e aspas não-balanceadas podem causar erros no PostgreSQL. Além disso, o `q` não tem limite de tamanho.

**Fix:**
1. Adicionar sanitização do `q` antes de passar ao `textSearch`:
```typescript
// Após a linha: if (!q || q.trim().length < 2) ...
const trimmedQ = q.trim().slice(0, 200)
```
2. Criar função `sanitizeForTsquery`:
```typescript
function sanitizeForTsquery(input: string): string {
  // Remove caracteres que podem causar erro no plainto_tsquery
  return input.replace(/[\\:*!<>()&|'"]/g, ' ').replace(/\s+/g, ' ').trim()
}
```
3. Usar na chamada textSearch:
```typescript
.textSearch('search_vector', sanitizeForTsquery(trimmedQ), { type: 'plain' })
```
4. Usar `trimmedQ` (com slice) também para as queries ILIKE:
```typescript
const safeQ = sanitizeForFilter(sanitizeForLike(trimmedQ))
```

**Resultado esperado:** Queries como `hello\` ou `"abc` não causam 500.

---

## BLOCO 2 — Validação de stage contra workflows

**Problema:** Tanto POST (criação) quanto PATCH (update) aceitam qualquer string como `stage`. É possível criar um `blog_post` com stage `gravacao` (que é exclusivo de video) ou inventar stages que não existem em nenhum workflow.

### 2A — Schema: adicionar validação de stage

**Arquivo:** `apps/web/src/lib/pipeline/schemas.ts`

O `stage` em `PipelineItemCreateSchema` e `PipelineItemUpdateSchema` é `z.string().optional()`. Não dá para validar no schema sozinho porque depende do `format`. A validação precisa ser no handler.

### 2B — Helper: criar `isValidStage`

**Arquivo:** `apps/web/src/lib/pipeline/workflows.ts`

Adicionar ao final do arquivo:
```typescript
export function isValidStage(format: Format, stage: string): boolean {
  return WORKFLOWS[format].some((s) => s.stage === stage)
}
```

### 2C — POST: validar stage na criação

**Arquivo:** `apps/web/src/app/api/pipeline/items/route.ts`

Dentro do `parsed.map(...)` (após `const format = data.format as Format`), antes de montar o objeto de insert, adicionar:
```typescript
const stage = data.stage || 'idea'
if (!isValidStage(format, stage)) {
  // Esse erro precisa ser jogado antes do insert
}
```

**Abordagem:** Como o map já roda dentro de um bloco onde `parsed` é válido, a melhor abordagem é fazer a validação antes do map, em um loop separado:

```typescript
// Após o bloco de firstError (linha ~93), antes de const supabase:
import { isValidStage } from '@/lib/pipeline/workflows'

for (const p of parsed) {
  if (!p.success) continue
  const stage = p.data.stage || 'idea'
  if (!isValidStage(p.data.format as Format, stage)) {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', message: `Stage "${stage}" is not valid for format "${p.data.format}". Valid stages: ${WORKFLOWS[p.data.format as Format].map(s => s.stage).join(', ')}` }
    }, { status: 400 })
  }
}
```

Importar `WORKFLOWS` e `isValidStage` de `@/lib/pipeline/workflows`.

### 2D — PATCH: validar stage no update

**Arquivo:** `apps/web/src/app/api/pipeline/items/[id]/route.ts`

No handler PATCH, após buscar o item atual (após `if (!current)` check na linha ~78), e antes de montar `updateData`, adicionar:

```typescript
if (parsed.data.stage) {
  // Precisamos do format do item pra validar
  const { data: itemForFormat } = await supabase
    .from('content_pipeline')
    .select('format')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (itemForFormat && !isValidStage(itemForFormat.format as Format, parsed.data.stage)) {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', message: `Stage "${parsed.data.stage}" is not valid for format "${itemForFormat.format}". Valid stages: ${WORKFLOWS[itemForFormat.format as Format].map(s => s.stage).join(', ')}` }
    }, { status: 400 })
  }
}
```

**Otimização:** O select de `version` na linha 71 pode ser expandido pra `select('version, format')` para evitar uma segunda query. Nesse caso, usar `current.format` diretamente.

Importar `isValidStage`, `WORKFLOWS` de `@/lib/pipeline/workflows` e `Format` de `@/lib/pipeline/schemas`.

---

## BLOCO 3 — Graduate: proteger campaign slug nulo

**Arquivo:** `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`

**Problema:** Linha 102 faz `slug: item.code` — se `item.code` for null/undefined (teoricamente impossível pois generateCode roda na criação, mas defensivamente errado), o insert na tabela `campaigns` pode falhar ou inserir null.

**Fix:** Linha 102, trocar:
```typescript
slug: item.code,
```
por:
```typescript
slug: item.code || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200),
```

Isso alinha com o tratamento já feito para blog_post na linha 71.

---

## BLOCO 4 — Cursor regex: remover espaço do whitelist

**Arquivo:** `apps/web/src/app/api/pipeline/items/route.ts`

**Problema:** Linha 48, a regex de validação do cursor é:
```
/^[a-zA-Z0-9\-_:.T+Z ]+$/
```
O espaço no final da character class é suspeito. Timestamps ISO não contêm espaços (usam `T`). Permitir espaço abre superfície pra edge cases no `.or()` filter do Supabase.

**Fix:** Remover o espaço:
```
/^[a-zA-Z0-9\-_:.T+Z]+$/
```

**Nota:** Se existirem cursors legítimos com espaço (ex: sort por título com espaço), o encoding em base64url já deveria resolver isso antes do decode. O `decoded.sort_value` deveria ser o valor cru após decode, e valores com espaço no sort são perigosos na composição `.or()`.

---

## BLOCO 5 — Payload size limit em body_content

**Arquivo:** `apps/web/src/lib/pipeline/schemas.ts`

**Problema:** `body_content` é `z.string().optional()` sem limite. Um roteiro de 14 min tem ~3000 palavras (~20KB), mas nada impede enviar 50MB de texto.

**Fix:** Adicionar `.max()` ao body_content nos dois schemas:

1. `PipelineItemCreateSchema` (linha 70):
```typescript
body_content: z.string().max(500_000).optional(),  // ~500KB, muito generoso
```

2. `PipelineItemUpdateSchema` (linha 92):
```typescript
body_content: z.string().max(500_000).optional(),
```

Também limitar `hook` e `synopsis` que já têm limits (300 e 2000), então OK.

Limitar `content_md` no `ReferenceContentUpsertSchema` (linha 121):
```typescript
content_md: z.string().max(200_000).optional(),  // ~200KB
```

---

## BLOCO 6 — Bulk: rejeitar batch inteiro se qualquer validação falha

**Arquivo:** `apps/web/src/app/api/pipeline/items/bulk/route.ts`

**Status:** Já implementado corretamente (linhas 64-69). O Phase 1 coleta erros e se `errors.length > 0`, rejeita tudo com 400 antes de executar Phase 2. Isso é melhor que transação parcial.

**Nenhuma mudança necessária neste bloco.** A arquitetura validate-all-then-execute já garante atomicidade lógica. Transação DB real seria ideal mas a abordagem atual é aceitável — o risco restante é uma falha de rede entre writes do Phase 2, que é um edge case raro e o bulk retorna quais falharam.

---

## BLOCO 7 — Testes unitários para as novas validações

**Arquivo:** Criar `apps/web/test/unit/pipeline-workflows.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { isValidStage, getNextStage, getPreviousStage, WORKFLOWS } from '@/lib/pipeline/workflows'

describe('isValidStage', () => {
  it('returns true for valid video stages', () => {
    expect(isValidStage('video', 'idea')).toBe(true)
    expect(isValidStage('video', 'gravacao')).toBe(true)
    expect(isValidStage('video', 'published')).toBe(true)
  })

  it('returns false for cross-format stages', () => {
    expect(isValidStage('blog_post', 'gravacao')).toBe(false)
    expect(isValidStage('newsletter', 'edicao')).toBe(false)
    expect(isValidStage('video', 'approved')).toBe(false)
  })

  it('returns false for invented stages', () => {
    expect(isValidStage('video', 'banana')).toBe(false)
    expect(isValidStage('blog_post', 'final_review')).toBe(false)
  })
})
```

**Arquivo:** Criar `apps/web/test/unit/pipeline-search-sanitize.test.ts`

Testar a função `sanitizeForTsquery` (exportá-la do search route ou extrair para `lib/pipeline/sanitize.ts`):

```typescript
import { describe, it, expect } from 'vitest'
import { sanitizeForTsquery } from '@/lib/pipeline/sanitize'

describe('sanitizeForTsquery', () => {
  it('removes backslash', () => {
    expect(sanitizeForTsquery('hello\\')).toBe('hello')
  })
  it('removes unbalanced quotes', () => {
    expect(sanitizeForTsquery('"hello')).toBe('hello')
  })
  it('removes tsquery operators', () => {
    expect(sanitizeForTsquery('hello & world | test')).toBe('hello world test')
  })
  it('preserves normal text', () => {
    expect(sanitizeForTsquery('como gravar vídeo')).toBe('como gravar vídeo')
  })
  it('collapses whitespace', () => {
    expect(sanitizeForTsquery('hello   world')).toBe('hello world')
  })
})
```

**Recomendação:** Extrair `sanitizeForTsquery`, `sanitizeForLike`, e `sanitizeForFilter` para um arquivo separado `apps/web/src/lib/pipeline/sanitize.ts` para facilitar teste unitário sem precisar mockar Next.js.

---

## BLOCO 8 — Extrair sanitizers para arquivo testável

**Criar arquivo:** `apps/web/src/lib/pipeline/sanitize.ts`

```typescript
/**
 * Sanitize input for PostgreSQL LIKE queries.
 * Escapes \, %, and _ which are special in LIKE patterns.
 */
export function sanitizeForLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Sanitize input for Supabase .or()/.ilike() filter composition.
 * Removes chars that could break filter syntax.
 */
export function sanitizeForFilter(input: string): string {
  return input.replace(/[.,()]/g, '')
}

/**
 * Sanitize input for PostgreSQL plainto_tsquery.
 * Removes tsquery operators and special chars that could cause parse errors.
 */
export function sanitizeForTsquery(input: string): string {
  return input.replace(/[\\:*!<>()&|'"]/g, ' ').replace(/\s+/g, ' ').trim()
}
```

**Atualizar:** `apps/web/src/app/api/pipeline/search/route.ts` — trocar as funções locais por imports:
```typescript
import { sanitizeForLike, sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
```

E remover as 2 funções inline (`sanitizeForLike` e `sanitizeForFilter`).

---

## BLOCO 9 — format_metadata: validar contra schema do format

**Arquivo:** `apps/web/src/app/api/pipeline/items/route.ts` (POST)

**Problema:** `format_metadata` aceita `z.record(z.unknown())` — qualquer JSON. Mas existem schemas específicos por format (`VideoMetadataSchema`, `BlogPostMetadataSchema`, etc.) em `schemas.ts` que não são usados na validação do POST/PATCH.

**Fix no POST (items/route.ts):** Após o loop de validação de stage (BLOCO 2C), adicionar validação de metadata:

```typescript
import { FORMAT_METADATA_SCHEMAS } from '@/lib/pipeline/schemas'

for (const p of parsed) {
  if (!p.success) continue
  if (p.data.format_metadata && Object.keys(p.data.format_metadata).length > 0) {
    const metaSchema = FORMAT_METADATA_SCHEMAS[p.data.format as Format]
    const metaResult = metaSchema.safeParse(p.data.format_metadata)
    if (!metaResult.success) {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: `Invalid format_metadata for ${p.data.format}: ${metaResult.error.issues.map(i => i.message).join(', ')}` }
      }, { status: 400 })
    }
  }
}
```

**Fix no PATCH (items/[id]/route.ts):** Similar, mas precisa do format do item (já vai estar disponível após otimização do BLOCO 2D):

```typescript
if (parsed.data.format_metadata && Object.keys(parsed.data.format_metadata).length > 0) {
  const metaSchema = FORMAT_METADATA_SCHEMAS[current.format as Format]
  const metaResult = metaSchema.safeParse(parsed.data.format_metadata)
  if (!metaResult.success) {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', message: `Invalid format_metadata: ${metaResult.error.issues.map(i => i.message).join(', ')}` }
    }, { status: 400 })
  }
}
```

---

## Checklist final

Após todas as mudanças:

- [ ] `npm run test:web` passa
- [ ] Criar item video com stage `draft` → retorna 400 (stage inválido pra video)
- [ ] Criar item blog_post com stage `gravacao` → retorna 400
- [ ] Criar item video com stage `idea` → retorna 201 ✓
- [ ] PATCH item video para stage `banana` → retorna 400
- [ ] Search com query `hello\` → retorna resultados (não 500)
- [ ] Search com query `"abc` → retorna resultados (não 500)
- [ ] Criar item com body_content de 600KB → retorna 400 (excede max)
- [ ] Graduate campaign sem code → gera slug do título (não falha)
- [ ] Cursor com espaço no sort_value → ignorado (cursor inválido)
- [ ] format_metadata `{ playlist_letter: "A", invalid_field: 1 }` pra video → 400 (strict schema)

---

## Resumo de impacto

| Bloco | Tipo | Risco | Arquivos tocados |
|-------|------|-------|-----------------|
| 1 | Segurança | Alto | search/route.ts, lib/pipeline/sanitize.ts (novo) |
| 2 | Validação | Alto | workflows.ts, items/route.ts, items/[id]/route.ts |
| 3 | Robustez | Médio | graduate/route.ts |
| 4 | Segurança | Médio | items/route.ts |
| 5 | Robustez | Médio | schemas.ts |
| 6 | — | — | Nenhum (já OK) |
| 7 | Qualidade | — | test/unit/ (novos) |
| 8 | Manutenção | Baixo | sanitize.ts (novo), search/route.ts |
| 9 | Validação | Alto | items/route.ts, items/[id]/route.ts |

Total: ~8 arquivos modificados, 2 novos, 0 migrations necessárias.
