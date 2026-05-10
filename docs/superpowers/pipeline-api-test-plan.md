# Content Pipeline API — Plano de Testes Completo

> **Para:** Claude Cowork / agente autônomo  
> **Objetivo:** Testar TODAS as APIs do Content Pipeline end-to-end, validando CRUD completo, transições de stage, collections, referências, busca, e bulk operations.  
> **Resultado esperado:** Relatório de aprovação/falha por endpoint, identificando bugs para correção antes da migração dos .md para o sistema.

---

## 0. Setup — Provisionar API Key

Antes de qualquer teste, criar uma API key no banco para autenticação. Rodar este script na raiz do projeto:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo

npx tsx --env-file apps/web/.env.local -e "
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rawKey = 'pk_test_' + crypto.randomBytes(24).toString('hex');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

(async () => {
  const targetDomain = process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME || 'bythiagofigueiredo.com';
  const { data: site } = await s.from('sites').select('id').contains('domains', [targetDomain]).single();
  if (!site) throw new Error('Site not found');

  const { error } = await s.from('pipeline_api_keys').insert({
    site_id: site.id,
    name: 'cowork-test-key',
    key_hash: keyHash,
    permissions: ['read', 'write', 'admin'],
  });
  if (error) throw error;

  console.log('=== API KEY CRIADA ===');
  console.log('Raw key (usar no header X-Pipeline-Key):');
  console.log(rawKey);
  console.log('');
  console.log('Hash (salvo no banco):');
  console.log(keyHash);
})();
"
```

Salvar o `rawKey` retornado — ele será usado como `X-Pipeline-Key` em todos os requests.

**Base URL:** `http://localhost:3001` (ou a URL onde o dev server está rodando)

**Header padrão em todos os requests:**
```
X-Pipeline-Key: <rawKey>
```

---

## 1. Manifesto e Discovery

### 1.1 GET /api/pipeline
```bash
curl -s http://localhost:3001/api/pipeline \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** JSON com lista de endpoints disponíveis e versão da API.

### 1.2 GET /api/pipeline/workflows
```bash
curl -s http://localhost:3001/api/pipeline/workflows \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Definição dos 5 workflows (video, blog_post, newsletter, course, campaign) com stages e checklists default.

**Validar:**
- Video tem 7 stages: idea → roteiro → gravacao → edicao → pos_producao → scheduled → published
- Blog tem 5 stages: idea → draft → ready → scheduled → published
- Cada formato tem um default checklist

---

## 2. Items — CRUD Completo

### 2.1 POST /api/pipeline/items — Criar item
```bash
curl -s -X POST http://localhost:3001/api/pipeline/items \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title_pt": "Teste API — Criar Item Video",
    "title_en": "API Test — Create Video Item",
    "format": "video",
    "language": "both",
    "priority": 3,
    "tags": ["test", "api-validation"],
    "hook": "Hook de teste para validação",
    "synopsis": "Synopsis de teste"
  }' | jq .
```
**Esperado:** 201 Created com o item completo incluindo `id`, `code` (auto-gerado), `version: 1`, `stage: "idea"`, `is_archived: false`.  
**Salvar:** o `id` retornado como `$ITEM_ID` para testes seguintes.

### 2.2 POST — Criar item blog_post
```bash
curl -s -X POST http://localhost:3001/api/pipeline/items \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title_pt": "Teste API — Artigo Blog",
    "format": "blog_post",
    "language": "pt-br",
    "priority": 2,
    "tags": ["test", "blog-validation"],
    "format_metadata": {
      "word_count_target": 1500,
      "seo_keyword": "teste-api"
    }
  }' | jq .
```
**Esperado:** 201 com `format: "blog_post"`, `stage: "idea"`, `format_metadata` preservado.  
**Salvar:** `$BLOG_ITEM_ID`

### 2.3 POST — Validação: sem título deve falhar
```bash
curl -s -X POST http://localhost:3001/api/pipeline/items \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"format": "video"}' | jq .
```
**Esperado:** 400 com mensagem "At least one title (title_pt or title_en) is required"

### 2.4 POST — Validação: formato inválido deve falhar
```bash
curl -s -X POST http://localhost:3001/api/pipeline/items \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"title_pt": "Teste", "format": "podcast"}' | jq .
```
**Esperado:** 400 com erro de validação do formato

