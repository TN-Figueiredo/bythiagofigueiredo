export interface BlogHubStrings {
  tabs: { overview: string; editorial: string; schedule: string; analytics: string }
  kpi: { totalPosts: string; published: string; avgReadingTime: string; draftBacklog: string }
  actions: { newPost: string; newIdea: string }
  empty: { noData: string; noPosts: string; startWriting: string; addIdea: string; configCadence: string }
  overview: { tagBreakdown: string; recentPublications: string; velocityTrend: string; untagged: string; readingTime: string; publishedAgo: string }
  editorial: {
    throughput: string; avgTime: string; movedForward: string; bottleneck: string
    searchPosts: string
    idea: string; draft: string; ready: string; scheduled: string; published: string
    review: string; queued: string
    none: string; noTag: string; changeTag: string; addLocale: string; reassigned: string
    untitled: string; open: string; moreActions: string; moveTo: string; duplicate: string; delete: string
    deleted: string; deleteFailed: string; confirmDelete: string
    quickAddPlaceholder: string; ideaCreated: string; ideaFailed: string
    scheduledHint: string
    viewAllPublished: string; archived: string; showArchived: string; hideArchived: string
  }
  deletePost: {
    triggerLabel: string; triggerAriaLabel: string
    dialogTitle: string; dialogDescription: string
    cancel: string; confirm: string; confirming: string
    successStatus: string
    errorAlreadyPublished: string; errorNotFound: string; errorDb: string; errorUnknown: string
  }
  filters: {
    all: string; draft: string; review: string; ready: string; queued: string; published: string; archived: string
    searchPlaceholder: string; searchAriaLabel: string
  }
  schedule: {
    fillRate: string; next7Days: string; avgReadingTime: string; activeLocales: string
    cadenceConfig: string; publishTime: string; startDay: string
    resumeCadence: string; pauseCadence: string; save: string; cancelEdit: string
    saved: string; cadenceRangeError: string; timeFormatError: string; updateFailed: string
    daysUnit: string; editCadence: string
    slotDate: string; scheduledFor: string; publishedOn: string
  }
  analytics: { comingSoon: string; comingSoonDescription: string }
  common: { allTags: string; allLocales: string; updatedJustNow: string; showMore: string; moved: string; couldntMove: string; edit: string; posts: string }
  scheduleModal: {
    title: string; scheduling: string
    dateLabel: string; timeLabel: string
    cancel: string; confirm: string
    dateRequired: string; datePast: string
  }
  tagDrawer: {
    createTitle: string; editTitle: string
    sectionEssentials: string; sectionAppearance: string
    nameLabel: string; namePlaceholder: string
    slugLabel: string; slugPreview: string; slugWarning: string
    badgeLabel: string; badgePlaceholder: string; badgeHint: string
    colorLabel: string; colorDarkLabel: string; colorDarkHint: string
    clearColor: string
    close: string
    valRequired: string; valMinChars: string; valMaxChars: string
    valInvalidFormat: string; valReservedSlug: string; valInvalidHex: string; valSlugInUse: string
    tagNotFound: string; unknownError: string; typeNameToConfirm: string
    dangerZone: string; deleteButton: string; deleteConfirmDeps: string; deleteNameMismatch: string
    createButton: string; saveButton: string; creating: string; saving: string; cancel: string
    toastCreated: string; toastSaved: string; toastDeleted: string
    saveFailed: string
  }
}
