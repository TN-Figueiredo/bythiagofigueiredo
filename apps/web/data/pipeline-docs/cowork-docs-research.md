# Research & Estratégia — Referência Completa

Três camadas que sobem do bruto pro foco: **research item → takeaway → decisão → foco**.

- **Research items** vivem em REST (`/api/pipeline/research`, auth `X-Pipeline-Key`) **e** na tool MCP `manage_research`.
- **Focos** e **decisões** agora também têm **paridade REST** (auth `X-Pipeline-Key`), além das tools MCP `manage_focos` / `manage_decisions`:
  - Focos: `GET|POST /api/pipeline/research/focos`, `GET /api/pipeline/research/focos/active`, `GET|PATCH|DELETE /api/pipeline/research/focos/:id`, `POST /api/pipeline/research/focos/:id/activate` (exige `{ "confirm": true }` — demove o foco ativo anterior).
  - Decisões: `GET|POST /api/pipeline/research/decisoes`, `GET|PATCH|DELETE /api/pipeline/research/decisoes/:id`, `POST /api/pipeline/research/decisoes/:id/link` (+ `DELETE …/link?research_id=` p/ desvincular).
  - As rotas REST e as tools MCP compartilham a mesma camada de serviço (`services/research-focos.ts`, `services/research-decisions.ts`) — comportamento idêntico.

> Esta é a referência de _plumbing_ (campos, status, actions). A estratégia/persona/princípios (RS1–RS7, modos TRIAGE/DISTILL/PROPOR-FOCO/REVIEW/DIGEST) ficam no skill-doc.

---

## Árvore de Decisão

```
O que você quer fazer com este conhecimento?
├─ CAPTURAR conhecimento bruto (artigo, achado, nota)?
│   └─ → RESEARCH ITEM
│       ├─ Novo? → manage_research action:create (theme_id + content_md)
│       ├─ Já existe? → GET /research → manage_research action:update
│       └─ Tem aprendizado? → preencher takeaways[]  (sem takeaway = ruído, RS1)
│
├─ FIRMAR uma aposta (o dono já decidiu algo)?
│   └─ → DECISÃO
│       ├─ manage_decisions action:create  (horizon + metric + source_research_ids)
│       └─ Decisão sem metric + source_research_ids está incompleta (RS3)
│
├─ DEFINIR o trimestre (qual é o foco do momento)?
│   └─ → FOCO
│       ├─ Cowork PROPÕE → manage_focos action:propose (state:proposto)
│       └─ Só O DONO ATIVA → manage_focos action:activate (exige confirmação, único ativo)
│
└─ DÚVIDA → listar: GET /research  |  manage_decisions action:list  |  manage_focos action:get_active
```

O fluxo canônico é **research → takeaway → decisão → foco**: você captura research, destila takeaways, alguns takeaways viram decisões mensuráveis, e um tema maduro de decisões vira o foco do trimestre.

---

# 1. RESEARCH ITEMS

Conhecimento bruto capturado. Auth REST: `X-Pipeline-Key` (write permission para mutações). **NÃO use `Authorization: Bearer`.**

## Status enum — `fresca | analise | aplicada | arquivada`

| Status | Significado |
|--------|-------------|
| `fresca` | Acabou de entrar, ainda não triada |
| `analise` | Em análise — deve gerar ≥1 takeaway ou ser arquivada (RS1) |
| `aplicada` | Já aplicada a conteúdo / decisão |
| `arquivada` | Escondida do fluxo |

> O enum antigo `new/reviewed/starred/archived` foi removido. Use **apenas** `fresca/analise/aplicada/arquivada`.

## Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| `theme_id` | enum | `asia` (Ásia & Nomadismo), `ia` (IA & Produção), `dev` (Programação), `games` (Games & Pedigree), `grana` (Monetização), `canal` (Canal & Audiência) |
| `takeaways[]` | string[] (máx 10, ≤500 cada) | Aprendizados curtos extraídos do item. Coração do RS1 |
| `pinned` | boolean | Fixa o item no topo. Pinada no foco ativo = quente (RS6) |
| `summary` | string (≤2000) | Resumo de uma linha |
| `content_html` | string (≤2M) | HTML renderizado (atualizável via `update`) |
| `content_md` | string (≤500k) | Markdown bruto (mutuamente exclusivo com `content_json`) |
| `source` | enum | `cowork` (Claude Cowork), `thiago` (Você), `dupla` (Cowork + você). Default `thiago` |
| `sources[]` | `{url,title,accessed_at?}` | Fontes externas (máx 50) |
| `status` | enum | ver acima |
| `topic_slug` | string | kebab-case, máx 3 níveis (`a/b/c`). Auto-cria tópicos faltantes |

## Tool MCP — `manage_research`

Actions: `create` · `update` · `delete` · `import` · `link` · `unlink` · `create_topic` · `update_topic` · `delete_topic`.

```jsonc
// criar
{ "action": "create",
  "title": "WYD Ongame Era — early MMORPG history",
  "topic_slug": "games/wyd",
  "content_md": "# WYD\n\n...",
  "theme_id": "games",
  "source": "cowork",
  "summary": "WYD Online na era Ongame (2003-2008)",
  "takeaways": ["Pedigree de MMO antigo gera autoridade no nicho games"],
  "sources": [{ "url": "https://exemplo.com", "title": "Artigo" }] }

// triar: marcar em análise + extrair takeaway + atribuir tema
{ "action": "update", "id": "<uuid>", "status": "analise",
  "theme_id": "games", "takeaways": ["..."] }

// fixar (quente)
{ "action": "update", "id": "<uuid>", "pinned": true }

// arquivar research sem takeaway (RS1)
{ "action": "update", "id": "<uuid>", "status": "arquivada" }

// deletar (exige confirm; use dry_run para obter confirmation_token)
{ "action": "delete", "id": "<uuid>", "confirm": true }
```

## REST — research items

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/pipeline/research` | Lista. Filtros: `?status=`, `?theme_id=`, `?topic_slug=`, `?search=`, `?pipeline_item_id=`. `?include=content` para corpo. Paginação `?cursor=`, `?limit=` (máx 200) |
| GET | `/api/pipeline/research/:id` | Item completo: `content_md`, `content_html`, `content_json`, `linked_items[]` |
| POST | `/api/pipeline/research` | Cria/upsert (duplicate title+topic = update) |
| PATCH | `/api/pipeline/research/:id` | Update parcial. Requer header `X-Expected-Version` |
| DELETE | `/api/pipeline/research/:id` | Remove |
| POST | `/api/pipeline/research/import` | Bulk (máx 50, falhas parciais isoladas) |
| GET/POST/PATCH/DELETE | `/api/pipeline/research/topics[/:id]` | CRUD de tópicos |
| POST | `/api/pipeline/research/:id/links` | Linka a um pipeline item (`{ pipeline_item_id, note? }`) |
| DELETE | `/api/pipeline/research/:id/links/:linkId` | Remove o link |

> **Mudança de modelo:** links research↔pipeline agora carregam apenas `note` (texto livre). O enum de relação antigo `informs/supports/contradicts/expands` foi removido — não envie `relationship`.

PATCH usa `X-Expected-Version` (pega `version` do GET/POST). 412 = conflito → re-GET e retente.

## Resources MCP de leitura

- `pipeline://research/topics` — árvore de tópicos com contagem por tópico.

---

# 2. DECISÕES

Apostas firmadas. Padrão: **você decide, o Cowork registra**. O Cowork nunca decide sozinho — documenta a decisão do dono e a conecta às pesquisas que a embasaram. **Operada via `manage_decisions` (MCP) ou pelas rotas REST `/api/pipeline/research/decisoes`.**

## Status — `decidido | testando | revisar | arquivado`

