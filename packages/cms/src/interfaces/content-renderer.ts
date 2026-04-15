import type { ComponentType } from 'react'
import type { CompiledMdx } from '../types/content'

export type ComponentRegistry = Record<string, ComponentType<Record<string, unknown>>>

export interface IContentRenderer {
  compile(source: string, registry: ComponentRegistry): Promise<CompiledMdx>
}
