import { useEffect, useRef, useState } from 'react'
import type { KeepNoteBridge } from '../../../shared'
import { useNoteSave } from '../client'
import './work.css'
import {
  fieldForLine,
  lineForField,
  parseWork,
  serializeWork,
  sourceLineAt,
  sourceOffset,
  type WorkField,
  type WorkNote
} from './text'

const sourceLineHeight = 28

function placeTextareaLine(field: HTMLTextAreaElement, line: number): void {
  const lines = field.value.split('\n')
  const safe = Math.min(Math.max(line, 0), Math.max(lines.length - 1, 0))
  let offset = 0
  for (let index = 0; index < safe; index += 1) offset += (lines[index]?.length ?? 0) + 1
  field.setSelectionRange(offset, offset)
}

export function WorkPage({
  path,
  body,
  bridge,
  onOpenTitle,
  scrollTo = null,
  saveDelay = 400
}: {
  path: string
  body: string
  bridge: KeepNoteBridge
  onOpenTitle?: (title: string) => void
  scrollTo?: { text: string; index: number; nonce: number } | null
  saveDelay?: number
}) {
  const [note, setNote] = useState(() => parseWork(body))
  const noteRef = useRef(note)
  const pageRef = useRef<HTMLElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const doingRef = useRef<HTMLTextAreaElement>(null)
  const focusRef = useRef<WorkField>({ section: 'doing', index: 0 })
  const pendingLine = useRef<number | null>(null)
  const pendingField = useRef<WorkField | null>(null)
  const pendingDoingLine = useRef(0)
  const [mode, setMode] = useState<'layout' | 'source'>('layout')
  const [source, setSource] = useState(body)
  const save = useNoteSave(bridge, path, serializeWork(note), saveDelay)

  useEffect(() => {
    if (mode !== 'source' || pendingLine.current === null) return
    const field = sourceRef.current
    const line = pendingLine.current
    pendingLine.current = null
    if (!field) return
    const caret = sourceOffset(field.value, line)
    field.focus()
    field.setSelectionRange(caret, caret)
    field.scrollTop = line * sourceLineHeight
  }, [mode, source])

  useEffect(() => {
    if (mode === 'source' || pendingField.current === null) return
    const field = pendingField.current
    pendingField.current = null
    const target = pageRef.current?.querySelector(`[data-work-section="${field.section}"][data-work-index="${field.index}"]`)
    if (target instanceof HTMLElement) {
      focusRef.current = field
      if (target instanceof HTMLTextAreaElement && field.section === 'doing') placeTextareaLine(target, pendingDoingLine.current)
      target.focus()
      target.scrollIntoView({ block: 'nearest' })
      return
    }
    pageRef.current?.querySelector(`[data-work-section="${field.section}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [mode, note])

  useEffect(() => {
    if (!scrollTo) return
    const headings = [...(pageRef.current?.querySelectorAll('h1, h2') ?? [])]
    const matches = headings.filter((heading) => heading.textContent?.trim() === scrollTo.text)
    matches[scrollTo.index]?.scrollIntoView({ block: 'nearest' })
  }, [scrollTo])

  function change(next: WorkNote): void {
    noteRef.current = next
    setNote(next)
    save.schedule(serializeWork(next))
  }

  function remember(field: WorkField): void {
    focusRef.current = field
  }

  function showSource(): void {
    const next = serializeWork(noteRef.current)
    let line = lineForField(next, focusRef.current)
    const doing = doingRef.current
    if (focusRef.current.section === 'doing' && doing) {
      line += doing.value.slice(0, doing.selectionStart).split('\n').length - 1
    }
    pendingLine.current = line
    setSource(next)
    setMode('source')
  }

  function showLayout(): void {
    const field = sourceRef.current
    const value = field?.value ?? source
    const line = sourceLineAt(value, field?.selectionStart ?? 0)
    if (value !== serializeWork(noteRef.current)) {
      const next = parseWork(value)
      noteRef.current = next
      setNote(next)
      save.schedule(serializeWork(next))
    }
    const fieldAtCaret = fieldForLine(value, line)
    pendingField.current = fieldAtCaret
    pendingDoingLine.current = fieldAtCaret.section === 'doing'
      ? Math.max(line - lineForField(value, { section: 'doing', index: 0 }), 0)
      : 0
    setMode('layout')
  }

  return (
    <article className="work-page" data-mode={mode} ref={pageRef}>
      <div className="work-stick">
        <p className="work-status">{save.status}</p>
        <button className="control work-mode" type="button" onClick={mode === 'source' ? showLayout : showSource}>
          {mode === 'source' ? '排版' : '源码'}
        </button>
        {mode === 'layout' ? (
          <>
            <h1>{note.date}</h1>
            <section data-work-section="doing">
              <h2>在做</h2>
              <textarea
                ref={doingRef}
                className="work-doing"
                aria-label="在做"
                data-work-section="doing"
                data-work-index="0"
                rows={2}
                value={note.doing}
                spellCheck
                onFocus={() => remember({ section: 'doing', index: 0 })}
                onChange={(event) => change({ ...noteRef.current, doing: event.target.value })}
                onCompositionStart={() => save.setComposing(true)}
                onCompositionEnd={() => save.setComposing(false)}
              />
            </section>
          </>
        ) : null}
      </div>
      {mode === 'source' ? (
        <textarea
          ref={sourceRef}
          className="work-source"
          aria-label="源码"
          value={source}
          spellCheck={false}
          onChange={(event) => {
            setSource(event.target.value)
            save.schedule(serializeWork(parseWork(event.target.value)))
          }}
          onCompositionStart={() => save.setComposing(true)}
          onCompositionEnd={(event) => {
            save.schedule(serializeWork(parseWork(event.currentTarget.value)))
            save.setComposing(false)
          }}
        />
      ) : (
        <>
          <section data-work-section="record">
            <h2>记录</h2>
            {note.records.map((record, index) =>
              record.kind === 'raw' ? (
                <p className="work-raw" data-work-section="record" data-work-index={index} key={`raw-${index}`}>
                  {record.text}
                </p>
              ) : (
                <div className="work-record" key={`${record.time}-${index}`}>
                  <span className="work-time">{record.time}</span>
                  <input
                    aria-label={`记录 ${record.time}`}
                    data-work-section="record"
                    data-work-index={index}
                    value={record.text}
                    onFocus={() => remember({ section: 'record', index })}
                    onChange={(event) => {
                      const records = noteRef.current.records.map((item, itemIndex) =>
                        itemIndex === index && item.kind === 'entry' ? { ...item, text: event.target.value } : item
                      )
                      change({ ...noteRef.current, records })
                    }}
                  />
                </div>
              )
            )}
          </section>
          <section data-work-section="output">
            <h2>产出</h2>
            {note.output.map((item, index) => (
              <button
                className="work-output"
                type="button"
                key={`${item.title}-${index}`}
                data-work-section="output"
                data-work-index={index}
                onFocus={() => remember({ section: 'output', index })}
                onClick={() => onOpenTitle?.(item.title)}
              >
                {item.title}
              </button>
            ))}
          </section>
          <section className="work-left" data-work-section="left">
            <h2>留下</h2>
            {note.left.map((task, index) => (
              <label className="work-task" data-done={task.checked ? 'true' : 'false'} key={`${task.text}-${index}`}>
                <input
                  type="checkbox"
                  checked={task.checked}
                  aria-label={`完成 ${task.text}`}
                  onChange={(event) => {
                    const left = noteRef.current.left.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, checked: event.target.checked } : item
                    )
                    change({ ...noteRef.current, left })
                  }}
                />
                <input
                  type="text"
                  aria-label={`留下 ${task.text}`}
                  data-work-section="left"
                  data-work-index={index}
                  value={task.text}
                  onFocus={() => remember({ section: 'left', index })}
                  onChange={(event) => {
                    const left = noteRef.current.left.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, text: event.target.value } : item
                    )
                    change({ ...noteRef.current, left })
                  }}
                />
              </label>
            ))}
          </section>
        </>
      )}
    </article>
  )
}
