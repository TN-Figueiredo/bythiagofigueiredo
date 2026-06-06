# Links Engine API — Referência Completa

API para criar e gerenciar **short links rastreáveis** (go-links) programaticamente.
Base: `/api/pipeline/links`. Auth: `X-Pipeline-Key` (write permission para mutações).

Cada link resolve em **`/go/{code}`** (ou `https://{LINKS_SHORT_DOMAIN}/{code}` quando o
domínio curto está configurado) e contabiliza cliques. O `code` é **único por site** e é
auto-gerado quando omitido. Todo link criado por esta API tem `source_type: "manual"` e é
escopado ao site da chave.

---

## Árvore de Decisão

```
Tarefa precisa de um link curto/rastreável?
├─ SIM → Já existe um link para esse destino/campanha? → GET /links?utm_campaign={cam}
│   ├─ SIM → reusar o code existente (GET /links/:id para detalhes)
│   └─ NÃO → POST /links → criar (code auto-gerado) → usar short_url retornado
├─ NÃO → Não usar o Links engine (use a URL de destino direta)
└─ DÚVIDA → GET /links → listar links existentes do site
```

---

## Endpoints

### Leitura

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/links` | Lista links. Filtros: `?utm_campaign=`, `?active=true|false`, `?search=`, `?limit=`, `?offset=` |
| GET | `/links/:id` | Um link com `short_url` resolvido |

### Criação / Atualização

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/links` | Criar link rastreável. `code` auto-gerado se omitido |
| PATCH | `/links/:id` | Atualizar campos (destino, UTMs, redirect_type, active) |
| DELETE | `/links/:id` | Arquivar (soft: `active=false`, o link para de resolver mas é retido) |

---

## Criar Tracked Link

```json
POST /api/pipeline/links
{
  "destination_url": "https://bythiagofigueiredo.com/blog/meu-post",  // OBRIGATÓRIO
  "title": "Lançamento — post X",        // opcional
  "code": "lanc-x",                       // opcional (auto-gerado se omitido; único por site)
  "redirect_type": "307",                 // opcional: "301" | "302" | "307" | "308" (default "307")
  "utm_source": "newsletter",             // opcional (normalizado)
  "utm_medium": "email",                  // opcional (normalizado)
  "utm_campaign": "junho-2026",           // opcional (normalizado)
  "utm_term": null,                       // opcional
  "utm_content": null,                    // opcional
  "utm_id": null,                         // opcional
  "tags": ["campanha", "blog"],           // opcional
  "expires_at": "2026-12-31T23:59:59Z",   // opcional (ISO datetime)
  "activates_at": null,                   // opcional (ISO datetime — ativação agendada)
  "pass_click_ids": true                  // opcional (repassa gclid/fbclid ao destino; default true)
}
→ 201 {
  "data": {
    "id": "uuid",
    "code": "lanc-x",
    "short_url": "https://bythiagofigueiredo.com/go/lanc-x",
    "destination_url": "https://bythiagofigueiredo.com/blog/meu-post",
    "source_type": "manual",
    "active": true,
    "utm_campaign": "junho-2026",
    ...
  }
}
```

O **único campo obrigatório** é `destination_url` (deve ser uma URL válida). O `code` é
único por site — se você passar um `code` que já existe nesse site, a resposta é
`409` com `{ "error": { "code": "VALIDATION_ERROR", "message": "Code \"...\" is already taken for this site" } }`.

### Campos UTM

Todos os campos `utm_*` são opcionais e passam por normalização (lowercase / trim) antes de
persistir. Eles são anexados ao destino no momento do redirect e usados para atribuição de
tráfego. `utm_campaign` também funciona como filtro no `GET /links`.

| Campo | Uso típico |
|-------|------------|
| `utm_source` | Origem (ex.: `newsletter`, `youtube`, `instagram`) |
| `utm_medium` | Meio (ex.: `email`, `social`, `cpc`) |
| `utm_campaign` | Nome da campanha (ex.: `junho-2026`) — também filtro de list |
| `utm_term` | Termo/keyword |
| `utm_content` | Variante de criativo |
| `utm_id` | ID de campanha |

