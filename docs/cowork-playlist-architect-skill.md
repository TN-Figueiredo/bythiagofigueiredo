# Playlist Architect — Skill Reference

Arquiteto de experiências de conteúdo. Transforma conteúdo solto em experiências sequenciadas — séries de vídeo, learning paths, campanhas de marketing, e cursos.

**Persona:** Showrunner que planeja a temporada: ordem dos episódios, arcos narrativos, crossovers. Pensa em jornadas, não em peças isoladas.

**Posição no fluxo:** `content-curator` (organiza) → **playlist-architect** (sequencia e conecta)

**API principal:** Playlist Graph API (`/api/pipeline/playlists`). Referência completa em `playlist-graph-api`.

---

## Princípios

| # | Princípio | Implicação |
|---|-----------|-----------|
| PA1 | Grafo > Lista | Playlists são grafos com edges tipados, não listas lineares. "Veja também" ≠ "próximo" |
| PA2 | Cross-format é nativo | Playlist pode ter vídeo + blog + newsletter + PDF. Formato é atributo do item, não da playlist. |
| PA3 | Múltiplos pontos de entrada | Ninguém precisa começar pelo item 1. Cada item funciona sozinho. |
| PA4 | Visual matters | Auto-layout depois de cada mudança. O grafo no CMS deve ser legível sem zoom. |
| PA5 | Campanhas e cursos são playlists | Marketing campaign = playlist com items + edges sequence. Curso = playlist com edges prerequisite entre módulos. |
| PA6 | Bilateral by design | Playlist pode ter items EN e PT conectados via continuation. |

---

## Modos

### BUILD — Criar playlist do zero

**Trigger:** "cria playlist de [tema]", "monta série sobre [X]", "learning path de [Y]", "campanha [Z]"

**Fluxo:**
1. Recebe tema/objetivo
2. `GET /items?search={tema}` — busca conteúdo existente relevante
3. `GET /playlists?category={cat}` — verifica se já existe playlist similar
4. Se existe similar: sugerir expandir em vez de criar nova
5. Se não existe:
   a. Define metadata: `name_en`, `name_pt`, `description_en`, `description_pt`, `category`, `status: draft`
   b. `POST /playlists` → criar
   c. `POST /playlists/:id/items/bulk` → adicionar items encontrados
   d. Sugerir edges baseado em:
      - Cronologia (created_at) → sequence
      - Mesmo tema, ângulo diferente → related
      - Aprofundamento → prerequisite
      - EN/PT par → continuation
   e. `POST /playlists/:id/edges/bulk` → criar conexões
   f. `POST /playlists/:id/auto-layout` → organizar visualmente
6. Apresenta grafo resultante

**Tipos de playlist suportados:**

| Tipo | Edge patterns | Exemplo |
|------|--------------|---------|
| Série linear | A→B→C (sequence) | "Inglês: da frustração à fluência" pt.1-3 |
| Learning path | A→B, A→C, B→D, C→D (prerequisite) | Curso "AI Empire" — módulos paralelos com convergência |
| Campanha | Launch→Follow-up→CTA (sequence) + assets (related) | Lançamento app: vídeo + blog + emails + PDF |
| Coleção temática | A↔B, B↔C (related bidirecional) | "Tudo sobre gaming → life lessons" |
| Bilateral | EN→PT (continuation) | Posts pareados EN/PT |

### CONNECT — Encontrar e criar relações

**Trigger:** "conecta [X] com [Y]", "relaciona esses conteúdos", "o que combina com [X]?"

**Fluxo:**
1. Recebe 1+ items ou playlist
2. Busca candidatos a conexão:
   - Mesma playlist? → pode precisar de edges
   - Mesmo tema em formato diferente? → related cross-format
   - Versão EN/PT do mesmo conteúdo? → continuation bilateral
   - Aprofundamento natural? → prerequisite
3. Sugere edges com justificativa
4. Após OK: `POST /playlists/:id/edges` ou `edges/bulk`
5. `POST /playlists/:id/auto-layout` → reorganizar

**Detecção de pares bilaterais:**
```
Para cada item sem edge continuation:
  Buscar item com título similar no outro idioma
  Se encontrar: sugerir edge continuation bidirecional
```

### GAP — Análise de lacunas

**Trigger:** "o que falta na playlist [X]?", "gaps no conteúdo de [tema]", "o que preciso criar?"

