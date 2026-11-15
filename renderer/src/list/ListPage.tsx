import { createElement, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { KeepNoteBridge } from '../../../shared'
import { useNoteSave } from '../client'
import './list.css'
import { parseList, serializeList, type ListNote, type ListRow } from './text'

export function ListPage({
  path,
  body,
  bridge,
  scrollTo = null,
  saveDelay = 400
}: {
  path: string
  body: string
  bridge: KeepNoteBridge
  scrollTo?: { text: string; index: number; nonce: number } | null
  saveDelay?: number
}) {
  const [note, setNote] = useState(() => parseList(body))
  const noteRef = useRef(note)
  const pageRef = useRef<HTMLElement>(null)
  const pendingFocus = useRef<number | null>(null)
  const composing = useRef(false)
  const save = useNoteSave(bridge, path, serializeList(note), saveDelay)

  useEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    const field = pageRef.current?.querySelector(`[data-row="${index}"]`)
    if (field instanceof HTMLElement) field.focus()
  }, [note])

  useEffect(() => {
    if (!scrollTo) return
    const headings = [...(pageRef.current?.querySelectorAll('h1, h2, h3') ?? [])]
    const matches = headings.filter((heading) => {
      const field = heading.querySelector('input')
      const text = field instanceof HTMLInputElement ? field.value : heading.textContent?.trim()
      return text === scrollTo.text
    })
    matches[scrollTo.index]?.scrollIntoView({ block: 'nearest' })
  }, [scrollTo])

  function change(next: ListNote, focus: number | null = null): void {
    noteRef.current = next
    pendingFocus.current = focus
    setNote(next)
    save.schedule(serializeList(next))
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>, index: number): void {
    if (composing.current) return
    const row = noteRef.current.rows[index]
    if (!row) return
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      if (row.kind !== 'task') return
      event.preventDefault()
      toggle(index)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      insertAfter(index, event.currentTarget.selectionStart ?? event.currentTarget.value.length)
      return
    }
    if (event.key === 'Tab' && row.kind === 'task') {
      event.preventDefault()
      const depth = event.shiftKey ? Math.max(0, row.depth - 1) : row.depth + 1
      const rows = noteRef.current.rows.map((item, itemIndex) =>
        itemIndex === index && item.kind === 'task' ? { ...item, depth } : item
      )
      change({ ...noteRef.current, rows }, index)
    }
  }

  function toggle(index: number): void {
    const rows = noteRef.current.rows.map((item, itemIndex) =>
      itemIndex === index && item.kind === 'task' ? { ...item, checked: !item.checked } : item
    )
    change({ ...noteRef.current, rows })
  }

  function insertAfter(index: number, caret: number): void {
    const row = noteRef.current.rows[index]
    if (!row) return
    const rows = noteRef.current.rows.flatMap((item, itemIndex): ListRow[] => {
      if (itemIndex !== index) return [item]
      if (item.kind === 'task') {
        return [
          { ...item, text: item.text.slice(0, caret) },
          { kind: 'task', depth: item.depth, checked: false, text: item.text.slice(caret) }
        ]
      }
      return [item, { kind: 'task', depth: 0, checked: false, text: '' }]
    })
    change({ ...noteRef.current, rows }, index + 1)
  }

  function compose(value: boolean): void {
    composing.current = value
    save.setComposing(value)
  }

  return (
    <article className="list-page" ref={pageRef}>
      <p className="list-status">{save.status}</p>
      <h1>
        <input
          aria-label="标题"
          value={note.title}
          onChange={(event) => change({ ...noteRef.current, title: event.target.value })}
        />
      </h1>
      {note.rows.map((row, index) => {
        const field = (
          <input
            data-row={index}
            aria-label={row.kind === 'heading' ? '分组' : row.kind === 'task' ? '任务' : '未归类'}
            value={row.text}
            onChange={(event) => {
              const rows = noteRef.current.rows.map((item, itemIndex) =>
                itemIndex === index ? { ...item, text: event.target.value } : item
              )
              change({ ...noteRef.current, rows })
            }}
            onKeyDown={(event) => onKey(event, index)}
            onCompositionStart={() => compose(true)}
            onCompositionEnd={() => compose(false)}
          />
        )
        if (row.kind === 'heading') return groupTitle(row.level, field, `${row.level}-${index}`)
        if (row.kind === 'loose') {
          const labeled = note.rows[index - 1]?.kind !== 'loose'
          return (
            <div className="list-loose" key={`loose-${index}`}>
              {labeled ? <p className="list-loose-label">未归类</p> : null}
              {field}
              <button
                type="button"
                onClick={() => {
                  const rows = noteRef.current.rows.map((item, itemIndex) =>
                    itemIndex === index ? { kind: 'task' as const, depth: 0, checked: false, text: item.text } : item
                  )
                  change({ ...noteRef.current, rows }, index)
                }}
              >
                收成任务项
              </button>
            </div>
          )
        }
        return (
          <label
            className="list-task"
            data-done={row.checked ? 'true' : 'false'}
            data-depth={row.depth}
            key={`task-${index}`}
            style={{ marginLeft: `${row.depth * 1.25}em` }}
          >
            <input
              type="checkbox"
              checked={row.checked}
              aria-label={`完成 ${row.text}`}
              onChange={() => toggle(index)}
            />
            {field}
          </label>
        )
      })}
    </article>
  )
}

function groupTitle(level: number, field: ReactNode, key: string) {
  return createElement(level <= 2 ? 'h2' : 'h3', { className: 'list-heading', key }, field)
}
