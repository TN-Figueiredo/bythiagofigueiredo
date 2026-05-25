# CMS Nav Redesign — Phase 2: URL Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align CMS URLs with the new nav structure using Next.js rewrites + redirects. No file moves — rewrites map new URLs to existing route files, redirects forward old URLs.

**Architecture:** Rewrites make new URLs render existing pages. Redirects (308) send old URL traffic to new URLs. Internal links, revalidatePath calls, and badge paths updated to reference new URLs.

**Tech Stack:** Next.js 15 rewrites/redirects, Vitest

---

## URL Migration Map

| Old URL | New URL | Mechanism |
|---------|---------|-----------|
| `/cms/pipeline` | `/cms/up-next` | rewrite + redirect |
| `/cms/pipeline/video` | `/cms/video` | rewrite + redirect |
| `/cms/pipeline/course` | `/cms/courses` | rewrite + redirect |
| `/cms/pipeline/research` | `/cms/library/research` | rewrite + redirect |
| `/cms/pipeline/reference` | `/cms/library/reference` | rewrite + redirect |
| `/cms/pipeline/audio` | `/cms/library/audio` | rewrite + redirect |
| `/cms/linktree` | `/cms/link-in-bio` | rewrite + redirect |

**NOT changed:** `/cms/pipeline/items/[id]`, `/cms/pipeline/[format]` (other formats), `/cms/pipeline/list`, `/cms/pipeline/topics/[code]`, `/cms/pipeline/brolls`, `/api/pipeline/*`

---

## Task Dependency Graph

```
Task 1 (next.config.ts)   ─┐
Task 2 (cms-sections.ts)  ─┤
Task 3 (revalidatePath)   ─┼── Task 6 (verification)
Task 4 (internal links)   ─┤
Task 5 (test files)        ─┘
```

All 5 tasks are independent and can run in parallel.