### 2.5 GET /api/pipeline/items — Listar items
```bash
curl -s "http://localhost:3001/api/pipeline/items?limit=5" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** JSON com `data` (array de items), `pagination` com cursor info. Items incluem `id`, `code`, `title_pt`, `format`, `stage`, etc.

### 2.6 GET /api/pipeline/items — Filtrar por formato
```bash
curl -s "http://localhost:3001/api/pipeline/items?format=blog_post&limit=5" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | length'
```
**Esperado:** Retorna apenas items com `format: "blog_post"`

### 2.7 GET /api/pipeline/items — Filtrar por stage
```bash
curl -s "http://localhost:3001/api/pipeline/items?stage=idea&limit=5" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | length'
```

### 2.8 GET /api/pipeline/items — Filtrar por tag
```bash
curl -s "http://localhost:3001/api/pipeline/items?tag=test&limit=5" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Retorna os items criados com tag "test"

### 2.9 GET /api/pipeline/items/:id — Detalhe
```bash
curl -s "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Item completo com todos os campos, incluindo `production_checklist`, `format_metadata`, `validation_score`, memberships.

### 2.10 PATCH /api/pipeline/items/:id — Atualizar
```bash
VERSION=$(curl -s "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" | jq -r '.version')

curl -s -X PATCH "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "If-Match: $VERSION" \
  -d '{
    "title_pt": "Teste API — Item Atualizado",
    "priority": 5,
    "tags": ["test", "updated", "api-validation"],
    "hook": "Hook atualizado via API"
  }' | jq .
```
**Esperado:** 200 com item atualizado, `version` incrementado.

### 2.11 PATCH — Conflito de versão (optimistic lock)
```bash
curl -s -X PATCH "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "If-Match: 1" \
  -d '{"title_pt": "Conflito"}' | jq .
```
**Esperado:** 409 Conflict (version mismatch)

### 2.12 PATCH — Mudar formato deve falhar (trigger immutável)
```bash
VERSION=$(curl -s "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" | jq -r '.version')

curl -s -X PATCH "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "If-Match: $VERSION" \
  -d '{"format": "blog_post"}' | jq .
```
**Esperado:** Erro (trigger `trg_pipeline_immutable_format` bloqueia)

---

## 3. Stage Transitions

### 3.1 POST /api/pipeline/items/:id/advance — Avançar stage
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/advance" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Item avança de `idea` → `roteiro`. Retorna item com `stage: "roteiro"`.

### 3.2 Avançar novamente
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/advance" \
  -H "X-Pipeline-Key: $KEY" | jq .stage
```
**Esperado:** `roteiro` → `gravacao`

### 3.3 POST /api/pipeline/items/:id/retreat — Retroceder stage
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/retreat" \
  -H "X-Pipeline-Key: $KEY" | jq .stage
```
**Esperado:** `gravacao` → `roteiro`

### 3.4 Retroceder no primeiro stage deve falhar
```bash
# Primeiro retroceder até idea
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/retreat" \
  -H "X-Pipeline-Key: $KEY" > /dev/null

curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/retreat" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Erro — já está no primeiro stage

---

## 4. Checklist

### 4.1 POST /api/pipeline/items/:id/checklist — Toggle item
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/checklist" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"index": 0, "done": true}' | jq '.production_checklist[0]'
```
**Esperado:** Primeiro item do checklist marcado como `done: true` com `toggled_at` preenchido.

### 4.2 Toggle de volta
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/checklist" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"index": 0, "done": false}' | jq '.production_checklist[0]'
```
**Esperado:** `done: false`

### 4.3 Index inválido
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/checklist" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"index": 99, "done": true}' | jq .
```
**Esperado:** Erro — index fora do range

---

## 5. Archive / Restore

### 5.1 DELETE /api/pipeline/items/:id — Arquivar
```bash
curl -s -X DELETE "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Item com `is_archived: true`. NÃO é hard delete — é soft archive.

### 5.2 GET após archive — item não aparece na listagem
```bash
curl -s "http://localhost:3001/api/pipeline/items?tag=test" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | map(.id)' 
```
**Esperado:** `$ITEM_ID` NÃO aparece na lista (filtro default exclui archived)

### 5.3 GET com include_archived
```bash
curl -s "http://localhost:3001/api/pipeline/items?tag=test&include_archived=true" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | length'
```
**Esperado:** Item aparece na lista com `is_archived: true`

### 5.4 POST /api/pipeline/items/:id/restore — Restaurar
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/$ITEM_ID/restore" \
  -H "X-Pipeline-Key: $KEY" | jq .is_archived
