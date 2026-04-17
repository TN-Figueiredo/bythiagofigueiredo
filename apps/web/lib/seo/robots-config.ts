import type { SiteSeoConfig } from './config'

/**
 * Single rule emitted into the Next.js robots manifest. Mirrors the shape
 * `MetadataRoute.Robots.rules[number]` accepts (`{ userAgent, allow?,
 * disallow?, crawlDelay? }`) but stays plain so route handlers can spread
 * easily and we don't fight the union typing.
 */
export type Rule = {
  userAgent: string
  allow?: string | string[]
  disallow?: string | string[]
  crawlDelay?: number
}

/**
 * AI/LLM crawlers + scrapers blocked when SEO_AI_CRAWLERS_BLOCKED=true.
 * Curated list — explicitly KEEPS social-preview bots (facebookexternalhit,
 * Twitterbot, LinkedInBot, Slackbot, WhatsApp, TelegramBot) and search engines
 * (Googlebot, Bingbot, DuckDuckBot, YandexBot) under the default `User-agent: *`
 * Allow rule. Only model-training and aggressive scrapers are denied.
 *
 * Source: 2026-04-17 plan update covering 18 known training/aggregation UAs.
 */
const AI_CRAWLERS = [
  'GPTBot', // OpenAI training
  'ChatGPT-User', // OpenAI live retrieval
  'OAI-SearchBot', // OpenAI search index
  'ClaudeBot', // Anthropic training (current)
  'anthropic-ai', // Anthropic legacy UA
  'Claude-Web', // Anthropic search retrieval
  'CCBot', // Common Crawl (feeds many LLMs)
  'PerplexityBot', // Perplexity AI
  'Google-Extended', // Google AI training opt-out (does NOT affect Googlebot for search)
  'Applebot-Extended', // Apple AI training opt-out (does NOT affect Applebot for Spotlight/Siri)
  'FacebookBot', // Meta AI (NOT facebookexternalhit which is link-share preview)
  'Bytespider', // ByteDance/TikTok
  'Amazonbot', // Amazon LLM
  'Diffbot', // structured-data scraper
  'Omgilibot', // aggregator scraper
  'YouBot', // You.com
  'cohere-ai', // Cohere training
  'AI2Bot', // Allen AI
]

export function buildRobotsRules(input: {
  config: SiteSeoConfig | null
  host: string
  aiCrawlersBlocked: boolean
  protectedPaths: readonly string[]
}): Rule[] {
  void input.config
  void input.host
  const main: Rule = {
    userAgent: '*',
    allow: '/',
    disallow: [...input.protectedPaths],
  }
  const rules: Rule[] = [main]
  if (input.aiCrawlersBlocked) {
    for (const agent of AI_CRAWLERS) {
      rules.push({ userAgent: agent, disallow: '/' })
    }
  }
  return rules
}
