import { defaultComponents, type ComponentRegistry } from '@tn-figueiredo/cms'
import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'
import { LinkedH2, LinkedH3 } from '@tn-figueiredo/cms-reader/client'

export const blogRegistry: ComponentRegistry = {
  ...defaultComponents,
  CodeBlock: ShikiCodeBlock as ComponentRegistry[string],
  h2: LinkedH2 as unknown as ComponentRegistry[string],
  h3: LinkedH3 as unknown as ComponentRegistry[string],
}
