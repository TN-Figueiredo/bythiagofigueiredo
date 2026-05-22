# Playlist Prompt Generator — Design Spec

**Date:** 2026-05-22
**Status:** Draft

---

## 1. Visao Geral

O CMS possui um pipeline de playlists funcional: 11 endpoints CRUD em `/api/pipeline/playlists/`, graph editor visual com items/edges, e o Cowork AI assistant com a skill Playlist Architect (6 modos: BUILD, CONNECT, GAP, REORG, CAMPAIGN, COURSE). Os arquivos de referencia `cowork-playlist-reference.md` e `cowork-playlist-architect-skill.md` ja existem.

O que falta e a ponte entre o CMS e o Cowork. Hoje nao ha como:

1. **Acumular notas e decisoes** ao longo de multiplas rodadas de discussao sobre uma playlist — o contexto se perde entre sessoes.
2. **Gerar um prompt estruturado** que compile o estado atual da playlist (metadata, items, edges, notas) num formato pronto para o Cowork processar.
3. **Referenciar notas** no Cowork reference — o campo nao existe no schema documentado.

### O que esta feature entrega

| Componente | Descricao |
|---|---|
| Campo `notes` na tabela `playlists` | JSONB armazenando Tiptap `JSONContent` — rich text com formatacao, listas, links |
| API atualizada | PATCH `/api/pipeline/playlists/[id]` aceita `notes`; GET ja retorna automaticamente |
| Editor de notas no CMS | Tiptap rich text editor embutido na UI de detalhe da playlist |
| Prompt Generator | Modal que compila playlist state + notas + items selecionados em prompt estruturado |
| Cowork reference atualizado | `cowork-playlist-reference.md` e `cowork-playlist-architect-skill.md` documentam o campo `notes` |

### Premissas

- **Sem versionamento de notas (v1).** Cowork opera em items/edges via CRUD atomico — nao faz writes no campo `notes`. Conflito de versao e improvavel.
- **Sem colaboracao real-time.** Um unico editor por vez (padrao do CMS atual).
- **Notas sao internas.** Nao aparecem no site publico — servem exclusivamente para contexto editorial e input do Cowork.

---

## 2. Migration de Banco de Dados

### Tabela atual: `playlists`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `site_id` | UUID FK | `sites(id) ON DELETE CASCADE` |
| `name_pt` | TEXT | Obrigatorio |
| `name_en` | TEXT | Obrigatorio (default `''`) |
| `slug` | TEXT | Unique por site |
| `description_pt` | TEXT | Nullable |
| `description_en` | TEXT | Nullable |
| `cover_image_url` | TEXT | Nullable |
| `status` | TEXT | `draft` / `published` / `archived` |
| `category` | TEXT | Nullable |
| `viewport_state` | JSONB | `{"zoom":1,"x":0,"y":0}` |
| `created_by` | UUID FK | `auth.users(id)` |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

### Nova coluna

| Coluna | Tipo | Default | Descricao |
|---|---|---|---|
| `notes` | JSONB | `NULL` | Tiptap `JSONContent` — rich text para notas e decisoes editoriais |

### Criar migration

```bash
npm run db:new playlist_notes
```

**NUNCA criar o arquivo manualmente.** O script garante timestamp sequencial correto.

### SQL da migration

```sql
-- Playlist notes field for editorial context accumulation
ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
```

### Notas de implementacao

- **Sem data migration.** Playlists existentes iniciam com `notes = NULL`. A UI trata NULL como editor vazio.
- **Sem coluna de versao.** O campo `updated_at` (trigger `tg_set_updated_at`) ja rastreia a ultima modificacao. Conflito de versao (optimistic locking) nao e necessario em v1 — o Cowork nao escreve neste campo.
- **RLS inalterada.** As policies existentes (`playlists_select`, `playlists_update`) ja cobrem a nova coluna — RLS opera no nivel da row, nao da coluna.
- **Sem indice.** Notas nao sao filtradas nem buscadas — JSONB sem GIN e suficiente.

---

## 3. Alteracoes na API

### Arquivos impactados

| Arquivo | Mudanca |
|---|---|
| `apps/web/src/lib/pipeline/schemas.ts` | Adicionar `notes` ao `PipelineUpdatePlaylistSchema` |
| `apps/web/src/lib/playlists/types.ts` | Adicionar `notes` ao `PlaylistRow` |

### 3.1 Schema de validacao

