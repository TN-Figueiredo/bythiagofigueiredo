export interface YtAnalyticsReport {
  columnHeaders: { name: string; columnType: string; dataType: string }[]
  rows: (string | number)[][]
}

export interface YtChannelMetrics {
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
  averageViewPercentage: number
  subscribersGained: number
  subscribersLost: number
  impressions: number
  impressionClickThroughRate: number
  likes: number
  comments: number
  shares: number
}

export interface YtVideoGrade {
  videoId: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  views7d: number
  ctr: number
  avgPercentage: number
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
}

export interface YtSearchTerm {
  term: string
  views: number
  estimatedMinutesWatched: number
}

export interface YtDemographics {
  ageGender: { ageGroup: string; male: number; female: number }[]
  countries: { country: string; views: number; percentage: number }[]
  devices: { deviceType: string; views: number; percentage: number }[]
}

export interface YtHealthScore {
  overall: number
  ctr: { value: number; grade: string }
  retention: { value: number; grade: string }
  growth: { value: number; grade: string }
  engagement: { value: number; grade: string }
  frequency: { value: number; grade: string }
}

export interface YtDailyMetric {
  date: string
  views: number
  estimatedMinutesWatched: number
  subscribersGained: number
  subscribersLost: number
  impressions: number
  impressionClickThroughRate: number
  likes: number
  comments: number
  shares: number
}