```
**Esperado:** `false`

---

## 6. Collections

### 6.1 GET /api/pipeline/collections — Listar
```bash
curl -s "http://localhost:3001/api/pipeline/collections" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | map({code, name, member_count: (.members | length)})'
```
**Esperado:** 6 collections (playlist-a, playlist-b, playlist-c, playlist-e, playlist-f, playlist-g)

### 6.2 POST /api/pipeline/collections — Criar
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/collections" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "test-collection",
    "name": "Test Collection",
    "type": "category",
    "position": 999
  }' | jq .
```
**Esperado:** 201 com a collection criada.  
**Salvar:** `$COLLECTION_ID`

### 6.3 GET /api/pipeline/collections/:id — Detalhe
```bash
curl -s "http://localhost:3001/api/pipeline/collections/$COLLECTION_ID" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Collection com dados completos + members array (vazio por enquanto)

### 6.4 Adicionar item à collection
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/collections/$COLLECTION_ID" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"add\": [{\"pipeline_id\": \"$ITEM_ID\", \"position\": 1, \"role\": \"test\"}]
  }" | jq .
```
**Esperado:** Item adicionado à collection. Ou usar o endpoint de membership se diferente — verificar a implementação.

**Alternativa via server action (se API não suportar add diretamente):**
O endpoint PUT /api/pipeline/collections/:id pode aceitar membership changes. Testar ambos.

### 6.5 PUT /api/pipeline/collections/:id — Atualizar
```bash
curl -s -X PUT "http://localhost:3001/api/pipeline/collections/$COLLECTION_ID" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Collection Updated",
    "position": 998
  }' | jq .
```
**Esperado:** 200 com collection atualizada

### 6.6 DELETE /api/pipeline/collections/:id — Deletar
```bash
curl -s -X DELETE "http://localhost:3001/api/pipeline/collections/$COLLECTION_ID" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** 200/204 — collection removida

### 6.7 Verificar que collections default NÃO foram afetadas
```bash
curl -s "http://localhost:3001/api/pipeline/collections" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | length'
```
**Esperado:** 6 (as playlists originais intactas)

---

## 7. Reference Content (Context)

### 7.1 GET /api/pipeline/context — Listar referências
```bash
curl -s "http://localhost:3001/api/pipeline/context" \
  -H "X-Pipeline-Key: $KEY" | jq '.data | map({key, title})'
```
**Esperado:** 8 referências (personal-profile, channel-profiles, about-page, playlist-pathways-v2, text-pathways, banco-tags, banco-frases-ancora, script-idea-bank)

### 7.2 GET /api/pipeline/context/:key — Detalhe
```bash
curl -s "http://localhost:3001/api/pipeline/context/personal-profile" \
  -H "X-Pipeline-Key: $KEY" | jq '{key: .key, title: .title, content_length: (.content_md | length)}'
```
**Esperado:** Documento com `content_md` preenchido (tamanho > 0)

### 7.3 PUT /api/pipeline/context/:key — Criar/atualizar referência
```bash
curl -s -X PUT "http://localhost:3001/api/pipeline/context/test-reference" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Reference Document",
    "content_md": "# Test\n\nEste é um documento de referência de teste.\n\n## Seção 1\n\nConteúdo...",
    "content_compact": {"source": "api-test", "version": 1}
  }' | jq .
```
**Esperado:** 200 com documento criado/atualizado

### 7.4 GET — Verificar criação
```bash
curl -s "http://localhost:3001/api/pipeline/context/test-reference" \
  -H "X-Pipeline-Key: $KEY" | jq .title
```
**Esperado:** "Test Reference Document"

### 7.5 PUT — Atualizar existente (upsert)
```bash
curl -s -X PUT "http://localhost:3001/api/pipeline/context/test-reference" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Reference — Updated",
    "content_md": "# Updated\n\nConteúdo atualizado."
  }' | jq .title
```
**Esperado:** "Test Reference — Updated"

### 7.6 DELETE /api/pipeline/context/:key — Remover
```bash
curl -s -X DELETE "http://localhost:3001/api/pipeline/context/test-reference" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** 200/204

---

## 8. Search

### 8.1 GET /api/pipeline/search — Busca por texto
```bash
curl -s "http://localhost:3001/api/pipeline/search?q=Canadá" \
  -H "X-Pipeline-Key: $KEY" | jq '.results | length'
```
**Esperado:** Resultados incluindo items que mencionam "Canadá" no título/synopsis

### 8.2 Busca por código
```bash
curl -s "http://localhost:3001/api/pipeline/search?q=a1" \
  -H "X-Pipeline-Key: $KEY" | jq '.results | map({code, title: .title_pt})'
```
**Esperado:** Item com code "a1" nos resultados

### 8.3 Busca sem resultados
```bash
curl -s "http://localhost:3001/api/pipeline/search?q=xyznonexistent999" \
  -H "X-Pipeline-Key: $KEY" | jq '.results | length'
```
**Esperado:** 0 resultados

