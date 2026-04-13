# Design: Roadmap Structure for bythiagofigueiredo

**Date:** 2026-04-13
**Status:** Approved (rev 2)
**Author:** Thiago Figueiredo (w/ Claude)

## Changelog

- **rev 2 (2026-04-13):** after critical self-review — reconciled sprint hour math (epics now sum to sprint budget in all 12 sprints), added per-phase exit criteria, linked risks to source-doc IDs (R1–R9), clarified estimates as non-commitments, separated cross-project TNG work from this roadmap, added packages rollup, corrected global progress (~2% not ~5%), added critical-path concrete sequence.
- **rev 1 (2026-04-13):** initial structure approved.

## Context

bythiagofigueiredo is the Hub Central + CMS Engine of the @tnf/* ecosystem. The project was scaffolded from `tnf-scaffold` and needs a living roadmap to plan and track ~414h of work across 11 sprints / 19 weeks (MVP + N2H + CMS Hub phases).

Source of truth for content: `~/Workspace/ideias/bythiagofigueiredo/` (idea-validator, code-library, roadmap-creator, marketing-partner, delegation-planner docs, dated 2026-04-12).

## Goals

1. Single place inside the repo to see **what** is planned, **when**, and **current status**
2. Granular enough to evolve as scope changes (solo dev, months of work ahead)
3. Integrates with the `superpowers` workflow: each milestone gets its own `spec → plan → implementation` cycle when it's time to build
4. Low overhead — no external tracking tools; everything versioned in git

## Non-Goals

- Tracking individual tasks (use TodoWrite / ad-hoc during sprints)
- Replacing GitHub Issues if the project ever needs them later
- Capturing every detail from the idea docs (those stay as source; roadmap is the execution view)

## Design

### Directory layout

```
docs/
├── roadmap/
│   ├── README.md                    # overview, legend, progress
│   ├── phase-1-mvp.md               # sprints 0–5 (192h)
│   ├── phase-2-nice-to-have.md      # sprints 6–9 (152h)
│   └── phase-3-cms-hub.md           # sprints 10–11 (70h)
└── superpowers/
    ├── specs/                       # design docs (brainstorming output)
    └── plans/                       # implementation plans (writing-plans output)
```

### Status convention

```
☐ not-started   🟡 in-progress   ✅ done   ⏸ blocked   ❌ cancelled
```

Used at three levels: phase, sprint, epic.

### Anatomy of a phase file

1. **Header:** name, total hours, sprint range, status, cross-phase dependencies
2. **Sprints:** `## Sprint N — Name [status] (Xh)`
   - Goal (one line)
   - Epics (checkbox list with per-epic status)
   - Deliverables
   - Upstream dependencies
   - **Spec / Plan links** (filled when the sprint is brainstormed)
3. **Risks & notes** at the end (phase-specific)

### Anatomy of `docs/roadmap/README.md`

- Macro table of 3 phases with hours + status
- Global progress (X / 414h)
- Active sprint callout
- Status legend
- Links to each phase file
- "How to use" pointing to the superpowers flow: brainstorm → spec → plan → execute

### Workflow integration

When a sprint is about to start:

1. `superpowers:brainstorming` → design doc in `docs/superpowers/specs/YYYY-MM-DD-<sprint-topic>-design.md`
2. `superpowers:writing-plans` → implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<sprint-topic>-plan.md`
3. `superpowers:executing-plans` (or subagent-driven-development) → build
4. Back to the roadmap file: add links, flip status to 🟡, then ✅

### Initial status

- **Sprint 0 (scaffold setup):** ✅ done — tnf-scaffold already produced the monorepo skeleton, CI, Husky, @tnf/* pinned deps, Supabase migrations dir. Homepage hub UI (hero, sections, navbar, footer) also partially built.
- **Everything else:** ☐ not-started

### Content sourcing

Data extracted from:
- `01-idea-validator.md` — vision, CMS Hub phasing
- `02-code-library.md` — reuse economy (58.25h saved, 9 @tnf/* packages)
- `03-roadmap-creator.md` — sprints, epics, hours, risks, critical path (authoritative)

Roadmap files reference (don't duplicate) these docs for deep rationale.

## Alternatives Considered

- **Single `ROADMAP.md`** — rejected: too long to scan, hard to evolve per phase
- **GitHub Issues/Milestones** — rejected: solo dev, overhead > value; markdown in git is enough
- **Status + auto-linked specs/plans** — rejected: automation is brittle; manual links on creation (10s each) are simpler

## Risks

- **Drift between roadmap and reality** — mitigated by making status updates part of sprint close
- **Content duplication with idea docs** — mitigated by referencing, not copying, rationale

## Generated Artifacts

This design materialized in:

- `docs/roadmap/README.md` — overview, progress, packages, review cadence, changelog
- `docs/roadmap/phase-1-mvp.md` — sprints 0–5 (202h)
- `docs/roadmap/phase-2-nice-to-have.md` — sprints 6–9 (152h)
- `docs/roadmap/phase-3-cms-hub.md` — sprints 10–11 (70h)

## Open Questions

None (user approved design on 2026-04-13).
