export interface BrevoSendRequest {
  sender: { email: string; name: string }
  to: Array<{ email: string; name?: string }>
  subject: string
  htmlContent: string
  textContent?: string
  replyTo?: { email: string; name?: string }
  tags?: string[]
}

export interface BrevoSendResponse {
  messageId: string
}