---

## 9. Stats

### 9.1 GET /api/pipeline/stats — Estatísticas
```bash
curl -s "http://localhost:3001/api/pipeline/stats" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Breakdown por formato, stage, prioridade. Totais devem bater com os dados seeded (81 videos, 44 blog_posts, 2 newsletters + items de teste).

---

## 10. Bulk Operations

### 10.1 POST /api/pipeline/items/bulk — Batch advance
```bash
# Pegar 3 items na stage "idea" para avançar em batch
ITEMS=$(curl -s "http://localhost:3001/api/pipeline/items?stage=idea&format=video&limit=3" \
  -H "X-Pipeline-Key: $KEY" | jq -r '.data | map(.id) | join(",")')

IDS=(${ITEMS//,/ })

curl -s -X POST "http://localhost:3001/api/pipeline/items/bulk" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"operations\": [
      {\"op\": \"advance\", \"id\": \"${IDS[0]}\"},
      {\"op\": \"advance\", \"id\": \"${IDS[1]}\"},
      {\"op\": \"advance\", \"id\": \"${IDS[2]}\"}
    ]
  }" | jq .
```
**Esperado:** 3 items avançados de idea → roteiro

### 10.2 Bulk tag
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/bulk" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"operations\": [
      {\"op\": \"tag\", \"id\": \"${IDS[0]}\", \"data\": {\"add\": [\"bulk-tested\"], \"remove\": []}},
      {\"op\": \"tag\", \"id\": \"${IDS[1]}\", \"data\": {\"add\": [\"bulk-tested\"], \"remove\": []}}
    ]
  }" | jq .
```
**Esperado:** Tags adicionadas aos items

### 10.3 Bulk retreat (desfazer os advances)
```bash
curl -s -X POST "http://localhost:3001/api/pipeline/items/bulk" \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"operations\": [
      {\"op\": \"retreat\", \"id\": \"${IDS[0]}\"},
      {\"op\": \"retreat\", \"id\": \"${IDS[1]}\"},
      {\"op\": \"retreat\", \"id\": \"${IDS[2]}\"}
    ]
  }" | jq .
```
**Esperado:** Items voltam para "idea"

---

## 11. Topics

### 11.1 GET /api/pipeline/topics/:code — Consultar tópico por tag
```bash
curl -s "http://localhost:3001/api/pipeline/topics/idea-bank" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Agregação de items com a tag "idea-bank"

### 11.2 Consultar por código de collection
```bash
curl -s "http://localhost:3001/api/pipeline/topics/playlist-e" \
  -H "X-Pipeline-Key: $KEY" | jq .
```
**Esperado:** Dados agregados da collection E (Languages)

---

## 12. Cleanup — Remover Dados de Teste

Após todos os testes, limpar os items criados para teste:

```bash
# Deletar items de teste
curl -s -X DELETE "http://localhost:3001/api/pipeline/items/$ITEM_ID" \
  -H "X-Pipeline-Key: $KEY"

curl -s -X DELETE "http://localhost:3001/api/pipeline/items/$BLOG_ITEM_ID" \
  -H "X-Pipeline-Key: $KEY"

# Remover tags "bulk-tested" dos items (se necessário)
# Retreat qualquer item que foi advanced durante testes
```

---

## 13. Checklist de Validação Final

Após rodar todos os testes, preencher:

| # | Área | Endpoint | Operação | Status |
|---|------|----------|----------|--------|
| 1.1 | Discovery | GET /api/pipeline | Manifest | ⬜ |
| 1.2 | Discovery | GET /api/pipeline/workflows | Workflow defs | ⬜ |
| 2.1 | Items | POST /api/pipeline/items | Create video | ⬜ |
| 2.2 | Items | POST /api/pipeline/items | Create blog | ⬜ |
| 2.3 | Items | POST /api/pipeline/items | Validation: no title | ⬜ |
| 2.4 | Items | POST /api/pipeline/items | Validation: bad format | ⬜ |
| 2.5 | Items | GET /api/pipeline/items | List | ⬜ |
| 2.6 | Items | GET /api/pipeline/items | Filter by format | ⬜ |
| 2.7 | Items | GET /api/pipeline/items | Filter by stage | ⬜ |
| 2.8 | Items | GET /api/pipeline/items | Filter by tag | ⬜ |
| 2.9 | Items | GET /api/pipeline/items/:id | Detail | ⬜ |
| 2.10 | Items | PATCH /api/pipeline/items/:id | Update | ⬜ |
| 2.11 | Items | PATCH /api/pipeline/items/:id | Optimistic lock conflict | ⬜ |
| 2.12 | Items | PATCH /api/pipeline/items/:id | Format immutability | ⬜ |
| 3.1 | Stage | POST .../advance | idea → roteiro | ⬜ |
| 3.2 | Stage | POST .../advance | roteiro → gravacao | ⬜ |
| 3.3 | Stage | POST .../retreat | gravacao → roteiro | ⬜ |
| 3.4 | Stage | POST .../retreat | Can't retreat from first | ⬜ |
| 4.1 | Checklist | POST .../checklist | Toggle on | ⬜ |
| 4.2 | Checklist | POST .../checklist | Toggle off | ⬜ |
| 4.3 | Checklist | POST .../checklist | Invalid index | ⬜ |
| 5.1 | Archive | DELETE /api/pipeline/items/:id | Soft archive | ⬜ |
| 5.2 | Archive | GET /api/pipeline/items | Excluded from list | ⬜ |
| 5.3 | Archive | GET /api/pipeline/items | Included with flag | ⬜ |
| 5.4 | Archive | POST .../restore | Restore | ⬜ |
| 6.1 | Collections | GET /api/pipeline/collections | List 6 | ⬜ |
| 6.2 | Collections | POST /api/pipeline/collections | Create | ⬜ |
| 6.3 | Collections | GET /api/pipeline/collections/:id | Detail | ⬜ |
| 6.4 | Collections | Membership | Add item | ⬜ |
| 6.5 | Collections | PUT /api/pipeline/collections/:id | Update | ⬜ |
| 6.6 | Collections | DELETE /api/pipeline/collections/:id | Delete | ⬜ |
| 6.7 | Collections | GET /api/pipeline/collections | Originals intact | ⬜ |
| 7.1 | Reference | GET /api/pipeline/context | List 8 refs | ⬜ |
| 7.2 | Reference | GET /api/pipeline/context/:key | Detail | ⬜ |
| 7.3 | Reference | PUT /api/pipeline/context/:key | Create | ⬜ |
| 7.4 | Reference | GET /api/pipeline/context/:key | Verify created | ⬜ |
| 7.5 | Reference | PUT /api/pipeline/context/:key | Update (upsert) | ⬜ |
| 7.6 | Reference | DELETE /api/pipeline/context/:key | Delete | ⬜ |
| 8.1 | Search | GET /api/pipeline/search | Text search | ⬜ |
| 8.2 | Search | GET /api/pipeline/search | Code search | ⬜ |
| 8.3 | Search | GET /api/pipeline/search | No results | ⬜ |
| 9.1 | Stats | GET /api/pipeline/stats | Aggregations | ⬜ |
| 10.1 | Bulk | POST /api/pipeline/items/bulk | Batch advance | ⬜ |
| 10.2 | Bulk | POST /api/pipeline/items/bulk | Batch tag | ⬜ |
| 10.3 | Bulk | POST /api/pipeline/items/bulk | Batch retreat | ⬜ |
| 11.1 | Topics | GET /api/pipeline/topics/:code | By tag | ⬜ |
| 11.2 | Topics | GET /api/pipeline/topics/:code | By collection | ⬜ |

---

## Notas de Implementação

### Autenticação
- Todos os endpoints usam `X-Pipeline-Key` header
- Rate limit: 100 requests/minuto por key
- Permissões: `read`, `write`, `admin` (a key de teste tem todas)
- Fallback: session cookie (para o CMS UI)

### Optimistic Locking
- PATCH requer `If-Match` header com a `version` atual
- A DB auto-incrementa `version` em cada UPDATE
- Conflito retorna 409

### Formato Imutável
- Trigger `trg_pipeline_immutable_format` impede mudança de `format` após criação
- Para mudar formato: deletar e recriar

### Collections — Modelo Atual
- 6 playlists: A (Life Chapters), B (Gaming→Life), C (Taking Control), E (Languages), F (Body&Mind), G (AI Empire)
- Memberships usam `role` para classificar: `null` = video, `text` = artigo, `idea-bank` = banco de ideias, `arc-1/2/3` = arcos narrativos de G
- Text playlists (TA-TF) são mapeadas para collections por tema: TA→E, TB→C, TC→A, TD→G, TE→C, TF→B

### Dados Seeded
- 77 vídeos (playlists A-G)
- 37 artigos planejados (text pathways TA-TF)
- 3 artigos escritos (drafts)
- 12 ideias do banco (iA1-2, iE1-10)
- 8 documentos de referência
- Total: ~127 items em pipeline
