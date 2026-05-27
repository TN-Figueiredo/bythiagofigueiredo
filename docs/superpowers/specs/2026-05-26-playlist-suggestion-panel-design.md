# Playlist Suggestion Panel — Design Spec

## Goal

Replace the flat search picker as the primary way to fill weekly slots with a persistent, playlist-aware suggestion panel that shows what's available to schedule, organized by playlist. The user sees their playlists, picks an item, then picks a slot — a "reverse picker" flow that gives visual context before committing.

## Architecture

**Collapsible bottom drawer** below the weekly grid. Shows playlist groups as interactive strips. Click an item → compatible empty slots highlight in the grid → click a slot → item assigned. The existing WeekSlotPicker (search) remains as fallback inside each slot.

**Pure ranking function** (`suggestForSlot`) sorts candidates by deadline urgency → stage progression → priority → playlist round-robin. No auto-assignment — suggestions only.

**Data change**: extend `SlotCandidate` with 4 optional playlist fields already available in `PipelineItemWithSlot`. No new DB queries.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Layout | Collapsible bottom drawer | Natural reading flow, no z-index issues, mobile-friendly |
| Ranking | Deadline-driven + round-robin | Reuses existing urgency logic, ensures playlist diversity |
| Interaction | Click-to-assign (item → slot) | Drag-and-drop conflicts with horizontal scroll |

## Data Layer

### SlotCandidate extension

Add optional playlist fields to `SlotCandidate`:

```ts
export type SlotCandidate = Pick<PipelineItemWithSlot,
  'id' | 'title' | 'stage' | 'format' | 'language'
  | 'playlist_id' | 'playlist_name' | 'playlist_position' | 'playlist_total'
>
```

### Fetcher change (line 218)

Include the 4 new fields in the `.map()`:

```ts
candidates: pipelineItems.map(({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }) =>
  ({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }))
```

### suggestForSlot — pure function

```ts
interface SlotSuggestion {
  candidate: SlotCandidate
  reason: 'deadline' | 'progressed' | 'playlist_rotation' | 'backlog'
  reasonLabel: string
}

function suggestForSlot(
  slot: WeekSlot,
  candidates: SlotCandidate[],
  weekSlots: WeekSlot[],
  maxSuggestions?: number,
): SlotSuggestion[]
```

**Algorithm:**
1. Filter: format match + language/locale compat + stage < 'scheduled'
2. Exclude items already assigned to any slot this week
3. Score: urgency (overdue=100, today=80, tomorrow=60, this_week=40) + stage depth (idea=0 … ready=70) + priority (0-10) - playlist penalty (if playlist already has item this week, -30)
4. Sort descending by score
5. Return top N with reason tag

### groupCandidatesByPlaylist — pure function

```ts
interface PlaylistGroup {
  playlistId: string | null
  playlistName: string
  items: SlotCandidate[]
  progress: { done: number; total: number }
  nearCompletion: boolean
}

function groupCandidatesByPlaylist(candidates: SlotCandidate[]): PlaylistGroup[]
```

Groups by `playlist_id`. Items without playlist go in "Avulsos" group. Sorted: near-completion playlists first, then by total items descending.

## UI Components

### PlaylistSuggestionPanel

New component: `apps/web/src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel.tsx`

**Props:**
```ts
interface PlaylistSuggestionPanelProps {
  candidates: SlotCandidate[]
  weekSlots: WeekSlot[]
  onSelectItem: (candidate: SlotCandidate) => void
  selectedItem: SlotCandidate | null
  collapsed: boolean
  onToggleCollapse: () => void
}
```

**Visual structure:**
- Header: "Sugestões por Playlist" + collapse toggle (chevron)
- Collapsed: shows just header + badge with total available items count
- Expanded: horizontal scrollable list of playlist groups
- Each group: playlist name + progress bar + list of item chips
- Item chips: colored by format (FORMAT_COLORS), show title (truncated) + stage badge
- Selected item gets ring highlight
- Near-completion playlists get a "quase!" badge

**Sizing:**
- Max height: 200px expanded
- Item chips: min-h-[44px] for touch targets
- Playlist groups: min-w-[180px], separated by vertical dividers

### UpNextThisWeek modifications

When `selectedItem` is non-null (user picked from panel):
- Compatible empty slots get a pulsing border (accent color, `animate-pulse` on border only)
- Click handler on highlighted slots calls `onAssignSlot(selectedItem.id, slot.day, slot.hour)` directly
- Incompatible slots (wrong format/language) remain dimmed
- ESC key or click on panel item again clears selection

### PipelineOverview orchestration

New state: `const [selectedCandidate, setSelectedCandidate] = useState<SlotCandidate | null>(null)`
New state: `const [panelCollapsed, setPanelCollapsed] = useState(false)`

Wire:
- Panel `onSelectItem` → `setSelectedCandidate`
- Grid receives `selectedItem` prop
- On slot click when selectedItem exists → call `handleAssignSlot` → clear `selectedCandidate`

## Accessibility

- Panel: `role="region"` with `aria-label="Sugestões de conteúdo por playlist"`
- Collapse toggle: `aria-expanded`, `aria-controls`
- Item chips: `role="button"`, `aria-pressed` when selected
- Grid highlight: `aria-description="Slot compatível — clique para atribuir"` on compatible slots
- Screen reader announcement on item select: "Item X selecionado. Clique em um slot compatível."

## Testing Strategy

- **Pure functions** (suggestForSlot, groupCandidatesByPlaylist): unit tests with factories, cover ranking, filtering, round-robin, edge cases
- **PlaylistSuggestionPanel**: render tests with mocked data, click interactions, collapse toggle
- **Integration**: pipeline-overview test verifying panel → grid → assignment flow
- **Existing tests**: update SlotCandidate factories to include playlist fields

## Files

| Action | Path |
|--------|------|
| Create | `src/lib/pipeline/suggest-for-slots.ts` |
| Create | `src/app/cms/(authed)/pipeline/_components/playlist-suggestion-panel.tsx` |
| Modify | `src/lib/pipeline/up-next-types.ts` (extend SlotCandidate) |
| Modify | `src/lib/pipeline/up-next-fetcher.ts` (include playlist fields) |
| Modify | `src/app/cms/(authed)/pipeline/_components/pipeline-overview.tsx` (orchestration) |
| Modify | `src/app/cms/(authed)/pipeline/_components/up-next-this-week.tsx` (highlight mode) |
| Create | `test/lib/pipeline/suggest-for-slots.test.ts` |
| Create | `test/cms/playlist-suggestion-panel.test.tsx` |
| Modify | `test/cms/pipeline-overview.test.tsx` (add panel tests) |
| Modify | `test/cms/use-slot-assignment.test.ts` (update factories) |