| Status | Significado |
|--------|-------------|
| `decidido` | Decisão firmada |
| `testando` | Em teste |
| `revisar` | Precisa revisar (ver `revisit`) |
| `arquivado` | Encerrada — **só via action `archive`**, nunca via `create/update` |

## Horizon — `agora | proximo | explorar`

`agora` (próximos 3 meses) > `proximo` (3–6 meses) > `explorar` (apostas/backlog). Horizonte = prioridade na hora de surfacar (RS4).

## Os 5 campos de detalhe

| Campo | Tipo | Significado |
|-------|------|-------------|
| `context` | string (≤5000) | Cenário/pano de fundo que levou à decisão |
| `consequences[]` | string[] (máx 20) | Trade-offs assumidos |
| `metric` | string (≤500) | Como saberemos que deu certo — **obrigatório p/ decisão completa (RS3)** |
| `revisit` | string (≤100) | Quando revisitar (ex.: "Q3 2026"). Vencido = sobe pro topo (RS5) |
| `history[]` | `{label,date,note?}` | Histórico de mudanças de status (máx 50) |

## Ligações

| Campo | Significado |
|-------|-------------|
| `source_research_ids[]` | UUIDs dos research items que embasaram (sincronizados na junção). **Obrigatório p/ decisão completa (RS3)** |
| `drives[]` | O que a decisão impulsiona/habilita (máx 10) |
| `theme_id` | Tema estratégico |
| `rationale`, `date_label` | Racional e rótulo de data legível |

## Tool MCP — `manage_decisions`

Actions: `list` · `get` · `create` · `update` · `archive` · `link_research` · `unlink_research`.

```jsonc
// listar (filtros: horizon/status/theme_id)
{ "action": "list", "horizon": "agora", "status": "testando" }

// destilar takeaways → decisão (DISTILL)
{ "action": "create",
  "title": "Dobrar conteúdo de games/pedigree no Q3",
  "horizon": "agora",
  "status": "decidido",
  "theme_id": "games",
  "context": "Takeaways de games mostram autoridade no nicho retrô",
  "consequences": ["Menos largura em IA por um trimestre"],
  "metric": "+30% retenção média nos vídeos de games até set/26",
  "revisit": "Q4 2026",
  "drives": ["Série WYD", "Playlist pedigree"],
  "source_research_ids": ["<uuid-research-1>", "<uuid-research-2>"] }

// conectar/desconectar uma pesquisa-fonte
{ "action": "link_research", "id": "<decision-uuid>", "research_id": "<uuid>", "note": "evidência principal" }
{ "action": "unlink_research", "id": "<decision-uuid>", "research_id": "<uuid>" }

// arquivar (dry_run → confirmation_token → archive). NÃO use status:arquivado no update
{ "action": "archive", "id": "<decision-uuid>", "dry_run": true }
{ "action": "archive", "id": "<decision-uuid>", "confirmation_token": "<token>" }
```

> `status:'arquivado'` é intencionalmente **bloqueado** em `create/update` — arquivar passa pelo gate `archive` (dry_run + token).

## Resource MCP de leitura

- `pipeline://research/decisoes` — log de decisões agrupado por horizon (exclui arquivadas).

---

# 3. FOCOS

O foco estratégico do trimestre. Padrão: **você decide, o Cowork propõe**. **Operado via `manage_focos` (MCP) ou pelas rotas REST `/api/pipeline/research/focos`.**

## INVARIANTE: foco único

Há no **máximo 1 foco `ativo`** por site (RS2). A ativação é atômica via RPC `activate_research_foco`, que rebaixa o foco ativo anterior.

## State — `ativo | proposto | rascunho | arquivado`

| State | Label | Significado |
|-------|-------|-------------|
| `ativo` | No ar | Foco vigente — único |
| `proposto` | Proposto pelo Cowork | Sugerido, aguardando o dono |
| `rascunho` | Rascunho | Em elaboração |
| `arquivado` | Arquivado | Encerrado |

## REGRA DURA: propose vs. activate

