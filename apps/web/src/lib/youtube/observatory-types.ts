/**
 * YouTube CMS — Observatory (Competitor Dashboard) View Types
 *
 * All `View` suffixed interfaces are frontend-only (serialized from server to client).
 * Existing DB shapes are in ab-types.ts / types.ts — not redefined here.
 */

/** Competitor channel card — enriched for the redesigned obs-grid. */
export interface CompetitorChannelView {
  id: string
  channelId: string
  channelName: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number
  addedAt: string
  lastSyncedAt: string | null
  /** Average engagement rate across last 10 videos (likes+comments / views). */
  avgEngagement: number | null
  /** Subscriber delta over last 30 days. Positive = growth. */
  growthDelta: number | null
  /** 30-point sparkline for subscriber growth (daily). */
  growthSparkline: number[]
  /** All tracked videos (most recent first). Card shelf shows 3; drawer shows all. */
  recentVideos: CompetitorVideoView[]
  /** vs-you comparison — one entry per own channel, null if no data. */
  vsYou: VsYouEntry[] | null
  /** Unread change flags since last visit. */
  changeFlags: ChangeFlag[]
  // --- Full sync fields ---
  syncMode: 'recent' | 'full'
  syncStatus: 'idle' | 'syncing' | 'error'
  syncProgress: number
  syncError: string | null
  youtubeVideoCount: number | null
  fullSyncCompletedAt: string | null
}

/** Competitor video as rendered in shelf, drawer, and modal. */
export interface CompetitorVideoView {
  id: string
  videoId: string
  title: string | null
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string | null
  durationSeconds: number | null
  /** View count delta since first tracked (growth indicator). */
  viewDelta: number | null
  /** Outlier multiplier vs channel median — null if not an outlier. */
  outlierMultiplier: number | null
  /** Tier derived from outlierMultiplier: mid (2-5x), high (5-10x), top (>10x). */
  outlierTier: 'mid' | 'high' | 'top' | null
}

/** A detected change (title/thumbnail/description) on a competitor video. */
export interface CompetitorChangeView {
  id: string
  videoId: string
  videoTitle: string | null
  channelName: string
  channelThumbnailUrl: string | null
  changeType: 'title' | 'description' | 'thumbnail'
  oldTitle: string | null
  newTitle: string | null
  oldThumbnailUrl: string | null
  newThumbnailUrl: string | null
  viewCountAtChange: number | null
  detectedAt: string
  bookmarked: boolean
  /** Full change history for this video (expanded via history-toggle). */
  history: CompetitorChangeView[]
}

/** Outlier card for the Outliers sub-tab grid. */
export interface CompetitorOutlierView {
  id: string
  videoId: string
  title: string | null
  thumbnailUrl: string | null
  channelName: string
  channelThumbnailUrl: string | null
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number | null
  publishedAt: string | null
  /** How many times above the channel median view count. */
  multiplier: number
  /** Visual tier: mid=#60A5FA (2-5x), high=#A78BFA (5-10x), top=#D9614A (>10x). */
  tier: 'mid' | 'high' | 'top'
}

/** Insights tab — aggregated intelligence across all tracked competitors. */
export interface CompetitorInsights {
  /** 7x24 matrix: rows = days (mon-sun), cols = hours (0-23). Values = avg views. */
  heatmap: number[][]
  /** Top-performing tags across competitor videos, sorted by frequency. */
  tags: CompetitorTagStat[]
  /** Engagement comparison: their channels vs ours. */
  engagement: CompetitorEngagementStat[]
  /** Content gaps: topics competitors cover that we don't. */
  gaps: CompetitorGap[]
  /** 7x24 matrix: rows = days (mon-sun), cols = hours (0-23). Values = hit count (outlier videos published). */
  hitsHeatmap: number[][]
  /** Upload cadence breakdown per competitor channel. */
  cadence: CadenceChannel[]
  /** Title formula patterns extracted from top-performing competitor videos. */
  formulas: TitleFormula[]
  /** The single highest-leverage play of the week, or null if insufficient data. */
  play: PlayOfTheWeek | null
  ownTagsByChannel: OwnChannelTags[]
  competitorTagsByChannel: CompetitorTagsByChannel[]
}

