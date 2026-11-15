import type { DocumentType, LibraryEntry } from '../../../shared'
import { FileGlyph } from './FileGlyph'
import { recentNotes, typeMark } from './model'
import './sidebar.css'

const createTypes: readonly DocumentType[] = ['work', 'essay', 'journal', 'list', 'tech']

export function NavSide({
  entries,
  currentType,
  currentPath,
  query,
  onOpen,
  onCreate
}: {
  entries: readonly LibraryEntry[]
  currentType: DocumentType | null
  currentPath: string | null
  query: string
  onOpen: (path: string) => void
  onCreate: (type: DocumentType) => void
}) {
  const recent = currentType === 'work' || currentType === 'journal'
  const notes = recent ? recentNotes(entries, currentType) : []
  const needle = query.trim().toLowerCase()
  const files = entries.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
  const days = notes.filter((entry) => !needle || entry.name.toLowerCase().includes(needle) || entry.title.includes(needle))
  const visible = recent ? days.length : files.length

  return (
    <div className="nav-side">
      <div className="nav-create">
        {createTypes.map((type) => (
          <button key={type} className="nav-create-button" type="button" onClick={() => onCreate(type)}>
            {typeMark(type)}
          </button>
        ))}
      </div>
      {visible === 0 ? <p className="side-empty">{needle ? '没有相符的' : recent ? '近几天还没有' : '库里还没有文件'}</p> : null}
      <ul className="shell-files">
        {recent
          ? days.map((entry) => (
              <li key={entry.path}>
                <span className="nav-mark">{typeMark(entry.type)}</span>
                <button
                  className="shell-file"
                  type="button"
                  aria-current={entry.path === currentPath ? 'true' : undefined}
                  onClick={() => onOpen(entry.path)}
                >
                  {entry.title}
                </button>
              </li>
            ))
          : files.map((entry) => (
              <li key={entry.path}>
                {entry.kind === 'markdown' ? (
                  <>
                    <span className="nav-mark">{typeMark(entry.type)}</span>
                    <button
                      className="shell-file"
                      type="button"
                      aria-current={entry.path === currentPath ? 'true' : undefined}
                      onClick={() => onOpen(entry.path)}
                    >
                      {entry.name}
                    </button>
                  </>
                ) : (
                  <span className="nav-file">
                    <FileGlyph name={entry.name} />
                    {entry.name}
                  </span>
                )}
              </li>
            ))}
      </ul>
    </div>
  )
}
