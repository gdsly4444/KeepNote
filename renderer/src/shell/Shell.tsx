import { useEffect, useState } from 'react'
import { getKeepNote } from '../client'
import { LibraryView, loadLibrary, openLibrary } from '../library'
import type { LibraryStatus } from '../../../shared'
import './shell.css'

export function Shell() {
  const [status, setStatus] = useState<LibraryStatus>({ state: 'closed' })

  useEffect(() => {
    const keepNote = getKeepNote()
    if (!keepNote) {
      setStatus({ state: 'failed', message: '逻辑进程没有接通' })
      return
    }
    let cancelled = false
    const apply = (next: LibraryStatus): void => {
      if (!cancelled) setStatus(next)
    }
    void loadLibrary(keepNote).then(apply, () => apply({ state: 'failed', message: '库没有读成' }))
    const unsubscribe = keepNote.subscribe('library-changed', () => {
      void loadLibrary(keepNote).then(apply, () => apply({ state: 'failed', message: '库没有读成' }))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const open = (): void => {
    const keepNote = getKeepNote()
    if (!keepNote) {
      setStatus({ state: 'failed', message: '逻辑进程没有接通' })
      return
    }
    void openLibrary(keepNote).then(setStatus, () => setStatus({ state: 'failed', message: '库没有读成' }))
  }

  return (
    <div className="shell">
      <aside className="shell-side">
        <p className="shell-kicker">KeepNote</p>
      </aside>
      <main className="shell-page motion-displace">
        <LibraryView status={status} onOpen={open} />
      </main>
    </div>
  )
}
