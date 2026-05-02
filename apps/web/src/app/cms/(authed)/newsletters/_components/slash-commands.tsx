'use client'

import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Image,
  RectangleHorizontal,
  Tags,
  Code,
} from 'lucide-react'

interface CommandItem {
  title: string
  description: string
  icon: React.ReactNode
  command: (props: { editor: Editor; range: Range }) => void
}

function getSlashCommands(callbacks: {
  onImageUpload: () => void
  onInsertCTAButton: () => void
  onInsertMergeTag: (tag: string) => void
}): CommandItem[] {
  return [
    {
      title: 'Heading 1',
      description: 'Large section heading',
      icon: <Heading1 size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: <Heading2 size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      icon: <Heading3 size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
      },
    },
    {
      title: 'Bullet List',
      description: 'Unordered list',
      icon: <List size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      title: 'Numbered List',
      description: 'Ordered list',
      icon: <ListOrdered size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      title: 'Quote',
      description: 'Blockquote',
      icon: <Quote size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      title: 'Code Block',
      description: 'Preformatted code',
      icon: <Code size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
      },
    },
    {
      title: 'Divider',
      description: 'Horizontal rule',
      icon: <Minus size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      title: 'Image',
      description: 'Upload an image',
      icon: <Image size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        callbacks.onImageUpload()
      },
    },
    {
      title: 'CTA Button',
      description: 'Call-to-action button',
      icon: <RectangleHorizontal size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        callbacks.onInsertCTAButton()
      },
    },
    {
      title: 'Merge Tag',
      description: 'Dynamic subscriber data',
      icon: <Tags size={18} />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        callbacks.onInsertMergeTag('subscriber.name')
      },
    },
  ]
}

interface CommandListProps {
  items: CommandItem[]
  command: (item: CommandItem) => void
}

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index]
      if (item) command(item)
    },
    [items, command],
  )

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="bg-[#030712] border border-[#1f2937] rounded-lg shadow-lg p-3 text-sm text-[#6b7280]">
        No results
      </div>
    )
  }

  return (
    <div className="bg-[#030712] border border-[#1f2937] rounded-lg shadow-lg py-1 w-64 max-h-72 overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          onClick={() => selectItem(index)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            index === selectedIndex ? 'bg-purple-500/15 text-purple-400' : 'text-[#d1d5db] hover:bg-[#111827]'
          }`}
        >
          <span className={`flex-shrink-0 ${index === selectedIndex ? 'text-purple-400' : 'text-[#6b7280]'}`}>
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{item.title}</div>
            <div className="text-xs text-[#6b7280] truncate">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  )
})

CommandList.displayName = 'CommandList'

function createSuggestionConfig(callbacks: {
  onImageUpload: () => void
  onInsertCTAButton: () => void
  onInsertMergeTag: (tag: string) => void
}): Omit<SuggestionOptions<CommandItem>, 'editor'> {
  return {
    char: '/',
    items: ({ query }: { query: string }) => {
      const commands = getSlashCommands(callbacks)
      if (!query) return commands
      return commands.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()),
      )
    },
    render: () => {
      let component: ReactRenderer<CommandListRef> | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props: SuggestionProps<CommandItem>) => {
          component = new ReactRenderer(CommandList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) return

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },

        onUpdate: (props: SuggestionProps<CommandItem>) => {
          component?.updateProps(props)
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            })
          }
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          return (component?.ref as unknown as CommandListRef)?.onKeyDown(props) ?? false
        },

        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }
}

export function createSlashCommandExtension(callbacks: {
  onImageUpload: () => void
  onInsertCTAButton: () => void
  onInsertMergeTag: (tag: string) => void
}) {
  return Extension.create({
    name: 'slashCommand',
    addOptions() {
      return { suggestion: createSuggestionConfig(callbacks) }
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ]
    },
  })
}