- O **Cowork PROPÕE**: `action:propose` cria foco com `state:proposto`. **NUNCA ativa.**
- **Só o DONO ATIVA**: `action:activate` promove a único foco ativo. **Exige confirmação** (dry_run → `confirmation_token`).

## Horizon

`agora | proximo | explorar` (mesma semântica de decisões — RS4).

## Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| `title` | string (≤300) | Obrigatório em create/save_full/propose |
| `description` | string (≤3000) | Markdown |
| `rationale` | string (≤3000) | Por que esse é o foco do momento |
| `metric` | string (≤500) | Como saberemos que o foco avançou |
| `window_label` | string (≤100) | Janela legível (ex.: "junho/2026") |
| `theme_ids[]` | enum[] (máx 6) | Temas do foco |
| `pinned_research_ids[]` | uuid[] (máx 30) | Pesquisas fixadas. Pinada no foco ativo = prioridade máxima (RS6) |
| `pinned_notes` | record<uuid,string> | Por que cada pesquisa foi fixada |

## Tool MCP — `manage_focos`

Actions: `list` · `get` · `get_active` · `create` · `update` · `save_full` · `propose` · `activate` · `archive` · `link_research` · `unlink_research`.

```jsonc
// o foco vigente (único)
{ "action": "get_active" }

// PROPOR-FOCO: tema maduro vira proposta (Cowork nunca ativa)
{ "action": "propose",
  "title": "Trimestre de Games & Pedigree",
  "horizon": "agora",
  "window_label": "Q3 2026",
  "rationale": "3+ research maduras em games sem foco; decisões já apontam pra lá",
  "metric": "Série WYD publicada + playlist pedigree com 5 vídeos",
  "theme_ids": ["games", "canal"],
  "pinned_research_ids": ["<uuid>"] }

// upsert atômico + diff-sync de temas e pesquisas
{ "action": "save_full", "id": "<foco-uuid>", "title": "...", "theme_ids": ["games"], "pinned_research_ids": ["<uuid>"] }

// fixar/remover uma pesquisa
{ "action": "link_research", "id": "<foco-uuid>", "research_id": "<uuid>", "note": "evidência-chave" }
{ "action": "unlink_research", "id": "<foco-uuid>", "research_id": "<uuid>" }

// ATIVAR — alto impacto, exige confirmação (só o dono autoriza)
{ "action": "activate", "id": "<foco-uuid>", "dry_run": true }
{ "action": "activate", "id": "<foco-uuid>", "confirmation_token": "<token>" }

// arquivar (encerra e desativa)
{ "action": "archive", "id": "<foco-uuid>" }
```

## Resource MCP de leitura

- `pipeline://research/foco/active` — foco ativo atual (único).

---

## Fluxo end-to-end: research → takeaway → decisão → foco

```
1. CAPTURA   manage_research action:create  (theme_id + content_md)
2. TAKEAWAY  manage_research action:update   status:analise + takeaways[]   (RS1)
3. DECISÃO   manage_decisions action:create  horizon + metric + source_research_ids   (RS3)
4. FOCO      manage_focos action:propose     state:proposto                  (Cowork propõe)
   ───────── o dono avalia ─────────
5. ATIVA     manage_focos action:activate    confirmation_token              (só o dono, foco único — RS2)
```

---

## Error Codes (REST)

| Code | Significado | Ação |
|------|-------------|------|
| 400 | Body/params inválidos | Conferir tipos e campos obrigatórios |
| 401 | `X-Pipeline-Key` ausente/inválida | Verificar header |
| 404 | Recurso não encontrado | Conferir o ID |
| 409 | Conflito de revisão | Re-GET, usar rev atual, retentar |
| 412 | `X-Expected-Version` divergente | Re-GET p/ atualizar `version`, retentar |
| 429 | Rate limit (100/min) | Aguardar e retentar |

> Tools MCP de alto impacto (`delete`, `archive`, `activate`) usam o gate **dry_run → confirmation_token** em vez de códigos HTTP. `activate` **sempre** exige confirmação.
