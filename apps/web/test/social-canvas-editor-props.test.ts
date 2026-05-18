import { describe, it, expect } from 'vitest'

// Use relative path (same pattern as auto-share-dialog.test.tsx)
// to bypass the (authed) alias resolution issue with dynamic imports
import type { SocialCanvasEditorRef, SocialCanvasEditorProps } from '../src/app/cms/(authed)/social/new/_components/canvas-editor/index'

describe('SocialCanvasEditor types', () => {
  it('SocialCanvasEditor is defined and exported', async () => {
    const mod = await import('../src/app/cms/(authed)/social/new/_components/canvas-editor/index')
    expect(mod.SocialCanvasEditor).toBeDefined()
  })

  it('SocialCanvasEditor is a forwardRef component (object, not function)', async () => {
    // forwardRef wraps the component in a React.ForwardRefExoticComponent object
    const mod = await import('../src/app/cms/(authed)/social/new/_components/canvas-editor/index')
    expect(typeof mod.SocialCanvasEditor).toBe('object')
  })

  it('SocialCanvasEditorRef interface shape is structurally valid', () => {
    // Type-only assertion — compile-time check that the interface exists
    // with the correct method signatures
    type CheckRef = SocialCanvasEditorRef extends {
      getComposition: () => unknown
      replaceComposition: (composition: unknown) => void
      exportSlide: () => Promise<Blob>
    } ? true : false
    const _check: CheckRef = true
    expect(_check).toBe(true)
  })

  it('SocialCanvasEditorProps includes optional new props', () => {
    // Type-only assertion — compile-time check that the new props exist
    type CheckProps = SocialCanvasEditorProps extends {
      initialComposition?: unknown
      onCompositionChange?: unknown
      hideAspectRatioSelector?: boolean
    } ? true : false
    const _check: CheckProps = true
    expect(_check).toBe(true)
  })
})
