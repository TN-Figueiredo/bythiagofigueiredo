import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { PipelineImageExtension } from './pipeline-image-node'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { CalloutExtension } from '@/app/cms/(authed)/_shared/editor/callout-node'
import {
  ToggleWrapperExtension,
  ToggleTitleExtension,
  ToggleBodyExtension,
} from '@/app/cms/(authed)/_shared/editor/toggle-node'
import { ColumnsExtension, ColumnExtension } from '@/app/cms/(authed)/_shared/editor/columns-node'
import { SocialEmbedExtension } from '@/app/cms/(authed)/_shared/editor/social-embed-node'
import { MergeTagExtension } from '@/app/cms/(authed)/_shared/editor/merge-tag-node'
import { CTAButtonExtension } from '@/app/cms/(authed)/_shared/editor/cta-button-node'
import { PlaylistEmbedExtension } from '@/app/cms/(authed)/_shared/editor/playlist-embed-node'
import { createSlashCommandExtension } from '@/app/cms/(authed)/_shared/editor/slash-commands'
import type { Extensions } from '@tiptap/react'

interface ExtensionOptions {
  placeholder?: string
}

export function getFullExtensions(options: ExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    PipelineImageExtension.configure({
      inline: false,
      HTMLAttributes: { loading: 'lazy' },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Escreva o conteúdo do seu rascunho...',
    }),
    CharacterCount,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutExtension,
    ToggleWrapperExtension,
    ToggleTitleExtension,
    ToggleBodyExtension,
    ColumnsExtension,
    ColumnExtension,
    SocialEmbedExtension,
  ]
}

export function getCompactExtensions(options: ExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [3, 4] },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Descreva a ideia...',
    }),
    CharacterCount,
  ]
}

export function getBlogExtensions(options: ExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    PipelineImageExtension.configure({
      inline: false,
      HTMLAttributes: { loading: 'lazy' },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Escreva o conteúdo do seu post...',
    }),
    CharacterCount,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutExtension,
    ToggleWrapperExtension,
    ToggleTitleExtension,
    ToggleBodyExtension,
    ColumnsExtension,
    ColumnExtension,
    SocialEmbedExtension,
    MergeTagExtension,
    CTAButtonExtension,
    PlaylistEmbedExtension,
    createSlashCommandExtension({
      onImageUpload: () => {},
      onInsertCTAButton: () => {},
      onInsertMergeTag: () => {},
      onInsertSocialEmbed: () => {},
      onInsertCallout: () => {},
      onInsertToggle: () => {},
      onInsertColumns: () => {},
      onInsertTable: () => {},
      onInsertChecklist: () => {},
      onInsertPlaylist: () => {},
    }),
  ]
}

export function getExtensions(
  preset: 'full' | 'compact' | 'blog',
  options: ExtensionOptions = {},
): Extensions {
  if (preset === 'blog') return getBlogExtensions(options)
  return preset === 'full' ? getFullExtensions(options) : getCompactExtensions(options)
}
