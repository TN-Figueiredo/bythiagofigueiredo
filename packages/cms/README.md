# @tn-figueiredo/cms

Reusable CMS for the TN-Figueiredo conglomerate. Provides generic content repository interfaces, Supabase implementations, MDX compilation pipeline, and React editor components.

## Install

```bash
npm install @tn-figueiredo/cms --save-exact
```

Peer deps: `react@^19`, `react-dom@^19`, `@supabase/supabase-js@^2.45`.

## Usage

```ts
import {
  SupabasePostRepository,
  SupabaseRingContext,
  compileMdx,
  MdxRunner,
  defaultComponents,
  PostEditor,
} from '@tn-figueiredo/cms'

// Opt-in shiki syntax highlighting
import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'
```

### Repository

```ts
const repo = new SupabasePostRepository(supabaseClient)
const posts = await repo.list({ siteId, locale: 'pt-BR', status: 'published' })
```

### MDX compilation (on save)

```ts
const compiled = await compileMdx(source, { ...defaultComponents })
// Store compiled.compiledSource in DB, render via <MdxRunner />
```

### Editor

```tsx
<PostEditor
  initialContent={post.content_mdx}
  locale="pt-BR"
  componentNames={Object.keys(blogRegistry)}
  onSave={savePostAction}
  onPreview={compilePreviewAction}
  onUpload={uploadAssetAction}
/>
```

## Architecture

- **Interfaces** (`IContentRepository<T>`, `IPostRepository`, `IRingContext`, `IContentRenderer`) — contracts consumers depend on.
- **Supabase impls** — ready-to-use Supabase-backed repositories.
- **MDX pipeline** — `@mdx-js/mdx` compile-on-save + `run()` at render time. `compileMdx()` extracts TOC + reading time.
- **Editor** — textarea + toolbar + live preview. Framework-agnostic callbacks (`onSave`, `onPreview`, `onUpload`).
- **i18n** — editor strings in pt-BR (default) and en. Extensible via `getEditorStrings(locale)`.

## Multi-ring ("One Ring")

This package powers `bythiagofigueiredo.com` (master ring) and other sites in the conglomerate. Each site scopes content by `site_id`. Master ring staff can administer child-ring sites via `can_admin_site()` cascade-up logic.

## License

Internal. See LICENSE.
