import { useState } from 'react'
import './sidebar.css'

export function AgentSide({
  reads,
  message,
  onAsk
}: {
  reads: readonly string[]
  message: string
  onAsk: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <form
      className="agent-side"
      onSubmit={(event) => {
        event.preventDefault()
        const text = draft.trim()
        if (!text) return
        setDraft('')
        onAsk(text)
      }}
    >
      <p className="context-label">这一轮读过</p>
      {reads.length === 0 ? <p className="side-empty">还没有读笔记</p> : null}
      <ul className="context-list">
        {reads.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
      {message ? <p className="agent-message">{message}</p> : null}
      <input aria-label="对 Agent 说" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button className="control" type="submit">
        发送
      </button>
    </form>
  )
}
