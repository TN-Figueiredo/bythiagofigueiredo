# Instagram OAuth — entrega de 2026-09-06

Movido do `CLAUDE.md` em 2026-10-09.

Oito commits sequenciais em `staging`, nesta ordem: **A → A4 → A5 → B → C1 → C2 → C4 → C3**
(A5 tem dois corpos possíveis, decididos pelo gate de herança de `maxDuration` depois de A).
Rollback obrigatoriamente na ordem inversa **C3 → C4 → C2 → C1 → B → A5 → A4 → A**.

- **Depois de promover C2:** `curl -fsS -H "Authorization: Bearer $CRON_SECRET"` nos **dois** crons
  (`/api/cron/instagram-token-refresh` **e** `/api/cron/instagram-sync`) **no mesmo minuto** — os dois
  mudam de agenda (`"0 11 * * *"` e `"0 13 * * *"`) e sem isso o `/api/health` fica `degraded` por
  ~12 h e o watchdog pagina ~1×/h.
- **Rollback de C2 = `git revert` + passo de banco obrigatório** (zerar `access_token like 'v1:%'`,
  `ig_user_id_source='legacy'`, `ig_professional_id=null` e limpar as chaves de `ops_alert_state`).
  "Só reverter o deploy" está **proibido** para C2. Detalhe em
  `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` §7.
- **C3** acrescenta as rotas `/api/instagram/oauth`, `/api/instagram/oauth/callback`,
  `/api/instagram/deauthorize`, `/api/instagram/data-deletion` e a página pública `/data-deletion`.
  Runbook: `docs/ops/instagram-token-alert-runbook.md`.

