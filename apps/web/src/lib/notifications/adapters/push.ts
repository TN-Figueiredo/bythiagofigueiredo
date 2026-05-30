import type { IChannelAdapter, ChannelResult, IUserProfile } from './interface'
import type { INotification } from '../types'

export class PushAdapter implements IChannelAdapter {
  readonly channel = 'push' as const

  async send(
    _notification: INotification,
    _user: IUserProfile,
  ): Promise<ChannelResult> {
    return { success: false, error: 'web-push not installed' }
  }

  async healthCheck(): Promise<boolean> {
    return false
  }
}
