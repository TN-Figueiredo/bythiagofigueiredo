# Utilities — Search, Context & Stats

## Search

`GET /api/pipeline/search?q={query}` — cross-entity search across pipeline items, blog posts, and newsletters.

Query params: `q` (search term), `type` (item|post|newsletter), `limit` (default 20, max 100).

## Context (References)

`GET /api/pipeline/context` — get all reference content.

Filters: `?group={group}`, `?skill={skill}`, `?format=md`.

`PUT /api/pipeline/context/:key` — upsert reference doc.

`DELETE /api/pipeline/context/:key` — delete reference doc.

## Stats

`GET /api/pipeline/stats` — aggregate pipeline statistics (total items by format/stage/priority, 7-day activity).

## Topics

`GET /api/pipeline/topics/:code` — topic aggregation showing pipeline items and blog posts for a given tag/topic.

## Workflows

`GET /api/pipeline/workflows` — get all workflow definitions and default checklists per format.
