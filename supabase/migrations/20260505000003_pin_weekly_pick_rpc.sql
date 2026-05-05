-- Atomic pin/unpin for weekly pick — avoids race condition between
-- clearing old pin and setting new one.

create or replace function public.pin_weekly_pick(
  p_video_id   uuid,
  p_channel_id uuid,
  p_site_id    uuid,
  p_duration_days int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clear any existing pin for this channel+site (atomic)
  update youtube_videos
     set pinned_until = null,
         updated_at = now()
   where channel_id = p_channel_id
     and site_id = p_site_id
     and pinned_until > now();

  -- Set new pin
  update youtube_videos
     set pinned_until = now() + (p_duration_days || ' days')::interval,
         updated_at = now()
   where id = p_video_id
     and channel_id = p_channel_id
     and site_id = p_site_id;
end;
$$;

create or replace function public.unpin_weekly_pick(
  p_channel_id uuid,
  p_site_id    uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update youtube_videos
     set pinned_until = null,
         updated_at = now()
   where channel_id = p_channel_id
     and site_id = p_site_id
     and pinned_until > now();
end;
$$;
