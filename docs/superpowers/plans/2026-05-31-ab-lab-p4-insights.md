# AB Lab P4: Insights + Learnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect CTR fatigue automatically and transform test results into channel-level learnings.

**Architecture:** Log-linear regression on daily CTR data detects fatigue (z-score < -1.5). Runs daily in sync-analytics-metrics. Learnings grouped by channel when 2+ channels have tests.

**Tech Stack:** Pure math (OLS regression, Wilson score), Supabase PostgreSQL, Vitest.

**Already done:** Learnings panel UI + `getLearnings()` query — fully functional with 3+ completed tests.

---

## Tasks

| Task | Feature | Independent? |
|------|---------|-------------|
| 1 | Migration (youtube_fatigue_alerts) | Yes |
| 2 | Fatigue detection algorithm (pure math) | Yes |
| 3 | Per-channel learnings (extend getLearnings) | Yes |
| 4 | Fatigue cron integration | Needs 1, 2 |
| 5 | Fatigue UI (badges + "Needs Attention") | Needs 1 |
| 6 | Integration + tests + push | Needs all |

**All of Tasks 1, 2, 3 are independent — max parallelism.**
