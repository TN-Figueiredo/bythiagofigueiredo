# @tn-figueiredo/cms

Reusable Next.js + Supabase CMS with MDX compile-on-save — the `@tn-figueiredo` ecosystem.

## Install

This package is published to **GitHub Packages** under the `@tn-figueiredo` scope.

Create/extend `.npmrc` at your project root:

```ini
@tn-figueiredo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Export a `NPM_TOKEN` with `read:packages` scope (GitHub PAT), then:

```bash
npm install @tn-figueiredo/cms --save-exact
```

> The `@tn-figueiredo` ecosystem pins **exact** versions (no `^`/`~`) across apps. Peer deps keep ranges by npm convention.

## Next.js configuration

This package ships ESM with `import.meta.url` (used by the MDX runtime) and preserved JSX. Next.js consumers must add:

~~~ts
// next.config.ts
export default {
  transpilePackages: ['@tn-figueiredo/cms'],
}
~~~

This is a permanent requirement of v0.1.x. A future major may eliminate it by refactoring the MDX renderer.

## Peer dependencies

| Package                   | Range    |
| ------------------------- | -------- |
| `react`                   | `^19.0.0` |
| `react-dom`               | `^19.0.0` |
| `@supabase/supabase-js`   | `^2.103.0` |

Optional: `@shikijs/rehype@3.0.0` — only required if you import `@tn-figueiredo/cms/code`.

Node: `>=20`.

## Exports

| Entry                        | Contents                                               |
| ---------------------------- | ------------------------------------------------------ |
| `@tn-figueiredo/cms`         | Types, interfaces, Supabase repos, MDX pipeline, editor, i18n, `log` |
| `@tn-figueiredo/cms/code`    | Opt-in `ShikiCodeBlock` (lazy, requires `@shikijs/rehype`) |

## Quick start

```tsx
import { PostEditor } from '@tn-figueiredo/cms'

export default function EditPostPage({ post }) {
  return (
    <PostEditor
      initialContent={post.content_mdx}
      locale="pt-BR"
      componentNames={['Callout', 'Figure']}
      onSave={savePostAction}
      onPreview={compilePreviewAction}
      onUpload={uploadAssetAction}
    />
  )
}
```

Repository + MDX:

```ts
import { SupabasePostRepository, compileMdx, MdxRunner } from '@tn-figueiredo/cms'

const repo = new SupabasePostRepository(supabaseClient)
const posts = await repo.list({ siteId, locale: 'pt-BR', status: 'published' })

const compiled = await compileMdx(source)
// Persist `compiled.compiledSource` in `blog_posts.content_compiled`.
```

## MDX strategy

Compile on save (`compileMdx()` → `content_compiled text` column). Render time uses `MdxRunner` which calls `@mdx-js/mdx` `run()` against the pre-compiled source. Public pages can fall back to runtime compile when `content_compiled IS NULL` (legacy rows).

## Multi-ring

`SupabaseRingContext.getSiteByDomain(host)` resolves requests against `sites.domains text[]`. Cross-site admin authority cascades via the `can_admin_site()` RPC (master-ring staff can admin child rings).

## Debug logs

Namespaced [debug](https://www.npmjs.com/package/debug) loggers:

```bash
DEBUG=tn-figueiredo:cms:* node ./server.js
```

Available namespaces: `editor`, `repo`, `mdx`, `ring`.

## Versioning

The `@tn-figueiredo` ecosystem pins exact versions across apps. See the ecosystem versioning policy: <https://github.com/TN-Figueiredo/bythiagofigueiredo/blob/main/docs/ecosystem.md>.

## License

MIT © 2026 Thiago Figueiredo. See [LICENSE](./LICENSE).