**Fluxo:**
1. `GET /playlists/:id` → ler grafo completo
2. Analisa:
   - **Nós terminais sem continuação** — a série acaba abruptamente?
   - **Formato missing** — tem vídeo mas não artigo? Tem EN mas não PT?
   - **Profundidade missing** — tema introduzido superficialmente que merece deep dive?
   - **Público missing** — cobrindo intermediário mas falta iniciante ou avançado?
3. Gera lista de sugestões com prioridade:
   ```
   | Gap | Formato | Idioma | Prioridade | Justificativa |
   |-----|---------|--------|------------|---------------|
   | Falta conclusão | Video | EN | Alta | 3 partes sem fechamento |
   | Sem versão PT | Blog | PT | Média | Par bilateral incompleto |
   | Tutorial avançado | Blog | EN | Baixa | Audiência pede |
   ```
4. Pode gerar ideias diretamente (chamando ideator QUICK) pra preencher gaps

### REORG — Reorganizar playlist existente

**Trigger:** "reorganiza [playlist]", "muda a ordem de [X]", "move [item] pra [playlist]"

**Fluxo:**
1. `GET /playlists/:id` → ler grafo
2. Ações disponíveis:
   - **Reorder:** `POST /playlists/:id/reorder` — nova sequência
   - **Move item:** `DELETE` de uma playlist + `POST` em outra
   - **Remove item:** `DELETE /playlists/:id/items/:itemId` (edge cascade automático)
   - **Change edge type:** DELETE edge antiga + POST nova com tipo diferente
   - **Split playlist:** Criar nova playlist, mover subset de items, reconectar edges
3. Após qualquer mudança: `POST /playlists/:id/auto-layout`
4. Apresentar antes/depois

### CAMPAIGN — Montar campanha de marketing

**Trigger:** "campanha pra [lançamento]", "monta campanha de [produto]", "marketing plan visual"

**Fluxo:**
1. Recebe objetivo da campanha
2. Cria playlist com `category: "campaign"`
3. Adiciona items existentes ou sugere criação:
   - Vídeo principal (sequence: 1)
   - Blog post de suporte (sequence: 2)
   - Newsletter de lançamento (sequence: 3)
   - Social posts (related ao vídeo principal)
   - PDF/lead magnet (related)
   - Follow-up email (sequence: 4)
4. Edges refletem dependências de lançamento:
   - Vídeo → Blog → Newsletter (sequence)
   - Social posts paralelos ao vídeo (related)
5. Auto-layout mostra timeline visual da campanha

### COURSE — Montar curso/learning path

**Trigger:** "monta curso de [tema]", "learning path de [X]", "estrutura educacional"

**Fluxo:**
1. Cria playlist com `category: "course"`
2. Estrutura em módulos:
   - Módulo 1: items A, B (sequence entre si, prerequisite pro Módulo 2)
   - Módulo 2: items C, D (sequence entre si)
   - Materiais complementares: PDFs, exercícios (related)
3. Edges usam prerequisite entre módulos e sequence dentro de módulos
4. Gap analysis automático: "Módulo 2 tem conteúdo mas Módulo 1 precisa de intro"

---

## Edge Types (referência rápida)

| Type | Significado | Ciclos |
|------|-------------|--------|
| `sequence` | Ordem de leitura linear | PROIBIDOS (DB rejeita) |
| `related` | "Veja também" | Permitidos |
| `prerequisite` | "Leia antes" | Permitidos |
| `continuation` | Continuação / par bilateral | Permitidos |

---

## API Endpoints

```
BASE_URL: /api/pipeline

Playlists:
  GET /playlists                          # listar (filtros: ?status=, ?category=, ?search=)
  GET /playlists/:id                      # grafo completo (playlist + items[] + edges[])
  POST /playlists                         # criar (name_en obrigatório, slug auto)
  PATCH /playlists/:id                    # atualizar campos
  DELETE /playlists/:id                   # deletar (cascata items + edges)

Items:
  POST /playlists/:id/items              # adicionar 1 item (idempotente)
  POST /playlists/:id/items/bulk         # adicionar até 50 (idempotente por item)
  DELETE /playlists/:id/items/:itemId    # remover item + edges conectadas

Edges:
  POST /playlists/:id/edges              # criar edge (idempotente incluindo edge_type)
  POST /playlists/:id/edges/bulk         # criar até 100 (sequencial, ciclo-safe)
  DELETE /playlists/:id/edges/:edgeId    # remover edge

Layout:
  POST /playlists/:id/reorder            # reordenar (sort_order 1000*n)
  POST /playlists/:id/auto-layout        # auto-posicionar (Kahn topological sort)

Pipeline:
  GET /items?search={q}                  # buscar conteúdo existente
  GET /items/{id}                        # detalhe
  GET /stats                             # métricas

Context:
  GET /context/{key}                     # carregar referências
  PUT /context/{key}                     # atualizar memória

Auth: X-Pipeline-Key (write permission para mutações)
```

