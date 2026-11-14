import { describe, expect, it, vi } from 'vitest'
import type { KeepNoteBridge, LibraryStatus } from '../../../shared'
import { loadLibrary, openLibrary } from './index'

describe('library client', () => {
  it('reads the closed, empty, failed, and ready states from a fake bridge', async () => {
    await expect(loadLibrary(fake({ state: 'closed' }))).resolves.toEqual({ state: 'closed' })
    await expect(loadLibrary(fake({ state: 'empty' }))).resolves.toEqual({ state: 'empty' })
    await expect(loadLibrary(fake({ state: 'failed', message: '这个文件夹读不了' }))).resolves.toEqual({
      state: 'failed',
      message: '这个文件夹读不了'
    })
    const ready = await loadLibrary(
      fake({ state: 'ready', entries: [{ kind: 'file', path: 'brief.pdf', name: 'brief.pdf' }] })
    )
    expect(ready.state).toBe('ready')
  })

  it('turns a failed open into the failure state', async () => {
    const bridge = fake({ state: 'closed' })
    bridge.run = vi.fn(async () => ({ ok: false as const, code: 'library-unreadable', message: '这个文件夹读不了' }))
    await expect(openLibrary(bridge)).resolves.toEqual({ state: 'failed', message: '这个文件夹读不了' })
  })
})

function fake(status: LibraryStatus): KeepNoteBridge {
  return {
    async run() {
      return { ok: true, value: null }
    },
    async query() {
      return { ok: true, value: status }
    },
    subscribe() {
      return () => undefined
    }
  }
}