**Arquivo:** `apps/web/src/lib/pipeline/schemas.ts`

Adicionar `notes` ao `PipelineUpdatePlaylistSchema`:

```typescript
export const PipelineUpdatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200).optional(),
  name_pt: z.string().max(200).optional(),
  description_en: z.string().max(1000).nullable().optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(PLAYLIST_STATUSES).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  notes: z.any().nullable().optional(),
})
```

**Por que `z.any()`?** O Tiptap `JSONContent` e uma arvore recursiva com schema variavel (nodes, marks, attrs). Validar a estrutura completa nao agrega valor — o editor ja garante a forma correta. `z.any()` permite `null` (limpar notas) e qualquer JSONB valido.

### 3.2 Tipo PlaylistRow

**Arquivo:** `apps/web/src/lib/playlists/types.ts`

Adicionar `notes` a interface `PlaylistRow`:

```typescript
export interface PlaylistRow {
  id: string
  site_id: string
  name_pt: string
  name_en: string
  slug: string
  description_pt: string | null
  description_en: string | null
  cover_image_url: string | null
  status: PlaylistStatus
  category: string | null
  viewport_state: { zoom: number; x: number; y: number } | null
  notes: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

**Tipo escolhido:** `Record<string, unknown> | null` em vez de `JSONContent` importado do Tiptap. Motivo: `PlaylistRow` e um tipo de DB row usado em queries e server components. Importar `@tiptap/core` aqui criaria dependencia desnecessaria no bundle do server. O cast para `JSONContent` acontece no componente do editor.

### 3.3 Endpoints — nenhum novo necessario

| Endpoint | Metodo | Impacto |
|---|---|---|
| `/api/pipeline/playlists/[id]` | `GET` | Nenhum — ja retorna `SELECT *`, `notes` incluido automaticamente |
| `/api/pipeline/playlists/[id]` | `PATCH` | Schema atualizado aceita `notes`. O handler ja faz `supabase.from('playlists').update(validatedBody)` — `notes` flui automaticamente |
| `/api/pipeline/playlists` | `GET` (list) | Nenhum — ja retorna todas as colunas |
| `/api/pipeline/playlists` | `POST` (create) | Nenhum — `notes` default NULL no DB |

### 3.4 Fluxo de dados

```
CMS Editor (Tiptap JSONContent)
    |
    v
PATCH /api/pipeline/playlists/[id]  { notes: { type: "doc", content: [...] } }
    |
    v
PipelineUpdatePlaylistSchema.parse()  (z.any() — aceita JSONB)
    |
    v
supabase.from('playlists').update({ notes })
    |
    v
PostgreSQL playlists.notes JSONB column
```

Nenhuma transformacao intermediaria. O Tiptap `JSONContent` e armazenado como-esta no JSONB e retornado intacto no GET.

---

## 4. UI — Editor de Notas

### 4.1 Reestruturacao do Settings Panel com Tabs

O componente `PlaylistSettings` (`apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-settings.tsx`) passa de painel unico para painel com abas.

**Estrutura de tabs:**

| Tab | Label | Conteudo |
|-----|-------|----------|
| `config` | Config | Campos de metadados existentes (nome PT/EN, slug, desc PT/EN, categoria, status) |
| `notes` | Notas | Editor Tiptap para notas/decisoes + badge de contagem de palavras na aba |

**Estado novo no componente:**

```typescript
const [activeTab, setActiveTab] = useState<'config' | 'notes'>(
  playlist.notes ? 'notes' : 'config'
)
```

O tab default e `'notes'` quando `playlist.notes` existe (nao-nulo e nao-vazio), caso contrario `'config'`.

### 4.2 Tab Bar

Renderizada entre o header e o conteudo do painel. Duas abas lado a lado, com indicador de aba ativa via `border-bottom` ou `bg` highlight.

A tab "Notas" exibe um badge com a contagem de palavras quando `wordCount > 0`. Formato: `{N}` em badge compacto ao lado do label.

```typescript
<div className="flex border-b border-white/10">
  <TabButton
    active={activeTab === 'config'}
    onClick={() => setActiveTab('config')}
    label="Config"
    icon="gear"
  />
  <TabButton
    active={activeTab === 'notes'}
    onClick={() => setActiveTab('notes')}
    label="Notas"
    icon="pencil"
    badge={wordCount > 0 ? wordCount : undefined}
  />
