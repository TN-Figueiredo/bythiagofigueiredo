CREATE TABLE cron_health (
  cron_name text PRIMARY KEY,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'info')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cron_health IS 'Heartbeat table for all system crons. Written on success and failure.';
