import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import type { KeepNoteBridge } from '../../../shared'
import { useNoteSave } from '../client'
import './tech.css'
import { copiedCode } from './code'
import { TechPreview } from './TechPreview'

export function TechPage({
  path,
  body,
  bridge,
  scrollTo = null,
  saveDelay = 400
}: {
  path: string
  body: string
  bridge: KeepNoteBridge
  scrollTo?: { kind: 'heading' | 'code'; text: string; index: number; line: number; nonce: number } | null
  saveDelay?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const bodyRef = useRef(body)
  const [source, setSource] = useState(body)
  const [preview, setPreview] = useState(false)
  const save = useNoteSave(bridge, path, body, saveDelay)
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: bodyRef.current,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': '源码', spellcheck: 'false' }),
          EditorView.theme({
            '&': { color: 'var(--ink)', backgroundColor: 'transparent' },
            '.cm-content': { fontFamily: 'var(--font-mono)', caretColor: 'var(--ink)' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
            '.cm-gutters': { display: 'none' },
            '&.cm-focused': { outline: 'none' }
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            const next = update.state.doc.toString()
            setSource(next)
            saveRef.current.schedule(next)
          }),
          EditorView.domEventHandlers({
            copy(event, current) {
              const range = current.state.selection.main
              const text = copiedCode(current.state.doc.toString(), range.from, range.to)
              if (text === null || !event.clipboardData) return false
              event.clipboardData.setData('text/plain', text)
              event.preventDefault()
              return true
            }
          })
        ]
      })
    })
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !scrollTo) return
    if (scrollTo.kind === 'code') {
      const line = view.state.doc.line(Math.min(Math.max(scrollTo.line, 1), view.state.doc.lines))
      view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) })
      return
    }
    let seen = 0
    for (let number = 1; number <= view.state.doc.lines; number += 1) {
      const row = view.state.doc.line(number)
      const match = /^(#{1,6})\s+(.*)$/.exec(row.text)
      if (!match || match[2] !== scrollTo.text) continue
      if (seen === scrollTo.index) {
        view.dispatch({ effects: EditorView.scrollIntoView(row.from, { y: 'center' }) })
        return
      }
      seen += 1
    }
  }, [scrollTo])

  return (
    <article className="tech-page" data-mode="source" data-preview={preview ? 'true' : 'false'}>
      <p className="tech-status">{save.status}</p>
      <button className="control tech-mode" type="button" onClick={() => setPreview((value) => !value)}>
        {preview ? '关闭预览' : '预览'}
      </button>
      <div className="tech-split">
        <div className="tech-column" ref={hostRef} />
        {preview ? <TechPreview source={source} /> : null}
      </div>
    </article>
  )
}