---

## Listar Links

```json
GET /api/pipeline/links?utm_campaign=junho-2026&active=true&limit=20
→ 200 {
  "data": [
    { "id": "uuid", "code": "lanc-x", "short_url": ".../go/lanc-x", "total_clicks": 12, "active": true, ... }
  ],
  "meta": { "total": 1, "has_next": false, "limit": 20 }
}
```

| Parameter | Values | Default |
|-----------|--------|---------|
| `utm_campaign` | string exata | — |
| `active` | `true` \| `false` | todos |
| `search` | texto livre (busca em `title` e `code`) | — |
| `limit` | 1–200 | 50 |
| `offset` | inteiro ≥ 0 | 0 |

Paginação por offset: quando `has_next` é `true`, use `meta.next_cursor` (= próximo offset).

---

## Atualizar Link

```json
PATCH /api/pipeline/links/:id
{
  "destination_url": "https://novo-destino.com",   // opcional
  "utm_campaign": "julho-2026",                     // opcional
  "redirect_type": "308",                           // opcional
  "active": false                                   // opcional
}
→ 200 { "data": { "id": "uuid", "code": "...", "short_url": "...", ... } }
```

Apenas os campos enviados são alterados (partial update). `code` não é editável via update.

---

## Arquivar Link

```json
DELETE /api/pipeline/links/:id
→ 200 { "data": { "id": "uuid", "active": false } }
```

Arquivar é **soft**: define `active=false`. O link deixa de resolver em `/go/{code}`, mas o
registro e as métricas históricas são retidos. Não há hard delete via esta API.

---

## Exemplo curl

```bash
# Criar um link de campanha
curl -sX POST https://bythiagofigueiredo.com/api/pipeline/links \
  -H "X-Pipeline-Key: $PIPELINE_COWORK_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "destination_url": "https://bythiagofigueiredo.com/blog/meu-post",
    "utm_source": "newsletter",
    "utm_medium": "email",
    "utm_campaign": "junho-2026"
  }'

# Listar links da campanha
curl -s "https://bythiagofigueiredo.com/api/pipeline/links?utm_campaign=junho-2026" \
  -H "X-Pipeline-Key: $PIPELINE_COWORK_KEY"
```

---

## Workflow: distribuição rastreada de um post

1. `POST /api/pipeline/items/:id/publish` → publicar o post (gera a URL pública)
2. `POST /api/pipeline/links` → criar o short link para a URL publicada, com `utm_campaign` + `utm_source`
3. Usar o `short_url` retornado (`/go/{code}`) nos canais de distribuição
4. `GET /api/pipeline/links?utm_campaign=...` → revisar cliques (`total_clicks`, `unique_visitors`)

---

## Regras

1. `destination_url` é obrigatório e deve ser uma URL válida (`http(s)://...`)
2. `code` é **único por site**; auto-gerado (7 chars, base62) quando omitido
3. Code duplicado → `409 VALIDATION_ERROR`
4. `redirect_type` ∈ {301, 302, 307, 308} (default 307)
5. Todo link criado por esta API: `source_type: "manual"`, escopado ao site da chave
6. Links resolvem em `/go/{code}` (ou no `LINKS_SHORT_DOMAIN` configurado)
7. Arquivar é soft (`active=false`); sem hard delete
8. Erros: formato `{ "error": { "code": "...", "message": "..." } }`

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Invalid request body or parameters | Verifique tipos e campos obrigatórios (`destination_url`) |
| 401 | Missing or invalid X-Pipeline-Key | Confirme o header da requisição |
| 403 | Insufficient permissions | Use uma chave com permissão `write` para mutações |
| 404 | Resource not found | Verifique se o `id` existe e pertence ao site |
| 409 | Code already taken | Escolha outro `code` ou omita para auto-gerar |
| 429 | Rate limit exceeded (100/min) | Aguarde e tente novamente |
