import { useEffect, useState } from 'react'
import { getKeepNote } from '../client'

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
    <main className="shell">
      <p className="shell-kicker">KeepNote</p>
      <h1>进程骨架</h1>
      <p>{status}</p>
    </main>
  )
}
