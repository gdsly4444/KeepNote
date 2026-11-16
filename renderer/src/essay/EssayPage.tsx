import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import type { KeepNoteBridge, Proposal } from '../../../shared'
import { ignore, ignoreApply, ignoreAsk, PageAgent } from '../diff'
import './essay.css'
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

const sourceLineHeight = 28

export function EssayPage({
  path,
  body,
  bridge,
  scrollTo = null,
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
  saveDelay?: number
  proposal?: Proposal | null
  onApply?: (groupId?: string) => void
  onDiscard?: () => void
  onAsk?: (text: string, selection: string) => void
}) {
  const initial = splitFrontmatter(body)
  const headRef = useRef(initial.head)
  const fullRef = useRef(body)
  const pathRef = useRef(path)
  const bridgeRef = useRef(bridge)
  const acked = useRef(body)
  const textRef = useRef(body)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composing = useRef(false)
  const applying = useRef(false)
  const dirty = useRef(false)
  const retries = useRef(0)
  const renderedMode = useRef<'reading' | 'editing'>('reading')
  const pendingLine = useRef<number | null>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'reading' | 'editing' | 'source'>('reading')
  const [picked, setPicked] = useState('')
  const [source, setSource] = useState(body)
  const [status, setStatus] = useState<'已保存' | '保存中'>('已保存')

  pathRef.current = path
  bridgeRef.current = bridge

  const editor = useEditor({
    extensions: essayExtensions(),
    content: parseContent(initial.content).doc,
    editorProps: {
      attributes: { class: 'essay-prose', spellcheck: 'true' },
      handleDOMEvents: {
        compositionstart: () => {
          composing.current = true
          return false
        },
        compositionend: () => {
          composing.current = false
          queueMicrotask(() => schedule(textRef.current))
          return false
        }
      }
    },
    onUpdate: ({ editor: current, transaction }) => {
      if (applying.current || !transaction.docChanged) return
      dirty.current = true
      renderedMode.current = 'editing'
      setMode((value) => (value === 'source' ? value : 'editing'))
      schedule(joinDocument(headRef.current, serializeDocument(current.getJSON())))
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

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
    placeEditorCaret(line)
  }, [mode, editor])

  useEffect(() => {
    if (!scrollTo) return
    const headings = [...(columnRef.current?.querySelectorAll('h1, h2, h3, h4, h5, h6') ?? [])]
    const matches = headings.filter((heading) => heading.textContent?.trim() === scrollTo.text)
    matches[scrollTo.index]?.scrollIntoView({ block: 'nearest' })
  }, [scrollTo])

  function schedule(text: string): void {
    textRef.current = text
    if (composing.current || text === acked.current) {
      if (!composing.current && text === acked.current) setStatus('已保存')
      if (composing.current && text !== acked.current) setStatus('保存中')
      return
    }
    setStatus('保存中')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void persist(), saveDelay)
  }

  async function persist(): Promise<void> {
    const text = textRef.current
    if (text === acked.current) {
      setStatus('已保存')
      return
    }
    let ok = false
    try {
      const result = await bridgeRef.current.run('save', { path: pathRef.current, text })
      ok = result.ok
    } catch {
      ok = false
    }
    if (textRef.current !== text) {
      schedule(textRef.current)
      return
    }
    if (!ok) {
      if (retries.current < 1) {
        retries.current += 1
        timer.current = setTimeout(() => void persist(), 1000)
      }
      return
    }
    retries.current = 0
    acked.current = text
    fullRef.current = text
    setStatus('已保存')
  }

  function placeEditorCaret(line: number): void {
    if (!editor) return
    const content = splitFrontmatter(sourceRef.current?.value ?? source).content
    placeCaret(editor, columnRef.current, content, line)
  }

  function showSource(): void {
    if (!editor) return
    const next = dirty.current ? joinDocument(headRef.current, serializeDocument(editor.getJSON())) : acked.current
    fullRef.current = next
    pendingLine.current = sourceLineOf(editor, splitFrontmatter(next).content)
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
    if (value !== fullRef.current) {
      headRef.current = parts.head
      applying.current = true
      editor.commands.setContent(parseContent(parts.content).doc)
      applying.current = false
      const next = joinDocument(parts.head, serializeDocument(editor.getJSON()))
      fullRef.current = next
      schedule(next)
    }
    pendingLine.current = line
    setMode(renderedMode.current)
  }

  return (
    <article className="essay-page" data-mode={mode} onMouseUp={() => setPicked(window.getSelection()?.toString() ?? '')}>
      <PageAgent
        type="essay"
        selection={picked}
        proposal={proposal}
        onApply={onApply ?? ignoreApply}
        onDiscard={onDiscard ?? ignore}
        onAsk={onAsk ?? ignoreAsk}
      />
      <p className="essay-status">{status}</p>
      <button className="control essay-mode" type="button" onClick={mode === 'source' ? showLayout : showSource}>
        {mode === 'source' ? '排版' : '源码'}
      </button>
      <div className="essay-column" ref={columnRef}>
        <div hidden={mode === 'source'}>
          <EditorContent editor={editor} />
        </div>
        <textarea
          ref={sourceRef}
          className="essay-source"
          hidden={mode !== 'source'}
          aria-label="源码"
          value={source}
          spellCheck={false}
          onChange={(event) => {
            dirty.current = true
            setSource(event.target.value)
            renderedMode.current = 'editing'
            schedule(event.target.value)
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            schedule(event.currentTarget.value)
          }}
        />
      </div>
    </article>
  )
}