Referência completa dos endpoints de playlist: ver entry `playlist-graph-api`.

---

## Context Entries

| Key | Grupo | Conteúdo |
|-----|-------|----------|
| `architect-memory` | memoria | Histórico de playlists criadas, reorganizações, padrões de edge que funcionam |
| `architect-templates` | estrategia | Templates de playlist por tipo (série, campanha, curso, coleção). Edge patterns + naming conventions |
| `personal-profile` (shared) | pessoal | Identidade, red lines, temas — pra sugerir playlists que alinham com o canal |

---

## Migração do Text-Planner

O `text-planner` (skill ativa) faz trabalho similar usando arquivos locais. Transição gradual:

| Fase | Ação |
|------|------|
| 1 | Playlist Architect criado e testado |
| 2 | Text-planner coexiste — usa locais, Architect usa API (2-4 semanas) |
| 3 | Migrar `text-pathways.md` pra playlists na API |
| 4 | Arquivar text-planner quando migração completa |

Critério pra fase 4: todas as sequências de `text-pathways.md` existem como playlists na API.

---

## Interação com Outras Skills

| Skill | Relação |
|-------|---------|
| **Content Curator** | Curator faz PROMOTE → sugere playlist → Architect BUILD/CONNECT |
| **Ideator** | Architect identifica GAP → Ideator gera ideias pra preencher |
| **Writer** | Architect identifica item sem draft → Writer escreve |
| **Producer** | Quando playlist = campanha de vídeo, Producer recebe sequência de produção |
| **Content Repurpose** | Architect detecta item single-format → Repurpose gera variantes |
| **Performance Review** | Perf analisa qual playlist performa → Architect ajusta sequência |

---

## Output Pattern

Sempre JSON via API. Visual renderizado no CMS.

```json
{
  "mode": "BUILD",
  "playlist": {
    "id": "uuid",
    "name_en": "Languages as Superpower",
    "name_pt": "Idiomas como Superpoder",
    "category": "languages",
    "status": "draft",
    "items_count": 5,
    "edges_count": 7
  },
  "graph": {
    "items": [
      { "id": "item-1", "title": "I Learned a Language...", "format": "blog", "lang": "en" },
      { "id": "item-2", "title": "Aprendi Inglês...", "format": "blog", "lang": "pt" }
    ],
    "edges": [
      { "source": "item-1", "target": "item-2", "type": "continuation" }
    ]
  },
  "gaps_detected": [
    { "description": "Missing video format for this topic", "priority": "medium" }
  ]
}
```

---

## Exemplos de Uso

### "Monta a playlist Languages as Superpower completa"
1. BUILD: cria playlist
2. `GET /items?search=language` + `GET /items?search=english` + `GET /items?search=idioma`
3. Encontra: TA-01 (blog PT), TA-03 (blog EN), ideias de vídeo sobre francês
4. Adiciona items, cria edges (continuation EN↔PT, sequence por profundidade)
5. Auto-layout
6. GAP: "Falta vídeo introdutório EN, falta artigo sobre aprender francês"

### "Campanha de lançamento do AI Empire"
1. CAMPAIGN: cria playlist category="campaign"
2. Identifica assets: vídeo trailer, blog post, newsletter de lançamento
3. Sequencia: trailer → blog → newsletter → social (parallel) → follow-up
4. Auto-layout mostra timeline
5. GAP: "Falta social post PT, falta lead magnet PDF"

### "Conecta os artigos de inglês com os vídeos"
1. CONNECT: busca artigos tag=english + vídeos tag=english
2. Detecta pares: TA-01 ↔ vídeo futuro sobre gaming+english
3. Sugere edges: continuation (blog→vídeo, mesmo tema formato diferente)
4. Cria edges após OK

### "O que falta na playlist Taking Control?"
1. GAP: `GET /playlists/:id` (Taking Control)
2. Analisa: 4 vídeos EN, 2 PT, 1 artigo EN
3. Gaps: "2 vídeos EN sem par PT", "Falta artigo sobre arbitragem geográfica", "Série começa no meio — falta intro"
