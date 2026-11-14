import type { LibraryStatus } from '../../../shared'
import './library.css'

export function LibraryView({ status, onOpen }: { status: LibraryStatus; onOpen: () => void }) {
  if (status.state === 'empty') {
    return (
      <>
        <h1>库是空的</h1>
        <p>这个文件夹里还没有文件。</p>
        <button className="control library-open" type="button" onClick={onOpen}>
          换一个文件夹
        </button>
      </>
    )
  }
  if (status.state === 'failed') {
    return (
      <>
        <h1>没有读成</h1>
        <p>{status.message}</p>
        <button className="control library-open" type="button" onClick={onOpen}>
          再试一次
        </button>
      </>
    )
  }
  if (status.state === 'ready') {
    return (
      <>
        <h1>库里的文件</h1>
        <ul className="library-files">
          {status.entries.map((entry) => (
            <li className="density-note" key={entry.path}>
              {entry.name}
            </li>
          ))}
        </ul>
        <button className="control library-open" type="button" onClick={onOpen}>
          换一个文件夹
        </button>
      </>
    )
  }
  return (
    <>
      <h1>选择文件夹</h1>
      <p>笔记放在一个本地文件夹里。</p>
      <button className="control library-open" type="button" onClick={onOpen}>
        选择文件夹
      </button>
    </>
  )
}
