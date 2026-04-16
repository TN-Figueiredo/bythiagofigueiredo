# package-repo template — SETUP

Blueprints for the one-time setup of each extracted repo (`TN-Figueiredo/cms`, `TN-Figueiredo/email`) before their first GitHub Packages publish.

## 1. Copy into extracted repo

After splitting monorepo history with `git subtree`:

```bash
# from monorepo root
git subtree split --prefix=packages/cms -b split/cms
# create empty GH repo TN-Figueiredo/cms first via `gh repo create`
git clone git@github.com:TN-Figueiredo/cms.git ../cms
cd ../cms
git pull /path/to/bythiagofigueiredo split/cms

# copy template files
cp -R /path/to/bythiagofigueiredo/docs/superpowers/templates/package-repo/.github .
cp /path/to/bythiagofigueiredo/docs/superpowers/templates/package-repo/.gitignore .
cp -R /path/to/bythiagofigueiredo/docs/superpowers/templates/package-repo/test/consumer-smoke ./test/
# strip the template NOTE comment from both workflows
sed -i '' '/^# Template — adapt/d' .github/workflows/*.yml
```

Repeat for `email`.

## 2. Replace placeholders

- `test/consumer-smoke/app/page.tsx` — swap `PKG_NAME` → `cms` or `email`; uncomment import and reference a real export (e.g. `SupabasePostRepository` for cms, `BrevoTransport` for email).
- `test/consumer-smoke/package.json` — remove the `comments` block if desired.
- Root `README.md` of the extracted repo — add CI badge pointing to its workflow runs, install instructions with `.npmrc` for GH Packages auth.
- Root `package.json` — add `"smoke": "npm pack && cd test/consumer-smoke && npm install ../../*.tgz --no-save && npm install && npm run build"` to `scripts`.

## 3. Branch protection

```bash
gh api repos/TN-Figueiredo/cms/branches/main/protection \
  --method PUT \
  --input protection.json
```

Sample `protection.json`:

```json
{
  "required_status_checks": {"strict": true, "contexts": ["test"]},
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

The `test` context name matches the CI job name. If the matrix job name resolves differently in GH Checks (e.g. `Test (node 20, supabase 2.103.0)`), update `contexts` accordingly after the first PR CI run reveals the exact check names.

## 4. First publish sequence

The default `GITHUB_TOKEN` already carries `write:packages` when the workflow declares `permissions: packages: write` — no PAT setup needed for publish (install still needs a consumer-side `.npmrc` token with `read:packages`).

```bash
# commit template
git add .github .gitignore test/consumer-smoke SETUP.md
git commit -m "chore: initial repo scaffolding from package-repo template"
git push origin main

# tag + publish
# cms (beta first):
git tag v0.1.0-beta.1 && git push origin v0.1.0-beta.1
# email:
git tag v0.1.0 && git push origin v0.1.0
```

`publish.yml` fires on tag push: build → test gate → idempotent publish to `npm.pkg.github.com` with provenance → auto-generate GH release notes.

## 5. Rollback

GitHub Packages allows npm unpublish within 72h of publish, but **only via the web UI** (CLI `npm unpublish` is not supported):

1. Go to `https://github.com/TN-Figueiredo/<repo>/pkgs/npm/<pkg>`
2. Package settings → Manage versions → Delete version
3. Bump patch version + re-tag + push to publish fixed release

Never delete a version consumers already installed in lockfiles outside the 72h window — publish a `-deprecated` successor instead.

## 6. Assumptions baked into the template

- **Node 20** pinned in matrix (ecosystem standard per monorepo CLAUDE.md).
- **Supabase matrix**: `2.103.0` (current pinned) + `latest` to catch early regressions.
- **Tarball budget: 512KB** — cms is ~200KB today; email will be smaller. Bump if MDX/shiki assets push cms past threshold.
- **Access: restricted** via `publishConfig` in each repo's `package.json` (not set here — belongs in the package manifest).
- **OIDC provenance** enabled — requires `id-token: write` (present in publish.yml).
