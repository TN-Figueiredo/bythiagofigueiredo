import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { ScriptTagExtension } from './script-tag-extension'
import { ScriptPauseExtension } from './script-pause-extension'
import type { Extensions } from '@tiptap/react'

export function getScriptExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      heading: false,           // no headings in beat editor
      codeBlock: false,
      horizontalRule: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    TextStyle,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: placeholder ?? 'Escreva o texto do beat...',
    }),
    CharacterCount,
    ScriptTagExtension,
    ScriptPauseExtension,
  ]
}
