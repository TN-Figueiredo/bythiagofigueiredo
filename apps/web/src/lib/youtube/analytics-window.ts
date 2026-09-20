// The Analytics API omits any video row with zero activity in the requested window — a
// tight window under-reports on low-volume channels even when the request itself succeeds
// (this is exactly how youtube_video_analytics stayed empty in production while the cron
// reported errors:0 every day). 90 days trades a slightly heavier request for actually
// backfilling history. Configurable so it can be widened further without a code change.
//
// Rolling window, in days, that the analytics sync writes and the intelligence snapshot reads.
//
// It lives here, not in the cron route, because two consumers need the same number and a
// route module must not be imported for a constant. Every row of youtube_video_analytics is
// the TOTAL over this window as of its `date`, not that day's count.
export const SYNC_WINDOW_DAYS = Number(process.env.YT_ANALYTICS_SYNC_WINDOW_DAYS ?? '90')
