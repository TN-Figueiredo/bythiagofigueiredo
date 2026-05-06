import type { LinkAlert } from '../types.js'

/**
 * Contract for alert notifications (email, webhook, Slack, etc.).
 */
export interface IAlertNotifier {
  notify(alert: LinkAlert): Promise<void>
}
