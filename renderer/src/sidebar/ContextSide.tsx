import type { ContextItem } from './model'
import './sidebar.css'

export function ContextSide({
  items,
  empty,
  onPick
}: {
  items: readonly ContextItem[]
  empty: string
  onPick: (item: ContextItem) => void
}) {
  return (
    <div className="context-side">
      {items.length === 0 ? <p className="side-empty">{empty}</p> : null}
      <ul className="context-list">
        {items.map((item) => (
          <li key={item.id}>
            <button className="shell-file" type="button" onClick={() => onPick(item)}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
