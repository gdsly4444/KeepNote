import { useEffect, useState } from 'react'
import { getKeepNote } from '../client'
import './shell.css'

type BridgeState = 'pending' | 'ready' | 'failed'

export function Shell() {
  const [bridge, setBridge] = useState<BridgeState>('pending')

  useEffect(() => {
    const keepNote = getKeepNote()
    if (!keepNote) {
      setBridge('failed')
      return
    }
    let cancelled = false
    const unsubscribe = keepNote.subscribe('ready', () => {
      if (!cancelled) setBridge('ready')
    })
    void keepNote.run('ping').then(
      (result) => {
        if (cancelled) return
        setBridge(result.ok ? 'ready' : 'failed')
      },
      () => {
        if (!cancelled) setBridge('failed')
      }
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const status =
    bridge === 'ready' ? '逻辑进程已接通' : bridge === 'failed' ? '逻辑进程没有接通' : '正在接通逻辑进程'

  return (
    <div className="shell">
      <aside className="shell-side">
        <p className="shell-kicker">KeepNote</p>
      </aside>
      <main className="shell-page motion-displace">
        <p className="shell-kicker">KeepNote</p>
        <h1>进程骨架</h1>
        <p className="shell-status">{status}</p>
        <p className="shell-serif density-essay">中文与 Latin 排在同一行，Ag 12。</p>
        <p className="shell-serif density-journal">日记稍紧一些，条目仍是句子。</p>
        <p className="shell-sans density-note">界面用无衬线。Notes and 笔记。</p>
        <p className="shell-mono density-list">14:02 git status</p>
        <div className="shell-actions">
          <button className="control" type="button">
            当前项
          </button>
          <button className="control" type="button" disabled>
            禁用
          </button>
          <button className="text-link" type="button">
            链接
          </button>
        </div>
      </main>
    </div>
  )
}