</div>
```

### 4.3 Editor de Notas

Usa o componente `PipelineEditor` existente em `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor.tsx`.

**Configuracao:**

```typescript
<PipelineEditor
  content={playlist.notes}
  isEditing={true}
  onContentChange={handleNotesChange}
  preset="compact"
  placeholder="Anote ideias, decisoes e contexto para a proxima discussao..."
/>
```

**Preset `compact`:** headings 3-4, bold, italic, underline, listas, links, character count. Toolbar minimalista integrada ao editor.

**Dimensionamento:**
- `min-height: 140px` no container do editor
- `max-height` limitado pelo scroll do painel (o painel ja tem `overflow-y-auto` na `div.flex-1`)

### 4.4 Auto-save com Debounce

O conteudo do editor e salvo automaticamente com debounce de 2 segundos.

**Fluxo:**

1. `onContentChange` recebe `JSONContent` do Tiptap
2. Debounce de 2000ms antes de chamar a server action
3. Chama `updatePlaylistNotes(playlistId, siteId, notes)` (nova action)
4. Atualiza indicador de status

**Estado de save:**

```typescript
const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
```

**Stats row abaixo do editor:**

```
{N} palavras                     Auto-salvo ✓
```

- Lado esquerdo: `{N} palavras` (contagem em tempo real do `characterCount` storage do Tiptap)
- Lado direito: indicador de save — `"Auto-salvo"` (quando `saved`), `"Salvando..."` (quando `saving`), `"Erro ao salvar"` (quando `error`), vazio quando `idle`

### 4.5 Nova Server Action: `updatePlaylistNotes`

Em `apps/web/src/app/cms/(authed)/playlists/actions.ts`:

```typescript
export async function updatePlaylistNotes(
  playlistId: string,
  siteId: string,
  notes: JSONContent | null,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlists')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}
```

Sem `revalidatePath` — notas sao estado do editor, nao afetam listagem.

### 4.6 Indicador de Notas no Toolbar

Quando o painel de Settings esta fechado, o botao de settings (engrenagem) na toolbar mostra um indicador visual se notas existem.

**Implementacao no `PlaylistToolbar`:**

Nova prop `hasNotes: boolean` no `PlaylistToolbarProps`. Quando `true`, o `ToolbarButton` de Settings recebe um dot indicator (pequeno circulo colorido) posicionado em `absolute top-0 right-0`.

```typescript
<div className="relative">
  <ToolbarButton label="Settings" onClick={onToggleSettings}>
    <SettingsIcon />
  </ToolbarButton>
  {hasNotes && (
    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-400" />
  )}
</div>
```

### 4.7 Novos Botoes no Toolbar

Dois novos botoes adicionados ao toolbar, entre o botao Export e o botao Settings:

**Botao "Prompt":**
- Label: `"Prompt"`
- Estilo: accent color (`bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30`)
- Acao: abre o modal do prompt generator (secao 5)
- Nova prop no toolbar: `onOpenPrompt: () => void`

**Botao "Refresh":**
- Label: `"Refresh"`
- Icone: setas circulares (refresh icon, 14x14 SVG inline)
- Estilo: done/green color (`text-green-400/60 hover:text-green-400`)
- Acao: `router.refresh()` — re-fetch do grafo da playlist apos o Cowork aplicar mudancas
- Nova prop no toolbar: `onRefresh: () => void`

**Ordem dos botoes no grupo direito do toolbar:**

```
[Undo] [Redo] | [Auto-layout] | [Zoom-] [%] [Zoom+] [Fit] | [Print] [Export] [Prompt] [Refresh] | [Settings]
```

### 4.8 Props Atualizadas — `PlaylistToolbarProps`

```typescript
interface PlaylistToolbarProps {
  // ... props existentes ...
  hasNotes: boolean
  onOpenPrompt: () => void
  onRefresh: () => void
}
```

---

## 5. UI — Modal do Prompt Generator

### 5.1 Localizacao e Pattern

Novo componente: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/prompt-generator-modal.tsx`

Segue exatamente os mesmos patterns de `apps/web/src/app/cms/(authed)/pipeline/_components/prompt-generator-modal.tsx`: estrutura do modal, gerenciamento de estado, focus trap, comportamento do botao de copy, overlay com click-outside para fechar.

### 5.2 Interface de Props

```typescript
import type { PlaylistRow, PlaylistItemEnriched, PlaylistEdgeRow } from '@/lib/playlists/types'

interface PlaylistPromptModalProps {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  selectedItemIds: string[]
  reuseCandidates: ReuseCandidateItem[]
  onClose: () => void
}
```

A prop `selectedItemIds` vem do estado de selecao do canvas. O canvas ja suporta shift+click para multi-selecao; os IDs selecionados sao passados para cima ate o componente que renderiza o modal.

### 5.3 Layout do Modal

O modal usa overlay escuro (`bg-black/60`), centralizado, `max-w-lg`, com `role="dialog"` e `aria-modal="true"`. Segue o design system escuro do pipeline: `var(--gem-*)` CSS custom properties para cores.

**Secoes do modal, de cima para baixo:**

#### 5.3.1 Header

```
[icone-robot]  Gerar Prompt — Playlist
               {playlist.name_en || playlist.name_pt}
```

- Icone: emoji ou SVG de robot
- Titulo: `"Gerar Prompt — Playlist"` em `text-sm font-semibold`
- Subtitulo: nome da playlist em `text-xs` com `color: var(--gem-dim)`

#### 5.3.2 Badges Row

Linha de badges com informacoes contextuais:

```typescript
<div className="flex flex-wrap items-center gap-1.5 text-xs">
  <Badge>{playlist.status}</Badge>
  {playlist.category && <Badge>{playlist.category}</Badge>}
  <Badge>{items.length} items</Badge>
  <Badge>{edges.length} edges</Badge>
</div>
```

Cada badge usa `rounded px-1.5 py-0.5` com `background: var(--gem-well)`.

#### 5.3.3 Items em Foco (Condicional)

Renderizado apenas quando `selectedItemIds.length > 0`.

```typescript
{selectedItemIds.length > 0 && (
  <div>
    <h3 className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>
      Items em foco ({selectedItemIds.length})
    </h3>
    <ul className="mt-1.5 flex flex-col gap-1">
      {focusedItems.map((item, i) => (
        <li key={item.id} className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            {i + 1}.
          </span>
          <ContentTypeBadge type={item.content_type} />
          <span style={{ color: 'var(--gem-text)' }}>{item.title}</span>
          {item.status && (
            <span className="rounded px-1 py-0.5 text-[10px]"
              style={{ background: 'var(--gem-well)' }}>
              {item.status}
            </span>
          )}
        </li>
      ))}
    </ul>
    <p className="mt-1 text-[10px]" style={{ color: 'var(--gem-dim)' }}>
      Shift+click nos cards do canvas para selecionar/remover
    </p>
  </div>
)}
```

`focusedItems` e derivado via `useMemo`:

```typescript
const focusedItems = useMemo(
  () => items.filter(item => selectedItemIds.includes(item.id)),
  [items, selectedItemIds],
)
```

#### 5.3.4 Instrucoes

Textarea para instrucoes do usuario:

```typescript
<textarea
  ref={textareaRef}
  value={instructions}
  onChange={(e) => { setInstructions(e.target.value); setCopied(false) }}
  placeholder="Descreva o que quer discutir ou alterar..."
  aria-label="Instrucoes para o prompt"
  className="w-full text-xs p-2.5 rounded-md resize-y"
  style={{
    background: 'var(--gem-well)',
    border: '1px solid var(--gem-border)',
    color: 'var(--gem-text)',
    minHeight: '60px',
    maxHeight: '120px',
  }}
  rows={3}
/>
```

#### 5.3.5 Stats Line

Linha de estatisticas abaixo do textarea:

```typescript
<div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--gem-dim)' }}>
  {tbdCount > 0 && (
    <span>TBD: {tbdCount}</span>
  )}
  {notesWordCount > 0 && (
    <span>Notas: {notesWordCount} palavras</span>
  )}
  <span>~{promptWordCount} palavras no prompt</span>
</div>
```

**Calculo de `tbdCount`:**

```typescript
const tbdCount = useMemo(
  () => items.filter(item => item.title === 'TBD' || /^TBD/i.test(item.title)).length,
  [items],
)
```

**Calculo de `notesWordCount`:** extraido do `JSONContent` das notas, contando palavras em todos os text nodes.

**Calculo de `promptWordCount`:** `fullPrompt.split(/\s+/).filter(Boolean).length` (mesmo pattern do pipeline).

#### 5.3.6 Toggle de Preview

```typescript
<button
  type="button"
  onClick={() => setShowPreview(!showPreview)}
  className="text-[10px] hover:underline"
  style={{ color: 'var(--gem-accent)' }}
>
  {showPreview ? 'Ocultar prompt' : 'Ver prompt completo'}
</button>
```

Quando expandido, mostra o prompt completo gerado em bloco `<pre>`:

```typescript
{showPreview && (
  <pre
    className="mt-2 p-2.5 rounded-md text-[10px] overflow-y-auto"
    style={{
      maxHeight: '200px',
      background: 'var(--gem-well)',
      border: '1px solid var(--gem-border)',
      color: 'var(--gem-dim)',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
    }}
  >{fullPrompt}</pre>
)}
```

#### 5.3.7 Acoes

Dois botoes: Cancelar e Copiar/Copiado.

```typescript
<div className="flex justify-between items-center mt-3">
  <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
    Cole no Claude Code
  </span>
  <div className="flex gap-1.5 items-center">
    <button type="button" onClick={onClose}>
      Cancelar
    </button>
    {copied ? (
      <button type="button" onClick={onClose}
        style={{ background: 'var(--gem-done)', color: 'white' }}>
        Copiado — fechar
      </button>
    ) : (
      <button type="button" onClick={handleCopy}
        style={{ background: 'var(--gem-accent)', color: 'white' }}>
        Copiar prompt
      </button>
    )}
  </div>
</div>
```

Apos clicar "Copiar prompt":
1. `navigator.clipboard.writeText(fullPrompt)` e chamado
2. `setCopied(true)` troca o botao para "Copiado — fechar" com cor verde (`var(--gem-done)`)

### 5.4 Gerenciamento de Estado

```typescript
const [instructions, setInstructions] = useState('')
const [copied, setCopied] = useState(false)
const [showPreview, setShowPreview] = useState(false)
```

**Prompt gerado via `useMemo`:**

```typescript
const promptResult = useMemo(
  () => buildPlaylistPrompt({
    playlist,
    items,
    edges,
    focusedItemIds: selectedItemIds,
    reuseCandidates,
    userInstructions: instructions,
  }),
  [playlist, items, edges, selectedItemIds, reuseCandidates, instructions],
)

const fullPrompt = promptResult.text
```

A funcao `buildPlaylistPrompt` e implementada em `apps/web/src/lib/playlists/prompt-builder.ts` (secao 6).

### 5.5 Focus Trap e Teclado

- Usa o hook `useFocusTrap` existente em `apps/web/src/app/cms/(authed)/pipeline/_components/use-focus-trap.ts`
- `Escape` fecha o modal via `useEffect` com event listener em `document`
- Focus inicial no textarea via `requestAnimationFrame(() => textareaRef.current?.focus())`
- Click no overlay (backdrop) fecha o modal via `onMouseDown` no elemento externo

```typescript
const dialogRef = useRef<HTMLDivElement>(null)
const textareaRef = useRef<HTMLTextAreaElement>(null)
const handleTrapKeyDown = useFocusTrap(dialogRef)

useEffect(() => {
  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', handleEscape)
  return () => document.removeEventListener('keydown', handleEscape)
}, [onClose])

useEffect(() => {
  requestAnimationFrame(() => textareaRef.current?.focus())
}, [])
```

### 5.6 Copy Handler

```typescript
const handleCopy = useCallback(() => {
  navigator.clipboard.writeText(fullPrompt).then(() => {
    setCopied(true)
  }).catch(() => {
    window.prompt('Copie o prompt abaixo:', fullPrompt)
  })
}, [fullPrompt])
```

### 5.7 Integracao com o Canvas

O modal e aberto pelo botao "Prompt" no toolbar. O estado de abertura vive no componente `PlaylistCanvas`:

```typescript
const [showPromptModal, setShowPromptModal] = useState(false)
```

O canvas ja mantem `selectedItemIds` internamente. Esses IDs sao passados ao modal:

```typescript
{showPromptModal && (
  <PlaylistPromptModal
    playlist={graph.playlist}
    items={graph.items}
    edges={graph.edges}
    selectedItemIds={Array.from(selectedNodeIds)}
    reuseCandidates={reuseCandidates}
    onClose={() => setShowPromptModal(false)}
  />
)}
```

### 5.8 Dependencias

| Dependencia | Origem | Ja existe |
|-------------|--------|-----------|
| `useFocusTrap` | `pipeline/_components/use-focus-trap.ts` | Sim |
| `var(--gem-*)` CSS vars | Design system pipeline | Sim |
| `PlaylistRow` | `@/lib/playlists/types` | Sim |
| `PlaylistItemEnriched` | `@/lib/playlists/types` | Sim |
| `PlaylistEdgeRow` | `@/lib/playlists/types` | Sim |
| `buildPlaylistPrompt` | `@/lib/playlists/prompt-builder` (novo) | Nao |
| `PipelineEditor` | `pipeline/_components/detail/editors/pipeline-editor` | Sim |

---

## 6. Prompt Builder

### Arquivo novo

`apps/web/src/lib/playlists/prompt-builder.ts`

### Interfaces de entrada e saida

```typescript
interface PlaylistPromptInput {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  focusedItemIds: string[]
  reuseCandidates: ReuseCandidateItem[]
  userInstructions: string
}

interface ReuseCandidateItem {
  id: string
  title: string
  format: string
  language: string
  stage: string
  tags: string[]
}

interface PromptResult {
  text: string
  wordCount: number
  tbdCount: number
}
```

### Funcao principal

```typescript
export function buildPlaylistPrompt(input: PlaylistPromptInput): PromptResult
```

### Estrutura do prompt (secoes em ordem)

O prompt gerado segue exatamente esta sequencia:

1. **Header** — Nome da playlist, status, categoria, contagem de items, contagem de edges, aviso de contagem TBD.

2. **Notas & Decisoes do Produtor** — Conteudo do campo `notes` convertido de Tiptap `JSONContent` para markdown. Utiliza um helper `tiptapToMarkdown()` — para v1, uma extracao de texto simples e suficiente. Secao omitida se `notes` for NULL.

3. **Items em Foco** (condicional: `focusedItemIds.length > 0`) — Detalhes expandidos dos items selecionados pelo usuario no graph editor: title, type, language, stage, tags, hook, synopsis.

4. **Grafo Completo (resumo)** — Todos os items como one-liners: `[N] [Type-Lang] "Title" -- Stage`. Items TBD sinalizados com aviso. Edges como lista compacta: `1->2(seq) 2->3(seq)...`. Se a playlist nao tiver edges, a linha de edges e omitida.

5. **Candidatos para Reuso** — Pipeline items que NAO pertencem a esta playlist mas compartilham tags/temas com os items existentes. Listados com title, type, language, tags. Maximo 15 items. Esta secao inclui uma instrucao de destaque para o Cowork priorizar reuso. Secao omitida se 0 resultados — nesse caso, nota inline: "Nenhum candidato encontrado — considere criar novos items."

6. **Regras** — 7 regras fixas:
   - GET first (sempre ler estado atual antes de modificar)
   - Priorizar reuso de items existentes sobre criacao de novos
   - Renomear items TBD com titulos descritivos
   - Verificar notas do produtor antes de sugerir mudancas
   - Usar modos Architect (BUILD, CONNECT, GAP, REORG, CAMPAIGN, COURSE)
   - Auto-layout apos modificacoes estruturais
   - Reportar resultado e sugerir proximos passos

7. **Instrucoes do Produtor** — Conteudo do textarea de instrucoes do usuario, inserido literalmente.

### Logica de candidatos para reuso

- Buscar via `getAvailableContent()` server action (ja existente em `playlists/actions.ts`)
- Filtrar apenas pipeline items (excluir blog posts e newsletters)
- Ordenar por sobreposicao de tags com os items da playlist atual
- Limitar aos 15 candidatos com maior relevancia
- Passar como prop `reuseCandidates` ao modal

### Otimizacao de tamanho para playlists grandes (>30 items)

| Componente | Tamanho estimado |
|---|---|
| Items (one-liner ~50 chars cada) | ~2.2k chars (44 items) |
| Edges (compacto ~12 chars cada) | ~456 chars (38 edges) |
| Secao graph total | ~2.6k chars |
| Notes + instrucoes | ~500-1k chars (controlado pelo usuario) |
| Items em foco | ~200 chars cada, max 10 = ~2k chars |
| Candidatos reuso | ~80 chars cada, max 15 = ~1.2k chars |
| **Total estimado** | **~1.1k palavras (sem selecao) a ~1.5k palavras (com selecao + reuso)** |

O formato one-liner para items e compacto para edges garante que playlists com ate 100+ items permanecem dentro de limites praticos de contexto.

---

## 7. Atualizacao da Referencia Cowork

Dois arquivos de referencia precisam de atualizacao. Apos editar ambos, executar `npm run db:seed:reference` para publicar as mudancas na tabela `reference_content`.

### 7.1 `docs/cowork-playlist-reference.md`

**Mudanca:** Adicionar campo `notes` a documentacao do PATCH `/playlists/:id`.

Payload example a incluir:

```json
{
  "notes": { "type": "doc", "content": [...] }
}
```

Para limpar notas: `"notes": null`.

**Regra de acesso:** Notes sao read-only para o Cowork. O Cowork le o campo `notes` retornado pelo GET `/playlists/:id` para contexto, mas NAO escreve neste campo. Notes sao anotacoes do produtor, acumuladas manualmente no CMS ao longo de multiplas sessoes.

### 7.2 `docs/cowork-playlist-architect-skill.md`

Tres adicoes:

1. **Novo principio PA7:**
   > PA7: "Notes-first: sempre leia playlist.notes (campo do GET /playlists/:id) antes de sugerir mudancas. Contem decisoes acumuladas pelo produtor ao longo de multiplas sessoes."

2. **Regra no modo BUILD:**
   > "Antes de criar novos pipeline items como placeholders (TBD), verifique items existentes com GET /items?search={tema}. O produtor prefere reutilizar items existentes."

3. **Nota no modo GAP:**
   > "Ao listar gaps, considere as notas do produtor — podem conter decisoes que explicam lacunas intencionais."

### 7.3 Publicacao

```bash
npm run db:seed:reference
```

Este comando sincroniza o conteudo dos arquivos `docs/cowork-*.md` com a tabela `reference_content` no banco de dados. O Cowork consome a referencia via DB, nao via arquivos locais.

---

## 8. Casos Limite

| Caso | Comportamento |
|---|---|
| Playlist com 100+ items | Prompt usa one-liners (~50 chars/item). Graph section ~5k chars. Dentro de limites praticos. |
| Notes vazio (NULL) | Secao "Notas" omitida do prompt. Placeholder mostrado no editor. Badge da tab oculto. |
| Nenhum item selecionado | Secao "Items em Foco" omitida. Prompt inclui apenas o grafo completo. |
| Todos os items sao TBD | Warning proeminente no header do prompt. Secao de candidatos para reuso ganha importancia maior. |
| Item ghost (content_type null) | Marcado como "GHOST — content removed" no prompt. Sugerido para remocao. |
| Notes com conteudo muito grande (>2000 palavras) | Truncar notes no prompt para as primeiras 1500 palavras com indicador "...(truncado)". Notes completo sempre disponivel no editor. |
| Edicao concorrente de notes (2 terminais) | Last-write-wins para v1. O debounce de auto-save (2s) reduz risco de conflito. |
| Playlist sem edges | Secao graph mostra apenas items, sem linha de edges. |
| Candidatos para reuso com 0 resultados | Secao "Candidatos para Reuso" omitida. Nota inline no prompt: "Nenhum candidato encontrado — considere criar novos items." |
| Copy falha (clipboard API bloqueada) | Fallback: `window.prompt()` com o texto. |

---

## 9. Arquivos a Criar/Modificar

| Acao | Arquivo | Descricao |
|---|---|---|
| Criar | `supabase/migrations/XXXXXX_playlist_notes.sql` | ADD COLUMN notes jsonb (via `npm run db:new playlist_notes`) |
| Criar | `apps/web/src/lib/playlists/prompt-builder.ts` | Logica de geracao de prompt |
| Criar | `apps/web/src/app/cms/(authed)/playlists/[id]/_components/prompt-generator-modal.tsx` | Modal UI do prompt generator |
| Modificar | `apps/web/src/lib/pipeline/schemas.ts` | Adicionar notes ao PipelineUpdatePlaylistSchema |
| Modificar | `apps/web/src/lib/playlists/types.ts` | Adicionar notes ao PlaylistRow |
| Modificar | `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-settings.tsx` | Adicionar tabs + editor de notas |
| Modificar | `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx` | Adicionar botoes Prompt + Refresh |
| Modificar | `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx` | Conectar modal + passar estado de selecao + carregar reuse candidates |
| Modificar | `apps/web/src/app/cms/(authed)/playlists/actions.ts` | Adicionar server action updatePlaylistNotes |
| Modificar | `docs/cowork-playlist-reference.md` | Adicionar documentacao do campo notes |
| Modificar | `docs/cowork-playlist-architect-skill.md` | Adicionar PA7 + regras de reuso |
