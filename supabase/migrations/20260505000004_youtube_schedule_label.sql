ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS schedule_label text;
COMMENT ON COLUMN youtube_channels.schedule_label IS
  'Manual override for schedule text on public site. NULL = auto-derive from sync_schedules.';
