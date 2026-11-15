import type { LibraryStatus } from '../../../shared'
import './library.css'

export function LibraryView({
  status,
  query = '',
  onOpen,
  onSelect
}: {
  status: LibraryStatus
  query?: string
  onOpen: () => void
  onSelect?: (path: string) => void
}) {
  if (status.state === 'empty') {
    return (
      <div className="library-copy">
        <h1>库是空的</h1>
        <p>这个文件夹里还没有文件。</p>
        <button className="control library-open" type="button" onClick={onOpen}>
          换一个文件夹
        </button>
      </div>
    )
  }
  if (status.state === 'failed') {
    return (
      <div className="library-copy">
        <h1>没有读成</h1>
        <p>{status.message}</p>
        <button className="control library-open" type="button" onClick={onOpen}>
          再试一次
        </button>
      </div>
    )
  }
  if (status.state === 'ready') {
    const visible = listed(status.entries, query)
    return (
      <div className="library-copy">
        <h1>库里的文件</h1>
        {visible.length === 0 ? <p>没有相符的</p> : null}
        <ul className="library-files">
          {visible.map((entry) => (
            <li className="density-note" key={entry.path}>
              {entry.kind === 'markdown' && onSelect ? (
                <button className="library-file" type="button" onClick={() => onSelect(entry.path)}>
                  {entry.name}
                </button>
              ) : (
                entry.name
              )}
            </li>
          ))}
        </ul>
        <button className="control library-open" type="button" onClick={onOpen}>
          换一个文件夹
        </button>
      </div>
    )
  }
  return (
    <div className="library-copy">
      <h1>选择文件夹</h1>
      <p>笔记放在一个本地文件夹里。</p>
      <button className="control library-open" type="button" onClick={onOpen}>
        选择文件夹
      </button>
    </div>
  )
}

function listed(entries: Extract<LibraryStatus, { state: 'ready' }>['entries'], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries
  return entries.filter((entry) => {
    if (entry.name.toLowerCase().includes(needle)) return true
    return entry.kind === 'markdown' && entry.title.toLowerCase().includes(needle)
  })
}
