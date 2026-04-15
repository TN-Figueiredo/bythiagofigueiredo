import type { IEmailTemplate } from '../interfaces/email-template'

export class TemplateRegistry {
  private templates = new Map<string, IEmailTemplate<unknown>>()

  register<V>(template: IEmailTemplate<V>): void {
    this.templates.set(template.name, template as IEmailTemplate<unknown>)
  }

  get<V>(name: string): IEmailTemplate<V> | undefined {
    return this.templates.get(name) as IEmailTemplate<V> | undefined
  }

  names(): string[] {
    return [...this.templates.keys()]
  }
}
