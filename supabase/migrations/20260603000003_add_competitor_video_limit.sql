-- Per-channel video display limit (default 50, max 200)
alter table competitor_channels
  add column if not exists video_limit smallint not null default 50;
