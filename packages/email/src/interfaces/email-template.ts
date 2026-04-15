export interface IEmailTemplate<V> {
  name: string
  render(variables: V, locale: string): Promise<{
    subject: string
    html: string
    text?: string
  }>
}
