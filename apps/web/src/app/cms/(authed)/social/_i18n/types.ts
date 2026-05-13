export interface SocialStrings {
  nav: {
    posts: string
    composer: string
    insights: string
    accounts: string
  }
  posts: {
    title: string
    newPost: string
    tabs: { feed: string; calendar: string; queue: string; drafts: string }
    filters: { all: string; published: string; scheduled: string; failed: string; draft: string; cancelled: string }
    emptyFeed: string
    emptyFeedCta: string
    emptyCalendar: string
    emptyQueue: string
    noContent: string
    review: string
    selected: string
    emptyDrafts: string
    emptyDraftsCta: string
    bulk: { reschedule: string; retry: string; moveToQueue: string; delete: string; deleteConfirm: string }
    card: { clicks: string; engagement: string; edit: string; duplicate: string; view: string; cancel: string; retry: string; delete: string }
  }
  composer: {
    title: string
    modes: { text: string; image: string; video: string }
    editor: {
      contentLabel: string
      contentPlaceholder: string
      urlLabel: string
      urlPlaceholder: string
      hashtagsLabel: string
      hashtagsPlaceholder: string
      evergreenLabel: string
      evergreenHelp: string
      overrideLabel: string
      charCount: string
    }
    preview: { facebook: string; instagram: string; bluesky: string; youtube: string }
    schedule: {
      now: string
      scheduled: string
      queue: string
      pickDate: string
      smartSuggestion: string
      publish: string
      scheduleAction: string
      addToQueue: string
    }
    disabledReason: {
      videoOnly: string
      requiresImage: string
    }
    image: {
      addImages: string
      dragReorder: string
      igCarousel: string
      fbMulti: string
      bsSingle: string
      cropWarning: string
      captionLabel: string
    }
    video: {
      uploadZone: string
      uploadProgress: string
      channelLabel: string
      titleLabel: string
      descLabel: string
      categoryLabel: string
      privacyLabel: string
      playlistLabel: string
      tagsLabel: string
      quotaLabel: string
      crossPost: string
      crossPostNote: string
      abTestTitle: string
      abThumbnails: string
      abTitles: string
      rotationPeriod: string
      firstComment: string
      privacyPrivate: string
      privacyUnlisted: string
      privacyPublic: string
    }
    template: {
      title: string
      blogAnnouncement: string
      videoLaunch: string
      newsletterShare: string
      linkShare: string
      evergreenReshare: string
      createCustom: string
    }
    bilingual: {
      enableEn: string
      ptBr: string
      en: string
      autoTranslate: string
      strategy: { separate: string; differentAccounts: string; primaryOnly: string }
    }
    draftReview: {
      banner: string
      source: string
      approve: string
      discard: string
    }
  }
  detail: {
    title: string
    back: string
    edit: string
    duplicate: string
    delete: string
    deleteConfirm: string
    deliveryStatus: string
    published: string
    failed: string
    retrying: string
    skipped: string
    pending: string
    reconnect: string
    retry: string
    viewOn: string
    timeline: string
    linkClicks: string
    attempt: string
    created: string
    scheduledEvent: string
    publishedOn: string
    failedOn: string
    metrics: { likes: string; comments: string; shares: string }
  }
  insights: {
    title: string
    tabs: { overview: string; bestOf: string; platformHealth: string }
    kpi: {
      postsPublished: string
      deliverySuccess: string
      linkClicks: string
      avgEngagement: string
      aiDraftsApproved: string
    }
    chart: { clicks: string; engagement: string; postCount: string; period7d: string; period30d: string; period90d: string }
    heatmap: { title: string; peakLabel: string }
    bestOf: {
      topThumbnails: string
      topTitles: string
      topPosts: string
      winner: string
      improvement: string
      autoApplied: string
    }
    health: {
      healthy: string
      expired: string
      warning: string
      tokenExpiry: string
      neverExpires: string
      quotaLabel: string
      deliveryRate: string
      recentErrors: string
      reconnect: string
    }
    noData: string
    empty: string
    emptyCta: string
  }
  accounts: {
    title: string
    tabs: { connections: string; automations: string }
    connections: {
      addAccount: string
      manage: string
      reconnect: string
      disconnect: string
      disconnectConfirm: string
      tokenOk: string
      tokenExpired: string
      tokenNever: string
      quotaLabel: string
      empty: string
    }
    automations: {
      blogPublished: string
      videoPublished: string
      newsletterSent: string
      evergreenTimer: string
      tokenExpiring: string
      postFailed: string
      abTestComplete: string
      playlistUpdated: string
      modeLabel: string
      modeDraft: string
      modeAutoPublish: string
      configure: string
    }
    config: {
      title: string
      triggerLabel: string
      actionMode: string
      targetPlatforms: string
      contentTemplate: string
      scheduling: string
      smartSchedule: string
      fixedDelay: string
      aiEnhance: string
      recentActivity: string
      save: string
      cancel: string
      delete: string
    }
  }
  notifications: {
    title: string
    markAllRead: string
    deliveryFailed: string
    tokenExpiring: string
    aiDraftsReady: string
    abTestComplete: string
    publishedSuccess: string
    empty: string
  }
  status: {
    draft: string
    scheduled: string
    publishing: string
    completed: string
    partial_failure: string
    failed: string
    cancelled: string
    pending: string
    published: string
    retrying: string
    skipped: string
  }
  platforms: {
    youtube: string
    facebook: string
    instagram: string
    bluesky: string
  }
}
