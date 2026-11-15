import type { ChangedNote } from '../../../shared'
import './sidebar.css'

export function WorkContext({
  pending,
  accepted,
  onAccept,
  onOpen
}: {
  pending: readonly ChangedNote[]
  accepted: readonly ChangedNote[]
  onAccept: (path: string) => void
  onOpen: (path: string) => void
}) {
  return (
    <div className="context-side">
      <section data-changed="pending">
        <p className="context-label">尚未记入</p>
        {pending.length === 0 ? <p className="side-empty">今天还没有</p> : null}
        <ul className="context-list">
          {pending.map((note) => (
            <li key={note.path || note.title}>
              <button className="shell-file" type="button" onClick={() => onAccept(note.path)}>
                {note.title}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section data-changed="accepted">
        <p className="context-label">已经记入</p>
        {accepted.length === 0 ? <p className="side-empty">产出还是空的</p> : null}
        <ul className="context-list">
          {accepted.map((note) => (
            <li key={`${note.path}:${note.title}`}>
              <button className="shell-file" type="button" disabled={!note.path} onClick={() => onOpen(note.path)}>
                {note.title}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
