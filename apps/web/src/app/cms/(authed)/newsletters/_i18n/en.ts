import type { NewsletterHubStrings } from './types'

export const en: NewsletterHubStrings = {
  tabs: { overview: 'Overview', editorial: 'Editorial', schedule: 'Schedule', automations: 'Automations', audience: 'Audience' },
  kpi: { totalSubscribers: 'Total Subscribers', editionsSent: 'Editions Sent', avgOpenRate: 'Avg Open Rate', avgClickRate: 'Avg Click Rate', bounceRate: 'Bounce Rate' },
  actions: { newEdition: 'New Edition', newIdea: 'New Idea', newDraft: 'New Draft', scheduleNext: 'Schedule Next', viewSubscribers: 'View Subscribers', fullAnalytics: 'Full Analytics', exportCsv: 'Export CSV', configure: 'Configure', retry: 'Try again' },
  empty: { noData: 'No data yet', noEditions: 'No editions found', noSubscribers: 'No subscribers yet', noActivity: 'No activity yet', startPipeline: 'Start your editorial pipeline', addIdea: 'Add your first idea to get started', configCadence: 'Configure cadence for your newsletter types' },
  status: { active: 'Active', atRisk: 'At risk', bounced: 'Bounced', unsubscribed: 'Unsubscribed', anonymized: 'Anonymized', paused: 'Paused' },
  editorial: { throughput: 'Throughput', avgTime: 'Avg Time', movedForward: 'Moved Forward', bottleneck: 'Bottleneck', searchEditions: 'Search editions...', idea: 'Idea', draft: 'Draft', review: 'Review', scheduled: 'Scheduled', sent: 'Sent', issues: 'Issues', archive: 'Archive' },
  schedule: { fillRate: 'Fill Rate', next7Days: 'Next 7 Days', conflicts: 'Conflicts', activeTypes: 'Active Types', emptySlot: 'Empty slot', assignEdition: 'Assign edition' },
  automations: { workflows: 'Workflows', crons: 'Crons', eventsToday: 'Events Today', successRate: 'Success Rate', lastIncident: 'Last Incident' },
  audience: { uniqueSubscribers: 'Unique Subscribers', subscriptions: 'Subscriptions', netGrowth: 'Net Growth (30d)', churnRate: 'Churn Rate', lgpdConsent: 'LGPD Consent' },
  common: { allTypes: 'All Types', updatedJustNow: 'Updated just now', showMore: 'Show more', undo: 'Undo', moved: 'Moved', couldntMove: "Couldn't move" },
}
