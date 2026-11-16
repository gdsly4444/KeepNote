import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import type { KeepNoteBridge, Proposal } from '../../../shared'
import { ignore, ignoreApply, ignoreAsk, PageAgent } from '../diff'
import { useNoteSave } from '../client'
import {
  essayExtensions,
  joinDocument,
  lineIndexAt,
  offsetOfLine,
  parseContent,
  placeCaret,
  serializeDocument,
  sourceLineOf,
  splitFrontmatter
} from '../prose'
import './journal.css'
import { appendJournalEntry, clockTime } from './text'

const sourceLineHeight = 28

export function JournalPage({
  path,
  body,
  bridge,
  scrollTo = null,
  autofocus = true,
  saveDelay = 400,
  proposal = null,
  onApply,
  onDiscard,
  onAsk
}: {
  path: string
  body: string
  bridge: KeepNoteBridge
  scrollTo?: { text: string; index: number; nonce: number } | null
  autofocus?: boolean
  saveDelay?: number
  proposal?: Proposal | null
  onApply?: (groupId?: string) => void
  onDiscard?: () => void
  onAsk?: (text: string, selection: string) => void
}) {
  const initial = splitFrontmatter(body)
  const headRef = useRef(initial.head)
  const fullRef = useRef(body)
  const renderedRef = useRef(body)
  const applying = useRef(false)
  const composeRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const pendingLine = useRef<number | null>(null)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'layout' | 'source'>('layout')
  const [picked, setPicked] = useState('')
  const [source, setSource] = useState(body)
  const save = useNoteSave(bridge, path, body, saveDelay)
  const editor = useEditor({
    extensions: essayExtensions(),
    content: parseContent(initial.content).doc,
    autofocus: false,
    editorProps: {
      attributes: { spellcheck: 'true' },
      handleDOMEvents: {
        compositionstart: () => {
          save.setComposing(true)
          return false
        },
        compositionend: () => {
          save.setComposing(false)
          return false
        }
      }
    },
    onUpdate: ({ editor: current, transaction }) => {
      if (applying.current || !transaction.docChanged) return
      const next = joinDocument(headRef.current, serializeDocument(current.getJSON()))
      fullRef.current = next
      renderedRef.current = next
      save.schedule(next)
    }
  }, [])

  useEffect(() => {
    if (!autofocus) return
    const field = composeRef.current
    const focus = (): void => field?.focus()
    focus()
    const frame = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(frame)
  }, [autofocus])

  useEffect(() => {
    if (!scrollTo) return
    const headings = [...(columnRef.current?.querySelectorAll('h1, h2, h3, h4, h5, h6') ?? [])]
    const matches = headings.filter((heading) => heading.textContent?.trim() === scrollTo.text)
    matches[scrollTo.index]?.scrollIntoView({ block: 'nearest' })
  }, [scrollTo])

  useEffect(() => {
    if (mode !== 'source' || pendingLine.current === null) return
    const field = sourceRef.current
    const line = pendingLine.current
    pendingLine.current = null
    if (!field) return
    const parts = splitFrontmatter(field.value)
    const headLines = parts.head === '' ? 0 : parts.head.split('\n').length - 1
    const caret = parts.head.length + offsetOfLine(parts.content, line)
    field.focus()
    field.setSelectionRange(caret, caret)
    field.scrollTop = (headLines + line) * sourceLineHeight
  }, [mode, source])

  useEffect(() => {
    if (mode === 'source' || pendingLine.current === null || !editor) return
    const line = pendingLine.current
    pendingLine.current = null
    const content = splitFrontmatter(sourceRef.current?.value ?? source).content
    placeCaret(editor, columnRef.current, content, line)
  }, [mode, editor, source])

  function submit(text: string): void {
    const sentence = text.replace(/\s+/g, ' ').trim()
    if (!sentence || !editor) return
    const next = appendJournalEntry(fullRef.current, clockTime(), sentence)
    applyDocument(next)
    setDraft('')
    save.schedule(next)
    composeRef.current?.focus()
  }

  function applyDocument(next: string): void {
    fullRef.current = next
    renderedRef.current = next
    const parts = splitFrontmatter(next)
    headRef.current = parts.head
    applying.current = true
    editor?.commands.setContent(parseContent(parts.content).doc)
    applying.current = false
  }

  function showSource(): void {
    if (!editor) return
    const next = fullRef.current
    const content = splitFrontmatter(next).content
    const line = document.activeElement === composeRef.current
      ? Math.max(content.replace(/\n+$/, '').split('\n').length - 1, 0)
      : sourceLineOf(editor, content)
    pendingLine.current = line
    setSource(next)
    setMode('source')
  }

  function showLayout(): void {
    if (!editor) return
    const field = sourceRef.current
    const value = field?.value ?? source
    const offset = field?.selectionStart ?? 0
    const parts = splitFrontmatter(value)
    const line = lineIndexAt(parts.content, Math.max(0, offset - parts.head.length))
    if (value !== renderedRef.current) {
      applyDocument(value)
      const next = joinDocument(headRef.current, serializeDocument(editor.getJSON()))
      fullRef.current = next
      renderedRef.current = next
      save.schedule(next)
    }
    pendingLine.current = line
    setMode('layout')
  }

  return (
    <article className="journal-page" data-mode={mode} onMouseUp={() => setPicked(window.getSelection()?.toString() ?? '')}>
      <PageAgent
        type="journal"
        selection={picked}
        proposal={proposal}
        onApply={onApply ?? ignoreApply}
        onDiscard={onDiscard ?? ignore}
        onAsk={onAsk ?? ignoreAsk}
      />
      <p className="journal-status">{save.status}</p>
      <button className="control journal-mode" type="button" onClick={mode === 'source' ? showLayout : showSource}>
        {mode === 'source' ? '排版' : '源码'}
      </button>
      <div className="journal-column" ref={columnRef}>
        <div hidden={mode === 'source'}>
          <EditorContent editor={editor} />
        </div>
        <textarea
          ref={sourceRef}
          className="journal-source"
          hidden={mode !== 'source'}
          aria-label="源码"
          value={source}
          spellCheck={false}
          onChange={(event) => {
            fullRef.current = event.target.value
            setSource(event.target.value)
            save.schedule(event.target.value)
          }}
          onCompositionStart={() => save.setComposing(true)}
          onCompositionEnd={(event) => {
            fullRef.current = event.currentTarget.value
            save.schedule(event.currentTarget.value)
            save.setComposing(false)
          }}
        />
        <input
          ref={composeRef}
          className="journal-compose"
          hidden={mode === 'source'}
          aria-label="新的一条"
          value={draft}
          spellCheck
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            event.preventDefault()
            submit(event.currentTarget.value)
          }}
        />
      </div>
    </article>
  )
}