export interface OwnChannelTags {
  channelName: string
  tags: string[]
}

export interface CompetitorTagStat {
  tag: string
  /** Number of competitor videos using this tag. */
  count: number
  /** Average view count of videos with this tag. */
  avgViews: number
}

export interface CompetitorEngagementStat {
  channelName: string
  channelThumbnailUrl: string | null
  /** Engagement rate = (likes + comments) / views. */
  engagementRate: number
  /** True when this entry represents our own channel (highlighted in UI). */
  isUs: boolean
}

export interface CompetitorGap {
  topic: string
  competitorCount: number
  avgViews: number
  weCover: boolean
  channelNames: string[]
}

export interface CompetitorTagsByChannel {
  channelName: string
  tags: string[]
}

/** Side-by-side comparison pill between a competitor and our channel. */
export interface VsYouComparison {
  /** Subscriber difference (positive = they have more). */
  subsDelta: number
  /** Engagement rate difference (positive = they outperform us). */
  engagementDelta: number
  /** Average views difference (positive = they outperform us). */
  avgViewsDelta: number
  /** Upload frequency difference in videos/month (positive = they post more). */
  frequencyDelta: number
}

/** VsYou entry for multi-channel comparison (one per own channel). */
export interface VsYouEntry extends VsYouComparison {
  /** Own channel display name. */
  channelName: string
  /** Own channel DB id. */
  channelId: string
}

/** Badge indicating recent activity on a competitor channel. */
export interface ChangeFlag {
  type: 'title' | 'description' | 'thumbnail'
  /** Number of changes of this type since last visit. */
  count: number
  /** Most recent change timestamp. */
  latestAt: string
}

/** Stats displayed in the Channel Drawer (cd-stats grid). */
export interface ChannelStats {
  totalViews: number
  avgViewsPerVideo: number
  uploadFrequency: number
  /** Average engagement rate across all tracked videos. */
  engagementRate: number
  /** Days since last upload. */
  daysSinceLastUpload: number
}

/** Our channel's stats for vs-you comparisons. */
export interface OurChannelStats {
  subscriberCount: number
  avgViews: number
  engagementRate: number
  /** Videos per month. */
  uploadFrequency: number
}

/** Upload cadence data for a single competitor channel. */
export interface CadenceChannel {
  channelName: string
  channelId: string
  color: string
  /** Average uploads per week over the cadence window. */
  freq: number
  /** Human-readable window label (e.g. "last 90 days"). */
  window: string
  videos: CadenceVideo[]
  /** Days since the channel's most recent upload. */
  lastUploadDays: number
}

/** Lightweight video entry used inside CadenceChannel. */
export interface CadenceVideo {
  title: string
  viewCount: number
  publishedAt: string
}

/** A title formula pattern extracted from top-performing competitor videos. */
export interface TitleFormula {
  /** Human-readable pattern label (e.g. "How to X in Y"). */
  label: string
  /** Average view multiplier vs channel median for videos matching this formula. */
  multiplier: number
  /** Short copywriting tip for applying this formula. */
  hint: string
  /** Number of competitor videos matching this formula. */
  count: number
  /** A representative title from the matched videos. */
  exampleTitle: string
}

/** The single highest-leverage content play recommended for the current week. */
export interface PlayOfTheWeek {
  /** Topic to cover, bolded in UI. */
  topicBold: string
  /** Title formula to use, bolded in UI. */
  formulaBold: string
  /** View multiplier of the recommended formula. */
  formulaMult: number
  /** Optimal publish window, bolded in UI (e.g. "Tuesday 18h"). */
  windowBold: string
  /** One-sentence explanation for why this window was chosen. */
  windowReason: string
}

/** Props for the top-level CompetitorDashboard component. */
export interface CompetitorDashboardProps {
  channels: CompetitorChannelView[]
  changes: CompetitorChangeView[]
  outliers: CompetitorOutlierView[]
  insights: CompetitorInsights
  ourStats: OurChannelStats
  /** Max channels allowed by plan (for counter pill "12/15 canais"). */
  maxChannels: number
}
